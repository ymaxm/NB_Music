const { ipcRenderer } = require('electron');

class UpdateManager {
    constructor() {
        this.container = document.getElementById('update-container');
        this.status = document.getElementById('update-status');
        this.progressWrapper = document.getElementById('update-progress');
        this.progressBar = document.getElementById('progress-inner');
        this.progressText = document.getElementById('progress-percent');
        this.actions = document.getElementById('update-actions');
        
        this.initializeEvents();
    }

    initializeEvents() {
        // 监听主进程发来的更新消息
        ipcRenderer.on('update-error', (_, message) => {
            this.showStatus(`更新检查失败: ${message}`, 'error');
            setTimeout(() => this.hide(), 3000);
        });

        ipcRenderer.on('update-available', () => {
            this.showStatus('发现新版本,开始下载...');
            this.progressWrapper.classList.remove('hide');
        });

        ipcRenderer.on('update-not-available', () => {
            this.showStatus('当前已是最新版本');
            setTimeout(() => this.hide(), 3000);
        });

        ipcRenderer.on('download-progress', (_, progress) => {
            const percent = Math.round(progress.percent);
            this.progressBar.style.width = `${percent}%`;
            this.progressText.textContent = `${percent}%`;
            this.showStatus(`正在下载更新: ${Math.round(progress.bytesPerSecond / 1024)} KB/s`);
        });

        ipcRenderer.on('update-downloaded', () => {
            this.showStatus('更新已下载完成,是否立即安装?');
            this.progressWrapper.classList.add('hide');
            this.actions.classList.remove('hide');
            
            // 绑定按钮事件
            document.getElementById('update-now').onclick = () => {
                ipcRenderer.send('install-update');
            };
            
            document.getElementById('update-later').onclick = () => {
                this.hide();
            };
        });
    }

    show() {
        this.container.classList.remove('hide');
    }

    hide() {
        this.container.classList.add('hide');
        this.progressWrapper.classList.add('hide');
        this.actions.classList.add('hide');
    }

    showStatus(message, type = 'info') {
        this.show();
        this.status.textContent = message;
        this.status.className = `update-status ${type}`;
    }
}

module.exports = UpdateManager;
