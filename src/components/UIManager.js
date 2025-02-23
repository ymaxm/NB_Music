const { ipcRenderer } = require("electron");
const { extractMusicTitle } = require("../utils.js");

class UIManager {
    constructor(settingManager, audioPlayer, playlistManager, favoriteManager, musicSearcher) {
        this.audioPlayer = audioPlayer;
        this.playlistManager = playlistManager;
        this.favoriteManager = favoriteManager;
        this.musicSearcher = musicSearcher;
        this.selectedSuggestionIndex = -1;
        this.isMaximized = false;
        this.settingManager = settingManager;
        this.minimizeBtn = document.getElementById("maximize");

        this.initializeEvents();
        this.initializePlayerControls();
        this.initializePageEvents();
        this.initializeSettings();
        this.initializeAdvancedControls();
        this.initializeSearchSuggestions();
    }
    initializeSearchSuggestions() {
        const searchInput = document.querySelector('.search input');
        if (!searchInput) return;

        const suggestionContainer = document.createElement('div');
        suggestionContainer.classList.add('suggestions');
        document.querySelector(".loading").parentNode.appendChild(suggestionContainer);

        let selectedIndex = -1;
        let suggestions = [];
        let debounceTimer;

        searchInput.addEventListener('input', async (e) => {
            clearTimeout(debounceTimer);
            selectedIndex = -1;
            const term = e.target.value.trim();

            if (!term) {
                suggestionContainer.innerHTML = '';
                suggestionContainer.classList.remove('active');
                return;
            }

            debounceTimer = setTimeout(async () => {
                suggestions = await this.musicSearcher.getSearchSuggestions(term);
                if (!suggestions.length) {
                    suggestionContainer.innerHTML = '';
                    suggestionContainer.classList.remove('active');
                } else {
                    suggestionContainer.innerHTML = suggestions
                        .map(s => `
                            <div class="suggestion-item" data-term="${s.value}">
                                ${s.name}
                            </div>
                        `).join('');
                    suggestionContainer.classList.add('active');
                }
            }, 20);
        });

        // 键盘事件处理
        searchInput.addEventListener('keydown', (e) => {

            switch (e.key) {
                case 'ArrowDown':
                    e.preventDefault();
                    selectedIndex = (selectedIndex + 1) % suggestions.length;
                    updateSelection();
                    break;
                case 'ArrowUp':
                    e.preventDefault();
                    selectedIndex = selectedIndex <= 0 ? suggestions.length - 1 : selectedIndex - 1;
                    updateSelection();
                    break;
                case 'Enter':
                    e.preventDefault();
                    if (selectedIndex >= 0) {
                        // 选中建议项
                        searchInput.value = suggestions[selectedIndex].value;
                        suggestionContainer.innerHTML = '';
                        suggestions = [];
                        // 触发搜索
                        this.handleSearch();
                    } else {
                        // 直接搜索输入内容
                        this.handleSearch();
                    }
                    break;
                case 'Escape':
                    suggestionContainer.innerHTML = '';
                    suggestions = [];
                    selectedIndex = -1;
                    break;
            }
        });

        // 更新选中状态
        const updateSelection = () => {
            const items = suggestionContainer.querySelectorAll('.suggestion-item');
            items.forEach((item, index) => {
                if (index === selectedIndex) {
                    item.classList.add('selected');
                } else {
                    item.classList.remove('selected');
                }
            });
        };

        // 点击建议项
        suggestionContainer.addEventListener('click', (e) => {
            const item = e.target.closest('.suggestion-item');
            if (item) {
                searchInput.value = item.dataset.term;
                suggestionContainer.innerHTML = '';
                suggestions = [];
                this.handleSearch();
            }
        });

        // 点击外部关闭建议框
        document.addEventListener('click', (e) => {
            if (!suggestionContainer.contains(e.target) && e.target !== searchInput) {
                suggestionContainer.innerHTML = '';
                suggestions = [];
                selectedIndex = -1;
                suggestionContainer.classList.remove('active');
            }
        });
    }
    initializeAdvancedControls() {
        const speedSelect = document.querySelector(".speed-control");
        [0.5, 1, 1.25, 1.5, 2].forEach(speed => {
            const option = document.createElement("option");
            option.value = speed;
            option.text = `${speed}x`;
            if (speed === 1) option.selected = true;
            speedSelect.appendChild(option);
        });
        speedSelect.addEventListener("change", (e) => {
            this.audioPlayer.audio.playbackRate = parseFloat(e.target.value);
        });

        const downloadBtn = document.querySelector(".import-btn");
        downloadBtn?.addEventListener("click", async () => {
            try {
                const currentSong = this.playlistManager.playlist[this.playlistManager.playingNow];
                if (!currentSong) {
                    this.showNotification('没有可下载的音乐', 'error');
                    return;
                }
        
                // 显示加载提示
                this.showNotification('正在准备下载...', 'info');
        
                // 获取最新的音频URL
                const audioUrl = currentSong.audio;
                if (!audioUrl) {
                    throw new Error('无法获取音频链接');
                }
        
                // 使用 fetch 下载音频文件
                const response = await fetch(audioUrl);
                if (!response.ok) {
                    throw new Error('下载失败');
                }
        
                // 获取音频数据
                const blob = await response.blob();
                
                // 创建下载链接
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                // 清理文件名，移除非法字符
                const fileName = currentSong.title.replace(/[<>:"/\\|?*]+/g, '_');
                a.download = `${fileName}.mp3`; // 使用 .mp3 扩展名
                a.href = url;
                
                // 触发下载
                document.body.appendChild(a);
                a.click();
                
                // 清理
                window.URL.revokeObjectURL(url);
                document.body.removeChild(a);
        
                this.showNotification('开始下载音乐', 'success');
        
            } catch (error) {
                console.error("下载失败:", error);
                this.showNotification('下载失败: ' + error.message, 'error');
            }
        });
    }
    initializeSettings() {
        // 监听歌词显示设置变更
        this.settingManager.addListener('lyricsEnabled', (newValue) => {
            if (this.lyricsPlayer) {
                this.lyricsPlayer.setVisibility(newValue === 'true');
            }
        });
        // 主题切换事件
        this.settingManager.addListener('theme', (newValue, oldValue) => {
            if (newValue == 'auto') {
                newValue = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
            }
            document.querySelector('html').classList.remove(oldValue);
            document.querySelector('html').classList.add(newValue);
        });

        // 背景切换事件
        this.settingManager.addListener('background', async (newValue, oldValue) => {
            if (newValue === 'none') {
                const oldVideo = document.querySelector('video');
                if (oldVideo) oldVideo.remove();
                document.querySelector('html').style.removeProperty('--bgul');
            }
            if (newValue === 'cover') {
                const oldVideo = document.querySelector('video');
                if (oldVideo) oldVideo.remove();
                const savedPlaylist = localStorage.getItem("nbmusic_playlist");
                const currentSong = JSON.parse(savedPlaylist)[localStorage.getItem("nbmusic_playing_now") || 0];
                document.querySelector('html').style.setProperty('--bgul', `url(${currentSong.poster})`);
            }
            if (newValue === 'video' && oldValue !== 'video') {
                // 移除旧视频
                const oldVideo = document.querySelector('video');
                if (oldVideo) oldVideo.remove();
                const savedPlaylist = localStorage.getItem("nbmusic_playlist");

                const currentSong = JSON.parse(savedPlaylist)[localStorage.getItem("nbmusic_playing_now") || 0];                const videoUrl = currentSong.video;
                if (videoUrl) {
                    const video = document.createElement('video');
                    video.autoplay = true;
                    video.loop = true;
                    video.muted = true;
                    video.style.position = 'absolute';
                    video.style.width = '100%';
                    video.style.height = '100%';
                    video.style.zIndex = '-1';
                    video.style.bottom = '0';
                    video.style.objectFit = 'cover';
                    video.src = videoUrl;

                    document.querySelector('body').appendChild(video);
                }

            }
        });
        this.settingManager.addListener('extractTitle', (newValue, oldValue) => {
            this.renderPlaylist();
        });

        const settingContainer = document.querySelector(".content>.setting");
        settingContainer.addEventListener("click", (e) => {
            const setting = e.target;
            if (setting.dataset.key) {
                this.settingManager.setSetting(setting.dataset.key, setting.dataset.value);
            }
        });
        const settings = this.settingManager.settings;
        Object.keys(settings).forEach((key) => {
            const value = settings[key];
            const element = settingContainer.querySelector(`[data-key="${key}"][data-value="${value}"]`);
            if (element) {
                element.click();
            }
        });
    }
    initializePlayerControls() {
        // 进度条控制
        const progressBar = document.querySelector(".progress-bar");
        progressBar?.addEventListener("click", (e) => {
            const rect = progressBar.getBoundingClientRect();
            const percent = (e.clientX - rect.left) / rect.width;
            this.audioPlayer.audio.currentTime = percent * this.audioPlayer.audio.duration;
        });
        this.audioPlayer.audio.addEventListener("timeupdate", () => {
            const progress = (this.audioPlayer.audio.currentTime / this.audioPlayer.audio.duration) * 100;
            document.querySelector(".progress-bar-inner").style.width = `${progress}%`;
        });

        // 播放时更新进度条
        this.audioPlayer.audio.addEventListener("timeupdate", () => {
            const progress = (this.audioPlayer.audio.currentTime / this.audioPlayer.audio.duration) * 100;
            document.querySelector(".progress-bar-inner").style.width = `${progress}%`;
        });

        // 播放控制按钮（使用事件委托）
        const buttonsContainer = document.querySelector(".buttons");
        buttonsContainer?.addEventListener("click", (e) => {
            const button = e.target.closest("[data-action]");
            if (!button) return;

            const action = button.dataset.action;
            switch (action) {
                case "play":
                    this.audioPlayer.play();
                    break;
                case "prev":
                    this.audioPlayer.prev();
                    break;
                case "next":
                    this.audioPlayer.next();
                    break;
            }
        });

        // 播放状态图标更新
        this.audioPlayer.audio.addEventListener("play", () => {
            document.querySelector(".control>.buttons>.play").classList = "play played";
        });

        this.audioPlayer.audio.addEventListener("pause", () => {
            document.querySelector(".control>.buttons>.play").classList = "play paused";
        });
    }

    initializePageEvents() {
        // 获取所有可点击导航元素
        const navElements = document.querySelectorAll("[data-page]");

        navElements.forEach((element) => {
            element.addEventListener("click", (e) => {
                e.preventDefault();
                this.show(element.dataset.page);
            });
        });
    }

    // 页面切换方法
    show(pageName) {
        // 隐藏所有内容
        const contents = document.querySelectorAll(".content>div");
        contents.forEach((content) => content.classList.add("hide"));

        // 移除所有导航项的选中状态
        const navItems = document.querySelectorAll("#function-list>a");
        navItems.forEach((item) => item.classList.remove("check"));

        // 显示目标内容
        const targetContent = document.querySelector(`.content ${pageName}`);
        if (targetContent) {
            targetContent.classList.remove("hide");
        }

        // 设置导航项选中状态
        const targetNav = document.querySelector(`#function-list ${pageName}`);
        if (targetNav) {
            targetNav.classList.add("check");
        }
    }

    initializeEvents() {
        document.querySelector(".listname .controls .playmode").addEventListener("click", (e) => {
            e.stopPropagation();
            this.playlistManager.togglePlayMode();
        });

        window.addEventListener("keydown", (e) => {
            // F12 打开开发者工具
            if (e.key === "F12") {
                ipcRenderer.send("open-dev-tools");
            }

            // 空格键控制播放/暂停
            if (e.key === " " && e.target.tagName !== "INPUT") { // 避免在输入框中按空格触发
                e.preventDefault(); // 阻止页面滚动
                this.audioPlayer.play();
            }
        });
        // 窗口控制按钮
        document.getElementById("minimize").addEventListener("click", () => {
            ipcRenderer.send("window-minimize");
        });

        document.getElementById("maximize").addEventListener("click", () => {
            ipcRenderer.send("window-maximize");
        });

        document.getElementById("close").addEventListener("click", () => {
            ipcRenderer.send("window-close");
        });

        ipcRenderer.on("window-state-changed", (event, maximized) => {
            this.isMaximized = maximized;
            if (this.isMaximized) {
                this.minimizeBtn.innerHTML = `<svg version="1.1" width="12" height="12" viewBox="0,0,37.65105,35.84556" style="margin-top:1px;"><g transform="translate(-221.17804,-161.33903)"><g style="stroke:var(--text);" data-paper-data="{&quot;isPaintingLayer&quot;:true}" fill="none" fill-rule="nonzero" stroke-width="2" stroke-linecap="butt" stroke-linejoin="miter" stroke-miterlimit="10" stroke-dasharray="" stroke-dashoffset="0"><path d="M224.68734,195.6846c-2.07955,-2.10903 -2.00902,-6.3576 -2.00902,-6.3576l0,-13.72831c0,0 -0.23986,-1.64534 2.00902,-4.69202c1.97975,-2.68208 4.91067,-2.00902 4.91067,-2.00902h14.06315c0,0 3.77086,-0.23314 5.80411,1.67418c2.03325,1.90732 1.33935,5.02685 1.33935,5.02685v13.39347c0,0 0.74377,4.01543 -1.33935,6.3576c-2.08312,2.34217 -5.80411,1.67418 -5.80411,1.67418h-13.39347c0,0 -3.50079,0.76968 -5.58035,-1.33935z"></path><path d="M229.7952,162.85325h16.06111c0,0 5.96092,-0.36854 9.17505,2.64653c3.21412,3.01506 2.11723,7.94638 2.11723,7.94638v18.55642"></path></g></g></svg>`;
            } else {
                this.minimizeBtn.innerHTML = '<i class="bi bi-app"></i>';
            }
        });

        // 音频进度条
        this.audioPlayer.audio.addEventListener("timeupdate", () => {
            const progress = (this.audioPlayer.audio.currentTime / this.audioPlayer.audio.duration) * 100;
            document.querySelector(".player .control .progress .progress-bar .progress-bar-inner").style.width = progress + "%";
        });

        // 进度条点击
        document.querySelector(".player .control .progress .progress-bar").addEventListener("click", (event) => {
            const progressBar = event.currentTarget;
            const clickPosition = event.offsetX;
            const progressBarWidth = progressBar.offsetWidth;
            const progress = (clickPosition / progressBarWidth) * this.audioPlayer.audio.duration;
            this.audioPlayer.audio.currentTime = progress;
        });

        // 侧边栏点击事件
        document.addEventListener("click", (event) => {
            if (!event.target.closest(".sidebar") && !event.target.closest(".dock.sidebar")) {
                document.querySelector(".sidebar").classList.add("hide");
            }
        });

        document.querySelector(".sidebar").addEventListener("mouseover", () => {
            document.querySelector(".sidebar").classList.remove("hide");
        });

        // 列表焦点效果
        document.querySelectorAll("#function-list").forEach((list) => {
            list.addEventListener("click", (e) => {
                const clickedItem = e.target.closest("a");
                if (!clickedItem) return;

                const spanFocs = list.querySelector("span.focs");
                if (!spanFocs) return;

                // 移除之前的所有选中状态
                list.querySelectorAll("a").forEach((a) => a.classList.remove("check"));
                // 添加新的选中状态
                clickedItem.classList.add("check");

                // 显示焦点指示器
                spanFocs.style.display = "block";
                spanFocs.classList.add("moving");

                // 设置位置 - 不再使用 transform，直接设置 top
                if (spanFocs.dataset.type === "abs") {
                    spanFocs.style.top = clickedItem.offsetTop + 9 + "px";
                } else {
                    spanFocs.style.top = clickedItem.offsetTop + 9 + "px";
                    spanFocs.style.left = clickedItem.offsetLeft + 5 + "px";
                }

                setTimeout(() => {
                    spanFocs.classList.remove("moving");
                }, 500);
            });
        });

        document.querySelectorAll('nav').forEach(nav => {
            // 生成唯一标识
            const navId = nav.dataset.navId || `nav-${Math.random().toString(36).slice(2, 6)}`;
            nav.dataset.navId = navId;

            nav.querySelectorAll('a').forEach(link => {
                link.addEventListener('click', async (e) => {
                    e.preventDefault();

                    // 检查浏览器是否支持 View Transitions API
                    if (!document.startViewTransition) {
                        console.warn('Browser does not support View Transitions API');
                        // 降级处理
                        const activeLink = nav.querySelector('.active');
                        activeLink?.classList.remove('active');
                        link.classList.add('active');
                        return;
                    }

                    // 避免重复点击
                    if (link.classList.contains('active')) return;

                    const activeLink = nav.querySelector('.active');

                    try {
                        // 设置动态 view-transition-name
                        if (activeLink) {
                            activeLink.style.viewTransitionName = `${navId}-old`;
                        }
                        link.style.viewTransitionName = `${navId}-new`;

                        const transition = document.startViewTransition(() => {
                            activeLink?.classList.remove('active');
                            link.classList.add('active');
                        });

                        // 等待过渡完成
                        await transition.finished;
                    } catch (error) {
                        console.error('View transition failed:', error);
                    } finally {
                        // 清理 view-transition-name
                        if (activeLink) {
                            activeLink.style.viewTransitionName = '';
                        }
                        link.style.viewTransitionName = '';
                    }
                });
            });
        });
        document.querySelector(".listname .controls .rename").addEventListener("click", (e) => {
            e.stopPropagation();
            this.playlistManager.renamePlaylist();
        });
    }

    async handleSearch() {
        try {
            const keyword = document.querySelector(".search input").value;
            if (!keyword) return;
            this.musicSearcher.searchMusic(keyword);
        } catch (error) {
            this.showNotification('搜索失败: ' + error.message, 'error');
        }
    }

    renderPlaylist() {
        if (!this.playlistManager) {
            return;
        }
        document.querySelector("#listname").textContent = this.playlistManager.playlistName;
        const playlistElement = document.querySelector("#playing-list");
        playlistElement.innerHTML = "";

        this.playlistManager.playlist.forEach((song) => {
            const div = this.createSongElement(song, song.bvid, {
                isExtract: true
            });
            if (this.playlistManager.playlist[this.playlistManager.playingNow].bvid === song.bvid) {
                div.classList.add("playing");
            }
            div.addEventListener("click", (e) => {
                const loveBtn = e.target.closest(".love");
                const deleteBtn = e.target.closest(".delete");
                if (!loveBtn && !deleteBtn) {
                    const index = this.playlistManager.playlist.findIndex((item) => item.bvid === song.bvid);
                    this.playlistManager.setPlayingNow(index, e);
                    document.querySelector("#function-list .player").click();
                }
                let songIndex = this.playlistManager.playlist.findIndex((item) => item.bvid === song.bvid);
                if (loveBtn) {
                    const song = this.playlistManager.playlist[songIndex];

                    if (loveBtn.querySelector("i").classList.contains("loved")) {
                        this.favoriteManager.removeFromFavorites(song);
                    } else {
                        this.favoriteManager.addToFavorites(song);
                    }
                }
                if (deleteBtn) {
                    this.playlistManager.removeSong(song.bvid, e);
                }
            });

            playlistElement.appendChild(div);
        });
    }
    createSongElement(song, bvid, { isLove = true, isDelete = true, isExtract = false } = {}) {
        const div = document.createElement("div");
        div.classList.add("song");
        div.setAttribute("data-bvid", bvid);

        const isLoved = this.favoriteManager.lovelist.some((item) => item.bvid === song.bvid);

        div.innerHTML = `
            <img class="poster" alt="Poster image">
            <div class="info">
                <div class="name"></div>
                <div class="artist"></div>
            </div>
            <div class="controls">
                ${isLove
                ? `<div class="love">
                    <i class="bi bi-heart${isLoved ? "-fill" : ""} ${isLoved ? "loved" : ""}"></i>
                </div>`
                : ""
            }
                ${isDelete
                ? `<div class="delete">
                    <i class="bi bi-trash"></i>
                </div>`
                : ""
            }
            </div>`;
        div.querySelector(".poster").src = song.poster;
        const titleMode = this.settingManager.getSetting('extractTitle');
        let displayTitle = song.title;

        switch (titleMode) {
            case 'on':
                displayTitle = extractMusicTitle(song.title);
                break;
            case 'auto':
                div.setAttribute('data-title-mode', 'auto');
                break;
            case 'off':
            default:
                break;
        }

        div.querySelector(".name").textContent = displayTitle;
        div.querySelector(".artist").textContent = song.artist;
        return div;
    }
    /**
     * 显示通知消息
     * @param {string} message - 通知消息内容
     * @param {string} type - 通知类型 ('info'|'success'|'warning'|'error')
     * @param {object} options - 配置选项
     * @param {boolean} options.showProgress - 是否显示进度条
     * @param {number} options.progress - 进度值(0-100)
     * @returns {HTMLElement} 通知元素
     */
    showNotification(message, type = 'info', {showProgress = false, progress = 0} = {}) {
        // 1. 确保有容器
        let container = document.querySelector('.notification-container');
        if (!container) {
            container = document.createElement('div');
            container.className = 'notification-container';
            document.body.appendChild(container);
        }
        
        // 2. 创建通知元素
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        
        // 3. 创建消息文本容器
        const messageDiv = document.createElement('div');
        messageDiv.className = 'notification-message';
        messageDiv.textContent = message;
        notification.appendChild(messageDiv);
        
        // 4. 如果需要进度条则添加
        if (showProgress) {
            const progressBar = document.createElement('div');
            progressBar.className = 'notification-progress';
            
            const progressInner = document.createElement('div');
            progressInner.className = 'notification-progress-inner';
            progressInner.style.width = `${progress}%`;
            
            progressBar.appendChild(progressInner);
            notification.appendChild(progressBar);
        }
        
        // 5. 添加到容器
        container.appendChild(notification);
        
        // 6. 如果不是进度通知，3秒后自动移除
        if (!showProgress) {
            setTimeout(() => {
                notification.classList.add('fade-out');
                setTimeout(() => {
                    notification.remove();
                    // 如果容器为空则移除容器
                    if (!container.children.length) {
                        container.remove();
                    }
                }, 300);
            }, 3000);
        }
        
        return notification;
    }
    showDefaultUi() {
        // 设置默认UI显示
        document.querySelector(".player-content .cover .cover-img").src = "../img/NB_Music.png";
        document.querySelector("html").style.setProperty("--bgul", "url(../img/NB_Music.png)");
        document.querySelector("video")?.remove();
        document.querySelector(".player .info .title").textContent = "NB Music";
        document.querySelector(".player .info .artist").textContent = "欢迎使用";
        document.querySelector(".control>.buttons>.play").classList = "play paused";
        document.querySelector(".progress-bar-inner").style.width = "0%";
        this.audioPlayer.audio.src = "";
        this.lyricsPlayer.changeLyrics("");
    }
}

module.exports = UIManager;
