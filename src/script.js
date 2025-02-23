"use strict";

const AudioPlayer = require("./components/AudioPlayer.js");
const LyricsPlayer = require("./components/LyricsPlayer.js");
const UIManager = require("./components/UIManager.js");
const PlaylistManager = require("./components/PlaylistManager.js");
const FavoriteManager = require("./components/FavoriteManager.js");
const MusicSearcher = require("./components/MusicSearcher.js");
const SettingManager = require("./components/SettingManager.js");
const MusiclistManager = require("./components/MusiclistManager.js");
const CacheManager = require("./components/CacheManager.js");
const LoginManager = require("./components/LoginManager.js");
const UpdateManager = require("./components/UpdateManager.js");

class App {
    constructor() {
        this.initializeComponents();
        this.loadSavedData();
        this.setupInitialUI();
    }

    initializeComponents() {
        try {
            // 1. 创建基础组件
            this.settingManager = new SettingManager();
            this.audioPlayer = new AudioPlayer(null); // 暂时传入null
            this.lyricsPlayer = new LyricsPlayer("暂无歌词，尽情欣赏音乐", this.audioPlayer.audio, this.settingManager);
            
            // 2. 先创建UI管理器（因为MusiclistManager依赖它）
            this.uiManager = new UIManager(
                this.settingManager, 
                this.audioPlayer,
                null,  // playlistManager临时为null
                null,  // favoriteManager临时为null
                null   // musicSearcher临时为null
            );
            
            // 3. 创建其他组件
            this.playlistManager = new PlaylistManager(this.audioPlayer, this.lyricsPlayer, this.uiManager);
            this.favoriteManager = new FavoriteManager(this.playlistManager, this.uiManager);
            this.musicSearcher = new MusicSearcher();
            this.musiclistManager = new MusiclistManager(this.playlistManager);
            this.cacheManager = new CacheManager();
            this.loginManager = new LoginManager();
            this.updateManager = new UpdateManager();
    
            // 4. 更新所有组件间的引用关系
            this.audioPlayer.playlistManager = this.playlistManager;
            this.audioPlayer.uimanager = this.uiManager;
            this.uiManager.playlistManager = this.playlistManager;
            this.uiManager.audioPlayer = this.audioPlayer;
            this.uiManager.favoriteManager = this.favoriteManager;
            this.uiManager.musicSearcher = this.musicSearcher;
            this.uiManager.lyricsPlayer = this.lyricsPlayer;
            this.musicSearcher.uiManager = this.uiManager;
            this.musicSearcher.playlistManager = this.playlistManager;
            this.musicSearcher.favoriteManager = this.favoriteManager;
            this.playlistManager.settingManager = this.settingManager;
            this.playlistManager.uiManager = this.uiManager;
            this.playlistManager.musicSearcher = this.musicSearcher;
            this.playlistManager.musiclistManager = this.musiclistManager;
            this.musicSearcher.settingManager = this.settingManager;
            this.playlistManager.cacheManager = this.cacheManager;
            this.musiclistManager.uiManager = this.uiManager;
            this.musiclistManager.musicSearcher = this.musicSearcher;
            this.musiclistManager.audioPlayer = this.audioPlayer;
    
            // 5. 暴露全局引用
            window.app = this;
        } catch (error) {
            console.error("组件初始化失败:", error);
        }
    }

    loadSavedData() {
        try {
            // 加载保存的播放列表
            this.playlistManager.loadPlaylists();

            // 加载保存的收藏列表
            this.favoriteManager.loadFavorites();

            // 检查并应用保存的主题设置
            const savedTheme = localStorage.getItem("theme");
            if (savedTheme === "dark") {
                this.uiManager.toggleTheme();
            }
        } catch (error) {
            console.error("加载保存的数据失败:", error);
        }
    }

    setupInitialUI() {
        try {
            // 隐藏加载动画
            setTimeout(() => {
                document.querySelector(".loading").style.opacity = "0";
            }, 1000);
            setTimeout(() => {
                document.querySelector(".loading").style.display = "none";
            }, 2000);

            // 渲染播放列表
            this.uiManager.renderPlaylist();

            // 打开播放器界面
            document.querySelector("#function-list .player").click();

            // 设置默认播放
            if (this.playlistManager.playlist.length > 0) {
                // 使用保存的播放索引
                const index = this.playlistManager.playingNow || 0;
                // 不重置进度
                this.playlistManager.setPlayingNow(index, false);
                this.uiManager.renderPlaylist();
            }
        } catch (error) {
            console.error("初始UI设置失败:", error);
        }
    }
}

// 当DOM加载完成后初始化应用
document.addEventListener("DOMContentLoaded", () => {
    try {
        new App();
    } catch (error) {
        console.error("应用初始化失败:", error);
    }
});
