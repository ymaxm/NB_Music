const axios = require("axios");
const md5 = require("md5");
const { lyric_new, search } = require(`NeteaseCloudMusicApi`);
const { ipcRenderer } = require("electron");
const minimizeBtn = document.getElementById("maximize");

function createObservableArray(callback) {
    return new Proxy([], {
        set(target, property, value) {
            const oldValue = target[property];
            target[property] = value;
            callback({
                type: "set",
                property,
                oldValue,
                newValue: value,
            });
            return true;
        },
        get(target, property) {
            const value = target[property];
            if (typeof value === "function") {
                return function (...args) {
                    const oldLength = target.length;
                    const result = value.apply(target, args);
                    callback({
                        type: "method",
                        method: property,
                        args,
                        oldLength,
                        newLength: target.length,
                    });
                    return result;
                };
            }
            return value;
        },
    });
}
function extractMusicTitle(input) {
    // 匹配所有括号内的内容
    const bracketsRegex =
        /<[^>]+>|《[^》]+》|\[[^\]]+\]|【[^】]+】|「[^」]+」/g;
    // 匹配空格分隔的字符串(排除括号内的空格)
    const spaceRegex =
        /(?![<《\[【「])[^\s<>《》\[\]【】「」]+\s+[^\s<>《》\[\]【】「」]+(?![>》\]】」])/g;

    let results = [];

    const bracketMatches = input.match(bracketsRegex) || [];
    results = results.concat(bracketMatches.map((match) => match.slice(1, -1)));

    const spaceMatches = input.match(spaceRegex) || [];
    results = results.concat(spaceMatches);

    return results.filter((item) => item && item.trim()).join(" ");
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
            this.playlistManager.setPlayingNow(
                this.playlistManager.playingNow - 1
            );
        }
    }

    next() {
        if (
            this.playlistManager.playingNow <
            this.playlistManager.playlist.length - 1
        ) {
            this.playlistManager.setPlayingNow(
                this.playlistManager.playingNow + 1
            );
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
                this.setPlayingNow(
                    Math.min(this.playingNow, this.playlist.length - 1)
                );
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
                document.querySelector(
                    ".player .control .progress .progress-bar .progress-bar-inner"
                ).style.width = "0%";
                this.audioPlayer.audio.currentTime = 0;
            }

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
                document.querySelector(".player .control .play i").classList =
                    "bi bi-pause-circle";
                return; // 成功播放，退出重试
            } catch (error) {
                console.error(`播放尝试 ${attempt + 1} 失败:`, error);

                if (attempt === maxRetries - 1) {
                    // 最后一次尝试，重新获取URL
                    try {
                        // 假设MusicSearcher是可访问的
                        const urls =
                            await window.app.musicSearcher.getAudioLink(
                                song.bvid,
                                true
                            );
                        let newUrl = urls[0];

                        try {
                            const res = await axios.get(newUrl);
                            if (res.status === 403) {
                                newUrl = urls[1];
                            }
                        } catch (error) {
                            newUrl = urls[1];
                        }

                        // 更新歌曲URL并保存
                        song.audio = newUrl;
                        this.savePlaylists();

                        // 最后一次尝试播放
                        this.audioPlayer.audio.src = newUrl;
                        await this.audioPlayer.audio.play();
                        document.querySelector(
                            ".player .control .play i"
                        ).classList = "bi bi-pause-circle";
                        return;
                    } catch (finalError) {
                        console.error("重新获取音频链接失败:", finalError);
                        document.querySelector(
                            ".player .control .play i"
                        ).classList = "bi bi-play-circle-fill";
                        throw finalError;
                    }
                }

                // 等待一段时间后重试
                await new Promise((resolve) =>
                    setTimeout(resolve, 1000 * (attempt + 1))
                );
            }
        }
    }
    updateUIForCurrentSong(song) {
        document.documentElement.style.setProperty(
            "--bgul",
            "url(" + song.poster + ")"
        );
        document.querySelector(".player-content .cover .cover-img").src =
            song.poster;
        document.querySelector(".player .info .title").textContent = song.title;
        document.querySelector(".player .info .artist").textContent =
            song.artist;
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
            localStorage.setItem(
                "nbmusic_playlist",
                JSON.stringify(this.playlist)
            );
            localStorage.setItem("nbmusic_playlistname", this.playlistName);
        } catch (error) {
            console.error("保存播放列表失败:", error);
        }
    }

    loadPlaylists() {
        try {
            const savedPlaylist = localStorage.getItem("nbmusic_playlist");
            const savedPlaylistName = localStorage.getItem(
                "nbmusic_playlistname"
            );

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
    constructor(playlistManager, uiManager) {
        this.playlistManager = playlistManager;
        this.uiManager = uiManager;
        this.initializeLovelist();

        this.lovelist = createObservableArray((change) => {
            const listElement = document.querySelector("#lovelist");
            switch (change.type) {
                case "set":
                    break;
                case "method":
                    if (
                        change.method === "push" ||
                        change.method === "unshift" ||
                        change.method === "splice"
                    ) {
                        this.renderFavoriteList(listElement);
                    }
                    break;
            }
        });
    }
    initializeLovelist() {
        this.lovelist = createObservableArray((change) => {
            const listElement = document.querySelector("#lovelist");
            if (listElement) {
                this.renderFavoriteList(listElement);
            }
        });
    }

    saveFavorites() {
        try {
            localStorage.setItem(
                "nbmusic_favorites",
                JSON.stringify(this.lovelist)
            );
        } catch (error) {
            console.error("保存收藏列表失败:", error);
        }
    }
    loadFavorites() {
        try {
            const savedFavorites = localStorage.getItem("nbmusic_favorites");
            if (savedFavorites) {
                // 不直接赋值，而是通过数组方法添加
                const favorites = JSON.parse(savedFavorites);
                this.lovelist.length = 0; // 清空数组
                favorites.forEach((item) => this.lovelist.push(item)); // 逐个添加以触发观察者
            }
        } catch (error) {
            console.error("加载收藏列表失败:", error);
            this.initializeLovelist(); // 重新初始化
        }
    }
    removeFromFavorites(song) {
        // 使用 splice 而不是 filter 来确保触发观察者
        const removeIndex = this.lovelist.findIndex(
            (item) => item.title === song.title
        );
        if (removeIndex !== -1) {
            this.lovelist.splice(removeIndex, 1);
        }

        // 更新UI
        const songElements = document.querySelectorAll(`[id="${song.bvid}"]`);
        songElements.forEach((songElement) => {
            if (songElement) {
                const loveButton = songElement.querySelector(".controls .love");
                loveButton.innerHTML = `<i class="bi bi-heart"></i>`;
                loveButton.querySelector("i").classList.remove("loved");
            }
        });
        this.saveFavorites();
    }

    addToFavorites(song) {
        // 检查是否已存在
        if (this.lovelist.some((item) => item.bvid === song.bvid)) {
            return;
        }

        this.lovelist.push(song); // 这会触发观察者

        // 更新UI
        const songElement = document.querySelector(`[id="${song.bvid}"]`);
        if (songElement) {
            const loveButton = songElement.querySelector(".controls .love");
            loveButton.innerHTML = `<i class="bi bi-heart-fill"></i>`;
            loveButton.querySelector("i").classList.add("loved");
        }
        this.saveFavorites();
    }

    renderFavoriteList(listElement) {
        listElement.innerHTML = "";

        // 重新渲染所有收藏歌曲
        this.lovelist.forEach((song) => {
            const div = this.uiManager.createSongElement(song, song.bvid, {
                isDelete: false,
            });

            // 点击播放
            div.addEventListener("click", (e) => {
                const playlist = this.playlistManager.playlist;
                const loveBtn = e.target.closest(".love");
                if (loveBtn) {
                    e.stopPropagation();
                    const songIndex = playlist.findIndex(
                        (item) => item.bvid === e.id
                    );
                    const song = this.playlistManager.playlist[songIndex];

                    if (
                        loveBtn.querySelector("i").classList.contains("loved")
                    ) {
                        this.removeFromFavorites(song, songIndex);
                    } else {
                        this.addToFavorites(song, songIndex);
                    }
                } else {
                    //如果在播放列表中找到了这首歌
                    if (playlist.some((item) => item.bvid === song.bvid)) {
                        this.playlistManager.setPlayingNow(
                            playlist.findIndex(
                                (item) => item.bvid === song.bvid
                            )
                        );
                        document.querySelector("#function-list .player").click();
                    } else {
                        this.playlistManager.addSong(song);
                        this.playlistManager.setPlayingNow(
                            playlist.length - 1
                        );
                        this.uiManager.renderPlaylist();
                        document.querySelector("#function-list .player").click();
                    }
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
    async searchBilibiliVideo(
        keyword,
        search_type = "video",
        page = 1,
        order = "totalrank",
        duration = 0,
        tids = 0
    ) {
        const mixinKeyEncTab = [
            46, 47, 18, 2, 53, 8, 23, 32, 15, 50, 10, 31, 58, 3, 45, 35, 27, 43,
            5, 49, 33, 9, 42, 19, 29, 28, 14, 39, 12, 38, 41, 13, 37, 48, 7, 16,
            24, 55, 40, 61, 26, 17, 0, 1, 60, 51, 30, 4, 22, 25, 54, 21, 56, 59,
            6, 63, 57, 62, 11, 36, 20, 34, 44, 52,
        ];

        function getMixinKey(orig) {
            return mixinKeyEncTab
                .map((n) => orig[n])
                .join("")
                .slice(0, 32);
        }

        function encWbi(params, imgKey, subKey) {
            const mixinKey = getMixinKey(imgKey + subKey);
            const currTime = Math.round(Date.now() / 1000);
            const chrFilter = /[!'()*]/g;

            params.wts = currTime;

            const query = Object.keys(params)
                .sort()
                .map((key) => {
                    const value = params[key].toString().replace(chrFilter, "");
                    return `${encodeURIComponent(key)}=${encodeURIComponent(
                        value
                    )}`;
                })
                .join("&");

            const wbiSign = md5(query + mixinKey);
            return `${query}&w_rid=${wbiSign}`;
        }

        async function getWbiKeys() {
            const response = await axios.get(
                "https://api.bilibili.com/x/web-interface/nav"
            );
            const {
                wbi_img: { img_url, sub_url },
            } = response.data.data;

            return {
                img_key: img_url.slice(
                    img_url.lastIndexOf("/") + 1,
                    img_url.lastIndexOf(".")
                ),
                sub_key: sub_url.slice(
                    sub_url.lastIndexOf("/") + 1,
                    sub_url.lastIndexOf(".")
                ),
            };
        }

        try {
            const { img_key, sub_key } = await getWbiKeys();
            const params = {
                search_type: "video",
                keyword,
                order,
                duration,
                tids,
                page,
            };
            const query = encWbi(params, img_key, sub_key);

            const response = await axios.get(
                `https://api.bilibili.com/x/web-interface/wbi/search/type?${query}`
            );

            if (response.data.code !== 0) {
                throw new Error(response.data.message || "搜索失败");
            }

            return response.data.data.result || [];
        } catch (error) {
            console.error("搜索B站视频失败:", error);
            throw error;
        }
    }
    async searchMusic(keyword) {
        if (!keyword) return;

        try {
            const self = this;

            // 显示搜索结果区域
            this.uiManager.show(".search-result");
            const list = document.querySelector(".search-result .list");

            // 显示加载动画
            list.innerHTML = `<div class="loading">
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
    </div>`;

            // 搜索处理
            const searchResults = await this.searchBilibiliVideo(keyword);
            list.innerHTML = "";

            searchResults.forEach((song, index) => {
                const div = this.uiManager.createSongElement(
                    {
                        title: song.title.replace(
                            /<em class="keyword">|<\/em>/g,
                            ""
                        ),
                        artist: song.artist,
                        poster: "https:" + song.pic,
                    },
                    song.bvid,
                    { isDelete: false, isLove: false }
                );

                // 点击事件处理
                div.addEventListener("click", async (e) => {
                    try {
                        // 这玩意有Bug，懒得修了，直接删（Doge）
                        // const loveBtn = e.target.closest('.love');
                        // if (loveBtn) {
                        //     e.stopPropagation();
                        //     if (loveBtn.querySelector("i").classList.contains('loved')) {
                        //         this.favoriteManager.removeFromFavorites(song, song.bvid);
                        //     } else {
                        //         this.favoriteManager.addToFavorites(song, song.bvid);
                        //     }
                        //     return ;
                        // }
                        const cleanTitle = song.title.replace(
                            /<em class="keyword">|<\/em>/g,
                            ""
                        );
                        if (this.playlistManager.playlist.find((item) => item.title === cleanTitle)) {
                            const existingIndex = this.playlistManager.playlist.findIndex(
                                (item) => item.title === cleanTitle
                            );
                            this.playlistManager.setPlayingNow(existingIndex);
                            document.querySelector("#function-list .player").click();
                            return;
                        }

                        const urls = await this.getAudioLink(song.bvid, true);
                        let url = urls[0];

                        try {
                            const res = await axios.get(url);
                            if (res.status === 403) {
                                url = urls[1];
                            }
                        } catch (error) {
                            url = urls[1];
                        }

                        const newSong = {
                            title: cleanTitle,
                            artist: song.artist,
                            audio: url,
                            poster: "https:" + song.pic,
                            bvid: song.bvid,
                            lyric: await this.getLyrics(keyword),
                        };

                        this.playlistManager.addSong(newSong);
                        this.playlistManager.setPlayingNow(
                            this.playlistManager.playlist.length - 1
                        );
                        this.uiManager.renderPlaylist();
                        document
                            .querySelector("#function-list .player")
                            .click();
                    } catch (error) {
                        console.error("添加歌曲失败:", error);
                    }
                });

                list.appendChild(div);
            });

            // 清理搜索框
            document.querySelector("#function-list span").style.display =
                "none";
            document.querySelector(".search input").value = "";
            document.querySelector(".search input").blur();
        } catch (error) {
            console.error("搜索失败:", error);
            const list = document.querySelector(".search-result .list");
            list.innerHTML = "搜索失败，请重试";
        }
    }

    async getAudioLink(videoId, isBvid = true) {
        // 获取CID直接调用API
        async function getCid(videoId, isBvid = true) {
            const params = isBvid ? `bvid=${videoId}` : `aid=${videoId}`;
            const response = await axios.get(
                `https://api.bilibili.com/x/web-interface/view?${params}`
            );

            const data = await response.data;
            if (data.code !== 0) {
                throw new Error(data.message || "获取视频信息失败");
            }
            return data.data.cid;
        }
        const cid = await getCid(videoId, isBvid);
        const params = isBvid
            ? `bvid=${videoId}&cid=${cid}&fnval=16&fnver=0&fourk=1`
            : `avid=${videoId}&cid=${cid}&fnval=16&fnver=0&fourk=1`;

        const response = await axios.get(
            `https://api.bilibili.com/x/player/playurl?${params}`
        );

        const data = await response.data;
        if (data.code !== 0) {
            throw new Error(data.message || "获取音频链接失败");
        }

        const audioStream = data.data.dash.audio;
        if (!audioStream || audioStream.length === 0) {
            throw new Error("未找到音频流");
        }

        const bestAudio = audioStream[0];
        return [bestAudio.baseUrl, bestAudio.backupUrl];
    }

    async getLyrics(songName) {
        try {
            const searchResponse = await search({
                keywords: songName,
                limit: 1,
            });
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
            return yrcLyrics.yrc
                ? yrcLyrics.yrc.lyric
                : yrcLyrics.lrc
                ? yrcLyrics.lrc.lyric
                : "暂无歌词，尽情欣赏音乐";
        } catch (error) {}
    }
}

// 歌词渲染类
class LyricsPlayer {
    constructor(lyricsString, audioElement) {
        this.lyricsContainer = document.getElementById("lyrics-container");
        this.lyricsContainer.innerHTML = "";
        this.parsedData = this.parseLyrics(lyricsString);
        this.audio = audioElement; // 保存audio引用
        this.activeLines = new Set();
        this.completedLines = new Set();
        this.animationFrame = null;

        // 监听audio事件
        this.audio.addEventListener("play", () => this.start());
        this.audio.addEventListener("pause", () => this.stop());
        this.audio.addEventListener("seeking", () => this.onSeek());

        this.init();
    }
    changeLyrics(newLyricsString) {
        // 清除现有状态
        this.stop();
        this.activeLines.clear();
        this.completedLines.clear();
        this.lyricsContainer.innerHTML = "";

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
        const div = document.createElement("div");
        div.className = "metadata";

        metadata.content.forEach((item) => {
            const span = document.createElement("span");
            span.textContent = item.tx;
            div.appendChild(span);
        });

        return div;
    }
    parseLyrics(lyricsString) {
        if (!lyricsString) {
            // 返回暂无歌词
            return [
                {
                    type: "lyric",
                    lineStart: 0,
                    lineDuration: 5000,
                    chars: [{ text: "暂无歌词", startTime: 0, duration: 5000 }],
                },
            ];
        }
        const lines = lyricsString.split("\n");
        const parsedData = [];

        // 从第一行开始判断，如果有是传统时间戳格式，则按照传统时间戳格式解析
        let isTraditionalFormat = 0;
        lines.forEach((line) => {
            if (line.match(/^\[\d{2}:\d{2}\.\d{2,3}\]/)) {
                isTraditionalFormat = 1;
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
                    const startTime =
                        (parseInt(mm) * 60 + parseInt(ss)) * 1000 +
                        parseInt(ms);

                    parsedData.push({
                        type: "lyric",
                        lineStart: startTime,
                        lineDuration: 10000, // 默认持续5秒
                        chars: [
                            {
                                text: text.trim(),
                                startTime: startTime,
                                duration: 5000,
                            },
                        ],
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
                    const charMatches = line.match(
                        /\((\d+),(\d+),\d+\)([^(]+)/g
                    );

                    if (timeMatch && charMatches) {
                        const lineStart = parseInt(timeMatch[1]);
                        const lineDuration = parseInt(timeMatch[2]);
                        const chars = [];

                        charMatches.forEach((charMatch) => {
                            const [_, startTime, duration, text] =
                                charMatch.match(/\((\d+),(\d+),\d+\)(.+)/);
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
        if (
            lyricData.chars.length === 1 &&
            lyricData.chars[0].text === lyricData.chars[0].text.trim()
        ) {
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

                    if (
                        currentTime >= charStartTime &&
                        currentTime <= charEndTime
                    ) {
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
                    chars.forEach((char) => {
                        char.classList.add("completed");
                        char.classList.remove("active");
                    });
                }
            }
        });

        const container = document.querySelector("#lyrics-container");
        const activeLyric = container.querySelector(".lyric-line.active");

        if (activeLyric) {
            const containerHeight = container.clientHeight;
            const lyricPosition = activeLyric.offsetTop;
            const lyricHeight = activeLyric.offsetHeight;
            const scrollPosition =
                lyricPosition - containerHeight / 2 + lyricHeight / 2;

            container.scrollTo({
                top: scrollPosition,
                behavior: "smooth",
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
        this.isMaximized = false;

        this.initializeEvents();
        this.initializePlayerControls();
        this.initializePageEvents();
    }

    initializePlayerControls() {
        // 进度条控制
        const progressBar = document.querySelector(".progress-bar");
        progressBar?.addEventListener("click", (e) => {
            const rect = progressBar.getBoundingClientRect();
            const percent = (e.clientX - rect.left) / rect.width;
            this.audioPlayer.audio.currentTime =
                percent * this.audioPlayer.audio.duration;
        });

        // 播放时更新进度条
        this.audioPlayer.audio.addEventListener("timeupdate", () => {
            const progress =
                (this.audioPlayer.audio.currentTime /
                    this.audioPlayer.audio.duration) *
                100;
            document.querySelector(
                ".progress-bar-inner"
            ).style.width = `${progress}%`;
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
            document
                .querySelector(".play i")
                .classList.remove("bi-play-circle-fill");
            document.querySelector(".play i").classList.add("bi-pause-circle");
        });

        this.audioPlayer.audio.addEventListener("pause", () => {
            document
                .querySelector(".play i")
                .classList.remove("bi-pause-circle");
            document
                .querySelector(".play i")
                .classList.add("bi-play-circle-fill");
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
        window.addEventListener("keydown", (e) => {
            if (e.key == "F12") {
                ipcRenderer.send("open-dev-tools");
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
                minimizeBtn.innerHTML = `<svg version="1.1" width="12" height="12" viewBox="0,0,37.65105,35.84556" style="margin-top:4px;"><g transform="translate(-221.17804,-161.33903)"><g style="stroke:var(--text);" data-paper-data="{&quot;isPaintingLayer&quot;:true}" fill="none" fill-rule="nonzero" stroke-width="2" stroke-linecap="butt" stroke-linejoin="miter" stroke-miterlimit="10" stroke-dasharray="" stroke-dashoffset="0"><path d="M224.68734,195.6846c-2.07955,-2.10903 -2.00902,-6.3576 -2.00902,-6.3576l0,-13.72831c0,0 -0.23986,-1.64534 2.00902,-4.69202c1.97975,-2.68208 4.91067,-2.00902 4.91067,-2.00902h14.06315c0,0 3.77086,-0.23314 5.80411,1.67418c2.03325,1.90732 1.33935,5.02685 1.33935,5.02685v13.39347c0,0 0.74377,4.01543 -1.33935,6.3576c-2.08312,2.34217 -5.80411,1.67418 -5.80411,1.67418h-13.39347c0,0 -3.50079,0.76968 -5.58035,-1.33935z"></path><path d="M229.7952,162.85325h16.06111c0,0 5.96092,-0.36854 9.17505,2.64653c3.21412,3.01506 2.11723,7.94638 2.11723,7.94638v18.55642"></path></g></g></svg>`;
            } else {
                minimizeBtn.innerHTML = `<i class="bi bi-app"></i>`;
            }
        });

        // 音频进度条
        this.audioPlayer.audio.addEventListener("timeupdate", () => {
            const progress =
                (this.audioPlayer.audio.currentTime /
                    this.audioPlayer.audio.duration) *
                100;
            document.querySelector(
                ".player .control .progress .progress-bar .progress-bar-inner"
            ).style.width = progress + "%";
        });

        // 进度条点击
        document
            .querySelector(".player .control .progress .progress-bar")
            .addEventListener("click", (event) => {
                const progressBar = event.currentTarget;
                const clickPosition = event.offsetX;
                const progressBarWidth = progressBar.offsetWidth;
                const progress =
                    (clickPosition / progressBarWidth) *
                    this.audioPlayer.audio.duration;
                this.audioPlayer.audio.currentTime = progress;
            });

        // 侧边栏点击事件
        document.addEventListener("click", (event) => {
            if (
                !event.target.closest(".sidebar") &&
                !event.target.closest(".dock.sidebar")
            ) {
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
                        aCheck.offsetTop -
                        allLinks[allLinks.length - 1].offsetTop +
                        5 +
                        "px";
                    spanFocs.style.left =
                        aCheck.offsetLeft - li.offsetLeft + "px";
                }

                setTimeout(() => {
                    spanFocs.classList.remove("cl");
                }, 500);
            });
        });

        // 搜索输入框事件
        document
            .querySelector(".search input")
            .addEventListener("keypress", (event) => {
                if (event.key === "Enter") {
                    this.handleSearch(event);
                }
            });

        // 主题切换事件
        document.querySelector(".dock.theme").addEventListener("click", () => {
            this.toggleTheme();
        });
    }

    async handleSearch(event) {
        const keyword = document.querySelector(".search input").value;
        if (!keyword) return;
        this.musicSearcher.searchMusic(keyword);
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
        document.querySelector("#listname").textContent =
            this.playlistManager.playlistName;
        const playlistElement = document.querySelector("#playing-list");
        playlistElement.innerHTML = "";

        this.playlistManager.playlist.forEach((song) => {
            const div = this.createSongElement(song, song.bvid, {
                isExtract: true,
            });

            div.addEventListener("click", (e) => {
                const loveBtn = e.target.closest(".love");
                const deleteBtn = e.target.closest(".delete");
                if (!loveBtn && !deleteBtn) {
                    const index = this.playlistManager.playlist.findIndex(
                        (item) => item.bvid === song.bvid
                    );
                    this.playlistManager.setPlayingNow(index, e);
                    document.querySelector("#function-list .player").click();
                }
                let songIndex = this.playlistManager.playlist.findIndex(
                    (item) => item.bvid === song.bvid
                );
                if (loveBtn) {
                    const song = this.playlistManager.playlist[songIndex];

                    if (
                        loveBtn.querySelector("i").classList.contains("loved")
                    ) {
                        this.favoriteManager.removeFromFavorites(song);
                    } else {
                        this.favoriteManager.addToFavorites(song);
                    }
                }
                if (deleteBtn) {
                    this.playlistManager.removeSong(song.bvid, e);
                    this.renderPlaylist();
                }
            });

            playlistElement.appendChild(div);
        });
    }
    createSongElement(
        song,
        bvid,
        { isLove = true, isDelete = true, isExtract = false } = {}
    ) {
        const div = document.createElement("div");
        div.classList.add("song");
        div.id = bvid;

        const isLoved = window.app.favoriteManager.lovelist.some(
            (item) => item.bvid === song.bvid
        );

        div.innerHTML = `
            <img class="poster" alt="Poster image">
            <div class="info">
                <div class="name"></div>
                <div class="artist"></div>
            </div>
            <div class="controls">
                ${
                    isLove
                        ? `<div class="love">
                    <i class="bi bi-heart${isLoved ? "-fill" : ""} ${
                              isLoved ? "loved" : ""
                          }"></i>
                </div>`
                        : ""
                }
                ${
                    isDelete
                        ? `<div class="delete">
                    <i class="bi bi-trash"></i>
                </div>`
                        : ""
                }
            </div>`;
        div.querySelector(".poster").src = song.poster;
        div.querySelector(".name").textContent = isExtract
            ? extractMusicTitle(song.title)
            : song.title;
        div.querySelector(".artist").textContent = song.artist;
        return div;
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
            this.lyricsPlayer = new LyricsPlayer(
                "暂无歌词，尽情欣赏音乐",
                this.audioPlayer.audio
            );

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
            this.favoriteManager = new FavoriteManager(
                this.playlistManager,
                this.uiManager
            );

            // 创建音乐搜索器
            this.musicSearcher = new MusicSearcher();

            // 更新组件间的引用
            this.audioPlayer.playlistManager = this.playlistManager;
            this.uiManager.playlistManager = this.playlistManager;
            this.uiManager.audioPlayer = this.audioPlayer;
            this.uiManager.favoriteManager = this.favoriteManager;
            this.uiManager.musicSearcher = this.musicSearcher;
            this.musicSearcher.uiManager = this.uiManager;
            this.musicSearcher.playlistManager = this.playlistManager;
            this.musicSearcher.favoriteManager = this.favoriteManager;

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
        const app = new App();
    } catch (error) {
        console.error("应用初始化失败:", error);
    }
});
