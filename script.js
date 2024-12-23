// 一些数据
let ruleslink = "https://api.github.com/repos/NB-blank-space/Music-APIs/contents/Music-APIs.json"
let rules = {};
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
  })
  .catch(error => {
    console.error("Error:", error);
  });



let playlist = [
  {
    title: 'NB Music',
    artist: 'NB-group',
    audio: 'https://m704.music.126.net/20241220203640/b7f57fde525457adbf34bc66e8cdd796/jdyyaac/obj/w5rDlsOJwrLDjj7CmsOj/35834293548/84df/39f7/2573/e39332fa5dc611211bc76ca2dda5f79b.m4a?vuutv=cLQH5ZJKZVK4gXGjLpRER4Mtc7qwKnwaQmlE4Ukoc2lzYIahH58gfKnhesgOgB4Xrro8FUCpYOSSSK4MfsigKYMEw+5dJe9k8me8GWu8nQU=&authSecret=00000193e3fb09b917b20a3b1dab120f',
    poster: './img/NB_Music.png'
  }
]
let playlistName = "默认歌单";
let love = {
  title: 'NB Music',
  artist: 'NB-group',
  audio: '',
  poster: './NB_Music.png'
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
    audio.play();
    document.querySelector('.player .control .play i').classList="bi bi-pause-circle";
  } else {
    audio.pause();
    document.querySelector('.player .control .play i').classList="bi bi-play-circle-fill";
  }
}

// END

// 搜索
function search(event){
  if (event.key === 'Enter') {
    let keyword = document.querySelector('.search input').value;
    if (keyword) {
      let searchRules = rules['Search rules'];
      // {
      //   "Search rules":[
      //     {
      //      "Wangyi Cloud": "
      //      function(keyword){
      //      
      //       }"
      //     }
      //   ]
      // }
      let searchResults = [];
      for (let i = 0; i < searchRules.length; i++) {
      }

      document.querySelector('#function-list span').style.display = 'none';
      document.querySelector('.search input').value = '';
      document.querySelector('.search input').blur();
      show('.search-result');
    }
  }
}

// 页面渲染
function setPlayingNow(index) {
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
  audio.play();
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
  document.querySelector('#function-list ' + name).classList.add('check');
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
    document.querySelector('.window.whiteboard>.titbar>p').textContent = 'Blackboard';
    setData('theme', 'dark');
    isDark = true;
    darkControl.classList.add('active');
  } else {
    document.querySelector('.window.whiteboard>.titbar>p').textContent = 'Whiteboard';
    setData('theme', 'light');
    isDark = false;
    darkControl.classList.remove('active');
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