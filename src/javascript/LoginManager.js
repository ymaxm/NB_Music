const QRCode = require('qrcode');
const axios = require('axios');
const { ipcRenderer } = require('electron');

class LoginManager {
    constructor() {
        this.qrcodeKey = null;
        this.pollTimer = null;
        this.loginDialog = document.getElementById('loginDialog');
        this.qrcodeCanvas = document.getElementById('qrcode');
        this.qrcodeStatus = document.querySelector('.qrcode-status');
        this.loginBtn = document.querySelector('.login-btn');
        this.refreshBtn = document.getElementById('refreshQRCode');
        this.cancelBtn = document.getElementById('cancelLogin');

        this.bindEvents();
        this.updateLoginStatus();
    }
    async updateLoginStatus() {
        try {
            const response = await axios.get('https://api.bilibili.com/x/web-interface/nav');

            if (response.data.code === 0) {
                const username = response.data.data.uname;
                if (this.loginBtn) {
                    this.loginBtn.textContent = username;
                    this.loginBtn.style = '-webkit-app-region: drag';
                }
            }
        } catch (error) {
            console.error('获取登录状态失败:', error);
        }
    }

    bindEvents() {
        const loginBtn = document.querySelector('.login-btn');
        const loginDialog = document.getElementById('loginDialog');
        const refreshBtn = document.getElementById('refreshQRCode');
        const cancelBtn = document.getElementById('cancelLogin');

        loginBtn.addEventListener('click', () => this.showLoginDialog());
        refreshBtn.addEventListener('click', () => this.generateQRCode());
        cancelBtn.addEventListener('click', () => this.hideLoginDialog());
    }

    async generateQRCode() {
        try {
            const response = await fetch('https://passport.bilibili.com/x/passport-login/web/qrcode/generate');
            const data = await response.json();

            if (data.code === 0) {
                this.qrcodeKey = data.data.qrcode_key;
                // 清空已有内容
                const context = this.qrcodeCanvas.getContext('2d');
                context.clearRect(0, 0, this.qrcodeCanvas.width, this.qrcodeCanvas.height);

                // 设置canvas大小
                this.qrcodeCanvas.width = 200;
                this.qrcodeCanvas.height = 200;

                // 生成二维码
                await QRCode.toCanvas(this.qrcodeCanvas, data.data.url, {
                    width: 200,
                    margin: 2,
                    color: {
                        dark: '#000000',
                        light: '#ffffff'
                    }
                });

                this.qrcodeStatus.textContent = '请使用哔哩哔哩客户端扫码登录';
                this.startPolling();
            }
        } catch (error) {
            console.error('生成二维码失败:', error);
            this.qrcodeStatus.textContent = '生成二维码失败，请重试';
        }
    }

    async pollLoginStatus() {
        try {
            const response = await fetch(`https://passport.bilibili.com/x/passport-login/web/qrcode/poll?qrcode_key=${this.qrcodeKey}`);
            const data = await response.json();
    
            if (data.code === 0) {
                const statusElem = document.querySelector('.qrcode-status');
    
                switch (data.data.code) {
                    case 0: // 登录成功
                        statusElem.textContent = '登录成功，正在设置...';
                        this.clearPolling();
                        
                        // 获取所有的cookie
                        const rawCookies = data.data.url.match(/[^?]*\?(.*)/)[1].split('&');
                        const cookies = rawCookies.map(pair => {
                            const [name, value] = pair.split('=');
                            return `${name}=${value}`;
                        });
    
                        // 发送给主进程设置
                        ipcRenderer.send('login-success', { cookies });
                        
                        // 监听主进程响应
                        ipcRenderer.once('cookies-set', () => {
                            this.hideLoginDialog();
                            location.reload(); // 刷新页面应用新cookie
                        });
                        
                        ipcRenderer.once('cookies-set-error', (_, error) => {
                            statusElem.textContent = `登录失败: ${error}`;
                            console.error('登录失败:', error);
                            setTimeout(() => this.hideLoginDialog(), 2000);
                        });
                        break;
    
                    case 86038: // 二维码已过期
                        statusElem.textContent = '二维码已过期，请点击刷新';
                        this.clearPolling();
                        break;
    
                    case 86090: // 等待扫码
                        statusElem.textContent = '请使用哔哩哔哩客户端扫码登录';
                        break;
    
                    case 86101: // 已扫码等待确认
                        statusElem.textContent = '请在手机上确认登录';
                        break;
                }
            }
        } catch (error) {
            console.error('检查登录状态失败:', error);
            this.clearPolling();
        }
    }

    startPolling() {
        this.clearPolling();
        this.pollTimer = setInterval(() => this.pollLoginStatus(), 3000);
    }

    clearPolling() {
        if (this.pollTimer) {
            clearInterval(this.pollTimer);
            this.pollTimer = null;
        }
    }

    showLoginDialog() {
        document.getElementById('loginDialog').classList.remove('hide');
        this.generateQRCode();
    }

    hideLoginDialog() {
        document.getElementById('loginDialog').classList.add('hide');
        this.clearPolling();
    }
}

module.exports = LoginManager;