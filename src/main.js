const { app, BrowserWindow, session, ipcMain, Menu, Tray, shell } = require("electron");
const path = require("path");
const puppeteer = require("puppeteer");
const electronReload = require("electron-reload");
const Storage = require("electron-store");
const axios = require('axios');
const { autoUpdater } = require("electron-updater");
const storage = new Storage();
function parseCommandLineArgs() {
    const args = process.argv.slice(1);
    const showWelcomeArg = args.includes('--show-welcome');
    return {
        showWelcome: showWelcomeArg
    };
}
function setupAutoUpdater(win) {
    // 开发环境跳过更新检查
    if (!app.isPackaged) return;

    // 配置更新服务器
    autoUpdater.setFeedURL({
        provider: 'github',
        owner: 'NB-Group',
        repo: 'NB_Music'
    });

    // 检查更新出错
    autoUpdater.on('error', (err) => {
        win.webContents.send('update-error', (err.message));
    });

    // 检查到新版本
    autoUpdater.on('update-available', (info) => {
        win.webContents.send('update-available', (info));
    });

    // 没有新版本
    autoUpdater.on('update-not-available', () => {
        win.webContents.send('update-not-available');
    });

    // 下载进度
    autoUpdater.on('download-progress', (progress) => {
        win.webContents.send('download-progress', (progress));
    });

    // 更新下载完成
    autoUpdater.on('update-downloaded', () => {
        // 通知渲染进程
        win.webContents.send('update-downloaded');

        // 提示重启应用
        const dialogOpts = {
            type: 'info',
            buttons: ['重启', '稍后'],
            title: '应用更新',
            message: '有新版本已下载完成,是否重启应用?'
        };

        require('electron').dialog.showMessageBox(dialogOpts).then((returnValue) => {
            if (returnValue.response === 0) autoUpdater.quitAndInstall();
        });
    });

    // 每小时检查一次更新
    setInterval(() => {
        autoUpdater.checkForUpdates();
    }, 60 * 60 * 1000);

    // 启动时检查更新
    autoUpdater.checkForUpdates();
}
function loadCookies() {
    if (!storage.has("cookies")) return null;
    return storage.get("cookies");
}

function saveCookies(cookieString) {
    storage.set("cookies", cookieString);
}

async function getBilibiliCookies() {
    const cachedCookies = loadCookies();
    if (cachedCookies) {
        return cachedCookies;
    }
    try {
        const browser = await puppeteer.launch({
            headless: true,
            defaultViewport: null
        });
        const page = await browser.newPage();
        await page.goto("https://www.bilibili.com");
        const cookies = await page.cookies();
        const cookieString = formatCookieString(cookies);
        saveCookies(cookieString);
        await browser.close();
        return cookieString;
    } catch (error) {
        console.error('获取B站cookies失败:', error);
        return '';
    }
}

