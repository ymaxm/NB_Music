const axios = require("axios");
const md5 = require("md5");
const { lyric_new, search } = require(`NeteaseCloudMusicApi`);
const { ipcRenderer } = require('electron')
const minimizeBtn = document.getElementById('maximize');

function createObservableArray(callback) {
    return new Proxy([], {
        set(target, property, value) {
            const oldValue = target[property];
            target[property] = value;
            callback({
                type: 'set',
                property,
                oldValue,
                newValue: value
            });
            return true;
        },
        get(target, property) {
            const value = target[property];
            if (typeof value === 'function') {
                return function (...args) {
                    const oldLength = target.length;
                    const result = value.apply(target, args);
                    callback({
                        type: 'method',
                        method: property,
                        args,
                        oldLength,
                        newLength: target.length
                    });
                    return result;
                }
            }
            return value;
        }
    });
}

// 音频播放器类 
class AudioPlayer {
    constructor(playlistManager) {
        this.playlistManager = playlistManager;
        this.audio = new Audio();
        this.audio.autoplay = false;
        this.audio.loop = false;
        this.audio.volume = 0.5;

        this.audio.addEventListener("ended", () => {
            if (this.audio.loop) {
                this.audio.currentTime = 0;
                this.audio.play();
            } else {
                this.next();
            }
        });
    }

    async play() {
        try {
            if (this.audio.paused) {
                await this.audio.play();
                document.querySelector(".player .control .play i").classList =
                    "bi bi-pause-circle";
            } else {
                this.audio.pause();
                document.querySelector(".player .control .play i").classList =
                    "bi bi-play-circle-fill";
            }
        } catch (e) {
            console.error("播放出错:", e);
            document.querySelector(".player .control .play i").classList =
                "bi bi-play-circle-fill";
        }
    }

    prev() {
        if (this.playlistManager.playingNow > 0) {
            this.playlistManager.setPlayingNow(this.playlistManager.playingNow - 1);
        }
    }

