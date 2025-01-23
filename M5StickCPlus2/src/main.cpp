#include <M5Unified.h>
#include <Kalman.h>
#include <WiFi.h>
#include <vector>

Kalman kalmanX, kalmanY, kalmanZ;
WiFiClient wifiClient;

// wifi設定
const char* SSID = "aterm-a02caf-a";
const char* PASSWORD = "69fbba1581ceb";

const char* SERVER_IP = "192.168.10.2";
const int SERVER_PORT = 3002;
const int DEVICE_ID = 4;

// グローバル変数の最適化
struct {
    float acc[3];
    float gyro[3];
    float kalacc[3] = {0, 0, 0};
    float dt = 0;
    unsigned long prevTime;
    float battery = 100.0f;
    bool display = true;
    uint8_t displaycount = 0;
    bool needScreenUpdate = true;
    unsigned long lastWiFiCheck = 0;
    unsigned long lastScreenUpdate = 0;
    bool isSendingCachedData = false;
} state;

// データキャッシュ用の構造体
struct CachedData {
    float kalacc[3];
    float timestamp;
};

// キャッシュされたデータを保存するベクター
std::vector<CachedData> cachedData;
const size_t MAX_CACHE_SIZE = 3000; // 5分（300秒）分のデータをキャッシュ可能

// 定数の定義
const unsigned long WIFI_CHECK_INTERVAL = 5000;    // WiFi接続チェック間隔（ms）
const unsigned long SCREEN_UPDATE_INTERVAL = 200;  // 画面更新間隔（ms）
const uint8_t LCD_BRIGHTNESS = 70;

float accnorm, dt = 0;
unsigned long currentTime;

void deltaTime(void) {
    currentTime = millis();
    dt = (currentTime - state.prevTime) / 1000.0f;
    state.prevTime = currentTime;
}

void getIMU(void) {
    M5.Imu.getAccel(&state.acc[0], &state.acc[1], &state.acc[2]);
    M5.Imu.getGyro(&state.gyro[0], &state.gyro[1], &state.gyro[2]);
}

void kalmanAccel(void) {
    state.kalacc[0] = kalmanX.getAngle(state.acc[0], state.gyro[0], dt);
    state.kalacc[1] = kalmanY.getAngle(state.acc[1], state.gyro[1], dt);
    state.kalacc[2] = kalmanZ.getAngle(state.acc[2], state.gyro[2], dt);
}

void cacheData() {
    if (cachedData.size() >= MAX_CACHE_SIZE) {
        return; // キャッシュが一杯の場合は新しいデータを追加しない
    }
    
    CachedData data;
    memcpy(data.kalacc, state.kalacc, sizeof(float) * 3);
    data.timestamp = millis() / 1000.0f;
    cachedData.push_back(data);
    
    if (state.display) {
        M5.Lcd.setTextSize(1);
        M5.Lcd.setCursor(3, 150);
        M5.Lcd.printf("Cached: %d", cachedData.size());
        // 残り時間の表示（秒）
        float remainingTime = (MAX_CACHE_SIZE - cachedData.size()) / 20.0f;  // 20Hz sampling rate
        M5.Lcd.setCursor(3, 160);
        M5.Lcd.printf("Remaining: %.1fs", remainingTime);
    }
}

void sendCachedData() {
    if (cachedData.empty() || !wifiClient.connected()) {
        state.isSendingCachedData = false;
        return;
    }
    
    state.isSendingCachedData = true;
    
    // 先頭のデータを送信
    byte data[24];
    *((int*)data) = DEVICE_ID;
    *((float*)(data + 4)) = cachedData.front().kalacc[0];
    *((float*)(data + 8)) = cachedData.front().kalacc[1];
    *((float*)(data + 12)) = cachedData.front().kalacc[2];
    *((float*)(data + 16)) = cachedData.front().timestamp;
    
    if (wifiClient.write(data, sizeof(data))) {
        cachedData.erase(cachedData.begin()); // 送信成功したデータを削除
    }
    
    if (state.display) {
        M5.Lcd.setTextSize(1);
        M5.Lcd.setCursor(3, 160);
        M5.Lcd.printf("Sending cached: %d", cachedData.size());
    }
}

