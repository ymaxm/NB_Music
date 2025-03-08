// 音频播放器类
class AudioPlayer {
    constructor(playlistManager) {
        this.playlistManager = playlistManager;
        this.audio = new Audio();
        this.audio.autoplay = false;
        this.audio.loop = false;
        this.audio.volume = 1;
        this.volumeInterval = null;
        this.settingManager = null; // 将在初始化时设置
        this.lastProgressSaveTime = 0;
        
        this.audio.addEventListener("timeupdate", () => {
            // 增加保存频率：每10秒保存一次进度
            const now = Date.now();
            if ((now - this.lastProgressSaveTime) > 10000) {
                this.playlistManager.savePlaylists();
                this.lastProgressSaveTime = now;
            }
        });

        // 在暂停时保存进度
        this.audio.addEventListener("pause", () => {
            this.playlistManager.savePlaylists();
            this.lastProgressSaveTime = Date.now();
        });
        
        // 在播放结束时保存进度
        this.audio.addEventListener('ended', () => {
            this.playlistManager.savePlaylists();
            this.lastProgressSaveTime = Date.now();
            
            if (this.playlistManager) {
                this.playlistManager.next();
            }
        });
        
        // 在离开页面前保存进度
        window.addEventListener('beforeunload', () => {
            this.playlistManager.savePlaylists();
        });

        if ("mediaSession" in navigator) {
            navigator.mediaSession.setActionHandler("play", () => {
                this.play();
            });
            navigator.mediaSession.setActionHandler("pause", () => {
                this.play();
            });
            navigator.mediaSession.setActionHandler("previoustrack", () => {
                this.prev();
            });
            navigator.mediaSession.setActionHandler("nexttrack", () => {
                this.next();
            });
        }

        this.audio.addEventListener("play", () => {
            if ("mediaSession" in navigator) {
                navigator.mediaSession.playbackState = "playing";
            }
        });

        this.audio.addEventListener("pause", () => {
            if ("mediaSession" in navigator) {
                navigator.mediaSession.playbackState = "paused";
            }
        });
    }

    async audioPlay() {
        // 检查是否启用了淡入淡出效果
        const fadeEnabled = this.settingManager && 
            this.settingManager.getSetting('fadeEnabled') === 'true';

        // 清除现有间隔
        if (this.volumeInterval) {
            clearInterval(this.volumeInterval);
            this.volumeInterval = null;
        }

        // 如果禁用了淡入淡出效果，直接设置音量为1并播放
        if (!fadeEnabled) {
            this.audio.volume = 1;
            await this.audio.play();
            return;
        }

        // 启用淡入淡出时的逻辑
        await this.audio.play();
        this.volumeInterval = window.setInterval(() => {
            this.audio.volume += 0.01;
            if (this.audio.volume >= 0.98) {
                this.audio.volume = 1;
                clearInterval(this.volumeInterval);
                this.volumeInterval = null;
            }
        }, 6);
    }

    audioPause() {
        // 检查是否启用了淡入淡出效果
        const fadeEnabled = this.settingManager && 
            this.settingManager.getSetting('fadeEnabled') === 'true';

        // 清除现有间隔
        if (this.volumeInterval) {
            clearInterval(this.volumeInterval);
            this.volumeInterval = null;
        }

        // 如果禁用了淡入淡出效果，直接暂停
        if (!fadeEnabled) {
            this.audio.pause();
            return;
        }

        // 启用淡入淡出时的逻辑
        this.volumeInterval = window.setInterval(() => {
            this.audio.volume -= 0.01;
            if (this.audio.volume <= 0.02) {
                this.audio.volume = 0;
                this.audio.pause();
                clearInterval(this.volumeInterval);
                this.volumeInterval = null;
            }
        }, 6);
    }

    async play() {
        try {
            if (this.audio.src==="")
            {
                this.uimanager.showNotification("无音频链接"); 
            }
            if (this.audio.paused) {
                await this.audioPlay();
                document.querySelector(".control>.buttons>.play").classList = "play played";
            } else {
                this.audioPause();
                document.querySelector(".control>.buttons>.play").classList = "play paused";
            }
        } catch (e) {
            document.querySelector(".control>.buttons>.play").classList = "play paused";
            this.playlistManager.tryPlayWithRetry(this.playlistManager.playlist[this.playlistManager.playingNow]);
        }
    }

    prev() {
        // 重置音量和清除间隔
        if (this.volumeInterval) {
            clearInterval(this.volumeInterval);
            this.volumeInterval = null;
        }
        this.audio.volume = 1; // 立即重置音量
    
        let prevIndex;
        if (this.playlistManager.playMode === 'shuffle') {
            // 随机播放
            prevIndex = Math.floor(Math.random() * this.playlistManager.playlist.length);
            while(prevIndex === this.playlistManager.playingNow && this.playlistManager.playlist.length > 1) {
                prevIndex = Math.floor(Math.random() * this.playlistManager.playlist.length);
            }
        } else {
            // 列表循环和单曲循环模式下都使用相同的上一首逻辑
            prevIndex = this.playlistManager.playingNow > 0 ? 
                this.playlistManager.playingNow - 1 : 
                this.playlistManager.playlist.length - 1;
        }
        
        this.playlistManager.setPlayingNow(prevIndex);
    }
    
    next() {
        // 重置音量和清除间隔
        if (this.volumeInterval) {
            clearInterval(this.volumeInterval);
            this.volumeInterval = null;
        }
        this.audio.volume = 1; // 立即重置音量
    
        let nextIndex;
        if (this.playlistManager.playMode === 'shuffle') {
            // 随机播放
            nextIndex = Math.floor(Math.random() * this.playlistManager.playlist.length);
            while(nextIndex === this.playlistManager.playingNow && this.playlistManager.playlist.length > 1) {
                nextIndex = Math.floor(Math.random() * this.playlistManager.playlist.length);
            }
        } else {
            // 列表循环和单曲循环模式下都使用相同的下一首逻辑
            nextIndex = this.playlistManager.playingNow < this.playlistManager.playlist.length - 1 ? 
                this.playlistManager.playingNow + 1 : 
                0;
        }
        
        this.playlistManager.setPlayingNow(nextIndex);
    }

    // 设置 settingManager 的方法
    setSettingManager(settingManager) {
        this.settingManager = settingManager;
    }
}

module.exports = AudioPlayer;