    next() {
        if (this.playlistManager.playingNow < this.playlistManager.playlist.length - 1) {
            this.playlistManager.setPlayingNow(this.playlistManager.playingNow + 1);
        }
    }
}

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

    addSong(song) {
        try {
            this.playlist.push(song);
            this.savePlaylists();
        } catch (error) {
            console.error("添加歌曲失败:", error);
        }
    }

    removeSong(index) {
        try {
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

            // 更新歌词
            this.lyricsPlayer.changeLyrics(song.lyric);

            // 更新UI
            document.documentElement.style.setProperty(
                "--bgul",
                "url(" + song.poster + ")"
            );
            document.querySelector(".player-content .cover .cover-img").src = song.poster;
            document.querySelector(".player .info .title").textContent = song.title;
            document.querySelector(".player .info .artist").textContent = song.artist;

            if (replay) {
                document.querySelector(".player .control .progress .progress-bar .progress-bar-inner").style.width = "0%";
                this.audioPlayer.audio.currentTime = 0;
            }

            // 更新播放状态样式
            let songs = document.querySelectorAll(".list .song");
            for (let i = 0; i < songs.length; i++) {
                songs[i].classList.remove("playing");
            }
            songs[this.playingNow].classList.add("playing");

            // 设置音频源并播放
            this.audioPlayer.audio.src = song.audio;
            try {
                await this.audioPlayer.audio.play();
                document.querySelector(".player .control .play i").classList =
                    "bi bi-pause-circle";
            } catch (error) {
                console.error("播放失败:", error);
                document.querySelector(".player .control .play i").classList =
                    "bi bi-play-circle-fill";
            }

            // 保存播放列表
            this.savePlaylists();

        } catch (error) {
            console.error("设置当前播放失败:", error);
        }
    }

    changePlaylistName(name) {
        try {
            this.playlistName = name;
            this.savePlaylists();
            this.uiManager.renderPlaylist();
        } catch (error) {
            console.error("修改播放列表名称失败:", error);
        }
    }

    savePlaylists() {
        try {
            localStorage.setItem('nbmusic_playlist', JSON.stringify(this.playlist));
            localStorage.setItem('nbmusic_playlistname', this.playlistName);
        } catch (error) {
            console.error("保存播放列表失败:", error);
        }
    }

    loadPlaylists() {
        try {
            const savedPlaylist = localStorage.getItem('nbmusic_playlist');
            const savedPlaylistName = localStorage.getItem('nbmusic_playlistname');

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

class FavoriteManager {
    constructor() {
        this.lovelist = createObservableArray((change) => {
            const listElement = document.querySelector("#lovelist");
            switch (change.type) {
                case "set":
                    break;
                case "method":
                    if (change.method === "push" || change.method === "unshift" || change.method === "splice") {
                        this.renderFavoriteList(listElement);
                    }
                    break;
            }
        });
    }

    addToFavorites(song, index) {
        // 检查是否已存在
        if (this.lovelist.some(item => item.title === song.title)) {
            return;
        }

        this.lovelist.push(song);

        // 更新UI
        const songElement = document.querySelector(`[id="${index}"]`);
        if (songElement) {
            const loveButton = songElement.querySelector('.controls .love');
            loveButton.innerHTML = `<i class="bi bi-heart-fill"></i>`;
            loveButton.querySelector('i').classList.add("loved");
            loveButton.setAttribute("onclick", `unlove_song(${index},event)`);
        }
    }

    removeFromFavorites(song, index) {
        this.lovelist = this.lovelist.filter(item => item.title !== song.title);

        // 更新UI
        const songElement = document.querySelector(`[id="${index}"]`);
        if (songElement) {
            const loveButton = songElement.querySelector('.controls .love');
            loveButton.innerHTML = `<i class="bi bi-heart"></i>`;
            loveButton.querySelector('i').classList.remove("loved");
            loveButton.setAttribute("onclick", `love_song(${index},event)`);
        }
    }

    renderFavoriteList(listElement) {
        // 清空列表
        listElement.innerHTML = "";

        // 重新渲染所有收藏歌曲
        this.lovelist.forEach((item, index) => {
            const div = document.createElement("div");
            div.classList.add("song");
            div.id = index;

            div.innerHTML = `
        <img class="poster" alt="Poster image">
        <div class="info">
          <div class="name"></div>
          <div class="artist"></div>
        </div>
        <div class="controls">
          <div class="love loved" onclick="unlove_song(${index},event)">
            <i class="bi bi-heart-fill"></i>
          </div>
        </div>`;

            div.querySelector(".poster").src = item.poster;
            div.querySelector(".name").textContent = item.title;
            div.querySelector(".artist").textContent = item.artist;

            // 点击播放
            div.addEventListener("click", () => {
                const playlist = window.app.playlistManager.playlist;
                //如果在播放列表中找到了这首歌
                if (playlist.some(song => JSON.stringify(song) === JSON.stringify(item))) {
                    window.app.playlistManager.setPlayingNow(
                        playlist.findIndex(song => JSON.stringify(song) === JSON.stringify(item))
                    );
                } else {
                    playlist.push(item);
                    window.app.playlistManager.setPlayingNow(playlist.length - 1);
                    window.app.uiManager.renderPlaylist();
                }
            });

            listElement.appendChild(div);
        });
    }
}

// 音乐搜索类
class MusicSearcher {
    constructor() {
        this.COOKIE = ``;
    }

    async search_music(event) {
        if (event.key === "Enter") {
            let keyword = document.querySelector(".search input").value;
            show(".search-result");
            document.querySelector(".search-result .list").innerHTML = `
      <div class="loading">
    <svg class="gegga">
        <defs>
          <filter id="gegga">
            <feGaussianBlur in="SourceGraphic" stdDeviation="7" result="blur" />
            <feColorMatrix
              in="blur"
              mode="matrix"
              values="1 0 0 0 0 0 1 0 0 0 0 0 1 0 0 0 0 0 20 -10"
              result="inreGegga"
            />  
            <feComposite in="SourceGraphic" in2="inreGegga" operator="atop" />
          </filter>
        </defs>
      </svg>
    <svg class="snurra" width="200" height="200" viewBox="0 0 200 200">
        <defs>
          <linearGradient id="linjärGradient">
            <stop class="stopp1" offset="0" />
            <stop class="stopp2" offset="1" />
          </linearGradient>
          <linearGradient
            y2="160"
            x2="160"
            y1="40"
            x1="40"
            gradientUnits="userSpaceOnUse"
            id="gradient"
            xlink:href="#linjärGradient"
          />
        </defs>
        <path
          class="halvan"
          d="m 164,100 c 0,-35.346224 -28.65378,-64 -64,-64 -35.346224,0 -64,28.653776 -64,64 0,35.34622 28.653776,64 64,64 35.34622,0 64,-26.21502 64,-64 0,-37.784981 -26.92058,-64 -64,-64 -37.079421,0 -65.267479,26.922736 -64,64 1.267479,37.07726 26.703171,65.05317 64,64 37.29683,-1.05317 64,-64 64,-64"
        />
        <circle class="strecken" cx="100" cy="100" r="64" />
      </svg>
    <svg class="skugga" width="200" height="200" viewBox="0 0 200 200">
        <path
          class="halvan"
          d="m 164,100 c 0,-35.346224 -28.65378,-64 -64,-64 -35.346224,0 -64,28.653776 -64,64 0,35.34622 28.653776,64 64,64 35.34622,0 64,-26.21502 64,-64 0,-37.784981 -26.92058,-64 -64,-64 -37.079421,0 -65.267479,26.922736 -64,64 1.267479,37.07726 26.703171,65.05317 64,64 37.29683,-1.05317 64,-64 64,-64"
        />
        <circle class="strecken" cx="100" cy="100" r="64" />
      </svg>
      <style>
      .loading {
    align-items: center;
    display: flex;
    justify-content: center;
    overflow: hidden;
        width: 100%;
      height: 100%;
    }
    .loading>.gegga {
    width: 0;
    }
    .snurra {
    filter: url(#gegga);
    }
    .stopp1 {
    stop-color: var(--theme-1);
    }
    .stopp2 {
    stop-color: var(--theme-2);
    }
    .halvan {
    animation: Snurra1 10s infinite linear;
    stroke-dasharray: 180 800;
    fill: none;
    stroke: url(#gradient);
    stroke-width: 23;
    stroke-linecap: round;
    }
    .strecken {
    animation: Snurra1 3s infinite linear;
    stroke-dasharray: 26 54;
    fill: none;
    stroke: url(#gradient);
    stroke-width: 23;
    stroke-linecap: round;
    }
    .skugga {
    filter: blur(5px);
    opacity: 0.3;
    position: absolute;
    transform: translate(3px, 3px);
    }
    @keyframes Snurra1 {
    0% {
      stroke-dashoffset: 0;
    }
    100% {
      stroke-dashoffset: -403px;
    }
    }
    
      </style>
    </div>
      `;
            if (keyword) {
                let searchResults = await searchBilibiliVideo(keyword);
                let list = document.querySelector(".search-result .list");
                list.innerHTML = "";
                searchResults.forEach((song, index) => {
                    let div = document.createElement("div");
                    div.classList.add("song");
                    div.innerHTML =
                        '<img class="poster" alt="Poster image"><div class="info"><div class="name"></div><div class="artist"></div></div><div class="controls"><div class="love" onclick="love()"><i class="bi bi-heart"></i></div><div class="play" onclick="play()"><i class="bi bi-play-circle"></i></div><div class="add2list" onclick="add2list()"><i class="bi bi-plus-circle"></i></div></div>';
                    div.querySelector(".poster").src = "https:" + song.pic;
                    div.querySelector(".name").textContent = song.title.replace(
                        /<em class="keyword">|<\/em>/g,
                        ""
                    );
                    div.querySelector(".artist").textContent = song.artist;
                    div.addEventListener("click", async () => {
                        if (
                            playlist.find(
                                (item) =>
                                    item.title ==
                                    song.title.replace(/<em class="keyword">|<\/em>/g, "")
                            )
                        ) {
                            return;
                        }
                        let urls = await getAudioLink(song.bvid, true);
                        // 向url[0]发送get请求，检查是否403，决定url = url[0]还是url[1]。
                        let url = urls[0];
                        try {
                            let res = await axios.get(url);
                            if (res.status == 403) {
                                url = urls[1];
                            }
                        } catch (error) {
                            url = urls[1];
                        }

                        playlist.push({
                            title: song.title.replace(/<em class="keyword">|<\/em>/g, ""),
                            artist: song.artist,
                            audio: url,
                            poster: "https:" + song.pic,
                            lyric: await getLyrics(keyword),
                        });

                        setPlayingNow(playlist.length - 1);
                        renderPlaylist();
                        document.querySelector(".player").click();
                    });
                    list.appendChild(div);
                });
                document.querySelector("#function-list span").style.display = "none";
                document.querySelector(".search input").value = "";
                document.querySelector(".search input").blur();
            }
        }
    }

    async getAudioLink(videoId, isBvid = true) {
        // 获取CID直接调用API
        async function getCid(videoId, isBvid = true) {
            const params = isBvid ? `bvid=${videoId}` : `aid=${videoId}`;
            const response = await axios.get(`https://api.bilibili.com/x/web-interface/view?${params}`);

            const data = await response.data;
            if (data.code !== 0) {
                throw new Error(data.message || '获取视频信息失败');
            }
            return data.data.cid;
        }
        const cid = await getCid(videoId, isBvid);
        const params = isBvid
            ? `bvid=${videoId}&cid=${cid}&fnval=16&fnver=0&fourk=1`
            : `avid=${videoId}&cid=${cid}&fnval=16&fnver=0&fourk=1`;

        const response = await axios.get(`https://api.bilibili.com/x/player/playurl?${params}`);

        const data = await response.data;
        if (data.code !== 0) {
            throw new Error(data.message || '获取音频链接失败');
        }

        const audioStream = data.data.dash.audio;
        if (!audioStream || audioStream.length === 0) {
            throw new Error('未找到音频流');
        }

        const bestAudio = audioStream[0];
        return [bestAudio.baseUrl, bestAudio.backupUrl];
    }

    async getLyrics(songName) {
        try {
            const searchResponse = await search({ keywords: songName, limit: 1 });
            const searchResult = searchResponse.body;
            if (
                !searchResult.result ||
                !searchResult.result.songs ||
                searchResult.result.songs.length === 0
            ) {
                return "暂无歌词，尽情欣赏音乐";
            }

            const songId = searchResult.result.songs[0].id;

            const yrcResponse = await lyric_new({ id: songId });

            if (!yrcResponse.body) {
                return "暂无歌词，尽情欣赏音乐";
            }
            const yrcLyrics = yrcResponse.body;
            return yrcLyrics.yrc ? yrcLyrics.yrc.lyric : yrcLyrics.lrc ? yrcLyrics.lrc.lyric : "暂无歌词，尽情欣赏音乐";
        } catch (error) {
        }
    }
}

// 歌词渲染类
class LyricsPlayer {
    constructor(lyricsString, audioElement) {
        this.lyricsContainer = document.getElementById('lyrics-container');
        this.lyricsContainer.innerHTML = '';
        this.parsedData = this.parseLyrics(lyricsString);
        this.audio = audioElement; // 保存audio引用
        this.activeLines = new Set();
        this.completedLines = new Set();
        this.animationFrame = null;

        // 监听audio事件
        this.audio.addEventListener('play', () => this.start());
        this.audio.addEventListener('pause', () => this.stop());
        this.audio.addEventListener('seeking', () => this.onSeek());

        this.init();
    }
    changeLyrics(newLyricsString) {
        // 清除现有状态
        this.stop();
        this.activeLines.clear();
        this.completedLines.clear();
        this.lyricsContainer.innerHTML = '';

        // 解析新歌词
        this.parsedData = this.parseLyrics(newLyricsString);

        // 重新初始化
        this.init();

        // 如果音频正在播放，则启动动画
        if (!this.audio.paused) {
            this.start();
        }
    }
    createMetadataElement(metadata) {
        const div = document.createElement('div');
        div.className = 'metadata';

        metadata.content.forEach(item => {
            const span = document.createElement('span');
            span.textContent = item.tx;
            div.appendChild(span);
        });

        return div;
    }
    parseLyrics(lyricsString) {
        if (!lyricsString) {
            // 返回暂无歌词
            return [{ type: 'lyric', lineStart: 0, lineDuration: 5000, chars: [{ text: '暂无歌词', startTime: 0, duration: 5000 }] }];
        }
        const lines = lyricsString.split("\n");
        const parsedData = [];

        // 从第一行开始判断，如果有是传统时间戳格式，则按照传统时间戳格式解析
        let isTraditionalFormat = 0;
        lines.forEach((line) => {
            if (line.match(/^\[\d{2}:\d{2}\.\d{2,3}\]/)) {
                isTraditionalFormat = 1
                return;
            }
        });
        if (isTraditionalFormat) {
            // 处理传统时间戳格式
            lines.forEach((line) => {
                if (line.trim() === "") return;

                const timeRegex = /\[(\d{2}):(\d{2})\.(\d{2,3})\](.*)/;
                const match = line.match(timeRegex);

                if (match) {
                    const [_, mm, ss, ms, text] = match;
                    const startTime = (parseInt(mm) * 60 + parseInt(ss)) * 1000 + parseInt(ms);

                    parsedData.push({
                        type: "lyric",
                        lineStart: startTime,
                        lineDuration: 10000, // 默认持续5秒
                        chars: [{
                            text: text.trim(),
                            startTime: startTime,
                            duration: 5000
                        }]
                    });
                }
            });
        } else {
            // 原有的逐字歌词解析逻辑
            lines.forEach((line) => {
                if (line.trim() === "") return;

                if (line.startsWith("{")) {
                    const metadata = JSON.parse(line);
                    parsedData.push({
                        type: "metadata",
                        time: metadata.t,
                        content: metadata.c,
                    });
                    return;
                }

                if (line.startsWith("[")) {
                    const timeMatch = line.match(/\[(\d+),(\d+)\]/);
                    const charMatches = line.match(/\((\d+),(\d+),\d+\)([^(]+)/g);

                    if (timeMatch && charMatches) {
                        const lineStart = parseInt(timeMatch[1]);
                        const lineDuration = parseInt(timeMatch[2]);
                        const chars = [];

                        charMatches.forEach((charMatch) => {
                            const [_, startTime, duration, text] = charMatch.match(
                                /\((\d+),(\d+),\d+\)(.+)/
                            );
                            chars.push({
                                text,
                                startTime: parseInt(startTime),
                                duration: parseInt(duration),
                            });
                        });

                        parsedData.push({
                            type: "lyric",
                            lineStart,
                            lineDuration,
                            chars,
                        });
                    }
                }
            });
        }

        return parsedData;
    }
    createLyricElement(lyricData) {
        const lineDiv = document.createElement("div");
        lineDiv.className = "lyric-line";

        // 处理整行歌词的情况
        if (lyricData.chars.length === 1 && lyricData.chars[0].text === lyricData.chars[0].text.trim()) {
            const charSpan = document.createElement("span");
            charSpan.className = "char";
            charSpan.textContent = lyricData.chars[0].text;
            lineDiv.appendChild(charSpan);
        } else {
            // 处理逐字歌词
            lyricData.chars.forEach((char) => {
                const charSpan = document.createElement("span");
                charSpan.className = "char";
                charSpan.textContent = char.text;
                lineDiv.appendChild(charSpan);
            });
        }

        return lineDiv;
    }


    init() {
        this.parsedData.forEach((data) => {
            if (data.type === "metadata") {
                this.lyricsContainer.appendChild(
                    this.createMetadataElement(data)
                );
            } else {
                this.lyricsContainer.appendChild(this.createLyricElement(data));
            }
        });

        this.startTime = Date.now();
        this.animate();
    }

    animate() {
        const currentTime = this.audio.currentTime * 1000; // 转换为毫秒

        this.parsedData.forEach((data, dataIndex) => {
            if (data.type === "lyric") {
                const line = this.lyricsContainer.children[dataIndex];
                const chars = Array.from(line.children);
                let hasActiveLine = false;
                let allCompleted = true;

                data.chars.forEach((char, index) => {
                    const charElement = chars[index];
                    const charStartTime = char.startTime;
                    const charEndTime = char.startTime + char.duration;

                    if (currentTime >= charStartTime && currentTime <= charEndTime) {
                        charElement.classList.add("active");
                        charElement.classList.remove("completed");
                        hasActiveLine = true;
                        allCompleted = false;
                    } else if (currentTime > charEndTime) {
                        charElement.classList.remove("active");
                        charElement.classList.add("completed");
                    } else {
                        charElement.classList.remove("active", "completed");
                        allCompleted = false;
                    }
                });

                if (hasActiveLine) {
                    line.classList.add("active");
                    this.activeLines.add(dataIndex);
                } else {
                    line.classList.remove("active");
                    this.activeLines.delete(dataIndex);
                }

                if (allCompleted) {
                    this.completedLines.add(dataIndex);
                    chars.forEach(char => {
                        char.classList.add("completed");
                        char.classList.remove("active");
                    });
                }
            }
        });

        const container = document.querySelector('#lyrics-container');
        const activeLyric = container.querySelector('.lyric-line.active');

        if (activeLyric) {
            const containerHeight = container.clientHeight;
            const lyricPosition = activeLyric.offsetTop;
            const lyricHeight = activeLyric.offsetHeight;
            const scrollPosition = lyricPosition - (containerHeight / 2) + (lyricHeight / 2);

            container.scrollTo({
                top: scrollPosition,
                behavior: 'smooth'
            });
        }

        this.animationFrame = requestAnimationFrame(() => this.animate());
    }
    // 新增控制方法
    start() {
        if (!this.animationFrame) {
            this.animate();
        }
    }

    stop() {
        if (this.animationFrame) {
            cancelAnimationFrame(this.animationFrame);
            this.animationFrame = null;
        }
    }

    onSeek() {
        // 清除所有活动状态,重新根据当前时间计算
        this.activeLines.clear();
        this.completedLines.clear();
        // 如果是暂停状态,手动触发一次动画更新
        if (this.audio.paused) {
            this.animate();
            this.stop();
        }
    }
}

class UIManager {
    constructor(audioPlayer, playlistManager, favoriteManager, musicSearcher) {
        this.audioPlayer = audioPlayer;
        this.playlistManager = playlistManager;
        this.favoriteManager = favoriteManager;
        this.musicSearcher = musicSearcher;

        this.initializeEvents();
    }
    initializePageEvents() {
        // 获取所有可点击导航元素
        const navElements = document.querySelectorAll('[data-page]');

        navElements.forEach(element => {
            element.addEventListener('click', (e) => {
                e.preventDefault();
                this.show(element.dataset.page);
            });
        });

        // 为特定页面添加额外的事件监听
        this.initializeSpecificPageEvents();
    }

    // 页面切换方法
    show(pageName) {
        // 隐藏所有内容
        const contents = document.querySelectorAll(".content>div");
        contents.forEach(content => content.classList.add("hide"));

        // 移除所有导航项的选中状态
        const navItems = document.querySelectorAll("#function-list>a");
        navItems.forEach(item => item.classList.remove("check"));

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

    initializeSpecificPageEvents() {
        // 播放器控制
        document.querySelector('.player .control .play')?.addEventListener('click', () => {
            this.audioPlayer.play();
        });

        document.querySelector('.player .control .prev')?.addEventListener('click', () => {
            this.audioPlayer.prev();
        });

        document.querySelector('.player .control .next')?.addEventListener('click', () => {
            this.audioPlayer.next();
        });

        // 收藏按钮
        document.querySelector('#playing-list')?.addEventListener('click', (e) => {
            const loveBtn = e.target.closest('.love');
            if (loveBtn) {
                e.stopPropagation();
                const songElement = loveBtn.closest('.song');
                const songIndex = parseInt(songElement.id);
                const song = this.playlistManager.playlist[songIndex];

                if (loveBtn.classList.contains('loved')) {
                    this.favoriteManager.removeFromFavorites(song, songIndex);
                } else {
                    this.favoriteManager.addToFavorites(song, songIndex);
                }
            }
        });

        // 删除按钮
        document.querySelector('#playing-list')?.addEventListener('click', (e) => {
            const deleteBtn = e.target.closest('.delete');
            if (deleteBtn) {
                e.stopPropagation();
                const songElement = deleteBtn.closest('.song');
                const songIndex = parseInt(songElement.id);
                this.playlistManager.removeSong(songIndex);
                this.renderPlaylist();
            }
        });
    }
    initializeEvents() {
        // 窗口控制按钮
        document.getElementById('minimize').addEventListener('click', () => {
            ipcRenderer.send('window-minimize');
        });

        document.getElementById('maximize').addEventListener('click', () => {
            ipcRenderer.send('window-maximize');
        });

        document.getElementById('close').addEventListener('click', () => {
            ipcRenderer.send('window-close');
        });

        // 音频进度条
        this.audioPlayer.audio.addEventListener("timeupdate", () => {
            const progress = (this.audioPlayer.audio.currentTime / this.audioPlayer.audio.duration) * 100;
            document.querySelector(
                ".player .control .progress .progress-bar .progress-bar-inner"
            ).style.width = progress + "%";
        });

        // 进度条点击
        document.querySelector(".player .control .progress .progress-bar")
            .addEventListener("click", (event) => {
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
        document.querySelectorAll(".list.focs").forEach((li) => {
            li.addEventListener("click", () => {
                let spanFocs = li.querySelectorAll("span.focs")[0],
                    aCheck = li.querySelectorAll("a.check")[0],
                    allLinks = li.querySelectorAll("a");

                spanFocs.style.display = "block";
                if (spanFocs.dataset.type == "abs") {
                    spanFocs.classList.add("cl");
                    spanFocs.style.top =
                        aCheck.getBoundingClientRect().top -
                        li.parentElement.getBoundingClientRect().top +
                        "px";
                } else {
                    spanFocs.classList.add("cl");
                    spanFocs.style.top =
                        aCheck.offsetTop - allLinks[allLinks.length - 1].offsetTop + 5 + "px";
                    spanFocs.style.left = aCheck.offsetLeft - li.offsetLeft + "px";
                }

                setTimeout(() => {
                    spanFocs.classList.remove("cl");
                }, 500);
            });
        });

        // 搜索输入框事件
        document.querySelector(".search input").addEventListener("keypress", (event) => {
            if (event.key === "Enter") {
                this.handleSearch(event);
            }
        });
    }

    async handleSearch(event) {
        const keyword = document.querySelector(".search input").value;
        if (!keyword) return;

        this.show(".search-result");
        // 显示加载动画...
        document.querySelector(".search-result .list").innerHTML = `<div class="loading">...</div>`;

        try {
            const searchResults = await this.musicSearcher.searchBilibiliVideo(keyword);
            this.renderSearchResults(searchResults, keyword);
        } catch (error) {
            console.error("搜索失败:", error);
            document.querySelector(".search-result .list").innerHTML = "搜索失败，请重试";
        }

        document.querySelector("#function-list span").style.display = "none";
        document.querySelector(".search input").value = "";
        document.querySelector(".search input").blur();
    }

    toggleTheme() {
        document.querySelector(".dock.theme").classList.toggle("dk");
        document.documentElement.classList.toggle("dark");

        if (document.documentElement.classList.contains("dark")) {
            localStorage.setItem("theme", "dark");
        } else {
            localStorage.setItem("theme", "light");
        }
    }
    renderPlaylist() {
        document.querySelector("#listname").textContent = this.playlistManager.playlistName;
        const playlistElement = document.querySelector("#playing-list");
        playlistElement.innerHTML = "";

        this.playlistManager.playlist.forEach((song, index) => {
            const div = document.createElement("div");
            div.classList.add("song");
            div.id = index;

            const isLoved = window.app.favoriteManager.lovelist.some(
                item => JSON.stringify(item) === JSON.stringify(song)
            );

            div.innerHTML = `
                <img class="poster" alt="Poster image">
                <div class="info">
                    <div class="name"></div>
                    <div class="artist"></div>
                </div>
                <div class="controls">
                    <div class="love ${isLoved ? 'loved' : ''}" 
                         onclick="${isLoved ? 'unlove_song' : 'love_song'}(${index},event)">
                        <i class="bi bi-heart${isLoved ? '-fill' : ''}"></i>
                    </div>
                    <div class="delete" onclick="delete_song(${index},event)">
                        <i class="bi bi-trash"></i>
                    </div>
                </div>`;

            div.querySelector(".poster").src = song.poster;
            div.querySelector(".name").textContent = song.title;
            div.querySelector(".artist").textContent = song.artist;

            div.addEventListener("click", () => {
                this.playlistManager.setPlayingNow(index);
            });

            playlistElement.appendChild(div);
        });
    }
}

class App {
    constructor() {
        this.initializeComponents();
        this.loadSavedData();
        this.setupInitialUI();
    }

    initializeComponents() {
        try {
            // 创建播放器组件
            this.audioPlayer = new AudioPlayer(this.playlistManager);

            // 创建歌词播放器
            this.lyricsPlayer = new LyricsPlayer("暂无歌词，尽情欣赏音乐", this.audioPlayer.audio);

            // 创建UI管理器
            this.uiManager = new UIManager(
                this.audioPlayer,
                this.playlistManager,
                this.favoriteManager,
                this.musicSearcher
            );

            // 创建播放列表管理器
            this.playlistManager = new PlaylistManager(
                this.audioPlayer,
                this.lyricsPlayer,
                this.uiManager
            );

            // 创建收藏管理器
            this.favoriteManager = new FavoriteManager();

            // 创建音乐搜索器
            this.musicSearcher = new MusicSearcher();

            // 更新组件间的引用
            this.audioPlayer.playlistManager = this.playlistManager;
            this.uiManager.playlistManager = this.playlistManager;
            this.uiManager.audioPlayer = this.audioPlayer;
            this.uiManager.favoriteManager = this.favoriteManager;
            this.uiManager.musicSearcher = this.musicSearcher;

            // 暴露全局引用
            window.app = this;

        } catch (error) {
            console.error("组件初始化失败:", error);
        }
    }

    loadSavedData() {
        try {
            // 加载保存的播放列表
            this.playlistManager.loadPlaylists();

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

            // 设置默认播放
            if (this.playlistManager.playlist.length > 0) {
                this.playlistManager.setPlayingNow(0, false);
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