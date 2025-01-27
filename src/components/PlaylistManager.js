const { cropImageToSquare } = require("../utils.js");
const axios = require("axios");

// 播放列表管理类
class PlaylistManager {
    constructor(audioPlayer, lyricsPlayer, uiManager) {
        this.playlist = [];
        this.playingNow = 0;
        this.playlistName = "默认歌单";
        this.audioPlayer = audioPlayer;
        this.lyricsPlayer = lyricsPlayer;
        this.uiManager = uiManager;
    }

    addSong(song, event) {
        try {
            if (event) {
                event.stopPropagation(); // 阻止事件冒泡
            }
            this.playlist.push(song);
            this.savePlaylists();
        } catch (error) {
            console.error("添加歌曲失败:", error);
        }
    }

    removeSong(bvid, event) {
        try {
            if (event) {
                event.stopPropagation(); // 阻止事件冒泡
            }
            let index = this.playlist.findIndex((item) => item.bvid === bvid);

            this.playlist.splice(index, 1);
            this.savePlaylists();
            // 如果删除的是当前播放的歌曲
            if (index === this.playingNow) {
                this.setPlayingNow(Math.min(this.playingNow, this.playlist.length - 1));
            } else if (index < this.playingNow) {
                this.playingNow--;
            }
        } catch (error) {
            console.error("删除歌曲失败:", error);
        }
    }

    async setPlayingNow(index, replay = true) {
        try {
            if (index < 0 || index >= this.playlist.length) {
                throw new Error("无效的播放索引");
            }

            const song = this.playlist[index];
            this.playingNow = index;

            // 更新歌词和UI
            this.lyricsPlayer.changeLyrics(song.lyric);
            this.updateUIForCurrentSong(song);

            if (replay) {
                document.querySelector(".player .control .progress .progress-bar .progress-bar-inner").style.width = "0%";
                this.audioPlayer.audio.currentTime = 0;
            }

            if ("mediaSession" in navigator) {
                // 裁剪图片为正方形
                const { url, size } = await cropImageToSquare(song.poster);

                navigator.mediaSession.metadata = new MediaMetadata({
                    title: song.title,
                    artist: song.artist,
                    artwork: [{ src: url, sizes: size, type: "image/jpeg" }]
                });
            }

            this.uiManager.renderPlaylist();

            // 更新播放状态样式
            let songs = document.querySelectorAll("#playing-list .song");
            for (let i = 0; i < songs.length; i++) {
                songs[i].classList.remove("playing");
            }
            songs[this.playingNow].classList.add("playing");

            // 尝试播放，如果失败则重试
            await this.tryPlayWithRetry(song);

            // 保存播放列表
            this.savePlaylists();
        } catch (error) {
            console.error("设置当前播放失败:", error);
        }
    }
    // 尝试播放，带重试机制
    async tryPlayWithRetry(song, maxRetries = 1) {
        for (let attempt = 0; attempt < maxRetries; attempt++) {
            try {
                // 设置音频源
                this.audioPlayer.audio.src = song.audio;

                // 尝试播放
                await this.audioPlayer.audio.play();
                document.querySelector(".player .control .play").classList = "play played";
                return; // 成功播放，退出重试
            } catch (error) {
                console.error(`播放尝试 ${attempt + 1} 失败:`, error);

                if (attempt === maxRetries - 1) {
                    // 最后一次尝试，重新获取URL
                    try {
                        // 假设MusicSearcher是可访问的
                        const urls = await window.app.musicSearcher.getAudioLink(song.bvid, true);
                        let newUrl = urls[0];

                        try {
                            const res = await axios.get(newUrl);
                            if (res.status === 403) {
                                newUrl = urls[1];
                            }
                        } catch {
                            newUrl = urls[1];
                        }

                        // 更新歌曲URL并保存
                        song.audio = newUrl;
                        this.savePlaylists();

                        // 最后一次尝试播放
                        this.audioPlayer.audio.src = newUrl;
                        await this.audioPlayer.audio.play();
                        document.querySelector(".player .control .play").classList = "play played";
                        return;
                    } catch (finalError) {
                        console.error("重新获取音频链接失败:", finalError);
                        document.querySelector(".player .control .play").classList = "play paused";
                        throw finalError;
                    }
                }

                // 等待一段时间后重试
                await new Promise((resolve) => setTimeout(resolve, 1000 * (attempt + 1)));
            }
        }
    }
    updateUIForCurrentSong(song) {
        document.documentElement.style.setProperty("--bgul", "url(" + song.poster + ")");
        document.querySelector(".player-content .cover .cover-img").src = song.poster;
        document.querySelector(".player .info .title").textContent = song.title;
        document.querySelector(".player .info .artist").textContent = song.artist;
    }
    changePlaylistName(name) {
        try {
            this.playlistName = name;
            this.savePlaylists();
            this.uiManager.renderPlaylist();
            this.setPlayingNow(this.playingNow, false);
        } catch (error) {
            console.error("修改播放列表名称失败:", error);
        }
    }

    savePlaylists() {
        try {
            localStorage.setItem("nbmusic_playlist", JSON.stringify(this.playlist));
            localStorage.setItem("nbmusic_playlistname", this.playlistName);
        } catch (error) {
            console.error("保存播放列表失败:", error);
        }
    }

    loadPlaylists() {
        try {
            const savedPlaylist = localStorage.getItem("nbmusic_playlist");
            const savedPlaylistName = localStorage.getItem("nbmusic_playlistname");

            if (savedPlaylist) {
                this.playlist = JSON.parse(savedPlaylist);
            }
            if (savedPlaylistName) {
                this.playlistName = savedPlaylistName;
            }
        } catch (error) {
            console.error("加载播放列表失败:", error);
            // 使用默认值
            this.playlist = [];
            this.playlistName = "默认歌单";
        }
    }
}

module.exports = PlaylistManager;
