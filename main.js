const { app, BrowserWindow, session, ipcMain } = require('electron')
const path = require('path')
// window.addEventListener('unhandledrejection', (event) => {
//     console.warn('Unhandled rejection (reason):', event.reason);
//     // 阻止错误在控制台输出
//     event.preventDefault();
// });

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
    win.loadFile('index.html')
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

}

app.whenReady().then(() => {
    createWindow()
    session.defaultSession.webRequest.onBeforeSendHeaders((details, callback) => {
        if (details.url.includes('bilibili.com')) {
            details.requestHeaders['Cookie'] = 'buvid3=345D266D-19E4-1EEC-C9A7-B9286BA4A59239219infoc; b_nut=1736343139; b_lsid=6D51106107_194461DD0EA; _uuid=78482A2E-DDA8-6105B-D153-31644B61E4BA46742infoc; enable_web_push=DISABLE; buvid_fp=5857ee8e41c5baf5b68bc8aa557dba82; bmg_af_switch=0; buvid4=AFBA85E9-5DE9-5A3E-86F5-7390969CA3F256236-025010813-GdU%2F9LbW2GGlexArjkUUO07Mrv500PA9IZIciasB8SaOP7lEgvVgG0Ha4LbGI%2FyK; bili_ticket=eyJhbGciOiJIUzI1NiIsImtpZCI6InMwMyIsInR5cCI6IkpXVCJ9.eyJleHAiOjE3MzY2MDIzNTYsImlhdCI6MTczNjM0MzA5NiwicGx0IjotMX0.kDhXWhwKZZsjH4b3OD9DqQ2E5fx-ARS4tno7o9KJnr8; bili_ticket_expires=1736602296; CURRENT_FNVAL=2000; sid=6802awhl; home_feed_column=4; browser_resolution=825-927';
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