    'use strict';

    const CORE_VERSION = '5.1.1';

    console.log(`[Netflix Enhancer Pro] v${CORE_VERSION} (React Edition) - Loading...`);
    
    // Load Font Awesome CSS
    const fontAwesomeCSS = GM_getResourceText("FONTAWESOME_CSS");
    GM_addStyle(fontAwesomeCSS);
    
    // React globals from @require
    const React = window.React;
    const ReactDOM = window.ReactDOM;
    const { useState, useEffect } = React;

    function getNetflixReactModels() {
        return window.netflix?.reactContext?.models || null;
    }

    function getNetflixFalcorCache() {
        return window.netflix?.falcorCache || null;
    }

    function extractVideoIdFromUrl(url) {
        if (!url) return null;
        const match = String(url).match(/\/(?:watch|title)\/(\d+)/);
        return match ? match[1] : null;
    }

    function getCurrentVideoIdFromAppState() {
        const falcor = getNetflixFalcorCache();
        const videos = falcor?.videos;

        if (videos) {
            for (const key of Object.keys(videos)) {
                const ref = videos[key]?.current?.value;
                if (Array.isArray(ref) && ref[1]) {
                    return String(ref[1]);
                }
            }

            const firstNumericKey = Object.keys(videos).find(k => /^\d+$/.test(k));
            if (firstNumericKey) {
                return firstNumericKey;
            }
        }

        const originalUrl = getNetflixReactModels()?.serverDefs?.data?.originalUrl;
        return extractVideoIdFromUrl(originalUrl) || extractVideoIdFromUrl(window.location.href);
    }

    function getVideoTitleFromAppState(videoId) {
        if (!videoId) return null;

        const falcorVideo = getNetflixFalcorCache()?.videos?.[videoId];
        const falcorTitle =
            falcorVideo?.title?.value ||
            falcorVideo?.summary?.value?.title ||
            falcorVideo?.details?.value?.title ||
            falcorVideo?.metadata?.value?.title ||
            null;

        if (falcorTitle) return falcorTitle;

        const reactTitle = window.netflix?.reactContext?.title;
        if (reactTitle && reactTitle !== 'Netflix') return reactTitle;

        const pageTitle = getNetflixReactModels()?.pageProperties?.data?.title;
        if (pageTitle && pageTitle !== 'Netflix') return pageTitle;

        return null;
    }

    function getCurrentTitleFromAppState() {
        const currentVideoId = getCurrentVideoIdFromAppState();
        return getVideoTitleFromAppState(currentVideoId);
    }

    function getVideoProgressData(videoId) {
        if (!videoId) return null;

        const falcorVideo = getNetflixFalcorCache()?.videos?.[videoId];
        if (!falcorVideo) return null;

        const bookmark = falcorVideo?.bookmarkPosition?.value || 0;
        const runtime = falcorVideo?.runtime?.value || 0;
        
        if (runtime === 0) return null;

        const progressPercent = (bookmark / runtime) * 100;
        const remainingSeconds = runtime - bookmark;
        const watchedMinutes = Math.floor(bookmark / 60);
        const totalMinutes = Math.floor(runtime / 60);

        return {
            bookmark,
            runtime,
            progressPercent,
            remainingSeconds,
            watchedMinutes,
            totalMinutes,
            isStarted: bookmark > 30, // More than 30 seconds watched
            isAlmostFinished: progressPercent > 90
        };
    }

    function formatTime(seconds) {
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        
        if (hours > 0) {
            return `${hours}h ${minutes}m`;
        }
        return `${minutes}m`;
    }

    // ============================================================
    // DEFAULT CONFIGURATION
    // ============================================================
    
    const DEFAULT_CONFIG = {
        // Auto-Skip Features
        autoSkipIntro: true,
        autoSkipRecap: true,
        autoSkipCredits: false,
        skipDelay: 1000,
        highlightSkipButton: true,
        
        // Playback Controls
        enableCustomSpeed: true,
        defaultSpeed: 1.0,
        enableKeyboardShortcuts: true,
        
        // UI Preferences
        showNotifications: true,
        showFloatingButton: true,
        
        // Video Enhancements
        enhanceTitleCards: true,
        showWatchlistButtons: true,
        
        // Custom Styles
        enableCustomStyles: true,
        
        // Advanced
        debugMode: false
    };

    // ============================================================
    // CONFIGURATION MANAGER - Reactive State with Proxy
    // ============================================================
    
    class ConfigManager {
        constructor(defaults) {
            this.defaults = defaults;
            this.config = null;
            this.listeners = new Map();
        }

        async init() {
            const saved = await GM.getValue('netflix_enhancer_config', {});
            this.config = new Proxy(
                { ...this.defaults, ...saved },
                {
                    set: (target, prop, value) => {
                        const oldValue = target[prop];
                        target[prop] = value;
                        
                        // Persist to storage
                        GM.setValue('netflix_enhancer_config', target);
                        
                        // Notify listeners
                        this.notifyListeners(prop, value, oldValue);
                        return true;
                    }
                }
            );
            return this.config;
        }

        get(key) {
            return key ? this.config[key] : this.config;
        }

        set(key, value) {
            this.config[key] = value;
        }

        onChange(key, callback) {
            if (!this.listeners.has(key)) {
                this.listeners.set(key, []);
            }
            this.listeners.get(key).push(callback);
        }

        offChange(key, callback) {
            if (this.listeners.has(key)) {
                const callbacks = this.listeners.get(key);
                const index = callbacks.indexOf(callback);
                if (index > -1) {
                    callbacks.splice(index, 1);
                }
            }
        }

        notifyListeners(key, newValue, oldValue) {
            if (this.listeners.has(key)) {
                this.listeners.get(key).forEach(callback => {
                    callback(newValue, oldValue);
                });
            }
        }
    }

    // ============================================================
    // WATCHLIST MANAGER - Continue Watching Tracker
    // ============================================================
    
    class WatchlistManager {
        constructor(toastManager) {
            this.toastManager = toastManager;
            this.watchlist = [];
        }

        async init() {
            this.watchlist = await GM.getValue('netflix_enhancer_watchlist', []);
            return this.watchlist;
        }

        async addToWatchlist(item) {
            // Check if already exists
            const exists = this.watchlist.find(w => w.id === item.id);
            if (exists) {
                this.toastManager.show('Already in Continue Watching', 1500, 'fa-check');
                return;
            }

            const watchItem = {
                id: item.id || Date.now().toString(),
                title: item.title,
                url: item.url || window.location.href,
                addedAt: Date.now(),
                thumbnail: item.thumbnail || null
            };

            this.watchlist.unshift(watchItem);
            await GM.setValue('netflix_enhancer_watchlist', this.watchlist);
            this.toastManager.show(`Added "${item.title}" to Continue Watching`, 2000, 'fa-plus');
        }

        async removeFromWatchlist(id) {
            const item = this.watchlist.find(w => w.id === id);
            this.watchlist = this.watchlist.filter(w => w.id !== id);
            await GM.setValue('netflix_enhancer_watchlist', this.watchlist);
            if (item) {
                this.toastManager.show(`Removed "${item.title}"`, 1500, 'fa-trash');
            }
        }

        async clearWatchlist() {
            this.watchlist = [];
            await GM.setValue('netflix_enhancer_watchlist', []);
            this.toastManager.show('Continue Watching cleared', 1500, 'fa-check');
        }

        getWatchlist() {
            return this.watchlist;
        }

        isInWatchlist(id) {
            return this.watchlist.some(w => w.id === id);
        }
    }

    // ============================================================
    // TOAST NOTIFICATION SYSTEM
    // ============================================================
    
    class ToastManager {
        constructor(configManager) {
            this.configManager = configManager;
            this.container = null;
        }

        init() {
            this.container = document.createElement('div');
            this.container.id = 'ne-toast-container';
            document.body.appendChild(this.container);
            
            GM_addStyle(`
                #ne-toast-container {
                    position: fixed;
                    top: 80px;
                    right: 20px;
                    z-index: 999999;
                    display: flex;
                    flex-direction: column;
                    gap: 10px;
                    pointer-events: none;
                }
                
                .ne-toast {
                    background: rgba(20, 20, 20, 0.95);
                    color: white;
                    padding: 12px 20px;
                    border-radius: 8px;
                    border-left: 4px solid #a78bfa;
                    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.5);
                    font-family: Netflix Sans, Helvetica Neue, Helvetica, Arial, sans-serif;
                    font-size: 14px;
                    min-width: 250px;
                    animation: ne-slideIn 0.3s ease-out;
                    pointer-events: auto;
                    backdrop-filter: blur(10px);
                }
                
                @keyframes ne-slideIn {
                    from {
                        transform: translateX(400px);
                        opacity: 0;
                    }
                    to {
                        transform: translateX(0);
                        opacity: 1;
                    }
                }
                
                .ne-toast.removing {
                    animation: ne-slideOut 0.3s ease-in forwards;
                }
                
                @keyframes ne-slideOut {
                    to {
                        transform: translateX(400px);
                        opacity: 0;
                    }
                }
                
                .ne-toast-icon {
                    display: inline-flex;
                    align-items: center;
                    justify-content: center;
                    margin-right: 8px;
                    font-size: 16px;
                    width: 20px;
                    font-family: 'Font Awesome 6 Free';
                }
            `);
        }

        show(message, duration = 3000, icon = '') {
            if (!this.configManager.get('showNotifications')) return;
            if (!this.container) this.init();
            
            const toast = document.createElement('div');
            toast.className = 'ne-toast';
            const iconHTML = icon ? `<i class="ne-toast-icon fa-solid ${icon}"></i>` : '';
            toast.innerHTML = `${iconHTML}${message}`;
            
            this.container.appendChild(toast);
            
            setTimeout(() => {
                toast.classList.add('removing');
                setTimeout(() => toast.remove(), 300);
            }, duration);
        }
    }

    // ============================================================
    // REACT COMPONENTS
    // ============================================================
    
    // Settings Panel React Component
    function SettingsPanelComponent({ configManager, toastManager, watchlistManager, onClose }) {
        const [config, setConfig] = useState(configManager.get());
        const [activeTab, setActiveTab] = useState('auto-skip');
        const [watchlist, setWatchlist] = useState([]);
        
        useEffect(() => {
            // Subscribe to config changes
            const updateConfig = () => setConfig({ ...configManager.get() });
            const keys = Object.keys(DEFAULT_CONFIG);
            keys.forEach(key => configManager.onChange(key, updateConfig));
            
            // Load watchlist
            if (watchlistManager) {
                setWatchlist(watchlistManager.getWatchlist());
                
                // Refresh watchlist every 2 seconds when on watchlist tab
                const interval = setInterval(() => {
                    if (activeTab === 'watchlist') {
                        setWatchlist([...watchlistManager.getWatchlist()]);
                    }
                }, 2000);
                
                return () => clearInterval(interval);
            }
        }, [activeTab]);
        
        const handleChange = (key, value) => {
            configManager.set(key, value);
        };
        
        const handleReset = () => {
            if (confirm('Reset all settings to defaults?')) {
                Object.keys(DEFAULT_CONFIG).forEach(key => {
                    configManager.set(key, DEFAULT_CONFIG[key]);
                });
                toastManager.show('Settings reset! Reloading...', 2000);
                setTimeout(() => location.reload(), 2000);
            }
        };
        
        const handleSave = () => {
            toastManager.show('Settings saved!', 2000);
            onClose();
        };
        
        return React.createElement('div', { className: 'settings-overlay', onClick: (e) => e.target.className === 'settings-overlay' && onClose() },
            React.createElement('div', { className: 'settings-panel', role: 'dialog', 'aria-labelledby': 'settings-title' },
                // Header
                React.createElement('div', { className: 'settings-header' },
                    React.createElement('h2', { className: 'settings-title', id: 'settings-title' }, 'Netflix Enhancer Pro'),
                    React.createElement('button', { 
                        className: 'close-btn', 
                        id: 'close-settings', 
                        'aria-label': 'Close settings',
                        onClick: onClose
                    }, React.createElement('i', { className: 'fa-solid fa-xmark' }))
                ),
                
                // Tabs
                React.createElement('div', { className: 'tabs-container' },
                    ['auto-skip', 'playback', 'interface', 'watchlist', 'advanced'].map(tab =>
                        React.createElement('button', {
                            key: tab,
                            className: `tab-btn ${activeTab === tab ? 'active' : ''}`,
                            onClick: () => setActiveTab(tab)
                        }, tab.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join('-'))
                    )
                ),
                
                // Body
                React.createElement('div', { className: 'settings-body' },
                    // Auto-Skip Tab
                    activeTab === 'auto-skip' && React.createElement('div', { className: 'tab-content active' },
                        React.createElement('div', { className: 'setting-group' },
                            React.createElement('div', { className: 'setting-group-title' }, 'Auto-Skip Features'),
                            
                            SettingItem('Auto-Skip Intros', 'Automatically skip show intros', 
                                config.autoSkipIntro, (val) => handleChange('autoSkipIntro', val)),
                            SettingItem('Auto-Skip Recaps', 'Automatically skip episode recaps', 
                                config.autoSkipRecap, (val) => handleChange('autoSkipRecap', val)),
                            SettingItem('Auto-Skip Credits', 'Skip end credits and advance to next episode', 
                                config.autoSkipCredits, (val) => handleChange('autoSkipCredits', val)),
                            SettingItem('Highlight Skip Button', 'Show green border on skip buttons', 
                                config.highlightSkipButton, (val) => handleChange('highlightSkipButton', val)),
                            
                            NumberSettingItem('Skip Delay (ms)', 'Delay before auto-skipping',
                                config.skipDelay, (val) => handleChange('skipDelay', val), 0, 5000, 500)
                        )
                    ),
                    
                    // Playback Tab
                    activeTab === 'playback' && React.createElement('div', { className: 'tab-content active' },
                        React.createElement('div', { className: 'setting-group' },
                            React.createElement('div', { className: 'setting-group-title' }, 'Playback Controls'),
                            
                            SettingItem('Custom Speed Controls', 'Enable custom playback speed shortcuts', 
                                config.enableCustomSpeed, (val) => handleChange('enableCustomSpeed', val)),
                            
                            SelectSettingItem('Default Speed', 'Initial playback speed',
                                config.defaultSpeed, (val) => handleChange('defaultSpeed', parseFloat(val)),
                                [0.5, 0.75, 1.0, 1.25, 1.5, 2.0]),
                            
                            SettingItem('Keyboard Shortcuts', 'S: toggle speed | R: rewind 10s | F: forward 10s', 
                                config.enableKeyboardShortcuts, (val) => handleChange('enableKeyboardShortcuts', val))
                        )
                    ),
                    
                    // Interface Tab
                    activeTab === 'interface' && React.createElement('div', { className: 'tab-content active' },
                        React.createElement('div', { className: 'setting-group' },
                            React.createElement('div', { className: 'setting-group-title' }, 'User Interface'),
                            
                            SettingItem('Show Notifications', 'Display toast notifications for actions', 
                                config.showNotifications, (val) => handleChange('showNotifications', val)),
                            SettingItem('Show Floating Button', 'Display settings button on page', 
                                config.showFloatingButton, (val) => handleChange('showFloatingButton', val)),
                            SettingItem('Enhanced Title Cards', 'Add hover effects to browse tiles', 
                                config.enhanceTitleCards, (val) => handleChange('enhanceTitleCards', val)),
                            SettingItem('Show Watchlist Buttons', 'Add "Continue Watching" buttons to title cards', 
                                config.showWatchlistButtons, (val) => handleChange('showWatchlistButtons', val))
                        )
                    ),
                    
                    // Watchlist Tab
                    activeTab === 'watchlist' && React.createElement('div', { className: 'tab-content active' },
                        React.createElement('div', { className: 'setting-group' },
                            React.createElement('div', { className: 'setting-group-title' }, 
                                React.createElement('span', null, 'Continue Watching'),
                                watchlist.length > 0 && React.createElement('button', {
                                    className: 'clear-watchlist-btn',
                                    onClick: () => {
                                        if (confirm('Clear all items from Continue Watching?')) {
                                            watchlistManager.clearWatchlist();
                                            setWatchlist([]);
                                        }
                                    }
                                }, 'Clear All')
                            ),
                            React.createElement('div', { className: 'watchlist-info' },
                                'Mark shows and movies to track them without watching. Click the "+" button on any title card.'
                            ),
                            watchlist.length === 0 ? 
                                React.createElement('div', { className: 'watchlist-empty' },
                                    React.createElement('i', { className: 'fa-solid fa-list' }),
                                    React.createElement('p', null, 'No items yet'),
                                    React.createElement('p', { className: 'small' }, 'Browse Netflix and click + on title cards')
                                ) :
                                React.createElement('div', { className: 'watchlist-items' },
                                    watchlist.map(item =>
                                        React.createElement('div', { key: item.id, className: 'watchlist-item' },
                                            React.createElement('div', { className: 'watchlist-item-info' },
                                                React.createElement('div', { className: 'watchlist-item-title' }, item.title),
                                                React.createElement('div', { className: 'watchlist-item-date' },
                                                    'Added ' + new Date(item.addedAt).toLocaleDateString()
                                                )
                                            ),
                                            React.createElement('div', { className: 'watchlist-item-actions' },
                                                item.url && React.createElement('button', {
                                                    className: 'watchlist-btn watchlist-btn-visit',
                                                    onClick: () => window.location.href = item.url,
                                                    title: 'Visit'
                                                }, React.createElement('i', { className: 'fa-solid fa-arrow-right' })),
                                                React.createElement('button', {
                                                    className: 'watchlist-btn watchlist-btn-remove',
                                                    onClick: () => {
                                                        watchlistManager.removeFromWatchlist(item.id);
                                                        setWatchlist(watchlistManager.getWatchlist());
                                                    },
                                                    title: 'Remove'
                                                }, React.createElement('i', { className: 'fa-solid fa-trash' }))
                                            )
                                        )
                                    )
                                )
                        )
                    ),
                    
                    // Advanced Tab
                    activeTab === 'advanced' && React.createElement('div', { className: 'tab-content active' },
                        React.createElement('div', { className: 'setting-group' },
                            React.createElement('div', { className: 'setting-group-title' }, 'Advanced Settings'),
                            
                            SettingItem('Enable Custom Styles', 'Apply custom CSS enhancements', 
                                config.enableCustomStyles, (val) => handleChange('enableCustomStyles', val)),
                            SettingItem('Debug Mode', 'Show console logs for debugging', 
                                config.debugMode, (val) => handleChange('debugMode', val))
                        )
                    )
                ),
                
                // Footer
                React.createElement('div', { className: 'settings-footer' },
                    React.createElement('span', { className: 'version-info' }, `v${CORE_VERSION} (React)`),
                    React.createElement('div', { style: { display: 'flex', gap: '12px' } },
                        React.createElement('button', { className: 'btn btn-secondary', onClick: handleReset }, 'Reset Defaults'),
                        React.createElement('button', { className: 'btn btn-primary', onClick: handleSave }, 'Save Changes')
                    )
                )
            )
        );
    }
    
    // Helper components
    function SettingItem(label, description, checked, onChange) {
        return React.createElement('div', { className: 'setting-item' },
            React.createElement('div', null,
                React.createElement('div', { className: 'setting-label' }, label),
                React.createElement('div', { className: 'setting-description' }, description)
            ),
            React.createElement('label', { className: 'toggle-switch' },
                React.createElement('input', {
                    type: 'checkbox',
                    checked: checked,
                    onChange: (e) => onChange(e.target.checked)
                }),
                React.createElement('span', { className: 'toggle-slider' })
            )
        );
    }
    
    function NumberSettingItem(label, description, value, onChange, min, max, step) {
        return React.createElement('div', { className: 'setting-item' },
            React.createElement('div', null,
                React.createElement('div', { className: 'setting-label' }, label),
                React.createElement('div', { className: 'setting-description' }, description)
            ),
            React.createElement('input', {
                type: 'number',
                className: 'number-input',
                value: value,
                min: min,
                max: max,
                step: step,
                onChange: (e) => onChange(parseFloat(e.target.value))
            })
        );
    }
    
    function SelectSettingItem(label, description, value, onChange, options) {
        return React.createElement('div', { className: 'setting-item' },
            React.createElement('div', null,
                React.createElement('div', { className: 'setting-label' }, label),
                React.createElement('div', { className: 'setting-description' }, description)
            ),
            React.createElement('select', {
                className: 'select-input',
                value: value,
                onChange: (e) => onChange(e.target.value)
            },
                options.map(opt =>
                    React.createElement('option', { key: opt, value: opt },
                        opt === 1.0 ? `${opt}x (Normal)` : `${opt}x`
                    )
                )
            )
        );
    }
    
    // ============================================================
    // SETTINGS PANEL WRAPPER CLASS
    // ============================================================
    
    class SettingsPanel {
        constructor(configManager, toastManager) {
            this.configManager = configManager;
            this.toastManager = toastManager;
            this.isOpen = false;
            this.shadowHost = null;
        }

        createShadowHost() {
            this.shadowHost = document.createElement('div');
            this.shadowHost.id = 'netflix-enhancer-settings';
            const shadow = this.shadowHost.attachShadow({ mode: 'open' });
            
            // Create React root in Shadow DOM
            this.reactRoot = ReactDOM.createRoot(shadow);
            
            // Load Font Awesome in Shadow DOM
            const faLink = document.createElement('link');
            faLink.rel = 'stylesheet';
            faLink.href = 'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css';
            faLink.crossOrigin = 'anonymous';
            shadow.appendChild(faLink);
            
            const style = document.createElement('style');
            style.textContent = `
                * { box-sizing: border-box; margin: 0; padding: 0; }
                
                .settings-overlay {
                    position: fixed; top: 0; left: 0; right: 0; bottom: 0;
                    background: rgba(0, 0, 0, 0.85);
                    z-index: 999998; display: flex;
                    align-items: center; justify-content: center;
                    backdrop-filter: blur(4px);
                    animation: fadeIn 0.2s ease-out;
                }
                
                @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
                
                .settings-panel {
                    background: #18181b; border-radius: 12px;
                    width: 90%; max-width: 700px; max-height: 85vh;
                    overflow: hidden; display: flex; flex-direction: column;
                    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.8);
                    animation: slideUp 0.3s ease-out;
                }
                
                @keyframes slideUp {
                    from { transform: translateY(50px); opacity: 0; }
                    to { transform: translateY(0); opacity: 1; }
                }
                
                .settings-header {
                    background: #27272a; color: white; padding: 20px;
                    display: flex; justify-content: space-between; align-items: center;
                    border-bottom: 1px solid #3f3f46;
                }
                
                .settings-title {
                    font-family: Netflix Sans, Helvetica, Arial, sans-serif;
                    font-size: 24px; font-weight: 700;
                }
                
                .close-btn {
                    background: none; border: none; color: white;
                    font-size: 28px; cursor: pointer; padding: 0;
                    width: 32px; height: 32px; display: flex;
                    align-items: center; justify-content: center;
                    border-radius: 4px; transition: background 0.2s;
                }
                
                .close-btn:hover { background: rgba(255, 255, 255, 0.1); }
                
                .tabs-container {
                    display: flex;
                    background: #27272a;
                    border-bottom: 1px solid #3f3f46;
                    padding: 0 20px;
                }
                
                .tab-btn {
                    background: none; border: none;
                    color: #a1a1aa; padding: 12px 20px;
                    font-family: Netflix Sans, Helvetica, Arial, sans-serif;
                    font-size: 14px; font-weight: 500;
                    cursor: pointer; transition: all 0.2s;
                    border-bottom: 2px solid transparent;
                    position: relative;
                }
                
                .tab-btn:hover { color: #e4e4e7; }
                
                .tab-btn.active {
                    color: #fafafa;
                    border-bottom-color: #a78bfa;
                }
                
                .tab-content {
                    display: none;
                }
                
                .tab-content.active {
                    display: block;
                }
                
                .settings-body {
                    padding: 20px; overflow-y: auto; flex: 1;
                }
                
                .setting-group {
                    margin-bottom: 24px;
                }
                
                .setting-group-title {
                    color: #fafafa;
                    font-family: Netflix Sans, Helvetica, Arial, sans-serif;
                    font-size: 16px; font-weight: 600;
                    margin-bottom: 12px; padding-bottom: 8px;
                    border-bottom: 1px solid #3f3f46;
                }
                
                .setting-item {
                    display: flex; justify-content: space-between;
                    align-items: center; padding: 12px;
                    background: #27272a; border-radius: 8px;
                    margin-bottom: 8px; transition: background 0.2s;
                }
                
                .setting-item:hover { background: #3f3f46; }
                
                .setting-label {
                    color: #fafafa;
                    font-family: Netflix Sans, Helvetica, Arial, sans-serif;
                    font-size: 14px;
                }
                
                .setting-description {
                    color: #a1a1aa; font-size: 12px; margin-top: 4px;
                }
                
                .toggle-switch {
                    position: relative; width: 50px; height: 26px;
                }
                
                .toggle-switch input { opacity: 0; width: 0; height: 0; }
                
                .toggle-slider {
                    position: absolute; cursor: pointer;
                    top: 0; left: 0; right: 0; bottom: 0;
                    background-color: #564d4d; transition: 0.3s;
                    border-radius: 26px;
                }
                
                .toggle-slider:before {
                    position: absolute; content: "";
                    height: 18px; width: 18px;
                    left: 4px; bottom: 4px;
                    background-color: white;
                    transition: 0.3s; border-radius: 50%;
                }
                
                input:checked + .toggle-slider { background-color: #7c3aed; }
                input:checked + .toggle-slider:before { transform: translateX(24px); }
                
                .number-input, .select-input {
                    background: #3f3f46; border: 1px solid #52525b;
                    color: white; padding: 8px 12px;
                    border-radius: 6px; font-size: 14px;
                }
                
                .number-input { width: 80px; }
                .select-input { cursor: pointer; }
                
                .number-input:focus, .select-input:focus {
                    outline: none; border-color: #a78bfa;
                }
                
                .settings-footer {
                    padding: 16px 20px; background: #27272a;
                    border-top: 1px solid #3f3f46;
                    display: flex; justify-content: space-between;
                    align-items: center;
                    gap: 12px;
                    flex-wrap: wrap;
                }
                
                .btn {
                    padding: 10px 20px; border: none; border-radius: 6px;
                    font-family: Netflix Sans, Helvetica, Arial, sans-serif;
                    font-size: 14px; font-weight: 600;
                    cursor: pointer; transition: all 0.2s;
                    white-space: nowrap;
                }
                
                .btn-primary { background: #7c3aed; color: white; }
                .btn-primary:hover { background: #6d28d9; }
                .btn-secondary { background: #3f3f46; color: white; }
                .btn-secondary:hover { background: #52525b; }
                
                .version-info {
                    color: #666; font-size: 11px;
                    font-family: Netflix Sans, Helvetica, Arial, sans-serif;
                }
                
                .watchlist-info {
                    color: #a1a1aa; font-size: 13px; padding: 12px;
                    background: #27272a; border-radius: 6px;
                    margin-bottom: 16px; line-height: 1.4;
                }
                
                .watchlist-empty {
                    text-align: center; padding: 40px 20px;
                    color: #71717a;
                }
                
                .watchlist-empty i {
                    font-size: 48px; margin-bottom: 16px;
                    opacity: 0.3;
                }
                
                .watchlist-empty p {
                    margin: 8px 0; font-size: 14px;
                }
                
                .watchlist-empty .small {
                    font-size: 12px; opacity: 0.7;
                }
                
                .watchlist-items {
                    display: flex; flex-direction: column;
                    gap: 8px;
                }
                
                .watchlist-item {
                    display: flex; justify-content: space-between;
                    align-items: center; padding: 12px;
                    background: #27272a; border-radius: 8px;
                    transition: background 0.2s;
                }
                
                .watchlist-item:hover {
                    background: #3f3f46;
                }
                
                .watchlist-item-info {
                    flex: 1;
                }
                
                .watchlist-item-title {
                    color: #fafafa; font-size: 14px;
                    font-weight: 500; margin-bottom: 4px;
                }
                
                .watchlist-item-date {
                    color: #a1a1aa; font-size: 12px;
                }
                
                .watchlist-item-actions {
                    display: flex; gap: 8px;
                }
                
                .watchlist-btn {
                    width: 32px; height: 32px;
                    border: none; border-radius: 6px;
                    cursor: pointer; transition: all 0.2s;
                    display: flex; align-items: center;
                    justify-content: center;
                }
                
                .watchlist-btn-visit {
                    background: #3f3f46; color: #fafafa;
                }
                
                .watchlist-btn-visit:hover {
                    background: #7c3aed;
                }
                
                .watchlist-btn-remove {
                    background: #3f1f1f; color: #fca5a5;
                }
                
                .watchlist-btn-remove:hover {
                    background: #7f1d1d;
                }
                
                .clear-watchlist-btn {
                    background: #3f3f46; color: #fafafa;
                    border: none; padding: 6px 12px;
                    border-radius: 6px; font-size: 12px;
                    cursor: pointer; transition: all 0.2s;
                    margin-left: auto;
                }
                
                .clear-watchlist-btn:hover {
                    background: #52525b;
                }
                
                .setting-group-title {
                    display: flex; justify-content: space-between;
                    align-items: center;
                }
            `;
            
            shadow.appendChild(style);
            document.body.appendChild(this.shadowHost);
        }

        async open() {
            if (this.isOpen) return;
            this.isOpen = true;
            
            if (!this.shadowHost) this.createShadowHost();
            
            // Render React component
            this.reactRoot.render(
                React.createElement(SettingsPanelComponent, {
                    configManager: this.configManager,
                    toastManager: this.toastManager,
                    watchlistManager: window.netflixEnhancerWatchlist,
                    onClose: () => this.close()
                })
            );
        }

        close() {
            if (!this.isOpen) return;
            this.isOpen = false;
            
            // Render null instead of unmounting to keep the root reusable
            this.reactRoot.render(null);
        }
    }

    // ============================================================
    // FLOATING CONTROL BUTTON
    // ============================================================
    
    class FloatingButton {
        constructor(settingsPanel, configManager) {
            this.settingsPanel = settingsPanel;
            this.configManager = configManager;
            this.button = null;
            
            // Listen for config changes
            configManager.onChange('showFloatingButton', (show) => {
                if (show && !this.button) {
                    this.create();
                } else if (!show && this.button) {
                    this.button.remove();
                    this.button = null;
                }
            });
        }

        create() {
            if (this.button || !this.configManager.get('showFloatingButton')) return;
            
            this.button = document.createElement('div');
            this.button.id = 'ne-float-btn';
            this.button.innerHTML = '<i class="fa-solid fa-film"></i>';
            this.button.title = 'Netflix Enhancer Settings (Ctrl+Shift+E)';
            
            GM_addStyle(`
                #ne-float-btn {
                    position: fixed;
                    bottom: 80px;
                    right: 20px;
                    width: 56px;
                    height: 56px;
                    background: linear-gradient(135deg, #7c3aed, #6d28d9);
                    color: white;
                    border-radius: 50%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-size: 24px;
                    cursor: pointer;
                    z-index: 999997;
                    box-shadow: 0 4px 12px rgba(124, 58, 237, 0.4);
                    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
                    user-select: none;
                    font-family: 'Font Awesome 6 Free';
                }
                
                #ne-float-btn:hover {
                    transform: scale(1.1) rotate(5deg);
                    box-shadow: 0 6px 20px rgba(124, 58, 237, 0.6);
                    background: linear-gradient(135deg, #a78bfa, #7c3aed);
                }
                
                #ne-float-btn:active {
                    transform: scale(0.95);
                }
                
                @keyframes ne-pulse {
                    0%, 100% { transform: scale(1); }
                    50% { transform: scale(1.05); }
                }
            `);
            
            this.button.addEventListener('click', () => {
                this.settingsPanel.open();
            });
            
            document.body.appendChild(this.button);
        }
    }

    // ============================================================
    // AUTO-SKIP MANAGER
    // ============================================================
    
    class AutoSkipManager {
        constructor(configManager, toastManager) {
            this.configManager = configManager;
            this.toastManager = toastManager;
            this.observer = null;
            this.lastSkipTime = 0;
        }

        init() {
            this.observer = new MutationObserver(() => {
                this.checkForSkipButtons();
            });

            this.observer.observe(document.body, {
                childList: true,
                subtree: true
            });

            console.log('[Netflix Enhancer] AutoSkip Manager initialized');
        }

        checkForSkipButtons() {
            const config = this.configManager.get();
            
            // Skip intro button
            if (config.autoSkipIntro) {
                const skipIntro = document.querySelector('[data-uia="player-skip-intro"]');
                if (skipIntro && this.isVisible(skipIntro)) {
                    this.handleSkipButton(skipIntro, 'intro');
                }
            }
            
            // Skip recap button
            if (config.autoSkipRecap) {
                const skipRecap = document.querySelector('[data-uia="player-skip-recap"]');
                if (skipRecap && this.isVisible(skipRecap)) {
                    this.handleSkipButton(skipRecap, 'recap');
                }
            }
            
            // Skip credits / Watch next button
            if (config.autoSkipCredits) {
                const skipCredits = document.querySelector('[data-uia="next-episode-seamless-button"]');
                if (skipCredits && this.isVisible(skipCredits)) {
                    this.handleSkipButton(skipCredits, 'credits', false); // Don't highlight
                }
            }
        }

        isVisible(element) {
            return element && element.offsetParent !== null;
        }

        handleSkipButton(button, type, shouldHighlight = true) {
            const config = this.configManager.get();
            const now = Date.now();
            
            // Highlight button if enabled
            if (config.highlightSkipButton && shouldHighlight) {
                button.style.border = '3px solid #a78bfa';
                button.style.boxShadow = '0 0 15px rgba(167, 139, 250, 0.6)';
            }
            
            // Auto-click after delay (prevent duplicate clicks)
            const skipKey = `skip-${type}`;
            if (!button.dataset[skipKey] && now - this.lastSkipTime > 2000) {
                button.dataset[skipKey] = 'true';
                
                setTimeout(() => {
                    if (this.isVisible(button)) {
                        button.click();
                        this.lastSkipTime = Date.now();
                        this.toastManager.show(`Skipped ${type}`, 1500, 'fa-forward-step');
                        console.log(`[Netflix Enhancer] Auto-skipped ${type}`);
                    }
                }, config.skipDelay);
            }
        }

        destroy() {
            if (this.observer) {
                this.observer.disconnect();
            }
        }
    }

    // ============================================================
    // VIDEO PLAYER CONTROLLER
    // ============================================================
    
    class VideoController {
        constructor(configManager, toastManager) {
            this.configManager = configManager;
            this.toastManager = toastManager;
            this.video = null;
            this.currentSpeed = 1.0;
            this.setupObserver();
            this.setupConfigListeners();
        }
        
        setupConfigListeners() {
            // Listen for defaultSpeed changes
            this.configManager.onChange('defaultSpeed', (newSpeed) => {
                if (this.video && newSpeed) {
                    this.video.playbackRate = newSpeed;
                    this.currentSpeed = newSpeed;
                    this.toastManager.show(`Speed changed to ${newSpeed}x`, 1500);
                }
            });
            
            // Listen for enableKeyboardShortcuts changes
            this.configManager.onChange('enableKeyboardShortcuts', (enabled) => {
                if (enabled) {
                    this.toastManager.show('Keyboard shortcuts enabled', 1500);
                } else {
                    this.toastManager.show('Keyboard shortcuts disabled', 1500);
                }
            });
        }

        setupObserver() {
            const observer = new MutationObserver(() => {
                const video = document.querySelector('video');
                if (video && !this.video) {
                    this.video = video;
                    this.enhanceVideo();
                }
            });

            observer.observe(document.body, {
                childList: true,
                subtree: true
            });
        }

        enhanceVideo() {
            if (!this.video) return;
            
            console.log('[Netflix Enhancer] Video player enhanced');
            
            // Set default speed
            const defaultSpeed = this.configManager.get('defaultSpeed');
            if (defaultSpeed && defaultSpeed !== 1.0) {
                this.video.playbackRate = defaultSpeed;
                this.currentSpeed = defaultSpeed;
            }
            
            // Add keyboard shortcuts
            if (this.configManager.get('enableKeyboardShortcuts')) {
                this.setupKeyboardShortcuts();
            }
        }

        setupKeyboardShortcuts() {
            document.addEventListener('keydown', (e) => {
                if (!this.configManager.get('enableKeyboardShortcuts')) return;
                if (!this.video) return;
                
                // Skip if typing in input
                if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
                
                const key = e.key.toLowerCase();
                
                // S - Toggle playback speed
                if (key === 's' && this.configManager.get('enableCustomSpeed')) {
                    e.preventDefault();
                    this.toggleSpeed();
                }
                
                // R - Rewind 10 seconds
                if (key === 'r') {
                    e.preventDefault();
                    this.video.currentTime = Math.max(0, this.video.currentTime - 10);
                    this.toastManager.show('Rewinded 10s', 1000, 'fa-backward-fast');
                }
                
                // F - Forward 10 seconds
                if (key === 'f') {
                    e.preventDefault();
                    this.video.currentTime = Math.min(this.video.duration, this.video.currentTime + 10);
                    this.toastManager.show('Forwarded 10s', 1000, 'fa-forward-fast');
                }
            });
            
            console.log('[Netflix Enhancer] Keyboard shortcuts enabled: S (speed), R (rewind), F (forward)');
        }

        toggleSpeed() {
            if (!this.video) return;
            
            const speeds = [0.5, 0.75, 1.0, 1.25, 1.5, 2.0];
            const currentIndex = speeds.indexOf(this.currentSpeed);
            const nextIndex = (currentIndex + 1) % speeds.length;
            const newSpeed = speeds[nextIndex];
            
            this.video.playbackRate = newSpeed;
            this.currentSpeed = newSpeed;
            
            this.toastManager.show(`Speed: ${newSpeed}x`, 1500, 'fa-bolt');
            console.log(`[Netflix Enhancer] Playback speed: ${newSpeed}x`);
        }
    }

    // ============================================================
    // TITLE CARD ENHANCER
    // ============================================================
    
    class TitleCardEnhancer {
        constructor(configManager, toastManager, watchlistManager) {
            this.configManager = configManager;
            this.toastManager = toastManager;
            this.watchlistManager = watchlistManager;
            this.observer = null;
        }

        init() {
            if (!this.configManager.get('enhanceTitleCards')) return;
            
            GM_addStyle(`
                .ptrack-content:hover .boxart-container {
                    transform: scale(1.15);
                    transition: transform 0.4s cubic-bezier(0.4, 0, 0.2, 1);
                }
                
                .ptrack-content .boxart-container {
                    transition: transform 0.3s ease;
                }
                
                .ne-watchlist-btn {
                    position: absolute;
                    top: 8px;
                    right: 8px;
                    width: 32px;
                    height: 32px;
                    background: rgba(20, 20, 20, 0.9);
                    border: 1px solid rgba(255, 255, 255, 0.2);
                    border-radius: 50%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    cursor: pointer;
                    opacity: 0;
                    transition: all 0.3s ease;
                    z-index: 10;
                    color: white;
                    font-size: 14px;
                }
                
                .ptrack-content:hover .ne-watchlist-btn {
                    opacity: 1;
                }
                
                .ne-watchlist-btn:hover {
                    background: #7c3aed;
                    border-color: #7c3aed;
                    transform: scale(1.1);
                }
                
                .ne-watchlist-btn.in-watchlist {
                    background: #7c3aed;
                    border-color: #7c3aed;
                    opacity: 1;
                }
                
                .ne-progress-bar {
                    position: absolute;
                    bottom: 0;
                    left: 0;
                    right: 0;
                    height: 4px;
                    background: rgba(229, 9, 20, 0.3);
                    z-index: 10;
                    overflow: hidden;
                }
                
                .ne-progress-fill {
                    height: 100%;
                    background: #e50914;
                    transition: width 0.3s ease;
                }
                
                .ne-progress-badge {
                    position: absolute;
                    bottom: 12px;
                    left: 8px;
                    padding: 4px 8px;
                    background: rgba(20, 20, 20, 0.95);
                    border-radius: 4px;
                    font-size: 11px;
                    color: white;
                    font-weight: 600;
                    opacity: 0;
                    transition: opacity 0.3s ease;
                    z-index: 11;
                    backdrop-filter: blur(8px);
                    border: 1px solid rgba(255, 255, 255, 0.1);
                }
                
                .ptrack-content:hover .ne-progress-badge {
                    opacity: 1;
                }
                
                .ne-progress-badge.almost-done {
                    background: rgba(124, 58, 237, 0.95);
                    border-color: rgba(124, 58, 237, 0.3);
                }
            `);
            
            this.observer = new MutationObserver(() => {
                this.enhanceTitleCards();
            });

            this.observer.observe(document.body, {
                childList: true,
                subtree: true
            });
            
            console.log('[Netflix Enhancer] Title card enhancements enabled');
        }

        enhanceTitleCards() {
            const titleCards = document.querySelectorAll('.ptrack-content');
            titleCards.forEach(card => {
                if (!card.dataset.enhanced) {
                    card.dataset.enhanced = 'true';
                    
                    // Add watchlist button if enabled
                    if (this.configManager.get('showWatchlistButtons')) {
                        this.addWatchlistButton(card);
                    }
                    
                    // Add progress bar
                    this.addProgressBar(card);
                    
                    card.addEventListener('mouseenter', () => {
                        const link = card.querySelector('a');
                        const title = link?.getAttribute('aria-label');
                        if (title && this.configManager.get('debugMode')) {
                            console.log(`[Netflix Enhancer] Hovering: ${title}`);
                        }
                    });
                }
            });
        }
        
        addWatchlistButton(card) {
            const container = card.querySelector('.boxart-container');
            if (!container || container.querySelector('.ne-watchlist-btn')) return;

            const link = card.querySelector('a');
            const url = link ? link.href : null;
            const title = link ? link.getAttribute('aria-label') : 'Unknown Title';

            // Resolve ID from URL or app state
            const id = extractVideoIdFromUrl(url) || getCurrentVideoIdFromAppState() || `card-${Date.now()}`;
            
            const button = document.createElement('button');
            button.className = 'ne-watchlist-btn';
            button.innerHTML = '<i class="fa-solid fa-plus"></i>';
            button.title = 'Add to Continue Watching';
            
            // Check if already in watchlist
            if (this.watchlistManager.isInWatchlist(id)) {
                button.classList.add('in-watchlist');
                button.innerHTML = '<i class="fa-solid fa-check"></i>';
                button.title = 'In Continue Watching';
            }
            
            button.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                
                if (this.watchlistManager.isInWatchlist(id)) {
                    this.watchlistManager.removeFromWatchlist(id);
                    button.classList.remove('in-watchlist');
                    button.innerHTML = '<i class="fa-solid fa-plus"></i>';
                    button.title = 'Add to Continue Watching';
                } else {
                    this.watchlistManager.addToWatchlist({
                        id,
                        title,
                        url
                    });
                    button.classList.add('in-watchlist');
                    button.innerHTML = '<i class="fa-solid fa-check"></i>';
                    button.title = 'In Continue Watching';
                }
            });
            
            container.style.position = 'relative';
            container.appendChild(button);
        }
        
        addProgressBar(card) {
            const container = card.querySelector('.boxart-container');
            if (!container || container.querySelector('.ne-progress-bar')) return;

            const link = card.querySelector('a');
            const url = link ? link.href : null;
            const videoId = extractVideoIdFromUrl(url);
            
            if (!videoId) return;

            const progressData = getVideoProgressData(videoId);
            if (!progressData || !progressData.isStarted) return;

            // Create progress bar
            const progressBar = document.createElement('div');
            progressBar.className = 'ne-progress-bar';
            
            const progressFill = document.createElement('div');
            progressFill.className = 'ne-progress-fill';
            progressFill.style.width = `${progressData.progressPercent}%`;
            
            progressBar.appendChild(progressFill);
            container.appendChild(progressBar);

            // Create progress badge
            const badge = document.createElement('div');
            badge.className = 'ne-progress-badge';
            
            if (progressData.isAlmostFinished) {
                badge.classList.add('almost-done');
                badge.innerHTML = `<i class="fa-solid fa-check"></i> ${Math.round(progressData.progressPercent)}% watched`;
            } else {
                const remaining = formatTime(progressData.remainingSeconds);
                badge.textContent = `${Math.round(progressData.progressPercent)}% \u2022 ${remaining} left`;
            }
            
            container.appendChild(badge);
        }

        destroy() {
            if (this.observer) {
                this.observer.disconnect();
            }
        }
    }

    // ============================================================
    // CUSTOM STYLES
    // ============================================================
    
    function applyCustomStyles(configManager) {
        if (!configManager.get('enableCustomStyles')) return;
        
        GM_addStyle(`
            /* Improved video player controls visibility */
            .watch-video--player-view .PlayerControlsNeo__layout {
                background: linear-gradient(to top, rgba(0,0,0,0.9) 0%, transparent 100%) !important;
            }
            
            /* Smooth transitions */
            * {
                transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1);
            }
        `);
        
        console.log('[Netflix Enhancer] Custom styles applied');
    }
