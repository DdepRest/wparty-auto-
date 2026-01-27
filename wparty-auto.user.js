// ==UserScript==
// @name         WPARTY Auto - Ultimate Edition
// @namespace    https://github.com/DdepRest/wparty-auto-
// @version      6.3.0
// @description  Автопереключение серий, умный пропуск титров, статистика с графиками
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

(function() {
    'use strict';

    // ============ КОНФИГУРАЦИЯ ПО УМОЛЧАНИЮ ============
    const DEFAULTS = {
        // Автопереключение
        autoNext: false,
        autoSeason: false,

        // Пропуск титров
        skipCredits: false,
        skipMode: 'percent',
        skipPercent: 95,
        skipSeconds: 90,

        // Громкость
        volumeControl: false,
        volumeOSD: false,
        volumeSync: false,
        volumePerChannel: false,

        // Анимации
        animations: true,
        transitionSpeed: 'normal',

        // Интерфейс
        showNotifications: true,
        showPanel: true,
        trackWatchTime: true,

        // Статистика
        showCharts: true,
        chartType: 'line'
    };

    const CHECK_INTERVAL = 1000;
    const WATCH_TIME_INTERVAL = 10000;
    const VOLUME_CHECK_INTERVAL = 2000;
    const TRUSTED_ORIGINS = ['wparty.net', 'stloadi.live'];

    const VERSION_INFO = {
        current: '6.3.0',
        releaseDate: '2025-01-27',
        changelog: 'Исправлено восстановление громкости после сброса сайтом'
    };

    // ============ СОСТОЯНИЕ ============
    let hasTriggered = false;
    let progressInterval = null;
    let watchTimeInterval = null;
    let volumeCheckInterval = null;
    let volumeObserver = null;
    let settings = {};
    let currentShowId = null;
    let showListOpen = false;

    // Состояние громкости
    const volumeState = {
        userIntentionallyMuted: false,
        volumeChannel: null,
        hookedElements: new WeakMap(),
        isApplying: false,
        lastUserVolume: 0.5
    };

    // ============ УТИЛИТЫ ============
    function log(msg) {
        console.log(`🎬 WPARTY Auto v${VERSION_INFO.current}: ${msg}`);
    }

    function generateShowId() {
        const path = window.location.pathname;
        const match = path.match(/\/(\d+)/);
        if (match) return match[1];
        return path.split('/').filter(Boolean)[0] || 'unknown';
    }

    function getShowName() {
        const selectors = ['h1.header', 'h1', '.title', '[class*="title"]'];
        for (const selector of selectors) {
            const el = document.querySelector(selector);
            if (el && el.textContent.trim()) {
                return el.textContent.trim().substring(0, 100);
            }
        }
        return 'Неизвестный сериал';
    }

    function loadSettings() {
        try {
            const loaded = {};
            Object.keys(DEFAULTS).forEach(key => {
                loaded[key] = GM_getValue(key, DEFAULTS[key]);
            });
            volumeState.userIntentionallyMuted = GM_getValue('volumeMuteState', false);
            volumeState.lastUserVolume = GM_getValue('savedVolume', 0.5);
            return loaded;
        } catch(e) {
            log('⚠️ GM_getValue недоступен, используем localStorage');
            const saved = localStorage.getItem('wparty_settings');
            return saved ? { ...DEFAULTS, ...JSON.parse(saved) } : { ...DEFAULTS };
        }
    }

    function saveSettings(newSettings) {
        settings = { ...settings, ...newSettings };
        try {
            Object.entries(settings).forEach(([key, value]) => {
                GM_setValue(key, value);
            });
        } catch(e) {
            localStorage.setItem('wparty_settings', JSON.stringify(settings));
        }
    }

    function cleanup() {
        if (progressInterval) clearInterval(progressInterval);
        if (watchTimeInterval) clearInterval(watchTimeInterval);
        if (volumeCheckInterval) clearInterval(volumeCheckInterval);
        if (volumeObserver) {
            volumeObserver.disconnect();
            volumeObserver = null;
        }
        if (volumeState.volumeChannel) {
            try { volumeState.volumeChannel.close(); } catch(e) {}
        }
        log('🧹 Ресурсы очищены');
    }

    function formatTime(seconds) {
        if (seconds < 60) return `${Math.round(seconds)} сек`;
        if (seconds < 3600) return `${Math.round(seconds / 60)} мин`;
        const hours = Math.floor(seconds / 3600);
        const mins = Math.round((seconds % 3600) / 60);
        return `${hours}ч ${mins}м`;
    }

    function formatDate(date) {
        return date.toISOString().split('T')[0];
    }

    function isTrustedOrigin(origin) {
        return TRUSTED_ORIGINS.some(domain => origin.includes(domain));
    }

    // ============ ПРОПУСК ТИТРОВ ============

    function shouldSkipCredits(currentTime, duration) {
        if (!settings.skipCredits || !settings.autoNext) return false;
        if (settings.skipMode === 'percent') {
            const currentPercent = (currentTime / duration) * 100;
            return currentPercent >= settings.skipPercent;
        } else {
            const timeLeft = duration - currentTime;
            return timeLeft <= settings.skipSeconds && timeLeft > 0;
        }
    }

    function getSkipInfo(currentTime, duration) {
        if (settings.skipMode === 'percent') {
            const currentPercent = (currentTime / duration) * 100;
            return { info: `${currentPercent.toFixed(1)}% / ${settings.skipPercent}%` };
        } else {
            const timeLeft = duration - currentTime;
            return { info: `${Math.round(timeLeft)}с / ${settings.skipSeconds}с` };
        }
    }

    // ============ ГРОМКОСТЬ ============

    function clamp01(v) {
        v = Number(v);
        if (!Number.isFinite(v)) return 0.5;
        return Math.max(0, Math.min(1, v));
    }

    function getSavedVolume() {
        try {
            return clamp01(GM_getValue('savedVolume', 0.5));
        } catch(e) {
            return 0.5;
        }
    }

    function saveVolume(vol) {
        if (!settings.volumeControl) return;
        vol = clamp01(vol);
        volumeState.lastUserVolume = vol;
        try {
            GM_setValue('savedVolume', vol);
        } catch(e) {}
    }

    function findVideo() {
        return document.querySelector('video');
    }

    function findVolumeSlider() {
        return document.querySelector('input[data-allplay="volume"]');
    }

    function findMuteButton() {
        return document.querySelector('button[data-allplay="mute"]');
    }

    function applyVolume(showOSD = true) {
        if (!settings.volumeControl) return;
        if (volumeState.isApplying) return;

        volumeState.isApplying = true;

        const video = findVideo();
        const slider = findVolumeSlider();
        const muteBtn = findMuteButton();
        const savedVol = getSavedVolume();

        log(`🔊 Применяю громкость: ${Math.round(savedVol * 100)}%`);

        // Устанавливаем громкость видео
        if (video) {
            video.volume = savedVol;
            video.muted = volumeState.userIntentionallyMuted;
        }

        // Обновляем слайдер полностью
        if (slider) {
            const percent = savedVol * 100;

            // Устанавливаем value
            slider.value = savedVol;

            // Обновляем ARIA атрибуты
            slider.setAttribute('aria-valuenow', Math.round(percent));
            slider.setAttribute('aria-valuetext', `${percent.toFixed(1)}%`);

            // Обновляем CSS переменную для визуального отображения
            slider.style.setProperty('--value', `${percent}%`);

            // Триггерим событие input для уведомления плеера
            const inputEvent = new Event('input', { bubbles: true });
            slider.dispatchEvent(inputEvent);

            // Также триггерим change
            const changeEvent = new Event('change', { bubbles: true });
            slider.dispatchEvent(changeEvent);
        }

        // Обновляем кнопку mute
        if (muteBtn) {
            const isMuted = volumeState.userIntentionallyMuted || savedVol < 0.01;

            if (isMuted) {
                muteBtn.classList.add('allplay__control--pressed');
                muteBtn.setAttribute('aria-pressed', 'true');
            } else {
                muteBtn.classList.remove('allplay__control--pressed');
                muteBtn.setAttribute('aria-pressed', 'false');
            }
        }

        if (showOSD && settings.volumeOSD) {
            showVolumeOSD(savedVol);
        }

        // Снимаем флаг через небольшую задержку
        setTimeout(() => {
            volumeState.isApplying = false;
        }, 150);
    }

    function checkAndRestoreVolume() {
        if (!settings.volumeControl) return;
        if (volumeState.isApplying) return;
        if (volumeState.userIntentionallyMuted) return;

        const slider = findVolumeSlider();
        const video = findVideo();
        const savedVol = getSavedVolume();

        if (!slider && !video) return;

        const currentSliderVol = slider ? parseFloat(slider.value) : null;
        const currentVideoVol = video ? video.volume : null;

        // Если громкость была сброшена сайтом (стала 0 или близка к 0, а сохранённая > 0)
        const sliderReset = currentSliderVol !== null && currentSliderVol < 0.02 && savedVol >= 0.02;
        const videoReset = currentVideoVol !== null && currentVideoVol < 0.02 && savedVol >= 0.02;
        const videoMuted = video && video.muted && !volumeState.userIntentionallyMuted;

        if (sliderReset || videoReset || videoMuted) {
            log('⚠️ Обнаружен сброс громкости сайтом, восстанавливаю...');
            applyVolume(true);
        }
    }

    function showVolumeOSD(vol) {
        let osd = document.getElementById('wp-volume-osd');

        if (!osd) {
            osd = document.createElement('div');
            osd.id = 'wp-volume-osd';
            osd.innerHTML = `
                <div class="wp-vol-icon">🔊</div>
                <div class="wp-vol-bar"><div class="wp-vol-fill"></div></div>
                <div class="wp-vol-text">50%</div>
            `;
            document.body.appendChild(osd);
        }

        const fill = osd.querySelector('.wp-vol-fill');
        const text = osd.querySelector('.wp-vol-text');
        const icon = osd.querySelector('.wp-vol-icon');

        const percent = Math.round(vol * 100);
        fill.style.width = percent + '%';
        text.textContent = percent + '%';

        if (volumeState.userIntentionallyMuted || vol < 0.01) {
            icon.textContent = '🔇';
        } else if (vol < 0.33) {
            icon.textContent = '🔈';
        } else if (vol < 0.66) {
            icon.textContent = '🔉';
        } else {
            icon.textContent = '🔊';
        }

        osd.classList.add('wp-vol-visible');
        clearTimeout(osd._hideTimer);
        osd._hideTimer = setTimeout(() => {
            osd.classList.remove('wp-vol-visible');
        }, 1500);
    }

    function hookVolumeControls() {
        if (!settings.volumeControl) return;

        const slider = findVolumeSlider();
        const video = findVideo();
        const muteBtn = findMuteButton();

        // Обработчик слайдера
        if (slider && !volumeState.hookedElements.has(slider)) {
            volumeState.hookedElements.set(slider, true);

            // Пользователь меняет громкость
            slider.addEventListener('input', (e) => {
                // Проверяем, что это действие пользователя, а не наш скрипт
                if (e.isTrusted && !volumeState.isApplying) {
                    const vol = parseFloat(slider.value);
                    volumeState.userIntentionallyMuted = vol < 0.01;
                    saveVolume(vol);

                    if (settings.volumeOSD) {
                        showVolumeOSD(vol);
                    }

                    log(`👆 Пользователь изменил громкость: ${Math.round(vol * 100)}%`);
                }
            });

            // MutationObserver для отслеживания изменений атрибутов
            if (!volumeObserver) {
                volumeObserver = new MutationObserver((mutations) => {
                    if (volumeState.isApplying) return;

                    for (const mutation of mutations) {
                        if (mutation.type === 'attributes') {
                            const attrName = mutation.attributeName;
                            if (attrName === 'aria-valuenow' || attrName === 'value' || attrName === 'style') {
                                // Проверяем через небольшую задержку
                                setTimeout(checkAndRestoreVolume, 50);
                                break;
                            }
                        }
                    }
                });

                volumeObserver.observe(slider, {
                    attributes: true,
                    attributeFilter: ['value', 'aria-valuenow', 'style']
                });

                log('👀 MutationObserver для слайдера громкости активирован');
            }
        }

        // Обработчик видео
        if (video && !volumeState.hookedElements.has(video)) {
            volumeState.hookedElements.set(video, true);

            video.addEventListener('volumechange', (e) => {
                if (volumeState.isApplying) return;

                // Если громкость изменилась НЕ на 0, сохраняем её
                if (video.volume > 0.01 && !video.muted) {
                    saveVolume(video.volume);
                }
                // Если сброшена на 0 или замьючена, проверяем нужно ли восстановить
                else if (!volumeState.userIntentionallyMuted) {
                    setTimeout(checkAndRestoreVolume, 100);
                }
            });

            log('🎬 Слушатель volumechange для video активирован');
        }

        // Обработчик кнопки mute
        if (muteBtn && !volumeState.hookedElements.has(muteBtn)) {
            volumeState.hookedElements.set(muteBtn, true);

            muteBtn.addEventListener('click', (e) => {
                if (e.isTrusted) {
                    // Пользователь нажал кнопку mute
                    volumeState.userIntentionallyMuted = !volumeState.userIntentionallyMuted;

                    try {
                        GM_setValue('volumeMuteState', volumeState.userIntentionallyMuted);
                    } catch(e) {}

                    log(`🔇 Пользователь ${volumeState.userIntentionallyMuted ? 'выключил' : 'включил'} звук`);

                    // Если пользователь включил звук, восстанавливаем громкость
                    if (!volumeState.userIntentionallyMuted) {
                        setTimeout(() => applyVolume(true), 100);
                    }
                }
            });

            log('🔘 Слушатель клика для кнопки mute активирован');
        }

        // Периодическая проверка громкости
        if (!volumeCheckInterval) {
            volumeCheckInterval = setInterval(checkAndRestoreVolume, VOLUME_CHECK_INTERVAL);
            log(`⏰ Периодическая проверка громкости каждые ${VOLUME_CHECK_INTERVAL}мс`);
        }
    }

    function initVolumeSync() {
        if (!settings.volumeSync) return;
        try {
            volumeState.volumeChannel = new BroadcastChannel('wparty-volume-sync');
            volumeState.volumeChannel.onmessage = (e) => {
                if (e.data?.type === 'volume-change') {
                    applyVolume(false);
                }
            };
        } catch(e) {}
    }

    // ============ ВРЕМЯ ПРОСМОТРА ============

    function getWatchTimeData() {
        try {
            return GM_getValue('watchTime', {});
        } catch(e) {
            return JSON.parse(localStorage.getItem('wparty_watchTime') || '{}');
        }
    }

    function saveWatchTimeData(data) {
        try {
            GM_setValue('watchTime', data);
        } catch(e) {
            localStorage.setItem('wparty_watchTime', JSON.stringify(data));
        }
    }

    function addWatchTime(seconds) {
        if (!settings.trackWatchTime || seconds <= 0) return;

        const today = formatDate(new Date());
        const data = getWatchTimeData();

        if (!data[today]) {
            data[today] = { total: 0, shows: {} };
        }

        data[today].total = (data[today].total || 0) + seconds;

        if (currentShowId) {
            if (!data[today].shows[currentShowId]) {
                data[today].shows[currentShowId] = { time: 0, name: getShowName() };
            }
            data[today].shows[currentShowId].time += seconds;
        }

        const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
        Object.keys(data).forEach(date => {
            if (new Date(date).getTime() < cutoff) {
                delete data[date];
            }
        });

        saveWatchTimeData(data);
    }

    function getWatchTimeStats() {
        const data = getWatchTimeData();
        const today = formatDate(new Date());
        const yesterday = formatDate(new Date(Date.now() - 86400000));

        let weekTotal = 0;
        const weekData = [];

        for (let i = 6; i >= 0; i--) {
            const date = formatDate(new Date(Date.now() - i * 86400000));
            const dayData = data[date]?.total || 0;
            weekData.push({ date, time: dayData });
            weekTotal += dayData;
        }

        return {
            today: data[today]?.total || 0,
            yesterday: data[yesterday]?.total || 0,
            week: weekTotal,
            weekData: weekData,
            todayShows: data[today]?.shows || {}
        };
    }

    // ============ ИСТОРИЯ ПРОСМОТРА ============

    function getWatchHistory() {
        try {
            return GM_getValue('watchHistory', {});
        } catch(e) {
            return JSON.parse(localStorage.getItem('wparty_history') || '{}');
        }
    }

    function saveWatchHistory(season, episode) {
        try {
            const showId = currentShowId || generateShowId();
            const showName = getShowName();
            const history = GM_getValue('watchHistory', {});

            history[showId] = {
                name: showName,
                season,
                episode,
                timestamp: Date.now(),
                url: window.location.href
            };

            GM_setValue('watchHistory', history);
        } catch(e) {}
    }

    // ============ УВЕДОМЛЕНИЯ ============

    function showNotification(message, type = 'info', duration = 3000) {
        if (!settings.showNotifications) return;

        document.querySelectorAll('.wparty-notification').forEach(n => n.remove());

        const colors = {
            info: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            success: 'linear-gradient(135deg, #11998e 0%, #38ef7d 100%)',
            warning: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
            error: 'linear-gradient(135deg, #eb3349 0%, #f45c43 100%)'
        };

        const notification = document.createElement('div');
        notification.className = 'wparty-notification';
        notification.textContent = message;
        notification.style.cssText = `
            position: fixed; top: 20px; left: 50%; z-index: 2147483647;
            transform: translateX(-50%) translateY(-100px);
            background: ${colors[type]};
            color: white; padding: 14px 28px; border-radius: 30px;
            font-size: 15px; font-weight: 500;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            box-shadow: 0 8px 25px rgba(0,0,0,0.3);
            transition: transform 0.4s cubic-bezier(0.68, -0.55, 0.265, 1.55);
            pointer-events: none;
        `;

        document.body.appendChild(notification);

        if (settings.animations) {
            requestAnimationFrame(() => {
                notification.style.transform = 'translateX(-50%) translateY(0)';
            });
            setTimeout(() => {
                notification.style.transform = 'translateX(-50%) translateY(-100px)';
                setTimeout(() => notification.remove(), 400);
            }, duration);
        } else {
            notification.style.transform = 'translateX(-50%) translateY(0)';
            setTimeout(() => notification.remove(), duration);
        }
    }

    // ============ ПРОВЕРКА ОБНОВЛЕНИЙ ============

    function checkForUpdates() {
        try {
            const lastCheck = GM_getValue('lastUpdateCheck', 0);
            const now = Date.now();

            if (now - lastCheck < 86400000) return;

            GM_setValue('lastUpdateCheck', now);
            log('🔍 Проверяю обновления...');

            if (typeof GM_xmlhttpRequest !== 'undefined') {
                GM_xmlhttpRequest({
                    method: 'GET',
                    url: 'https://raw.githubusercontent.com/DdepRest/wparty-auto-/main/wparty-auto.user.js',
                    onload: function(response) {
                        if (response.status === 200) {
                            const match = response.responseText.match(/@version\s+([\d.]+)/);
                            if (match) {
                                const remoteVersion = match[1];
                                if (compareVersions(remoteVersion, VERSION_INFO.current) > 0) {
                                    showNotification(`🆕 Доступна версия ${remoteVersion}!`, 'info', 5000);
                                }
                            }
                        }
                    }
                });
            }
        } catch(e) {
            log('⚠️ Ошибка при проверке обновлений: ' + e.message);
        }
    }

    function compareVersions(v1, v2) {
        const parts1 = v1.split('.').map(Number);
        const parts2 = v2.split('.').map(Number);

        for (let i = 0; i < Math.max(parts1.length, parts2.length); i++) {
            const p1 = parts1[i] || 0;
            const p2 = parts2[i] || 0;
            if (p1 > p2) return 1;
            if (p1 < p2) return -1;
        }
        return 0;
    }

    // ============ ГРАФИКИ СТАТИСТИКИ ============

    function createChart(canvasId, data) {
        const canvas = document.getElementById(canvasId);
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        const width = canvas.width;
        const height = canvas.height;

        ctx.clearRect(0, 0, width, height);

        if (settings.chartType === 'line') {
            drawLineChart(ctx, width, height, data);
        } else if (settings.chartType === 'bar') {
            drawBarChart(ctx, width, height, data);
        }
    }

    function drawLineChart(ctx, width, height, data) {
        const padding = 40;
        const graphWidth = width - padding * 2;
        const graphHeight = height - padding * 2;

        const maxValue = Math.max(...data.map(d => d.time), 1);
        const stepX = graphWidth / (data.length - 1 || 1);

        const gradient = ctx.createLinearGradient(0, padding, 0, height - padding);
        gradient.addColorStop(0, 'rgba(102, 126, 234, 0.8)');
        gradient.addColorStop(1, 'rgba(118, 75, 162, 0.2)');

        ctx.beginPath();
        data.forEach((point, i) => {
            const x = padding + i * stepX;
            const y = height - padding - (point.time / maxValue) * graphHeight;
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        });

        ctx.strokeStyle = '#667eea';
        ctx.lineWidth = 3;
        ctx.stroke();

        ctx.lineTo(width - padding, height - padding);
        ctx.lineTo(padding, height - padding);
        ctx.closePath();
        ctx.fillStyle = gradient;
        ctx.fill();

        data.forEach((point, i) => {
            const x = padding + i * stepX;
            const y = height - padding - (point.time / maxValue) * graphHeight;
            ctx.beginPath();
            ctx.arc(x, y, 4, 0, Math.PI * 2);
            ctx.fillStyle = '#667eea';
            ctx.fill();
            ctx.strokeStyle = '#fff';
            ctx.lineWidth = 2;
            ctx.stroke();
        });

        ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(padding, padding);
        ctx.lineTo(padding, height - padding);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(padding, height - padding);
        ctx.lineTo(width - padding, height - padding);
        ctx.stroke();

        ctx.fillStyle = '#888';
        ctx.font = '10px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
        ctx.textAlign = 'center';
        data.forEach((point, i) => {
            const x = padding + i * stepX;
            const label = point.date.split('-')[2];
            ctx.fillText(label, x, height - padding + 20);
        });
    }

    function drawBarChart(ctx, width, height, data) {
        const padding = 40;
        const graphWidth = width - padding * 2;
        const graphHeight = height - padding * 2;

        const maxValue = Math.max(...data.map(d => d.time), 1);
        const barWidth = graphWidth / data.length - 10;

        data.forEach((point, i) => {
            const x = padding + i * (graphWidth / data.length) + 5;
            const barHeight = (point.time / maxValue) * graphHeight;
            const y = height - padding - barHeight;

            const gradient = ctx.createLinearGradient(0, y, 0, height - padding);
            gradient.addColorStop(0, '#667eea');
            gradient.addColorStop(1, '#764ba2');

            ctx.fillStyle = gradient;
            ctx.fillRect(x, y, barWidth, barHeight);

            ctx.fillStyle = '#888';
            ctx.font = '10px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
            ctx.textAlign = 'center';
            const label = point.date.split('-')[2];
            ctx.fillText(label, x + barWidth / 2, height - padding + 20);
        });

        ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(padding, padding);
        ctx.lineTo(padding, height - padding);
        ctx.lineTo(width - padding, height - padding);
        ctx.stroke();
    }

    // ============ СТИЛИ ============

    function injectStyles() {
        const animationSpeed = {
            slow: '0.6s',
            normal: '0.3s',
            fast: '0.15s'
        }[settings.transitionSpeed] || '0.3s';

        const style = document.createElement('style');
        style.textContent = `
            #wp-volume-osd {
                position: fixed; top: 50%; left: 50%; z-index: 2147483647;
                transform: translate(-50%, -50%) scale(0.8);
                background: rgba(0, 0, 0, 0.85);
                padding: 20px 30px; border-radius: 12px;
                display: flex; align-items: center; gap: 15px;
                opacity: 0; pointer-events: none;
                transition: opacity ${animationSpeed}, transform ${animationSpeed};
                backdrop-filter: blur(10px);
            }
            #wp-volume-osd.wp-vol-visible {
                opacity: 1;
                transform: translate(-50%, -50%) scale(1);
            }
            .wp-vol-icon { font-size: 36px; }
            .wp-vol-bar {
                width: 180px; height: 10px;
                background: rgba(255, 255, 255, 0.2);
                border-radius: 5px; overflow: hidden;
            }
            .wp-vol-fill {
                height: 100%;
                background: linear-gradient(90deg, #00d4ff, #00ff88);
                border-radius: 5px; transition: width 0.1s;
            }
            .wp-vol-text {
                color: white; font-size: 18px;
                font-weight: 600; min-width: 60px;
            }

            #wparty-settings-panel {
                position: fixed; bottom: 15px; right: 15px; z-index: 2147483645;
                background: linear-gradient(145deg, #1a1a2e 0%, #16213e 100%);
                color: #e4e4e4; border-radius: 16px;
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                font-size: 13px; box-shadow: 0 10px 40px rgba(0,0,0,0.4);
                min-width: 320px; max-height: 90vh; overflow: hidden;
                transition: all ${animationSpeed};
            }
            ${settings.animations ? `
            #wparty-settings-panel {
                animation: slideInUp ${animationSpeed} ease-out;
            }
            @keyframes slideInUp {
                from { transform: translateY(100px); opacity: 0; }
                to { transform: translateY(0); opacity: 1; }
            }` : ''}
            #wparty-settings-panel.collapsed .wp-content { display: none; }
            .wp-header {
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                padding: 12px 16px; display: flex;
                justify-content: space-between; align-items: center;
                cursor: pointer; user-select: none;
            }
            .wp-title {
                font-weight: 600; font-size: 14px;
                display: flex; align-items: center; gap: 8px;
            }
            .wp-header-btn {
                background: rgba(255,255,255,0.2); border: none;
                color: white; width: 28px; height: 28px;
                border-radius: 50%; cursor: pointer;
                display: flex; align-items: center; justify-content: center;
                transition: all 0.2s;
            }
            .wp-header-btn:hover {
                background: rgba(255,255,255,0.3);
                transform: scale(1.1);
            }
            .wp-content {
                padding: 16px; max-height: 70vh; overflow-y: auto;
            }
            .wp-content::-webkit-scrollbar { width: 6px; }
            .wp-content::-webkit-scrollbar-track {
                background: rgba(255,255,255,0.05); border-radius: 3px;
            }
            .wp-content::-webkit-scrollbar-thumb {
                background: rgba(102,126,234,0.5); border-radius: 3px;
            }
            .wp-content::-webkit-scrollbar-thumb:hover {
                background: rgba(102,126,234,0.7);
            }
            .wp-section {
                margin-bottom: 16px; padding-bottom: 16px;
                border-bottom: 1px solid rgba(255,255,255,0.05);
            }
            .wp-section:last-child { border-bottom: none; margin-bottom: 0; }
            .wp-section-title {
                font-size: 11px; text-transform: uppercase;
                color: #888; margin-bottom: 10px; letter-spacing: 0.5px;
            }
            .wp-option {
                display: flex; align-items: center;
                justify-content: space-between; margin-bottom: 10px;
                padding: 8px 12px; background: rgba(255,255,255,0.05);
                border-radius: 8px; transition: background 0.2s;
            }
            .wp-option:hover { background: rgba(255,255,255,0.1); }
            .wp-option label {
                display: flex; align-items: center;
                gap: 8px; cursor: pointer; flex: 1;
            }
            .wp-switch {
                position: relative; width: 44px; height: 24px;
            }
            .wp-switch input { opacity: 0; width: 0; height: 0; }
            .wp-slider {
                position: absolute; cursor: pointer;
                top: 0; left: 0; right: 0; bottom: 0;
                background-color: #444; transition: 0.3s;
                border-radius: 24px;
            }
            .wp-slider:before {
                position: absolute; content: "";
                height: 18px; width: 18px; left: 3px; bottom: 3px;
                background-color: white; transition: 0.3s; border-radius: 50%;
            }
            .wp-switch input:checked + .wp-slider {
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            }
            .wp-switch input:checked + .wp-slider:before {
                transform: translateX(20px);
            }
            .wp-input {
                width: 60px; padding: 6px 10px; border: none;
                border-radius: 6px; background: rgba(255,255,255,0.1);
                color: white; font-size: 13px; text-align: center;
            }
            .wp-select {
                padding: 6px 10px; border: none; border-radius: 6px;
                background: rgba(255,255,255,0.1); color: white;
                font-size: 13px; cursor: pointer;
            }
            .wp-select option { background: #1a1a2e; }
            .wp-radio-group {
                display: flex; gap: 8px; margin-top: 8px;
            }
            .wp-radio-btn {
                flex: 1; padding: 8px;
                background: rgba(255,255,255,0.05);
                border: 2px solid transparent; border-radius: 8px;
                color: #888; cursor: pointer; text-align: center;
                font-size: 12px; transition: all 0.2s;
            }
            .wp-radio-btn:hover { background: rgba(255,255,255,0.1); }
            .wp-radio-btn.active {
                background: rgba(102,126,234,0.2);
                border-color: #667eea; color: #e4e4e4;
            }
            .wp-chart-container {
                margin: 15px 0; padding: 15px;
                background: rgba(255,255,255,0.03); border-radius: 12px;
            }
            #wp-stats-chart {
                width: 100%; height: 150px; border-radius: 8px;
            }
            .wp-chart-controls {
                display: flex; gap: 8px; margin-top: 10px;
                justify-content: center;
            }
            .wp-chart-btn {
                padding: 6px 12px; background: rgba(255,255,255,0.05);
                border: none; border-radius: 6px; color: #888;
                cursor: pointer; font-size: 11px; transition: all 0.2s;
            }
            .wp-chart-btn:hover {
                background: rgba(255,255,255,0.1); color: #e4e4e4;
            }
            .wp-chart-btn.active {
                background: #667eea; color: white;
            }
            .wp-version {
                text-align: center; font-size: 10px; color: #555;
                margin-top: 15px; padding-top: 10px;
                border-top: 1px solid rgba(255,255,255,0.05);
            }
            #wparty-showlist-modal {
                position: fixed; top: 0; left: 0; right: 0; bottom: 0;
                background: rgba(0,0,0,0.8); z-index: 2147483647;
                display: flex; align-items: center; justify-content: center;
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                ${settings.animations ? `animation: fadeIn ${animationSpeed};` : ''}
            }
            ${settings.animations ? `
            @keyframes fadeIn {
                from { opacity: 0; }
                to { opacity: 1; }
            }` : ''}
            .wp-modal-content {
                background: linear-gradient(145deg, #1a1a2e 0%, #16213e 100%);
                border-radius: 20px; width: 90%; max-width: 600px;
                max-height: 80vh; overflow: hidden;
                box-shadow: 0 20px 60px rgba(0,0,0,0.5);
                ${settings.animations ? `animation: slideInUp ${animationSpeed};` : ''}
            }
            .wp-modal-header {
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                padding: 20px; display: flex;
                justify-content: space-between; align-items: center;
            }
            .wp-modal-title {
                color: white; font-size: 18px; font-weight: 600;
            }
            .wp-modal-close {
                background: rgba(255,255,255,0.2); border: none;
                color: white; width: 32px; height: 32px;
                border-radius: 50%; cursor: pointer; font-size: 18px;
                transition: all 0.2s;
            }
            .wp-modal-close:hover {
                background: rgba(255,255,255,0.3); transform: scale(1.1);
            }
            .wp-modal-body {
                padding: 20px; max-height: 60vh; overflow-y: auto;
            }
            .wp-show-item {
                background: rgba(255,255,255,0.05); border-radius: 12px;
                padding: 15px; display: flex; gap: 15px; margin-bottom: 10px;
                cursor: pointer; transition: all 0.2s;
            }
            .wp-show-item:hover {
                background: rgba(255,255,255,0.1); transform: translateX(5px);
            }
            .wp-show-name {
                color: #fff; font-weight: 500;
            }
            .wp-show-progress {
                color: #888; font-size: 12px;
            }
        `;
        document.head.appendChild(style);
    }

    // ============ UI ПАНЕЛЬ ============

    function updateWatchTimeDisplay() {
        if (!settings.trackWatchTime) return;

        const stats = getWatchTimeStats();
        const todayEl = document.getElementById('wp-time-today');
        const weekEl = document.getElementById('wp-time-week');

        if (todayEl) todayEl.textContent = formatTime(stats.today);
        if (weekEl) weekEl.textContent = formatTime(stats.week);

        if (settings.showCharts) {
            createChart('wp-stats-chart', stats.weekData);
        }
    }

    function createShowListModal() {
        document.getElementById('wparty-showlist-modal')?.remove();

        const history = getWatchHistory();
        const shows = Object.entries(history)
            .map(([id, data]) => ({ id, ...data }))
            .sort((a, b) => b.timestamp - a.timestamp);

        const modal = document.createElement('div');
        modal.id = 'wparty-showlist-modal';
        modal.innerHTML = `
            <div class="wp-modal-content">
                <div class="wp-modal-header">
                    <div class="wp-modal-title">📺 Мои сериалы</div>
                    <button class="wp-modal-close">✕</button>
                </div>
                <div class="wp-modal-body">
                    ${shows.length === 0 ? '<div style="text-align: center; color: #666; padding: 40px;">Список пуст</div>' :
                      shows.map(show => `
                        <div class="wp-show-item" data-url="${show.url}">
                            <div>
                                <div class="wp-show-name">${show.name || 'Неизвестный сериал'}</div>
                                <div class="wp-show-progress">Сезон ${show.season || 1}, Серия ${show.episode || 1}</div>
                            </div>
                        </div>
                      `).join('')
                    }
                </div>
            </div>
        `;

        document.body.appendChild(modal);
        showListOpen = true;

        modal.querySelector('.wp-modal-close').addEventListener('click', () => {
            modal.remove();
            showListOpen = false;
        });

        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.remove();
                showListOpen = false;
            }
        });

        modal.querySelectorAll('.wp-show-item').forEach(item => {
            item.addEventListener('click', () => {
                window.location.href = item.dataset.url;
            });
        });
    }

    function createSettingsPanel() {
        if (!settings.showPanel) return;
        if (document.getElementById('wparty-settings-panel')) return;

        const panel = document.createElement('div');
        panel.id = 'wparty-settings-panel';
        panel.innerHTML = `
            <div class="wp-header">
                <div class="wp-title">🎬 WPARTY Auto v${VERSION_INFO.current}</div>
                <div style="display: flex; gap: 8px;">
                    <button class="wp-header-btn" id="wp-showlist-btn" title="Мои сериалы">📺</button>
                    <button class="wp-header-btn" id="wp-toggle-btn" title="Свернуть">▼</button>
                </div>
            </div>
            <div class="wp-content">
                ${settings.trackWatchTime ? `
                <div class="wp-section">
                    <div class="wp-section-title">⏱️ Статистика</div>
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 10px;">
                        <div style="text-align: center;">
                            <div id="wp-time-today" style="font-size: 18px; font-weight: bold; color: #667eea;">0</div>
                            <div style="font-size: 10px; color: #888;">Сегодня</div>
                        </div>
                        <div style="text-align: center;">
                            <div id="wp-time-week" style="font-size: 18px; font-weight: bold; color: #667eea;">0</div>
                            <div style="font-size: 10px; color: #888;">За неделю</div>
                        </div>
                    </div>
                    ${settings.showCharts ? `
                    <div class="wp-chart-container">
                        <canvas id="wp-stats-chart"></canvas>
                        <div class="wp-chart-controls">
                            <button class="wp-chart-btn ${settings.chartType === 'line' ? 'active' : ''}" data-chart="line">Линия</button>
                            <button class="wp-chart-btn ${settings.chartType === 'bar' ? 'active' : ''}" data-chart="bar">Столбцы</button>
                        </div>
                    </div>
                    ` : ''}
                </div>
                ` : ''}

                <div class="wp-section">
                    <div class="wp-section-title">🎬 Автопереключение</div>
                    <div class="wp-option">
                        <label for="wp-auto-next">
                            <span>📺</span>
                            <span>Следующая серия</span>
                        </label>
                        <div class="wp-switch">
                            <input type="checkbox" id="wp-auto-next" ${settings.autoNext ? 'checked' : ''}>
                            <span class="wp-slider"></span>
                        </div>
                    </div>
                    <div class="wp-option">
                        <label for="wp-auto-season">
                            <span>📁</span>
                            <span>Следующий сезон</span>
                        </label>
                        <div class="wp-switch">
                            <input type="checkbox" id="wp-auto-season" ${settings.autoSeason ? 'checked' : ''}>
                            <span class="wp-slider"></span>
                        </div>
                    </div>
                </div>

                <div class="wp-section">
                    <div class="wp-section-title">⏭️ Пропуск титров</div>
                    <div class="wp-option">
                        <label for="wp-skip-credits">
                            <span>⏭️</span>
                            <span>Пропускать титры</span>
                        </label>
                        <div class="wp-switch">
                            <input type="checkbox" id="wp-skip-credits" ${settings.skipCredits ? 'checked' : ''}>
                            <span class="wp-slider"></span>
                        </div>
                    </div>
                    ${settings.skipCredits ? `
                    <div class="wp-option" style="flex-direction: column; align-items: flex-start;">
                        <label style="margin-bottom: 8px;"><span>🎯</span><span>Режим пропуска</span></label>
                        <div class="wp-radio-group" style="width: 100%;">
                            <div class="wp-radio-btn ${settings.skipMode === 'percent' ? 'active' : ''}" data-mode="percent">
                                По проценту
                            </div>
                            <div class="wp-radio-btn ${settings.skipMode === 'seconds' ? 'active' : ''}" data-mode="seconds">
                                По времени
                            </div>
                        </div>
                    </div>
                    ${settings.skipMode === 'percent' ? `
                    <div class="wp-option">
                        <label><span>📊</span><span>Процент видео</span></label>
                        <input type="number" class="wp-input" id="wp-skip-percent" value="${settings.skipPercent}" min="50" max="99" step="1">
                    </div>
                    ` : `
                    <div class="wp-option">
                        <label><span>⏱️</span><span>Секунд до конца</span></label>
                        <input type="number" class="wp-input" id="wp-skip-seconds" value="${settings.skipSeconds}" min="10" max="300" step="5">
                    </div>
                    `}
                    ` : ''}
                </div>

                <div class="wp-section">
                    <div class="wp-section-title">🔊 Громкость</div>
                    <div class="wp-option">
                        <label for="wp-volume-control">
                            <span>🔊</span>
                            <span>Управление громкостью</span>
                        </label>
                        <div class="wp-switch">
                            <input type="checkbox" id="wp-volume-control" ${settings.volumeControl ? 'checked' : ''}>
                            <span class="wp-slider"></span>
                        </div>
                    </div>
                    ${settings.volumeControl ? `
                    <div class="wp-option">
                        <label for="wp-volume-osd">
                            <span>📺</span>
                            <span>OSD индикатор</span>
                        </label>
                        <div class="wp-switch">
                            <input type="checkbox" id="wp-volume-osd" ${settings.volumeOSD ? 'checked' : ''}>
                            <span class="wp-slider"></span>
                        </div>
                    </div>
                    <div class="wp-option">
                        <label for="wp-volume-sync">
                            <span>🔗</span>
                            <span>Синхронизация вкладок</span>
                        </label>
                        <div class="wp-switch">
                            <input type="checkbox" id="wp-volume-sync" ${settings.volumeSync ? 'checked' : ''}>
                            <span class="wp-slider"></span>
                        </div>
                    </div>
                    ` : ''}
                </div>

                <div class="wp-section">
                    <div class="wp-section-title">⚙️ Интерфейс</div>
                    <div class="wp-option">
                        <label for="wp-animations">
                            <span>✨</span>
                            <span>Анимации</span>
                        </label>
                        <div class="wp-switch">
                            <input type="checkbox" id="wp-animations" ${settings.animations ? 'checked' : ''}>
                            <span class="wp-slider"></span>
                        </div>
                    </div>
                    ${settings.animations ? `
                    <div class="wp-option">
                        <label><span>⚡</span><span>Скорость анимаций</span></label>
                        <select class="wp-select" id="wp-transition-speed">
                            <option value="slow" ${settings.transitionSpeed === 'slow' ? 'selected' : ''}>Медленно</option>
                            <option value="normal" ${settings.transitionSpeed === 'normal' ? 'selected' : ''}>Обычно</option>
                            <option value="fast" ${settings.transitionSpeed === 'fast' ? 'selected' : ''}>Быстро</option>
                        </select>
                    </div>
                    ` : ''}
                    <div class="wp-option">
                        <label for="wp-notifications">
                            <span>🔔</span>
                            <span>Уведомления</span>
                        </label>
                        <div class="wp-switch">
                            <input type="checkbox" id="wp-notifications" ${settings.showNotifications ? 'checked' : ''}>
                            <span class="wp-slider"></span>
                        </div>
                    </div>
                    <div class="wp-option">
                        <label for="wp-track-time">
                            <span>⏱️</span>
                            <span>Считать время</span>
                        </label>
                        <div class="wp-switch">
                            <input type="checkbox" id="wp-track-time" ${settings.trackWatchTime ? 'checked' : ''}>
                            <span class="wp-slider"></span>
                        </div>
                    </div>
                </div>

                <div class="wp-version">
                    v${VERSION_INFO.current} • ${VERSION_INFO.releaseDate}
                    <br>
                    <a href="https://github.com/DdepRest/wparty-auto-" target="_blank" style="color: #667eea;">GitHub</a> •
                    <a href="https://github.com/DdepRest/wparty-auto-/issues" target="_blank" style="color: #667eea;">Поддержка</a>
                </div>
            </div>
        `;

        document.body.appendChild(panel);

        document.getElementById('wp-toggle-btn').addEventListener('click', () => {
            panel.classList.toggle('collapsed');
        });

        document.getElementById('wp-showlist-btn').addEventListener('click', () => {
            if (!showListOpen) createShowListModal();
        });

        document.querySelectorAll('.wp-radio-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const mode = btn.dataset.mode;
                saveSettings({ skipMode: mode });
                panel.remove();
                setTimeout(() => createSettingsPanel(), 100);
            });
        });

        document.querySelectorAll('.wp-chart-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const type = btn.dataset.chart;
                saveSettings({ chartType: type });
                updateWatchTimeDisplay();

                document.querySelectorAll('.wp-chart-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
            });
        });

        const bindSetting = (id, key, isNumber = false, isSelect = false) => {
            const element = document.getElementById(id);
            if (!element) return;

            const eventType = isSelect ? 'change' : (isNumber ? 'input' : 'change');

            element.addEventListener(eventType, () => {
                let value;
                if (isSelect) {
                    value = isNaN(parseFloat(element.value)) ? element.value : parseFloat(element.value);
                } else if (isNumber) {
                    value = parseInt(element.value) || DEFAULTS[key];
                } else {
                    value = element.checked;
                }

                saveSettings({ [key]: value });

                const keysToReload = ['skipCredits', 'volumeControl', 'trackWatchTime', 'animations'];
                if (keysToReload.includes(key)) {
                    panel.remove();
                    setTimeout(() => createSettingsPanel(), 100);
                }

                if (key === 'volumeControl' && value) {
                    hookVolumeControls();
                    applyVolume();
                }

                if (key === 'volumeSync') {
                    if (value) initVolumeSync();
                    else if (volumeState.volumeChannel) volumeState.volumeChannel.close();
                }

                if (key === 'chartType') {
                    updateWatchTimeDisplay();
                }
            });
        };

        bindSetting('wp-auto-next', 'autoNext');
        bindSetting('wp-auto-season', 'autoSeason');
        bindSetting('wp-skip-credits', 'skipCredits');
        bindSetting('wp-skip-percent', 'skipPercent', true);
        bindSetting('wp-skip-seconds', 'skipSeconds', true);
        bindSetting('wp-volume-control', 'volumeControl');
        bindSetting('wp-volume-osd', 'volumeOSD');
        bindSetting('wp-volume-sync', 'volumeSync');
        bindSetting('wp-animations', 'animations');
        bindSetting('wp-transition-speed', 'transitionSpeed', false, true);
        bindSetting('wp-notifications', 'showNotifications');
        bindSetting('wp-track-time', 'trackWatchTime');

        updateWatchTimeDisplay();
        checkForUpdates();
    }

    // ============ РЕЖИМ ПЛЕЕРА ============

    function runPlayerMode() {
        log('🎮 Режим ПЛЕЕРА (iframe)');

        let lastWatchTimeSave = Date.now();

        function getProgress() {
            const seek = document.querySelector('input[data-allplay="seek"]');
            if (!seek) return null;

            const current = parseFloat(seek.getAttribute('aria-valuenow')) || 0;
            const max = parseFloat(seek.getAttribute('aria-valuemax')) || 0;

            if (max <= 0) return null;
            return { current, max, remainingTime: max - current };
        }

        function notifyParent(remainingSeconds = null) {
            try {
                window.parent.postMessage({ type: 'WPARTY_NEXT_EPISODE', remainingSeconds }, '*');
            } catch(e) {}
        }

        function sendWatchTime() {
            const elapsed = (Date.now() - lastWatchTimeSave) / 1000;
            try {
                window.parent.postMessage({ type: 'WPARTY_WATCH_TIME', seconds: elapsed }, '*');
            } catch(e) {}
            lastWatchTimeSave = Date.now();
        }

        progressInterval = setInterval(() => {
            const progress = getProgress();
            if (!progress || hasTriggered) return;

            const video = findVideo();
            if (!video) return;

            if (shouldSkipCredits(video.currentTime, video.duration)) {
                hasTriggered = true;
                const info = getSkipInfo(video.currentTime, video.duration);
                log(`⏭️ Пропуск титров: ${info.info}`);
                notifyParent(video.duration - video.currentTime);
                setTimeout(() => { hasTriggered = false; }, 15000);
            }
        }, CHECK_INTERVAL);

        if (settings.trackWatchTime) {
            watchTimeInterval = setInterval(sendWatchTime, WATCH_TIME_INTERVAL);
        }

        if (settings.volumeControl) {
            // Первичное применение громкости с задержкой
            setTimeout(() => {
                hookVolumeControls();
                applyVolume(true);
            }, 1000);

            // Повторное применение через 2 секунды (на случай если плеер загружается медленно)
            setTimeout(() => {
                applyVolume(false);
            }, 2000);

            // Ещё раз через 4 секунды
            setTimeout(() => {
                applyVolume(false);
            }, 4000);

            // И финально через 6 секунд
            setTimeout(() => {
                applyVolume(false);
            }, 6000);
        }

        log('✅ Мониторинг запущен');
    }

    // ============ РЕЖИМ ОСНОВНОЙ СТРАНИЦЫ ============

    function runMainMode() {
        log('🌐 Режим ОСНОВНОЙ СТРАНИЦЫ');

        currentShowId = generateShowId();

        function getCurrentSeasonEpisode() {
            let season = 1;
            let episode = 1;

            const seasonDropdown = document.querySelector('div[name="season"]');
            if (seasonDropdown) {
                const seasonMenu = seasonDropdown.querySelector('.menu');
                if (seasonMenu) {
                    const allSeasons = Array.from(seasonMenu.querySelectorAll('.item'));
                    const currentSeason = seasonMenu.querySelector('.item.active.selected');
                    if (currentSeason) {
                        season = allSeasons.indexOf(currentSeason) + 1;
                    }
                }
            }

            const episodeDropdown = document.querySelector('div[name="episode"]');
            if (episodeDropdown) {
                const episodeMenu = episodeDropdown.querySelector('.menu');
                if (episodeMenu) {
                    const allEpisodes = Array.from(episodeMenu.querySelectorAll('.item'));
                    const currentEpisode = episodeMenu.querySelector('.item.active.selected');
                    if (currentEpisode) {
                        episode = allEpisodes.indexOf(currentEpisode) + 1;
                    }
                }
            }

            return { season, episode };
        }

        function getEpisodeInfo() {
            const episodeDropdown = document.querySelector('div[name="episode"]');
            if (!episodeDropdown) return null;

            const menu = episodeDropdown.querySelector('.menu');
            if (!menu) return null;

            const allEpisodes = Array.from(menu.querySelectorAll('.item'));
            const currentEpisode = menu.querySelector('.item.active.selected');

            if (!allEpisodes.length || !currentEpisode) return null;

            let currentIndex = allEpisodes.indexOf(currentEpisode);
            let nextEpisode = currentIndex < allEpisodes.length - 1 ? allEpisodes[currentIndex + 1] : null;

            return {
                total: allEpisodes.length,
                currentNumber: currentIndex + 1,
                isLastEpisode: currentIndex === allEpisodes.length - 1,
                nextElement: nextEpisode,
                dropdown: episodeDropdown
            };
        }

        async function switchToNextEpisode(remainingSeconds = null) {
            if (!settings.autoNext) return false;

            const info = getEpisodeInfo();
            if (!info) return false;

            if (info.isLastEpisode) {
                showNotification('🏁 Сезон завершён!', 'success', 5000);
                return false;
            }

            info.dropdown.click();

            return new Promise((resolve) => {
                setTimeout(() => {
                    if (info.nextElement) {
                        info.nextElement.click();

                        const { season, episode } = getCurrentSeasonEpisode();
                        saveWatchHistory(season, episode + 1);

                        showNotification('📺 Следующая серия', 'success');
                        resolve(true);
                    } else {
                        resolve(false);
                    }
                }, 500);
            });
        }

        window.addEventListener('message', (event) => {
            if (!isTrustedOrigin(event.origin)) return;

            if (event.data?.type === 'WPARTY_NEXT_EPISODE') {
                switchToNextEpisode(event.data.remainingSeconds);
            }

            if (event.data?.type === 'WPARTY_WATCH_TIME') {
                addWatchTime(event.data.seconds);
                updateWatchTimeDisplay();
            }
        });

        setTimeout(() => {
            createSettingsPanel();

            const { season, episode } = getCurrentSeasonEpisode();
            saveWatchHistory(season, episode);

            if (settings.volumeControl) {
                initVolumeSync();
            }
        }, 2000);
    }

    // ============ ИНИЦИАЛИЗАЦИЯ ============

    function init() {
        settings = loadSettings();

        log(`=== СТАРТ ===`);
        log(`⚙️ Авто: ${settings.autoNext}, Титры: ${settings.skipCredits}, Громкость: ${settings.volumeControl}`);

        injectStyles();
        window.addEventListener('beforeunload', cleanup);

        const isPlayer = window.location.hostname.includes('stloadi.live') ||
                        document.querySelector('input[data-allplay="seek"]');

        if (isPlayer) {
            runPlayerMode();
        } else {
            runMainMode();
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();
