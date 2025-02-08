class MusiclistManager {
    constructor(playlistManager) {
        this.playlistManager = playlistManager;
        this.playlists = [];
        this.activePlaylistIndex = 0;

        this.musicListContainer = document.querySelector(".content .music-list");
        this.playlistSection = this.musicListContainer.querySelector("#playlistList");
        this.songSection = this.musicListContainer.querySelector("#songList");
        this.newPlaylistBtn = this.musicListContainer.querySelector("#newPlaylist");

        // 先加载已保存的歌单
        this.loadPlaylists();
        // 确保所有歌单都有ID
        this.ensurePlaylistIds();

        // 只有当没有任何歌单时才创建默认歌单
        if (this.playlists.length === 0) {
            this.playlists.push({
                id: this.generateUUID(),
                name: this.playlistManager.playlistName || "默认歌单",
                songs: [...this.playlistManager.playlist]
            });
            this.savePlaylists();
        }

        this.init();
    }

    generateUUID() {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
            const r = Math.random() * 16 | 0;
            const v = c === 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
    }

    ensurePlaylistIds() {
        this.playlists.forEach(playlist => {
            if (!playlist.id) {
                playlist.id = this.generateUUID();
            }
        });
        this.savePlaylists();
    }

    init() {
        // 点击新建歌单按钮事件
        this.newPlaylistBtn.addEventListener("click", () => {
            const input = document.createElement("input");
            input.type = "text";
            input.placeholder = "输入歌单名称";
            input.className = "playlist-input";

            input.addEventListener("click", (e) => {
                e.stopPropagation();
            });

            this.newPlaylistBtn.replaceWith(input);
            input.focus();

            const handleNewPlaylist = () => {
                const name = input.value.trim();
                if (name) {
                    // 检查歌单名是否已存在
                    if (this.playlists.some(p => p.name === name)) {
                        alert("歌单名称已存在！");
                        return;
                    }
                    this.playlists.push({
                        id: this.generateUUID(),
                        name: name,
                        songs: []
                    });
                    this.savePlaylists();
                    this.renderPlaylistList();
                }
                input.replaceWith(this.newPlaylistBtn);
            };

            input.addEventListener("blur", handleNewPlaylist);
            input.addEventListener("keypress", (e) => {
                if (e.key === "Enter") {
                    input.blur();
                }
            });
        });

        this.renderPlaylistList();
        this.renderSongList();
    }

    loadPlaylists() {
        try {
            const savedPlaylists = localStorage.getItem("nbmusic_playlists");
            if (savedPlaylists) {
                this.playlists = JSON.parse(savedPlaylists);
                // 找到当前播放的歌单并设置为激活
                const activeIndex = this.playlists.findIndex(
                    p => p.name === this.playlistManager.playlistName
                );
                if (activeIndex !== -1) {
                    this.activePlaylistIndex = activeIndex;
                }
            }
        } catch (error) {
            console.error("加载歌单失败:", error);
            // 加载失败时重置为空数组
            this.playlists = [];
        }
    }

    savePlaylists() {
        try {
            localStorage.setItem("nbmusic_playlists", JSON.stringify(this.playlists));
        } catch (error) {
            console.error("保存歌单失败:", error);
        }
    }

    renderPlaylistList() {
        if (!this.playlistSection) return;
        this.playlistSection.innerHTML = "";

        this.playlists.forEach((playlist, index) => {
            const li = document.createElement("li");
            li.dataset.id = playlist.id;

            // 创建歌单名称容器
            const nameSpan = document.createElement("span");
            nameSpan.textContent = playlist.name;
            nameSpan.classList.add("playlist-name");
            li.appendChild(nameSpan);

            if (index === this.activePlaylistIndex) {
                li.classList.add("active");
            }

            // 创建按钮容器
            const buttonContainer = document.createElement("div");
            buttonContainer.classList.add("playlist-buttons");

            // 重命名按钮
            const renameBtn = document.createElement("i");
            renameBtn.classList.add("bi","bi-pencil-square");
            renameBtn.onclick = (e) => {
                e.stopPropagation();
                this.renamePlaylist(playlist.id);
            };

            // 删除按钮
            const deleteBtn = document.createElement("i");
            deleteBtn.classList.add("bi","bi-trash");
            deleteBtn.onclick = (e) => {
                e.stopPropagation();
                this.deletePlaylist(playlist.id);
            };

            buttonContainer.appendChild(renameBtn);
            buttonContainer.appendChild(deleteBtn);
            li.appendChild(buttonContainer);

            li.addEventListener("click", () => {
                this.activePlaylistIndex = index;
                this.playlistManager.playlistName = playlist.name;
                this.playlistManager.playlist = [...playlist.songs];
                this.playlistManager.uiManager.renderPlaylist();
                this.playlistManager.setPlayingNow(0);
                this.renderPlaylistList();
                this.renderSongList();
            });

            this.playlistSection.appendChild(li);
        });
    }

    renderSongList() {
        if (!this.songSection) return;
        this.songSection.innerHTML = "";

        const activePlaylist = this.playlists[this.activePlaylistIndex];
        if (!activePlaylist) return;

        activePlaylist.songs.forEach((song, idx) => {
            const li = document.createElement("li");

            // 创建歌曲信息容器
            const songInfo = document.createElement("div");
            songInfo.classList.add("song-info");

            // 添加封面
            const cover = document.createElement("img");
            cover.src = song.poster;
            cover.alt = "歌曲封面";
            cover.classList.add("song-cover");

            // 添加标题
            const title = document.createElement("span");
            title.textContent = song.title || "未知歌曲";
            title.classList.add("song-title");

            // 组装歌曲信息
            songInfo.appendChild(cover);
            songInfo.appendChild(title);
            li.appendChild(songInfo);

            li.addEventListener("click", () => {
                this.playlistManager.playlistName = activePlaylist.name;
                this.playlistManager.playlist = [...activePlaylist.songs];
                this.playlistManager.setPlayingNow(idx);
                document.querySelector(".player").click();
            });

            const delBtn = document.createElement("i");
            delBtn.classList.add("bi","bi-trash");
            delBtn.addEventListener("click", (e) => {
                e.stopPropagation();
                activePlaylist.songs.splice(idx, 1);

                if (this.playlistManager.playlistName === activePlaylist.name) {
                    this.playlistManager.playlist = [...activePlaylist.songs];
                }
                this.savePlaylists();
                this.renderSongList();
                this.playlistManager.uiManager.renderPlaylist();
            });

            li.appendChild(delBtn);
            this.songSection.appendChild(li);
        });
    }

    renamePlaylist(playlistId) {
        const playlist = this.playlists.find(p => p.id === playlistId);
        if (!playlist) return;
    
        const playlistItem = document.querySelector(`li[data-id="${playlistId}"]`);
        const nameSpan = playlistItem.querySelector('.playlist-name');
        const originalName = nameSpan.textContent;
    
        // 创建输入框
        const input = document.createElement('input');
        input.type = 'text';
        input.value = originalName;
        input.className = 'playlist-input';
        input.style.width = 'calc(100% - 60px)';
        input.addEventListener("click", (e) => {
            e.stopPropagation();
        });
    
        // 替换原来的名称
        nameSpan.replaceWith(input);
        input.focus();
    
        const handleRename = () => {
            const newName = input.value.trim();
            if (newName && newName !== originalName) {
                if (this.playlists.some(p => p.id !== playlistId && p.name === newName)) {
                    alert("歌单名称已存在！");
                    input.replaceWith(nameSpan);
                    return;
                }
                playlist.name = newName;
                if (this.playlistManager.playlistName === originalName) {
                    this.playlistManager.playlistName = newName;
                }
                this.savePlaylists();
                this.renderPlaylistList();
            } else {
                input.replaceWith(nameSpan);
            }
        };
    
        input.addEventListener('blur', handleRename);
        input.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                input.blur();
            } else if (e.key === 'Escape') {
                input.replaceWith(nameSpan);
            }
        });
    }
    
    deletePlaylist(playlistId) {
        const index = this.playlists.findIndex(p => p.id === playlistId);
        if (index === -1) return;
    
        const deleteBtn = document.querySelector(`li[data-id="${playlistId}"] .bi-trash`);
        
        // 如果已经是确认状态
        if (deleteBtn.classList.contains('confirm-delete')) {
            this.playlists.splice(index, 1);
    
            if (index === this.activePlaylistIndex) {
                this.activePlaylistIndex = 0;
                if (this.playlists.length > 0) {
                    this.playlistManager.playlistName = this.playlists[0].name;
                    this.playlistManager.playlist = [...this.playlists[0].songs];
                } else {
                    const defaultPlaylist = {
                        id: this.generateUUID(),
                        name: "默认歌单",
                        songs: []
                    };
                    this.playlists.push(defaultPlaylist);
                    this.playlistManager.playlistName = defaultPlaylist.name;
                    this.playlistManager.playlist = [];
                }
            } else if (index < this.activePlaylistIndex) {
                this.activePlaylistIndex--;
            }
    
            this.savePlaylists();
            this.renderPlaylistList();
            this.renderSongList();
            return;
        }
    
        // 第一次点击，显示确认状态
        deleteBtn.classList.add('confirm-delete');
        deleteBtn.style.color = 'red';
        
        // 创建确认文本
        const confirmText = document.createElement('span');
        confirmText.textContent = '再次点击确认删除';
        confirmText.style.cssText = `
            color: red;
            font-size: 12px;
            margin-left: 5px;
        `;
        deleteBtn.parentNode.appendChild(confirmText);
    
        // 3秒后恢复原状
        setTimeout(() => {
            deleteBtn.classList.remove('confirm-delete');
            deleteBtn.style.color = '';
            if (confirmText.parentNode) {
                confirmText.remove();
            }
        }, 3000);
    }

    handlePlaylistUpdate() {
        const activePlaylist = this.playlists[this.activePlaylistIndex];
        if (activePlaylist && activePlaylist.name === this.playlistManager.playlistName) {
            // 深拷贝当前播放列表的歌曲到激活的歌单
            activePlaylist.songs = JSON.parse(JSON.stringify(this.playlistManager.playlist));
            // 保存更新后的歌单
            this.savePlaylists();
        }

        this.renderPlaylistList();
        this.renderSongList();
    }
}

module.exports = MusiclistManager;