// ============================================================
    // MAIN APPLICATION
    // ============================================================
    
    class NetflixEnhancer {
        constructor() {
            this.configManager = new ConfigManager(DEFAULT_CONFIG);
            this.toastManager = null;
            this.watchlistManager = null;
            this.settingsPanel = null;
            this.floatingButton = null;
            this.autoSkipManager = null;
            this.videoController = null;
            this.titleCardEnhancer = null;
        }

        async init() {
            console.log('[Netflix Enhancer Pro] v2.1 - Initializing...');
            
            // Initialize config first
            await this.configManager.init();
            
            // Wait for body
            await this.waitForBody();
            
            // Initialize components
            this.toastManager = new ToastManager(this.configManager);
            this.watchlistManager = new WatchlistManager(this.toastManager);
            await this.watchlistManager.init();
            
            // Make watchlist globally accessible for React component
            window.netflixEnhancerWatchlist = this.watchlistManager;
            
            this.settingsPanel = new SettingsPanel(this.configManager, this.toastManager);
            this.floatingButton = new FloatingButton(this.settingsPanel, this.configManager);
            this.autoSkipManager = new AutoSkipManager(this.configManager, this.toastManager);
            this.videoController = new VideoController(this.configManager, this.toastManager);
            this.titleCardEnhancer = new TitleCardEnhancer(this.configManager, this.toastManager, this.watchlistManager);
            
            // Apply custom styles
            applyCustomStyles(this.configManager);
            
            // Initialize features
            this.autoSkipManager.init();
            this.titleCardEnhancer.init();
            this.floatingButton.create();
            
            // Setup global keyboard shortcut
            this.setupGlobalShortcuts();
            
            // Show short version toast on each load
            setTimeout(() => {
                const runtimeCoreVersion = window.__NETFLIX_ENHANCER_CORE_VERSION || CORE_VERSION;
                const coreSource = window.__NETFLIX_ENHANCER_CORE_SOURCE || 'unknown';
                this.toastManager.show(`Netflix Enhancer v${runtimeCoreVersion} • ${coreSource}`, 2200, 'fa-circle-info');
            }, 1000);
            
            const runtimeCoreVersion = window.__NETFLIX_ENHANCER_CORE_VERSION || CORE_VERSION;
            console.log(`[Netflix Enhancer Pro] v${runtimeCoreVersion} (React Edition) - Fully initialized!`);
            console.log('[Netflix Enhancer Pro] Powered by React ' + React.version);
            console.log('[Netflix Enhancer Pro] Keyboard shortcuts:');
            console.log('   Ctrl+Shift+E - Open settings');
            console.log('   S - Toggle playback speed');
            console.log('   R - Rewind 10 seconds');
            console.log('   F - Forward 10 seconds');
        }

        waitForBody() {
            return new Promise((resolve) => {
                if (document.body) {
                    resolve();
                } else {
                    const observer = new MutationObserver(() => {
                        if (document.body) {
                            observer.disconnect();
                            resolve();
                        }
                    });
                    observer.observe(document.documentElement, {
                        childList: true,
                        subtree: true
                    });
                }
            });
        }

        setupGlobalShortcuts() {
            document.addEventListener('keydown', (e) => {
                // Ctrl+Shift+E - Open settings
                if (e.ctrlKey && e.shiftKey && e.key === 'E') {
                    e.preventDefault();
                    this.settingsPanel.open();
                }
                
                // ? - Show help (future feature)
                if (e.key === '?' && !e.ctrlKey && !e.shiftKey && !e.altKey) {
                    const target = e.target.tagName;
                    if (target !== 'INPUT' && target !== 'TEXTAREA') {
                        this.showHelp();
                    }
                }
            });
        }

        showHelp() {
            this.toastManager.show('Press Ctrl+Shift+E to open settings', 3000);
        }
    }

    // ============================================================
    // START THE APPLICATION
    // ============================================================
    
    const app = new NetflixEnhancer();
    
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => app.init());
    } else {
        app.init();
    }
