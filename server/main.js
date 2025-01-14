const fs = require('fs');
const path = require('path');
const net = require('net');
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');

const WEB_SOCKET_PORT = 3001;
const TCP_PORT = 3002;
const HOST = '192.168.10.2'; //IPアドレス

// CSVファイルのストリームを保持
const csvFiles = {};

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

const deviceData = {};
const entropyData = {};
const entropylist = [];
const stdlist = [];

// ! 次回ここら辺の計算関数を別のモジュールにまとめなおす
function sampleEntropy(data, m = 2, r = 0.2) {
    if (data.length < m+1) {
        return 0;
    }
    let B = 0, A = 0;
    for (let i = 0; i < data.length - m; i++) {
        const pattern1 = data.slice(i, i + m);
        const pattern2 = data.slice(i, i + m + 1);
        let countB = 0, countA = 0;
        for (let j = 0; j < data.length - m; j++) {
            if (j !== i) {
                const windowB = data.slice(j, j + m);
                const windowA = data.slice(j, j + m + 1);
                const distB = pattern1.map((val, idx) => Math.abs(val - windowB[idx]));
                const distA = pattern2.map((val, idx) => Math.abs(val - windowA[idx]));
                if (Math.max(...distB) < r) countB++;
                if (Math.max(...distA) < r) countA++;
            }
        }
        B += countB;
        A += countA;
    }
    B /= (data.length - m) * (data.length - m - 1);
    A /= (data.length - m) * (data.length - m - 1);
    return -Math.log(A / B);
}

// 平均値を計算する関数
function calculateMean(arr) {
    if (!arr || arr.length === 0) {
        return 0;
    }
    return arr.reduce((sum, value) => sum + value, 0) / arr.length;
}

//標準偏差関数
function StandardDeviation(arr) {
    const meanValue = calculateMean(arr);
    const variance = arr.reduce((sum, value) => sum + Math.pow(value - meanValue, 2), 0) / arr.length;
    const standardDeviation = Math.sqrt(variance);
    return standardDeviation;
}

// 中央値関数
function median(value) {
    value.sort(function(a, b) {
        return a - b;
    });
    const half = Math.floor(value.length / 2);
    if (value.length % 2) {
        return value[half];
    } else {
        return (value[half - 1] + value[half]) / 2.0;
    }
}

// 一定時間で各デバイスのサンプルエントロピーを計算
setInterval(() => {
    Object.keys(deviceData).forEach(id => {
        //console.log(`=============Device ${id}==============================`);
        const std = StandardDeviation(deviceData[id]);
        stdlist.push(std);
        deviceData[id] = [];
    });

    const meanValue = calculateMean(stdlist);
    stdlist.length = 0;
    console.log(`mean: `, meanValue);
    let result;
    const [value1, value2] = [20, 30];
    if (meanValue <= value1) {
        result = 0
    } else if (meanValue > value1 && value2 >= meanValue) {
        result = 1;
    } else if (meanValue > value2) {
        result = 2;
    }

    // 結果と平均値を一緒に送信
    io.emit("data", { result, meanValue });
    console.log(`result: ${ result }, mean: ${meanValue} : ${getTime()}`);
}, 900*1000);

function setupWebSocketServer() {
    const app = express();
    const server = http.createServer(app);
    const io = socketIo(server, {
        cors: {
            origin: "*",
            methods: ["GET", "POST"]
        }
    });

    server.listen(WEB_SOCKET_PORT, () => {
        console.log(`WebSocket server listening on port ${WEB_SOCKET_PORT}`);
    });

    io.on('connection', (socket) => {
        console.log('WebSocket client connected');

        // 再生データの保存
        socket.on('saveData', (data) => {
            try {
                const dirPath = path.join(__dirname, "..", "csv_data", getCSVTime(), "playback_data");
                if (!fs.existsSync(dirPath)) {
                    fs.mkdirSync(dirPath, { recursive: true });
                }

                const dateStr = getCSVTime();
                const filepath = path.join(dirPath, `${dateStr}_playback.csv`);
                
                // ファイルが存在しない場合はヘッダーを書き込む
                if (!fs.existsSync(filepath)) {
                    fs.writeFileSync(filepath, "Timestamp,MusicID,AudioPosition,MeanValue\n");
                }

                // データを追記
                const csvLine = `${data.timestamp},${data.value},${data.audioPosition},${data.meanValue}\n`;
                fs.appendFileSync(filepath, csvLine);
                console.log('Playback data saved');
            } catch (error) {
                console.error('Error saving playback data:', error);
            }
        });

        socket.on('disconnect', () => {
            console.log('WebSocket client disconnected');
        });
    });

    return io;
}

function setupTcpServer(io) {
    let count = 0;
    const clientData = [];
    const tcpServer = net.createServer(socket => {
        console.log('TCP client connected', getTime());
        
        socket.on('data', buffer => {
            if (buffer.length < 20) {
                console.error('Received data is too short.');
                return;
            }
            
            const receivedId = buffer.readUInt32LE(0);
            const receivedAccX = buffer.readFloatLE(4);
            const receivedAccY = buffer.readFloatLE(8);
            const receivedAccZ = buffer.readFloatLE(12);
            const m5Time = buffer.readFloatLE(16);

            //加速度ノルムの計算
            const normAcc = Math.sqrt(receivedAccX * receivedAccX + receivedAccY * receivedAccY + receivedAccZ * receivedAccZ);

            const data = { 
                time: getTime(), 
                m5time: m5Time, 
                id: receivedId, 
                normacc: normAcc, 
                accX: receivedAccX, 
                accY: receivedAccY, 
                accZ: receivedAccZ 
            };

            // IDごとにnormAccを格納
            if (!deviceData[receivedId]) {
                deviceData[receivedId] = [];
            }
            deviceData[receivedId].push(normAcc);

            if (receivedId < 101) {
                clientData.push(data.normacc);
            }

            // CSVファイルへの保存処理
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

                const csvLine = `${data.time},${data.m5time},${data.normacc},${data.accX},${data.accY},${data.accZ}\n`;
                csvFiles[receivedId].write(csvLine);
            } catch (error) {
                console.error('Error saving to CSV:', error);
            }
        });

        socket.on('close', () => {
            console.log('TCP client disconnected', getTime());
            // 接続が閉じられたときにCSVファイルのストリームを閉じる
            Object.values(csvFiles).forEach(stream => {
                if (stream) {
                    stream.end();
                }
            });
        });

        socket.on('error', error => {
            console.error(`Error from TCP client: ${error.message}`);
        });
    });

    tcpServer.listen(TCP_PORT, HOST, () => {
        console.log(`TCP server listening on port ${TCP_PORT}`);
    });
}

const io = setupWebSocketServer();
setupTcpServer(io);
