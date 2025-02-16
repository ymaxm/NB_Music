const { LyricPlayer } = require("@applemusic-like-lyrics/core");

class LyricsPlayer {
    constructor(lyricsString, audioElement) {
        this.lyricPlayer = new LyricPlayer();
        this.lyricsContainer = document.getElementById("lyrics-container");
        this.lyricsContainer.innerHTML = "";
        this.lyricsContainer.appendChild(this.lyricPlayer.getElement());
        
        this.audio = audioElement;
        this.parsedData = this.parseLyrics(lyricsString);
        this.lastUpdateTime = 0;

        // 初始化歌词数据
        this.setupLyricLines();

        this.audio.addEventListener("timeupdate", () => this.update());
        this.audio.addEventListener("seeking", () => this.onSeek());
    }

    convertToAMLLFormat(parsedData) {
        return parsedData
            .filter(item => item.type === "lyric")
            .map(line => ({
                words: line.chars.map(word => ({
                    word: word.text,
                    time: word.startTime / 1000,
                    duration: word.duration / 1000
                })),
                translatedLyric: "",
                romanLyric: ""
            }));
    }

    setupLyricLines() {
        const amllLines = this.convertToAMLLFormat(this.parsedData);
        this.lyricPlayer.setLyricLines(amllLines);
    }

    update() {
        const currentTime = this.audio.currentTime * 1000;
        const deltaTime = performance.now() - this.lastUpdateTime;
        
        this.lyricPlayer.setCurrentTime(currentTime);
        this.lyricPlayer.update(deltaTime);
        
        this.lastUpdateTime = performance.now();
    }

    onSeek() {
        this.lyricPlayer.setCurrentTime(this.audio.currentTime * 1000);
    }

    changeLyrics(newLyricsString) {
        this.parsedData = this.parseLyrics(newLyricsString);
        this.setupLyricLines();
    }

    parseLyrics(lyricsString) {
        if (!lyricsString) {
            return [
                {
                    type: "lyric",
                    lineStart: 0,
                    lineDuration: 5000,
                    chars: [{ text: "暂无歌词", startTime: 0, duration: 5000 }]
                }
            ];
        }

        const lines = lyricsString.split("\n");
        const parsedData = [];

        // 检查是否为传统时间戳格式
        const isTraditionalFormat = lines.some((line) => line.match(/^\[\d{2}:\d{2}\.\d{2,3}\]/));

        if (isTraditionalFormat) {
            lines.forEach((line) => {
                if (line.trim() === "") return;
                const match = line.match(/\[(\d{2}):(\d{2})\.(\d{2,3})\](.*)/);
                if (match) {
                    const [, mm, ss, ms, text] = match;
                    const startTime = (parseInt(mm) * 60 + parseInt(ss)) * 1000 + parseInt(ms);
                    parsedData.push({
                        type: "lyric",
                        lineStart: startTime,
                        lineDuration: 5000,
                        chars: [
                            {
                                text: text.trim(),
                                startTime: startTime,
                                duration: 5000
                            }
                        ]
                    });
                }
            });
        } else {
            lines.forEach((line) => {
                if (line.trim() === "") return;
                if (line.startsWith("{")) {
                    const metadata = JSON.parse(line);
                    parsedData.push({
                        type: "metadata",
                        time: metadata.t,
                        content: metadata.c
                    });
                    return;
                }
                if (line.startsWith("[")) {
                    const timeMatch = line.match(/\[(\d+),(\d+)\]/);
                    const charMatches = line.match(/\((\d+),(\d+),\d+\)([^(]+)/g);
                    if (timeMatch && charMatches) {
                        const lineStart = parseInt(timeMatch[1]);
                        const lineDuration = parseInt(timeMatch[2]);
                        const chars = charMatches.map((charMatch) => {
                            const [, startTime, duration, text] = charMatch.match(/\((\d+),(\d+),\d+\)(.+)/);
                            return {
                                text,
                                startTime: parseInt(startTime),
                                duration: parseInt(duration)
                            };
                        });
                        parsedData.push({
                            type: "lyric",
                            lineStart,
                            lineDuration,
                            chars
                        });
                    }
                }
            });
        }
        return parsedData;
    }
}

module.exports = LyricsPlayer;