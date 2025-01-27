const { app, BrowserWindow, session, ipcMain, Menu, Tray } = require("electron");
const path = require("path");
const puppeteer = require("puppeteer");
const electronReload = require("electron-reload");
const Storage = require("electron-store");

const storage = new Storage();

function loadCookies() {
    if (!storage.has("cookies")) return null;
    return storage.get("cookies");
}

function saveCookies(cookies) {
    storage.set("cookies", cookies);
}

async function getBilibiliCookies() {
    const cachedCookies = loadCookies();
    if (cachedCookies) {
        return cachedCookies;
    }
    const browser = await puppeteer.launch();
    const page = await browser.newPage();
    await page.goto("https://www.bilibili.com");
    const cookies = await page.cookies();
    // console.log(typeof cookies);
    saveCookies(cookies);
    await browser.close();
    // const formattedCookies = cookies.map((cookie) => `${cookie.name}=${cookie.value}`).join("; ");
    return cookies;
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
            webPreferences: {
                nodeIntegration: true,
                contextIsolation: false,
                enableRemoteModule: true,
                webSecurity: false // 禁用同源策略,允许跨域
            }
        });
        win.loadFile("src/main.html");
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
    createWindow();
    const cookie = await getBilibiliCookies();
    const cookieString = formatCookieString(cookie);
    session.defaultSession.webRequest.onBeforeSendHeaders((details, callback) => {
        if (details.url.includes("bilibili.com") || details.url.includes("bilivideo.cn") || details.url.includes("bilivideo.com")) {
            details.requestHeaders["Cookie"] = cookieString;
            details.requestHeaders["referer"] = "https://www.bilibili.com/";
            details.requestHeaders["user-agent"] = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/58.0.3029.110 Safari/537.3";
        }
        callback({ requestHeaders: details.requestHeaders });
    });
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
