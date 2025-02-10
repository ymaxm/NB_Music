const axios = require("axios");
const md5 = require("md5");
const { lyric_new, search } = require("NeteaseCloudMusicApi");

// 音乐搜索类
class MusicSearcher {
    constructor() {
        this.COOKIE = "";
    }
    async searchBilibiliVideo(keyword, page = 1, order = "totalrank", duration = 0, tids = 0) {
        const mixinKeyEncTab = [46, 47, 18, 2, 53, 8, 23, 32, 15, 50, 10, 31, 58, 3, 45, 35, 27, 43, 5, 49, 33, 9, 42, 19, 29, 28, 14, 39, 12, 38, 41, 13, 37, 48, 7, 16, 24, 55, 40, 61, 26, 17, 0, 1, 60, 51, 30, 4, 22, 25, 54, 21, 56, 59, 6, 63, 57, 62, 11, 36, 20, 34, 44, 52];

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
                    return `${encodeURIComponent(key)}=${encodeURIComponent(value)}`;
                })
                .join("&");

            const wbiSign = md5(query + mixinKey);
            return `${query}&w_rid=${wbiSign}`;
        }

        async function getWbiKeys() {
            const response = await axios.get("https://api.bilibili.com/x/web-interface/nav");
            const {
                wbi_img: { img_url, sub_url }
            } = response.data.data;

            return {
                img_key: img_url.slice(img_url.lastIndexOf("/") + 1, img_url.lastIndexOf(".")),
                sub_key: sub_url.slice(sub_url.lastIndexOf("/") + 1, sub_url.lastIndexOf("."))
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
                page
            };
            const query = encWbi(params, img_key, sub_key);

            const response = await axios.get(`https://api.bilibili.com/x/web-interface/wbi/search/type?${query}`);

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

            searchResults.forEach((song) => {
                const div = this.uiManager.createSongElement(
                    {
                        title: song.title.replace(/<em class="keyword">|<\/em>/g, ""),
                        artist: song.artist,
                        poster: "https:" + song.pic
                    },
                    song.bvid,
                    { isDelete: false, isLove: false }
                );

                // 点击事件处理
                div.addEventListener("click", async () => {
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
                        const cleanTitle = song.title.replace(/<em class="keyword">|<\/em>/g, "");
                        if (this.playlistManager.playlist.find((item) => item.title === cleanTitle)) {
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
                        } catch {
                            url = urls[1];
                        }

                        const videoUrl = await this.getBilibiliVideoUrl(song.bvid, urls[2]);
                        const newSong = {
                            title: cleanTitle,
                            artist: song.artist,
                            audio: url,
                            poster: "https:" + song.pic,
                            bvid: song.bvid,
                            cid: urls[2],
                            video: videoUrl,
                            // 根据设置决定是否显示歌词搜索对话框
                            lyric: await (this.settingManager.getSetting('lyricSearchType') === 'custom' 
                                ? this.showLyricSearchDialog(cleanTitle)
                                : this.getLyrics(keyword))
                        };

                        this.playlistManager.addSong(newSong);
                        this.playlistManager.setPlayingNow(this.playlistManager.playlist.length - 1);
                        this.uiManager.renderPlaylist();
                        document.querySelector("#function-list .player").click();
                    } catch (error) {
                        console.error("添加歌曲失败:", error);
                    }
                });

                list.appendChild(div);
            });

            // 清理搜索框
            document.querySelector("#function-list span").style.display = "none";
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
            const response = await axios.get(`https://api.bilibili.com/x/web-interface/view?${params}`);

            const data = await response.data;
            if (data.code !== 0) {
                throw new Error(data.message || "获取视频信息失败");
            }
            return data.data.cid;
        }
        const cid = await getCid(videoId, isBvid);
        const params = isBvid ? `bvid=${videoId}&cid=${cid}&fnval=16&fnver=0&fourk=1` : `avid=${videoId}&cid=${cid}&fnval=16&fnver=0&fourk=1`;

        const response = await axios.get(`https://api.bilibili.com/x/player/playurl?${params}`);

        const data = await response.data;
        if (data.code !== 0) {
            throw new Error(data.message || "获取音频链接失败");
        }

        const audioStream = data.data.dash.audio;
        if (!audioStream || audioStream.length === 0) {
            throw new Error("未找到音频流");
        }

        const bestAudio = audioStream[0];
        return [bestAudio.baseUrl, bestAudio.backupUrl, cid];
    }

    async getLyrics(songName) {
        try {
            const searchResponse = await search({
                keywords: songName,
                limit: 1
            });
            const searchResult = searchResponse.body;
            if (!searchResult.result || !searchResult.result.songs || searchResult.result.songs.length === 0) {
                return "暂无歌词，尽情欣赏音乐";
            }

            const songId = searchResult.result.songs[0].id;

            const yrcResponse = await lyric_new({ id: songId });

            if (!yrcResponse.body) {
                return "暂无歌词，尽情欣赏音乐";
            }
            const yrcLyrics = yrcResponse.body;
            return yrcLyrics.yrc ? yrcLyrics.yrc.lyric : yrcLyrics.lrc ? yrcLyrics.lrc.lyric : "暂无歌词，尽情欣赏音乐";
        } catch {
            /* empty */
        }
    }
    async getBilibiliVideoUrl(bvid, cid) {
        try {
            const response = await fetch(`https://api.bilibili.com/x/player/playurl?bvid=${bvid}&cid=${cid}&qn=0&fnval=80&fnver=0&fourk=1`, {
 
            });
            
            if (!response.ok) {
                throw new Error('获取视频URL失败');
            }
            
            const data = await response.json();
            
            if (data.code !== 0) {
                throw new Error(data.message);
            }
            
            // 返回第一个可用的视频URL
            return data.data.dash.video[0].baseUrl;
        } catch (error) {
            console.error('获取B站视频URL失败:', error);
            return null;
        }
    }
    async showLyricSearchDialog(songTitle) {
        return new Promise((resolve) => {
            const dialog = document.getElementById('lyricSearchDialog');
            const titleDiv = document.getElementById('currentSongTitle');
            const keywordInput = document.getElementById('lyricKeyword');
            const skipBtn = document.getElementById('skipLyric');
            const confirmBtn = document.getElementById('confirmLyric');
    
            // 显示当前歌曲信息
            titleDiv.textContent = songTitle;
            keywordInput.value = songTitle;
            dialog.classList.remove('hide');
    
            const handleSkip = () => {
                cleanup();
                resolve("暂无歌词，尽情欣赏音乐");
            };
    
            const handleConfirm = async () => {
                const keyword = keywordInput.value.trim();
                cleanup();
                if (keyword) {
                    try {
                        const lyric = await this.getLyrics(keyword);
                        resolve(lyric);
                    } catch (error) {
                        resolve("暂无歌词，尽情欣赏音乐");
                    }
                } else {
                    resolve("暂无歌词，尽情欣赏音乐");
                }
            };
    
            const handleKeydown = (e) => {
                if (e.key === 'Enter') {
                    handleConfirm();
                } else if (e.key === 'Escape') {
                    handleSkip();
                }
            };
    
            const cleanup = () => {
                dialog.classList.add('hide');
                skipBtn.removeEventListener('click', handleSkip);
                confirmBtn.removeEventListener('click', handleConfirm);
                keywordInput.removeEventListener('keydown', handleKeydown);
            };
    
            skipBtn.addEventListener('click', handleSkip);
            confirmBtn.addEventListener('click', handleConfirm);
            keywordInput.addEventListener('keydown', handleKeydown);
    
            // 聚焦输入框
            keywordInput.focus();
            keywordInput.select();
        });
    }
}

module.exports = MusicSearcher;
