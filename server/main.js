import fs from 'fs';
import net from 'net';
import express from 'express';
import http from 'http';
import { Server as SocketIoServer } from 'socket.io';
import { calculateMean, StandardDeviation } from './analysis.js';
import { initializePlaybackCSV, writeM5DataCSV, getTime, csvFiles } from './csvfuncs.js';

const WEB_SOCKET_PORT = 3001;
const TCP_PORT = 3002;
const HOST = '192.168.10.3'; //IPアドレス

const deviceData = {};
const stdlist = [];

// グローバル変数として現在のplayback.csvのパスを保持
const currentPlaybackCSV = initializePlaybackCSV();

// 一定時間で各デバイスのサンプルエントロピーを計算
setInterval(() => {
    Object.keys(deviceData).forEach(id => {
        const std = StandardDeviation(deviceData[id]);
        // NaNでない場合のみstdlistに追加
        if (!(isNaN(std) || std === 0)) {
            stdlist.push(std);
        }
        deviceData[id] = [];
    });
    console.log(stdlist);
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

    // 既存のファイルに追記
    const csvLine = `${getTime()},${result},${meanValue}\n`;
    fs.appendFileSync(currentPlaybackCSV, csvLine);
    console.log('Playback data saved');
}, 20*1000);

function setupWebSocketServer() {
    const app = express();
    const server = http.createServer(app);
    const io = new SocketIoServer(server, {
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

            // IDごとにnormAccを格納
            if (!deviceData[receivedId]) {
                deviceData[receivedId] = [];
            }
            deviceData[receivedId].push(normAcc);

            if (receivedId < 101) {
                clientData.push(normAcc);
                writeM5DataCSV(m5Time, receivedId, normAcc, receivedAccX, receivedAccY, receivedAccZ);
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
