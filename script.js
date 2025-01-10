const axios = require("axios");
const md5 = require("md5");
const { lyric_new, search } = require(`NeteaseCloudMusicApi`);
const { ipcRenderer } = require('electron')

// 定义通用cookie
const COOKIE = 'buvid3=345D266D-19E4-1EEC-C9A7-B9286BA4A59239219infoc; b_nut=1736343139; b_lsid=6D51106107_194461DD0EA; _uuid=78482A2E-DDA8-6105B-D153-31644B61E4BA46742infoc; enable_web_push=DISABLE; buvid_fp=5857ee8e41c5baf5b68bc8aa557dba82; bmg_af_switch=0; buvid4=AFBA85E9-5DE9-5A3E-86F5-7390969CA3F256236-025010813-GdU%2F9LbW2GGlexArjkUUO07Mrv500PA9IZIciasB8SaOP7lEgvVgG0Ha4LbGI%2FyK; bili_ticket=eyJhbGciOiJIUzI1NiIsImtpZCI6InMwMyIsInR5cCI6IkpXVCJ9.eyJleHAiOjE3MzY2MDIzNTYsImlhdCI6MTczNjM0MzA5NiwicGx0IjotMX0.kDhXWhwKZZsjH4b3OD9DqQ2E5fx-ARS4tno7o9KJnr8; bili_ticket_expires=1736602296; CURRENT_FNVAL=2000; sid=6802awhl; home_feed_column=4; browser_resolution=825-927';

async function getBuvidValues() {
  return COOKIE; // 不能用在生产环境
}


// 搜索函数直接调用API
async function searchBilibiliVideo(keyword, search_type = "video", page = 1, order = "totalrank", duration = 0, tids = 0) {
  const mixinKeyEncTab = [
    46, 47, 18, 2, 53, 8, 23, 32, 15, 50, 10, 31, 58, 3, 45, 35,
    27, 43, 5, 49, 33, 9, 42, 19, 29, 28, 14, 39, 12, 38, 41, 13,
    37, 48, 7, 16, 24, 55, 40, 61, 26, 17, 0, 1, 60, 51, 30, 4,
    22, 25, 54, 21, 56, 59, 6, 63, 57, 62, 11, 36, 20, 34, 44, 52,
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

    // 添加 wts 字段
    params.wts = currTime;

    // 按 key 重排序并生成查询字符串
    const query = Object.keys(params)
      .sort()
      .map((key) => {
        const value = params[key].toString().replace(chrFilter, "");
        return `${encodeURIComponent(key)}=${encodeURIComponent(value)}`;
      })
      .join("&");

    // 计算 w_rid
    const wbiSign = md5(query + mixinKey);
    return `${query}&w_rid=${wbiSign}`;
  }

  // 获取Wbi Keys直接调用API
  async function getWbiKeys() {
    const response = await axios.get("https://api.bilibili.com/x/web-interface/nav");
    const { wbi_img: { img_url, sub_url } } = response.data.data;

    return {
      img_key: img_url.slice(img_url.lastIndexOf("/") + 1, img_url.lastIndexOf(".")),
      sub_key: sub_url.slice(sub_url.lastIndexOf("/") + 1, sub_url.lastIndexOf("."))
    };
  }
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


  const response = await axios.get(`https://api.bilibili.com/x/web-interface/wbi/search/type?${query}`);

  return response.data.data.result;
}



