import React, { useState, useEffect, useRef } from "react";
import io from "socket.io-client";
import "./App.css";

const socket = io("http://localhost:3001");

const playlog = [];
// 各音楽の再生位置を保存
const audioPositions = {
    0: 0,
    1: 0,
    2: 0
};

const music0 = "/くるみ.mp3";
const music1 = "/アリア.mp3";
const music2 = "/gline.mp3";

const IMAGE0 = "/number5.jpg";
const IMAGE1 = "/表示画像6.jpg";
const IMAGE2 = "/jupitor.jpg";

// 音量の統一設定
const NORMALIZED_VOLUME = 0.5;

function App() {
    const [ currentImage, setCurrentImage ] = useState("");
    const [ currentAudio, setCurrentAudio ] = useState("");
    const [currentMusicId, setCurrentMusicId] = useState(null);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);
    const audioRef = useRef(null);
    const [userInteracted, setUserInteracted] = useState(false);

    const formatTime = (timeInSeconds) => {
        const minutes = Math.floor(timeInSeconds / 60);
        const seconds = Math.floor(timeInSeconds % 60);
        return `${minutes}:${seconds.toString().padStart(2, '0')}`;
    };

    const handleTimeUpdate = () => {
        if (audioRef.current) {
            setCurrentTime(audioRef.current.currentTime);
        }
    };

    const handleLoadedMetadata = () => {
        if (audioRef.current) {
            setDuration(audioRef.current.duration);
            audioRef.current.currentTime = audioPositions[currentMusicId] || 0;
            playAudio();
        }
    };

    const audioCheck = (data, music, image) => {
        if (audioRef.current) {
            // 現在の再生位置を保存
            audioPositions[playlog[0]] = audioRef.current.currentTime;
            audioRef.current.pause();
        }

        // 新しい音楽をセットして再生
        setCurrentImage(image);
        setCurrentAudio(music);
        setCurrentMusicId(data);

        // データを受信したら即座に再生
        if (audioRef.current) {
            audioRef.current.load();
            audioRef.current.volume = NORMALIZED_VOLUME;
            playAudio();
        }
    }

    useEffect(() => {
        socket.on("connect", () => {
            console.log("Connected to server");
        });
        socket.on("connect_error", (error) => {
            console.error("Failed to connect to server", error);
        });
        socket.on("data", (data) => {
            if (playlog.length >= 2) {
                playlog.shift();
            }
            // データをplaylogに追加
            playlog.push(data);
            
            // 型チェックを修正
            if (typeof(data) === 'number' && data >= 0 && data <= 2) {
                // 音楽の切り替え処理
                switch (data) {
                    case 0:
                        audioCheck(data, music0, IMAGE0);
                        break;
                    case 1:
                        audioCheck(data, music1, IMAGE1);
                        break;
                    case 2:
                        audioCheck(data, music2, IMAGE2);
                        break;
                    default:
                        console.log(data);
                        break;
                }
            }
        });
        return () => {
            socket.off("connect");
            socket.off("connect_error");
            socket.off("data");
        };
    }, []);

    useEffect(() => {
        const handleInteraction = () => {
            setUserInteracted(true);
            // イベントリスナーを削除
            document.removeEventListener('click', handleInteraction);
            document.removeEventListener('keydown', handleInteraction);
        };

        document.addEventListener('click', handleInteraction);
        document.addEventListener('keydown', handleInteraction);

        return () => {
            document.removeEventListener('click', handleInteraction);
            document.removeEventListener('keydown', handleInteraction);
        };
    }, []);

    const playAudio = async () => {
        if (audioRef.current && userInteracted) {
            try {
                await audioRef.current.play();
            } catch (error) {
                console.error("Failed to play audio:", error);
            }
        }
    };

    const handleAudioEnded = () => {
        // 音楽が終了したら、再生位置を0にリセットして再生を開始
        if (audioRef.current && currentMusicId !== null) {
            audioRef.current.currentTime = 0;
            audioPositions[currentMusicId] = 0;
            setCurrentTime(0);
            audioRef.current.play().catch(error => {
                console.error("Failed to replay audio:", error);
            });
        }
    };

    return (
        <div className="App">
          <header className="App-header">
            {!userInteracted && (
                <div className="interaction-message">
                    <p>画面をクリックして音声を有効にしてください</p>
                </div>
            )}
            <h1>信号による画像とBGMの切り替え</h1>
            {currentImage && <img src={currentImage} alt="Current" />}
            {currentAudio && (
              <>
                <audio
                  ref={audioRef}
                  src={currentAudio}
                  onEnded={handleAudioEnded}
                  onTimeUpdate={handleTimeUpdate}
                  onLoadedMetadata={handleLoadedMetadata}
                >
                  お使いのブラウザはオーディオタグをサポートしていません。
                </audio>
                <div className="audio-controls">
                    <div className="time-display">
                        <span>{formatTime(currentTime)}</span>
                        <span> / </span>
                        <span>{formatTime(duration)}</span>
                    </div>
                </div>
              </>
            )}
          </header>
        </div>
    );
}

export default App;
