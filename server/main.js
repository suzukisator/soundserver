import fs from 'fs';
import net from 'net';
import express from 'express';
import http from 'http';
import { Server as SocketIoServer } from 'socket.io';
import { initializePlaybackCSV, writeM5DataCSV, getTime, csvFiles } from './csvfuncs.js';
import * as ss from 'simple-statistics';
import { getLocalIP } from './getLocalIP.js';

const WEB_SOCKET_PORT = 3001;
const WEB_SOCKET_PORT2 = 3003;
const TCP_PORT = 3002;
const HOST = getLocalIP(); //IPアドレス

const deviceData = {};
const stdlist = [];

// グローバル変数として現在のplayback.csvのパスを保持
const currentPlaybackCSV = initializePlaybackCSV();

// クライアント通信の遅延時間
const DELAY_TIME = 20;

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
    })

    io.on('connection', (socket) => {
        console.log('WebSocket client connected');

        socket.on('disconnect', () => {
            console.log('WebSocket client disconnected');
        });
    });
    return io;
}

function setupTcpServer(io) {
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
            
            const m5Data = {
                id: receivedId,
                accX: receivedAccX,
                accY: receivedAccY,
                accZ: receivedAccZ,
                normAcc: normAcc,
                m5Time: m5Time
            }
            
            if (receivedId < 101) {
                // IDごとにnormAccを格納
                if (!deviceData[receivedId]) {
                    deviceData[receivedId] = [];
                }
                deviceData[receivedId].push(m5Data);
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

// 一定時間で各デバイスのサンプルエントロピーを計算
setInterval(() => {
    try {
        Object.keys(deviceData).forEach(id => {
            const std = ss.standardDeviation(deviceData[id].map(data => data.normAcc));
            //const median = ss.median(deviceData[id]);
            // NaNでない場合のみstdlistに追加
            if (!(isNaN(std) || std === 0)) {
                stdlist.push(std);
            }
            deviceData[id] = [];
        });
        console.log(stdlist);
        const mean = ss.mean(stdlist);
        stdlist.length = 0;
        console.log(`mean: `, mean);
        let result;
        const [value1, value2] = [20, 30];
        if (mean <= value1) {
            result = 0
        } else if (mean > value1 && value2 >= mean) {
            result = 1;
        } else if (mean > value2) {
            result = 2;
        }

        // 結果と平均値を一緒に送信
        io.emit("data", result);
        console.log(`result: ${ result }, mean: ${mean} : ${getTime()}`);

        // 既存のファイルに追記
        const csvLine = `${getTime()},${result},${mean}\n`;
        fs.appendFileSync(currentPlaybackCSV, csvLine);
        console.log('Playback data saved');
    } catch (error) {
        console.error('Error in setInterval:', error);
    }
}, DELAY_TIME*1000);

// 60秒ごとにM5StickのデータをCSVに保存
setInterval(() => {
    try {
        Object.keys(deviceData).forEach(id => {
            let csvData = '';
            deviceData[id].forEach(data => {
                csvData += `${getTime()},${data.m5Time},${data.normAcc},${data.accX},${data.accY},${data.accZ}\n`;
            });
            if (csvData) {
                writeM5DataCSV(id, csvData);
            }
        });
    } catch (error) {
        console.error('Error in setInterval:', error);
    }
}, 30*1000);

const io = setupWebSocketServer();
setupTcpServer(io);
