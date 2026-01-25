// ==UserScript==
// @name         WPARTY - Автоматическое переключение серий
// @namespace    https://github.com/DdepRest/wparty-auto-
// @version      4.0.0
// @description  Автоматически переключает серии на WPARTY с умным пропуском титров, статистикой просмотра и списком сериалов
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
        skipCredits: true,
        skipSeconds: 30,
        autoNext: true,
        triggerPercent: 99,
        autoSeason: false,
        showNotifications: true,
        showPanel: true,
        autoPlay: false,
        autoPlayCount: 0,
        autoPlayDelay: 5,
        adaptiveSkip: true,
        trackWatchTime: true
    };

    const CHECK_INTERVAL = 1000;
    const WATCH_TIME_INTERVAL = 10000;
    const TRUSTED_ORIGINS = ['wparty.net', 'stloadi.live'];

    // ============ СОСТОЯНИЕ ============
    let hasTriggered = false;
    let progressInterval = null;
    let statusInterval = null;
    let watchTimeInterval = null;
    let settings = {};
    let autoPlayRemaining = 0;
    let currentShowId = null;
    let isPlaying = false;
    let showListOpen = false;

    // ============ УТИЛИТЫ ============
    function log(msg) {
        console.log(`🎬 WPARTY Auto: ${msg}`);
    }

    function generateShowId() {
        const path = window.location.pathname;
        const match = path.match(/\/(\d+)/);
        if (match) return match[1];
        return path.split('/').filter(Boolean)[0] || 'unknown';
    }

    function getShowName() {
        const selectors = [
            'h1.header',
            'h1',
            '.title',
            '[class*="title"]',
            '.movie-title',
            '.serial-title'
        ];
        
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
            const loaded = {
                skipCredits: GM_getValue('skipCredits', DEFAULTS.skipCredits),
                skipSeconds: GM_getValue('skipSeconds', DEFAULTS.skipSeconds),
                autoNext: GM_getValue('autoNext', DEFAULTS.autoNext),
                triggerPercent: GM_getValue('triggerPercent', DEFAULTS.triggerPercent),
                autoSeason: GM_getValue('autoSeason', DEFAULTS.autoSeason),
                showNotifications: GM_getValue('showNotifications', DEFAULTS.showNotifications),
                showPanel: GM_getValue('showPanel', DEFAULTS.showPanel),
                autoPlay: GM_getValue('autoPlay', DEFAULTS.autoPlay),
                autoPlayCount: GM_getValue('autoPlayCount', DEFAULTS.autoPlayCount),
                autoPlayDelay: GM_getValue('autoPlayDelay', DEFAULTS.autoPlayDelay),
                adaptiveSkip: GM_getValue('adaptiveSkip', DEFAULTS.adaptiveSkip),
                trackWatchTime: GM_getValue('trackWatchTime', DEFAULTS.trackWatchTime)
            };
            autoPlayRemaining = GM_getValue('autoPlayRemaining', 0);
            return loaded;
        } catch(e) {
            log('⚠️ GM_getValue недоступен, используем localStorage');
            const saved = localStorage.getItem('wparty_settings');
            autoPlayRemaining = parseInt(localStorage.getItem('wparty_autoPlayRemaining') || '0');
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

    function saveAutoPlayRemaining(count) {
        autoPlayRemaining = count;
        try {
            GM_setValue('autoPlayRemaining', count);
        } catch(e) {
            localStorage.setItem('wparty_autoPlayRemaining', count.toString());
        }
        updateAutoPlayStatus();
    }

    function cleanup() {
        if (progressInterval) clearInterval(progressInterval);
        if (statusInterval) clearInterval(statusInterval);
        if (watchTimeInterval) clearInterval(watchTimeInterval);
        progressInterval = null;
        statusInterval = null;
        watchTimeInterval = null;
        log('🧹 Интервалы очищены');
    }

    function parseTime(timeStr) {
        if (!timeStr || typeof timeStr !== 'string') return null;
        const cleaned = timeStr.replace(/[^\d:]/g, '');
        const parts = cleaned.split(':').map(Number).filter(n => !isNaN(n));
        if (parts.length === 0) return null;
        const reversed = parts.reverse();
        return (reversed[0] || 0) + (reversed[1] || 0) * 60 + (reversed[2] || 0) * 3600;
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

    // ============ АДАПТИВНЫЙ ПРОПУСК ТИТРОВ ============
    function getShowCreditsData() {
        try {
            const allCredits = GM_getValue('showCredits', {});
            return allCredits[currentShowId] || null;
        } catch(e) {
            const allCredits = JSON.parse(localStorage.getItem('wparty_credits') || '{}');
            return allCredits[currentShowId] || null;
        }
    }

    function saveShowCreditsData(seconds) {
        if (!currentShowId || seconds < 5 || seconds > 300) return;
        
        try {
            const allCredits = GM_getValue('showCredits', {});
            const existing = allCredits[currentShowId];
            
            if (existing) {
                const samples = existing.samples || 1;
                const avgSeconds = Math.round(
                    (existing.seconds * samples + seconds) / (samples + 1)
                );
                allCredits[currentShowId] = {
                    seconds: avgSeconds,
                    samples: Math.min(samples + 1, 10),
                    showName: getShowName(),
                    lastUpdated: Date.now()
                };
            } else {
                allCredits[currentShowId] = {
                    seconds: Math.round(seconds),
                    samples: 1,
                    showName: getShowName(),
                    lastUpdated: Date.now()
                };
            }
            
            GM_setValue('showCredits', allCredits);
            log(`📊 Сохранена длина титров: ${allCredits[currentShowId].seconds} сек (${allCredits[currentShowId].samples} образцов)`);
        } catch(e) {
            const allCredits = JSON.parse(localStorage.getItem('wparty_credits') || '{}');
            allCredits[currentShowId] = { seconds, showName: getShowName() };
            localStorage.setItem('wparty_credits', JSON.stringify(allCredits));
        }
    }

    function getAdaptiveSkipSeconds() {
        if (!settings.adaptiveSkip) return settings.skipSeconds;
        
        const creditsData = getShowCreditsData();
        if (creditsData && creditsData.seconds) {
            log(`🎯 Адаптивный пропуск: ${creditsData.seconds} сек (${creditsData.samples || 1} образцов)`);
            return creditsData.seconds;
        }
        return settings.skipSeconds;
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
        const weekStart = Date.now() - 7 * 24 * 60 * 60 * 1000;
        
        Object.entries(data).forEach(([date, dayData]) => {
            if (new Date(date).getTime() >= weekStart) {
                weekTotal += dayData.total || 0;
            }
        });
        
        return {
            today: data[today]?.total || 0,
            yesterday: data[yesterday]?.total || 0,
            week: weekTotal,
            todayShows: data[today]?.shows || {}
        };
    }

    // ============ СПИСОК СЕРИАЛОВ "СМОТРЮ" ============
    function getWatchHistory() {
        try {
            return GM_getValue('watchHistory', {});
        } catch(e) {
            return JSON.parse(localStorage.getItem('wparty_history') || '{}');
        }
    }

    function saveWatchHistory(season, episode, additionalData = {}) {
        try {
            const showId = currentShowId || generateShowId();
            const showName = getShowName();
            const history = GM_getValue('watchHistory', {});
            
            history[showId] = {
                name: showName,
                season,
                episode,
                timestamp: Date.now(),
                url: window.location.href,
                ...additionalData
            };
            
            GM_setValue('watchHistory', history);
            log(`📝 История сохранена: ${showName} S${season}E${episode}`);
        } catch(e) {
            const history = JSON.parse(localStorage.getItem('wparty_history') || '{}');
            history[currentShowId] = { 
                name: getShowName(),
                season, 
                episode, 
                timestamp: Date.now(),
                url: window.location.href
            };
            localStorage.setItem('wparty_history', JSON.stringify(history));
        }
    }

    function deleteFromHistory(showId) {
        try {
            const history = GM_getValue('watchHistory', {});
            delete history[showId];
            GM_setValue('watchHistory', history);
        } catch(e) {
            const history = JSON.parse(localStorage.getItem('wparty_history') || '{}');
            delete history[showId];
            localStorage.setItem('wparty_history', JSON.stringify(history));
        }
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
            position: fixed;
            top: 20px;
            left: 50%;
            transform: translateX(-50%) translateY(-100px);
            background: ${colors[type] || colors.info};
            color: white;
            padding: 14px 28px;
            border-radius: 30px;
            font-size: 15px;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            font-weight: 500;
            z-index: 2147483647;
            box-shadow: 0 8px 25px rgba(0,0,0,0.3);
            transition: transform 0.4s cubic-bezier(0.68, -0.55, 0.265, 1.55);
            pointer-events: none;
        `;

        document.body.appendChild(notification);

        requestAnimationFrame(() => {
            notification.style.transform = 'translateX(-50%) translateY(0)';
        });

        setTimeout(() => {
            notification.style.transform = 'translateX(-50%) translateY(-100px)';
            setTimeout(() => notification.remove(), 400);
        }, duration);
    }

    // ============ UI ПАНЕЛЬ НАСТРОЕК ============
    function updateAutoPlayStatus() {
        const remainingEl = document.getElementById('wp-autoplay-remaining');
        const statusEl = document.getElementById('wp-autoplay-status');
        const statusBox = document.getElementById('wp-autoplay-status-box');
        
        if (remainingEl) remainingEl.textContent = autoPlayRemaining;
        
        if (statusEl && statusBox) {
            if (settings.autoPlay && autoPlayRemaining > 0) {
                statusEl.textContent = `Осталось: ${autoPlayRemaining} серий`;
                statusEl.style.color = '#38ef7d';
                statusBox.classList.remove('inactive');
            } else if (settings.autoPlay && autoPlayRemaining === 0) {
                statusEl.textContent = 'Лимит исчерпан';
                statusEl.style.color = '#f5576c';
                statusBox.classList.add('inactive');
            } else {
                statusEl.textContent = 'Отключено';
                statusEl.style.color = '#888';
                statusBox.classList.add('inactive');
            }
        }
    }

    function updateWatchTimeDisplay() {
        const stats = getWatchTimeStats();
        
        const todayEl = document.getElementById('wp-time-today');
        const weekEl = document.getElementById('wp-time-week');
        
        if (todayEl) todayEl.textContent = formatTime(stats.today);
        if (weekEl) weekEl.textContent = formatTime(stats.week);
    }

    function updateAdaptiveSkipDisplay() {
        const el = document.getElementById('wp-adaptive-value');
        if (el) {
            const seconds = getAdaptiveSkipSeconds();
            const creditsData = getShowCreditsData();
            if (creditsData) {
                el.textContent = `${seconds} сек (авто)`;
                el.style.color = '#38ef7d';
            } else {
                el.textContent = `${seconds} сек (по умолч.)`;
                el.style.color = '#888';
            }
        }
    }

    function createShowListModal() {
        document.getElementById('wparty-showlist-modal')?.remove();
        
        const history = getWatchHistory();
        const shows = Object.entries(history)
            .map(([id, data]) => ({ id, ...data }))
            .sort((a, b) => b.timestamp - a.timestamp);
        
        const timeStats = getWatchTimeStats();
        
        const modal = document.createElement('div');
        modal.id = 'wparty-showlist-modal';
        modal.innerHTML = `
            <style>
                #wparty-showlist-modal {
                    position: fixed;
                    top: 0;
                    left: 0;
                    right: 0;
                    bottom: 0;
                    background: rgba(0,0,0,0.8);
                    z-index: 2147483647;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                    animation: wpFadeIn 0.3s ease;
                }
                @keyframes wpFadeIn {
                    from { opacity: 0; }
                    to { opacity: 1; }
                }
                .wp-modal-content {
                    background: linear-gradient(145deg, #1a1a2e 0%, #16213e 100%);
                    border-radius: 20px;
                    width: 90%;
                    max-width: 600px;
                    max-height: 80vh;
                    overflow: hidden;
                    box-shadow: 0 20px 60px rgba(0,0,0,0.5);
                    animation: wpSlideUp 0.3s ease;
                }
                @keyframes wpSlideUp {
                    from { transform: translateY(30px); opacity: 0; }
                    to { transform: translateY(0); opacity: 1; }
                }
                .wp-modal-header {
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                    padding: 20px;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                }
                .wp-modal-title {
                    color: white;
                    font-size: 18px;
                    font-weight: 600;
                }
                .wp-modal-close {
                    background: rgba(255,255,255,0.2);
                    border: none;
                    color: white;
                    width: 32px;
                    height: 32px;
                    border-radius: 50%;
                    cursor: pointer;
                    font-size: 18px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    transition: background 0.2s;
                }
                .wp-modal-close:hover {
                    background: rgba(255,255,255,0.3);
                }
                .wp-modal-body {
                    padding: 20px;
                    max-height: 60vh;
                    overflow-y: auto;
                }
                .wp-stats-grid {
                    display: grid;
                    grid-template-columns: repeat(3, 1fr);
                    gap: 15px;
                    margin-bottom: 20px;
                }
                .wp-stat-card {
                    background: rgba(255,255,255,0.05);
                    border-radius: 12px;
                    padding: 15px;
                    text-align: center;
                }
                .wp-stat-value {
                    font-size: 24px;
                    font-weight: bold;
                    color: #667eea;
                }
                .wp-stat-label {
                    font-size: 12px;
                    color: #888;
                    margin-top: 5px;
                }
                .wp-section-title {
                    color: #888;
                    font-size: 12px;
                    text-transform: uppercase;
                    letter-spacing: 1px;
                    margin-bottom: 15px;
                }
                .wp-show-list {
                    display: flex;
                    flex-direction: column;
                    gap: 10px;
                }
                .wp-show-item {
                    background: rgba(255,255,255,0.05);
                    border-radius: 12px;
                    padding: 15px;
                    display: flex;
                    align-items: center;
                    gap: 15px;
                    transition: all 0.2s;
                    cursor: pointer;
                }
                .wp-show-item:hover {
                    background: rgba(255,255,255,0.1);
                    transform: translateX(5px);
                }
                .wp-show-poster {
                    width: 50px;
                    height: 70px;
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                    border-radius: 8px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-size: 24px;
                    flex-shrink: 0;
                }
                .wp-show-info {
                    flex: 1;
                    min-width: 0;
                }
                .wp-show-name {
                    color: #fff;
                    font-weight: 500;
                    font-size: 14px;
                    white-space: nowrap;
                    overflow: hidden;
                    text-overflow: ellipsis;
                }
                .wp-show-progress {
                    color: #888;
                    font-size: 12px;
                    margin-top: 4px;
                }
                .wp-show-date {
                    color: #555;
                    font-size: 11px;
                    margin-top: 4px;
                }
                .wp-show-actions {
                    display: flex;
                    gap: 8px;
                }
                .wp-show-btn {
                    background: rgba(255,255,255,0.1);
                    border: none;
                    color: #fff;
                    padding: 8px 12px;
                    border-radius: 6px;
                    cursor: pointer;
                    font-size: 12px;
                    transition: all 0.2s;
                }
                .wp-show-btn:hover {
                    background: rgba(255,255,255,0.2);
                }
                .wp-show-btn.delete {
                    color: #f5576c;
                }
                .wp-show-btn.delete:hover {
                    background: rgba(245, 87, 108, 0.2);
                }
                .wp-empty {
                    text-align: center;
                    padding: 40px;
                    color: #666;
                }
                .wp-empty-icon {
                    font-size: 48px;
                    margin-bottom: 15px;
                }
            </style>
            <div class="wp-modal-content">
                <div class="wp-modal-header">
                    <div class="wp-modal-title">📺 Мои сериалы</div>
                    <button class="wp-modal-close">✕</button>
                </div>
                <div class="wp-modal-body">
                    <div class="wp-stats-grid">
                        <div class="wp-stat-card">
                            <div class="wp-stat-value">${formatTime(timeStats.today)}</div>
                            <div class="wp-stat-label">Сегодня</div>
                        </div>
                        <div class="wp-stat-card">
                            <div class="wp-stat-value">${formatTime(timeStats.yesterday)}</div>
                            <div class="wp-stat-label">Вчера</div>
                        </div>
                        <div class="wp-stat-card">
                            <div class="wp-stat-value">${formatTime(timeStats.week)}</div>
                            <div class="wp-stat-label">За неделю</div>
                        </div>
                    </div>
                    
                    <div class="wp-section-title">История просмотра (${shows.length})</div>
                    
                    <div class="wp-show-list">
                        ${shows.length === 0 ? `
                            <div class="wp-empty">
                                <div class="wp-empty-icon">🎬</div>
                                <div>Список пуст</div>
                                <div style="font-size: 12px; margin-top: 8px;">Начните смотреть сериалы!</div>
                            </div>
                        ` : shows.map(show => {
                            const daysAgo = Math.floor((Date.now() - show.timestamp) / 86400000);
                            const dateStr = daysAgo === 0 ? 'Сегодня' : 
                                           daysAgo === 1 ? 'Вчера' : 
                                           `${daysAgo} дн. назад`;
                            return `
                                <div class="wp-show-item" data-url="${show.url}">
                                    <div class="wp-show-poster">🎬</div>
                                    <div class="wp-show-info">
                                        <div class="wp-show-name">${show.name || 'Неизвестный сериал'}</div>
                                        <div class="wp-show-progress">
                                            Сезон ${show.season || 1}, Серия ${show.episode || 1}
                                        </div>
                                        <div class="wp-show-date">${dateStr}</div>
                                    </div>
                                    <div class="wp-show-actions">
                                        <button class="wp-show-btn" data-action="open" data-url="${show.url}">▶️</button>
                                        <button class="wp-show-btn delete" data-action="delete" data-id="${show.id}">🗑️</button>
                                    </div>
                                </div>
                            `;
                        }).join('')}
                    </div>
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
        
        modal.querySelectorAll('.wp-show-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const action = btn.dataset.action;
                
                if (action === 'open') {
                    window.location.href = btn.dataset.url;
                } else if (action === 'delete') {
                    deleteFromHistory(btn.dataset.id);
                    btn.closest('.wp-show-item').remove();
                    showNotification('🗑️ Удалено из истории', 'info');
                }
            });
        });
        
        modal.querySelectorAll('.wp-show-item').forEach(item => {
            item.addEventListener('click', (e) => {
                if (!e.target.closest('.wp-show-btn')) {
                    window.location.href = item.dataset.url;
                }
            });
        });
    }

    function createSettingsPanel() {
        if (!settings.showPanel) return;
        if (document.getElementById('wparty-settings-panel')) return;

        const panel = document.createElement('div');
        panel.id = 'wparty-settings-panel';
        panel.innerHTML = `
            <style>
                #wparty-settings-panel {
                    position: fixed;
                    bottom: 15px;
                    right: 15px;
                    background: linear-gradient(145deg, #1a1a2e 0%, #16213e 100%);
                    color: #e4e4e4;
                    padding: 0;
                    border-radius: 16px;
                    z-index: 2147483646;
                    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                    font-size: 13px;
                    box-shadow: 0 10px 40px rgba(0,0,0,0.4);
                    min-width: 300px;
                    max-height: 90vh;
                    overflow: hidden;
                    transition: all 0.3s ease;
                }
                #wparty-settings-panel.collapsed {
                    min-width: auto;
                }
                #wparty-settings-panel.collapsed .wp-content {
                    display: none;
                }
                .wp-header {
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                    padding: 12px 16px;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    cursor: pointer;
                    user-select: none;
                }
                .wp-header:hover {
                    filter: brightness(1.1);
                }
                .wp-title {
                    font-weight: 600;
                    font-size: 14px;
                    display: flex;
                    align-items: center;
                    gap: 8px;
                }
                .wp-header-actions {
                    display: flex;
                    gap: 8px;
                    align-items: center;
                }
                .wp-header-btn {
                    background: rgba(255,255,255,0.2);
                    border: none;
                    color: white;
                    width: 28px;
                    height: 28px;
                    border-radius: 50%;
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    transition: all 0.2s;
                    font-size: 14px;
                }
                .wp-header-btn:hover {
                    background: rgba(255,255,255,0.3);
                    transform: scale(1.1);
                }
                #wparty-settings-panel.collapsed .wp-toggle-btn {
                    transform: rotate(180deg);
                }
                .wp-content {
                    padding: 16px;
                    max-height: 70vh;
                    overflow-y: auto;
                }
                .wp-section {
                    margin-bottom: 16px;
                }
                .wp-section:last-child {
                    margin-bottom: 0;
                }
                .wp-section-title {
                    font-size: 11px;
                    text-transform: uppercase;
                    color: #888;
                    margin-bottom: 10px;
                    letter-spacing: 0.5px;
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                }
                .wp-option {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    margin-bottom: 10px;
                    padding: 8px 12px;
                    background: rgba(255,255,255,0.05);
                    border-radius: 8px;
                    transition: background 0.2s;
                }
                .wp-option:hover {
                    background: rgba(255,255,255,0.1);
                }
                .wp-option:last-child {
                    margin-bottom: 0;
                }
                .wp-option label {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    cursor: pointer;
                    flex: 1;
                }
                .wp-switch {
                    position: relative;
                    width: 44px;
                    height: 24px;
                    flex-shrink: 0;
                }
                .wp-switch input {
                    opacity: 0;
                    width: 0;
                    height: 0;
                }
                .wp-slider {
                    position: absolute;
                    cursor: pointer;
                    top: 0;
                    left: 0;
                    right: 0;
                    bottom: 0;
                    background-color: #444;
                    transition: 0.3s;
                    border-radius: 24px;
                }
                .wp-slider:before {
                    position: absolute;
                    content: "";
                    height: 18px;
                    width: 18px;
                    left: 3px;
                    bottom: 3px;
                    background-color: white;
                    transition: 0.3s;
                    border-radius: 50%;
                }
                .wp-switch input:checked + .wp-slider {
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                }
                .wp-switch input:checked + .wp-slider:before {
                    transform: translateX(20px);
                }
                .wp-input {
                    width: 60px;
                    padding: 6px 10px;
                    border: none;
                    border-radius: 6px;
                    background: rgba(255,255,255,0.1);
                    color: white;
                    font-size: 13px;
                    text-align: center;
                }
                .wp-input:focus {
                    outline: 2px solid #667eea;
                    background: rgba(255,255,255,0.15);
                }
                .wp-status {
                    margin-top: 12px;
                    padding: 10px 12px;
                    background: rgba(102, 126, 234, 0.15);
                    border-radius: 8px;
                    font-size: 12px;
                    border-left: 3px solid #667eea;
                }
                .wp-status-row {
                    display: flex;
                    justify-content: space-between;
                    margin-bottom: 4px;
                }
                .wp-status-row:last-child {
                    margin-bottom: 0;
                }
                .wp-status-label {
                    color: #888;
                }
                .wp-status-value {
                    color: #fff;
                    font-weight: 500;
                }
                .wp-btn {
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                    border: none;
                    color: white;
                    padding: 8px 16px;
                    border-radius: 6px;
                    cursor: pointer;
                    font-size: 12px;
                    font-weight: 500;
                    transition: all 0.2s;
                }
                .wp-btn:hover {
                    filter: brightness(1.1);
                    transform: scale(1.02);
                }
                .wp-btn-small {
                    padding: 4px 10px;
                    font-size: 11px;
                }
                .wp-autoplay-info {
                    background: rgba(56, 239, 125, 0.15);
                    border-left: 3px solid #38ef7d;
                    padding: 8px 12px;
                    border-radius: 8px;
                    margin-top: 8px;
                    font-size: 12px;
                }
                .wp-autoplay-info.inactive {
                    background: rgba(245, 87, 108, 0.15);
                    border-left-color: #f5576c;
                }
                .wp-time-stats {
                    display: grid;
                    grid-template-columns: 1fr 1fr;
                    gap: 10px;
                    margin-top: 10px;
                }
                .wp-time-card {
                    background: rgba(255,255,255,0.05);
                    border-radius: 8px;
                    padding: 10px;
                    text-align: center;
                }
                .wp-time-value {
                    font-size: 18px;
                    font-weight: bold;
                    color: #667eea;
                }
                .wp-time-label {
                    font-size: 10px;
                    color: #888;
                    margin-top: 4px;
                }
                .wp-version {
                    text-align: center;
                    font-size: 10px;
                    color: #555;
                    margin-top: 15px;
                    padding-top: 10px;
                    border-top: 1px solid rgba(255,255,255,0.05);
                }
                .wp-version a {
                    color: #667eea;
                    text-decoration: none;
                }
            </style>
            <div class="wp-header">
                <div class="wp-title">🎬 WPARTY Auto</div>
                <div class="wp-header-actions">
                    <button class="wp-header-btn" id="wp-showlist-btn" title="Мои сериалы">📺</button>
                    <button class="wp-header-btn wp-toggle-btn" title="Свернуть">▼</button>
                </div>
            </div>
            <div class="wp-content">
                <div class="wp-section">
                    <div class="wp-section-title">⏱️ Время просмотра</div>
                    <div class="wp-time-stats">
                        <div class="wp-time-card">
                            <div class="wp-time-value" id="wp-time-today">0</div>
                            <div class="wp-time-label">Сегодня</div>
                        </div>
                        <div class="wp-time-card">
                            <div class="wp-time-value" id="wp-time-week">0</div>
                            <div class="wp-time-label">За неделю</div>
                        </div>
                    </div>
                </div>

                <div class="wp-section">
                    <div class="wp-section-title">Автопереключение</div>
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
                    <div class="wp-section-title">🎯 Автовключение серий</div>
                    <div class="wp-option">
                        <label for="wp-auto-play">
                            <span>▶️</span>
                            <span>Автостарт</span>
                        </label>
                        <div class="wp-switch">
                            <input type="checkbox" id="wp-auto-play" ${settings.autoPlay ? 'checked' : ''}>
                            <span class="wp-slider"></span>
                        </div>
                    </div>
                    <div class="wp-option">
                        <label>
                            <span>🔢</span>
                            <span>Серий</span>
                        </label>
                        <input type="number" class="wp-input" id="wp-autoplay-count" value="${settings.autoPlayCount}" min="0" max="100">
                    </div>
                    <div class="wp-option">
                        <label>
                            <span>⏱️</span>
                            <span>Задержка</span>
                        </label>
                        <input type="number" class="wp-input" id="wp-autoplay-delay" value="${settings.autoPlayDelay}" min="1" max="30">
                    </div>
                    <div class="wp-option">
                        <label>
                            <span>📊</span>
                            <span>Осталось</span>
                        </label>
                        <span id="wp-autoplay-remaining" style="color: #38ef7d; font-weight: bold;">${autoPlayRemaining}</span>
                    </div>
                    <div class="wp-option" style="justify-content: center; gap: 10px;">
                        <button class="wp-btn wp-btn-small" id="wp-autoplay-set">✅ Применить</button>
                        <button class="wp-btn wp-btn-small" id="wp-autoplay-reset" style="background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);">🔄 Сброс</button>
                    </div>
                    <div class="wp-autoplay-info ${settings.autoPlay && autoPlayRemaining > 0 ? '' : 'inactive'}" id="wp-autoplay-status-box">
                        <span id="wp-autoplay-status">${settings.autoPlay && autoPlayRemaining > 0 ? `Осталось: ${autoPlayRemaining} серий` : (settings.autoPlay ? 'Лимит исчерпан' : 'Отключено')}</span>
                    </div>
                </div>

                <div class="wp-section">
                    <div class="wp-section-title">Пропуск титров</div>
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
                    <div class="wp-option">
                        <label for="wp-adaptive-skip">
                            <span>🎯</span>
                            <span>Адаптивный пропуск</span>
                        </label>
                        <div class="wp-switch">
                            <input type="checkbox" id="wp-adaptive-skip" ${settings.adaptiveSkip ? 'checked' : ''}>
                            <span class="wp-slider"></span>
                        </div>
                    </div>
                    <div class="wp-option">
                        <label>
                            <span>📊</span>
                            <span>Текущий</span>
                        </label>
                        <span id="wp-adaptive-value" style="font-size: 12px; color: #888;">${settings.skipSeconds} сек</span>
                    </div>
                    <div class="wp-option">
                        <label>
                            <span>⏱️</span>
                            <span>По умолчанию</span>
                        </label>
                        <input type="number" class="wp-input" id="wp-skip-seconds" value="${settings.skipSeconds}" min="5" max="300">
                    </div>
                    <div class="wp-option">
                        <label>
                            <span>📊</span>
                            <span>Триггер (%)</span>
                        </label>
                        <input type="number" class="wp-input" id="wp-trigger-percent" value="${settings.triggerPercent}" min="50" max="100">
                    </div>
                </div>

                <div class="wp-section">
                    <div class="wp-section-title">Интерфейс</div>
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

                <div class="wp-status" id="wp-status">
                    <div class="wp-status-row">
                        <span class="wp-status-label">Статус:</span>
                        <span class="wp-status-value" id="wp-status-text">Ожидание...</span>
                    </div>
                    <div class="wp-status-row">
                        <span class="wp-status-label">Прогресс:</span>
                        <span class="wp-status-value" id="wp-progress-text">—</span>
                    </div>
                </div>

                <div class="wp-version">
                    WPARTY Auto v4.0.0 • 
                    <a href="https://github.com/DdepRest/wparty-auto-" target="_blank">GitHub</a>
                </div>
            </div>
        `;

        document.body.appendChild(panel);

        const toggleBtn = panel.querySelector('.wp-toggle-btn');
        
        toggleBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            panel.classList.toggle('collapsed');
        });

        document.getElementById('wp-showlist-btn').addEventListener('click', (e) => {
            e.stopPropagation();
            if (!showListOpen) {
                createShowListModal();
            }
        });

        const bindSetting = (id, key, isNumber = false) => {
            const element = document.getElementById(id);
            if (!element) return;

            element.addEventListener('change', () => {
                const value = isNumber ? parseInt(element.value) : element.checked;
                saveSettings({ [key]: value });
                log(`⚙️ ${key} = ${value}`);
                updateAutoPlayStatus();
                updateAdaptiveSkipDisplay();
            });
        };

        bindSetting('wp-auto-next', 'autoNext');
        bindSetting('wp-auto-season', 'autoSeason');
        bindSetting('wp-skip-credits', 'skipCredits');
        bindSetting('wp-skip-seconds', 'skipSeconds', true);
        bindSetting('wp-trigger-percent', 'triggerPercent', true);
        bindSetting('wp-notifications', 'showNotifications');
        bindSetting('wp-auto-play', 'autoPlay');
        bindSetting('wp-autoplay-delay', 'autoPlayDelay', true);
        bindSetting('wp-adaptive-skip', 'adaptiveSkip');
        bindSetting('wp-track-time', 'trackWatchTime');

        document.getElementById('wp-autoplay-set').addEventListener('click', () => {
            const count = parseInt(document.getElementById('wp-autoplay-count').value) || 0;
            saveSettings({ autoPlayCount: count });
            saveAutoPlayRemaining(count);
            showNotification(`▶️ Автовключение: ${count} серий`, 'success');
            log(`🎯 Автовключение установлено: ${count} серий`);
        });

        document.getElementById('wp-autoplay-reset').addEventListener('click', () => {
            saveAutoPlayRemaining(0);
            showNotification('🔄 Счётчик сброшен', 'info');
            log('🔄 Счётчик автовключения сброшен');
        });

        updateWatchTimeDisplay();
        updateAdaptiveSkipDisplay();
    }

    function updateStatusPanel(status, progress = null) {
        const statusText = document.getElementById('wp-status-text');
        const progressText = document.getElementById('wp-progress-text');

        if (statusText) statusText.textContent = status;
        if (progressText && progress !== null) {
            progressText.textContent = progress;
        }
    }

    // ============ РЕЖИМ IFRAME (ПЛЕЕР) ============
    function runPlayerMode() {
        log('Режим ПЛЕЕРА (внутри iframe)');
        
        let lastWatchTimeSave = Date.now();

        function unpauseVideo() {
            const playButtons = document.querySelectorAll('button[data-allplay="play"]');
            
            for (const btn of playButtons) {
                if (btn.getAttribute('aria-pressed') === 'false') {
                    log('▶️ Снимаю с паузы...');
                    btn.click();
                    return true;
                }
            }
            
            log('ℹ️ Видео уже воспроизводится или кнопка не найдена');
            return false;
        }

        function isVideoPlaying() {
            const playButtons = document.querySelectorAll('button[data-allplay="play"]');
            for (const btn of playButtons) {
                if (btn.getAttribute('aria-pressed') === 'true') {
                    return true;
                }
            }
            return false;
        }

        window.addEventListener('message', (event) => {
            if (!isTrustedOrigin(event.origin) && event.origin !== window.location.origin) {
                return;
            }

            if (event.data?.type === 'WPARTY_AUTO_PLAY') {
                const delay = event.data.delay || 5;
                log(`📥 Получена команда автовключения, задержка: ${delay} сек`);
                
                let countdown = delay;
                const countdownInterval = setInterval(() => {
                    if (countdown > 0) {
                        log(`⏳ Автовключение через ${countdown} сек...`);
                        countdown--;
                    } else {
                        clearInterval(countdownInterval);
                        unpauseVideo();
                        try {
                            window.parent.postMessage({ type: 'WPARTY_AUTO_PLAY_DONE' }, '*');
                        } catch(e) {}
                    }
                }, 1000);
            }

            if (event.data?.type === 'WPARTY_GET_PLAY_STATE') {
                try {
                    window.parent.postMessage({ 
                        type: 'WPARTY_PLAY_STATE',
                        isPlaying: isVideoPlaying()
                    }, '*');
                } catch(e) {}
            }
        });

        function getProgress() {
            const seek = document.querySelector('input[data-allplay="seek"]');
            if (!seek) return null;

            const current = parseFloat(seek.getAttribute('aria-valuenow')) || 0;
            const max = parseFloat(seek.getAttribute('aria-valuemax')) || 0;

            if (max <= 0) return null;

            let currentTimeSec = current;
            let totalTimeSec = max;

            const timeElements = document.querySelectorAll('[class*="time"], [class*="duration"]');
            timeElements.forEach(el => {
                const parsed = parseTime(el.textContent);
                if (parsed !== null) {
                    if (el.className.includes('current') || el.className.includes('played')) {
                        currentTimeSec = parsed;
                    } else if (el.className.includes('total') || el.className.includes('duration')) {
                        totalTimeSec = parsed;
                    }
                }
            });

            return {
                percent: (current / max) * 100,
                current,
                max,
                currentTimeSec,
                totalTimeSec,
                remainingTime: totalTimeSec - currentTimeSec
            };
        }

        function notifyParent(remainingSeconds = null) {
            try {
                window.parent.postMessage({ 
                    type: 'WPARTY_NEXT_EPISODE',
                    remainingSeconds: remainingSeconds
                }, '*');
                log('📤 Отправлен сигнал на переключение серии');
            } catch(e) {
                log('❌ Ошибка отправки сообщения: ' + e.message);
            }
        }

        function sendWatchTime() {
            if (isVideoPlaying()) {
                const elapsed = (Date.now() - lastWatchTimeSave) / 1000;
                try {
                    window.parent.postMessage({ 
                        type: 'WPARTY_WATCH_TIME',
                        seconds: elapsed
                    }, '*');
                } catch(e) {}
            }
            lastWatchTimeSave = Date.now();
        }

        function triggerNext(reason, remainingSeconds = null) {
            if (hasTriggered || !settings.autoNext) return;

            hasTriggered = true;
            log(`🎬 ${reason}`);
            notifyParent(remainingSeconds);

            setTimeout(() => {
                hasTriggered = false;
            }, 15000);
        }

        progressInterval = setInterval(() => {
            const progress = getProgress();
            if (!progress || hasTriggered) return;

            const skipSeconds = settings.skipSeconds;

            if (settings.skipCredits && progress.remainingTime <= skipSeconds) {
                triggerNext(`Осталось ${Math.round(progress.remainingTime)} сек - пропускаю титры!`, progress.remainingTime);
            } else if (progress.percent >= settings.triggerPercent) {
                triggerNext(`Достигнуто ${progress.percent.toFixed(1)}% - переключаю!`, progress.remainingTime);
            }
        }, CHECK_INTERVAL);

        watchTimeInterval = setInterval(sendWatchTime, WATCH_TIME_INTERVAL);

        statusInterval = setInterval(() => {
            const progress = getProgress();
            if (progress && progress.percent < settings.triggerPercent) {
                log(`📊 Прогресс: ${progress.percent.toFixed(1)}% | Осталось ~${Math.round(progress.remainingTime)} сек`);
            }
        }, 30000);

        log('✅ Мониторинг плеера запущен');
    }

    // ============ РЕЖИМ ОСНОВНОЙ СТРАНИЦЫ ============
    function runMainMode() {
        log('Режим ОСНОВНОЙ СТРАНИЦЫ');
        
        currentShowId = generateShowId();
        log(`📺 ID сериала: ${currentShowId}`);

        function getCurrentSeasonEpisode() {
            let season = 1;
            let episode = 1;

            const seasonDropdown = document.querySelector('div[name="season"]');
            if (seasonDropdown) {
                const seasonMenu = seasonDropdown.querySelector('.menu');
                if (seasonMenu) {
                    const allSeasons = Array.from(seasonMenu.querySelectorAll('.item'));
                    const currentSeason = seasonMenu.querySelector('.item.active.selected, .item[aria-checked="true"]');
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
                    const currentEpisode = episodeMenu.querySelector('.item.active.selected, .item[aria-checked="true"]');
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

            const menu = episodeDropdown.querySelector('.menu, .menu.transition');
            if (!menu) return null;

            const allEpisodes = Array.from(menu.querySelectorAll('.item'));
            const currentEpisode = menu.querySelector('.item.active.selected, .item[aria-checked="true"]');

            if (!allEpisodes.length || !currentEpisode) return null;

            let currentIndex = allEpisodes.indexOf(currentEpisode);
            let nextEpisode = currentIndex < allEpisodes.length - 1 ? allEpisodes[currentIndex + 1] : null;

            return {
                total: allEpisodes.length,
                currentNumber: currentIndex + 1,
                isLastEpisode: currentIndex === allEpisodes.length - 1,
                currentName: currentEpisode.textContent.trim(),
                nextElement: nextEpisode,
                nextName: nextEpisode?.textContent.trim(),
                dropdown: episodeDropdown
            };
        }

        function getSeasonInfo() {
            const seasonDropdown = document.querySelector('div[name="season"]');
            if (!seasonDropdown) return null;

            const menu = seasonDropdown.querySelector('.menu, .menu.transition');
            if (!menu) return null;

            const allSeasons = Array.from(menu.querySelectorAll('.item'));
            const currentSeason = menu.querySelector('.item.active.selected, .item[aria-checked="true"]');

            if (!allSeasons.length || !currentSeason) return null;

            let currentIndex = allSeasons.indexOf(currentSeason);
            let nextSeason = currentIndex < allSeasons.length - 1 ? allSeasons[currentIndex + 1] : null;

            return {
                total: allSeasons.length,
                currentNumber: currentIndex + 1,
                isLastSeason: currentIndex === allSeasons.length - 1,
                currentName: currentSeason.textContent.trim(),
                nextElement: nextSeason,
                nextName: nextSeason?.textContent.trim(),
                dropdown: seasonDropdown
            };
        }

        function selectFirstEpisode() {
            return new Promise((resolve) => {
                setTimeout(() => {
                    const episodeDropdown = document.querySelector('div[name="episode"]');
                    if (!episodeDropdown) {
                        resolve(false);
                        return;
                    }

                    episodeDropdown.click();

                    setTimeout(() => {
                        const menu = episodeDropdown.querySelector('.menu');
                        if (menu) {
                            const firstEpisode = menu.querySelector('.item');
                            if (firstEpisode) {
                                firstEpisode.click();
                                log('✅ Выбрана первая серия нового сезона');
                                resolve(true);
                                return;
                            }
                        }
                        resolve(false);
                    }, 500);
                }, 1000);
            });
        }

        function sendAutoPlayCommand() {
            if (!settings.autoPlay || autoPlayRemaining <= 0) {
                log('ℹ️ Автовключение отключено или лимит исчерпан');
                return;
            }

            const iframe = document.querySelector('iframe');
            if (!iframe) {
                log('⚠️ iframe плеера не найден');
                return;
            }

            saveAutoPlayRemaining(autoPlayRemaining - 1);

            log(`▶️ Отправляю команду автовключения (осталось: ${autoPlayRemaining})`);
            showNotification(`▶️ Автостарт через ${settings.autoPlayDelay} сек... (осталось: ${autoPlayRemaining})`, 'info', settings.autoPlayDelay * 1000);

            try {
                iframe.contentWindow.postMessage({
                    type: 'WPARTY_AUTO_PLAY',
                    delay: settings.autoPlayDelay
                }, '*');
            } catch(e) {
                log('❌ Ошибка отправки команды: ' + e.message);
            }
        }

        async function switchToNextSeason() {
            const seasonInfo = getSeasonInfo();

            if (!seasonInfo || seasonInfo.isLastSeason) {
                log('🏁 Это последний сезон');
                showNotification('🏁 Сериал завершён!', 'success', 5000);
                return false;
            }

            log(`🔄 Переключение сезона: ${seasonInfo.currentName} → ${seasonInfo.nextName}`);
            showNotification(`📁 Переход к сезону: ${seasonInfo.nextName}`, 'info');

            seasonInfo.dropdown.click();

            return new Promise((resolve) => {
                setTimeout(async () => {
                    if (seasonInfo.nextElement) {
                        seasonInfo.nextElement.click();
                        log(`✅ Сезон "${seasonInfo.nextName}" выбран!`);

                        await selectFirstEpisode();

                        const { season, episode } = getCurrentSeasonEpisode();
                        saveWatchHistory(season, episode);

                        setTimeout(() => sendAutoPlayCommand(), 1000);

                        resolve(true);
                    } else {
                        resolve(false);
                    }
                }, 500);
            });
        }

        async function switchToNextEpisode(remainingSeconds = null) {
            if (!settings.autoNext) {
                log('⏸️ Автопереключение отключено');
                return false;
            }

            if (remainingSeconds && settings.adaptiveSkip) {
                saveShowCreditsData(remainingSeconds);
            }

            const info = getEpisodeInfo();

            if (!info) {
                log('❌ Не удалось получить информацию о сериях');
                updateStatusPanel('Ошибка загрузки');
                return false;
            }

            if (info.isLastEpisode) {
                log(`🏁 Последняя серия сезона (${info.currentNumber}/${info.total})`);

                if (settings.autoSeason) {
                    const switched = await switchToNextSeason();
                    if (switched) {
                        showNotification('📁 Переход к новому сезону!', 'success');
                        return true;
                    }
                }

                showNotification('🏁 Сезон завершён!', 'success', 5000);
                updateStatusPanel('Сезон завершён');
                return false;
            }

            log(`🔄 Переключение: ${info.currentName} → ${info.nextName} (${info.currentNumber}/${info.total})`);
            showNotification(`📺 Следующая серия: ${info.nextName}`, 'success');
            updateStatusPanel(`Серия ${info.currentNumber + 1}/${info.total}`);

            info.dropdown.click();

            return new Promise((resolve) => {
                setTimeout(() => {
                    if (info.nextElement) {
                        info.nextElement.click();
                        log(`✅ Серия "${info.nextName}" выбрана!`);

                        const { season, episode } = getCurrentSeasonEpisode();
                        saveWatchHistory(season, episode + 1);

                        setTimeout(() => sendAutoPlayCommand(), 1000);

                        resolve(true);
                    } else {
                        resolve(false);
                    }
                }, 500);
            });
        }

        async function switchWithRetry(maxAttempts = 3, remainingSeconds = null) {
            for (let attempt = 1; attempt <= maxAttempts; attempt++) {
                try {
                    const success = await switchToNextEpisode(remainingSeconds);
                    if (success) return true;

                    const info = getEpisodeInfo();
                    if (info?.isLastEpisode) return false;

                } catch (e) {
                    log(`⚠️ Попытка ${attempt}/${maxAttempts} не удалась: ${e.message}`);
                }

                if (attempt < maxAttempts) {
                    await new Promise(r => setTimeout(r, 1000));
                }
            }

            log('❌ Все попытки переключения исчерпаны');
            showNotification('❌ Ошибка переключения', 'error');
            return false;
        }

        window.addEventListener('message', (event) => {
            if (!isTrustedOrigin(event.origin) && event.origin !== window.location.origin) {
                return;
            }

            if (event.data?.type === 'WPARTY_NEXT_EPISODE') {
                log('📥 Получен сигнал от плеера');
                switchWithRetry(3, event.data.remainingSeconds);
            }

            if (event.data?.type === 'WPARTY_AUTO_PLAY_DONE') {
                log('✅ Автовключение выполнено');
                showNotification('▶️ Воспроизведение запущено!', 'success');
            }

            if (event.data?.type === 'WPARTY_WATCH_TIME') {
                addWatchTime(event.data.seconds);
                updateWatchTimeDisplay();
            }
        });

        setTimeout(() => {
            createSettingsPanel();

            const info = getEpisodeInfo();
            if (info) {
                updateStatusPanel(
                    settings.autoNext ? 'Активно' : 'Отключено',
                    `Серия ${info.currentNumber}/${info.total}`
                );

                log(`📺 Серия: ${info.currentName} (${info.currentNumber}/${info.total})`);
                if (!info.isLastEpisode) {
                    log(`📺 Следующая: ${info.nextName}`);
                }

                const { season, episode } = getCurrentSeasonEpisode();
                saveWatchHistory(season, episode);
            }

            if (settings.autoPlay && autoPlayRemaining > 0) {
                log(`🎯 Автовключение активно: осталось ${autoPlayRemaining} серий`);
            }

            updateAdaptiveSkipDisplay();
        }, 2000);

        log('✅ Слушатель сообщений запущен');
    }

    // ============ ИНИЦИАЛИЗАЦИЯ ============
    function init() {
        settings = loadSettings();

        log('=== Версия 4.0.0 ===');
        log(`⚙️ Настройки: титры=${settings.skipCredits}, секунд=${settings.skipSeconds}, авто=${settings.autoNext}`);
        log(`⚙️ Автовключение: ${settings.autoPlay}, осталось=${autoPlayRemaining}`);
        log(`⚙️ Адаптивный пропуск: ${settings.adaptiveSkip}`);

        const hasPlayer = document.querySelector('input[data-allplay="seek"]');
        const isPlayerDomain = window.location.hostname.includes('stloadi.live');

        log(`Домен: ${window.location.hostname}`);
        log(`Есть плеер: ${!!hasPlayer}`);

        window.addEventListener('beforeunload', cleanup);

        if (isPlayerDomain || hasPlayer) {
            if (hasPlayer) {
                runPlayerMode();
            } else {
                log('⏳ Жду загрузки плеера...');
                const waitInterval = setInterval(() => {
                    if (document.querySelector('input[data-allplay="seek"]')) {
                        clearInterval(waitInterval);
                        runPlayerMode();
                    }
                }, 1000);

                setTimeout(() => clearInterval(waitInterval), 30000);
            }
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
