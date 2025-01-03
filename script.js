document.addEventListener('DOMContentLoaded', function () {
  // 一些数据
  let ruleslink = "https://api.github.com/repos/NB-blank-space/Music-APIs/contents/Music-APIs.json";
  let rules = {};

  // 检查 localStorage 中是否有缓存的数据
  const cachedRules = localStorage.getItem('rules');
  if (cachedRules) {
    rules = JSON.parse(cachedRules);
  } else {
    fetch(ruleslink)
      .then(response => {
        if (!response.ok) {
          throw new Error("Failed to fetch file: " + response.status);
        }
        return response.json();
      })
      .then(data => {
        const base64Content = data.content;
        const decodedContent = atob(base64Content);
        rules = JSON.parse(decodedContent);
        // 将数据缓存到 localStorage
        localStorage.setItem('rules', JSON.stringify(rules));
      })
      .catch(error => {
        console.error("Error:", error);
      });
  }


  let playlist = [
    {
      title: 'NB Music',
      artist: 'NB-group',
      audio: '',
      poster: './img/NB_Music.png'
    }
  ]
  let playlistName = "默认歌单";
  let love = {
    title: 'NB Music',
    artist: 'NB-group',
    audio: '',
    poster: './img/NB_Music.png'
  }

  let playingNow = 0;
  //END

  // 播放控制
  let audio = new Audio();
  audio.autoplay = false;
  audio.loop = false;
  audio.volume = 0.5;
  audio.addEventListener('ended', () => {
    if (audio.loop) {
      audio.currentTime = 0;
      audio.play();
    } else {
      next();
    }
  });
  audio.addEventListener('timeupdate', () => {
    let progress = (audio.currentTime / audio.duration) * 100;
    document.querySelector('.player .control .progress .progress-bar .progress-bar-inner').style.width = progress + '%';
  });

  document.querySelector('.player .control .progress .progress-bar').addEventListener('click', (event) => {
    const progressBar = event.currentTarget;
    const clickPosition = event.offsetX;
    const progressBarWidth = progressBar.offsetWidth;
    const progress = (clickPosition / progressBarWidth) * audio.duration;  // 计算点击位置对应的播放时间
    audio.currentTime = progress;
  });
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
        document.querySelector('.player .control .play i').classList = "bi bi-pause-circle";
      } catch (e) {
        document.querySelector('.player .control .play i').classList = "bi bi-play-circle-fill";
      }
    } else {
      audio.pause();
      document.querySelector('.player .control .play i').classList = "bi bi-play-circle-fill";
    }
  }

  // END

  // 音乐相关功能
  function getSongLyrics(name) {

  }
  async function search(event) {
    if (event.key === 'Enter') {
      let keyword = document.querySelector('.search input').value;
      show('.search-result');
      document.querySelector('.search-result .list').innerHTML = `
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
        let searchRules = rules['Search rules'];
        let searchResults = [];
        for (let i = 0; i < searchRules.length; i++) {
          let rule = searchRules[i][Object.keys(searchRules[i])[0]];
          eval(rule.join('\n'));
          let res = await main(keyword);
          res.source = Object.keys(searchRules[i])[0];
          searchResults.push(res);
        }
        let list = document.querySelector('.search-result .list');
        list.innerHTML = '';
        searchResults.forEach((source, index) => {
          source.forEach((song, index) => {
            let div = document.createElement('div');
            div.classList.add('song');
            div.innerHTML = '<img class="poster" alt="Poster image"><div class="info"><div class="name"></div><div class="artist"></div></div><div class="controls"><div class="love" onclick="love()"><i class="bi bi-heart"></i></div><div class="play" onclick="play()"><i class="bi bi-play-circle"></i></div><div class="add2list" onclick="add2list()"><i class="bi bi-plus-circle"></i></div></div>';
            div.querySelector('.poster').src = "https:" + song.pic;
            div.querySelector('.name').textContent = song.title.replace(/<em class="keyword">|<\/em>/g, '');
            div.querySelector('.artist').textContent = song.artist;
            div.addEventListener('click', async () => {
              if (playlist.find((item) => item.title == song.title.replace(/<em class="keyword">|<\/em>/g, ''))) {
                return;
              }
              let urlrules = rules["Music link"];
              let urlrule = urlrules.find((item) => {
                return Object.keys(item)[0] == source.source;
              });
              eval(urlrule[source.source].join('\n'));
              let urls = await main(song.bvid);
              // 向url[0]发送get请求，检查是否403，决定url = url[0]还是url[1]。
              let url = urls[0];
              try {
                let res = await fetch(url);
                if (res.status == 403) {
                  url = urls[1];
                }
              } catch (error) {
                url = urls[1];
              }

              playlist.push({ title: song.title.replace(/<em class="keyword">|<\/em>/g, ''), artist: song.artist, audio: url, poster: "https:" + song.pic });
              setPlayingNow(playlist.length - 1);
              renderPlaylist();
              document.querySelector('.player').click();
            });
            list.appendChild(div);
          });
        });
        document.querySelector('#function-list span').style.display = 'none';
        document.querySelector('.search input').value = '';
        document.querySelector('.search input').blur();
      }
    }
  }

  // 页面渲染
  // 当点击除了sidebar以外的位置时，sidebar会收起
  document.addEventListener('click', (event) => {
    if (!event.target.closest('.sidebar') && !event.target.closest('.dock.sidebar')) {
      document.querySelector('.sidebar').classList.add('hide');
    }
  });
  document.querySelector('.sidebar').addEventListener('mouseover', () => {
    document.querySelector('.sidebar').classList.remove('hide');
  });

  async function setPlayingNow(index) {
    playingNow = index;
    document.documentElement.style.setProperty('--bgul', 'url(' + playlist[playingNow].poster + ')');
    document.querySelector('.cover-img').src = playlist[playingNow].poster;
    document.querySelector('.player .info .title').textContent = playlist[playingNow].title;
    document.querySelector('.player .info .artist').textContent = playlist[playingNow].artist;
    document.querySelector('.player .control .progress .progress-bar .progress-bar-inner').style.width = '0%';
    let songs = document.querySelectorAll('.list .song');
    for (let i = 0; i < songs.length; i++) {
      songs[i].classList.remove('playing');
    }
    songs[playingNow].classList.add('playing');
    audio.src = playlist[playingNow].audio;
    try {
      await audio.play();
      document.querySelector('.player .control .play i').classList = "bi bi-pause-circle";
    } catch (error) {
      document.querySelector('.player .control .play i').classList = "bi bi-play-circle-fill";
    }
  }

  function renderPlaylist() {
    document.querySelector('#listname').textContent = playlistName;

    document.querySelector('#playing-list').innerHTML = '';
    playlist.forEach((song, index) => {
      let div = document.createElement('div');
      div.classList.add('song');
      div.innerHTML = '<img class="poster" alt="Poster image"><div class="info"><div class="name"></div><div class="artist"></div></div>';
      div.querySelector('.poster').src = song.poster;
      div.querySelector('.name').textContent = song.title;
      div.querySelector('.artist').textContent = song.artist;
      div.addEventListener('click', () => {
        setPlayingNow(index);
        let songs = document.querySelectorAll('.song');
        for (let i = 0; i < songs.length; i++) {
          songs[i].classList.remove('playing');
        }
        div.classList.add('playing');
      });
      document.querySelector('#playing-list').appendChild(div);
    });
  }
  renderPlaylist();
  setPlayingNow(playingNow);


  function show(name) {
    let contents = document.querySelectorAll('.content>div');
    for (let i = 0; i < contents.length; i++) {
      contents[i].classList.add('hide');
    }
    let checks = document.querySelectorAll('#function-list>a');
    for (let i = 0; i < checks.length; i++) {
      checks[i].classList.remove('check');
    }
    document.querySelector('.content ' + name).classList.remove('hide');
    try {
      document.querySelector('#function-list ' + name).classList.add('check');
    } catch (e) {
    }
  }

  let isDark = localStorage.getItem('theme') == 'dark';
  if (isDark) {
    toggletheme();
  }

  function toggletheme() {
    document.querySelector('.dock.theme').classList.toggle('dk');
    let darkControl = document.querySelector('#control .btn4 .icon');
    document.documentElement.classList.toggle('dark');

    if (document.documentElement.classList.contains('dark')) {
      setData('theme', 'dark');
      isDark = true;
    } else {
      setData('theme', 'light');
      isDark = false;
    }
  }
  // END

  function setData(k, v) {
    localStorage.setItem(k, v);
  }

  // list左边的小条条
  document.querySelectorAll('.list.focs').forEach(li => {
    li.addEventListener('click', () => {
      let spanFocs = li.querySelectorAll('span.focs')[0],
        aCheck = li.querySelectorAll('a.check')[0],
        allLinks = li.querySelectorAll('a');
      spanFocs.style.display = 'block';
      if (spanFocs.dataset.type == 'abs') {
        spanFocs.classList.add('cl');
        spanFocs.style.top = (aCheck.getBoundingClientRect().top - li.parentElement.getBoundingClientRect().top) + 'px';
        setTimeout(() => {
          spanFocs.classList.remove('cl');
        }, 500);
      }
      else {
        spanFocs.classList.add('cl');
        spanFocs.style.top = (aCheck.offsetTop - allLinks[allLinks.length - 1].offsetTop + 5) + 'px';
        spanFocs.style.left = (aCheck.offsetLeft - li.offsetLeft) + 'px';
        setTimeout(() => {
          spanFocs.classList.remove('cl');
        }, 500);
      }
    });
  });


  // show(".search-result");
});