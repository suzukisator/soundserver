# 加速度センサー音楽再生システム - 技術詳細

## 1. システムアーキテクチャ

### 1.1 全体構成
```
[M5Stack] ←TCP/IP→ [サーバー] ←WebSocket→ [Webブラウザ]
```

### 1.2 コンポーネント構成
- **M5Stack**
  - 加速度センサーデータの取得
  - TCPによるデータ送信
  - サンプリングレート: 実時間

- **サーバー（Node.js）**
  - TCPサーバー（ポート3002）
  - WebSocketサーバー（ポート3001）
  - データ解析処理
  - CSVファイル管理

- **クライアント（React）**
  - WebSocket通信
  - 音楽・画像の制御
  - ユーザーインターフェース

## 2. データフロー

### 2.1 センサーデータ
1. M5Stackからのデータフォーマット
   ```
   [4バイト] デバイスID (UInt32LE)
   [4バイト] X軸加速度 (FloatLE)
   [4バイト] Y軸加速度 (FloatLE)
   [4バイト] Z軸加速度 (FloatLE)
   [4バイト] M5Stack時間 (FloatLE)
   ```

2. 加速度ノルム計算
   ```javascript
   normAcc = √(accX² + accY² + accZ²)
   ```

### 2.2 データ処理フロー
1. センサーデータ受信（TCP）
2. 加速度ノルム計算
3. デバイスごとのデータ蓄積
4. 標準偏差計算
5. 平均値算出
6. 音楽ID決定
7. WebSocketでクライアントに送信

## 3. サーバー側実装詳細

### 3.1 データ解析
- 標準偏差計算（20秒間隔）
- NaNや0値の除外処理
- 閾値による音楽ID判定
  ```javascript
  if (meanValue <= 20) result = 0;
  else if (meanValue <= 30) result = 1;
  else result = 2;
  ```

### 3.2 ファイル管理
- **CSVファイル構造**
  1. 加速度データ
     ```csv
     Time,m5time,accNorm,accX,accY,accZ
     ```
  2. 再生データ
     ```csv
     Timestamp,MusicID,MeanValue
     ```

### 3.3 エラーハンドリング
- TCP接続エラー処理
- ファイル書き込みエラー処理
- データフォーマットチェック

## 4. クライアント側実装詳細

### 4.1 状態管理
```javascript
const [currentImage, setCurrentImage] = useState("");
const [currentAudio, setCurrentAudio] = useState("");
const [playing, setPlaying] = useState(false);
const [currentTime, setCurrentTime] = useState(0);
const [duration, setDuration] = useState(0);
```

### 4.2 音楽制御機能
- 再生位置の保存と復元
- 音量の正規化（0.5に統一）
- 自動リピート再生
- 再生時間の表示

### 4.3 WebSocket通信
```javascript
socket.on("data", (data) => {
    if (typeof(data) === "object" && 'result' in data) {
        // 音楽切り替え処理
    }
});
```

## 5. データ保存仕様

### 5.1 ディレクトリ構造
```
csv_data/
  ├── [日付]/
  │   ├── Device_[ID]/
  │   │   └── [日付]_[ID]_[タイムスタンプ].csv
  │   └── playback_data/
  │       └── [日付]_playback_[起動時刻].csv
```

### 5.2 データ更新頻度
- 加速度データ: リアルタイム（受信時）
- 再生データ: 20秒間隔
- ファイル作成: サーバー起動時

## 6. パフォーマンス考慮事項

### 6.1 メモリ管理
- デバイスデータの定期的なクリア
- ストリームの適切なクローズ
- 配列の長さ制限

### 6.2 ファイルI/O
- WriteStreamの使用
- バッファリング
- エラー時の再試行

### 6.3 通信最適化
- バイナリデータ形式の使用
- 必要最小限のデータ送信
- 接続状態の監視

## 7. 拡張性

### 7.1 新機能追加のポイント
- 音楽・画像の追加方法
- 閾値の調整方法
- データ解析ロジックの変更方法

### 7.2 設定可能パラメータ
- サンプリング間隔
- 閾値
- 音量レベル
- ファイル保存パス

## 8. セキュリティ考慮事項

### 8.1 データ保護
- ファイルアクセス権限
- ネットワークセキュリティ
- エラーメッセージの制限

### 8.2 通信セキュリティ
- CORS設定
- WebSocket接続制限
- エラーハンドリング 