void sendData(void) {
    if (!wifiClient.connected()) {
        cacheData();
        return;
    }
    
    // キャッシュされたデータがある場合、それを優先して送信
    if (!cachedData.empty()) {
        sendCachedData();
        return;
    }
    
    // 通常のデータ送信
    byte data[24];
    float m5time = millis() / 1000.0f;
    *((int*)data) = DEVICE_ID;
    *((float*)(data + 4)) = state.kalacc[0];
    *((float*)(data + 8)) = state.kalacc[1];
    *((float*)(data + 12)) = state.kalacc[2];
    *((float*)(data + 16)) = m5time;
    
    wifiClient.write(data, sizeof(data));
}

void BasicInfo(void) {
    M5.Lcd.setTextSize(2);
    M5.Lcd.setCursor(3,181);
    M5.Lcd.println("ID");
    M5.Lcd.setCursor(3,201);
    M5.Lcd.println("WiFi");
    M5.Lcd.setCursor(3,221);
    M5.Lcd.println("Server");
}

void line(void) {
    M5.Lcd.fillRect(75,179,1,61,WHITE);
    M5.Lcd.fillRect(0,179,135,1,WHITE);
    M5.Lcd.fillRect(0,199,135,1,WHITE);
    M5.Lcd.fillRect(0,219,135,1,WHITE);
}

void netWorkStatus(const char *wifistatus, const char *serverstatus) {
    M5.Lcd.setTextSize(2);
    M5.Lcd.setCursor(97,181);
    M5.Lcd.println(DEVICE_ID);
    M5.Lcd.fillRect(76,200,59,19,BLACK);
    M5.Lcd.setCursor(80,201);
    M5.Lcd.println(wifistatus);
    M5.Lcd.fillRect(76,220,59,19,BLACK);
    M5.Lcd.setCursor(80,221);
    M5.Lcd.println(serverstatus);
}

void ConnectMonitor(void) {
    if (WiFi.status() != WL_CONNECTED) {
        if (state.display) {
            netWorkStatus("No", "No");
        }
        return;
    }

    if (wifiClient.connected()) {
        if (state.display) {
            netWorkStatus("Yes", "Yes");
        }

    } else {
        wifiClient.stop();
        if (state.display) {
            netWorkStatus("Yes", "No");
        }
        wifiClient.connect(SERVER_IP, SERVER_PORT);
    }
}

void visualdenchi(void) {
    M5.Lcd.fillRect(80, 150, 3, 12, WHITE);
    M5.Lcd.fillRect(83, 142, 1, 27, WHITE);
    M5.Lcd.fillRect(83, 142, 48, 1, WHITE);
    M5.Lcd.fillRect(83, 169, 48, 1, WHITE);
    M5.Lcd.fillRect(130, 142, 1, 27, WHITE);
}

void batterycolor(int color1 , int color2, int color3, int color4, int color5) {
    M5.Lcd.fillRect(85,144,7,24,color1);
    M5.Lcd.fillRect(94,144,7,24,color2);
    M5.Lcd.fillRect(103,144,7,24,color3);
    M5.Lcd.fillRect(112,144,7,24,color4);
    M5.Lcd.fillRect(121,144,7,24,color5);
}

