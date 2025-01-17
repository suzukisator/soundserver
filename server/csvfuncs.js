import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// ES Modulesで__dirnameを再現
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 時間関連の関数
function formatDate(date, includeTime = false) {
    let formattedDate = date.getFullYear()  //現在時刻
        + '-' + ('0' + (date.getMonth() + 1)).slice(-2) 
        + '-' + ('0' + date.getDate()).slice(-2);
    
    if (includeTime) {
        formattedDate += ' ' + ('0' + date.getHours()).slice(-2) 
            + ':' + ('0' + date.getMinutes()).slice(-2) 
            + ':' + ('0' + date.getSeconds()).slice(-2) 
            + '.' + ('00' + date.getMilliseconds()).slice(-3);
    }
    
    return formattedDate;
}

function getTime() {
    return formatDate(new Date(), true);
}

function getCSVTime() {
    return formatDate(new Date(), false);
}

// CSVファイルのストリームを保持
const csvFiles = {};

// サーバー起動時にplayback.csvを初期化
function initializePlaybackCSV() {
    const now = new Date();
    const dirPath = path.join(__dirname, "..", "csv_data", getCSVTime(), "playback_data");
    if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
    }

    const dateStr = getCSVTime();
    const timeStr = now.getHours().toString().padStart(2, '0')
        + now.getMinutes().toString().padStart(2, '0')
        + now.getSeconds().toString().padStart(2, '0');
    const filepath = path.join(dirPath, `${dateStr}_playback_${timeStr}.csv`);

    // 新しいファイルを作成してヘッダーを書き込む
    fs.writeFileSync(filepath, "Timestamp,MusicID,MeanValue\n");
    console.log(`Initialized playback CSV file: ${filepath}`);
    return filepath;
}

function writeM5DataCSV(receivedId, m5Time, normAcc, receivedAccX, receivedAccY, receivedAccZ) {
    try {
        const dirPath = path.join(__dirname, ".." ,"csv_data", `${getCSVTime()}`, `Device_${receivedId}`);
        if (!csvFiles[receivedId]) {
            if (!fs.existsSync(dirPath)){
                fs.mkdirSync(dirPath, { recursive: true });
            }
            const dateStr = getCSVTime();
            const csvFilename = `${dateStr}_${receivedId}_${Date.now()}.csv`;
            const filepath = path.join(dirPath, csvFilename);
            csvFiles[receivedId] = fs.createWriteStream(filepath, { flags: 'a' });
            csvFiles[receivedId].write("Time,m5time,accNorm,accX,accY,accZ\n");
            console.log(`New CSV file created: ${filepath}`);
        }

        const csvLine = `${getTime()},${m5Time},${normAcc},${receivedAccX},${receivedAccY},${receivedAccZ}\n`;
        csvFiles[receivedId].write(csvLine);
    } catch (error) {
        console.error('Error saving to CSV:', error);
    }
}

export { initializePlaybackCSV, writeM5DataCSV, getTime, csvFiles };
