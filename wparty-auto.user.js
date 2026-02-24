// ==UserScript==
// @name         WPARTY Auto - Mobile Optimized Edition
// @namespace    https://github.com/DdepRest/wparty-auto-
// @version      11.4.0
// @description  Реструктурированная вкладка "Автоматика" + оптимизация + защита от ошибок
// @author       DdepRest
// @license      MIT
// @match        *://wparty.net/*
// @match        *://*.stloadi.live/*
// @match        *://stloadi.live/*
// @match        *://*.akmeism-as.stloadi.live/*
// @run-at       document-idle
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_deleteValue
// @grant        GM_listValues
// @grant        GM_xmlhttpRequest
// @grant        GM_registerMenuCommand
// @grant        GM_addStyle
// @connect      raw.githubusercontent.com
// @updateURL    https://raw.githubusercontent.com/DdepRest/wparty-auto-/main/wparty-auto.user.js
// @downloadURL  https://raw.githubusercontent.com/DdepRest/wparty-auto-/main/wparty-auto.user.js
// @supportURL   https://github.com/DdepRest/wparty-auto-/issues
// @homepageURL  https://github.com/DdepRest/wparty-auto-
// @icon         https://www.google.com/s2/favicons?sz=64&domain=wparty.net
// ==/UserScript==

/**
 * WPARTY Auto - Mobile Optimized Edition (v11.4.0)
 * Реструктурированная вкладка "Автоматика" + оптимизация + защита от ошибок
 */

