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
        this.currentTime = 0;
        this.currentLoadingController = null;
        this.currentPlayingBvid = null;

        // 'repeat', 'shuffle', 'repeat-one'
        this.playMode = localStorage.getItem('nbmusic_play_mode') || 'repeat';

        // 初始化时更新UI显示
        const playModeIcon = document.querySelector('.playmode i');
        if (playModeIcon) {
            switch (this.playMode) {
                case 'shuffle':
                    playModeIcon.className = 'bi bi-shuffle';
                    break;
                case 'repeat':
                    playModeIcon.className = 'bi bi-repeat';
                    break;
                case 'repeat-one':
                    playModeIcon.className = 'bi bi-repeat-1';
                    break;
            }
        }
        this.loadPlaylists();
    }
    next() {
        if (this.playlist.length === 0) return;

        let nextIndex;
        switch (this.playMode) {
            case 'shuffle':
                // 随机播放
                nextIndex = Math.floor(Math.random() * this.playlist.length);
                while (nextIndex === this.playingNow && this.playlist.length > 1) {
                    nextIndex = Math.floor(Math.random() * this.playlist.length);
                }
                break;
            case 'repeat-one':
                // 单曲循环
                nextIndex = this.playingNow;
                break;
            case 'repeat':
            default:
                // 列表循环
                nextIndex = (this.playingNow + 1) % this.playlist.length;
                break;
        }

        this.setPlayingNow(nextIndex);
    }
    togglePlayMode() {
        const modes = ['repeat', 'shuffle', 'repeat-one'];
        const currentIndex = modes.indexOf(this.playMode);
        this.playMode = modes[(currentIndex + 1) % modes.length];

        // 更新UI
        const playModeIcon = document.querySelector('.playmode i');
        switch (this.playMode) {
            case 'shuffle':
                playModeIcon.className = 'bi bi-shuffle';
                break;
            case 'repeat':
                playModeIcon.className = 'bi bi-repeat';
                break;
            case 'repeat-one':
                playModeIcon.className = 'bi bi-repeat-1';
                break;
        }
        // 保存设置
        localStorage.setItem('nbmusic_play_mode', this.playMode);
    }
    bulkDeleteSongs(songIds) {
        try {
            songIds.forEach(bvid => {
                const index = this.playlist.findIndex(item => item.bvid === bvid);
                if (index !== -1) {
                    this.playlist.splice(index, 1);
                }
            });
            this.savePlaylists();
            this.uiManager.renderPlaylist();
        } catch (error) {
            console.error("批量删除歌曲失败:", error);
        }
    }

    // 新增：根据新的顺序数组重新排序歌单（newOrder 为 bvid 数组）
    reorderPlaylist(newOrder) {
        try {
            const newPlaylist = [];
            newOrder.forEach(bvid => {
                const song = this.playlist.find(item => item.bvid === bvid);
                if (song) newPlaylist.push(song);
            });
            // 将未包含在 newOrder 中的歌曲追加到末尾
            this.playlist.forEach(song => {
                if (!newOrder.includes(song.bvid)) {
                    newPlaylist.push(song);
                }
            });
            this.playlist = newPlaylist;
            this.savePlaylists();
            this.uiManager.renderPlaylist();
        } catch (error) {
            console.error("调整歌单顺序失败:", error);
        }
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

            const song = this.playlist[index];
            
            // 如果正在加载同一首歌，直接返回
            if (this.currentPlayingBvid === song.bvid && this.isLoading) {
                return;
            }

            // 中断当前正在进行的加载
            if (this.currentLoadingController) {
                this.currentLoadingController.abort();
            }
            this.currentLoadingController = new AbortController();
            
            // 更新当前加载状态
            this.isLoading = true;
            this.currentPlayingBvid = song.bvid;
            this.playingNow = index;

            // 立即更新UI以提供视觉反馈
            await this.updatePlayingUI(song, replay);

            // 异步加载和播放音频
            this.loadAndPlayAudio(song, replay, this.currentLoadingController.signal)
                .catch(error => {
                    if (error.name === 'AbortError') {
                        console.log('加载被中断');
                    } else {
                        console.error("播放失败:", error);
                        document.querySelector(".control>.buttons>.play").classList = "play paused";
                    }
                })
                .finally(() => {
                    if (this.currentPlayingBvid === song.bvid) {
                        this.isLoading = false;
                    }
                });

        } catch (error) {
            console.error("设置当前播放失败:", error);
            document.querySelector(".control>.buttons>.play").classList = "play paused";
        }
    }
    async updatePlayingUI(song, replay) {
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
        coverImg.style.opacity = '0';
        
        setTimeout(() => {
            this.updateUIForCurrentSong(song);
            coverImg.style.opacity = '1';
        }, 300);
    }
    // 片段：修改 PlaylistManager 中的 tryPlayWithRetry 方法
    async tryPlayWithRetry(song, maxRetries = 2) {
        let lastError;
        const playButton = document.querySelector(".control>.buttons>.play");
        playButton.disabled = true;
        const progressBar = document.querySelector(".player .control .progress .progress-bar .progress-bar-inner");
        progressBar.classList.add('loading');
        const cacheEnabled = this.settingManager.getSetting("cacheEnabled");
        for (let attempt = 0; attempt < maxRetries; attempt++) {
            try {
                let currentUrl = song.audio;
                if (cacheEnabled) {
                    const cached = window.app.cacheManager.getCachedItem("audio_" + song.bvid);
                    if (cached) {
                        currentUrl = cached;
                        song.audio = currentUrl;
                    }
                }
                if (this.isUrlExpired(currentUrl) || lastError) {
                    const urls = await window.app.musicSearcher.getAudioLink(song.bvid, true);
                    currentUrl = urls[0];
                    song.audio = currentUrl;
                    this.updateUrlExpiryTime(currentUrl);
                    this.savePlaylists();
                    if (cacheEnabled) {
                        window.app.cacheManager.cacheItem("audio_" + song.bvid, currentUrl);
                    }
                }
                const response = await axios.get(currentUrl);
                if (response.status === 403) {
                    const urls = await window.app.musicSearcher.getAudioLink(song.bvid, true);
                    currentUrl = urls[1];
                    song.audio = currentUrl;
                    this.updateUrlExpiryTime(currentUrl);
                    this.savePlaylists();
                    if (cacheEnabled) {
                        window.app.cacheManager.cacheItem("audio_" + song.bvid, currentUrl);
                    }
                }
                this.audioPlayer.audio.src = currentUrl;
                await this.audioPlayer.audio.play();
                document.querySelector(".control>.buttons>.play").classList = "play played";
                return;
            } catch (error) {
                lastError = error;
                if (attempt < maxRetries - 1) {
                    await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1)));
                } else {
                    document.querySelector(".control>.buttons>.play").classList = "play paused";
                    throw error;
                }
            } finally {
                this.isLoading = false;
                playButton.disabled = false;
                progressBar.classList.remove('loading');
            }
        }
    }
    async loadAndPlayAudio(song, replay, signal) {
        const playButton = document.querySelector(".control>.buttons>.play");
        const progressBar = document.querySelector(".player .control .progress .progress-bar .progress-bar-inner");
        
        try {
            playButton.disabled = true;
            progressBar.classList.add('loading');
    
            // 重置播放进度和音量
            this.resetPlaybackState(replay);
    
            // 获取并设置音频
            const audioUrl = await this.getAudioUrl(song, signal);
            if (signal.aborted) throw new DOMException('Aborted', 'AbortError');
            
            this.audioPlayer.audio.src = audioUrl;
            
            // 如果不是重放且有保存的播放进度，则恢复进度
            if (!replay && this.currentTime > 0) {
                this.audioPlayer.audio.currentTime = this.currentTime;
                this.currentTime = 0; // 恢复后清除保存的进度
            }
            
            // 更新媒体会话信息
            await this.updateMediaSession(song);
            if (signal.aborted) throw new DOMException('Aborted', 'AbortError');
    
            // 播放音频
            await this.audioPlayer.audio.play();
            playButton.classList = "play played";
    
            // 保存播放状态
            this.savePlaylists();
    
        } finally {
            playButton.disabled = false;
            progressBar.classList.remove('loading');
        }
    }
    async getAudioUrl(song, signal) {
        const cacheEnabled = this.settingManager.getSetting("cacheEnabled");
        
        // 尝试从缓存获取
        if (cacheEnabled) {
            const cached = window.app.cacheManager.getCachedItem("audio_" + song.bvid);
            if (cached && !this.isUrlExpired(cached)) {
                return cached;
            }
        }

        // 获取新的音频URL
        const urls = await window.app.musicSearcher.getAudioLink(song.bvid, true);
        if (signal.aborted) throw new DOMException('Aborted', 'AbortError');

        const url = urls[0];
        song.audio = url;
        this.updateUrlExpiryTime(url);

        // 缓存新的URL
        if (cacheEnabled) {
            window.app.cacheManager.cacheItem("audio_" + song.bvid, url);
        }

        return url;
    }
    resetPlaybackState(replay) {
        // 重置音量设置
        if (this.audioPlayer.volumeInterval) {
            clearInterval(this.audioPlayer.volumeInterval);
            this.audioPlayer.volumeInterval = null;
        }
        this.audioPlayer.audio.volume = 1;

        // 重置进度条
        const progressBar = document.querySelector(".player .control .progress .progress-bar .progress-bar-inner");
        if (replay) {
            progressBar.style.transition = "none";
            progressBar.style.width = "0%";
            setTimeout(() => {
                progressBar.style.transition = "width 0.1s linear";
            }, 50);
            this.audioPlayer.audio.currentTime = 0;
        }
    }
    async updateMediaSession(song) {
        if ('mediaSession' in navigator) {
            const { url, size } = await this.cropImageToSquare(song.poster);
            navigator.mediaSession.metadata = new MediaMetadata({
                title: song.title,
                artist: song.artist,
                artwork: [{ src: url, sizes: size, type: 'image/jpeg' }]
            });
        }
    }
    async updateUIForCurrentSong(song) {
        // 基础 UI 更新保持不变
        document.documentElement.style.setProperty("--bgul", "url(" + song.poster + ")");
        document.querySelector(".player-content .cover .cover-img").src = song.poster;
        document.querySelector(".player .info .title").textContent = song.title;
        document.querySelector(".player .info .artist").textContent = song.artist;
    
        if (this.settingManager.getSetting("background") === "video") {
            // 移除旧视频及其事件监听器
            const oldVideo = document.querySelector('video');
            if (oldVideo) {
                oldVideo.pause();
                oldVideo.remove();
            }
    
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
                video.muted = true;
                video.playsInline = true;
                video.preload = 'auto';
    
                // 优化视频同步逻辑
                let syncInProgress = false;
                const syncVideo = async () => {
                    if (syncInProgress) return;
                    
                    try {
                        syncInProgress = true;
                        const timeDiff = Math.abs(video.currentTime - this.audioPlayer.audio.currentTime);
                        
                        if (timeDiff > 0.1) {
                            video.currentTime = this.audioPlayer.audio.currentTime;
                            // 等待视频时间更新
                            await new Promise(resolve => {
                                const checkSync = () => {
                                    if (Math.abs(video.currentTime - this.audioPlayer.audio.currentTime) <= 0.1) {
                                        resolve();
                                    } else {
                                        requestAnimationFrame(checkSync);
                                    }
                                };
                                checkSync();
                            });
                        }
                    } finally {
                        syncInProgress = false;
                    }
                };
    
                // 视频加载完成后的处理
                video.addEventListener('loadedmetadata', async () => {
                    await syncVideo();
                    if (!this.audioPlayer.audio.paused) {
                        await video.play();
                    }
                });
    
                // 优化事件监听
                const handlePlay = async () => {
                    if (video.paused) {
                        await syncVideo();
                        await video.play();
                    }
                };
    
                const handlePause = () => {
                    video.pause();
                };
    
                const handleSeeking = async () => {
                    await syncVideo();
                };
    
                this.audioPlayer.audio.addEventListener("play", handlePlay);
                this.audioPlayer.audio.addEventListener("pause", handlePause);
                this.audioPlayer.audio.addEventListener("seeking", handleSeeking);
    
                // 使用 requestAnimationFrame 进行周期性同步
                let rafId = null;
                const periodicSync = async () => {
                    await syncVideo();
                    rafId = requestAnimationFrame(periodicSync);
                };
                rafId = requestAnimationFrame(periodicSync);
    
                // 清理函数
                const cleanup = () => {
                    cancelAnimationFrame(rafId);
                    this.audioPlayer.audio.removeEventListener("play", handlePlay);
                    this.audioPlayer.audio.removeEventListener("pause", handlePause);
                    this.audioPlayer.audio.removeEventListener("seeking", handleSeeking);
                };
    
                // 视频元素移除时的清理
                video.addEventListener("remove", cleanup);
    
                // 设置视频源并添加到页面
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
            this.musiclistManager.savePlaylists();
            localStorage.setItem("nbmusic_playlist", JSON.stringify(this.playlist));
            localStorage.setItem("nbmusic_playlistname", this.playlistName);
            localStorage.setItem("nbmusic_url_expiry", JSON.stringify(Array.from(this.urlExpiryTimes.entries())));
            // 新增：存储当前歌单ID
            if (this.currentPlaylistId) {
                localStorage.setItem("nbmusic_current_playlist_id", this.currentPlaylistId);
            }
            if (this.audioPlayer && !isNaN(this.audioPlayer.audio.currentTime)) {
                localStorage.setItem("nbmusic_current_time", this.audioPlayer.audio.currentTime);
            }
            localStorage.setItem("nbmusic_playing_now", this.playingNow);
        } catch (error) {
            console.error("保存播放列表失败:", error);
        }
    }

    loadPlaylists() {
        try {
            // 加载 URL 过期时间
            const savedUrlExpiry = localStorage.getItem("nbmusic_url_expiry");
            if (savedUrlExpiry) {
                const parsedUrlExpiry = JSON.parse(savedUrlExpiry);
                if (Array.isArray(parsedUrlExpiry)) {
                    this.urlExpiryTimes = new Map(parsedUrlExpiry);
                    const now = Date.now();
                    for (const [url, expiry] of this.urlExpiryTimes) {
                        if (now > expiry) {
                            this.urlExpiryTimes.delete(url);
                        }
                    }
                }
            }
    
            // 加载上次播放的位置
            const savedCurrentTime = localStorage.getItem("nbmusic_current_time");
            if (savedCurrentTime) {
                this.currentTime = parseFloat(savedCurrentTime);
            }
        } catch (error) {
            console.error("加载播放状态失败:", error);
            this.urlExpiryTimes = new Map();
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