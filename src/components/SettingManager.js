class SettingManager {
    constructor() {
        this.settings = {
            theme: 'dark',
            background: 'none',
            lyricSearchType: 'auto' // 添加新的设置项
        };
        this.listeners = new Map();
        this.STORAGE_KEY = 'app_settings';
        this.loadSettings();
    }

    loadSettings() {
        try {
            const savedSettings = localStorage.getItem(this.STORAGE_KEY);
            if (savedSettings) {
                this.settings = JSON.parse(savedSettings);
            }
        } catch (error) {
            console.error('加载设置失败:', error);
        }
    }

    saveSettings() {
        try {
            localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.settings));
        } catch (error) {
            console.error('保存设置失败:', error);
        }
    }

    getSetting(name) {
        return this.settings[name];
    }

    setSetting(name, value) {
        const oldValue = this.settings[name];
        this.settings[name] = value;
        
        this.notifyListeners(name, value, oldValue);
        this.saveSettings();  
    }

    addListener(settingName, callback) {
        if (!this.listeners.has(settingName)) {
            this.listeners.set(settingName, new Set());
        }
        this.listeners.get(settingName).add(callback);
    }

    removeListener(settingName, callback) {
        if (this.listeners.has(settingName)) {
            this.listeners.get(settingName).delete(callback);
        }
    }

    notifyListeners(settingName, newValue, oldValue) {
        if (this.listeners.has(settingName)) {
            this.listeners.get(settingName).forEach(callback => {
                callback(newValue, oldValue);
            });
        }
    }
}

module.exports = SettingManager;