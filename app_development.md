---
marp: true
theme: default
paginate: true
---

# 加速度センサー音楽再生システム
## 開発に必要な知識

---

# 1. 使用技術スタック

- **フロントエンド**
  - React.js
  - Socket.IO Client
  - HTML5 Audio API
- **バックエンド**
  - Node.js
  - Express
  - Socket.IO
- **センサー通信**
  - TCP/IP通信
  - バイナリデータ処理

---

# 2. WebSocket通信
```javascript
// クライアント側
const socket = io("http://サーバーIP:3001");

socket.on("connect", () => {
    console.log("Connected to server");
});

socket.on("data", (data) => {
    // データ受信時の処理
});

// サーバー側
io.on('connection', (socket) => {
    console.log('Client connected');
    socket.emit('data', processedData);
});
```

---

# 3. 音声制御

```javascript
// HTML5 Audio要素の制御
const audioRef = useRef(null);

// 再生
audioRef.current.play();

// 一時停止
audioRef.current.pause();

// 再生位置の保存と復元
const currentTime = audioRef.current.currentTime;
audioRef.current.currentTime = savedPosition;
```

---

# 4. センサーデータ処理

```javascript
// バイナリデータの解析
const receivedId = buffer.readUInt32LE(0);
const receivedAccX = buffer.readFloatLE(4);
const receivedAccY = buffer.readFloatLE(8);
const receivedAccZ = buffer.readFloatLE(12);

// 加速度ノルム計算
const normAcc = Math.sqrt(
    receivedAccX * receivedAccX + 
    receivedAccY * receivedAccY + 
    receivedAccZ * receivedAccZ
);
```

---

# 5. データ永続化

```javascript
// CSVファイル保存
const csvWriter = createCsvWriter({
    path: 'acceleration_data.csv',
    header: [
        {id: 'timestamp', title: 'Timestamp'},
        {id: 'value', title: 'Value'}
    ]
});

// データ保存
const data = {
    timestamp: new Date().toISOString(),
    value: normAcc
};
csvWriter.writeRecords([data]);
```

---

# 6. 状態管理

```javascript
// Reactの状態管理
const [currentAudio, setCurrentAudio] = useState("");
const [playing, setPlaying] = useState(false);
const [currentImage, setCurrentImage] = useState("");

// 再生履歴の管理
const playlog = [];
const audioPositions = {
    0: 0,
    1: 0,
    2: 0
};
```

---

# 7. エラーハンドリング

```javascript
// 音声再生のエラーハンドリング
audioRef.current.play().catch(error => {
    console.error("Failed to play audio:", error);
});

// Socket接続エラー
socket.on("connect_error", (error) => {
    console.error("Failed to connect:", error);
});

// ファイル操作エラー
try {
    await csvWriter.writeRecords([data]);
} catch (error) {
    console.error("Failed to write CSV:", error);
}
```

---

# 8. セキュリティ考慮事項

- クロスオリジン要求の設定
- WebSocketの接続制限
- ファイルアクセス権限の管理
- エラーメッセージの適切な処理
- データ検証とサニタイズ

---

# 9. パフォーマンス最適化

- データ送信の最適化
  - バッファリング
  - データ圧縮
- メモリ管理
  - 不要なデータの解放
  - メモリリーク防止
- 効率的なイベント処理
  - デバウンス処理
  - スロットリング

---

# 10. デバッグとテスト

- コンソールログの活用
- WebSocketデバッグツール
- ブラウザの開発者ツール
- センサーデータのモック
- ユニットテスト
- 統合テスト 
