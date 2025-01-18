const { app, BrowserWindow, session, ipcMain } = require('electron')
const path = require('path')
const puppeteer = require('puppeteer');
const fs = require('fs');

const cookieCachePath = path.join(__dirname, 'cookies.json');
function loadCookies() {
    if (fs.existsSync(cookieCachePath)) {
        const cookies = fs.readFileSync(cookieCachePath, 'utf8');
        return JSON.parse(cookies);
    }
    return null;
}

function saveCookies(cookies) {
    fs.writeFileSync(cookieCachePath, JSON.stringify(cookies, null, 2), 'utf8');
}

async function getBilibiliCookies() {
    const cachedCookies = loadCookies();
    if (cachedCookies) {
        return cachedCookies;
    }
    const browser = await puppeteer.launch();
    const page = await browser.newPage();
    await page.goto('https://www.bilibili.com');
    const cookies = await page.cookies();
    saveCookies(cookies);
    await browser.close();
    const formattedCookies = cookies.map(cookie => `${cookie.name}=${cookie.value}`).join('; ');
    return formattedCookies;
}


function getIconPath() {
    switch (process.platform) {
        case 'win32':
            return path.join(__dirname, 'icons/icon.ico')
        case 'darwin':
            return path.join(__dirname, 'icons/icon.icns')
        case 'linux':
            return path.join(__dirname, 'icons/icon.png')
        default:
            return path.join(__dirname, 'icons/icon.png')
    }
}
function createWindow() {
    const win = new BrowserWindow({
        frame: false,
        icon: getIconPath(),
        backgroundColor: '#2f3241',
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false,
            enableRemoteModule: true,
            webSecurity: false  // 禁用同源策略,允许跨域
        }
    })
    win.webContents.openDevTools()
    win.loadFile('main.html')
    ipcMain.on('window-minimize', () => {
        win.minimize()
    })

    ipcMain.on('window-maximize', () => {
        if (win.isMaximized()) {
            win.unmaximize()
        } else {
            win.maximize()
        }
    })

    ipcMain.on('window-close', () => {
        win.close()
    })

    // 主进程
    win.on('maximize', () => {
        win.webContents.send('window-state-changed', true);
    });

    win.on('unmaximize', () => {
        win.webContents.send('window-state-changed', false);
    });

    win.on('unhandledrejection', (event) => {
        console.warn('Unhandled rejection (reason):', event.reason);
        event.preventDefault();
    });
}

// const cookie = getBilibiliCookies();
app.whenReady().then(() => {
    createWindow();
    session.defaultSession.webRequest.onBeforeSendHeaders((details, callback) => {
        if (details.url.includes('bilibili.com') || details.url.includes('bilivideo.cn') || details.url.includes('bilivideo.com')) {
            details.requestHeaders['Cookie'] = 'buvid3=A1623A10-442C-B2ED-9C88-0CCC5CD1FE0884154infoc; b_nut=1736584584; b_lsid=B2C57391_1945481E3EE; _uuid=1042C4A56-952D-D819-810AD-DAFC9A3E410B886233infoc; enable_web_push=DISABLE; buvid_fp=5857ee8e41c5baf5b68bc8aa557dba82; buvid4=03DC0752-2BEA-865B-7A56-9F721E024E1688454-025011108-0lKJqwtJRGBuwNvSg1OGSA%3D%3D; bmg_af_switch=1; bmg_src_def_domain=i1.hdslb.com; CURRENT_FNVAL=2000; home_feed_column=4; browser_resolution=1009-927; sid=87j1to30; bili_ticket=eyJhbGciOiJIUzI1NiIsImtpZCI6InMwMyIsInR5cCI6IkpXVCJ9.eyJleHAiOjE3MzY4NDM3OTIsImlhdCI6MTczNjU4NDUzMiwicGx0IjotMX0.5RyEPN1jDBaBbnQR7yK-1wOHTN26dJ68EGnmfamK8-w; bili_ticket_expires=1736843732';
            details.requestHeaders['referer'] = 'https://www.bilibili.com/';
            details.requestHeaders['user-agent'] = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/58.0.3029.110 Safari/537.3';
        }
        callback({ requestHeaders: details.requestHeaders });
    });
})
app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit()
    }
})