function getIconPath() {
    switch (process.platform) {
        case "win32":
            return path.join(__dirname, "../icons/icon.ico");
        case "darwin":
            return path.join(__dirname, "../icons/icon.icns");
        case "linux":
            return path.join(__dirname, "../icons/icon.png");
        default:
            return path.join(__dirname, "../icons/icon.png");
    }
}
function createWindow() {
    // if (process.argv.includes('--clear-storage')) {
    //     console.log('清除所有存储数据...');
    //     // 清除 electron-store 存储
    //     storage.clear();

    //     // 清除 session 存储数据
    //     session.defaultSession.clearStorageData({
    //         storages: ['appcache', 'filesystem', 'indexdb', 'localstorage', 'shadercache', 'websql', 'serviceworkers', 'cachestorage'],
    //     }).then(() => {
    //         console.log('存储数据已清除');
    //     });
    // }

    const gotTheLock = app.requestSingleInstanceLock();
    if (!gotTheLock) {
        app.quit();
    } else {
        const menu = Menu.buildFromTemplate([
            {
                id: 1,
                type: "normal",
                label: "退出",
                click: () => {
                    app.exit();
                }
            },
            { id: 2, type: "normal", label: "关于" },
            { id: 3, type: "normal", label: "配置" }
        ]);
        const tray = new Tray(getIconPath());
        tray.setContextMenu(menu);
        tray.setToolTip("NB Music");
        tray.on("click", () => {
            win.show();
        });
        const win = new BrowserWindow({
            frame: false,
            icon: getIconPath(),
            backgroundColor: "#2f3241",
            width: 1280,           // 添加合适的宽度
            height: 800,           // 添加合适的高度
            minWidth: 1280,         // 设置最小宽度
            minHeight: 800,        // 设置最小高度
            webPreferences: {
                nodeIntegration: true,
                contextIsolation: false,
                enableRemoteModule: true,
                webSecurity: false // 禁用同源策略,允许跨域
            }
        });
        setupAutoUpdater(win);
        win.loadFile("src/main.html");
        win.maximize(); 
        // if (!app.isPackaged) {
        // win.webContents.openDevTools();
        // }
        const cmdArgs = parseCommandLineArgs();
        win.webContents.on('did-finish-load', () => {
            win.webContents.send('command-line-args', cmdArgs);
        });
        ipcMain.on("window-minimize", () => {
            win.minimize();
        });

        ipcMain.on("window-maximize", () => {
            if (win.isMaximized()) {
                win.unmaximize();
            } else {
                win.maximize();
            }
        });

        ipcMain.on("window-close", () => {
            win.hide();
        });

        ipcMain.on("open-dev-tools", () => {
            if (!app.isPackaged) {
                if (win.webContents.isDevToolsOpened()) {
                    win.webContents.closeDevTools();
                } else {
                    win.webContents.openDevTools();
                }
            }
        });
        ipcMain.on('login-success', async (event, data) => {
            try {
                const { cookies } = data;
                if (!cookies || cookies.length === 0) {
                    throw new Error('未能获取到cookie');
                }

                // 直接保存cookie字符串
                saveCookies(cookies.join(';'));

                // 设置请求头
                session.defaultSession.webRequest.onBeforeSendHeaders((details, callback) => {
                    if (details.url.includes("bilibili.com") ||
                        details.url.includes("bilivideo.cn") ||
                        details.url.includes("bilivideo.com")) {
                        details.requestHeaders["Cookie"] = cookies.join(';');
                        details.requestHeaders["referer"] = "https://www.bilibili.com/";
                        details.requestHeaders["user-agent"] = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/58.0.3029.110 Safari/537.3";
                    }
                    callback({ requestHeaders: details.requestHeaders });
                });

                win.webContents.send('cookies-set', true);

            } catch (error) {
                console.error('登录失败:', error);
                win.webContents.send('cookies-set-error', error.message);
            }
        });
        // 主进程
        win.on("maximize", () => {
            win.webContents.send("window-state-changed", true);
        });

        win.on("unmaximize", () => {
            win.webContents.send("window-state-changed", false);
        });

        win.on("close", (e) => {
            e.preventDefault();
            win.hide();
        });

        win.on("unhandledrejection", (event) => {
            console.warn("Unhandled rejection (reason):", event.reason);
            event.preventDefault();
        });
        app.on("second-instance", () => {
            // 当第二个实例运行时，这里会被触发
            if (win) {
                if (win.isMinimized()) win.restore();
                win.focus();
            }
        });
    }
}
function formatCookieString(cookies) {
    return cookies.map((cookie) => `${cookie.name}=${cookie.value}`).join(";");
}

app.whenReady().then(async () => {
    if (!app.isPackaged) {
        require('electron-reload')(__dirname, {
            electron: path.join(process.cwd(), "node_modules", ".bin", "electron")
        });
    }
    createWindow();
    setupIPC(); 
    const cookieString = await getBilibiliCookies();
    if (cookieString) {
        session.defaultSession.webRequest.onBeforeSendHeaders((details, callback) => {
            if (details.url.includes("bilibili.com") ||
                details.url.includes("bilivideo.cn") ||
                details.url.includes("bilivideo.com")) {
                details.requestHeaders["Cookie"] = cookieString;
                details.requestHeaders["referer"] = "https://www.bilibili.com/";
                details.requestHeaders["user-agent"] = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/58.0.3029.110 Safari/537.3";
            }
            callback({ requestHeaders: details.requestHeaders });
        });
    }
});
app.on("window-all-closed", () => {
    if (process.platform !== "darwin") {
        app.quit();
    }
});
if (!app.isPackaged) {
    electronReload(__dirname, {
        electron: path.join(process.cwd(), "node_modules", ".bin", "electron")
    });
}

function setupIPC() {
    ipcMain.handle('get-app-version', () => {
        return app.getVersion();
    });

    ipcMain.on('check-for-updates', () => {
        // 如果不是打包后的应用，显示开发环境提示
        if (!app.isPackaged) {
            BrowserWindow.getFocusedWindow()?.webContents.send('update-not-available', {
                message: '开发环境中无法检查更新'
            });
            return;
        }
        
        // 执行更新检查
        autoUpdater.checkForUpdates()
            .catch(err => {
                console.error('更新检查失败:', err);
                BrowserWindow.getFocusedWindow()?.webContents.send('update-error', err.message);
            });
    });

    ipcMain.on('install-update', () => {
        // 安装已下载的更新
        autoUpdater.quitAndInstall(true, true);
    });

    ipcMain.on('open-external-link', (_, url) => {
        shell.openExternal(url);
    });
}