void VisualBattery(void) {
    state.battery = M5.Power.getBatteryLevel();
    if (state.battery > 80) {
        batterycolor(GREEN, GREEN, GREEN, GREEN, GREEN);
    } else if (80 >= state.battery && state.battery > 60) {
        batterycolor(BLACK, GREEN, GREEN, GREEN, GREEN);
    }else if (60 >= state.battery && state.battery > 40) {
        batterycolor(BLACK, BLACK, GREEN, GREEN, GREEN);
    }else if (40 >= state.battery && state.battery > 20) {
        batterycolor(BLACK, BLACK, BLACK, GREEN, GREEN);
    }else if (20 >= state.battery) {
        batterycolor(BLACK, BLACK, BLACK, BLACK, GREEN);
    }
}

void IMUInfo(void) {
    M5.Lcd.setTextSize(1);
    M5.Lcd.setCursor(3,3);
    M5.Lcd.println("AccelX");
    M5.Lcd.setCursor(3,23);
    M5.Lcd.println("AccelY");
    M5.Lcd.setCursor(3,43);
    M5.Lcd.println("AccelZ");
}

void IMUprint(void) {
    M5.Lcd.setTextSize(2);
    M5.Lcd.fillRect(60,0,75,20,BLUE);
    M5.Lcd.setCursor(60,0);
    M5.Lcd.println(state.kalacc[0],1);
    M5.Lcd.fillRect(60,20,75,20,RED);
    M5.Lcd.setCursor(60,20);
    M5.Lcd.println(state.kalacc[1],1);
    M5.Lcd.fillRect(60,40,75,20,DARKGREEN);
    M5.Lcd.setCursor(60,40);
    M5.Lcd.println(state.kalacc[2],1);
    M5.Lcd.fillRect(59,0,1,61,WHITE);
    M5.Lcd.fillRect(59,61,75,1,WHITE);
}

void UpTime() {
    float seconds = millis() / 1000.0f;
    int minutes = static_cast<int>(seconds) / 60;
    int hours = minutes / 60;
    seconds = static_cast<int>(seconds) % 60;
    minutes = minutes % 60;
    M5.Lcd.setTextSize(2);
    M5.Lcd.setCursor(0,65);
    M5.Lcd.println("Up Time");
    M5.Lcd.setTextSize(3);
    M5.Lcd.setCursor(90,90);
    M5.Lcd.fillRect(90,90,40,35,BLUE);
    M5.Lcd.println(seconds,0);
    M5.Lcd.setCursor(45,90);
    M5.Lcd.fillRect(45,90,40,35,RED);
    M5.Lcd.println(minutes,0);
    M5.Lcd.setCursor(0,90);
    M5.Lcd.fillRect(0,90,40,35,DARKGREEN);
    M5.Lcd.println(hours,0);
    M5.Lcd.setCursor(75,90);
    M5.Lcd.println(":");
    M5.Lcd.setCursor(30,90);
    M5.Lcd.println(":");
}

void screenControler(void) {
    if (M5.BtnA.isPressed()) {
        if (state.displaycount == 0) {
            state.display = false;
            state.displaycount ++;
            delay(100);
        } else if (state.displaycount == 1) {
            state.display = true;
            state.displaycount = 0;
            delay(100);
        }
    }

    if (state.display) {
        M5.Lcd.setBrightness(LCD_BRIGHTNESS);
        BasicInfo();
        IMUInfo();
        IMUprint();
        UpTime();
        line();
        visualdenchi();
        VisualBattery();
    } else {
        M5.Lcd.setBrightness(0);
        M5.Lcd.fillScreen(BLACK);
    }
}

void setup(void) {
    auto cfg = M5.config();
    cfg.internal_imu = true;
    M5.begin(cfg);
    M5.Lcd.setTextSize(1);
    M5.Lcd.setRotation(0);
    M5.Lcd.setTextColor(WHITE);
    WiFi.begin(SSID, PASSWORD);
    wifiClient.connect(SERVER_IP, SERVER_PORT);

    screenControler();

    state.prevTime = millis();
}

void loop(void) {
    M5.update();

    deltaTime();
    getIMU();
    kalmanAccel();
    //accelNorm();

    screenControler();
    ConnectMonitor();

    sendData();

    delay(50);
}
