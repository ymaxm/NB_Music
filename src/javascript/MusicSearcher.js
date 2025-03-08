const axios = require("axios");
const md5 = require("md5");
const { lyric_new, search } = require("NeteaseCloudMusicApi");

// 音乐搜索类
class MusicSearcher {
    constructor() {
        this.COOKIE = "";
        this.settingManager = null; // 将由外部设置
    }

    // 新增：设置依赖
    setDependencies(settingManager) {
        this.settingManager = settingManager;
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
            // 获取 wbi keys 等辅助处理…
            const { img_key, sub_key } = await getWbiKeys();
            const params = {
                search_type: "video",
                keyword,
                order,
                duration,
                tids,
                page  // 使用传入的页码
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
    async searchMusic(keyword, page = 1) {
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
            const searchResults = await this.searchBilibiliVideo(keyword, page);
            list.innerHTML = "";

            if (!searchResults.length) {
                list.innerHTML = "未找到相关内容";
                return;
            }

            // 渲染搜索结果
            searchResults.forEach((song) => {
                // 确保获取作者信息
                const authorName = song.author || "未知艺术家";
                
                const div = this.uiManager.createSongElement(
                    {
                        title: song.title.replace(/<em class="keyword">|<\/em>/g, ""),
                        artist: authorName,
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

                        // 先切换到播放器界面
                        document.querySelector("#function-list .player").click();

                        // 预先设置基本信息，确保包含作者信息
                        const songInfo = {
                            title: cleanTitle,
                            artist: authorName,
                            poster: "https:" + song.pic,
                            bvid: song.bvid,
                            lyric: "等待获取歌词",
                        };
                        await this.playlistManager.updateUIForCurrentSong(songInfo);

                        // 设置加载状态
                        const playButton = document.querySelector(".control>.buttons>.play");
                        const progressBar = document.querySelector(".progress-bar-inner");
                        playButton.disabled = true;
                        progressBar.classList.add('loading');

                        // 获取音频URL等信息
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

                        // 完成加载，创建完整的歌曲对象
                        const videoUrl = await this.getBilibiliVideoUrl(song.bvid, urls[2]);
                        const newSong = {
                            ...songInfo,
                            audio: url,
                            cid: urls[2],
                            video: videoUrl,
                            lyric: await (this.settingManager.getSetting('lyricSearchType') === 'custom'
                                ? this.showLyricSearchDialog(cleanTitle)
                                : this.getLyrics(keyword))
                        };

                        // 恢复界面状态
                        progressBar.classList.remove('loading');
                        playButton.disabled = false;

                        // 添加到播放列表并播放
                        this.playlistManager.addSong(newSong);
                        this.playlistManager.setPlayingNow(this.playlistManager.playlist.length - 1);
                        this.uiManager.renderPlaylist();

                    } catch (error) {
                        console.error("添加歌曲失败:", error);
                    }
                });
                list.appendChild(div);
            });

            // 创建分页控制
            const paginationContainer = document.createElement('div');
            paginationContainer.className = 'pagination';

            // 上一页按钮
            if (page > 1) {
                const prevBtn = document.createElement('button');
                prevBtn.className = 'pagination-btn';
                prevBtn.innerHTML = '<i class="bi bi-chevron-left"></i> 上一页';
                prevBtn.onclick = () => this.searchMusic(keyword, page - 1);
                paginationContainer.appendChild(prevBtn);
            }

            // 页码显示
            const pageInfo = document.createElement('span');
            pageInfo.className = 'page-info';
            pageInfo.textContent = `第 ${page} 页`;
            paginationContainer.appendChild(pageInfo);

            // 下一页按钮
            const nextBtn = document.createElement('button');
            nextBtn.className = 'pagination-btn';
            nextBtn.innerHTML = '下一页 <i class="bi bi-chevron-right"></i>';
            nextBtn.onclick = () => this.searchMusic(keyword, page + 1);
            paginationContainer.appendChild(nextBtn);

            // 添加分页控制到搜索结果区域
            list.appendChild(paginationContainer);

        } catch (error) {
            console.error("搜索失败:", error);
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
            // 获取用户设置的视频清晰度，默认为720P
            let quality = 64; // 默认720P
            
            if (this.settingManager) {
                quality = this.settingManager.getSetting('videoQuality') || 64;
            }
            
            // 根据清晰度判断是否启用4K和其他高级功能
            const fourk = quality >= 120 ? 1 : 0;
            
            // 设置fnval，根据需要的功能组合不同的值
            let fnval = 16; // 基本DASH格式
            if (quality === 125) {
                fnval |= 64; // 需要HDR视频
            } else if (quality === 126) {
                fnval |= 512; // 需要杜比视界
            } else if (quality === 127) {
                fnval |= 1024; // 需要8K分辨率
            }

            const response = await fetch(`https://api.bilibili.com/x/player/playurl?bvid=${bvid}&cid=${cid}&qn=${quality}&fnval=${fnval}&fnver=0&fourk=${fourk}`, {
                // 继续使用现有的请求配置
            });

            if (!response.ok) {
                throw new Error('获取视频URL失败');
            }

            const data = await response.json();

            if (data.code !== 0) {
                throw new Error(data.message);
            }

            // 解析并选择最佳视频流
            const dashData = data.data.dash;
            if (dashData && dashData.video && dashData.video.length > 0) {
                // 根据清晰度选择最佳视频流
                return this.selectBestVideoStream(dashData.video, quality);
            } else {
                // 如果没有DASH格式，尝试使用durl（旧格式）
                if (data.data.durl && data.data.durl.length > 0) {
                    return data.data.durl[0].url;
                }
                throw new Error('无可用视频流');
            }
        } catch (error) {
            console.error('获取B站视频URL失败:', error);
            return null;
        }
    }

    // 新增：选择最佳视频流
    selectBestVideoStream(videoStreams, preferredQuality) {
        // 首先按质量(id)降序排序
        videoStreams.sort((a, b) => b.id - a.id);
        
        // 找出不超过用户设置清晰度的最高质量流
        for (let stream of videoStreams) {
            // 如果流的质量小于等于用户首选质量，选择它
            if (stream.id <= preferredQuality) {
                return stream.baseUrl || stream.base_url;
            }
        }
        
        // 如果没找到合适的，返回可用的最高质量
        return videoStreams[0].baseUrl || videoStreams[0].base_url;
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
    async getSearchSuggestions(term) {
        if (!term) return [];

        try {
            const params = {
                term,
                main_ver: "v1",
                func: "suggest",
                suggest_type: "accurate",
                sub_type: "tag",
                tag_num: 10,
                rnd: Math.random()
            };

            const response = await axios.get("https://s.search.bilibili.com/main/suggest", { params });

            if (response.data?.code === 0 && response.data?.result?.tag) {
                return response.data.result.tag;
            }
            return [];
        } catch (error) {
            console.error("获取搜索建议失败:", error);
            return [];
        }
    }
}

module.exports = MusicSearcher;