(function() {
'use strict';

if (window.__WPARTY_INITIALIZED__) {
    console.log('[WPARTY] Already initialized, skipping...');
    return;
}
window.__WPARTY_INITIALIZED__ = true;

const IS_TOP = window.top === window.self;
const IS_PLAYER = window.location.hostname.includes('stloadi.live');

// ═══════════════════════════════════════════════════════════
// КОНФИГУРАЦИЯ СКРИПТА
// ═══════════════════════════════════════════════════════════
const CONFIG = {
    version: '11.4.0',
    releaseDate: '2026-02-25',

    intervals: {
        check: 1500,          // Увеличено с 1000 для снижения нагрузки
        volumeCheck: 5000     // Увеличено с 3000 для снижения нагрузки
    },

    timeouts: {
        volumeApply: 150,
        volumeRestore: 100,
        domWait: 500,
        volumeInitial: 1000,
        volumeRetry: 3000,
        nextCountdown: 7000,
        nextEpisode: 15000,
        autoSync: 3000
    },

    mobileIntervals: {
        check: 2000,          // Увеличено с 1500
        volumeCheck: 6000     // Увеличено с 4000
    },

    mobileTimeouts: {
        volumeApply: 200,
        volumeRestore: 150,
        domWait: 600,
        volumeInitial: 1200,
        volumeRetry: 3500,
        nextCountdown: 8000,
        nextEpisode: 18000,
        autoSync: 4000,
        gestureDelay: 250,
        touchFeedback: 100
    },

    debounce: {
        volumeChange: 200,
        input: 300
    },

    mobileDebounce: {
        volumeChange: 300,
        input: 400
    },

    trustedOrigins: [
        'wparty.net',
        'stloadi.live',
        'akmeism-as.stloadi.live'
    ],

    mobileFeatures: {
        touchOptimized: true,
        reducedAnimations: false,
        simplifiedUI: false,
        energySaving: false,
        largerTouchTargets: true,
        gestureNav: true,
        hapticFeedback: true,
        swipeToClose: true,
        tapToScroll: true
    },

    mobileAdaptations: {
        minTouchTargetSize: 48,
        maxTouchTargetSize: 56,
        energySaveFactor: 0.7,
        reducedAnimationOpacity: 0.6,
        touchScrollSensitivity: 1.5,
        swipeThreshold: 50,
        swipeVelocityThreshold: 0.3,
        doubleTapDelay: 300,
        longPressDelay: 500,
        edgeSwipeArea: 20
    },

    defaults: {
        autoNext: false,
        autoSeason: false,
        skipCredits: false,
        skipMode: 'percent',
        skipPercent: 95,
        skipSeconds: 90,
        volumeControl: false,
        volumeOSD: false,
        compressor: false,
        animations: true,
        transitionSpeed: 'normal',
        showNotifications: true,
        showPanel: true,
        panelPosition: 'right',
        theme: 'neon-dark',
        compactMode: false,
        advancedUI: true,
        smartResume: true,
        autoPause: false,
        playbackSpeed: 1.0,
        autoSync: false
    },

    storage: {
        version: 4,
        encryption: false,
        backup: true
    }
};

// ═══════════════════════════════════════════════════════════
// УТИЛИТЫ
// ═══════════════════════════════════════════════════════════
const Utils = {
    debounce(fn, delay) {
        let timeout;
        return function(...args) {
            clearTimeout(timeout);
            timeout = setTimeout(() => fn.apply(this, args), delay);
        };
    },

    throttle(fn, delay) {
        let last = 0;
        return function(...args) {
            const now = Date.now();
            if (now - last >= delay) {
                last = now;
                fn.apply(this, args);
            }
        };
    },

    clamp(v, min, max) {
        const num = Number(v);
        if (isNaN(num)) return min;
        return Math.max(min, Math.min(max, num));
    },

    isTrustedOrigin(origin) {
        if (!origin) return false;
        try {
            const url = new URL(origin);
            return CONFIG.trustedOrigins.some(trusted =>
                url.hostname === trusted || url.hostname.endsWith(`.${trusted}`)
            );
        } catch {
            return false;
        }
    },

    safeJSONParse(str, fallback = null) {
        try {
            return JSON.parse(str);
        } catch {
            return fallback;
        }
    },

    validateMessage(data) {
        if (!data || typeof data !== 'object') return false;
        if (!data.type || typeof data.type !== 'string') return false;
        return true;
    },

    isMobile() {
        return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
               (window.matchMedia('(max-width: 768px)').matches);
    },

    hapticFeedback(pattern = 'light') {
        if (!CONFIG.mobileFeatures.hapticFeedback || !navigator.vibrate) return;
        const patterns = {
            light: [10],
            medium: [20],
            heavy: [30],
            success: [50, 50, 50],
            error: [50, 50, 50, 50, 50],
            warning: [30, 30, 30]
        };
        try {
            navigator.vibrate(patterns[pattern] || patterns.light);
        } catch (e) {}
    }
};

// ═══════════════════════════════════════════════════════════
// ЛОГИРОВАНИЕ
// ═══════════════════════════════════════════════════════════
const Logger = {
    levels: { debug: 0, info: 1, success: 2, warning: 3, error: 4 },
    currentLevel: 1,

    log(msg, type = 'info') {
        if (this.levels[type] < this.currentLevel) return;
        const icons = { debug: '🔍', info: '📘', success: '✅', warning: '⚠️', error: '❌' };
        const styles = { debug: 'color: #71717a', info: 'color: #a78bfa', success: 'color: #34d399', warning: 'color: #fbbf24', error: 'color: #f87171' };
        const context = IS_PLAYER ? '[PLAYER]' : '[MAIN]';
        console.log(`%c${icons[type]} WPARTY v${CONFIG.version} ${context}: ${msg}`, styles[type]);
    },
    debug(msg) { this.log(msg, 'debug'); },
    info(msg) { this.log(msg, 'info'); },
    success(msg) { this.log(msg, 'success'); },
    warn(msg) { this.log(msg, 'warning'); },
    error(msg) { this.log(msg, 'error'); }
};

// ═══════════════════════════════════════════════════════════
// СОСТОЯНИЕ ПРИЛОЖЕНИЯ
// ═══════════════════════════════════════════════════════════
const State = {
    settings: {},
    hasTriggered: false,
    currentShowId: null,
    showListOpen: false,
    panelOpen: false,
    activeTab: 'auto',

    intervals: {
        progress: null,
        volumeCheck: null
    },

    volume: {
        userMuted: false,
        isApplying: false,
        lastUserVolume: 0.5,
        observer: null,
        channel: null,
        hookedElements: new WeakSet(),
        compressor: null,
        audioContext: null
    },

    audio: {
        sourceNode: null,
        currentVideoId: null
    },

    dom: {
        cache: new Map(),
        observers: []
    },

    cleanup: [],

    ui: {
        initialized: false,
        theme: 'neon-dark',
        compactMode: false,
        historySignature: '',
        liveObserver: null,
        nextCountdown: null
    },

    sync: {
        timeout: null,
        lastEpisode: null
    }
};

// ═══════════════════════════════════════════════════════════
// DOM МЕНЕДЖЕР
// ═══════════════════════════════════════════════════════════
const DOM = {
    select(sel, cache = true) {
        if (cache && State.dom.cache.has(sel)) {
            const el = State.dom.cache.get(sel);
            if (document.contains(el)) return el;
            State.dom.cache.delete(sel);
        }
        const el = document.querySelector(sel);
        if (el && cache) State.dom.cache.set(sel, el);
        return el;
    },

    selectAll(sel) {
        return document.querySelectorAll(sel);
    },

    clearCache() {
        State.dom.cache.clear();
    },

    video() { return this.select('video', false); },
    volumeSlider() { return this.select('input[data-allplay="volume"]', false); },
    muteBtn() { return this.select('button[data-allplay="mute"]', false); },
    seekSlider() { return this.select('input[data-allplay="seek"]', false); },
    syncBtn() { return this.select('button.syncBtn', false); },
    playerIframe() { return this.select('#moviePlayer, iframe[src*="stloadi.live"]', false); },

    getVideoId() {
        const video = this.video();
        if (!video) return null;
        if (!video.dataset.wpaId) {
            video.dataset.wpaId = Utils.generateId();
        }
        return video.dataset.wpaId;
    }
};

// ═══════════════════════════════════════════════════════════
// МЕНЕДЖЕР ЖЕСТОВ (TOUCH / SWIPE)
// ═══════════════════════════════════════════════════════════
const GestureManager = {
    touchStartX: 0,
    touchStartY: 0,
    touchStartTime: 0,
    lastTapTime: 0,
    isDragging: false,

    get threshold() {
        return CONFIG.mobileAdaptations?.swipeThreshold || 50;
    },

    get velocityThreshold() {
        return CONFIG.mobileAdaptations?.swipeVelocityThreshold || 0.3;
    },

    init() {
        if (!CONFIG.mobileFeatures?.gestureNav || !Utils.isMobile()) return;

        document.addEventListener('touchstart', this.handleTouchStart.bind(this), { passive: true });
        document.addEventListener('touchmove', this.handleTouchMove.bind(this), { passive: true });
        document.addEventListener('touchend', this.handleTouchEnd.bind(this), { passive: true });

        Logger.debug('Менеджер жестов инициализирован');
    },

    handleTouchStart(e) {
        if (e.touches.length > 1) return;

        this.touchStartX = e.touches[0].clientX;
        this.touchStartY = e.touches[0].clientY;
        this.touchStartTime = Date.now();

        const edgeArea = CONFIG.mobileAdaptations?.edgeSwipeArea || 20;
        const isEdgeSwipe = this.touchStartX <= edgeArea || this.touchStartX >= window.innerWidth - edgeArea;

        if (isEdgeSwipe && this.touchStartX < window.innerWidth / 2) {
            this.isDragging = true;
            Utils.hapticFeedback('light');
        }
    },

    handleTouchMove(e) {
        if (!this.isDragging || e.touches.length > 1) return;

        const diffX = e.touches[0].clientX - this.touchStartX;
        const diffY = e.touches[0].clientY - this.touchStartY;

        if (Math.abs(diffX) > this.threshold && Math.abs(diffX) > Math.abs(diffY)) {
            e.preventDefault();
        }
    },

    handleTouchEnd(e) {
        if (!this.isDragging && e.changedTouches.length === 1) {
            const touchX = e.changedTouches[0].clientX;
            const touchY = e.changedTouches[0].clientY;
            const now = Date.now();

            const diffX = touchX - this.touchStartX;
            const diffY = touchY - this.touchStartY;
            const deltaTime = now - this.touchStartTime;

            if (deltaTime < 250 && Math.abs(diffX) < 10 && Math.abs(diffY) < 10) {
                if (now - this.lastTapTime < (CONFIG.mobileAdaptations?.doubleTapDelay || 300)) {
                    this.handleDoubleTap();
                }
                this.lastTapTime = now;
            }
        }

        if (!this.isDragging) return;

        const touchEndX = e.changedTouches[0].clientX;
        const touchEndY = e.changedTouches[0].clientY;
        const deltaTime = Date.now() - this.touchStartTime;

        const diffX = touchEndX - this.touchStartX;
        const diffY = touchEndY - this.touchStartY;
        const velocity = Math.abs(diffX) / deltaTime;

        if (Math.abs(diffX) > this.threshold && Math.abs(diffX) > Math.abs(diffY)) {
            if (diffX > 0 && velocity > this.velocityThreshold) {
                this.handleSwipeRight();
            } else if (diffX < 0 && velocity > this.velocityThreshold) {
                this.handleSwipeLeft();
            }
        }

        this.isDragging = false;
    },

    handleSwipeRight() {
        if (typeof Panel !== 'undefined' && !State.panelOpen) {
            Panel.toggle(true);
            Utils.hapticFeedback('success');
            Logger.debug('Свайг вправо: открытие панели');
        }
    },

    handleSwipeLeft() {
        if (typeof Panel !== 'undefined' && State.panelOpen && CONFIG.mobileFeatures.swipeToClose) {
            Panel.toggle(false);
            Utils.hapticFeedback('light');
            Logger.debug('Свайг влево: закрытие панели');
        }
    },

    handleDoubleTap() {
        if (typeof Panel !== 'undefined') {
            Panel.toggle();
            Utils.hapticFeedback('medium');
            Logger.debug('Двойной тап: переключение панели');
        }
    },

    cleanup() {
        document.removeEventListener('touchstart', this.handleTouchStart);
        document.removeEventListener('touchmove', this.handleTouchMove);
        document.removeEventListener('touchend', this.handleTouchEnd);
    }
};

// ═══════════════════════════════════════════════════════════
// ХРАНИЛИЩЕ
// ═══════════════════════════════════════════════════════════
const Storage = {
    get(key, def = null) {
        try {
            return GM_getValue(key, def);
        } catch {
            const data = localStorage.getItem(`wparty_${key}`);
            return data ? Utils.safeJSONParse(data, def) : def;
        }
    },

    set(key, val) {
        try {
            GM_setValue(key, val);
        } catch {
            try {
                localStorage.setItem(`wparty_${key}`, JSON.stringify(val));
            } catch (e) {
                Logger.error(`Не удалось сохранить ${key}: ${e.message}`);
            }
        }
    },

    migrate() {
        const currentVersion = this.get('storageVersion', 1);
        if (currentVersion >= CONFIG.storage.version) return;
        Logger.info(`Миграция хранилища ${currentVersion} → ${CONFIG.storage.version}`);
        this.set('storageVersion', CONFIG.storage.version);
    },

    loadSettings() {
        const s = {};
        Object.keys(CONFIG.defaults).forEach(k => {
            s[k] = this.get(k, CONFIG.defaults[k]);
        });
        State.volume.userMuted = this.get('volumeMuteState', false);
        State.volume.lastUserVolume = Utils.clamp(this.get('savedVolume', 0.5), 0, 1);
        return s;
    },

    saveSettings(newSettings) {
        State.settings = { ...State.settings, ...newSettings };
        Object.entries(newSettings).forEach(([k, v]) => this.set(k, v));
        if (typeof Panel !== 'undefined' && Panel.updateLiveUI) {
            Panel.updateLiveUI();
        }
    },

    getShowId() {
        const match = window.location.pathname.match(/\/(\d+)/);
        return match ? match[1] : window.location.pathname.split('/').filter(Boolean)[0] || 'unknown';
    },

    getShowName() {
        const iframe = DOM.select('#moviePlayer, iframe.videoContent', false);
        const iframeTitle = iframe?.getAttribute?.('title') || iframe?.title;
        if (iframeTitle) {
            const title = iframeTitle.trim();
            if (title && title.length > 0) {
                Logger.debug(`Название из iframe: ${title}`);
                return title.substring(0, 100);
            }
        }
        for (const sel of ['h1.header', 'h1', '.title']) {
            const el = DOM.select(sel, false);
            if (el?.textContent?.trim()) {
                return el.textContent.trim().substring(0, 100);
            }
        }
        const docTitle = (document.title || '').trim();
        if (docTitle) {
            return docTitle.substring(0, 100);
        }
        return 'Неизвестный сериал';
    },

    getWatchHistory() {
        const history = this.get('watchHistory', {});
        if (typeof history !== 'object' || Array.isArray(history)) return {};
        return history;
    },

    saveWatchHistory(season, episode) {
        const h = this.getWatchHistory();
        const id = State.currentShowId || this.getShowId();
        h[id] = {
            name: this.getShowName(),
            season: Utils.clamp(season, 1, 999),
            episode: Utils.clamp(episode, 1, 9999),
            timestamp: Date.now(),
            url: window.location.href,
            duration: DOM.video()?.duration || 0
        };
        this.set('watchHistory', h);
        if (typeof Panel !== 'undefined' && Panel.updateLiveUI) {
            Panel.updateLiveUI();
        }
    },

    refreshCurrentShowName() {
        const id = State.currentShowId || this.getShowId();
        const h = this.getWatchHistory();
        const current = h[id];
        if (!current) return;
        const name = this.getShowName();
        if (name && name !== 'Неизвестный сериал' && current.name !== name) {
            current.name = name;
            h[id] = current;
            this.set('watchHistory', h);
        }
    },

    clearWatchHistory() {
        this.set('watchHistory', {});
        if (typeof Panel !== 'undefined' && Panel.updateLiveUI) {
            Panel.updateLiveUI();
        }
    }
};

// ═══════════════════════════════════════════════════════════
// OFFLINE-РЕЖИМ И КЭШИРОВАНИЕ
// ═══════════════════════════════════════════════════════════
const OfflineCache = {
    cacheName: 'wparty-v1',
    isOnline: navigator.onLine,
    offlineState: null,
    cacheVersion: 1,

    init() {
        this.setupOnlineOfflineListeners();
        this.loadOfflineState();
        this.cleanupOldCaches();
        Logger.debug('OfflineCache инициализирован');
    },

    setupOnlineOfflineListeners() {
        window.addEventListener('online', () => {
            this.isOnline = true;
            Logger.info('🟢 Соединение восстановлено');
            this.onReconnect();
        });

        window.addEventListener('offline', () => {
            this.isOnline = false;
            Logger.warn('🔴 Работа в офлайн-режиме');
            this.onDisconnect();
        });
    },

    async loadOfflineState() {
        try {
            const cached = localStorage.getItem('wparty_offline_state');
            if (cached) {
                this.offlineState = JSON.parse(cached);
                Logger.debug('Загружено офлайн-состояние');
            }
        } catch (e) {
            Logger.error(`Ошибка загрузки офлайн-состояния: ${e.message}`);
        }
    },

    async saveOfflineState() {
        try {
            const state = {
                currentShow: State.currentShowId,
                settings: State.settings,
                volume: State.volume.lastUserVolume,
                timestamp: Date.now(),
                url: window.location.href
            };
            localStorage.setItem('wparty_offline_state', JSON.stringify(state));
            Logger.debug('Сохранено офлайн-состояние');
        } catch (e) {
            Logger.error(`Ошибка сохранения офлайн-состояния: ${e.message}`);
        }
    },

    async cacheCurrentPage() {
        if (!('caches' in window) || !this.isOnline) return;

        try {
            const cache = await caches.open(this.cacheName);
            await cache.add(window.location.href);
            Logger.debug('Страница закэширована');
        } catch (e) {
            Logger.debug(`Кэширование: ${e.message}`);
        }
    },

    async getCachedPage(url) {
        if (!('caches' in window)) return null;

        try {
            const cache = await caches.open(this.cacheName);
            const response = await cache.match(url);
            return response;
        } catch (e) {
            return null;
        }
    },

    onDisconnect() {
        this.saveOfflineState();
        if (typeof Panel !== 'undefined' && Panel.updateLiveUI) {
            Panel.updateLiveUI();
        }
        Notifications.show('📴 Работа в офлайн-режиме', 'warning', 3000);
    },

    onReconnect() {
        Notifications.show('📶 Соединение восстановлено', 'success', 3000);
        this.syncPendingData();
    },

    async syncPendingData() {
        // Синхронизация отложенных данных после восстановления соединения
        if (this.offlineState?.pendingHistory) {
            for (const record of this.offlineState.pendingHistory) {
                // восстановить историю
            }
            this.offlineState.pendingHistory = [];
            this.saveOfflineState();
        }
    },

    async cleanupOldCaches() {
        if (!('caches' in window)) return;

        try {
            const cacheNames = await caches.keys();
            for (const name of cacheNames) {
                if (name !== this.cacheName) {
                    await caches.delete(name);
                }
            }
        } catch (e) {}
    },

    // Проверка, можем ли мы работать офлайн
    canWorkOffline() {
        return this.offlineState !== null;
    },

    // Получить последнее известное состояние
    getLastKnownState() {
        return this.offlineState;
    }
};

// ═══════════════════════════════════════════════════════════
// ПРОИЗВОДИТЕЛЬНОСТЬ И ОПТИМИЗАЦИЯ
// ═══════════════════════════════════════════════════════════
const Performance = {
    idleCallbackHandle: null,
    visibilityHidden: false,
    memoryWarningReceived: false,

    init() {
        this.setupVisibilityListener();
        this.setupMemoryWarning();
        this.lazyLoadComponents();
        this.optimizeObserver();
        Logger.debug('Performance оптимизации активированы');
    },

    setupVisibilityListener() {
        document.addEventListener('visibilitychange', () => {
            this.visibilityHidden = document.hidden;

            if (this.visibilityHidden) {
                this.onHidden();
            } else {
                this.onVisible();
            }
        });

        window.addEventListener('blur', () => {
            this.onHidden();
        });

        window.addEventListener('focus', () => {
            this.onVisible();
        });
    },

    setupMemoryWarning() {
        if ('memory' in performance) {
            const checkMemory = () => {
                const memory = performance.memory;
                const usageRatio = memory.usedJSHeapSize / memory.jsHeapSizeLimit;

                if (usageRatio > 0.9 && !this.memoryWarningReceived) {
                    this.memoryWarningReceived = true;
                    Logger.warn('⚠️ Высокое потребление памяти, включаю оптимизацию');
                    this.aggressiveCleanup();
                } else if (usageRatio < 0.7) {
                    this.memoryWarningReceived = false;
                }
            };

            setInterval(checkMemory, 30000);
        }
    },

    onHidden() {
        Logger.debug('Страница скрыта, оптимизация...');

        // Остановить частые проверки
        if (State.intervals.volumeCheck) {
            clearInterval(State.intervals.volumeCheck);
            State.intervals.volumeCheck = null;
        }

        // Очистить кэш DOM
        DOM.clearCache();

        // Сохранить состояние
        OfflineCache.saveOfflineState();
    },

    onVisible() {
        Logger.debug('Страница видима, восстановление...');

        // Восстановить проверки громкости
        if (State.settings.volumeControl && !State.intervals.volumeCheck) {
            State.intervals.volumeCheck = setInterval(() => {
                Volume.checkAndRestore();
            }, CONFIG.intervals.volumeCheck);
        }

        // Обновить UI
        if (typeof Panel !== 'undefined' && Panel.updateLiveUI) {
            Panel.updateLiveUI();
        }
    },

    lazyLoadComponents() {
        this.idleCallbackHandle = requestIdleCallback(() => {
            // Загрузить второстепенные компоненты в фоновом режиме
            Logger.debug('Ленивая загрузка компонентов');

            // Предзагрузка истории
            Storage.getWatchHistory();

            // Инициализация авто-тематики (если есть)
            // AutoTheme.init();
        }, { timeout: 2000 });
    },

    optimizeObserver() {
        // Оптимизированный MutationObserver
        if (typeof Panel !== 'undefined' && Panel.startLiveObserver) {
            // Observer уже оптимизирован в Panel.startLiveObserver
        }
    },

    aggressiveCleanup() {
        // Агрессивная очистка при нехватке памяти
        DOM.clearCache();
        State.dom.observers.forEach(obs => {
            try { obs.disconnect(); } catch (e) {}
        });
        State.dom.observers = [];

        Logger.info('Выполнена агрессивная очистка памяти');
    },

    // Debounce для тяжёлых операций
    debounceHeavy(fn, delay = 300) {
        return Utils.debounce(fn, delay);
    },

    // Throttle для частых событий
    throttleFrequent(fn, limit = 100) {
        return Utils.throttle(fn, limit);
    },

    // Очистка при простое
    cleanupOnIdle() {
        if (this.idleCallbackHandle) {
            cancelIdleCallback(this.idleCallbackHandle);
        }

        this.idleCallbackHandle = requestIdleCallback(() => {
            DOM.clearCache();

            // Сжать историю, если слишком большая
            const history = Storage.getWatchHistory();
            const entries = Object.entries(history);
            if (entries.length > 100) {
                // Оставить только последние 50 записей
                const sorted = entries.sort((a, b) => b[1].timestamp - a[1].timestamp);
                const trimmed = Object.fromEntries(sorted.slice(0, 50));
                Storage.set('watchHistory', trimmed);
                Logger.debug('История сжата до 50 записей');
            }
        }, { timeout: 5000 });
    },

    // Измерение производительности
    measurePerformance() {
        if (typeof performance !== 'undefined' && performance.getEntriesByType) {
            const entries = performance.getEntriesByType('navigation')[0];
            if (entries) {
                Logger.debug(`Загрузка страницы: ${entries.loadEventEnd - entries.startTime}ms`);
                Logger.debug(`DOM готов: ${entries.domContentLoadedEventEnd - entries.startTime}ms`);
            }
        }
    }
};

// ═══════════════════════════════════════════════════════════
// МЕЖФРЕЙМОВАЯ КОММУНИКАЦИЯ
// ═══════════════════════════════════════════════════════════
const IframeComm = {
    sendToPlayer(type, data = {}) {
        const iframe = DOM.playerIframe();
        if (iframe?.contentWindow) {
            try {
                iframe.contentWindow.postMessage({ type, ...data, source: 'WPARTY_MAIN' }, '*');
                Logger.debug(`Отправлено в плеер: ${type}`);
            } catch (e) {
                Logger.error(`Ошибка отправки в iframe: ${e.message}`);
            }
        }
    },

    sendToParent(type, data = {}) {
        try {
            window.parent.postMessage({ type, ...data, source: 'WPARTY_PLAYER' }, '*');
            Logger.debug(`Отправлено родителю: ${type}`);
        } catch (e) {
            Logger.error(`Ошибка отправки родителю: ${e.message}`);
        }
    },

    setupListener() {
        const handler = (e) => {
            if (!Utils.isTrustedOrigin(e.origin)) return;
            if (!Utils.validateMessage(e.data)) return;
            if (!e.data.source || !e.data.source.startsWith('WPARTY_')) return;

            this.handleMessage(e.data, e.source);
        };

        window.addEventListener('message', handler);
        State.cleanup.push(() => window.removeEventListener('message', handler));
    },

    handleMessage(data, source) {
        Logger.debug(`Получено сообщение: ${data.type}`);

        switch (data.type) {
            case 'WPARTY_SET_VOLUME':
                if (IS_PLAYER) {
                    Volume.applyDirect(data.volume, data.showOSD);
                }
                break;

            case 'WPARTY_GET_VOLUME':
                if (IS_PLAYER) {
                    const vol = Volume.getCurrentVolume();
                    this.sendToParent('WPARTY_VOLUME_INFO', { volume: vol });
                }
                break;

            case 'WPARTY_ADJUST_VOLUME':
                if (IS_PLAYER) {
                    Volume.adjustDirect(data.delta);
                }
                break;

            case 'WPARTY_VOLUME_INFO':
            case 'WPARTY_VOLUME_CHANGED':
                if (!IS_PLAYER && data.volume !== undefined) {
                    State.volume.lastUserVolume = data.volume;
                    Storage.set('savedVolume', data.volume);
                    if (Panel.updateVolumeDisplay) Panel.updateVolumeDisplay();
                }
                break;

            case 'WPARTY_NEXT_EPISODE':
                if (!IS_PLAYER) {
                    Logger.info('Получен сигнал переключения на следующую серию');
                    const seconds = Math.round(CONFIG.timeouts.nextCountdown / 1000);
                    MainMode.startNextCountdown(seconds, () => MainMode.switchNext());
                }
                break;
        }
    }
};

// ═══════════════════════════════════════════════════════════
// АВТОСИНХРОНИЗАЦИЯ
// ═══════════════════════════════════════════════════════════
const AutoSync = {
    scheduleSync() {
        if (!State.settings.autoSync) return;

        if (State.sync.timeout) {
            clearTimeout(State.sync.timeout);
            State.sync.timeout = null;
        }

        State.sync.timeout = setTimeout(() => {
            this.performSync();
        }, CONFIG.timeouts.autoSync);

        Logger.debug('Запланирована автосинхронизация через ' + (CONFIG.timeouts.autoSync / 1000) + ' сек');
    },

    performSync() {
        if (!State.settings.autoSync) return;

        const syncBtn = DOM.syncBtn();
        if (syncBtn) {
            Logger.info('Выполняется автосинхронизация...');
            syncBtn.click();
            Notifications.show('🔄 Автосинхронизация выполнена', 'success', 2000);
        } else {
            Logger.warn('Кнопка синхронизации не найдена');
        }
    },

    onEpisodeChange() {
        if (!State.settings.autoSync) return;

        const currentEpisode = this.getCurrentEpisodeId();
        if (currentEpisode && currentEpisode !== State.sync.lastEpisode) {
            Logger.info('Обнаружена смена серии, запускаю автосинхронизацию');
            State.sync.lastEpisode = currentEpisode;
            this.scheduleSync();
        }
    },

    getCurrentEpisodeId() {
        try {
            const epDrop = DOM.select('div[name="episode"]', false);
            if (!epDrop) return null;

            const menu = epDrop.querySelector('.menu');
            if (!menu) return null;

            const cur = menu.querySelector('.item.active.selected');
            return cur ? cur.textContent.trim() : null;
        } catch (e) {
            return null;
        }
    },

    cancel() {
        if (State.sync.timeout) {
            clearTimeout(State.sync.timeout);
            State.sync.timeout = null;
            Logger.debug('Автосинхронизация отменена');
        }
    }
};

// ═══════════════════════════════════════════════════════════
// ИКОНКИ
// ═══════════════════════════════════════════════════════════
const Icons = {
    play: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="5 3 19 12 5 21 5 3"/></svg>`,
    pause: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>`,
    skipForward: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="5 4 15 12 5 20 5 4"/><line x1="19" y1="5" x2="19" y2="19"/></svg>`,
    volume: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"/></svg>`,
    volumeOff: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/></svg>`,
    settings: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>`,
    folder: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>`,
    clock: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>`,
    zap: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>`,
    tv: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="7" width="20" height="15" rx="2" ry="2"/><polyline points="17 2 12 7 7 2"/></svg>`,
    list: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>`,
    x: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`,
    check: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`,
    info: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>`,
    warning: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`,
    error: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>`,
    sparkles: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l1.912 5.813a2 2 0 0 0 1.275 1.275L21 12l-5.813 1.912a2 2 0 0 0-1.275 1.275L12 21l-1.912-5.813a2 2 0 0 0-1.275-1.275L3 12l5.813-1.912a2 2 0 0 0 1.275-1.275L12 3z"/></svg>`,
    bell: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>`,
    chevronRight: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>`,
    percent: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="19" y1="5" x2="5" y2="19"/><circle cx="6.5" cy="6.5" r="2.5"/><circle cx="17.5" cy="17.5" r="2.5"/></svg>`,
    github: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.627-5.479 5.927.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.97 8.389-7.862 8.389-14.855 0-8.836-7.163-16-16-16z"/></svg>`,
    externalLink: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>`,
    sync: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2"/></svg>`,
    stats: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>`,
    minus: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"/></svg>`,
    plus: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>`
};

// ═══════════════════════════════════════════════════════════
// УВЕДОМЛЕНИЯ
// ═══════════════════════════════════════════════════════════
const Notifications = {
    container: null,

    init() {
        if (this.container) return;
        this.container = document.createElement('div');
        this.container.className = 'wpa-toast-container';
        document.body.appendChild(this.container);
    },

    show(msg, type = 'info', dur = 3500) {
        if (!State.settings.showNotifications) return;
        if (IS_PLAYER) return;

        this.init();

        const icons = { info: Icons.info, success: Icons.check, warning: Icons.warning, error: Icons.error };
        const toast = document.createElement('div');
        toast.className = `wpa-toast wpa-toast--${type}`;
        toast.innerHTML = `
            <div class="wpa-toast__icon">${icons[type]}</div>
            <div class="wpa-toast__content"><span class="wpa-toast__message">${msg}</span></div>
            <button class="wpa-toast__close">${Icons.x}</button>
            <div class="wpa-toast__progress"></div>
        `;
        this.container.appendChild(toast);

        const closeBtn = toast.querySelector('.wpa-toast__close');
        const progress = toast.querySelector('.wpa-toast__progress');

        requestAnimationFrame(() => {
            toast.classList.add('wpa-toast--visible');
            progress.style.animationDuration = `${dur}ms`;
        });

        const remove = () => {
            toast.classList.add('wpa-toast--hiding');
            setTimeout(() => toast.remove(), 400);
        };

        closeBtn.addEventListener('click', remove);
        setTimeout(remove, dur);
    }
};

// ═══════════════════════════════════════════════════════════
// ГРОМКОСТЬ (ПОЛНАЯ ВЕРСИЯ С IFRAME ПОДДЕРЖКОЙ)
// ═══════════════════════════════════════════════════════════
const Volume = {
    lastAppliedVolume: null,
    lastApplyTime: 0,
    minApplyInterval: 500, // Минимальный интервал между применениями (мс)

    getSaved() {
        return Utils.clamp(Storage.get('savedVolume', 0.5), 0, 1);
    },

    save(vol) {
        const clamped = Utils.clamp(vol, 0, 1);
        State.volume.lastUserVolume = clamped;
        Storage.set('savedVolume', clamped);
        Logger.debug(`Громкость сохранена: ${Math.round(clamped * 100)}%`);
    },

    getCurrentVolume() {
        const slider = DOM.volumeSlider();
        if (slider) return parseFloat(slider.value) || 0;
        const video = DOM.video();
        if (video) return video.volume || 0;
        return this.getSaved();
    },

    // Применить громкость напрямую (вызывается в iframe плеера)
    applyDirect(vol, showOSD = true) {
        // Защита от слишком частого применения
        const now = Date.now();
        if (now - this.lastApplyTime < this.minApplyInterval) {
            return;
        }

        // Защита от повторного применения той же громкости
        const clamped = Utils.clamp(vol, 0, 1);
        if (this.lastAppliedVolume !== null &&
            Math.abs(clamped - this.lastAppliedVolume) < 0.01) {
            return;
        }

        if (State.volume.isApplying) return;
        State.volume.isApplying = true;

        this.lastApplyTime = now;
        this.lastAppliedVolume = clamped;

        Logger.info(`[PLAYER] Применяю громкость: ${Math.round(clamped * 100)}%`);

        try {
            const video = DOM.video();
            const slider = DOM.volumeSlider();
            const muteBtn = DOM.muteBtn();

            if (video) {
                video.volume = clamped;
                video.muted = clamped < 0.01;
            }

            if (slider) {
                const pct = clamped * 100;
                slider.value = clamped;
                slider.setAttribute('aria-valuenow', Math.round(pct));
                slider.setAttribute('aria-valuetext', `${pct.toFixed(1)}%`);
                slider.style.setProperty('--value', `${pct}%`);
                slider.dispatchEvent(new Event('input', { bubbles: true }));
                slider.dispatchEvent(new Event('change', { bubbles: true }));
            }

            if (muteBtn) {
                const muted = clamped < 0.01;
                muteBtn.classList.toggle('allplay__control--pressed', muted);
                muteBtn.setAttribute('aria-pressed', muted.toString());
            }

            this.save(clamped);
            IframeComm.sendToParent('WPARTY_VOLUME_CHANGED', { volume: clamped });

            if (showOSD && State.settings.volumeOSD) {
                this.showOSD(clamped);
            }

            AudioCompressor.sync();
        } catch (e) {
            Logger.error(`Ошибка применения громкости: ${e.message}`);
        } finally {
            setTimeout(() => { State.volume.isApplying = false; }, CONFIG.timeouts.volumeApply);
        }
    },

    adjustDirect(delta) {
        const current = this.getCurrentVolume();
        const newVol = Utils.clamp(current + delta, 0, 1);
        this.applyDirect(newVol, true);
    },

    // ДЛЯ ОСНОВНОЙ СТРАНИЦЫ
    setVolume(vol) {
        if (!State.settings.volumeControl) return;
        const clamped = Utils.clamp(vol, 0, 1);
        this.save(clamped);
        IframeComm.sendToPlayer('WPARTY_SET_VOLUME', { volume: clamped, showOSD: true });
        if (Panel.updateVolumeDisplay) Panel.updateVolumeDisplay();
    },

    adjustVolume(delta) {
        if (!State.settings.volumeControl) return;
        const current = this.getSaved();
        const newVol = Utils.clamp(current + delta, 0, 1);
        this.save(newVol);
        IframeComm.sendToPlayer('WPARTY_ADJUST_VOLUME', { delta });
        Notifications.show(`🔊 Громкость: ${Math.round(newVol * 100)}%`, 'info', 1500);
        if (Panel.updateVolumeDisplay) Panel.updateVolumeDisplay();
    },

    increaseVolume() { this.adjustVolume(0.05); },
    decreaseVolume() { this.adjustVolume(-0.05); },

    apply(showOSD = true) {
        if (!State.settings.volumeControl) return;
        const saved = this.getSaved();
        Logger.info(`Отправляю громкость в плеер: ${Math.round(saved * 100)}%`);
        IframeComm.sendToPlayer('WPARTY_SET_VOLUME', { volume: saved, showOSD });
    },

    checkAndRestore: Utils.throttle(function() {
        if (!State.settings.volumeControl || State.volume.isApplying || State.volume.userMuted) return;
        if (!IS_PLAYER) return;

        try {
            const slider = DOM.volumeSlider();
            const video = DOM.video();
            const saved = Volume.getSaved();
            const sliderVol = slider ? parseFloat(slider.value) : null;
            const videoVol = video ? video.volume : null;

            // Более строгая проверка необходимости восстановления
            const needsRestore =
                (sliderVol !== null && sliderVol < 0.01 && saved > 0.1) ||
                (videoVol !== null && videoVol < 0.01 && saved > 0.1) ||
                (video?.muted && !State.volume.userMuted && saved > 0.1);

            if (needsRestore) {
                Logger.warn('Сброс громкости обнаружен, восстанавливаю...');
                Volume.applyDirect(saved, false); // Без OSD при восстановлении
            }

            AudioCompressor.sync();
        } catch (e) {
            Logger.error(`Ошибка проверки громкости: ${e.message}`);
        }
    }, CONFIG.intervals.volumeCheck),

    showOSD(vol) {
        if (!IS_PLAYER) return;

        let osd = document.getElementById('wpa-volume-osd');
        if (!osd) {
            osd = document.createElement('div');
            osd.id = 'wpa-volume-osd';
            osd.className = 'wpa-osd';
            osd.innerHTML = `
                <div class="wpa-osd__icon">${Icons.volume}</div>
                <div class="wpa-osd__bar"><div class="wpa-osd__fill"></div></div>
                <div class="wpa-osd__value">50%</div>
            `;
            document.body.appendChild(osd);
        }

        const fill = osd.querySelector('.wpa-osd__fill');
        const value = osd.querySelector('.wpa-osd__value');
        const icon = osd.querySelector('.wpa-osd__icon');
        const pct = Math.round(vol * 100);

        fill.style.width = `${pct}%`;
        value.textContent = `${pct}%`;
        icon.innerHTML = State.volume.userMuted || vol < 0.01 ? Icons.volumeOff : Icons.volume;

        osd.classList.add('wpa-osd--visible');
        clearTimeout(osd._hideTimer);
        osd._hideTimer = setTimeout(() => { osd.classList.remove('wpa-osd--visible'); }, 1500);
    },

    hookControls() {
        if (!IS_PLAYER) return;
        if (!State.settings.volumeControl) return;

        const slider = DOM.volumeSlider();
        const video = DOM.video();
        const muteBtn = DOM.muteBtn();

        if (slider && !State.volume.hookedElements.has(slider)) {
            State.volume.hookedElements.add(slider);

            const handleInput = Utils.debounce((e) => {
                if (e.isTrusted && !State.volume.isApplying) {
                    const vol = parseFloat(slider.value);
                    State.volume.userMuted = vol < 0.01;
                    this.save(vol);
                    IframeComm.sendToParent('WPARTY_VOLUME_CHANGED', { volume: vol });
                    if (State.settings.volumeOSD) this.showOSD(vol);
                }
            }, CONFIG.debounce.volumeChange);

            slider.addEventListener('input', handleInput);
            State.cleanup.push(() => slider.removeEventListener('input', handleInput));

            if (!State.volume.observer) {
                State.volume.observer = new MutationObserver(Utils.throttle(() => {
                    if (!State.volume.isApplying) {
                        setTimeout(() => this.checkAndRestore(), 50);
                    }
                }, 1000));

                State.volume.observer.observe(slider, {
                    attributes: true,
                    attributeFilter: ['value', 'aria-valuenow']
                });

                State.cleanup.push(() => {
                    State.volume.observer.disconnect();
                    State.volume.observer = null;
                });
            }
        }

        if (video && !State.volume.hookedElements.has(video)) {
            State.volume.hookedElements.add(video);

            const handleLoaded = () => {
                if (State.settings.volumeControl) {
                    const saved = this.getSaved();
                    this.applyDirect(saved, false);
                }
            };

            const handleVolumeChange = Utils.debounce(() => {
                if (State.volume.isApplying) return;
                if (video.volume > 0.01 && !video.muted) {
                    this.save(video.volume);
                    IframeComm.sendToParent('WPARTY_VOLUME_CHANGED', { volume: video.volume });
                } else if (!State.volume.userMuted) {
                    setTimeout(() => this.checkAndRestore(), CONFIG.timeouts.volumeRestore);
                }
            }, CONFIG.debounce.volumeChange);

            video.addEventListener('loadedmetadata', handleLoaded);
            video.addEventListener('play', handleLoaded);
            video.addEventListener('volumechange', handleVolumeChange);

            State.cleanup.push(() => video.removeEventListener('loadedmetadata', handleLoaded));
            State.cleanup.push(() => video.removeEventListener('play', handleLoaded));
            State.cleanup.push(() => video.removeEventListener('volumechange', handleVolumeChange));
        }

        if (muteBtn && !State.volume.hookedElements.has(muteBtn)) {
            State.volume.hookedElements.add(muteBtn);

            const handleMute = (e) => {
                if (e.isTrusted) {
                    State.volume.userMuted = !State.volume.userMuted;
                    Storage.set('volumeMuteState', State.volume.userMuted);
                    if (!State.volume.userMuted) {
                        setTimeout(() => this.applyDirect(this.getSaved(), true), CONFIG.timeouts.volumeRestore);
                    }
                }
            };

            muteBtn.addEventListener('click', handleMute);
            State.cleanup.push(() => muteBtn.removeEventListener('click', handleMute));
        }

        if (!State.intervals.volumeCheck) {
            State.intervals.volumeCheck = setInterval(() => this.checkAndRestore(), CONFIG.intervals.volumeCheck);
        }

        AudioCompressor.sync();
        Logger.success('Хуки контролов громкости установлены');
    },

    requestCurrentVolume() {
        IframeComm.sendToPlayer('WPARTY_GET_VOLUME', {});
    }
};

// ═══════════════════════════════════════════════════════════
// АУДИО КОМПРЕССОР
// ═══════════════════════════════════════════════════════════
const AudioCompressor = {
    init() {
        if (!State.settings.compressor || !IS_PLAYER) return false;

        try {
            if (!State.volume.audioContext) {
                State.volume.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            }

            if (!State.volume.compressor) {
                State.volume.compressor = State.volume.audioContext.createDynamicsCompressor();
                State.volume.compressor.threshold.setValueAtTime(-12, State.volume.audioContext.currentTime);
                State.volume.compressor.knee.setValueAtTime(15, State.volume.audioContext.currentTime);
                State.volume.compressor.ratio.setValueAtTime(3, State.volume.audioContext.currentTime);
                State.volume.compressor.attack.setValueAtTime(0.003, State.volume.audioContext.currentTime);
                State.volume.compressor.release.setValueAtTime(0.25, State.volume.audioContext.currentTime);
            }

            return true;
        } catch (e) {
            Logger.error(`Ошибка инициализации компрессора: ${e.message}`);
            return false;
        }
    },

    connect() {
        if (!State.settings.compressor || !IS_PLAYER) return false;
        if (!this.init()) return false;

        const video = DOM.video();
        if (!video || !State.volume.compressor) return false;

        const videoId = DOM.getVideoId();

        if (State.audio.sourceNode && State.audio.currentVideoId === videoId) {
            return true;
        }

        this.disconnect();

        try {
            if (State.volume.audioContext.state === 'suspended') {
                State.volume.audioContext.resume();
            }

            State.audio.sourceNode = State.volume.audioContext.createMediaElementSource(video);
            State.audio.currentVideoId = videoId;

            State.audio.sourceNode.connect(State.volume.compressor);
            State.volume.compressor.connect(State.volume.audioContext.destination);

            Logger.info('Компрессор подключен');
            return true;
        } catch (e) {
            Logger.error(`Ошибка подключения компрессора: ${e.message}`);
            return false;
        }
    },

    disconnect() {
        try {
            if (State.audio.sourceNode) {
                State.audio.sourceNode.disconnect();
                State.audio.sourceNode = null;
            }
            if (State.volume.compressor) {
                State.volume.compressor.disconnect();
            }
            State.audio.currentVideoId = null;
        } catch (e) {}
    },

    disable() {
        this.disconnect();
        if (State.volume.audioContext && State.volume.audioContext.state !== 'closed') {
            State.volume.audioContext.close();
            State.volume.audioContext = null;
        }
        State.volume.compressor = null;
        Logger.info('Компрессор отключен');
    },

    sync() {
        if (!IS_PLAYER) return;

        if (!State.settings.compressor) {
            if (State.audio.sourceNode) this.disable();
            return;
        }

        const video = DOM.video();
        const videoId = DOM.getVideoId();

        if (video && videoId) {
            if (!State.audio.sourceNode || State.audio.currentVideoId !== videoId) {
                this.connect();
            }
        }
    },

    toggle() {
        if (State.settings.compressor) {
            this.sync();
        } else {
            this.disable();
        }
    }
};

// ═══════════════════════════════════════════════════════════
// ПРОПУСК ТИТРОВ
// ═══════════════════════════════════════════════════════════
const Credits = {
    shouldSkip(cur, dur) {
        if (!State.settings.skipCredits || !State.settings.autoNext) return false;
        if (!cur || !dur || dur <= 0) return false;

        if (State.settings.skipMode === 'percent') {
            const percent = (cur / dur) * 100;
            return percent >= State.settings.skipPercent;
        }

        return dur - cur <= State.settings.skipSeconds && dur - cur > 0;
    }
};
// ═══════════════════════════════════════════════════════════
// СТИЛИ (ПОЛНАЯ ВЕ������СИЯ)
// ═══════�����═══════════════════════�������═══════════════════════════
const injectStyles = () => {
    const css = `
@import url('https://fonts.googleapis.com/css2?family=Geist:wght@300;400;500;600;700&display=swap');

:root {
    --wpa-bg-primary: rgba(6, 6, 8, 0.98);
    --wpa-bg-secondary: rgba(10, 10, 14, 0.92);
    --wpa-bg-tertiary: rgba(14, 14, 18, 0.88);
    --wpa-glass: rgba(10, 10, 12, 0.55);
    --wpa-glass-strong: rgba(8, 8, 10, 0.8);
    --wpa-glass-border: rgba(255, 40, 55, 0.25);
    --wpa-glass-border-strong: rgba(255, 60, 80, 0.38);
    --wpa-glass-highlight: rgba(255, 255, 255, 0.06);
    --wpa-neon-cyan: #ff2d3d;
    --wpa-neon-green: #ff4757;
    --wpa-text-primary: rgba(255, 255, 255, 0.98);
    --wpa-text-secondary: rgba(255, 255, 255, 0.78);
    --wpa-text-muted: rgba(255, 255, 255, 0.6);
    --wpa-gradient-1: linear-gradient(135deg, #ff2d3d, #a80b23);
    --wpa-gradient-2: linear-gradient(135deg, #ff4757, #ff2d3d);
    --wpa-radius-sm: 8px;
    --wpa-radius-md: 12px;
    --wpa-radius-lg: 16px;
    --wpa-radius-xl: 24px;
    --wpa-radius-full: 9999px;
    --wpa-transition-fast: 0.2s cubic-bezier(0.4, 0, 0.2, 1);
    --wpa-transition-normal: 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    --wpa-z-fab: 999999999;
    --wpa-z-panel: 999999998;
    --wpa-z-toast: 999999996;
    --wpa-z-osd: 999999997;
}

@keyframes wpa-float { 0%, 100% { transform: translateY(0px); } 50% { transform: translateY(-5px); } }
@keyframes wpa-glow-pulse { 0%, 100% { opacity: 0.7; } 50% { opacity: 1; } }
@keyframes wpa-shimmer { 0% { background-position: -200% center; } 100% { background-position: 200% center; } }
@keyframes wpa-slide-in-right { from { transform: translateX(100%); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
@keyframes wpa-fade-in { from { opacity: 0; } to { opacity: 1; } }
@keyframes wpa-toast-progress { from { transform: scaleX(1); } to { transform: scaleX(0); } }

/* FAB Button */
.wpa-fab {
    position: fixed !important;
    bottom: 20px !important;
    right: 20px !important;
    z-index: var(--wpa-z-fab) !important;
    width: 56px !important;
    height: 56px !important;
    border: none !important;
    border-radius: var(--wpa-radius-full) !important;
    background: var(--wpa-gradient-1) !important;
    cursor: pointer !important;
    display: flex !important;
    align-items: center !important;
    justify-content: center !important;
    box-shadow: 0 4px 30px rgba(0, 0, 0, 0.5), 0 0 25px rgba(255, 80, 95, 0.45) !important;
    transition: all var(--wpa-transition-normal) !important;
    animation: wpa-fade-in 0.5s ease-out, wpa-float 3s ease-in-out infinite !important;
}

.wpa-fab:hover {
    transform: scale(1.15) !important;
    box-shadow: 0 8px 40px rgba(0, 0, 0, 0.7), 0 0 50px rgba(255, 80, 95, 0.85) !important;
}

.wpa-fab__icon {
    width: 24px !important;
    height: 24px !important;
    color: white !important;
    filter: drop-shadow(0 0 8px currentColor) !important;
}

.wpa-fab__badge {
    position: absolute !important;
    top: -4px !important;
    right: -4px !important;
    width: 20px !important;
    height: 20px !important;
    background: var(--wpa-gradient-2) !important;
    border-radius: var(--wpa-radius-full) !important;
    display: flex !important;
    align-items: center !important;
    justify-content: center !important;
    font-size: 10px !important;
    font-weight: 900 !important;
    color: black !important;
    box-shadow: 0 0 15px var(--wpa-neon-green) !important;
    animation: wpa-glow-pulse 2s ease-in-out infinite !important;
    border: 2px solid var(--wpa-bg-primary) !important;
}

/* Panel */
.wpa-panel {
    position: fixed !important;
    top: 0 !important;
    right: 0 !important;
    bottom: 0 !important;
    width: 420px !important;
    background: var(--wpa-glass-strong) !important;
    backdrop-filter: blur(28px) saturate(140%) !important;
    border-left: 1px solid var(--wpa-glass-border) !important;
    display: flex !important;
    flex-direction: column !important;
    transform: translateX(100%) !important;
    transition: transform var(--wpa-transition-normal) !important;
    z-index: var(--wpa-z-panel) !important;
    box-shadow: -12px 0 45px rgba(0, 0, 0, 0.65) !important;
    overflow: hidden !important;
}

.wpa-panel--open {
    transform: translateX(0) !important;
    animation: wpa-slide-in-right 0.3s cubic-bezier(0.4, 0, 0.2, 1) !important;
}

.wpa-panel-overlay {
    position: fixed !important;
    top: 0 !important;
    left: 0 !important;
    width: 100% !important;
    height: 100% !important;
    background: rgba(0, 0, 0, 0.5) !important;
    backdrop-filter: blur(4px) !important;
    z-index: calc(var(--wpa-z-panel) - 1) !important;
    opacity: 0 !important;
    visibility: hidden !important;
    transition: all var(--wpa-transition-normal) !important;
}

.wpa-panel-overlay--visible {
    opacity: 1 !important;
    visibility: visible !important;
}

.wpa-panel__header {
    padding: 20px 24px !important;
    background: var(--wpa-bg-secondary) !important;
    border-bottom: 1px solid rgba(255, 255, 255, 0.1) !important;
    display: flex !important;
    align-items: center !important;
    justify-content: space-between !important;
    position: relative !important;
}

.wpa-panel__header::before {
    content: '' !important;
    position: absolute !important;
    top: 0 !important;
    left: 0 !important;
    right: 0 !important;
    height: 3px !important;
    background: var(--wpa-gradient-1) !important;
    animation: wpa-shimmer 3s linear infinite !important;
    background-size: 200% 100% !important;
}

.wpa-panel__brand {
    display: flex !important;
    align-items: center !important;
    gap: 12px !important;
}

.wpa-panel__logo {
    width: 36px !important;
    height: 36px !important;
    background: var(--wpa-gradient-1) !important;
    border-radius: var(--wpa-radius-md) !important;
    display: flex !important;
    align-items: center !important;
    justify-content: center !important;
    font-weight: 700 !important;
    color: white !important;
    box-shadow: 0 0 20px rgba(255, 80, 95, 0.35) !important;
}

.wpa-panel__title {
    font-family: 'Geist', sans-serif !important;
    font-size: 18px !important;
    font-weight: 700 !important;
    color: var(--wpa-text-primary) !important;
}

.wpa-panel__version {
    font-size: 11px !important;
    color: var(--wpa-neon-cyan) !important;
    font-weight: 500 !important;
}

.wpa-panel__close {
    width: 32px !important;
    height: 32px !important;
    border: none !important;
    background: rgba(255, 255, 255, 0.05) !important;
    border-radius: var(--wpa-radius-sm) !important;
    color: var(--wpa-text-secondary) !important;
    cursor: pointer !important;
    display: flex !important;
    align-items: center !important;
    justify-content: center !important;
    transition: all var(--wpa-transition-fast) !important;
}

.wpa-panel__close:hover {
    background: rgba(255, 255, 255, 0.1) !important;
    color: var(--wpa-text-primary) !important;
}

.wpa-panel__tabs {
    display: flex !important;
    background: var(--wpa-bg-secondary) !important;
    border-bottom: 1px solid rgba(255, 255, 255, 0.1) !important;
    padding: 0 8px !important;
}

.wpa-tab {
    flex: 1 !important;
    padding: 16px 12px !important;
    background: transparent !important;
    border: none !important;
    color: var(--wpa-text-secondary) !important;
    font-family: 'Geist', sans-serif !important;
    font-size: 13px !important;
    font-weight: 500 !important;
    cursor: pointer !important;
    display: flex !important;
    flex-direction: column !important;
    align-items: center !important;
    gap: 6px !important;
    position: relative !important;
    transition: all var(--wpa-transition-fast) !important;
}

.wpa-tab:hover {
    color: var(--wpa-text-primary) !important;
    background: rgba(255, 255, 255, 0.05) !important;
}

.wpa-tab--active {
    color: var(--wpa-neon-cyan) !important;
}

.wpa-tab--active::after {
    content: '' !important;
    position: absolute !important;
    bottom: -1px !important;
    left: 12px !important;
    right: 12px !important;
    height: 3px !important;
    background: var(--wpa-gradient-1) !important;
    border-radius: 2px !important;
    box-shadow: 0 0 15px var(--wpa-neon-cyan) !important;
}

.wpa-tab__icon {
    width: 18px !important;
    height: 18px !important;
}

.wpa-tab__label {
    font-size: 11px !important;
    font-weight: 600 !important;
}

.wpa-panel__body {
    flex: 1 !important;
    overflow-y: auto !important;
    padding: 24px !important;
    scrollbar-width: thin !important;
    scrollbar-color: rgba(255, 80, 95, 0.3) transparent !important;
}

.wpa-panel__body::-webkit-scrollbar {
    width: 6px !important;
}

.wpa-panel__body::-webkit-scrollbar-track {
    background: transparent !important;
}

.wpa-panel__body::-webkit-scrollbar-thumb {
    background: rgba(255, 80, 95, 0.3) !important;
    border-radius: 3px !important;
}

.wpa-panel__body::-webkit-scrollbar-thumb:hover {
    background: rgba(255, 80, 95, 0.5) !important;
}

.wpa-tab-content {
    display: none !important;
}

.wpa-tab-content--active {
    display: block !important;
    animation: wpa-fade-in 0.3s ease-out !important;
}

.wpa-section {
    margin-bottom: 32px !important;
}

.wpa-section__header {
    display: flex !important;
    align-items: center !important;
    gap: 10px !important;
    margin-bottom: 20px !important;
}

.wpa-section__icon {
    width: 16px !important;
    height: 16px !important;
    color: var(--wpa-neon-cyan) !important;
}

.wpa-section__title {
    font-family: 'Geist', sans-serif !important;
    font-size: 13px !important;
    font-weight: 600 !important;
    color: var(--wpa-text-secondary) !important;
    text-transform: uppercase !important;
    letter-spacing: 0.08em !important;
}

.wpa-option {
    display: flex !important;
    align-items: center !important;
    gap: 16px !important;
    padding: 16px !important;
    background: var(--wpa-glass) !important;
    border: 1px solid var(--wpa-glass-border) !important;
    border-radius: var(--wpa-radius-md) !important;
    margin-bottom: 12px !important;
    transition: all var(--wpa-transition-fast) !important;
}

.wpa-option:hover {
    background: var(--wpa-bg-tertiary) !important;
    border-color: var(--wpa-glass-border-strong) !important;
    transform: translateX(4px) !important;
}

.wpa-option__icon {
    width: 32px !important;
    height: 32px !important;
    background: rgba(255, 80, 95, 0.12) !important;
    border-radius: var(--wpa-radius-sm) !important;
    display: flex !important;
    align-items: center !important;
    justify-content: center !important;
    flex-shrink: 0 !important;
}

.wpa-option__icon svg {
    width: 16px !important;
    height: 16px !important;
    color: var(--wpa-neon-cyan) !important;
}

.wpa-option__content {
    flex: 1 !important;
}

.wpa-option__title {
    font-family: 'Geist', sans-serif !important;
    font-size: 14px !important;
    font-weight: 600 !important;
    color: var(--wpa-text-primary) !important;
    margin-bottom: 4px !important;
}

.wpa-option__desc {
    font-size: 12px !important;
    color: var(--wpa-text-secondary) !important;
    line-height: 1.4 !important;
}

/* Toggle Switch */
.wpa-toggle {
    position: relative !important;
    width: 44px !important;
    height: 24px !important;
    flex-shrink: 0 !important;
}

.wpa-toggle__input {
    opacity: 0 !important;
    width: 0 !important;
    height: 0 !important;
}

.wpa-toggle__track {
    position: absolute !important;
    cursor: pointer !important;
    top: 0 !important;
    left: 0 !important;
    right: 0 !important;
    bottom: 0 !important;
    background: rgba(255, 255, 255, 0.1) !important;
    border-radius: var(--wpa-radius-full) !important;
    transition: all var(--wpa-transition-fast) !important;
    border: 1px solid rgba(255, 255, 255, 0.15) !important;
}

.wpa-toggle__thumb {
    position: absolute !important;
    top: 2px !important;
    left: 2px !important;
    width: 20px !important;
    height: 20px !important;
    background: var(--wpa-text-secondary) !important;
    border-radius: var(--wpa-radius-full) !important;
    transition: all var(--wpa-transition-fast) !important;
}

.wpa-toggle__input:checked + .wpa-toggle__track {
    background: rgba(255, 80, 95, 0.2) !important;
    border-color: var(--wpa-neon-cyan) !important;
}

.wpa-toggle__input:checked + .wpa-toggle__track .wpa-toggle__thumb {
    left: calc(100% - 22px) !important;
    background: var(--wpa-neon-cyan) !important;
    box-shadow: 0 0 10px var(--wpa-neon-cyan) !important;
}

/* Volume Controls */
.wpa-volume-controls {
    display: flex !important;
    align-items: center !important;
    gap: 12px !important;
    padding: 16px !important;
    background: var(--wpa-glass) !important;
    border: 1px solid var(--wpa-glass-border) !important;
    border-radius: var(--wpa-radius-md) !important;
    margin-bottom: 12px !important;
}

.wpa-volume-btn {
    width: 44px !important;
    height: 44px !important;
    border: none !important;
    background: rgba(255, 80, 95, 0.15) !important;
    border-radius: var(--wpa-radius-sm) !important;
    color: var(--wpa-neon-cyan) !important;
    cursor: pointer !important;
    display: flex !important;
    align-items: center !important;
    justify-content: center !important;
    transition: all var(--wpa-transition-fast) !important;
    flex-shrink: 0 !important;
}

.wpa-volume-btn:hover {
    background: rgba(255, 80, 95, 0.25) !important;
    transform: scale(1.05) !important;
}

.wpa-volume-btn:active {
    transform: scale(0.95) !important;
}

.wpa-volume-btn svg {
    width: 20px !important;
    height: 20px !important;
}

.wpa-volume-display {
    flex: 1 !important;
    text-align: center !important;
    font-family: 'Geist', sans-serif !important;
    font-size: 24px !important;
    font-weight: 700 !important;
    color: var(--wpa-text-primary) !important;
}

/* Quick Actions */
.wpa-quick-actions {
    display: grid !important;
    grid-template-columns: repeat(3, 1fr) !important;
    gap: 12px !important;
    margin-bottom: 28px !important;
}

.wpa-quick-action {
    display: flex !important;
    flex-direction: column !important;
    align-items: center !important;
    gap: 8px !important;
    padding: 16px 12px !important;
    background: var(--wpa-glass) !important;
    border: 1px solid var(--wpa-glass-border) !important;
    border-radius: var(--wpa-radius-md) !important;
    cursor: pointer !important;
    transition: all var(--wpa-transition-fast) !important;
}

.wpa-quick-action:hover {
    transform: translateY(-2px) !important;
    background: var(--wpa-bg-tertiary) !important;
}

.wpa-quick-action--active {
    background: rgba(255, 80, 95, 0.18) !important;
    border-color: var(--wpa-neon-cyan) !important;
}

.wpa-quick-action__icon {
    width: 20px !important;
    height: 20px !important;
    color: var(--wpa-neon-cyan) !important;
}

.wpa-quick-action__label {
    font-size: 11px !important;
    font-weight: 600 !important;
    color: var(--wpa-text-secondary) !important;
    text-align: center !important;
}

/* Status */
.wpa-status {
    display: flex !important;
    align-items: center !important;
    gap: 12px !important;
    padding: 16px !important;
    background: var(--wpa-glass) !important;
    border: 1px solid var(--wpa-glass-border) !important;
    border-radius: var(--wpa-radius-md) !important;
    margin-bottom: 24px !important;
}

.wpa-status__dot {
    width: 10px !important;
    height: 10px !important;
    background: var(--wpa-text-muted) !important;
    border-radius: var(--wpa-radius-full) !important;
    flex-shrink: 0 !important;
}

.wpa-status--active .wpa-status__dot {
    background: var(--wpa-neon-green) !important;
    box-shadow: 0 0 15px var(--wpa-neon-green) !important;
    animation: wpa-glow-pulse 2s ease-in-out infinite !important;
}

.wpa-status__text {
    flex: 1 !important;
}

.wpa-status__title {
    font-size: 14px !important;
    font-weight: 600 !important;
    color: var(--wpa-text-primary) !important;
}

.wpa-status__desc {
    font-size: 12px !important;
    color: var(--wpa-text-secondary) !important;
    margin-top: 2px !important;
}

/* Now Playing */
.wpa-now {
    margin-bottom: 24px !important;
    padding: 16px !important;
    background: var(--wpa-glass) !important;
    border: 1px solid var(--wpa-glass-border) !important;
    border-radius: var(--wpa-radius-md) !important;
    position: relative !important;
    overflow: hidden !important;
}

.wpa-now::before {
    content: '' !important;
    position: absolute !important;
    inset: 0 !important;
    background: radial-gradient(500px circle at 10% 0%, rgba(255, 80, 95, 0.18), transparent 60%) !important;
    pointer-events: none !important;
}

.wpa-now__title {
    font-size: 12px !important;
    font-weight: 700 !important;
    text-transform: uppercase !important;
    letter-spacing: 0.12em !important;
    color: var(--wpa-text-secondary) !important;
    margin-bottom: 10px !important;
    position: relative !important;
}

.wpa-now__row {
    display: flex !important;
    gap: 10px !important;
    margin-bottom: 8px !important;
    position: relative !important;
}

.wpa-now__chip {
    flex: 1 !important;
    padding: 10px 12px !important;
    background: rgba(255, 80, 95, 0.15) !important;
    border-radius: var(--wpa-radius-sm) !important;
    font-size: 12px !important;
    font-weight: 600 !important;
    color: var(--wpa-text-primary) !important;
    text-align: center !important;
}

.wpa-now__meta {
    font-size: 11px !important;
    color: var(--wpa-text-muted) !important;
    letter-spacing: 0.02em !important;
    position: relative !important;
}

/* Segments */
.wpa-segments {
    display: flex !important;
    background: var(--wpa-glass) !important;
    border: 1px solid var(--wpa-glass-border) !important;
    border-radius: var(--wpa-radius-md) !important;
    margin-bottom: 15px !important;
    overflow: hidden !important;
}

.wpa-segment {
    flex: 1 !important;
    padding: 12px !important;
    text-align: center !important;
    background: transparent !important;
    border: none !important;
    color: var(--wpa-text-secondary) !important;
    font-family: 'Geist', sans-serif !important;
    font-size: 13px !important;
    font-weight: 500 !important;
    cursor: pointer !important;
    transition: all var(--wpa-transition-fast) !important;
}

.wpa-segment:hover {
    color: var(--wpa-text-primary) !important;
    background: rgba(255, 255, 255, 0.05) !important;
}

.wpa-segment--active {
    background: var(--wpa-gradient-1) !important;
    color: white !important;
}

/* Input */
.wpa-input {
    width: 100% !important;
    padding: 10px !important;
    background: var(--wpa-glass) !important;
    border: 1px solid var(--wpa-glass-border) !important;
    border-radius: var(--wpa-radius-md) !important;
    color: var(--wpa-text-primary) !important;
    font-family: 'Geist', sans-serif !important;
    font-weight: 600 !important;
    text-align: center !important;
    outline: none !important;
    transition: all var(--wpa-transition-fast) !important;
}

.wpa-input:focus {
    border-color: var(--wpa-neon-cyan) !important;
    box-shadow: 0 0 0 2px rgba(255, 80, 95, 0.35) !important;
}

/* Footer */
.wpa-panel__footer {
    padding: 15px 20px !important;
    background: var(--wpa-bg-secondary) !important;
    border-top: 1px solid rgba(255, 255, 255, 0.1) !important;
    display: flex !important;
    justify-content: center !important;
    gap: 20px !important;
}

.wpa-footer-link {
    display: flex !important;
    align-items: center !important;
    gap: 8px !important;
    color: var(--wpa-text-secondary) !important;
    text-decoration: none !important;
    font-size: 13px !important;
    font-family: 'Geist', sans-serif !important;
    transition: color var(--wpa-transition-fast) !important;
}

.wpa-footer-link:hover {
    color: var(--wpa-neon-cyan) !important;
}

.wpa-footer-link svg {
    width: 16px !important;
    height: 16px !important;
}

/* Stats */
.wpa-stats-grid {
    display: grid !important;
    grid-template-columns: repeat(3, 1fr) !important;
    gap: 12px !important;
    margin-bottom: 12px !important;
}

.wpa-stat-card {
    padding: 14px !important;
    background: var(--wpa-glass) !important;
    border: 1px solid var(--wpa-glass-border) !important;
    border-radius: var(--wpa-radius-md) !important;
}

.wpa-stat-card__label {
    font-size: 11px !important;
    letter-spacing: 0.08em !important;
    text-transform: uppercase !important;
    color: var(--wpa-text-muted) !important;
    margin-bottom: 6px !important;
}

.wpa-stat-card__value {
    font-size: 16px !important;
    font-weight: 700 !important;
    color: var(--wpa-text-primary) !important;
}

.wpa-stats-bar {
    display: flex !important;
    align-items: center !important;
    justify-content: space-between !important;
    gap: 10px !important;
    padding: 12px !important;
    background: var(--wpa-glass) !important;
    border: 1px solid var(--wpa-glass-border) !important;
    border-radius: var(--wpa-radius-md) !important;
    margin-bottom: 18px !important;
}

.wpa-clear-history-btn {
    display: inline-flex !important;
    align-items: center !important;
    gap: 6px !important;
    padding: 8px 12px !important;
    background: rgba(255, 45, 61, 0.12) !important;
    border: 1px solid rgba(255, 45, 61, 0.25) !important;
    border-radius: var(--wpa-radius-sm) !important;
    color: var(--wpa-text-secondary) !important;
    cursor: pointer !important;
    font-size: 11px !important;
    font-weight: 600 !important;
    transition: all var(--wpa-transition-fast) !important;
    font-family: 'Geist', sans-serif !important;
}

.wpa-clear-history-btn:hover {
    background: rgba(255, 45, 61, 0.2) !important;
    border-color: rgba(255, 45, 61, 0.4) !important;
    color: var(--wpa-text-primary) !important;
}

.wpa-clear-history-btn svg {
    width: 12px !important;
    height: 12px !important;
}

/* Toast Notifications */
.wpa-toast-container {
    position: fixed !important;
    bottom: 90px !important;
    right: 20px !important;
    z-index: var(--wpa-z-toast) !important;
    display: flex !important;
    flex-direction: column-reverse !important;
    gap: 10px !important;
}

.wpa-toast {
    display: flex !important;
    align-items: center !important;
    gap: 15px !important;
    padding: 15px 20px !important;
    min-width: 300px !important;
    background: var(--wpa-bg-secondary) !important;
    border: 1px solid var(--wpa-glass-border) !important;
    border-radius: var(--wpa-radius-md) !important;
    box-shadow: 0 4px 15px rgba(0, 0, 0, 0.5) !important;
    opacity: 0 !important;
    transform: translateX(100%) !important;
    transition: all var(--wpa-transition-normal) !important;
    position: relative !important;
    overflow: hidden !important;
}

.wpa-toast--visible {
    opacity: 1 !important;
    transform: translateX(0) !important;
}

.wpa-toast--hiding {
    opacity: 0 !important;
    transform: translateX(50%) !important;
}

.wpa-toast__icon {
    width: 20px !important;
    height: 20px !important;
    flex-shrink: 0 !important;
}

.wpa-toast__content {
    flex: 1 !important;
}

.wpa-toast__message {
    font-size: 14px !important;
    color: var(--wpa-text-primary) !important;
    font-family: 'Geist', sans-serif !important;
}

.wpa-toast__close {
    background: none !important;
    border: none !important;
    color: var(--wpa-text-muted) !important;
    cursor: pointer !important;
    padding: 4px !important;
    display: flex !important;
    align-items: center !important;
    justify-content: center !important;
    transition: color var(--wpa-transition-fast) !important;
}

.wpa-toast__close:hover {
    color: var(--wpa-neon-cyan) !important;
}

.wpa-toast__close svg {
    width: 16px !important;
    height: 16px !important;
}

.wpa-toast__progress {
    position: absolute !important;
    bottom: 0 !important;
    left: 0 !important;
    right: 0 !important;
    height: 3px !important;
    background: var(--wpa-gradient-2) !important;
    transform-origin: left !important;
    animation: wpa-toast-progress linear forwards !important;
}

/* Next Episode Countdown */
.wpa-next-countdown {
    position: fixed !important;
    right: 20px !important;
    bottom: 160px !important;
    z-index: var(--wpa-z-toast) !important;
    background: var(--wpa-glass-strong) !important;
    backdrop-filter: blur(18px) !important;
    border: 1px solid var(--wpa-glass-border-strong) !important;
    border-radius: var(--wpa-radius-lg) !important;
    padding: 18px 20px !important;
    min-width: 280px !important;
    box-shadow: 0 8px 30px rgba(0, 0, 0, 0.6), 0 0 30px rgba(255, 80, 95, 0.25) !important;
    animation: wpa-fade-in 0.3s ease-out !important;
}

.wpa-next-countdown__row {
    display: flex !important;
    align-items: center !important;
    justify-content: space-between !important;
    margin-bottom: 12px !important;
}

.wpa-next-countdown__title {
    font-family: 'Geist', sans-serif !important;
    font-size: 13px !important;
    font-weight: 700 !important;
    text-transform: uppercase !important;
    letter-spacing: 0.1em !important;
    color: var(--wpa-text-secondary) !important;
}

.wpa-next-countdown__time {
    font-family: 'Geist', sans-serif !important;
    font-size: 18px !important;
    font-weight: 700 !important;
    color: var(--wpa-neon-cyan) !important;
    text-shadow: 0 0 10px var(--wpa-neon-cyan) !important;
}

.wpa-next-countdown__progress {
    height: 4px !important;
    background: rgba(255, 255, 255, 0.08) !important;
    border-radius: 999px !important;
    overflow: hidden !important;
    margin-bottom: 14px !important;
}

.wpa-next-countdown__bar {
    height: 100% !important;
    width: 100% !important;
    background: var(--wpa-gradient-1) !important;
    transform-origin: left !important;
    transition: width 0.2s linear !important;
    box-shadow: 0 0 8px var(--wpa-neon-cyan) !important;
}

.wpa-next-countdown__cancel {
    width: 100% !important;
    padding: 10px 14px !important;
    background: var(--wpa-glass) !important;
    border: 1px solid var(--wpa-glass-border) !important;
    border-radius: var(--wpa-radius-md) !important;
    color: var(--wpa-text-secondary) !important;
    cursor: pointer !important;
    font-size: 13px !important;
    font-weight: 600 !important;
    font-family: 'Geist', sans-serif !important;
    transition: all var(--wpa-transition-fast) !important;
    text-align: center !important;
}

.wpa-next-countdown__cancel:hover {
    background: var(--wpa-bg-tertiary) !important;
    border-color: var(--wpa-glass-border-strong) !important;
    color: var(--wpa-text-primary) !important;
    transform: translateY(-1px) !important;
}

.wpa-next-countdown__cancel:active {
    transform: translateY(0) !important;
}

/* Volume OSD */
.wpa-osd {
    position: fixed !important;
    top: 50% !important;
    left: 50% !important;
    transform: translate(-50%, -50%) scale(0.8) !important;
    z-index: var(--wpa-z-osd) !important;
    display: flex !important;
    align-items: center !important;
    gap: 15px !important;
    padding: 20px 30px !important;
    background: rgba(0, 0, 0, 0.85) !important;
    border: 1px solid var(--wpa-glass-border) !important;
    border-radius: var(--wpa-radius-xl) !important;
    box-shadow: 0 8px 30px rgba(0, 0, 0, 0.7) !important;
    opacity: 0 !important;
    visibility: hidden !important;
    transition: all var(--wpa-transition-normal) !important;
}

.wpa-osd--visible {
    opacity: 1 !important;
    visibility: visible !important;
    transform: translate(-50%, -50%) scale(1) !important;
}

.wpa-osd__icon {
    width: 30px !important;
    height: 30px !important;
    color: var(--wpa-neon-cyan) !important;
    flex-shrink: 0 !important;
}

.wpa-osd__bar {
    flex: 1 !important;
    height: 6px !important;
    background: rgba(255, 255, 255, 0.2) !important;
    border-radius: 3px !important;
    overflow: hidden !important;
    min-width: 150px !important;
}

.wpa-osd__fill {
    height: 100% !important;
    background: var(--wpa-gradient-2) !important;
    transition: width 0.2s ease-out !important;
}

.wpa-osd__value {
    min-width: 50px !important;
    text-align: right !important;
    font-size: 18px !important;
    font-weight: 700 !important;
    color: var(--wpa-text-primary) !important;
    font-family: 'Geist', sans-serif !important;
}

/* Show Cards */
.wpa-show-card {
    display: flex !important;
    align-items: center !important;
    gap: 15px !important;
    padding: 15px !important;
    background: var(--wpa-bg-secondary) !important;
    border: 1px solid var(--wpa-glass-border) !important;
    border-radius: var(--wpa-radius-md) !important;
    margin-bottom: 10px !important;
    cursor: pointer !important;
    transition: all var(--wpa-transition-fast) !important;
}

.wpa-show-card:hover {
    transform: translateX(5px) !important;
    background: var(--wpa-bg-tertiary) !important;
    border-color: var(--wpa-glass-border-strong) !important;
}

.wpa-show-card__icon {
    width: 40px !important;
    height: 40px !important;
    background: var(--wpa-gradient-1) !important;
    border-radius: var(--wpa-radius-sm) !important;
    display: flex !important;
    align-items: center !important;
    justify-content: center !important;
    flex-shrink: 0 !important;
}

.wpa-show-card__icon svg {
    width: 20px !important;
    height: 20px !important;
    color: white !important;
}

.wpa-show-card__content {
    flex: 1 !important;
    min-width: 0 !important;
}

.wpa-show-card__name {
    font-size: 15px !important;
    font-weight: 600 !important;
    color: var(--wpa-text-primary) !important;
    font-family: 'Geist', sans-serif !important;
    white-space: nowrap !important;
    overflow: hidden !important;
    text-overflow: ellipsis !important;
}

.wpa-show-card__meta {
    font-size: 13px !important;
    color: var(--wpa-text-secondary) !important;
    margin-top: 4px !important;
}

.wpa-show-card__arrow {
    color: var(--wpa-text-muted) !important;
    flex-shrink: 0 !important;
}

.wpa-show-card__arrow svg {
    width: 16px !important;
    height: 16px !important;
}

/* TOUCH-OPTIMIZED STYLES */
.wpa-option:active {
    transform: scale(0.98) !important;
    background: var(--wpa-bg-tertiary) !important;
}

.wpa-toggle:active {
    transform: scale(0.95) !important;
}

.wpa-segment:active {
    transform: scale(0.97) !important;
}

.wpa-show-card:active {
    transform: translateX(3px) !important;
}

.wpa-quick-action:active {
    transform: scale(0.96) !important;
}

.wpa-modal__close:active {
    transform: scale(0.9) !important;
}

.wpa-panel__close:active {
    transform: scale(0.9) !important;
}

.wpa-toast:active {
    transform: translateX(-2px) !important;
}

.wpa-next-countdown__cancel:active {
    transform: translateY(1px) !important;
}

.wpa-volume-btn:active {
    transform: scale(0.92) !important;
}

.wpa-clear-history-btn:active {
    transform: scale(0.95) !important;
}

.wpa-footer-link:active {
    opacity: 0.7;
}

/* Improved touch feedback for inputs */
.wpa-input:focus {
    border-color: var(--wpa-neon-cyan) !important;
    box-shadow: 0 0 0 3px rgba(255, 80, 95, 0.25) !important;
}

/* Better scroll behavior for mobile */
.wpa-panel__body {
    -webkit-overflow-scrolling: touch !important;
}

.wpa-modal__body {
    -webkit-overflow-scrolling: touch !important;
}

/* Prevent zoom on double tap */
* {
    touch-action: manipulation;
}

/* Empty State */
.wpa-empty {
    text-align: center !important;
    padding: 40px 20px !important;
}

.wpa-empty__icon {
    width: 60px !important;
    height: 60px !important;
    margin: 0 auto 15px !important;
    color: var(--wpa-text-muted) !important;
}

.wpa-empty__text {
    font-size: 15px !important;
    color: var(--wpa-text-secondary) !important;
    font-family: 'Geist', sans-serif !important;
}

/* Modal */
.wpa-modal-overlay {
    position: fixed !important;
    top: 0 !important;
    left: 0 !important;
    width: 100% !important;
    height: 100% !important;
    background: rgba(0, 0, 0, 0.9) !important;
    backdrop-filter: blur(10px) !important;
    z-index: 999999995 !important;
    display: flex !important;
    align-items: center !important;
    justify-content: center !important;
    opacity: 0 !important;
    visibility: hidden !important;
    transition: all var(--wpa-transition-normal) !important;
}

.wpa-modal-overlay--visible {
    opacity: 1 !important;
    visibility: visible !important;
}

.wpa-modal {
    width: 90% !important;
    max-width: 600px !important;
    max-height: 80vh !important;
    background: var(--wpa-bg-primary) !important;
    border: 1px solid var(--wpa-glass-border) !important;
    border-radius: var(--wpa-radius-xl) !important;
    box-shadow: 0 10px 40px rgba(0, 0, 0, 0.5) !important;
    display: flex !important;
    flex-direction: column !important;
    overflow: hidden !important;
    transform: scale(0.9) !important;
    transition: all var(--wpa-transition-normal) !important;
}

.wpa-modal-overlay--visible .wpa-modal {
    transform: scale(1) !important;
}

.wpa-modal__header {
    padding: 20px !important;
    background: var(--wpa-bg-secondary) !important;
    border-bottom: 1px solid rgba(255, 255, 255, 0.1) !important;
    display: flex !important;
    align-items: center !important;
    justify-content: space-between !important;
}

.wpa-modal__title {
    font-size: 18px !important;
    font-weight: 700 !important;
    color: var(--wpa-text-primary) !important;
    font-family: 'Geist', sans-serif !important;
}

.wpa-modal__close {
    background: none !important;
    border: none !important;
    color: var(--wpa-text-secondary) !important;
    cursor: pointer !important;
    padding: 4px !important;
    display: flex !important;
    align-items: center !important;
    justify-content: center !important;
    transition: color var(--wpa-transition-fast) !important;
}

.wpa-modal__close:hover {
    color: var(--wpa-neon-cyan) !important;
}

.wpa-modal__close svg {
    width: 20px !important;
    height: 20px !important;
}

.wpa-modal__body {
    flex: 1 !important;
    overflow-y: auto !important;
    padding: 20px !important;
}

.wpa-modal__body::-webkit-scrollbar {
    width: 6px !important;
}

.wpa-modal__body::-webkit-scrollbar-track {
    background: transparent !important;
}

.wpa-modal__body::-webkit-scrollbar-thumb {
    background: rgba(255, 80, 95, 0.3) !important;
    border-radius: 3px !important;
}

/* МОБИЛЬНАЯ АДАПТАЦИЯ - OPTIMIZED FOR SMARTPHONES */
@media (max-width: 768px) {
    * {
        -webkit-tap-highlight-color: transparent;
        -webkit-touch-callout: none;
        -webkit-user-select: none;
        user-select: none;
    }

    input, textarea, [contenteditable="true"] {
        -webkit-user-select: auto;
        user-select: auto;
    }

    .wpa-panel {
        width: 100% !important;
        max-width: 100% !important;
    }

    .wpa-fab {
        bottom: 16px !important;
        right: 16px !important;
        width: 56px !important;
        height: 56px !important;
        box-shadow: 0 6px 24px rgba(0, 0, 0, 0.4), 0 0 20px rgba(255, 80, 95, 0.4) !important;
    }

    .wpa-fab:active {
        transform: scale(0.92) !important;
    }

    .wpa-fab__icon {
        width: 26px !important;
        height: 26px !important;
    }

    .wpa-quick-actions {
        grid-template-columns: repeat(2, 1fr) !important;
        gap: 10px !important;
    }

    .wpa-quick-action {
        padding: 14px 10px !important;
        min-height: 64px !important;
    }

    .wpa-quick-action__icon {
        width: 24px !important;
        height: 24px !important;
    }

    .wpa-stats-grid {
        grid-template-columns: repeat(2, 1fr) !important;
        gap: 10px !important;
    }

    .wpa-stat-card {
        padding: 12px !important;
    }

    .wpa-toast-container {
        bottom: 80px !important;
        right: 10px !important;
        left: 10px !important;
        max-width: calc(100% - 20px) !important;
    }

    .wpa-toast {
        min-width: unset !important;
        width: 100% !important;
        padding: 14px 16px !important;
    }

    .wpa-next-countdown {
        right: 12px !important;
        left: 12px !important;
        bottom: 85px !important;
        min-width: unset !important;
        width: calc(100% - 24px) !important;
        padding: 16px !important;
    }

    .wpa-next-countdown__title {
        font-size: 12px !important;
    }

    .wpa-next-countdown__time {
        font-size: 16px !important;
    }

    .wpa-next-countdown__cancel {
        padding: 12px 16px !important;
        min-height: 48px !important;
    }

    .wpa-osd {
        padding: 18px 24px !important;
        min-width: 200px !important;
    }

    .wpa-osd__bar {
        min-width: 120px !important;
        height: 8px !important;
    }

    .wpa-osd__value {
        font-size: 16px !important;
    }

    .wpa-modal {
        width: 95% !important;
        max-width: 95% !important;
        max-height: 85vh !important;
    }

    .wpa-panel__body {
        padding: 16px 14px !important;
    }

    .wpa-option {
        padding: 14px !important;
        min-height: 72px !important;
    }

    .wpa-option__icon {
        width: 36px !important;
        height: 36px !important;
    }

    .wpa-toggle {
        width: 48px !important;
        height: 28px !important;
    }

    .wpa-volume-btn {
        width: 48px !important;
        height: 48px !important;
        min-height: 48px !important;
    }

    .wpa-volume-display {
        font-size: 20px !important;
    }

    .wpa-show-card {
        padding: 14px !important;
        min-height: 64px !important;
    }

    .wpa-show-card__icon {
        width: 44px !important;
        height: 44px !important;
    }

    .wpa-panel__close {
        width: 40px !important;
        height: 40px !important;
    }

    .wpa-tab {
        padding: 14px 10px !important;
        min-height: 56px !important;
    }

    .wpa-segment {
        padding: 14px 10px !important;
        min-height: 48px !important;
    }

    .wpa-input {
        padding: 12px !important;
        min-height: 48px !important;
        font-size: 16px !important;
    }

    .wpa-clear-history-btn {
        padding: 10px 14px !important;
        min-height: 44px !important;
    }

    .wpa-modal__header {
        padding: 18px !important;
    }

    .wpa-modal__body {
        padding: 16px !important;
    }

    .wpa-modal__close {
        width: 40px !important;
        height: 40px !important;
    }

    .wpa-empty {
        padding: 30px 16px !important;
    }
}

@media (max-width: 480px) {
    .wpa-quick-actions {
        grid-template-columns: 1fr !important;
    }

    .wpa-stats-grid {
        grid-template-columns: 1fr !important;
    }

    .wpa-panel__header {
        padding: 14px !important;
    }

    .wpa-panel__logo {
        width: 34px !important;
        height: 34px !important;
    }

    .wpa-panel__title {
        font-size: 17px !important;
    }

    .wpa-panel__version {
        font-size: 10px !important;
    }

    .wpa-tab {
        padding: 12px 6px !important;
        font-size: 11px !important;
    }

    .wpa-tab__icon {
        width: 18px !important;
        height: 18px !important;
    }

    .wpa-fab {
        bottom: 12px !important;
        right: 12px !important;
        width: 52px !important;
        height: 52px !important;
    }

    .wpa-fab__icon {
        width: 24px !important;
        height: 24px !important;
    }

    .wpa-fab__badge {
        width: 22px !important;
        height: 22px !important;
        font-size: 11px !important;
    }

    .wpa-now {
        padding: 14px !important;
    }

    .wpa-now__chip {
        padding: 8px 10px !important;
        font-size: 11px !important;
    }

    .wpa-status {
        padding: 14px !important;
    }

    .wpa-status__title {
        font-size: 13px !important;
    }

    .wpa-status__desc {
        font-size: 11px !important;
    }

    .wpa-section__title {
        font-size: 12px !important;
    }

    .wpa-option__title {
        font-size: 13px !important;
    }

    .wpa-option__desc {
        font-size: 11px !important;
    }

    .wpa-toast {
        padding: 12px 14px !important;
        min-height: 56px !important;
    }

    .wpa-toast__message {
        font-size: 13px !important;
    }

    .wpa-osd {
        padding: 16px 20px !important;
    }

    .wpa-osd__icon {
        width: 26px !important;
        height: 26px !important;
    }

    .wpa-osd__bar {
        min-width: 100px !important;
        height: 6px !important;
    }

    .wpa-osd__value {
        font-size: 14px !important;
        min-width: 40px !important;
    }

    .wpa-next-countdown {
        padding: 14px !important;
        bottom: 75px !important;
    }

    .wpa-modal {
        width: 98% !important;
        max-width: 98% !important;
        max-height: 90vh !important;
    }

    .wpa-show-card {
        padding: 12px !important;
    }

    .wpa-show-card__name {
        font-size: 14px !important;
    }

    .wpa-show-card__meta {
        font-size: 12px !important;
    }
}

/* Landscape mode optimization */
@media (max-width: 768px) and (orientation: landscape) {
    .wpa-panel {
        max-height: 100vh !important;
    }

    .wpa-panel__body {
        max-height: calc(100vh - 140px) !important;
    }

    .wpa-modal {
        max-height: 80vh !important;
    }

    .wpa-modal__body {
        max-height: calc(80vh - 80px) !important;
    }
}

/* Safe area insets for notched devices */
@supports (padding: max(0px)) {
    @media (max-width: 768px) {
        .wpa-fab {
            bottom: max(16px, env(safe-area-inset-bottom)) !important;
            right: max(16px, env(safe-area-inset-right)) !important;
        }

        .wpa-toast-container {
            bottom: max(80px, env(safe-area-inset-bottom)) !important;
        }

        .wpa-next-countdown {
            bottom: max(85px, env(safe-area-inset-bottom)) !important;
        }

        .wpa-panel {
            padding-bottom: env(safe-area-inset-bottom) !important;
        }
    }
}

/* Prevent pull-to-refresh on mobile */
@media (max-width: 768px) {
    body {
        overscroll-behavior-y: contain;
    }
}
`;

    const style = document.createElement('style');
    style.id = 'wpa-styles';
    style.textContent = css;
    document.head.appendChild(style);
    State.cleanup.push(() => style.remove());
};
// ═══════════════════════════════════════════════════════════
// ПАНЕЛЬ (ПОЛНАЯ ВЕРСИЯ)
// ═══════════════════════════════════════════════════════════
const Panel = {
    elements: {},
    cleanupFunctions: [],

    formatNumber(number, titles) {
        const cases = [2, 0, 1, 1, 1, 2];
        return titles[(number % 100 > 4 && number % 100 < 20) ? 2 : cases[(number % 10 < 5) ? number % 10 : 5]];
    },

    create() {
        if (!State.settings.showPanel || !IS_TOP || IS_PLAYER) return;

        const fabs = Array.from(document.querySelectorAll('.wpa-fab'));
        const panels = Array.from(document.querySelectorAll('.wpa-panel'));
        const overlays = Array.from(document.querySelectorAll('.wpa-panel-overlay'));

        const primaryFab = fabs.find(f => f.classList.contains('wpa-fab--open')) || fabs[0] || null;
        const primaryPanel = panels[0] || null;
        const primaryOverlay = overlays[0] || null;

        fabs.forEach(f => { if (f !== primaryFab) f.remove(); });
        panels.forEach(p => { if (p !== primaryPanel) p.remove(); });
        overlays.forEach(o => { if (o !== primaryOverlay) o.remove(); });

        if (primaryFab && primaryPanel) {
            if (!this.elements.fab || !this.elements.panel) {
                this.elements.fab = primaryFab;
                this.elements.panel = primaryPanel;
                this.elements.overlay = primaryOverlay;
                this.bindEvents();
            }
            this.updateLiveUI();
            return;
        }

        this.cleanupFunctions.forEach(fn => fn());
        this.cleanupFunctions = [];

        document.querySelectorAll('.wpa-fab, .wpa-panel, .wpa-panel-overlay').forEach(el => el.remove());

        this.createFAB();
        this.createPanel();
        this.bindEvents();
        this.updateLiveUI();
    },

    createFAB() {
        const existingFab = document.querySelector('.wpa-fab');
        if (existingFab) {
            this.elements.fab = existingFab;
            return;
        }

        const fab = document.createElement('button');
        fab.className = 'wpa-fab';
        fab.innerHTML = `<span class="wpa-fab__icon">${Icons.zap}</span>${State.settings.autoNext ? '<span class="wpa-fab__badge">✓</span>' : ''}`;
        document.body.appendChild(fab);
        this.elements.fab = fab;
    },

    createPanel() {
        const overlay = document.createElement('div');
        overlay.className = 'wpa-panel-overlay';
        document.body.appendChild(overlay);
        this.elements.overlay = overlay;

        const panel = document.createElement('div');
        panel.className = 'wpa-panel';
        panel.innerHTML = this.getPanelHTML();
        document.body.appendChild(panel);
        this.elements.panel = panel;
    },

    getPanelHTML() {
        const s = State.settings;
        return `
<div class="wpa-panel__header">
    <div class="wpa-panel__brand">
        <div class="wpa-panel__logo">🎬</div>
        <div>
            <div class="wpa-panel__title">WPARTY Auto</div>
            <div class="wpa-panel__version">v${CONFIG.version}</div>
        </div>
    </div>
    <button class="wpa-panel__close" data-action="close">${Icons.x}</button>
</div>
<div class="wpa-panel__tabs">
    <button class="wpa-tab ${State.activeTab === 'auto' ? 'wpa-tab--active' : ''}" data-tab="auto">
        <span class="wpa-tab__icon">${Icons.zap}</span>
        <span class="wpa-tab__label">Автоматика</span>
    </button>
    <button class="wpa-tab ${State.activeTab === 'stats' ? 'wpa-tab--active' : ''}" data-tab="stats">
        <span class="wpa-tab__icon">${Icons.stats}</span>
        <span class="wpa-tab__label">Статистика</span>
    </button>
    <button class="wpa-tab ${State.activeTab === 'settings' ? 'wpa-tab--active' : ''}" data-tab="settings">
        <span class="wpa-tab__icon">${Icons.settings}</span>
        <span class="wpa-tab__label">Настройки</span>
    </button>
</div>
<div class="wpa-panel__body">
    ${this.getAutoTabHTML(s)}
    ${this.getStatsTabHTML()}
    ${this.getSettingsTabHTML(s)}
</div>
<div class="wpa-panel__footer">
    <a href="https://github.com/DdepRest/wparty-auto-redesign" target="_blank" class="wpa-footer-link">${Icons.github}<span>GitHub</span></a>
    <a href="https://github.com/DdepRest/wparty-auto-redesign/issues" target="_blank" class="wpa-footer-link">${Icons.externalLink}<span>Поддержка</span></a>
</div>`;
    },

    getAutoTabHTML(s) {
        const totals = this.getSeasonEpisodeTotals();
        const currentVol = Math.round(Volume.getSaved() * 100);

        return `
<div class="wpa-tab-content ${State.activeTab === 'auto' ? 'wpa-tab-content--active' : ''}" data-content="auto">
    ${this.renderStatusBlock(s)}
    ${this.renderNowPlayingBlock(totals)}
    ${this.renderQuickActions(s)}
    ${this.renderAutoSwitchSection(s)}
    ${this.renderSyncSection(s)}
    ${this.renderSkipCreditsSection(s)}
    ${this.renderVolumeSection(s)}
</div>`;
    },

    // Вспомогательный метод: Получить данные о сезонах/сериях
    getSeasonEpisodeTotals() {
        try {
            return this.normalizeTotals(
                (typeof MainMode !== 'undefined' && MainMode.getSeasonEpisodeTotals)
                    ? MainMode.getSeasonEpisodeTotals()
                    : {}
            );
        } catch (e) {
            return { seasonTotal: '—', episodeTotal: '—', seasonCurrent: '—', episodeCurrent: '—' };
        }
    },

    // Блок статуса
    renderStatusBlock(s) {
        return `
<div class="wpa-status ${s.autoNext ? 'wpa-status--active' : ''}">
    <div class="wpa-status__dot"></div>
    <div class="wpa-status__text">
        <div class="wpa-status__title">${s.autoNext ? 'Автоматика активна' : 'Автоматика выключена'}</div>
        <div class="wpa-status__desc">${s.autoNext ? 'Серии переключаются автоматически' : 'Включите автопереключение для работы'}</div>
    </div>
</div>`;
    },

    // Блок "Сейчас в плеере"
    renderNowPlayingBlock(totals) {
        return `
<div class="wpa-now" data-now="container">
    <div class="wpa-now__title">Сейчас в плеере</div>
    <div class="wpa-now__row">
        <div class="wpa-now__chip" data-now="season">Сезон ${totals.seasonCurrent} из ${totals.seasonTotal}</div>
        <div class="wpa-now__chip" data-now="episode">Серия ${totals.episodeCurrent} из ${totals.episodeTotal}</div>
    </div>
    <div class="wpa-now__meta" data-now="total">Всего: ${totals.seasonTotal} сезонов • ${totals.episodeTotal} серий</div>
</div>`;
    },

    // Быстрые действия
    renderQuickActions(s) {
        return `
<div class="wpa-quick-actions">
    <div class="wpa-quick-action ${s.autoNext ? 'wpa-quick-action--active' : ''}" data-quick="autoNext">
        <div class="wpa-quick-action__icon">${Icons.skipForward}</div>
        <div class="wpa-quick-action__label">Авто-серия</div>
    </div>
    <div class="wpa-quick-action ${s.skipCredits ? 'wpa-quick-action--active' : ''}" data-quick="skipCredits">
        <div class="wpa-quick-action__icon">${Icons.clock}</div>
        <div class="wpa-quick-action__label">Пропуск титров</div>
    </div>
    <div class="wpa-quick-action ${s.autoSync ? 'wpa-quick-action--active' : ''}" data-quick="autoSync">
        <div class="wpa-quick-action__icon">${Icons.sync}</div>
        <div class="wpa-quick-action__label">Авто-синхр</div>
    </div>
</div>`;
    },

    // Секция: Автопереключение
    renderAutoSwitchSection(s) {
        return `
<div class="wpa-section">
    <div class="wpa-section__header">
        <div class="wpa-section__icon">${Icons.play}</div>
        <div class="wpa-section__title">Автопереключение</div>
    </div>
    <div class="wpa-option">
        <div class="wpa-option__icon">${Icons.skipForward}</div>
        <div class="wpa-option__content">
            <div class="wpa-option__title">Следующая серия</div>
            <div class="wpa-option__desc">Автоматический переход между сериями</div>
        </div>
        <label class="wpa-toggle">
            <input type="checkbox" class="wpa-toggle__input" data-option="autoNext" ${s.autoNext ? 'checked' : ''}>
            <div class="wpa-toggle__track"><div class="wpa-toggle__thumb"></div></div>
        </label>
    </div>
    <div class="wpa-option">
        <div class="wpa-option__icon">${Icons.folder}</div>
        <div class="wpa-option__content">
            <div class="wpa-option__title">Следующий сезон</div>
            <div class="wpa-option__desc">Автопереход на новый сезон</div>
        </div>
        <label class="wpa-toggle">
            <input type="checkbox" class="wpa-toggle__input" data-option="autoSeason" ${s.autoSeason ? 'checked' : ''}>
            <div class="wpa-toggle__track"><div class="wpa-toggle__thumb"></div></div>
        </label>
    </div>
</div>`;
    },

    // Секция: Синхронизация
    renderSyncSection(s) {
        return `
<div class="wpa-section">
    <div class="wpa-section__header">
        <div class="wpa-section__icon">${Icons.sync}</div>
        <div class="wpa-section__title">Синхронизация</div>
    </div>
    <div class="wpa-option">
        <div class="wpa-option__icon">${Icons.sync}</div>
        <div class="wpa-option__content">
            <div class="wpa-option__title">Автосинхронизация</div>
            <div class="wpa-option__desc">Синхронизация через ${CONFIG.timeouts.autoSync / 1000} сек после серии</div>
        </div>
        <label class="wpa-toggle">
            <input type="checkbox" class="wpa-toggle__input" data-option="autoSync" ${s.autoSync ? 'checked' : ''}>
            <div class="wpa-toggle__track"><div class="wpa-toggle__thumb"></div></div>
        </label>
    </div>
</div>`;
    },

    // Секция: Пропуск титров
    renderSkipCreditsSection(s) {
        return `
<div class="wpa-section">
    <div class="wpa-section__header">
        <div class="wpa-section__icon">${Icons.clock}</div>
        <div class="wpa-section__title">Пропуск титров</div>
    </div>
    <div class="wpa-option">
        <div class="wpa-option__icon">${Icons.skipForward}</div>
        <div class="wpa-option__content">
            <div class="wpa-option__title">Умный пропуск</div>
            <div class="wpa-option__desc">Пропускать финальные титры</div>
        </div>
        <label class="wpa-toggle">
            <input type="checkbox" class="wpa-toggle__input" data-option="skipCredits" ${s.skipCredits ? 'checked' : ''}>
            <div class="wpa-toggle__track"><div class="wpa-toggle__thumb"></div></div>
        </label>
    </div>
    <div data-live="skipCreditsExtra"></div>
</div>`;
    },

    // Секция: Громкость
    renderVolumeSection(s) {
        return `
<div class="wpa-section">
    <div class="wpa-section__header">
        <div class="wpa-section__icon">${Icons.volume}</div>
        <div class="wpa-section__title">Громкость</div>
    </div>
    <div class="wpa-option">
        <div class="wpa-option__icon">${Icons.volume}</div>
        <div class="wpa-option__content">
            <div class="wpa-option__title">Управление громкостью</div>
            <div class="wpa-option__desc">Сохранение и синхронизация громкости</div>
        </div>
        <label class="wpa-toggle">
            <input type="checkbox" class="wpa-toggle__input" data-option="volumeControl" ${s.volumeControl ? 'checked' : ''}>
            <div class="wpa-toggle__track"><div class="wpa-toggle__thumb"></div></div>
        </label>
    </div>
    <div data-live="volumeExtra"></div>
    <div data-live="volumeControlPanel"></div>
</div>`;
    },

    getStatsTabHTML() {
        const history = Storage.getWatchHistory();
        const lastShow = Object.values(history).sort((a, b) => b.timestamp - a.timestamp)[0];
        const totals = (typeof MainMode !== 'undefined' && MainMode.getSeasonEpisodeTotals) ? MainMode.getSeasonEpisodeTotals() : {};
        const seasonTotal = Number.isFinite(totals.seasonTotal) && totals.seasonTotal > 0 ? totals.seasonTotal : '—';
        const episodeTotal = Number.isFinite(totals.episodeTotal) && totals.episodeTotal > 0 ? totals.episodeTotal : '—';
        const seasonCurrent = Number.isFinite(totals.seasonCurrent) && totals.seasonCurrent > 0 ? totals.seasonCurrent : '—';

        return `
<div class="wpa-tab-content ${State.activeTab === 'stats' ? 'wpa-tab-content--active' : ''}" data-content="stats">
    <div class="wpa-section">
        <div class="wpa-section__header">
            <div class="wpa-section__icon">${Icons.stats}</div>
            <div class="wpa-section__title">Статистика по сериалам</div>
        </div>
        <div class="wpa-stats-grid">
            <div class="wpa-stat-card" data-live="stat-seasons">
                <div class="wpa-stat-card__label">Всего сезонов</div>
                <div class="wpa-stat-card__value">${seasonTotal}</div>
            </div>
            <div class="wpa-stat-card" data-live="stat-season">
                <div class="wpa-stat-card__label">Сезон сейчас</div>
                <div class="wpa-stat-card__value">${seasonCurrent}</div>
            </div>
            <div class="wpa-stat-card" data-live="stat-episodes">
                <div class="wpa-stat-card__label">Серий в сезоне</div>
                <div class="wpa-stat-card__value">${episodeTotal}</div>
            </div>
        </div>
        <div class="wpa-stats-bar">
            <div>
                <div style="font-size: 10px; letter-spacing: 0.1em; text-transform: uppercase; color: var(--wpa-text-muted); margin-bottom: 4px;">Последний просмотр</div>
                <div style="font-size: 13px; font-weight: 600; color: var(--wpa-text-primary); max-width: 210px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" data-live="stat-last">${lastShow ? lastShow.name : 'Нет данных'}</div>
            </div>
            <button class="wpa-clear-history-btn" type="button">${Icons.x} Очистить</button>
        </div>
    </div>
    <div class="wpa-section">
        <div class="wpa-section__header">
            <div class="wpa-section__icon">${Icons.tv}</div>
            <div class="wpa-section__title">Список сериалов</div>
        </div>
        <div class="wpa-show-list" data-live="history-list">
            ${Object.entries(history).length === 0 ? `
            <div class="wpa-empty">
                <div class="wpa-empty__icon">${Icons.tv}</div>
                <div class="wpa-empty__text">История просмотров пуста</div>
            </div>
            ` : Object.entries(history).map(([id, show]) => `
            <div class="wpa-show-card" data-url="${show.url || ''}">
                <div class="wpa-show-card__icon">${Icons.tv}</div>
                <div class="wpa-show-card__content">
                    <div class="wpa-show-card__name">${show.name || 'Неизвестный сериал'}</div>
                    <div class="wpa-show-card__meta">Сезон ${show.season}, Серия ${show.episode}</div>
                </div>
                <div class="wpa-show-card__arrow">${Icons.chevronRight}</div>
            </div>
            `).join('')}
        </div>
    </div>
</div>`;
    },

    getSettingsTabHTML(s) {
        return `
<div class="wpa-tab-content ${State.activeTab === 'settings' ? 'wpa-tab-content--active' : ''}" data-content="settings">
    <div class="wpa-section">
        <div class="wpa-section__header">
            <div class="wpa-section__icon">${Icons.sparkles}</div>
            <div class="wpa-section__title">Интерфейс</div>
        </div>
        <div class="wpa-option">
            <div class="wpa-option__icon">${Icons.sparkles}</div>
            <div class="wpa-option__content">
                <div class="wpa-option__title">Анимации</div>
                <div class="wpa-option__desc">Плавные переходы и эффекты</div>
            </div>
            <label class="wpa-toggle">
                <input type="checkbox" class="wpa-toggle__input" data-option="animations" ${s.animations ? 'checked' : ''}>
                <div class="wpa-toggle__track"><div class="wpa-toggle__thumb"></div></div>
            </label>
        </div>
        <div class="wpa-option">
            <div class="wpa-option__icon">${Icons.bell}</div>
            <div class="wpa-option__content">
                <div class="wpa-option__title">Уведомления</div>
                <div class="wpa-option__desc">Показывать всплывающие подсказки</div>
            </div>
            <label class="wpa-toggle">
                <input type="checkbox" class="wpa-toggle__input" data-option="showNotifications" ${s.showNotifications ? 'checked' : ''}>
                <div class="wpa-toggle__track"><div class="wpa-toggle__thumb"></div></div>
            </label>
        </div>
        <div class="wpa-option">
            <div class="wpa-option__icon">${Icons.volume}</div>
            <div class="wpa-option__content">
                <div class="wpa-option__title">Компрессор звука</div>
                <div class="wpa-option__desc">Выравнивание громкости</div>
            </div>
            <label class="wpa-toggle">
                <input type="checkbox" class="wpa-toggle__input" data-option="compressor" ${s.compressor ? 'checked' : ''}>
                <div class="wpa-toggle__track"><div class="wpa-toggle__thumb"></div></div>
            </label>
        </div>
    </div>
    <div class="wpa-section">
        <div class="wpa-section__header">
            <div class="wpa-section__icon">${Icons.info}</div>
            <div class="wpa-section__title">О скрипте</div>
        </div>
        <div class="wpa-option" style="cursor: default;">
            <div class="wpa-option__icon">${Icons.zap}</div>
            <div class="wpa-option__content">
                <div class="wpa-option__title">WPARTY Auto Redesign</div>
                <div class="wpa-option__desc">Версия ${CONFIG.version} • ${CONFIG.releaseDate}</div>
            </div>
        </div>
    </div>
</div>`;
    },

    renderSkipCreditsExtra(s) {
        return `
<div class="wpa-segments">
    <button class="wpa-segment ${s.skipMode === 'percent' ? 'wpa-segment--active' : ''}" data-mode="percent">По проценту</button>
    <button class="wpa-segment ${s.skipMode === 'seconds' ? 'wpa-segment--active' : ''}" data-mode="seconds">По времени</button>
</div>
<div class="wpa-option">
    <div class="wpa-option__icon">${s.skipMode === 'percent' ? Icons.percent : Icons.clock}</div>
    <div class="wpa-option__content">
        <div class="wpa-option__title">${s.skipMode === 'percent' ? 'Процент просмотра' : 'Секунд до конца'}</div>
        <div class="wpa-option__desc">${s.skipMode === 'percent' ? 'От 50% до 99%' : 'От 10 до 300 сек'}</div>
    </div>
    <input type="number" class="wpa-input" style="width: 80px;" data-input="skipValue" value="${s.skipMode === 'percent' ? s.skipPercent : s.skipSeconds}" min="${s.skipMode === 'percent' ? 50 : 10}" max="${s.skipMode === 'percent' ? 99 : 300}">
</div>`;
    },

    renderVolumeExtra(s) {
        return `
<div class="wpa-option">
    <div class="wpa-option__icon">${Icons.tv}</div>
    <div class="wpa-option__content">
        <div class="wpa-option__title">OSD индикатор</div>
        <div class="wpa-option__desc">Показывать уровень на экране</div>
    </div>
    <label class="wpa-toggle">
        <input type="checkbox" class="wpa-toggle__input" data-option="volumeOSD" ${s.volumeOSD ? 'checked' : ''}>
        <div class="wpa-toggle__track"><div class="wpa-toggle__thumb"></div></div>
    </label>
</div>`;
    },

    renderVolumeControlPanel() {
        const currentVol = Math.round(Volume.getSaved() * 100);
        return `
<div class="wpa-volume-controls">
    <button class="wpa-volume-btn" data-vol-action="decrease" title="Уме��ьшить громкость (-5%)">
        ${Icons.minus}
    </button>
    <div class="wpa-volume-display" data-live="volume-percent">${currentVol}%</div>
    <button class="wpa-volume-btn" data-vol-action="increase" title="Увеличить громкость (+5%)">
        ${Icons.plus}
    </button>
</div>`;
    },

    renderHistoryList(history) {
        const entries = Object.entries(history).sort((a, b) => (b[1]?.timestamp || 0) - (a[1]?.timestamp || 0));
        if (entries.length === 0) {
            return `<div class="wpa-empty"><div class="wpa-empty__icon">${Icons.tv}</div><div class="wpa-empty__text">История просмотров пуста</div></div>`;
        }
        return entries.map(([id, show]) => `
<div class="wpa-show-card" data-url="${show.url || ''}">
    <div class="wpa-show-card__icon">${Icons.tv}</div>
    <div class="wpa-show-card__content">
        <div class="wpa-show-card__name">${show.name || 'Неизвестный сериал'}</div>
        <div class="wpa-show-card__meta">Сезон ${show.season}, Серия ${show.episode}</div>
    </div>
    <div class="wpa-show-card__arrow">${Icons.chevronRight}</div>
</div>`).join('');
    },

    getHistorySignature(history) {
        return Object.entries(history).map(([id, s]) => `${id}:${s.name}:${s.season}:${s.episode}:${s.timestamp}`).join('|');
    },

    toggle(open = null) {
        const shouldOpen = open !== null ? open : !State.panelOpen;
        State.panelOpen = shouldOpen;
        this.elements.panel?.classList.toggle('wpa-panel--open', shouldOpen);
        this.elements.overlay?.classList.toggle('wpa-panel-overlay--visible', shouldOpen);
    },

    bindEvents() {
        this.cleanupFunctions.forEach(fn => fn());
        this.cleanupFunctions = [];

        const { fab, overlay, panel } = this.elements;

        if (fab) {
            const handleFab = () => this.toggle();
            fab.addEventListener('click', handleFab);
            this.cleanupFunctions.push(() => fab.removeEventListener('click', handleFab));
        }

        if (overlay) {
            const handleOverlay = (e) => { if (e.target === overlay) this.toggle(false); };
            overlay.addEventListener('click', handleOverlay);
            this.cleanupFunctions.push(() => overlay.removeEventListener('click', handleOverlay));
        }

        const closeBtn = panel?.querySelector('[data-action="close"]');
        if (closeBtn) {
            const handleClose = () => this.toggle(false);
            closeBtn.addEventListener('click', handleClose);
            this.cleanupFunctions.push(() => closeBtn.removeEventListener('click', handleClose));
        }

        panel?.querySelectorAll('.wpa-tab').forEach(tab => {
            const handleTab = () => {
                const name = tab.dataset.tab;
                State.activeTab = name;
                panel.querySelectorAll('.wpa-tab').forEach(t => t.classList.remove('wpa-tab--active'));
                panel.querySelectorAll('.wpa-tab-content').forEach(c => c.classList.remove('wpa-tab-content--active'));
                tab.classList.add('wpa-tab--active');
                panel.querySelector(`[data-content="${name}"]`)?.classList.add('wpa-tab-content--active');
            };
            tab.addEventListener('click', handleTab);
            this.cleanupFunctions.push(() => tab.removeEventListener('click', handleTab));
        });

        this.bindLiveControls(panel);

        const handleEsc = (e) => { if (e.key === 'Escape' && State.panelOpen) this.toggle(false); };
        document.addEventListener('keydown', handleEsc);
        this.cleanupFunctions.push(() => document.removeEventListener('keydown', handleEsc));

        this.startLiveObserver();

        // Периодический запрос громкости из плеера
        if (State.settings.volumeControl) {
            const volumeInterval = setInterval(() => {
                if (State.panelOpen) {
                    Volume.requestCurrentVolume();
                }
            }, 2000);
            this.cleanupFunctions.push(() => clearInterval(volumeInterval));
        }
    },

    startLiveObserver() {
        if (!IS_TOP || IS_PLAYER) return;
        if (State.ui.liveObserver?.observer) return;

        const onChange = Utils.throttle(() => this.updateLiveUI(), 200);

        const observer = new MutationObserver((mutations) => {
            let shouldUpdate = false;

            for (const m of mutations) {
                const target = m.target;
                if (target?.closest?.('.wpa-panel')) continue;

                if (target?.closest?.('div[name="season"], div[name="episode"], #moviePlayer, iframe.videoContent, h1, .title')) {
                    shouldUpdate = true;
                    break;
                }

                if (m.type === 'attributes' && m.attributeName === 'title') {
                    shouldUpdate = true;
                    break;
                }

                if (m.addedNodes?.length) {
                    for (const n of m.addedNodes) {
                        if (n.nodeType !== 1) continue;
                        if (n.matches?.('div[name="season"], div[name="episode"], #moviePlayer, iframe.videoContent, h1, .title') ||
                            n.querySelector?.('div[name="season"], div[name="episode"], #moviePlayer, iframe.videoContent, h1, .title')) {
                            shouldUpdate = true;
                            break;
                        }
                    }
                    if (shouldUpdate) break;
                }
            }

            if (State.settings.showPanel) {
                const hasFab = !!document.querySelector('.wpa-fab');
                const hasPanel = !!document.querySelector('.wpa-panel');
                if (!hasFab || !hasPanel) {
                    this.create();
                    return;
                }
            }

            if (shouldUpdate) {
                onChange();
                AutoSync.onEpisodeChange();
            }
        });

        observer.observe(document.body, {
            subtree: true,
            childList: true,
            attributes: true,
            attributeFilter: ['class', 'aria-selected', 'aria-checked', 'aria-expanded', 'title']
        });

        State.ui.liveObserver = { observer };
        this.cleanupFunctions.push(() => {
            observer.disconnect();
            State.ui.liveObserver = null;
        });
    },

    bindLiveControls(panel) {
        if (!panel) return;

        panel.querySelectorAll('.wpa-quick-action').forEach(action => {
            if (action.dataset.bound === '1') return;
            action.dataset.bound = '1';

            action.addEventListener('click', () => {
                const key = action.dataset.quick;
                if (key === 'history') {
                    this.showWatchList();
                } else if (key === 'autoNext' || key === 'skipCredits' || key === 'autoSync') {
                    Storage.saveSettings({ [key]: !State.settings[key] });
                    if (key === 'autoSync' && !State.settings.autoSync) {
                        AutoSync.cancel();
                    }
                    this.updateLiveUI();
                }
            });
        });

        panel.querySelectorAll('.wpa-segment').forEach(seg => {
            if (seg.dataset.bound === '1') return;
            seg.dataset.bound = '1';

            seg.addEventListener('click', () => {
                Storage.saveSettings({ skipMode: seg.dataset.mode });
                this.updateLiveUI();
            });
        });

        panel.querySelectorAll('[data-option]').forEach(input => {
            if (input.dataset.bound === '1') return;
            input.dataset.bound = '1';

            input.addEventListener('change', (e) => {
                const key = input.dataset.option;
                Storage.saveSettings({ [key]: e.target.checked });

                if (key === 'volumeControl' && e.target.checked) {
                    setTimeout(() => Volume.apply(), 500);
                }
                if (key === 'compressor') AudioCompressor.toggle();
                if (key === 'autoSync' && !e.target.checked) {
                    AutoSync.cancel();
                }
                if (['skipCredits', 'volumeControl', 'compressor', 'autoSync'].includes(key)) this.updateLiveUI();
            });
        });

        panel.querySelectorAll('[data-input]').forEach(input => {
            if (input.dataset.bound === '1') return;
            input.dataset.bound = '1';

            input.addEventListener('change', Utils.debounce((e) => {
                const key = State.settings.skipMode === 'percent' ? 'skipPercent' : 'skipSeconds';
                const value = parseInt(e.target.value);
                if (!isNaN(value)) Storage.saveSettings({ [key]: value });
            }, CONFIG.debounce.input));
        });

        panel.querySelectorAll('.wpa-clear-history-btn').forEach(clearBtn => {
            if (clearBtn.dataset.bound === '1') return;
            clearBtn.dataset.bound = '1';

            clearBtn.addEventListener('click', () => {
                if (confirm('Вы уверены, что хотите очистить всю историю просмотров?')) {
                    Storage.clearWatchHistory();
                    Notifications.show('История просмотров очищена', 'success', 3000);
                    this.updateLiveUI();
                }
            });
        });

        panel.querySelectorAll('.wpa-show-card').forEach(card => {
            if (card.dataset.bound === '1') return;
            card.dataset.bound = '1';

            card.addEventListener('click', () => {
                const url = card.dataset.url;
                if (url) window.location.href = url;
            });
        });

        // Кнопки управления громкостью
        panel.querySelectorAll('[data-vol-action]').forEach(btn => {
            if (btn.dataset.bound === '1') return;
            btn.dataset.bound = '1';

            btn.addEventListener('click', () => {
                const action = btn.dataset.volAction;
                if (action === 'increase') {
                    Volume.increaseVolume();
                } else if (action === 'decrease') {
                    Volume.decreaseVolume();
                }
                setTimeout(() => this.updateVolumeDisplay(), 50);
            });
        });
    },

    updateVolumeDisplay() {
        const panel = this.elements.panel;
        if (!panel) return;

        const volDisplay = panel.querySelector('[data-live="volume-percent"]');
        if (volDisplay) {
            volDisplay.textContent = `${Math.round(Volume.getSaved() * 100)}%`;
        }
    },

    updateLiveUI() {
        if (!IS_TOP || IS_PLAYER) return;

        const panel = this.elements.panel;
        const fab = this.elements.fab;

        if (State.settings.showPanel && (!panel || !fab)) {
            this.create();
            return;
        }

        if (!panel) return;

        Storage.refreshCurrentShowName();

        const status = panel.querySelector('.wpa-status');
        const statusTitle = panel.querySelector('.wpa-status__title');
        const statusDesc = panel.querySelector('.wpa-status__desc');

        if (status) status.classList.toggle('wpa-status--active', !!State.settings.autoNext);
        if (statusTitle) statusTitle.textContent = State.settings.autoNext ? 'Автоматика активна' : 'Автоматика выключена';
        if (statusDesc) statusDesc.textContent = State.settings.autoNext ? 'Серии переключаются автоматически' : 'Включите автопереключение для работы';

        if (fab) {
            const badge = fab.querySelector('.wpa-fab__badge');
            if (State.settings.autoNext && !badge) {
                const b = document.createElement('span');
                b.className = 'wpa-fab__badge';
                b.textContent = '✓';
                fab.appendChild(b);
            } else if (!State.settings.autoNext && badge) {
                badge.remove();
            }
        }

        panel.querySelectorAll('.wpa-quick-action').forEach(action => {
            const key = action.dataset.quick;
            if (key === 'autoNext' || key === 'skipCredits' || key === 'autoSync') {
                action.classList.toggle('wpa-quick-action--active', !!State.settings[key]);
            }
        });

        panel.querySelectorAll('[data-option]').forEach(input => {
            const key = input.dataset.option;
            if (typeof State.settings[key] !== 'undefined') {
                input.checked = !!State.settings[key];
            }
        });

        panel.querySelectorAll('.wpa-segment').forEach(seg => {
            seg.classList.toggle('wpa-segment--active', seg.dataset.mode === State.settings.skipMode);
        });

        const skipContainer = panel.querySelector('[data-live="skipCreditsExtra"]');
        if (skipContainer) {
            const shouldShow = !!State.settings.skipCredits;
            const isShown = skipContainer.childElementCount > 0;

            if (shouldShow && !isShown) {
                skipContainer.innerHTML = this.renderSkipCreditsExtra(State.settings);
                this.bindLiveControls(panel);
            } else if (!shouldShow && isShown) {
                skipContainer.innerHTML = '';
            } else if (shouldShow && isShown) {
                skipContainer.querySelectorAll('.wpa-segment').forEach(seg => {
                    seg.classList.toggle('wpa-segment--active', seg.dataset.mode === State.settings.skipMode);
                });

                const icon = skipContainer.querySelector('.wpa-option__icon');
                const title = skipContainer.querySelector('.wpa-option__title');
                const desc = skipContainer.querySelector('.wpa-option__desc');
                const input = skipContainer.querySelector('[data-input="skipValue"]');

                if (icon) icon.innerHTML = State.settings.skipMode === 'percent' ? Icons.percent : Icons.clock;
                if (title) title.textContent = State.settings.skipMode === 'percent' ? 'Процент просмотра' : 'Секунд до конца';
                if (desc) desc.textContent = State.settings.skipMode === 'percent' ? 'От 50% до 99%' : 'От 10 до 300 сек';
                if (input && document.activeElement !== input) {
                    input.value = State.settings.skipMode === 'percent' ? State.settings.skipPercent : State.settings.skipSeconds;
                    input.min = State.settings.skipMode === 'percent' ? 50 : 10;
                    input.max = State.settings.skipMode === 'percent' ? 99 : 300;
                }
            }
        }

        const volumeContainer = panel.querySelector('[data-live="volumeExtra"]');
        if (volumeContainer) {
            const shouldShow = !!State.settings.volumeControl;
            const isShown = volumeContainer.childElementCount > 0;

            if (shouldShow && !isShown) {
                volumeContainer.innerHTML = this.renderVolumeExtra(State.settings);
                this.bindLiveControls(panel);
            } else if (!shouldShow && isShown) {
                volumeContainer.innerHTML = '';
            }
        }

        const volumeControlPanel = panel.querySelector('[data-live="volumeControlPanel"]');
        if (volumeControlPanel) {
            const shouldShow = !!State.settings.volumeControl;
            const isShown = volumeControlPanel.childElementCount > 0;

            if (shouldShow && !isShown) {
                volumeControlPanel.innerHTML = this.renderVolumeControlPanel();
                this.bindLiveControls(panel);
            } else if (!shouldShow && isShown) {
                volumeControlPanel.innerHTML = '';
            } else if (shouldShow && isShown) {
                this.updateVolumeDisplay();
            }
        }

        this.updateNowStats(panel);
        this.updateStatsUI(panel);
    },

    // Вспомогательный метод: нормализация данных о сезонах/сериях
    normalizeTotals(totals) {
        return {
            seasonTotal: Number.isFinite(totals.seasonTotal) && totals.seasonTotal > 0 ? totals.seasonTotal : '—',
            episodeTotal: Number.isFinite(totals.episodeTotal) && totals.episodeTotal > 0 ? totals.episodeTotal : '—',
            seasonCurrent: Number.isFinite(totals.seasonCurrent) && totals.seasonCurrent > 0 ? totals.seasonCurrent : '—',
            episodeCurrent: Number.isFinite(totals.episodeCurrent) && totals.episodeCurrent > 0 ? totals.episodeCurrent : '—'
        };
    },

    updateNowStats(panel) {
        const container = panel.querySelector('[data-now="container"]');
        if (!container) return;

        const totals = this.normalizeTotals(
            (typeof MainMode !== 'undefined' && MainMode.getSeasonEpisodeTotals)
                ? MainMode.getSeasonEpisodeTotals()
                : {}
        );

        const seasonEl = container.querySelector('[data-now="season"]');
        const episodeEl = container.querySelector('[data-now="episode"]');
        const totalEl = container.querySelector('[data-now="total"]');

        if (seasonEl) seasonEl.textContent = `Сезон ${totals.seasonCurrent} из ${totals.seasonTotal}`;
        if (episodeEl) episodeEl.textContent = `Серия ${totals.episodeCurrent} из ${totals.episodeTotal}`;
        if (totalEl) totalEl.textContent = `Всего: ${totals.seasonTotal} сезонов • ${totals.episodeTotal} серий`;
    },

    updateStatsUI(panel) {
        const statsTab = panel.querySelector('[data-content="stats"]');
        if (!statsTab) return;

        const history = Storage.getWatchHistory();
        const lastShow = Object.values(history).sort((a, b) => b.timestamp - a.timestamp)[0];
        const totals = this.normalizeTotals(
            (typeof MainMode !== 'undefined' && MainMode.getSeasonEpisodeTotals)
                ? MainMode.getSeasonEpisodeTotals()
                : {}
        );

        const statSeasons = statsTab.querySelector('[data-live="stat-seasons"] .wpa-stat-card__value');
        const statSeason = statsTab.querySelector('[data-live="stat-season"] .wpa-stat-card__value');
        const statEpisodes = statsTab.querySelector('[data-live="stat-episodes"] .wpa-stat-card__value');
        const statLast = statsTab.querySelector('[data-live="stat-last"]');

        if (statSeasons) statSeasons.textContent = totals.seasonTotal;
        if (statSeason) statSeason.textContent = totals.seasonCurrent;
        if (statEpisodes) statEpisodes.textContent = totals.episodeTotal;
        if (statLast) statLast.textContent = lastShow ? lastShow.name : 'Нет данных';

        const signature = this.getHistorySignature(history);
        if (State.ui.historySignature !== signature) {
            State.ui.historySignature = signature;
            const listEl = statsTab.querySelector('[data-live="history-list"]');
            if (listEl) {
                listEl.innerHTML = this.renderHistoryList(history);
                this.bindLiveControls(panel);
            }
        }
    },

    showWatchList() {
        if (State.showListOpen) return;

        const history = Storage.getWatchHistory();
        const shows = Object.entries(history).map(([id, d]) => ({ id, ...d })).sort((a, b) => b.timestamp - a.timestamp);

        const overlay = document.createElement('div');
        overlay.className = 'wpa-modal-overlay';
        overlay.innerHTML = `
<div class="wpa-modal">
    <div class="wpa-modal__header">
        <span class="wpa-modal__title">История просмотров</span>
        <button class="wpa-modal__close">${Icons.x}</button>
    </div>
    <div class="wpa-modal__body">
        ${shows.length === 0 ? `
        <div class="wpa-empty">
            <div class="wpa-empty__icon">${Icons.tv}</div>
            <div class="wpa-empty__text">История просмотров пуста</div>
        </div>
        ` : shows.map(s => `
        <div class="wpa-show-card" data-url="${s.url || ''}">
            <div class="wpa-show-card__icon">${Icons.tv}</div>
            <div class="wpa-show-card__content">
                <div class="wpa-show-card__name">${s.name || 'Неизвестный сериал'}</div>
                <div class="wpa-show-card__meta">Сезон ${s.season || 1}, Серия ${s.episode || 1}</div>
            </div>
            <div class="wpa-show-card__arrow">${Icons.chevronRight}</div>
        </div>
        `).join('')}
    </div>
</div>`;

        document.body.appendChild(overlay);
        State.showListOpen = true;

        requestAnimationFrame(() => overlay.classList.add('wpa-modal-overlay--visible'));

        const close = () => {
            overlay.classList.remove('wpa-modal-overlay--visible');
            setTimeout(() => { overlay.remove(); State.showListOpen = false; }, 300);
        };

        overlay.querySelector('.wpa-modal__close')?.addEventListener('click', close);
        overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
        overlay.querySelectorAll('.wpa-show-card').forEach(card => {
            card.addEventListener('click', () => {
                const url = card.dataset.url;
                if (url) window.location.href = url;
            });
        });
    }
};

// ══════════��════════════════════════════════════════════════
// РЕЖИМ ПЛЕЕРА (iframe)
// ═══════════════════════════════════════════════════════════
const PlayerMode = {
    errorCount: 0,
    maxErrors: 5,

    getProgress() {
        const seek = DOM.seekSlider();
        if (!seek) return null;

        const cur = parseFloat(seek.getAttribute('aria-valuenow'));
        const max = parseFloat(seek.getAttribute('aria-valuemax'));

        if (isNaN(cur) || isNaN(max) || max <= 0) return null;
        return { cur, max };
    },

    run() {
        Logger.info('Режим ПЛЕЕРА (iframe)');

        // Обработка ошибок видео
        const video = DOM.video();
        if (video) {
            video.addEventListener('error', (e) => {
                if (video.error) {
                    Logger.warn(`Ошибка видео: ${video.error.message || 'code ' + video.error.code}`);
                }
            });

            video.addEventListener('playing', () => {
                this.errorCount = 0;
            });
        }

        State.intervals.progress = setInterval(() => {
            try {
                const prog = this.getProgress();
                if (!prog || State.hasTriggered) return;

                const video = DOM.video();
                if (!video || !video.duration || !isFinite(video.duration)) return;

                if (Credits.shouldSkip(video.currentTime, video.duration)) {
                    State.hasTriggered = true;
                    Logger.success('Пропуск титров активирован!');
                    IframeComm.sendToParent('WPARTY_NEXT_EPISODE', { remaining: video.duration - video.currentTime });

                    setTimeout(() => { State.hasTriggered = false; }, CONFIG.timeouts.nextEpisode);
                }
            } catch (e) {
                Logger.error(`Ошибка мониторинга: ${e.message}`);
            }
        }, CONFIG.intervals.check);

        if (State.settings.volumeControl) {
            setTimeout(() => {
                try {
                    Volume.hookControls();
                    const saved = Volume.getSaved();
                    if (saved > 0) Volume.applyDirect(saved, false);
                } catch (e) {
                    Logger.error(`Ошибка инициализации громкости: ${e.message}`);
                }
            }, CONFIG.timeouts.volumeInitial);

            setTimeout(() => {
                try {
                    const saved = Volume.getSaved();
                    Volume.applyDirect(saved, false);
                } catch (e) {
                    Logger.error(`Ошибка применения громкости: ${e.message}`);
                }
            }, CONFIG.timeouts.volumeRetry);
        }

        if (State.settings.compressor) {
            setTimeout(() => {
                try {
                    AudioCompressor.sync();
                } catch (e) {
                    Logger.error(`Ошибка компрессора: ${e.message}`);
                }
            }, CONFIG.timeouts.volumeInitial);
        }

        Logger.success('Мониторинг плеера запущен');
    }
};

// ═══════════════════════════════════════════════════════════
// ОСНОВНОЙ РЕЖИМ
// ═══════════════════════════════════════════════════════════
const MainMode = {
    startNextCountdown(seconds, onComplete) {
        if (!State.settings.autoNext) return;

        if (State.ui.nextCountdown?.timer) {
            clearInterval(State.ui.nextCountdown.timer);
        }
        State.ui.nextCountdown?.el?.remove();

        const total = Math.max(5, Math.min(10, Math.round(seconds)));
        let remaining = total;

        const box = document.createElement('div');
        box.className = 'wpa-next-countdown';
        box.innerHTML = `
<div class="wpa-next-countdown__row">
    <div class="wpa-next-countdown__title">Следующая серия</div>
    <div class="wpa-next-countdown__time">${remaining}s</div>
</div>
<div class="wpa-next-countdown__progress"><div class="wpa-next-countdown__bar"></div></div>
<button class="wpa-next-countdown__cancel" type="button">Отмена</button>`;

        document.body.appendChild(box);

        const timeEl = box.querySelector('.wpa-next-countdown__time');
        const barEl = box.querySelector('.wpa-next-countdown__bar');

        const updateBar = () => { if (barEl) barEl.style.width = `${(remaining / total) * 100}%`; };
        updateBar();

        const cancel = () => {
            clearInterval(State.ui.nextCountdown?.timer);
            State.ui.nextCountdown = null;
            box.remove();
            Notifications.show('Автопереход отменён', 'info', 2000);
        };

        box.querySelector('.wpa-next-countdown__cancel')?.addEventListener('click', cancel);

        const timer = setInterval(() => {
            remaining -= 1;
            if (remaining <= 0) {
                clearInterval(timer);
                State.ui.nextCountdown = null;
                box.remove();
                onComplete?.();
                return;
            }
            if (timeEl) timeEl.textContent = `${remaining}s`;
            updateBar();
        }, 1000);

        State.ui.nextCountdown = { timer, el: box };
    },

    getSeasonEpisodeTotals() {
        let seasonTotal = null, episodeTotal = null, seasonCurrent = null, episodeCurrent = null;

        try {
            const seasonDrop = DOM.select('div[name="season"]', false);
            if (seasonDrop) {
                const menu = seasonDrop.querySelector('.menu');
                if (menu) {
                    const all = [...menu.querySelectorAll('.item')];
                    const cur = menu.querySelector('.item.active.selected');
                    seasonTotal = all.length || null;
                    if (cur) {
                        const idx = all.indexOf(cur);
                        seasonCurrent = idx >= 0 ? idx + 1 : null;
                    }
                }
            }

            const epDrop = DOM.select('div[name="episode"]', false);
            if (epDrop) {
                const menu = epDrop.querySelector('.menu');
                if (menu) {
                    const all = [...menu.querySelectorAll('.item')];
                    const cur = menu.querySelector('.item.active.selected');
                    episodeTotal = all.length || null;
                    if (cur) {
                        const idx = all.indexOf(cur);
                        episodeCurrent = idx >= 0 ? idx + 1 : null;
                    }
                }
            }
        } catch (e) {
            Logger.error(`Ошибка определения общего количества сезонов/серий: ${e.message}`);
        }

        return { seasonTotal, episodeTotal, seasonCurrent, episodeCurrent };
    },

    getSeasonEpisode() {
        let season = 1, episode = 1;

        try {
            const seasonDrop = DOM.select('div[name="season"]', false);
            if (seasonDrop) {
                const menu = seasonDrop.querySelector('.menu');
                if (menu) {
                    const all = [...menu.querySelectorAll('.item')];
                    const cur = menu.querySelector('.item.active.selected');
                    if (cur) {
                        const idx = all.indexOf(cur);
                        season = idx >= 0 ? idx + 1 : 1;
                    }
                }
            }

            const epDrop = DOM.select('div[name="episode"]', false);
            if (epDrop) {
                const menu = epDrop.querySelector('.menu');
                if (menu) {
                    const all = [...menu.querySelectorAll('.item')];
                    const cur = menu.querySelector('.item.active.selected');
                    if (cur) {
                        const idx = all.indexOf(cur);
                        episode = idx >= 0 ? idx + 1 : 1;
                    }
                }
            }
        } catch (e) {
            Logger.error(`Ошибка определения сезона/серии: ${e.message}`);
        }

        return { season, episode };
    },

    getEpisodeInfo() {
        try {
            const drop = DOM.select('div[name="episode"]', false);
            if (!drop) return null;

            const menu = drop.querySelector('.menu');
            if (!menu) return null;

            const all = [...menu.querySelectorAll('.item')];
            const cur = menu.querySelector('.item.active.selected');

            if (!all.length || !cur) return null;

            const idx = all.indexOf(cur);
            if (idx < 0) return null;

            return {
                total: all.length,
                current: idx + 1,
                isLast: idx === all.length - 1,
                next: idx < all.length - 1 ? all[idx + 1] : null,
                dropdown: drop
            };
        } catch (e) {
            Logger.error(`Ошибка получения информации о серии: ${e.message}`);
            return null;
        }
    },

    async switchNext() {
        if (!State.settings.autoNext) return false;

        try {
            const info = this.getEpisodeInfo();
            if (!info) {
                Logger.warn('Не удалось получить информацию о сериях');
                return false;
            }

            if (info.isLast) {
                if (State.settings.autoSeason) {
                    Logger.info('Последняя серия сезона, проверяю наличие следующего сезона...');

                    const seasonDrop = DOM.select('div[name="season"]', false);
                    if (seasonDrop) {
                        const menu = seasonDrop.querySelector('.menu');
                        if (menu) {
                            const all = [...menu.querySelectorAll('.item')];
                            const cur = menu.querySelector('.item.active.selected');
                            if (cur) {
                                const idx = all.indexOf(cur);
                                if (idx >= 0 && idx < all.length - 1) {
                                    seasonDrop.click();
                                    setTimeout(() => {
                                        all[idx + 1].click();
                                        Notifications.show('🎬 Переключаюсь на следующий сезон...', 'success', 4000);
                                        AutoSync.scheduleSync();
                                    }, CONFIG.timeouts.domWait);
                                    return true;
                                }
                            }
                        }
                    }
                }
                Logger.info('Последняя серия в списке, переключение невозможно');
                return false;
            }

            info.dropdown.click();

            return new Promise(resolve => {
                setTimeout(() => {
                    if (info.next) {
                        info.next.click();
                        const { season, episode } = this.getSeasonEpisode();
                        Storage.saveWatchHistory(season, episode + 1);
                        Notifications.show('📺 Следующая серия загружается...', 'success', 4000);
                        AutoSync.scheduleSync();
                        resolve(true);
                    } else {
                        resolve(false);
                    }
                }, CONFIG.timeouts.domWait);
            });
        } catch (e) {
            Logger.error(`Ошибка переключения серии: ${e.message}`);
            return false;
        }
    },

    run() {
        Logger.info('Режим ОСНОВНОЙ СТРАНИЦЫ');
        State.currentShowId = Storage.getShowId();
        State.sync.lastEpisode = AutoSync.getCurrentEpisodeId();

        // Кэширование текущей страницы
        OfflineCache.cacheCurrentPage();

        // Измерение производительности
        Performance.measurePerformance();

        setTimeout(() => {
            Panel.create();
            const { season, episode } = this.getSeasonEpisode();
            Storage.saveWatchHistory(season, episode);
        }, CONFIG.timeouts.domWait * 2);
    }
};

// ═══════════════════════════════════════════════════════════
// ОЧИСТКА РЕСУРСОВ
// ═══════════════════════════════════════════════════════════
const cleanup = () => {
    Logger.info('Очистка ресурсов...');

    Object.entries(State.intervals).forEach(([key, interval]) => {
        if (interval) {
            clearInterval(interval);
            State.intervals[key] = null;
        }
    });

    AutoSync.cancel();

    State.dom.observers.forEach(obs => obs.disconnect());
    State.dom.observers = [];

    if (State.volume.observer) {
        State.volume.observer.disconnect();
        State.volume.observer = null;
    }

    AudioCompressor.disable();

    State.cleanup.forEach(fn => { try { fn(); } catch (e) {} });
    State.cleanup = [];

    Panel.cleanupFunctions.forEach(fn => { try { fn(); } catch (e) {} });
    Panel.cleanupFunctions = [];

    if (typeof GestureManager !== 'undefined') {
        GestureManager.cleanup();
    }

    // Очистка производительности
    if (typeof Performance !== 'undefined') {
        if (Performance.idleCallbackHandle) {
            cancelIdleCallback(Performance.idleCallbackHandle);
        }
    }

    // Сохранение офлайн-состояния
    OfflineCache.saveOfflineState();

    Logger.success('Ресурсы очищены');
};

// ═══════════════════════════════════════════════════════════
// ИНИЦИАЛИЗАЦИЯ
// ═══════════════════════════════════════════════════════════
const init = () => {
    try {
        Storage.migrate();
        State.settings = Storage.loadSettings();

        if (!State.settings.showPanel) {
            Storage.saveSettings({ showPanel: true });
            State.settings.showPanel = true;
        }

        Logger.info('═══════════════════════════════════════');
        Logger.info(`WPARTY Auto v${CONFIG.version} - СТАРТ`);
        Logger.info(`Режим: ${IS_PLAYER ? 'ПЛЕЕР (iframe)' : 'ОСНОВНАЯ СТРАНИЦА'}`);
        Logger.info('═══════════════════════════════════════');
        Logger.info(`Автопереключение: ${State.settings.autoNext ? 'ВКЛ' : 'ВЫКЛ'}`);
        Logger.info(`Пропуск титров: ${State.settings.skipCredits ? 'ВКЛ' : 'ВЫКЛ'}`);
        Logger.info(`Громкость: ${State.settings.volumeControl ? 'ВКЛ' : 'ВЫКЛ'}`);
        Logger.info(`Компрессор: ${State.settings.compressor ? 'ВКЛ' : 'ВЫКЛ'}`);
        Logger.info(`Автосинхронизация: ${State.settings.autoSync ? 'ВКЛ' : 'ВЫКЛ'}`);

        injectStyles();
        IframeComm.setupListener();

        // Инициализация офлайн-режима и производительности
        OfflineCache.init();
        Performance.init();

        if (!IS_PLAYER && Utils.isMobile()) {
            GestureManager.init();
        }

        window.addEventListener('beforeunload', cleanup);
        State.cleanup.push(() => {
            window.removeEventListener('beforeunload', cleanup);
            if (!IS_PLAYER) GestureManager.cleanup();
            OfflineCache.saveOfflineState();
            Performance.cleanupOnIdle();
        });

        if (IS_PLAYER) {
            PlayerMode.run();
        } else {
            MainMode.run();
        }

        Logger.success('Инициализация завершена');
    } catch (e) {
        Logger.error(`Критическая ошибка инициализации: ${e.message}`);
        console.error(e);
    }
};

// Запуск
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}

})();
