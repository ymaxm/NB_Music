export interface AudioPlayer {
    audioPlay(): void;
    audioPause(): void;
    play(): number;
    prev(): void;
    next(): void;
    constructor(playlistManager: PlaylistManager) : AudioPlayer;
}

export declare type Song = {
    title: string;
    artist: string;
    audio: string;
    poster: string;
    bvid: string;
    lyrics: string;
};

export declare class PlaylistManager {
    addSong(song: Song, event: Event): void;
    removeSong(bvid: string, event: Event): void;
    setPlayingNow(index: Number, replay?: boolean): void;
    tryPlayWithRetry(song: Song, maxRetries?: number): void;
    updateUIForCurrentSong(song: Song): void;
    changePlaylistName(name: string): void;
    savePlaylists(): void;
    loadPlaylists(): void;
    constructor(audioPlayer: AudioPlayer, lyricsPlayer: LyricsPlayer, uiManager: UIManager);
}

export declare class FavoriteManager {
    initializeLovelist(): void;
    saveFavorites(): void;
    loadFavorites(): void;
    removeFromFavorites(song: Song): void;
    addToFavorites(song: Song): void;
    renderFavoriteList(listElement: HTMLElement): void;
    constructor(playlistManager: PlaylistManager, uiManager: UIManager);
}

export declare class MusicSearcher {
    searchBilibiliVideo(keyword: string, page?: number, order?: string, duration?: number, tids?: number): void;
    searchMusic(keyword: string): void;
    getAudioLink(videoId: string, isBvid?: boolean): Promise<string[]>;
    getLyrics(songName: string): Promise<string>;
    constructor();
}

export declare class LyricsPlayer {
    changeLyrics(newLyricsString: string): void;
    parseLyrics(lyricsString: string): Object[];
    createLyricElement(lyricData: Object[]): HTMLDivElement;
    createMetadataElement(metadata: Object[]): HTMLDivElement;
    init(): void;
    start(): void;
    stop(): void;
    onSeek(): void;
    animate(): void;
    scrollToActiveLine(activeLine: HTMLElement): void;
    smoothScroll(): void;
    constructor(lyricsString: string, audioElement: HTMLAudioElement);
}

export declare class UIManager {
    initializePlayerControls(): void;
    initializePageEvents(): void;
    show(pageName: string): void;
    initializeEvents(): void;
    handleSearch(): Promise<void>;
    toggleTheme(): void;
    renderPlaylist(): void;
    createSongElement(
        song: Song,
        bvid: string,
        {
            isLove,
            isDelete,
            isExtract
        }?: {
            isLove?: boolean | undefined;
            isDelete?: boolean | undefined;
            isExtract?: boolean | undefined;
        }
    ): HTMLDivElement;
    constructor(audioPlayer: AudioPlayer, playlistManager: PlaylistManager, favoriteManager: FavoriteManager, musicSearcher: MusicSearcher);
}
