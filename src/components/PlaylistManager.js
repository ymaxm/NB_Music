const axios = require('axios');

class PlaylistManager {
    constructor(audioPlayer, lyricsPlayer, uiManager) {
        this.playlist = [];
        this.playingNow = 0;
        this.playlistName = "默认歌单";
        this.audioPlayer = audioPlayer;
        this.lyricsPlayer = lyricsPlayer;
        this.uiManager = uiManager;
        this.urlExpiryTimes = new Map();
        this.URL_VALIDITY_DURATION = 120 * 60 * 1000; // 120分钟
        this.isLoading = false;
    }

    async cropImageToSquare(imageUrl) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.crossOrigin = "anonymous";

            img.onload = () => {
                const canvas = document.createElement('canvas');
                const size = Math.min(img.width, img.height);
                canvas.width = size;
                canvas.height = size;

                const ctx = canvas.getContext('2d');
                const offsetX = (img.width - size) / 2;
                const offsetY = (img.height - size) / 2;

                ctx.drawImage(img, offsetX, offsetY, size, size, 0, 0, size, size);

                resolve({
                    url: canvas.toDataURL('image/jpeg', 0.8),
                    size: `${size}x${size}`
                });
            };

            img.onerror = reject;
            img.src = imageUrl;
        });
    }

    async tryGetVideoUrl(bvid, cid, maxRetries = 2) {
        for (let i = 0; i < maxRetries; i++) {
            try {
                const videoUrl = await this.musicSearcher.getBilibiliVideoUrl(bvid, cid);
                const response = await axios.get(videoUrl);
                if (response.status === 200) {
                    return videoUrl;
                }
            } catch (error) {
                console.error(`视频链接获取尝试 ${i + 1} 失败:`, error);
                if (i === maxRetries - 1) throw error;
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
        }
        throw new Error('无法获取有效的视频链接');
    }

    isUrlExpired(url) {
        const expiryTime = this.urlExpiryTimes.get(url);
        return !expiryTime || Date.now() > expiryTime;
    }

    updateUrlExpiryTime(url) {
        this.urlExpiryTimes.set(url, Date.now() + this.URL_VALIDITY_DURATION);
    }

    async addSong(song, event) {
        try {
            if (event) {
                event.stopPropagation();
            }
            this.playlist.push(song);
            if (this.musiclistManager) {
                this.musiclistManager.handlePlaylistUpdate();
            }
            this.savePlaylists();

            const songElement = this.uiManager.createSongElement(song);
            songElement.classList.add('adding');

            const playingList = document.querySelector("#playing-list");
            playingList.appendChild(songElement);
            songElement.offsetHeight;

            requestAnimationFrame(() => {
                songElement.classList.remove('adding');
                songElement.classList.add('flash');
                setTimeout(() => {
                    songElement.classList.remove('flash');
                }, 800);
            });
        } catch (error) {
            console.error("添加歌曲失败:", error);
        }
    }

    removeSong(bvid, event) {
        try {
            if (event) {
                event.stopPropagation();
            }
            const songElement = document.querySelector(`#playing-list .song[data-bvid="${bvid}"]`);
            if (!songElement) return;

            songElement.classList.add('removing');

            songElement.addEventListener('transitionend', () => {
                const index = this.playlist.findIndex((item) => item.bvid === bvid);
                if (index !== -1) {
                    this.playlist.splice(index, 1);
                    this.savePlaylists();

                    if (index === this.playingNow) {
                        this.setPlayingNow(Math.min(this.playingNow, this.playlist.length - 1));
                    } else if (index < this.playingNow) {
                        this.playingNow--;
                    }
                    if (this.musiclistManager) {
                        this.musiclistManager.handlePlaylistUpdate();
                    }
                }
            }, { once: true });
        } catch (error) {
            console.error("删除歌曲失败:", error);
        }
    }

    async setPlayingNow(index, replay = true) {
        try {
            if (index < 0 || index >= this.playlist.length) {
                throw new Error("无效的播放索引");
            }

            // 先暂停当前音频
            await this.audioPlayer.audio.pause();

            this.settingManager.setSetting("playingNow", index);
            const song = this.playlist[index];
            this.playingNow = index;

            // 更新歌词
            this.lyricsPlayer.changeLyrics(song.lyric);

            // 更新播放列表UI
            const oldPlayingElement = document.querySelector("#playing-list .song.playing");
            const newPlayingElement = document.querySelector(`#playing-list .song[data-bvid="${song.bvid}"]`);

            if (oldPlayingElement) {
                oldPlayingElement.style.transition = 'all 0.3s ease';
                oldPlayingElement.classList.remove("playing");
                oldPlayingElement.classList.add("fade-out");
            }

            if (newPlayingElement) {
                newPlayingElement.classList.add("playing");
                newPlayingElement.classList.add("flash");
                newPlayingElement.scrollIntoView({
                    behavior: 'smooth',
                    block: 'center'
                });
                setTimeout(() => {
                    newPlayingElement.classList.remove("flash");
                }, 800);
            }

            // 更新封面图片
            const coverImg = document.querySelector(".player-content .cover .cover-img");
            coverImg.style.transition = 'opacity 0.3s ease';
            coverImg.style.opacity = '0';

            // 延迟更新UI，让过渡动画更流畅
            setTimeout(() => {
                this.updateUIForCurrentSong(song);
                coverImg.style.opacity = '1';
            }, 300);

            // 重置播放进度
            if (replay) {
                const progressBar = document.querySelector(".player .control .progress .progress-bar .progress-bar-inner");
                progressBar.style.transition = "none";
                progressBar.style.width = "0%";
                setTimeout(() => {
                    progressBar.style.transition = "width 0.1s linear";
                }, 50);
                this.audioPlayer.audio.currentTime = 0;
            }

            // 重置音量设置
            if (this.audioPlayer.volumeInterval) {
                clearInterval(this.audioPlayer.volumeInterval);
                this.audioPlayer.volumeInterval = null;
            }
            this.audioPlayer.audio.volume = 1;

            // 更新媒体会话信息
            if ('mediaSession' in navigator) {
                const { url, size } = await this.cropImageToSquare(song.poster);
                navigator.mediaSession.metadata = new MediaMetadata({
                    title: song.title,
                    artist: song.artist,
                    artwork: [{ src: url, sizes: size, type: 'image/jpeg' }]
                });
            }

            // 开始播放新音频
            await this.tryPlayWithRetry(song);
            this.savePlaylists();

        } catch (error) {
            console.error("设置当前播放失败:", error);
            // 发生错误时重置播放按钮状态
            document.querySelector(".control>.buttons>.play").classList = "play paused";
        }
    }
    async tryPlayWithRetry(song, maxRetries = 2) {
        let lastError;
        this.isLoading = true;
        const playButton = document.querySelector(".control>.buttons>.play");
        playButton.disabled = true;
        const progressBar = document.querySelector(".player .control .progress .progress-bar .progress-bar-inner");
        progressBar.classList.add('loading');

        for (let attempt = 0; attempt < maxRetries; attempt++) {
            try {
                let currentUrl = song.audio;

                if (this.isUrlExpired(currentUrl) || lastError) {
                    const urls = await window.app.musicSearcher.getAudioLink(song.bvid, true);
                    currentUrl = urls[0];
                    song.audio = currentUrl;
                    this.updateUrlExpiryTime(currentUrl);
                    this.savePlaylists();
                }

                // 检查音频URL是否可访问
                try {
                    const response = await axios.get(currentUrl);
                    if (response.status === 403) {
                        const urls = await window.app.musicSearcher.getAudioLink(song.bvid, true);
                        currentUrl = urls[1]; // 使用备用链接
                        song.audio = currentUrl;
                        this.updateUrlExpiryTime(currentUrl);
                        this.savePlaylists();
                    }
                } catch (error) {
                    if (error.response && error.response.status === 403) {
                        const urls = await window.app.musicSearcher.getAudioLink(song.bvid, true);
                        currentUrl = urls[1]; // 使用备用链接
                        song.audio = currentUrl;
                        this.updateUrlExpiryTime(currentUrl);
                        this.savePlaylists();
                    }
                }

                this.audioPlayer.audio.src = currentUrl;
                await this.audioPlayer.audio.play();
                document.querySelector(".control>.buttons>.play").classList = "play played";
                return;
            } catch (error) {
                lastError = error;
                console.error(`播放尝试 ${attempt + 1} 失败:`, error);

                if (attempt < maxRetries - 1) {
                    await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1)));
                } else {
                    document.querySelector(".control>.buttons>.play").classList = "play paused";
                    throw error;
                }
            }
            finally{
                this.isLoading = false;
                playButton.disabled = false;
                progressBar.classList.remove('loading');
            }
        }
    }

    async updateUIForCurrentSong(song) {
        document.documentElement.style.setProperty("--bgul", "url(" + song.poster + ")");
        document.querySelector(".player-content .cover .cover-img").src = song.poster;
        document.querySelector(".player .info .title").textContent = song.title;
        document.querySelector(".player .info .artist").textContent = song.artist;

        if (this.settingManager.getSetting("background") === "video") {
            const oldVideo = document.querySelector('video');
            if (oldVideo) oldVideo.remove();
    
            try {
                let videoUrl = song.video;
                if (!videoUrl || this.isUrlExpired(videoUrl)) {
                    videoUrl = await this.tryGetVideoUrl(song.bvid, song.cid);
                    song.video = videoUrl;
                    this.updateUrlExpiryTime(videoUrl);
                    this.savePlaylists();
                }
    
                const video = document.createElement('video');
                video.style.position = 'absolute';
                video.style.width = '100%';
                video.style.height = '100%';
                video.style.zIndex = '-1';
                video.style.bottom = '0';
                video.style.objectFit = 'cover';
                video.muted = true; // 保持静音
    
                // 新增: 同步视频进度
                const syncVideo = () => {
                    if (Math.abs(video.currentTime - this.audioPlayer.audio.currentTime) > 0.1) {
                        video.currentTime = this.audioPlayer.audio.currentTime;
                    }
                };
    
                // 监听音频播放状态
                this.audioPlayer.audio.addEventListener("play", () => {
                    video.play();
                });
    
                this.audioPlayer.audio.addEventListener("pause", () => {
                    video.pause();
                });
    
                this.audioPlayer.audio.addEventListener("seeking", () => {
                    syncVideo();
                });
    
                // 定期同步进度
                const syncInterval = setInterval(syncVideo, 1000);
    
                // 清理函数
                const cleanup = () => {
                    clearInterval(syncInterval);
                    this.audioPlayer.audio.removeEventListener("play", video.play);
                    this.audioPlayer.audio.removeEventListener("pause", video.pause);
                    this.audioPlayer.audio.removeEventListener("seeking", syncVideo);
                };
    
                // 当视频被移除时清理
                video.addEventListener("remove", cleanup);
                
                video.src = videoUrl;
                document.querySelector('body').appendChild(video);
    
            } catch (error) {
                console.error("视频背景设置失败:", error);
            }
        }
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
            localStorage.setItem("nbmusic_url_expiry", JSON.stringify(Array.from(this.urlExpiryTimes.entries())));
            // 新增：存储当前歌单ID
            if (this.currentPlaylistId) {
                localStorage.setItem("nbmusic_current_playlist_id", this.currentPlaylistId);
            }
        } catch (error) {
            console.error("保存播放列表失败:", error);
        }
    }

    loadPlaylists() {
        try {
            const savedPlaylist = localStorage.getItem("nbmusic_playlist");
            const savedPlaylistName = localStorage.getItem("nbmusic_playlistname");
            const savedUrlExpiry = localStorage.getItem("nbmusic_url_expiry");

            // 验证并加载播放列表
            if (savedPlaylist) {
                const parsedPlaylist = JSON.parse(savedPlaylist);
                if (Array.isArray(parsedPlaylist)) {
                    this.playlist = parsedPlaylist.filter(song => {
                        return song && song.bvid && song.title && song.audio;
                    });
                }
            }

            // 验证并加载播放列表名称
            if (savedPlaylistName && typeof savedPlaylistName === 'string') {
                this.playlistName = savedPlaylistName;
            } else {
                this.playlistName = "默认歌单";
            }

            // 验证并加载 URL 过期时间
            if (savedUrlExpiry) {
                const parsedUrlExpiry = JSON.parse(savedUrlExpiry);
                if (Array.isArray(parsedUrlExpiry)) {
                    this.urlExpiryTimes = new Map(parsedUrlExpiry);
                    // 清理过期的 URL
                    const now = Date.now();
                    for (const [url, expiry] of this.urlExpiryTimes) {
                        if (now > expiry) {
                            this.urlExpiryTimes.delete(url);
                        }
                    }
                }
            }

            const savedPlaylistId = localStorage.getItem("nbmusic_current_playlist_id");
            if (savedPlaylistId) {
                this.currentPlaylistId = savedPlaylistId;
            }

            // 更新 UI
            if (this.uiManager) {
                this.uiManager.renderPlaylist();
            }
            if (this.musiclistManager) {
                this.musiclistManager.handlePlaylistUpdate();
            }

        } catch (error) {
            console.error("加载播放列表失败:", error);
            // 重置数据
            this.playlist = [];
            this.playlistName = "默认歌单";
            this.urlExpiryTimes = new Map();

            // 更新 UI
            if (this.uiManager) {
                this.uiManager.renderPlaylist();
            }
            if (this.musiclistManager) {
                this.musiclistManager.handlePlaylistUpdate();
            }
        }
    }
    async renamePlaylist() {
        try {
            // 创建输入框
            const listNameElement = document.querySelector("#listname");
            const oldName = listNameElement.textContent;
            const input = document.createElement("input");
            input.type = "text";
            input.value = oldName;
            input.classList.add("playlist-input");

            // 替换原有内容
            listNameElement.textContent = "";
            listNameElement.appendChild(input);
            input.focus();
            input.select();

            // 处理确认和取消
            const handleRename = (e) => {
                if (e.key === "Enter") {
                    const newName = input.value.trim();
                    if (newName && newName !== oldName) {
                        this.changePlaylistName(newName);
                    } else {
                        listNameElement.textContent = oldName;
                    }
                    input.removeEventListener("blur", handleBlur);
                } else if (e.key === "Escape") {
                    listNameElement.textContent = oldName;
                    input.removeEventListener("blur", handleBlur);
                }
            };

            const handleBlur = () => {
                listNameElement.textContent = oldName;
                input.removeEventListener("keydown", handleRename);
            };

            input.addEventListener("keydown", handleRename);
            input.addEventListener("blur", handleBlur);

        } catch (error) {
            console.error("重命名歌单失败:", error);
        }
    }
}

module.exports = PlaylistManager;