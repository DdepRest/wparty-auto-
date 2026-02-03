// ==UserScript==
// @name         WPARTY Auto - Redesign Edition (Fixed Min)
// @namespace    https://github.com/DdepRest/wparty-auto-
// @version      10.0.4
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

    // ═══════════════════════════════════════════════════════════
    // КОНФИГУРАЦИЯ
    // ═══════════════════════════════════════════════════════════

    const CONFIG = {
        version: '10.0.4',
        releaseDate: '2026-02-03',
        intervals: { check: 1000, watchTime: 10000, volumeCheck: 2000 },
        trustedOrigins: ['wparty.net', 'stloadi.live'],
        defaults: {
            autoNext: false,
            autoSeason: false,
            skipCredits: false,
            skipMode: 'percent',
            skipPercent: 95,
            skipSeconds: 90,
            volumeControl: false,
            volumeOSD: false,
            volumeSync: false,
            animations: true,
            transitionSpeed: 'normal',
            showNotifications: true,
            showPanel: true,
            trackWatchTime: true,
            showCharts: true,
            chartType: 'line'
        }
    };

    // ═══════════════════════════════════════════════════════════
    // СОСТОЯНИЕ
    // ═══════════════════════════════════════════════════════════

    const State = {
        settings: {},
        hasTriggered: false,
        currentShowId: null,
        showListOpen: false,
        activeTab: 'auto',
        intervals: { progress: null, watchTime: null, volumeCheck: null },
        volume: {
            userMuted: false,
            isApplying: false,
            lastUserVolume: 0.5,
            observer: null,
            channel: null,
            hookedElements: new WeakMap()
        }
    };

    // ═══════════════════════════════════════════════════════════
    // УТИЛИТЫ
    // ═══════════════════════════════════════════════════════════

    const log = (msg, type = 'info') => {
        const icons = { info: '📘', success: '✅', warning: '⚠️', error: '❌' };
        console.log(`${icons[type]} WPARTY v${CONFIG.version}: ${msg}`);
    };

    const clamp = (v, min, max) => Math.max(min, Math.min(max, Number(v) || min));

    const formatTime = (s) => {
        if (!s || s < 0) return '0 сек';
        if (s < 60) return `${Math.round(s)} сек`;
        if (s < 3600) return `${Math.round(s / 60)} мин`;
        return `${Math.floor(s / 3600)}ч ${Math.round((s % 3600) / 60)}м`;
    };

    const formatDate = (d) => d.toISOString().split('T')[0];

    const isTrustedOrigin = (origin) => CONFIG.trustedOrigins.some(d => origin.includes(d));

    const getShowId = () => {
        const match = window.location.pathname.match(/\/(\d+)/);
        return match ? match[1] : window.location.pathname.split('/').filter(Boolean)[0] || 'unknown';
    };

    const getShowName = () => {
        for (const sel of ['h1.header', 'h1', '.title']) {
            const el = document.querySelector(sel);
            if (el?.textContent?.trim()) return el.textContent.trim().substring(0, 100);
        }
        return 'Неизвестный сериал';
    };

    // ═══════════════════════════════════════════════════════════
    // ХРАНИЛИЩЕ
    // ═══════════════════════════════════════════════════════════

    const Storage = {
        get(key, def = null) {
            try { return GM_getValue(key, def); }
            catch { const d = localStorage.getItem(`wparty_${key}`); return d ? JSON.parse(d) : def; }
        },
        set(key, val) {
            try { GM_setValue(key, val); }
            catch { localStorage.setItem(`wparty_${key}`, JSON.stringify(val)); }
        },
        loadSettings() {
            const s = {};
            Object.keys(CONFIG.defaults).forEach(k => s[k] = this.get(k, CONFIG.defaults[k]));
            State.volume.userMuted = this.get('volumeMuteState', false);
            State.volume.lastUserVolume = this.get('savedVolume', 0.5);
            return s;
        },
        saveSettings(ns) {
            State.settings = { ...State.settings, ...ns };
            Object.entries(ns).forEach(([k, v]) => this.set(k, v));
        },
        getWatchTime() { return this.get('watchTime', {}); },
        saveWatchTime(d) { this.set('watchTime', d); },
        addWatchTime(secs) {
            if (!State.settings.trackWatchTime || secs <= 0) return;
            const today = formatDate(new Date());
            const data = this.getWatchTime();
            if (!data[today]) data[today] = { total: 0, shows: {} };
            data[today].total += secs;
            if (State.currentShowId) {
                if (!data[today].shows[State.currentShowId])
                    data[today].shows[State.currentShowId] = { time: 0, name: getShowName() };
                data[today].shows[State.currentShowId].time += secs;
            }
            const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
            Object.keys(data).forEach(dt => { if (new Date(dt).getTime() < cutoff) delete data[dt]; });
            this.saveWatchTime(data);
        },
        getWatchTimeStats() {
            const data = this.getWatchTime();
            const today = formatDate(new Date());
            let weekTotal = 0;
            const weekData = [];
            for (let i = 6; i >= 0; i--) {
                const dt = formatDate(new Date(Date.now() - i * 86400000));
                const t = data[dt]?.total || 0;
                weekData.push({ date: dt, time: t });
                weekTotal += t;
            }
            return { today: data[today]?.total || 0, week: weekTotal, weekData };
        },
        getWatchHistory() { return this.get('watchHistory', {}); },
        saveWatchHistory(season, episode) {
            const h = this.getWatchHistory();
            const id = State.currentShowId || getShowId();
            h[id] = { name: getShowName(), season, episode, timestamp: Date.now(), url: window.location.href };
            this.set('watchHistory', h);
        }
    };

    // ═══════════════════════════════════════════════════════════
    // DOM
    // ═══════════════════════════════════════════════════════════

    const $ = (sel) => document.querySelector(sel);
    const $$ = (sel) => document.querySelectorAll(sel);
    const $video = () => $('video');
    const $volumeSlider = () => $('input[data-allplay="volume"]');
    const $muteBtn = () => $('button[data-allplay="mute"]');
    const $seekSlider = () => $('input[data-allplay="seek"]');

    // ═══════════════════════════════════════════════════════════
    // УВЕДОМЛЕНИЯ
    // ═══════════════════════════════════════════════════════════

    const notify = (msg, type = 'info', dur = 3000) => {
        if (!State.settings.showNotifications) return;
        $$('.wparty-toast').forEach(n => n.remove());
        const colors = {
            info: '#6366f1', success: '#10b981', warning: '#f59e0b', error: '#ef4444'
        };
        const toast = document.createElement('div');
        toast.className = 'wparty-toast';
        toast.innerHTML = `<span class="wparty-toast-text">${msg}</span>`;
        toast.style.background = colors[type];
        document.body.appendChild(toast);
        requestAnimationFrame(() => toast.classList.add('wparty-toast-visible'));
        setTimeout(() => {
            toast.classList.remove('wparty-toast-visible');
            setTimeout(() => toast.remove(), 400);
        }, dur);
    };

    // ═══════════════════════════════════════════════════════════
    // ГРОМКОСТЬ
    // ═══════════════════════════════════════════════════════════

    const Volume = {
        getSaved() { return clamp(Storage.get('savedVolume', 0.5), 0, 1); },
        save(vol) {
            if (!State.settings.volumeControl) return;
            vol = clamp(vol, 0, 1);
            State.volume.lastUserVolume = vol;
            Storage.set('savedVolume', vol);
        },
        apply(showOSD = true) {
            if (!State.settings.volumeControl || State.volume.isApplying) return;
            State.volume.isApplying = true;
            const saved = this.getSaved();
            log(`Применяю громкость: ${Math.round(saved * 100)}%`);

            const video = $video();
            const slider = $volumeSlider();
            const muteBtn = $muteBtn();

            if (video) { video.volume = saved; video.muted = State.volume.userMuted; }
            if (slider) {
                const pct = saved * 100;
                slider.value = saved;
                slider.setAttribute('aria-valuenow', Math.round(pct));
                slider.setAttribute('aria-valuetext', `${pct.toFixed(1)}%`);
                slider.style.setProperty('--value', `${pct}%`);
                slider.dispatchEvent(new Event('input', { bubbles: true }));
            }
            if (muteBtn) {
                const muted = State.volume.userMuted || saved < 0.01;
                muteBtn.classList.toggle('allplay__control--pressed', muted);
                muteBtn.setAttribute('aria-pressed', muted.toString());
            }
            if (showOSD && State.settings.volumeOSD) this.showOSD(saved);
            setTimeout(() => { State.volume.isApplying = false; }, 150);
        },
        checkAndRestore() {
            if (!State.settings.volumeControl || State.volume.isApplying || State.volume.userMuted) return;
            const slider = $volumeSlider();
            const video = $video();
            const saved = this.getSaved();
            const sliderVol = slider ? parseFloat(slider.value) : null;
            const videoVol = video ? video.volume : null;
            const needsRestore =
                (sliderVol !== null && sliderVol < 0.02 && saved >= 0.02) ||
                (videoVol !== null && videoVol < 0.02 && saved >= 0.02) ||
                (video?.muted && !State.volume.userMuted);
            if (needsRestore) {
                log('Сброс громкости обнаружен, восстанавливаю...', 'warning');
                this.apply(true);
            }
        },
        showOSD(vol) {
            let osd = $('#wparty-volume-osd');
            if (!osd) {
                osd = document.createElement('div');
                osd.id = 'wparty-volume-osd';
                osd.innerHTML = `
                    <div class="wparty-osd-icon">🔊</div>
                    <div class="wparty-osd-bar"><div class="wparty-osd-fill"></div></div>
                    <div class="wparty-osd-value">50%</div>
                `;
                document.body.appendChild(osd);
            }
            const fill = osd.querySelector('.wparty-osd-fill');
            const value = osd.querySelector('.wparty-osd-value');
            const icon = osd.querySelector('.wparty-osd-icon');
            const pct = Math.round(vol * 100);
            fill.style.width = `${pct}%`;
            value.textContent = `${pct}%`;
            if (State.volume.userMuted || vol < 0.01) icon.textContent = '🔇';
            else if (vol < 0.33) icon.textContent = '🔈';
            else if (vol < 0.66) icon.textContent = '🔉';
            else icon.textContent = '🔊';
            osd.classList.add('wparty-osd-visible');
            clearTimeout(osd._hideTimer);
            osd._hideTimer = setTimeout(() => osd.classList.remove('wparty-osd-visible'), 1500);
        },
        hookControls() {
            if (!State.settings.volumeControl) return;
            const slider = $volumeSlider();
            const video = $video();
            const muteBtn = $muteBtn();

            if (slider && !State.volume.hookedElements.has(slider)) {
                State.volume.hookedElements.set(slider, true);
                slider.addEventListener('input', (e) => {
                    if (e.isTrusted && !State.volume.isApplying) {
                        const vol = parseFloat(slider.value);
                        State.volume.userMuted = vol < 0.01;
                        this.save(vol);
                        if (State.settings.volumeOSD) this.showOSD(vol);
                    }
                });
                if (!State.volume.observer) {
                    State.volume.observer = new MutationObserver(() => {
                        if (!State.volume.isApplying) setTimeout(() => this.checkAndRestore(), 50);
                    });
                    State.volume.observer.observe(slider, {
                        attributes: true,
                        attributeFilter: ['value', 'aria-valuenow', 'style']
                    });
                }
            }
            if (video && !State.volume.hookedElements.has(video)) {
                State.volume.hookedElements.set(video, true);
                video.addEventListener('volumechange', () => {
                    if (State.volume.isApplying) return;
                    if (video.volume > 0.01 && !video.muted) this.save(video.volume);
                    else if (!State.volume.userMuted) setTimeout(() => this.checkAndRestore(), 100);
                });
            }
            if (muteBtn && !State.volume.hookedElements.has(muteBtn)) {
                State.volume.hookedElements.set(muteBtn, true);
                muteBtn.addEventListener('click', (e) => {
                    if (e.isTrusted) {
                        State.volume.userMuted = !State.volume.userMuted;
                        Storage.set('volumeMuteState', State.volume.userMuted);
                        if (!State.volume.userMuted) setTimeout(() => this.apply(true), 100);
                    }
                });
            }
            if (!State.intervals.volumeCheck) {
                State.intervals.volumeCheck = setInterval(() => this.checkAndRestore(), CONFIG.intervals.volumeCheck);
            }
        }
    };

    // ═══════════════════════════════════════════════════════════
    // ПРОПУСК ТИТРОВ
    // ═══════════════════════════════════════════════════════════

    const Credits = {
        shouldSkip(cur, dur) {
            if (!State.settings.skipCredits || !State.settings.autoNext) return false;
            if (State.settings.skipMode === 'percent') return (cur / dur) * 100 >= State.settings.skipPercent;
            return dur - cur <= State.settings.skipSeconds && dur - cur > 0;
        }
    };

    // ═══════════════════════════════════════════════════════════
    // ГРАФИКИ
    // ═══════════════════════════════════════════════════════════

    const Charts = {
        draw(canvasId, data) {
            const canvas = $(`#${canvasId}`);
            if (!canvas) return;
            const ctx = canvas.getContext('2d');
            const { width, height } = canvas;
            ctx.clearRect(0, 0, width, height);
            if (State.settings.chartType === 'bar') this.drawBar(ctx, width, height, data);
            else this.drawLine(ctx, width, height, data);
        },
        drawLine(ctx, w, h, data) {
            const pad = 30, gw = w - pad * 2, gh = h - pad * 2;
            const max = Math.max(...data.map(d => d.time), 1);
            const stepX = gw / (data.length - 1 || 1);

            const grad = ctx.createLinearGradient(0, pad, 0, h - pad);
            grad.addColorStop(0, 'rgba(99,102,241,0.4)');
            grad.addColorStop(1, 'rgba(139,92,246,0.05)');

            ctx.beginPath();
            data.forEach((p, i) => {
                const x = pad + i * stepX, y = h - pad - (p.time / max) * gh;
                i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
            });
            ctx.strokeStyle = '#6366f1';
            ctx.lineWidth = 2;
            ctx.stroke();
            ctx.lineTo(w - pad, h - pad);
            ctx.lineTo(pad, h - pad);
            ctx.closePath();
            ctx.fillStyle = grad;
            ctx.fill();

            data.forEach((p, i) => {
                const x = pad + i * stepX, y = h - pad - (p.time / max) * gh;
                ctx.beginPath();
                ctx.arc(x, y, 4, 0, Math.PI * 2);
                ctx.fillStyle = '#6366f1';
                ctx.fill();
            });

            ctx.fillStyle = 'rgba(255,255,255,0.5)';
            ctx.font = '10px sans-serif';
            ctx.textAlign = 'center';
            data.forEach((p, i) => {
                const x = pad + i * stepX;
                const day = ['Вс','Пн','Вт','Ср','Чт','Пт','Сб'][new Date(p.date).getDay()];
                ctx.fillText(day, x, h - 8);
            });
        },
        drawBar(ctx, w, h, data) {
            const pad = 30, gw = w - pad * 2, gh = h - pad * 2;
            const max = Math.max(...data.map(d => d.time), 1);
            const barW = gw / data.length - 6;

            data.forEach((p, i) => {
                const x = pad + i * (gw / data.length) + 3;
                const barH = (p.time / max) * gh;
                const y = h - pad - barH;
                const grad = ctx.createLinearGradient(x, y, x, h - pad);
                grad.addColorStop(0, '#6366f1');
                grad.addColorStop(1, '#8b5cf6');
                ctx.fillStyle = grad;
                ctx.beginPath();
                ctx.roundRect(x, y, barW, barH, 3);
                ctx.fill();
            });

            ctx.fillStyle = 'rgba(255,255,255,0.5)';
            ctx.font = '10px sans-serif';
            ctx.textAlign = 'center';
            data.forEach((p, i) => {
                const x = pad + i * (gw / data.length) + barW / 2 + 3;
                const day = ['Вс','Пн','Вт','Ср','Чт','Пт','Сб'][new Date(p.date).getDay()];
                ctx.fillText(day, x, h - 8);
            });
        }
    };

    // ═══════════════════════════════════════════════════════════
    // СТИЛИ
    // ═══════════════════════════════════════════════════════════

    const injectStyles = () => {
        const speed = { slow: '0.5s', normal: '0.3s', fast: '0.15s' }[State.settings.transitionSpeed] || '0.3s';
        const css = `
            :root {
                --wp-primary: #6366f1;
                --wp-secondary: #8b5cf6;
                --wp-bg: #0f0f1a;
                --wp-bg2: #1a1a2e;
                --wp-bg3: #252542;
                --wp-text: #e4e4e7;
                --wp-muted: #71717a;
                --wp-border: rgba(255,255,255,0.08);
                --wp-speed: ${speed};
            }

            .wparty-toast {
                position: fixed;
                top: 20px;
                left: 50%;
                transform: translateX(-50%) translateY(-100px);
                z-index: 2147483647;
                padding: 12px 24px;
                border-radius: 12px;
                color: white;
                font: 500 14px system-ui, sans-serif;
                box-shadow: 0 10px 40px rgba(0,0,0,0.3);
                opacity: 0;
                transition: all var(--wp-speed) cubic-bezier(0.34,1.56,0.64,1);
                pointer-events: none;
            }
            .wparty-toast-visible {
                transform: translateX(-50%) translateY(0);
                opacity: 1;
            }

            #wparty-volume-osd {
                position: fixed;
                top: 50%;
                left: 50%;
                transform: translate(-50%,-50%) scale(0.8);
                z-index: 2147483647;
                display: flex;
                align-items: center;
                gap: 15px;
                padding: 20px 30px;
                background: rgba(15,15,26,0.95);
                border-radius: 16px;
                backdrop-filter: blur(20px);
                border: 1px solid var(--wp-border);
                opacity: 0;
                pointer-events: none;
                transition: all var(--wp-speed);
            }
            #wparty-volume-osd.wparty-osd-visible {
                opacity: 1;
                transform: translate(-50%,-50%) scale(1);
            }
            .wparty-osd-icon { font-size: 32px; }
            .wparty-osd-bar {
                width: 150px;
                height: 8px;
                background: var(--wp-bg3);
                border-radius: 4px;
                overflow: hidden;
            }
            .wparty-osd-fill {
                height: 100%;
                background: linear-gradient(90deg, var(--wp-primary), var(--wp-secondary));
                border-radius: 4px;
                transition: width 0.1s;
            }
            .wparty-osd-value {
                color: var(--wp-text);
                font: 600 18px system-ui;
                min-width: 50px;
            }

            #wparty-panel {
                position: fixed;
                bottom: 20px;
                right: 20px;
                z-index: 2147483645;
                width: 340px;
                background: var(--wp-bg);
                border-radius: 16px;
                border: 1px solid var(--wp-border);
                box-shadow: 0 20px 50px rgba(0,0,0,0.4);
                font-family: system-ui, sans-serif;
                overflow: hidden;
                transition: all var(--wp-speed);
            }
            #wparty-panel.collapsed .wparty-body { display: none; }
            #wparty-panel.collapsed .wparty-footer { display: none; }

            .wparty-header {
                display: flex;
                align-items: center;
                justify-content: space-between;
                padding: 14px 18px;
                background: linear-gradient(135deg, var(--wp-primary), var(--wp-secondary));
                cursor: pointer;
            }
            .wparty-logo {
                display: flex;
                align-items: center;
                gap: 10px;
                color: white;
            }
            .wparty-logo-icon {
                font-size: 20px;
            }
            .wparty-logo-text {
                font-weight: 600;
                font-size: 14px;
            }
            .wparty-logo-ver {
                font-size: 10px;
                opacity: 0.7;
            }
            .wparty-header-btns {
                display: flex;
                gap: 8px;
            }
            .wparty-hbtn {
                width: 30px;
                height: 30px;
                border: none;
                background: rgba(255,255,255,0.15);
                color: white;
                border-radius: 8px;
                cursor: pointer;
                font-size: 14px;
                transition: all 0.2s;
            }
            .wparty-hbtn:hover {
                background: rgba(255,255,255,0.25);
                transform: scale(1.05);
            }

            .wparty-tabs {
                display: flex;
                background: var(--wp-bg2);
                padding: 6px;
                gap: 4px;
            }
            .wparty-tab {
                flex: 1;
                padding: 8px;
                border: none;
                background: transparent;
                color: var(--wp-muted);
                font-size: 11px;
                font-weight: 500;
                border-radius: 8px;
                cursor: pointer;
                transition: all 0.2s;
                display: flex;
                flex-direction: column;
                align-items: center;
                gap: 3px;
            }
            .wparty-tab:hover { background: var(--wp-bg3); color: var(--wp-text); }
            .wparty-tab.active { background: var(--wp-primary); color: white; }
            .wparty-tab-icon { font-size: 14px; }

            .wparty-body {
                max-height: 55vh;
                overflow-y: auto;
                padding: 14px;
            }
            .wparty-body::-webkit-scrollbar { width: 5px; }
            .wparty-body::-webkit-scrollbar-thumb { background: var(--wp-bg3); border-radius: 3px; }

            .wparty-content { display: none; }
            .wparty-content.active { display: block; }

            .wparty-stats-grid {
                display: grid;
                grid-template-columns: 1fr 1fr;
                gap: 10px;
                margin-bottom: 14px;
            }
            .wparty-stat {
                background: var(--wp-bg2);
                border-radius: 12px;
                padding: 14px;
                text-align: center;
                border: 1px solid var(--wp-border);
            }
            .wparty-stat-val {
                font-size: 22px;
                font-weight: 700;
                background: linear-gradient(135deg, var(--wp-primary), var(--wp-secondary));
                -webkit-background-clip: text;
                -webkit-text-fill-color: transparent;
            }
            .wparty-stat-lbl {
                font-size: 10px;
                color: var(--wp-muted);
                margin-top: 4px;
                text-transform: uppercase;
            }

            .wparty-chart-box {
                background: var(--wp-bg2);
                border-radius: 12px;
                padding: 14px;
                border: 1px solid var(--wp-border);
            }
            .wparty-chart-head {
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-bottom: 10px;
            }
            .wparty-chart-title {
                font-size: 12px;
                font-weight: 600;
                color: var(--wp-text);
            }
            .wparty-chart-btns { display: flex; gap: 4px; }
            .wparty-cbtn {
                padding: 5px 8px;
                border: none;
                background: var(--wp-bg3);
                color: var(--wp-muted);
                font-size: 10px;
                border-radius: 5px;
                cursor: pointer;
                transition: all 0.2s;
            }
            .wparty-cbtn:hover { color: var(--wp-text); }
            .wparty-cbtn.active { background: var(--wp-primary); color: white; }
            #wparty-chart { width: 100%; height: 120px; }

            .wparty-section { margin-bottom: 16px; }
            .wparty-section:last-child { margin-bottom: 0; }
            .wparty-section-title {
                font-size: 10px;
                font-weight: 600;
                color: var(--wp-muted);
                text-transform: uppercase;
                letter-spacing: 0.5px;
                margin-bottom: 10px;
                padding-left: 2px;
            }

            .wparty-opt {
                display: flex;
                align-items: center;
                justify-content: space-between;
                padding: 12px 14px;
                background: var(--wp-bg2);
                border-radius: 10px;
                margin-bottom: 6px;
                border: 1px solid var(--wp-border);
                transition: all 0.2s;
            }
            .wparty-opt:hover { border-color: var(--wp-primary); }
            .wparty-opt-info { display: flex; align-items: center; gap: 10px; }
            .wparty-opt-icon {
                width: 32px;
                height: 32px;
                background: var(--wp-bg3);
                border-radius: 8px;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 14px;
            }
            .wparty-opt-txt { display: flex; flex-direction: column; gap: 1px; }
            .wparty-opt-title { font-size: 12px; font-weight: 500; color: var(--wp-text); }
            .wparty-opt-desc { font-size: 10px; color: var(--wp-muted); }

            .wparty-toggle {
                position: relative;
                width: 42px;
                height: 24px;
            }
            .wparty-toggle input { opacity: 0; width: 0; height: 0; }
            .wparty-toggle-slider {
                position: absolute;
                cursor: pointer;
                inset: 0;
                background: var(--wp-bg3);
                border-radius: 24px;
                transition: all 0.3s;
            }
            .wparty-toggle-slider:before {
                content: "";
                position: absolute;
                height: 18px;
                width: 18px;
                left: 3px;
                bottom: 3px;
                background: white;
                border-radius: 50%;
                transition: all 0.3s cubic-bezier(0.68,-0.55,0.265,1.55);
            }
            .wparty-toggle input:checked + .wparty-toggle-slider {
                background: linear-gradient(135deg, var(--wp-primary), var(--wp-secondary));
            }
            .wparty-toggle input:checked + .wparty-toggle-slider:before {
                transform: translateX(18px);
            }

            .wparty-select {
                padding: 6px 10px;
                background: var(--wp-bg3);
                border: 1px solid var(--wp-border);
                border-radius: 6px;
                color: var(--wp-text);
                font-size: 11px;
                cursor: pointer;
                outline: none;
            }
            .wparty-select option { background: var(--wp-bg); }

            .wparty-input {
                width: 60px;
                padding: 6px 10px;
                background: var(--wp-bg3);
                border: 1px solid var(--wp-border);
                border-radius: 6px;
                color: var(--wp-text);
                font-size: 11px;
                text-align: center;
                outline: none;
            }

            .wparty-segs {
                display: flex;
                background: var(--wp-bg3);
                border-radius: 8px;
                padding: 3px;
                margin-bottom: 10px;
            }
            .wparty-seg {
                flex: 1;
                padding: 8px;
                border: none;
                background: transparent;
                color: var(--wp-muted);
                font-size: 11px;
                font-weight: 500;
                border-radius: 6px;
                cursor: pointer;
                transition: all 0.2s;
            }
            .wparty-seg:hover { color: var(--wp-text); }
            .wparty-seg.active { background: var(--wp-primary); color: white; }

            .wparty-footer {
                padding: 10px 18px;
                background: var(--wp-bg2);
                border-top: 1px solid var(--wp-border);
                text-align: center;
            }
            .wparty-footer-links { display: flex; justify-content: center; gap: 14px; }
            .wparty-footer-link {
                color: var(--wp-muted);
                text-decoration: none;
                font-size: 10px;
                transition: color 0.2s;
            }
            .wparty-footer-link:hover { color: var(--wp-primary); }

            .wparty-modal {
                position: fixed;
                inset: 0;
                background: rgba(0,0,0,0.8);
                backdrop-filter: blur(8px);
                z-index: 2147483647;
                display: flex;
                align-items: center;
                justify-content: center;
                opacity: 0;
                transition: opacity var(--wp-speed);
            }
            .wparty-modal.visible { opacity: 1; }
            .wparty-modal-box {
                background: var(--wp-bg);
                border-radius: 20px;
                width: 90%;
                max-width: 450px;
                max-height: 75vh;
                overflow: hidden;
                border: 1px solid var(--wp-border);
                transform: scale(0.9) translateY(20px);
                transition: transform var(--wp-speed);
            }
            .wparty-modal.visible .wparty-modal-box {
                transform: scale(1) translateY(0);
            }
            .wparty-modal-head {
                display: flex;
                align-items: center;
                justify-content: space-between;
                padding: 18px 20px;
                background: linear-gradient(135deg, var(--wp-primary), var(--wp-secondary));
            }
            .wparty-modal-title { color: white; font-size: 16px; font-weight: 600; }
            .wparty-modal-close {
                width: 32px;
                height: 32px;
                border: none;
                background: rgba(255,255,255,0.2);
                color: white;
                border-radius: 50%;
                cursor: pointer;
                font-size: 16px;
                transition: all 0.2s;
            }
            .wparty-modal-close:hover { background: rgba(255,255,255,0.3); transform: scale(1.1); }
            .wparty-modal-body { padding: 18px; max-height: 55vh; overflow-y: auto; }

            .wparty-show {
                display: flex;
                align-items: center;
                gap: 14px;
                padding: 14px;
                background: var(--wp-bg2);
                border-radius: 12px;
                margin-bottom: 8px;
                cursor: pointer;
                border: 1px solid var(--wp-border);
                transition: all 0.2s;
            }
            .wparty-show:hover { border-color: var(--wp-primary); transform: translateX(4px); }
            .wparty-show-icon {
                width: 42px;
                height: 42px;
                background: var(--wp-bg3);
                border-radius: 10px;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 20px;
            }
            .wparty-show-info { flex: 1; }
            .wparty-show-name { font-size: 13px; font-weight: 500; color: var(--wp-text); }
            .wparty-show-prog { font-size: 11px; color: var(--wp-muted); margin-top: 2px; }
            .wparty-show-arrow { color: var(--wp-muted); }

            .wparty-empty {
                text-align: center;
                padding: 30px;
                color: var(--wp-muted);
            }
            .wparty-empty-icon { font-size: 40px; margin-bottom: 12px; opacity: 0.5; }
            .wparty-empty-text { font-size: 13px; }
        `;
        const style = document.createElement('style');
        style.textContent = css;
        document.head.appendChild(style);
    };

    // ═══════════════════════════════════════════════════════════
    // UI ПАНЕЛЬ
    // ═══════════════════════════════════════════════════════════

    const Panel = {
        create() {
            if (!State.settings.showPanel) return;
            $('#wparty-panel')?.remove();

            const s = State.settings;
            const panel = document.createElement('div');
            panel.id = 'wparty-panel';
            panel.innerHTML = `
                <div class="wparty-header">
                    <div class="wparty-logo">
                        <span class="wparty-logo-icon">🎬</span>
                        <div>
                            <div class="wparty-logo-text">WPARTY Auto</div>
                            <div class="wparty-logo-ver">v${CONFIG.version}</div>
                        </div>
                    </div>
                    <div class="wparty-header-btns">
                        <button class="wparty-hbtn" id="wp-shows-btn" title="Мои сериалы">📺</button>
                        <button class="wparty-hbtn" id="wp-toggle-btn" title="Свернуть">▼</button>
                    </div>
                </div>

                <div class="wparty-body">
                    <div class="wparty-tabs">
                        <button class="wparty-tab ${State.activeTab === 'stats' ? 'active' : ''}" data-tab="stats">
                            <span class="wparty-tab-icon">📊</span>
                            <span>Статистика</span>
                        </button>
                        <button class="wparty-tab ${State.activeTab === 'auto' ? 'active' : ''}" data-tab="auto">
                            <span class="wparty-tab-icon">⚡</span>
                            <span>Авто</span>
                        </button>
                        <button class="wparty-tab ${State.activeTab === 'settings' ? 'active' : ''}" data-tab="settings">
                            <span class="wparty-tab-icon">⚙️</span>
                            <span>Настройки</span>
                        </button>
                    </div>

                    <div class="wparty-content ${State.activeTab === 'stats' ? 'active' : ''}" data-content="stats">
                        <div class="wparty-stats-grid">
                            <div class="wparty-stat">
                                <div class="wparty-stat-val" id="wp-stat-today">0</div>
                                <div class="wparty-stat-lbl">Сегодня</div>
                            </div>
                            <div class="wparty-stat">
                                <div class="wparty-stat-val" id="wp-stat-week">0</div>
                                <div class="wparty-stat-lbl">За неделю</div>
                            </div>
                        </div>
                        <div class="wparty-chart-box">
                            <div class="wparty-chart-head">
                                <span class="wparty-chart-title">Активность</span>
                                <div class="wparty-chart-btns">
                                    <button class="wparty-cbtn ${s.chartType === 'line' ? 'active' : ''}" data-chart="line">📈</button>
                                    <button class="wparty-cbtn ${s.chartType === 'bar' ? 'active' : ''}" data-chart="bar">📊</button>
                                </div>
                            </div>
                            <canvas id="wparty-chart" width="260" height="120"></canvas>
                        </div>
                    </div>

                    <div class="wparty-content ${State.activeTab === 'auto' ? 'active' : ''}" data-content="auto">
                        <div class="wparty-section">
                            <div class="wparty-section-title">Автопереключение</div>
                            <div class="wparty-opt">
                                <div class="wparty-opt-info">
                                    <div class="wparty-opt-icon">▶️</div>
                                    <div class="wparty-opt-txt">
                                        <div class="wparty-opt-title">Следующая серия</div>
                                        <div class="wparty-opt-desc">Автоматически</div>
                                    </div>
                                </div>
                                <label class="wparty-toggle">
                                    <input type="checkbox" id="opt-autoNext" ${s.autoNext ? 'checked' : ''}>
                                    <span class="wparty-toggle-slider"></span>
                                </label>
                            </div>
                            <div class="wparty-opt">
                                <div class="wparty-opt-info">
                                    <div class="wparty-opt-icon">📂</div>
                                    <div class="wparty-opt-txt">
                                        <div class="wparty-opt-title">Следующий сезон</div>
                                        <div class="wparty-opt-desc">Переходить</div>
                                    </div>
                                </div>
                                <label class="wparty-toggle">
                                    <input type="checkbox" id="opt-autoSeason" ${s.autoSeason ? 'checked' : ''}>
                                    <span class="wparty-toggle-slider"></span>
                                </label>
                            </div>
                        </div>

                        <div class="wparty-section">
                            <div class="wparty-section-title">Пропуск титров</div>
                            <div class="wparty-opt">
                                <div class="wparty-opt-info">
                                    <div class="wparty-opt-icon">⏭️</div>
                                    <div class="wparty-opt-txt">
                                        <div class="wparty-opt-title">Пропускать титры</div>
                                        <div class="wparty-opt-desc">Умный переход</div>
                                    </div>
                                </div>
                                <label class="wparty-toggle">
                                    <input type="checkbox" id="opt-skipCredits" ${s.skipCredits ? 'checked' : ''}>
                                    <span class="wparty-toggle-slider"></span>
                                </label>
                            </div>
                            ${s.skipCredits ? `
                            <div class="wparty-segs">
                                <button class="wparty-seg ${s.skipMode === 'percent' ? 'active' : ''}" data-mode="percent">По проценту</button>
                                <button class="wparty-seg ${s.skipMode === 'seconds' ? 'active' : ''}" data-mode="seconds">По времени</button>
                            </div>
                            <div class="wparty-opt">
                                <div class="wparty-opt-info">
                                    <div class="wparty-opt-icon">${s.skipMode === 'percent' ? '📊' : '⏱️'}</div>
                                    <div class="wparty-opt-txt">
                                        <div class="wparty-opt-title">${s.skipMode === 'percent' ? 'Процент' : 'Секунд до конца'}</div>
                                    </div>
                                </div>
                                <input type="number" class="wparty-input" id="opt-skipValue"
                                    value="${s.skipMode === 'percent' ? s.skipPercent : s.skipSeconds}"
                                    min="${s.skipMode === 'percent' ? 50 : 10}"
                                    max="${s.skipMode === 'percent' ? 99 : 300}">
                            </div>
                            ` : ''}
                        </div>

                        <div class="wparty-section">
                            <div class="wparty-section-title">Громкость</div>
                            <div class="wparty-opt">
                                <div class="wparty-opt-info">
                                    <div class="wparty-opt-icon">🔊</div>
                                    <div class="wparty-opt-txt">
                                        <div class="wparty-opt-title">Управление</div>
                                        <div class="wparty-opt-desc">Сохранять уровень</div>
                                    </div>
                                </div>
                                <label class="wparty-toggle">
                                    <input type="checkbox" id="opt-volumeControl" ${s.volumeControl ? 'checked' : ''}>
                                    <span class="wparty-toggle-slider"></span>
                                </label>
                            </div>
                            ${s.volumeControl ? `
                            <div class="wparty-opt">
                                <div class="wparty-opt-info">
                                    <div class="wparty-opt-icon">📺</div>
                                    <div class="wparty-opt-txt">
                                        <div class="wparty-opt-title">OSD</div>
                                    </div>
                                </div>
                                <label class="wparty-toggle">
                                    <input type="checkbox" id="opt-volumeOSD" ${s.volumeOSD ? 'checked' : ''}>
                                    <span class="wparty-toggle-slider"></span>
                                </label>
                            </div>
                            ` : ''}
                        </div>
                    </div>

                    <div class="wparty-content ${State.activeTab === 'settings' ? 'active' : ''}" data-content="settings">
                        <div class="wparty-section">
                            <div class="wparty-section-title">Интерфейс</div>
                            <div class="wparty-opt">
                                <div class="wparty-opt-info">
                                    <div class="wparty-opt-icon">✨</div>
                                    <div class="wparty-opt-txt">
                                        <div class="wparty-opt-title">Анимации</div>
                                    </div>
                                </div>
                                <label class="wparty-toggle">
                                    <input type="checkbox" id="opt-animations" ${s.animations ? 'checked' : ''}>
                                    <span class="wparty-toggle-slider"></span>
                                </label>
                            </div>
                            <div class="wparty-opt">
                                <div class="wparty-opt-info">
                                    <div class="wparty-opt-icon">🔔</div>
                                    <div class="wparty-opt-txt">
                                        <div class="wparty-opt-title">Уведомления</div>
                                    </div>
                                </div>
                                <label class="wparty-toggle">
                                    <input type="checkbox" id="opt-showNotifications" ${s.showNotifications ? 'checked' : ''}>
                                    <span class="wparty-toggle-slider"></span>
                                </label>
                            </div>
                            <div class="wparty-opt">
                                <div class="wparty-opt-info">
                                    <div class="wparty-opt-icon">⏱️</div>
                                    <div class="wparty-opt-txt">
                                        <div class="wparty-opt-title">Статистика</div>
                                    </div>
                                </div>
                                <label class="wparty-toggle">
                                    <input type="checkbox" id="opt-trackWatchTime" ${s.trackWatchTime ? 'checked' : ''}>
                                    <span class="wparty-toggle-slider"></span>
                                </label>
                            </div>
                        </div>
                    </div>
                </div>

                <div class="wparty-footer">
                    <div class="wparty-footer-links">
                        <a href="https://github.com/DdepRest/wparty-auto-" target="_blank" class="wparty-footer-link">GitHub</a>
                        <a href="https://github.com/DdepRest/wparty-auto-/issues" target="_blank" class="wparty-footer-link">Поддержка</a>
                    </div>
                </div>
            `;

            document.body.appendChild(panel);
            this.bindEvents();
            this.updateStats();
        },

        bindEvents() {
            const panel = $('#wparty-panel');
            if (!panel) return;

            $('#wp-toggle-btn')?.addEventListener('click', e => {
                e.stopPropagation();
                panel.classList.toggle('collapsed');
            });

            $('#wp-shows-btn')?.addEventListener('click', e => {
                e.stopPropagation();
                this.showWatchList();
            });

            $$('.wparty-tab').forEach(tab => {
                tab.addEventListener('click', () => {
                    const name = tab.dataset.tab;
                    State.activeTab = name;
                    $$('.wparty-tab').forEach(t => t.classList.remove('active'));
                    $$('.wparty-content').forEach(c => c.classList.remove('active'));
                    tab.classList.add('active');
                    $(`[data-content="${name}"]`)?.classList.add('active');
                });
            });

            $$('.wparty-cbtn').forEach(btn => {
                btn.addEventListener('click', () => {
                    Storage.saveSettings({ chartType: btn.dataset.chart });
                    $$('.wparty-cbtn').forEach(b => b.classList.remove('active'));
                    btn.classList.add('active');
                    this.updateStats();
                });
            });

            $$('.wparty-seg').forEach(seg => {
                seg.addEventListener('click', () => {
                    Storage.saveSettings({ skipMode: seg.dataset.mode });
                    this.create();
                });
            });

            const bind = (id, key, refresh = false) => {
                $(`#opt-${id}`)?.addEventListener('change', e => {
                    Storage.saveSettings({ [key]: e.target.checked });
                    if (refresh) this.create();
                    if (key === 'volumeControl' && e.target.checked) {
                        Volume.hookControls();
                        Volume.apply();
                    }
                });
            };

            bind('autoNext', 'autoNext');
            bind('autoSeason', 'autoSeason');
            bind('skipCredits', 'skipCredits', true);
            bind('volumeControl', 'volumeControl', true);
            bind('volumeOSD', 'volumeOSD');
            bind('animations', 'animations', true);
            bind('showNotifications', 'showNotifications');
            bind('trackWatchTime', 'trackWatchTime', true);

            $('#opt-skipValue')?.addEventListener('change', e => {
                const key = State.settings.skipMode === 'percent' ? 'skipPercent' : 'skipSeconds';
                Storage.saveSettings({ [key]: parseInt(e.target.value) });
            });
        },

        updateStats() {
            const stats = Storage.getWatchTimeStats();
            const today = $('#wp-stat-today');
            const week = $('#wp-stat-week');
            if (today) today.textContent = formatTime(stats.today);
            if (week) week.textContent = formatTime(stats.week);
            Charts.draw('wparty-chart', stats.weekData);
        },

        showWatchList() {
            if (State.showListOpen) return;
            const history = Storage.getWatchHistory();
            const shows = Object.entries(history)
                .map(([id, d]) => ({ id, ...d }))
                .sort((a, b) => b.timestamp - a.timestamp);

            const modal = document.createElement('div');
            modal.className = 'wparty-modal';
            modal.innerHTML = `
                <div class="wparty-modal-box">
                    <div class="wparty-modal-head">
                        <span class="wparty-modal-title">📺 Мои сериалы</span>
                        <button class="wparty-modal-close">✕</button>
                    </div>
                    <div class="wparty-modal-body">
                        ${shows.length === 0 ? `
                            <div class="wparty-empty">
                                <div class="wparty-empty-icon">📺</div>
                                <div class="wparty-empty-text">Список пуст</div>
                            </div>
                        ` : shows.map(s => `
                            <div class="wparty-show" data-url="${s.url}">
                                <div class="wparty-show-icon">🎬</div>
                                <div class="wparty-show-info">
                                    <div class="wparty-show-name">${s.name || 'Неизвестный'}</div>
                                    <div class="wparty-show-prog">Сезон ${s.season || 1}, Серия ${s.episode || 1}</div>
                                </div>
                                <span class="wparty-show-arrow">→</span>
                            </div>
                        `).join('')}
                    </div>
                </div>
            `;

            document.body.appendChild(modal);
            State.showListOpen = true;
            requestAnimationFrame(() => modal.classList.add('visible'));

            const close = () => {
                modal.classList.remove('visible');
                setTimeout(() => { modal.remove(); State.showListOpen = false; }, 300);
            };

            modal.querySelector('.wparty-modal-close').addEventListener('click', close);
            modal.addEventListener('click', e => { if (e.target === modal) close(); });
            modal.querySelectorAll('.wparty-show').forEach(s => {
                s.addEventListener('click', () => { window.location.href = s.dataset.url; });
            });
        }
    };

    // ═══════════════════════════════════════════════════════════
    // РЕЖИМ ПЛЕЕРА
    // ═══════════════════════════════════════════════════════════

    const runPlayerMode = () => {
        log('Режим ПЛЕЕРА (iframe)');

        let lastSave = Date.now();

        const getProgress = () => {
            const seek = $seekSlider();
            if (!seek) return null;
            const cur = parseFloat(seek.getAttribute('aria-valuenow')) || 0;
            const max = parseFloat(seek.getAttribute('aria-valuemax')) || 0;
            return max > 0 ? { cur, max } : null;
        };

        const notifyParent = (remaining = null) => {
            try { window.parent.postMessage({ type: 'WPARTY_NEXT_EPISODE', remaining }, '*'); } catch {}
        };

        const sendWatchTime = () => {
            const elapsed = (Date.now() - lastSave) / 1000;
            try { window.parent.postMessage({ type: 'WPARTY_WATCH_TIME', seconds: elapsed }, '*'); } catch {}
            lastSave = Date.now();
        };

        State.intervals.progress = setInterval(() => {
            const prog = getProgress();
            if (!prog || State.hasTriggered) return;
            const video = $video();
            if (!video) return;
            if (Credits.shouldSkip(video.currentTime, video.duration)) {
                State.hasTriggered = true;
                log('Пропуск титров!', 'success');
                notifyParent(video.duration - video.currentTime);
                setTimeout(() => { State.hasTriggered = false; }, 15000);
            }
        }, CONFIG.intervals.check);

        if (State.settings.trackWatchTime) {
            State.intervals.watchTime = setInterval(sendWatchTime, CONFIG.intervals.watchTime);
        }

        if (State.settings.volumeControl) {
            setTimeout(() => { Volume.hookControls(); Volume.apply(true); }, 1000);
            setTimeout(() => Volume.apply(false), 3000);
            setTimeout(() => Volume.apply(false), 5000);
        }

        log('Мониторинг запущен', 'success');
    };

    // ═══════════════════════════════════════════════════════════
    // РЕЖИМ ОСНОВНОЙ СТРАНИЦЫ
    // ═══════════════════════════════════════════════════════════

    const runMainMode = () => {
        log('Режим ОСНОВНОЙ СТРАНИЦЫ');
        State.currentShowId = getShowId();

        const getSeasonEpisode = () => {
            let season = 1, episode = 1;
            const seasonDrop = $('div[name="season"]');
            if (seasonDrop) {
                const menu = seasonDrop.querySelector('.menu');
                if (menu) {
                    const all = [...menu.querySelectorAll('.item')];
                    const cur = menu.querySelector('.item.active.selected');
                    if (cur) season = all.indexOf(cur) + 1;
                }
            }
            const epDrop = $('div[name="episode"]');
            if (epDrop) {
                const menu = epDrop.querySelector('.menu');
                if (menu) {
                    const all = [...menu.querySelectorAll('.item')];
                    const cur = menu.querySelector('.item.active.selected');
                    if (cur) episode = all.indexOf(cur) + 1;
                }
            }
            return { season, episode };
        };

        const getEpisodeInfo = () => {
            const drop = $('div[name="episode"]');
            if (!drop) return null;
            const menu = drop.querySelector('.menu');
            if (!menu) return null;
            const all = [...menu.querySelectorAll('.item')];
            const cur = menu.querySelector('.item.active.selected');
            if (!all.length || !cur) return null;
            const idx = all.indexOf(cur);
            return {
                total: all.length,
                current: idx + 1,
                isLast: idx === all.length - 1,
                next: idx < all.length - 1 ? all[idx + 1] : null,
                dropdown: drop
            };
        };

        const switchNext = async () => {
            if (!State.settings.autoNext) return false;
            const info = getEpisodeInfo();
            if (!info) return false;
            if (info.isLast) {
                notify('🏁 Сезон завершён!', 'success', 5000);
                return false;
            }
            info.dropdown.click();
            return new Promise(res => {
                setTimeout(() => {
                    if (info.next) {
                        info.next.click();
                        const { season, episode } = getSeasonEpisode();
                        Storage.saveWatchHistory(season, episode + 1);
                        notify('📺 Следующая серия', 'success');
                        res(true);
                    } else res(false);
                }, 500);
            });
        };

        window.addEventListener('message', e => {
            if (!isTrustedOrigin(e.origin)) return;
            if (e.data?.type === 'WPARTY_NEXT_EPISODE') switchNext();
            if (e.data?.type === 'WPARTY_WATCH_TIME') {
                Storage.addWatchTime(e.data.seconds);
                Panel.updateStats();
            }
        });

        setTimeout(() => {
            Panel.create();
            const { season, episode } = getSeasonEpisode();
            Storage.saveWatchHistory(season, episode);
        }, 2000);
    };

    // ═══════════════════════════════════════════════════════════
    // ОЧИСТКА
    // ═══════════════════════════════════════════════════════════

    const cleanup = () => {
        Object.values(State.intervals).forEach(i => i && clearInterval(i));
        State.volume.observer?.disconnect();
        State.volume.channel?.close();
        log('Ресурсы очищены');
    };

    // ═══════════════════════════════════════════════════════════
    // ИНИЦИАЛИЗАЦИЯ
    // ═══════════════════════════════════════════════════════════

    const init = () => {
        State.settings = Storage.loadSettings();
        log('=== СТАРТ ===');
        log(`Авто: ${State.settings.autoNext}, Титры: ${State.settings.skipCredits}, Громкость: ${State.settings.volumeControl}`);

        injectStyles();
        window.addEventListener('beforeunload', cleanup);

        const isPlayer = window.location.hostname.includes('stloadi.live') || $seekSlider();
        if (isPlayer) runPlayerMode();
        else runMainMode();
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();