// 获取音频链接直接调用API
async function getAudioLink(videoId, isBvid = true) {
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
// 搜索歌曲并获取歌词与逐字歌词的函数
async function getLyrics(songName) {
  try {
    // 1. 搜索歌曲
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
    // 如果有yrcLyrics.yrc就返回yrcLyrics.yrc.lyric，否则有lrc返回lrc.lyric，否则返回暂无歌词，尽情欣赏音乐
    return yrcLyrics.yrc ? yrcLyrics.yrc.lyric : yrcLyrics.lrc ? yrcLyrics.lrc.lyric : "暂无歌词，尽情欣赏音乐";
  } catch (error) {
  }
}
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

        // 行状态处理保持不变...
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

    // 滚动逻辑保持不变...
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


// 一些数据
let ruleslink =
  "https://api.github.com/repos/NB-blank-space/Music-APIs/contents/Music-APIs.js";
let rules = {};

// 播放控制
let audio = new Audio();
audio.autoplay = false;
audio.loop = false;
audio.volume = 0.5;
audio.addEventListener("ended", () => {
  if (audio.loop) {
    audio.currentTime = 0;
    audio.play();
  } else {
    next();
  }
});
const player = new LyricsPlayer("无歌词，请欣赏音乐", audio);

// // 检查 localStorage 中是否有缓存的数据
// const cachedRules = localStorage.getItem("rules");
// if (cachedRules) {
//   rules = JSON.parse(cachedRules);
// } else {
//   axios.get(ruleslink)
//     .then((response) => {
//       if (!response.ok) {
//         throw new Error("Failed to axios.get file: " + response.status);
//       }
//       return response.json();
//     })
//     .then((data) => {
//       const base64Content = data.content;
//       const decodedContent = atob(base64Content);
//       rules = JSON.parse(decodedContent);
//       // 将数据缓存到 localStorage
//       localStorage.setItem("rules", JSON.stringify(rules));
//     })
//     .catch((error) => {
//       console.error("Error:", error);
//     });
// }

let playlist = [
  {
    title: "NB Music",
    artist: "NB-group",
    audio: "",
    poster: "./img/NB_Music.png",
    lyric: ""
  },
];
let playlistName = "默认歌单";
let love = {
  title: "NB Music",
  artist: "NB-group",
  audio: "",
  poster: "./img/NB_Music.png",
};

let playingNow = 0;
//END
function changePlaylistName(name) {
  playlistName = name;
  localStorage.setItem('nbmusic_playlistname', name);
  renderPlaylist();
}

async function setPlayingNow(index) {
  player.changeLyrics(playlist[index].lyric);
  playingNow = index;
  document.documentElement.style.setProperty(
    "--bgul",
    "url(" + playlist[playingNow].poster + ")"
  );
  document.querySelector(".player-content .cover .cover-img").src = playlist[playingNow].poster;
  document.querySelector(".player .info .title").textContent =
    playlist[playingNow].title;
  document.querySelector(".player .info .artist").textContent =
    playlist[playingNow].artist;
  document.querySelector(
    ".player .control .progress .progress-bar .progress-bar-inner"
  ).style.width = "0%";
  let songs = document.querySelectorAll(".list .song");
  for (let i = 0; i < songs.length; i++) {
    songs[i].classList.remove("playing");
  }
  songs[playingNow].classList.add("playing");
  audio.src = playlist[playingNow].audio;
  try {
    await audio.play();
    document.querySelector(".player .control .play i").classList =
      "bi bi-pause-circle";
  } catch (error) {
    document.querySelector(".player .control .play i").classList =
      "bi bi-play-circle-fill";
  }
  localStorage.setItem('nbmusic_playlist', JSON.stringify(playlist));
}

function delete_song(index) {
  document.querySelector(`#playing-list [id="${index}"]`)?.remove();

  playlist.splice(index, 1);
  if (index == playingNow) {
    if (index == playlist.length) {
      setPlayingNow(0);
    } else {
      setPlayingNow(index);
    }
  } else if (index < playingNow) {
    setPlayingNow(playingNow - 1);
  }
  setTimeout(() => {
    renderPlaylist();
  }, 1000);
}
function renderPlaylist() {
  document.querySelector("#listname").textContent = playlistName;

  document.querySelector("#playing-list").innerHTML = "";
  playlist.forEach((song, index) => {
    let div = document.createElement("div");
    div.classList.add("song");
    div.id = index;
    div.innerHTML =
      `<img class="poster" alt="Poster image">
      <div class="info">
        <div class="name"></div>
        <div class="artist"></div>
      </div>
      <div class="controls">
        <div class="delete" onclick="delete_song(${index})"><i class="bi bi-trash"></i></div>
      </div>`;
    div.querySelector(".poster").src = song.poster;
    div.querySelector(".name").textContent = song.title;
    div.querySelector(".artist").textContent = song.artist;
    div.addEventListener("click", () => {
      setPlayingNow(index);
      let songs = document.querySelectorAll(".song");
      for (let i = 0; i < songs.length; i++) {
        songs[i].classList.remove("playing");
      }
      div.classList.add("playing");
    });
    document.querySelector("#playing-list").appendChild(div);
  });
}

function show(name) {
  let contents = document.querySelectorAll(".content>div");
  for (let i = 0; i < contents.length; i++) {
    contents[i].classList.add("hide");
  }
  let checks = document.querySelectorAll("#function-list>a");
  for (let i = 0; i < checks.length; i++) {
    checks[i].classList.remove("check");
  }
  document.querySelector(".content " + name).classList.remove("hide");
  try {
    document.querySelector("#function-list " + name).classList.add("check");
  } catch (e) { }
}

function toggletheme() {
  document.querySelector(".dock.theme").classList.toggle("dk");
  let darkControl = document.querySelector("#control .btn4 .icon");
  document.documentElement.classList.toggle("dark");

  if (document.documentElement.classList.contains("dark")) {
    setData("theme", "dark");
    isDark = true;
  } else {
    setData("theme", "light");
    isDark = false;
  }
}
// END

function setData(k, v) {
  localStorage.setItem(k, v);
}

function prev() {
  if (playingNow > 0) {
    setPlayingNow(playingNow - 1);
  }
}
function next() {
  if (playingNow < playlist.length - 1) {
    setPlayingNow(playingNow + 1);
  }
}

function play() {
  if (audio.paused) {
    try {
      audio.play();
      document.querySelector(".player .control .play i").classList =
        "bi bi-pause-circle";
    } catch (e) {
      document.querySelector(".player .control .play i").classList =
        "bi bi-play-circle-fill";
    }
  } else {
    audio.pause();
    document.querySelector(".player .control .play i").classList =
      "bi bi-play-circle-fill";
  }
}

// END

// 音乐相关功能
async function search_music(event) {
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
      searchResults.forEach((song,index) => {
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

document.addEventListener("DOMContentLoaded", function () {
  const savedPlaylist = localStorage.getItem('nbmusic_playlist');
  const savedPlaylistName = localStorage.getItem('nbmusic_playlistname');

  if (savedPlaylist) {
    playlist = JSON.parse(savedPlaylist);
  }
  if (savedPlaylistName) {
    playlistName = savedPlaylistName;
  }
  document.getElementById('minimize').addEventListener('click', () => {
    ipcRenderer.send('window-minimize')
  })
  
  document.getElementById('maximize').addEventListener('click', () => {
    ipcRenderer.send('window-maximize') 
  })
  
  document.getElementById('close').addEventListener('click', () => {
    ipcRenderer.send('window-close')
  })
  
  setTimeout(() => {
    document.querySelector(".loading").style.opacity = "0";
  }, 1000);
  setTimeout(() => {
    document.querySelector(".loading").style.display = "none";
  }, 2000);
  audio.addEventListener("timeupdate", () => {
    let progress = (audio.currentTime / audio.duration) * 100;
    document.querySelector(
      ".player .control .progress .progress-bar .progress-bar-inner"
    ).style.width = progress + "%";
  });

  document
    .querySelector(".player .control .progress .progress-bar")
    .addEventListener("click", (event) => {
      const progressBar = event.currentTarget;
      const clickPosition = event.offsetX;
      const progressBarWidth = progressBar.offsetWidth;
      const progress = (clickPosition / progressBarWidth) * audio.duration; // 计算点击位置对应的播放时间
      audio.currentTime = progress;
    });

  // 页面渲染
  // 当点击除了sidebar以外的位置时，sidebar会收起
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

  // list左边的小条条
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
        setTimeout(() => {
          spanFocs.classList.remove("cl");
        }, 500);
      } else {
        spanFocs.classList.add("cl");
        spanFocs.style.top =
          aCheck.offsetTop - allLinks[allLinks.length - 1].offsetTop + 5 + "px";
        spanFocs.style.left = aCheck.offsetLeft - li.offsetLeft + "px";
        setTimeout(() => {
          spanFocs.classList.remove("cl");
        }, 500);
      }
    });
  });

  renderPlaylist();
  setPlayingNow(playingNow);

  let isDark = localStorage.getItem("theme") == "dark";
  if (isDark) {
    toggletheme();
  }
});
