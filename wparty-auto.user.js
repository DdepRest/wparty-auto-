// ==UserScript==
// @name         WPARTY Auto - Redesign Edition (Fixed Min)
// @namespace    https://github.com/DdepRest/wparty-auto-redesign
// @version      10.0.4
// @description  Минифицированная версия скрипта для автоматического переключения серий с современным дизайном и расширенными возможностями
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
// @updateURL    https://raw.githubusercontent.com/DdepRest/wparty-auto-redesign/main/wparty-auto-redesign.user.js
// @downloadURL  https://raw.githubusercontent.com/DdepRest/wparty-auto-redesign/main/wparty-auto-redesign.user.js
// @supportURL   https://github.com/DdepRest/wparty-auto-redesign/issues
// @homepageURL  https://github.com/DdepRest/wparty-auto-redesign
// @icon         https://www.google.com/s2/favicons?sz=64&domain=wparty.net
// ==/UserScript==
/**
* WPARTY Auto - Redesign Edition
* Современный пользовательский скрипт для автоматического переключения серий
* с улучшенным дизайном и расширенными возможностями
*/
(function() {
'use strict';
const IS_TOP = window.top === window.self;
// ═══════════════════════════════════════════════════════════
// КОНФИГУРАЦИЯ СКРИПТА
// ═══════════════════════════════════════════════════════════
const CONFIG = {
version: '10.0.4',
releaseDate: '2026-02-03',
// Интервалы проверки
intervals: {
check: 1000,           // Основная проверка
volumeCheck: 3000      // Проверка громкости
},
// Таймауты
timeouts: {
volumeApply: 150,      // Применение громкости
volumeRestore: 100,    // Восстановление громкости
domWait: 500,          // Ожидание DOM
volumeInitial: 1000,   // Начальная громкость
volumeRetry: 3000,     // Повтор установки громкости
nextCountdown: 7000,   // Обратный отсчет перед следующей серией
nextEpisode: 15000     // Таймаут следующей серии
},
// Настройки дебаунса
debounce: {
volumeChange: 200,     // Изменение громкости
input: 300             // Ввод данных
},
// Доверенные домены
trustedOrigins: [
'wparty.net',
'stloadi.live',
'akmeism-as.stloadi.live'
],
// Настройки по умолчанию
defaults: {
autoNext: false,           // Автопереключение серий
autoSeason: false,         // Автопереключение сезонов
skipCredits: false,        // Пропуск титров
skipMode: 'percent',       // Режим пропуска ('percent' или 'seconds')
skipPercent: 95,           // Процент для пропуска
skipSeconds: 90,           // Секунды для пропуска
volumeControl: false,      // Контроль громкости
volumeOSD: false,          // OSD громкости
compressor: false,         // Аудио компрессор
animations: true,          // Анимации интерфейса
transitionSpeed: 'normal', // Скорость переходов
showNotifications: true,   // Показывать уведомления
showPanel: true,           // Показывать панель
panelPosition: 'right',    // Позиция панели
theme: 'neon-dark',        // Тема оформления
compactMode: false,        // Компактный режим
advancedUI: true,          // Расширенный интерфейс
smartResume: true,         // Умное возобновление
autoPause: false,          // Автопауза
playbackSpeed: 1.0         // Скорость воспроизведения
},
// Настройки хранилища
storage: {
version: 3,              // Версия формата хранения
encryption: false,       // Шифрование данных
backup: true             // Создание резервных копий
}
};
// ═══════════════════════════════════════════════════════════
// УТИЛИТЫ
// ═══════════════════════════════════════════════════════════
const Utils = {
/**
* Дебаунс функции
* @param {Function} fn - Функция для дебаунса
* @param {number} delay - Задержка в миллисекундах
* @returns {Function} - Дебаунсированная функция
*/
debounce(fn, delay) {
let timeout;
return function(...args) {
clearTimeout(timeout);
timeout = setTimeout(() => fn.apply(this, args), delay);
};
},
/**
* Троттлинг функции
* @param {Function} fn - Функция для троттлинга
* @param {number} delay - Задержка в миллисекундах
* @returns {Function} - Троттлинг функция
*/
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
/**
* Ограничение значения диапазоном
* @param {number} v - Значение
* @param {number} min - Минимальное значение
* @param {number} max - Максимальное значение
* @returns {number} - Ограниченное значение
*/
clamp(v, min, max) {
const num = Number(v);
if (isNaN(num)) return min;
return Math.max(min, Math.min(max, num));
},
/**
* Проверка доверенного домена
* @param {string} origin - Домен для проверки
* @returns {boolean} - True если домен доверенный
*/
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
/**
* Безопасный парсинг JSON
* @param {string} str - Строка JSON
* @param {*} fallback - Значение по умолчанию
* @returns {*} - Результат парсинга или fallback
*/
safeJSONParse(str, fallback = null) {
try {
return JSON.parse(str);
} catch {
return fallback;
}
},
/**
* Валидация сообщения
* @param {Object} data - Данные сообщения
* @returns {boolean} - True если сообщение валидно
*/
validateMessage(data) {
if (!data || typeof data !== 'object') return false;
if (!data.type || typeof data.type !== 'string') return false;
return true;
},
};
// ═══════════════════════════════════════════════════════════
// СИСТЕМА ЛОГИРОВАНИЯ
// ═══════════════════════════════════════════════════════════
const Logger = {
levels: { debug: 0, info: 1, success: 2, warning: 3, error: 4 },
currentLevel: 1,
/**
* Логирование сообщения
* @param {string} msg - Сообщение
* @param {string} type - Тип сообщения
*/
log(msg, type = 'info') {
if (this.levels[type] < this.currentLevel) return;
const icons = {
debug: '🔍',
info: '📘',
success: '✅',
warning: '⚠️',
error: '❌'
};
const styles = {
debug: 'color: #71717a',
info: 'color: #a78bfa',
success: 'color: #34d399',
warning: 'color: #fbbf24',
error: 'color: #f87171'
};
console.log(`%c${icons[type]} WPARTY v${CONFIG.version}: ${msg}`, styles[type]);
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
}
};
// ═══════════════════════════════════════════════════════════
// МЕНЕДЖЕР DOM ЭЛЕМЕНТОВ
// ═══════════════════════════════════════════════════════════
const DOM = {
/**
* Выбор элемента с кэшированием
* @param {string} sel - CSS селектор
* @param {boolean} cache - Кэшировать ли результат
* @returns {Element|null} - Найденный элемент или null
*/
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
/**
* Выбор всех элементов по селектору
* @param {string} sel - CSS селектор
* @returns {NodeList} - Список элементов
*/
selectAll(sel) {
return document.querySelectorAll(sel);
},
/**
* Очистка кэша DOM
*/
clearCache() {
State.dom.cache.clear();
},
/**
* Получение видео элемента
* @returns {Element|null} - Видео элемент или null
*/
video() { return this.select('video', false); },
/**
* Получение слайдера громкости
* @returns {Element|null} - Слайдер громкости или null
*/
volumeSlider() { return this.select('input[data-allplay="volume"]', false); },
/**
* Получение кнопки выключения звука
* @returns {Element|null} - Кнопка выключения звука или null
*/
muteBtn() { return this.select('button[data-allplay="mute"]', false); },
/**
* Получение слайдера перемотки
* @returns {Element|null} - Слайдер перемотки или null
*/
seekSlider() { return this.select('input[data-allplay="seek"]', false); }
};
// ═══════════════════════════════════════════════════════════
// СИСТЕМА ХРАНЕНИЯ НАСТРОЕК
// ═══════════════════════════════════════════════════════════
const Storage = {
/**
* Получение значения из хранилища
* @param {string} key - Ключ
* @param {*} def - Значение по умолчанию
* @returns {*} - Значение из хранилища
*/
get(key, def = null) {
try {
return GM_getValue(key, def);
} catch {
const data = localStorage.getItem(`wparty_${key}`);
return data ? Utils.safeJSONParse(data, def) : def;
}
},
/**
* Сохранение значения в хранилище
* @param {string} key - Ключ
* @param {*} val - Значение
*/
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
/**
* Миграция хранилища
*/
migrate() {
const currentVersion = this.get('storageVersion', 1);
if (currentVersion >= CONFIG.storage.version) return;
Logger.info(`Миграция хранилища ${currentVersion} → ${CONFIG.storage.version}`);
// Здесь можно добавить логику миграции между версиями
this.set('storageVersion', CONFIG.storage.version);
},
/**
* Загрузка настроек
* @returns {Object} - Объект с настройками
*/
loadSettings() {
const s = {};
Object.keys(CONFIG.defaults).forEach(k => {
s[k] = this.get(k, CONFIG.defaults[k]);
});
State.volume.userMuted = this.get('volumeMuteState', false);
State.volume.lastUserVolume = Utils.clamp(this.get('savedVolume', 0.5), 0, 1);
return s;
},
/**
* Сохранение настроек
* @param {Object} newSettings - Новые настройки
*/
saveSettings(newSettings) {
State.settings = { ...State.settings, ...newSettings };
Object.entries(newSettings).forEach(([k, v]) => this.set(k, v));
if (typeof Panel !== 'undefined' && Panel.updateLiveUI) {
Panel.updateLiveUI();
}
},
/**
* Получение ID текущего сериала
* @returns {string} - ID сериала
*/
getShowId() {
const match = window.location.pathname.match(/\/(\d+)/);
return match ? match[1] : window.location.pathname.split('/').filter(Boolean)[0] || 'unknown';
},
/**
* Получение названия сериала
* @returns {string} - Название сериала
*/
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
/**
* Получение истории просмотров
* @returns {Object} - Объект истории просмотров
*/
getWatchHistory() {
const history = this.get('watchHistory', {});
if (typeof history !== 'object' || Array.isArray(history)) return {};
return history;
},
/**
* Сохранение истории просмотра
* @param {number} season - Сезон
* @param {number} episode - Серия
*/
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
/**
* Обновление названия текущего сериала, если оно стало доступно
*/
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
/**
* Очистка истории просмотров
*/
clearWatchHistory() {
this.set('watchHistory', {});
if (typeof Panel !== 'undefined' && Panel.updateLiveUI) {
Panel.updateLiveUI();
}
}
};
// ═══════════════════════════════════════════════════════════
// SVG ИКОНКИ
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
chevronLeft: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>`,
percent: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="19" y1="5" x2="5" y2="19"/><circle cx="6.5" cy="6.5" r="2.5"/><circle cx="17.5" cy="17.5" r="2.5"/></svg>`,
github: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.627-5.479 5.927.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.97 8.389-7.862 8.389-14.855 0-8.836-7.163-16-16-16z"/></svg>`,
externalLink: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>`,
stats: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="3" y1="3" x2="21" y2="3"/><line x1="3" y1="21" x2="21" y2="21"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="12" y1="3" x2="12" y2="21"/></svg>`,
heart: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>`,
star: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>`,
download: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>`
};
// ═══════════════════════════════════════════════════════════
// СИСТЕМА УВЕДОМЛЕНИЙ
// ═══════════════════════════════════════════════════════════
const Notifications = {
container: null,
/**
* Инициализация контейнера уведомлений
*/
init() {
if (this.container) return;
this.container = document.createElement('div');
this.container.className = 'wpa-toast-container';
document.body.appendChild(this.container);
},
/**
* Показать уведомление
* @param {string} msg - Сообщение
* @param {string} type - Тип ('info', 'success', 'warning', 'error')
* @param {number} dur - Продолжительность в миллисекундах
*/
show(msg, type = 'info', dur = 3500) {
if (!State.settings.showNotifications) return;
this.init();
const icons = {
info: Icons.info,
success: Icons.check,
warning: Icons.warning,
error: Icons.error
};
const toast = document.createElement('div');
toast.className = `wpa-toast wpa-toast--${type}`;
toast.innerHTML = `
<div class="wpa-toast__icon">${icons[type]}</div>
<div class="wpa-toast__content">
<span class="wpa-toast__message">${msg}</span>
</div>
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
// СИСТЕМА КОНТРОЛЯ ГРОМКОСТИ
// ═══════════════════════════════════════════════════════════
const Volume = {
/**
* Получение сохраненного уровня громкости
* @returns {number} - Уровень громкости (0-1)
*/
getSaved() {
return Utils.clamp(Storage.get('savedVolume', 0.5), 0, 1);
},
/**
* Сохранение уровня громкости
* @param {number} vol - Уровень громкости (0-1)
*/
save(vol) {
if (!State.settings.volumeControl) return;
const clamped = Utils.clamp(vol, 0, 1);
State.volume.lastUserVolume = clamped;
Storage.set('savedVolume', clamped);
Logger.debug(`Громкость сохранена: ${Math.round(clamped * 100)}%`);
},
/**
* Применение уровня громкости
* @param {boolean} showOSD - Показать OSD
*/
apply(showOSD = true) {
if (!State.settings.volumeControl || State.volume.isApplying) return;
State.volume.isApplying = true;
const saved = this.getSaved();
Logger.info(`Применяю громкость: ${Math.round(saved * 100)}%`);
try {
const video = DOM.video();
const slider = DOM.volumeSlider();
const muteBtn = DOM.muteBtn();
if (video) {
video.volume = saved;
video.muted = State.volume.userMuted;
}
if (slider) {
const pct = saved * 100;
slider.value = saved;
slider.setAttribute('aria-valuenow', Math.round(pct));
slider.setAttribute('aria-valuetext', `${pct.toFixed(1)}%`);
slider.style.setProperty('--value', `${pct}%`);
const event = new Event('input', { bubbles: true });
slider.dispatchEvent(event);
}
if (muteBtn) {
const muted = State.volume.userMuted || saved < 0.01;
muteBtn.classList.toggle('allplay__control--pressed', muted);
muteBtn.setAttribute('aria-pressed', muted.toString());
}
if (showOSD && State.settings.volumeOSD) {
this.showOSD(saved);
}
// Включить компрессор если нужен
if (State.settings.compressor && !AudioCompressor.sourceNode) {
AudioCompressor.enable();
} else if (State.settings.compressor && AudioCompressor.sourceNode) {
// Если компрессор включен, но источник изменился, переподключаем
const currentVideo = DOM.video();
if (currentVideo && AudioCompressor.sourceNode.mediaElement !== currentVideo) {
AudioCompressor.disable();  // Сначала отключаем старый
AudioCompressor.enable();   // Затем подключаем к новому видео
}
}
} catch (e) {
Logger.error(`Ошибка применения громкости: ${e.message}`);
} finally {
setTimeout(() => {
State.volume.isApplying = false;
}, CONFIG.timeouts.volumeApply);
}
},
/**
* Проверка и восстановление уровня громкости
*/
checkAndRestore: Utils.throttle(function() {
if (!State.settings.volumeControl || State.volume.isApplying || State.volume.userMuted) return;
try {
const slider = DOM.volumeSlider();
const video = DOM.video();
const saved = Volume.getSaved();
const sliderVol = slider ? parseFloat(slider.value) : null;
const videoVol = video ? video.volume : null;
const needsRestore =
(sliderVol !== null && sliderVol < 0.02 && saved >= 0.02) ||
(videoVol !== null && videoVol < 0.02 && saved >= 0.02) ||
(video?.muted && !State.volume.userMuted);
if (needsRestore) {
Logger.warn('Сброс громкости обнаружен, восстанавливаю...');
Volume.apply(true);
}
// Убедиться, что компрессор в нужном состоянии
if (State.settings.compressor && !AudioCompressor.sourceNode) {
AudioCompressor.enable();
} else if (State.settings.compressor && AudioCompressor.sourceNode) {
// Если компрессор включен, но источник изменился, переподключаем
const currentVideo = DOM.video();
if (currentVideo && AudioCompressor.sourceNode.mediaElement !== currentVideo) {
AudioCompressor.disable();  // Сначала отключаем старый
AudioCompressor.enable();   // Затем подключаем к новому видео
}
} else if (!State.settings.compressor && AudioCompressor.sourceNode) {
AudioCompressor.disable();
}
} catch (e) {
Logger.error(`Ошибка проверки громкости: ${e.message}`);
}
}, CONFIG.intervals.volumeCheck),
/**
* Показать OSD громкости
* @param {number} vol - Уровень громкости
*/
showOSD(vol) {
let osd = document.getElementById('wpa-volume-osd');
if (!osd) {
osd = document.createElement('div');
osd.id = 'wpa-volume-osd';
osd.className = 'wpa-osd';
osd.innerHTML = `
<div class="wpa-osd__icon">${Icons.volume}</div>
<div class="wpa-osd__bar">
<div class="wpa-osd__fill"></div>
</div>
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
osd._hideTimer = setTimeout(() => {
osd.classList.remove('wpa-osd--visible');
}, 1500);
},
/**
* Подключение к элементам управления громкостью
*/
hookControls() {
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
this.apply(false);
}
};
const handleVolumeChange = Utils.debounce(() => {
if (State.volume.isApplying) return;
if (video.volume > 0.01 && !video.muted) {
this.save(video.volume);
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
setTimeout(() => this.apply(true), CONFIG.timeouts.volumeRestore);
}
}
};
muteBtn.addEventListener('click', handleMute);
State.cleanup.push(() => muteBtn.removeEventListener('click', handleMute));
}
if (!State.intervals.volumeCheck) {
State.intervals.volumeCheck = setInterval(
() => this.checkAndRestore(),
CONFIG.intervals.volumeCheck
);
}
// Включить компрессор если нужен
if (State.settings.compressor && !AudioCompressor.sourceNode) {
AudioCompressor.enable();
} else if (State.settings.compressor && AudioCompressor.sourceNode) {
// Если компрессор включен, но источник изменился, переподключаем
const currentVideo = DOM.video();
if (currentVideo && AudioCompressor.sourceNode.mediaElement !== currentVideo) {
AudioCompressor.disable();  // Сначала отключаем старый
AudioCompressor.enable();   // Затем подключаем к новому видео
}
}
}
};
// ═══════════════════════════════════════════════════════════
// АУДИО КОМПРЕССОР
// ═══════════════════════════════════════════════════════════
const AudioCompressor = {
sourceNode: null,  // Добавляем переменную для хранения источника
/**
* Инициализация аудио компрессора
*/
init() {
if (!State.settings.compressor) return;
try {
// Создаем аудиоконтекст только если его нет
if (!State.volume.audioContext) {
State.volume.audioContext = new (window.AudioContext || window.webkitAudioContext)();
}
// Создаем компрессор
if (!State.volume.compressor) {
State.volume.compressor = State.volume.audioContext.createDynamicsCompressor();
// Настройки компрессора (минимальная нагрузка)
State.volume.compressor.threshold.setValueAtTime(-12, State.volume.audioContext.currentTime);
State.volume.compressor.knee.setValueAtTime(15, State.volume.audioContext.currentTime);
State.volume.compressor.ratio.setValueAtTime(3, State.volume.audioContext.currentTime);  // 3:1 ratio
State.volume.compressor.attack.setValueAtTime(0.003, State.volume.audioContext.currentTime);
State.volume.compressor.release.setValueAtTime(0.25, State.volume.audioContext.currentTime);
}
} catch (e) {
Logger.error(`Ошибка инициализации компрессора: ${e.message}`);
}
},
/**
* Включение аудио компрессора
*/
enable() {
if (!State.settings.compressor) return;
this.init();
const video = DOM.video();
if (!video || !State.volume.compressor) return;
try {
// Проверяем, не подключен ли уже источник к этому видео
if (!this.sourceNode) {
// Создаем медиа-источник из видео
this.sourceNode = State.volume.audioContext.createMediaElementSource(video);
// Подключаем цепочку: видео -> компрессор -> аудиовыход
this.sourceNode.connect(State.volume.compressor);
State.volume.compressor.connect(State.volume.audioContext.destination);
Logger.info('Компрессор звука включен');
} else if (this.sourceNode && this.sourceNode.mediaElement !== video) {
// Если источник уже подключен к другому видео, переподключаем
this.sourceNode.disconnect();
State.volume.compressor.disconnect();
// Создаем новый источник из текущего видео
this.sourceNode = State.volume.audioContext.createMediaElementSource(video);
// Подключаем цепочку: видео -> компрессор -> аудиовыход
this.sourceNode.connect(State.volume.compressor);
State.volume.compressor.connect(State.volume.audioContext.destination);
Logger.info('Компрессор звука переподключен к новому видео');
}
} catch (e) {
Logger.error(`Ошибка подключения компрессора: ${e.message}`);
}
},
/**
* Отключение аудио компрессора
*/
disable() {
if (this.sourceNode && State.volume.compressor && State.volume.audioContext) {
try {
// Отключаем цепочку: видео -> компрессор -> аудиовыход
this.sourceNode.disconnect();
State.volume.compressor.disconnect();
this.sourceNode = null;
State.volume.compressor = null;
// Закрываем аудиоконтекст если не используется
if (State.volume.audioContext && State.volume.audioContext.state !== 'closed') {
State.volume.audioContext.close();
State.volume.audioContext = null;
}
Logger.info('Компрессор звука отключен');
} catch (e) {
Logger.error(`Ошибка отключения компрессора: ${e.message}`);
}
}
},
/**
* Переключение состояния аудио компрессора
*/
toggle() {
if (State.settings.compressor) {
this.enable();
} else {
this.disable();
}
}
};
// ═══════════════════════════════════════════════════════════
// СИСТЕМА ПРОПУСКА ТИТРОВ
// ═══════════════════════════════════════════════════════════
const Credits = {
/**
* Проверка необходимости пропуска титров
* @param {number} cur - Текущее время
* @param {number} dur - Общая длительность
* @returns {boolean} - True если нужно пропустить
*/
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
// СТИЛИ - СОВРЕМЕННАЯ ТЕМА ОФОРМЛЕНИЯ
// ═══════════════════════════════════════════════════════════
const injectStyles = () => {
const css = `
@import url('https://fonts.googleapis.com/css2?family=Geist:wght@300;400;500;600;700&display=swap');
:root {
/* Основные цвета фона */
--wpa-bg-primary: rgba(6, 6, 8, 0.98);
--wpa-bg-secondary: rgba(10, 10, 14, 0.92);
--wpa-bg-tertiary: rgba(14, 14, 18, 0.88);
/* Матовый стеклянный слой */
--wpa-glass: rgba(10, 10, 12, 0.55);
--wpa-glass-strong: rgba(8, 8, 10, 0.8);
--wpa-glass-border: rgba(255, 40, 55, 0.25);
--wpa-glass-border-strong: rgba(255, 60, 80, 0.38);
--wpa-glass-highlight: rgba(255, 255, 255, 0.06);
/* Неоновые акценты (красный) */
--wpa-neon-cyan: #ff2d3d;
--wpa-neon-purple: #a80b23;
--wpa-neon-green: #ff4757;
--wpa-neon-pink: #ff0037;
--wpa-neon-blue: #ff3a4a;
--wpa-neon-yellow: #ff5c6c;
/* Цвета текста */
--wpa-text-primary: rgba(255, 255, 255, 0.98);
--wpa-text-secondary: rgba(255, 255, 255, 0.78);
--wpa-text-muted: rgba(255, 255, 255, 0.6);
/* Градиенты */
--wpa-gradient-1: linear-gradient(135deg, #ff2d3d, #a80b23);
--wpa-gradient-2: linear-gradient(135deg, #ff4757, #ff2d3d);
--wpa-gradient-3: linear-gradient(135deg, #a80b23, #ff0037);
--wpa-gradient-4: linear-gradient(135deg, #ff3a4a, #ff4757);
--wpa-gradient-5: linear-gradient(135deg, #ff5c6c, #ff2d3d);
/* Эффекты свечения */
--wpa-glow: 0 0 20px;
--wpa-glow-light: 0 0 10px;
--wpa-glow-subtle: 0 0 5px;
--wpa-glow-intense: 0 0 30px;
/* Радиусы скругления */
--wpa-radius-sm: 8px;
--wpa-radius-md: 12px;
--wpa-radius-lg: 16px;
--wpa-radius-xl: 24px;
--wpa-radius-full: 9999px;
/* Временные параметры анимаций */
--wpa-transition-fast: 0.2s cubic-bezier(0.4, 0, 0.2, 1);
--wpa-transition-normal: 0.3s cubic-bezier(0.4, 0, 0.2, 1);
--wpa-transition-slow: 0.5s cubic-bezier(0.4, 0, 0.2, 1);
/* Z-индексы */
--wpa-z-fab: 999999999;
--wpa-z-panel: 999999998;
--wpa-z-overlay: 999999997;
--wpa-z-toast: 999999996;
}
/* Базовые анимации */
@keyframes wpa-float {
0%, 100% { transform: translateY(0px); }
50% { transform: translateY(-5px); }
}
@keyframes wpa-glow-pulse {
0%, 100% { opacity: 0.7; }
50% { opacity: 1; }
}
@keyframes wpa-shimmer {
0% { background-position: -200% center; }
100% { background-position: 200% center; }
}
@keyframes wpa-slide-in-right {
from { transform: translateX(100%); opacity: 0; }
to { transform: translateX(0); opacity: 1; }
}
@keyframes wpa-slide-in-up {
from { transform: translateY(20px); opacity: 0; }
to { transform: translateY(0); opacity: 1; }
}
@keyframes wpa-fade-in {
from { opacity: 0; }
to { opacity: 1; }
}
@keyframes wpa-scale-in {
from { transform: scale(0.9); opacity: 0; }
to { transform: scale(1); opacity: 1; }
}
@keyframes wpa-blink {
0%, 100% { opacity: 1; }
50% { opacity: 0.5; }
}
@keyframes wpa-toast-progress {
from { transform: scaleX(1); }
to { transform: scaleX(0); }
}
/* FAB - основная плавающая кнопка */
.wpa-fab {
position: fixed !important;
bottom: 20px !important;
right: 20px !important;
z-index: var(--wpa-z-fab) !important;
width: 56px !important;
height: 56px !important;
border: none !important;
border-radius: var(--wpa-radius-full) !important;
background: var(--wpa-bg-primary) !important;
backdrop-filter: blur(20px) !important;
-webkit-backdrop-filter: blur(20px) !important;
cursor: pointer !important;
display: flex !important;
align-items: center !important;
justify-content: center !important;
box-shadow:
0 4px 30px rgba(0, 0, 0, 0.5),
0 0 0 1px rgba(255, 255, 255, 0.1),
0 0 25px rgba(255, 80, 95, 0.45) !important;
transition: all var(--wpa-transition-normal) !important;
animation: wpa-fade-in 0.5s ease-out, wpa-float 3s ease-in-out infinite !important;
overflow: visible !important;
margin: 0 !important;
padding: 0 !important;
font-family: inherit !important;
line-height: normal !important;
text-align: center !important;
text-decoration: none !important;
vertical-align: baseline !important;
white-space: nowrap !important;
user-select: none !important;
touch-action: manipulation !important;
-webkit-font-smoothing: antialiased !important;
-moz-osx-font-smoothing: grayscale !important;
opacity: 1 !important;
visibility: visible !important;
pointer-events: auto !important;
transform: translateZ(0) !important;
backface-visibility: hidden !important;
will-change: transform, opacity !important;
background: var(--wpa-gradient-1) !important;
}
.wpa-fab:hover {
transform: scale(1.15) !important;
box-shadow:
0 8px 40px rgba(0, 0, 0, 0.7),
0 0 0 1px rgba(255, 80, 95, 0.35),
0 0 50px rgba(255, 80, 95, 0.85) !important;
animation: wpa-float 2s ease-in-out infinite, wpa-glow-pulse 1.5s ease-in-out infinite !important;
}
.wpa-fab:active {
transform: scale(0.95) !important;
}
.wpa-fab__icon {
width: 24px !important;
height: 24px !important;
color: white !important;
filter: drop-shadow(0 0 8px currentColor) !important;
transition: all var(--wpa-transition-normal) !important;
position: relative !important;
z-index: 2 !important;
display: block !important;
}
.wpa-fab:hover .wpa-fab__icon {
color: var(--wpa-neon-green) !important;
filter: drop-shadow(0 0 12px currentColor) !important;
transform: rotate(15deg) !important;
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
z-index: 3 !important;
border: 2px solid var(--wpa-bg-primary) !important;
}
/* Основная панель управления */
.wpa-panel {
position: fixed !important;
top: 0 !important;
right: 0 !important;
bottom: 0 !important;
width: 420px !important;
background: var(--wpa-glass-strong) !important;
backdrop-filter: blur(28px) saturate(140%) !important;
-webkit-backdrop-filter: blur(28px) saturate(140%) !important;
border-left: 1px solid var(--wpa-glass-border) !important;
display: flex !important;
flex-direction: column !important;
transform: translateX(100%) !important;
transition: transform var(--wpa-transition-normal) !important;
z-index: var(--wpa-z-panel) !important;
box-shadow:
-12px 0 45px rgba(0, 0, 0, 0.65),
inset 0 0 40px rgba(255, 80, 95, 0.08) !important;
overflow: hidden !important;
margin: 0 !important;
padding: 0 !important;
}
.wpa-panel::before {
content: '' !important;
position: absolute !important;
inset: 0 !important;
background:
radial-gradient(700px circle at 20% 10%, rgba(255, 45, 61, 0.18), transparent 55%),
radial-gradient(900px circle at 100% 20%, rgba(255, 0, 55, 0.12), transparent 60%),
linear-gradient(180deg, rgba(255, 255, 255, 0.06), transparent 40%) !important;
pointer-events: none !important;
mix-blend-mode: screen !important;
}
.wpa-panel--open {
transform: translateX(0) !important;
animation: wpa-slide-in-right 0.3s cubic-bezier(0.4, 0, 0.2, 1) !important;
}
/* Заголовок панели */
.wpa-panel__header {
padding: 20px 24px !important;
background: var(--wpa-bg-secondary) !important;
border-bottom: 1px solid rgba(255, 255, 255, 0.1) !important;
display: flex !important;
align-items: center !important;
justify-content: space-between !important;
position: relative !important;
overflow: hidden !important;
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
letter-spacing: -0.01em !important;
}
.wpa-panel__version {
font-size: 11px !important;
color: var(--wpa-neon-cyan) !important;
font-weight: 500 !important;
opacity: 0.8 !important;
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
box-shadow: 0 0 15px rgba(255, 80, 95, 0.35) !important;
}
/* Вкладки панели */
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
transition: all var(--wpa-transition-fast) !important;
position: relative !important;
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
opacity: 0.8 !important;
}
.wpa-tab__label {
font-size: 11px !important;
font-weight: 600 !important;
letter-spacing: 0.02em !important;
}
/* Тело панели */
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
background: rgba(0, 0, 0, 0.1) !important;
border-radius: var(--wpa-radius-full) !important;
}
.wpa-panel__body::-webkit-scrollbar-thumb {
background: rgba(255, 80, 95, 0.3) !important;
border-radius: var(--wpa-radius-full) !important;
}
/* Контент вкладок */
.wpa-tab-content {
display: none !important;
}
.wpa-tab-content--active {
display: block !important;
animation: wpa-fade-in 0.3s ease-out !important;
}
/* Секции */
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
opacity: 0.8 !important;
}
.wpa-section__title {
font-family: 'Geist', sans-serif !important;
font-size: 13px !important;
font-weight: 600 !important;
color: var(--wpa-text-secondary) !important;
text-transform: uppercase !important;
letter-spacing: 0.08em !important;
}
/* Опции */
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
box-shadow:
0 10px 24px rgba(0, 0, 0, 0.35),
inset 0 1px 0 var(--wpa-glass-highlight) !important;
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
border: 1px solid rgba(255, 80, 95, 0.25) !important;
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
/* Переключатели */
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
border: 1px solid rgba(255, 255, 255, 0.1) !important;
border-radius: var(--wpa-radius-full) !important;
transition: all var(--wpa-transition-fast) !important;
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
box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2) !important;
}
.wpa-toggle__input:checked + .wpa-toggle__track {
background: rgba(255, 80, 95, 0.2) !important;
border-color: var(--wpa-neon-cyan) !important;
}
.wpa-toggle__input:checked + .wpa-toggle__track .wpa-toggle__thumb {
left: calc(100% - 22px) !important;
background: var(--wpa-neon-cyan) !important;
box-shadow:
0 0 10px var(--wpa-neon-cyan),
0 2px 4px rgba(0, 0, 0, 0.2) !important;
}
/* Быстрые действия */
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
box-shadow:
0 10px 24px rgba(0, 0, 0, 0.35),
inset 0 1px 0 var(--wpa-glass-highlight) !important;
}
.wpa-quick-action:hover {
background: var(--wpa-bg-tertiary) !important;
border-color: var(--wpa-glass-border-strong) !important;
transform: translateY(-2px) !important;
}
.wpa-quick-action--active {
background: rgba(255, 80, 95, 0.18) !important;
border-color: var(--wpa-neon-cyan) !important;
}
.wpa-quick-action__icon {
width: 20px !important;
height: 20px !important;
color: var(--wpa-neon-cyan) !important;
transition: all var(--wpa-transition-fast) !important;
}
.wpa-quick-action:hover .wpa-quick-action__icon {
transform: scale(1.1) !important;
filter: drop-shadow(0 0 8px currentColor) !important;
}
.wpa-quick-action__label {
font-size: 11px !important;
font-weight: 600 !important;
color: var(--wpa-text-secondary) !important;
text-align: center !important;
}
/* Статус */
.wpa-status {
display: flex !important;
align-items: center !important;
gap: 12px !important;
padding: 16px !important;
background: var(--wpa-glass) !important;
border: 1px solid var(--wpa-glass-border) !important;
border-radius: var(--wpa-radius-md) !important;
margin-bottom: 24px !important;
backdrop-filter: blur(18px) !important;
-webkit-backdrop-filter: blur(18px) !important;
box-shadow:
0 12px 26px rgba(0, 0, 0, 0.35),
inset 0 1px 0 var(--wpa-glass-highlight) !important;
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
font-family: 'Geist', sans-serif !important;
font-size: 14px !important;
font-weight: 600 !important;
color: var(--wpa-text-primary) !important;
}
.wpa-status__desc {
font-size: 12px !important;
color: var(--wpa-text-secondary) !important;
margin-top: 2px !important;
}
.wpa-now {
margin-bottom: 24px !important;
padding: 16px !important;
background: var(--wpa-glass) !important;
border: 1px solid var(--wpa-glass-border) !important;
border-radius: var(--wpa-radius-md) !important;
backdrop-filter: blur(18px) !important;
-webkit-backdrop-filter: blur(18px) !important;
position: relative !important;
overflow: hidden !important;
box-shadow:
0 12px 26px rgba(0, 0, 0, 0.35),
inset 0 1px 0 var(--wpa-glass-highlight) !important;
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
}
.wpa-now__row {
display: flex !important;
gap: 10px !important;
margin-bottom: 8px !important;
}
.wpa-now__chip {
flex: 1 !important;
padding: 10px 12px !important;
background: rgba(255, 80, 95, 0.15) !important;
border: 1px solid rgba(255, 80, 95, 0.25) !important;
border-radius: var(--wpa-radius-sm) !important;
font-size: 12px !important;
font-weight: 600 !important;
color: var(--wpa-text-primary) !important;
text-align: center !important;
text-shadow: 0 0 12px rgba(255, 80, 95, 0.35) !important;
}
.wpa-now__meta {
font-size: 11px !important;
color: var(--wpa-text-muted) !important;
letter-spacing: 0.02em !important;
}
/* Сегментированные контролы */
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
/* Числовые поля */
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
transition: var(--wpa-transition-fast) !important;
}
.wpa-input:focus {
border-color: var(--wpa-neon-cyan) !important;
box-shadow: 0 0 0 2px rgba(255, 80, 95, 0.35) !important;
}
/* Футер панели */
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
transition: var(--wpa-transition-fast) !important;
}
.wpa-footer-link:hover {
color: var(--wpa-neon-cyan) !important;
}
.wpa-footer-link svg {
width: 16px !important;
height: 16px !important;
}
/* Статистика */
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
box-shadow:
0 10px 24px rgba(0, 0, 0, 0.35),
inset 0 1px 0 var(--wpa-glass-highlight) !important;
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
text-shadow: 0 0 10px rgba(255, 45, 61, 0.25) !important;
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
box-shadow:
0 10px 24px rgba(0, 0, 0, 0.35),
inset 0 1px 0 var(--wpa-glass-highlight) !important;
}
.wpa-stats-last__label {
font-size: 10px !important;
letter-spacing: 0.1em !important;
text-transform: uppercase !important;
color: var(--wpa-text-muted) !important;
margin-bottom: 4px !important;
}
.wpa-stats-last__value {
font-size: 13px !important;
font-weight: 600 !important;
color: var(--wpa-text-primary) !important;
max-width: 210px !important;
white-space: nowrap !important;
overflow: hidden !important;
text-overflow: ellipsis !important;
}
.wpa-clear-history-btn {
display: inline-flex !important;
align-items: center !important;
gap: 6px !important;
padding: 6px 8px !important;
background: rgba(255, 45, 61, 0.12) !important;
border: 1px solid rgba(255, 45, 61, 0.25) !important;
border-radius: 10px !important;
color: var(--wpa-text-secondary) !important;
cursor: pointer !important;
font-family: 'Geist', sans-serif !important;
font-size: 11px !important;
font-weight: 600 !important;
transition: all var(--wpa-transition-fast) !important;
}
.wpa-clear-history-btn:hover {
color: var(--wpa-text-primary) !important;
border-color: var(--wpa-glass-border-strong) !important;
box-shadow: 0 0 12px rgba(255, 45, 61, 0.25) !important;
}
.wpa-clear-history-btn svg {
width: 12px !important;
height: 12px !important;
}
.wpa-show-list {
display: flex !important;
flex-direction: column !important;
gap: 10px !important;
}
/* Всплывающие уведомления (toasts) */
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
border: 1px solid rgba(255, 255, 255, 0.1) !important;
border-radius: var(--wpa-radius-md) !important;
box-shadow: 0 4px 15px rgba(0, 0, 0, 0.5) !important;
opacity: 0 !important;
transform: translateX(100%) !important;
transition: var(--wpa-transition-normal) !important;
position: relative !important;
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
}
.wpa-toast__content {
flex: 1 !important;
}
.wpa-toast__message {
font-family: 'Geist', sans-serif !important;
font-size: 14px !important;
color: var(--wpa-text-primary) !important;
}
.wpa-toast__close {
background: none !important;
border: none !important;
color: var(--wpa-text-muted) !important;
cursor: pointer !important;
font-size: 18px !important;
padding: 2px !important;
border-radius: var(--wpa-radius-sm) !important;
transition: var(--wpa-transition-fast) !important;
}
.wpa-toast__close:hover {
color: var(--wpa-neon-cyan) !important;
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
/* Отсчет перед следующей серией */
.wpa-next-countdown {
position: fixed !important;
right: 20px !important;
bottom: 160px !important;
z-index: var(--wpa-z-toast) !important;
background: var(--wpa-glass-strong) !important;
border: 1px solid var(--wpa-glass-border) !important;
border-radius: var(--wpa-radius-md) !important;
padding: 14px 16px !important;
min-width: 260px !important;
box-shadow: 0 12px 26px rgba(0, 0, 0, 0.35) !important;
backdrop-filter: blur(18px) !important;
-webkit-backdrop-filter: blur(18px) !important;
display: flex !important;
flex-direction: column !important;
gap: 10px !important;
animation: wpa-slide-in-up 0.25s ease-out !important;
}
.wpa-next-countdown__row {
display: flex !important;
align-items: center !important;
justify-content: space-between !important;
gap: 10px !important;
}
.wpa-next-countdown__title {
font-size: 12px !important;
font-weight: 700 !important;
letter-spacing: 0.08em !important;
text-transform: uppercase !important;
color: var(--wpa-text-secondary) !important;
}
.wpa-next-countdown__time {
font-size: 16px !important;
font-weight: 700 !important;
color: var(--wpa-text-primary) !important;
text-shadow: 0 0 10px rgba(255, 45, 61, 0.25) !important;
}
.wpa-next-countdown__progress {
height: 4px !important;
background: rgba(255, 255, 255, 0.08) !important;
border-radius: 999px !important;
overflow: hidden !important;
}
.wpa-next-countdown__bar {
height: 100% !important;
width: 100% !important;
background: var(--wpa-gradient-1) !important;
transform-origin: left !important;
transition: width 0.2s linear !important;
}
.wpa-next-countdown__cancel {
align-self: flex-end !important;
padding: 6px 10px !important;
background: rgba(255, 45, 61, 0.12) !important;
border: 1px solid rgba(255, 45, 61, 0.25) !important;
border-radius: 10px !important;
color: var(--wpa-text-secondary) !important;
cursor: pointer !important;
font-family: 'Geist', sans-serif !important;
font-size: 11px !important;
font-weight: 600 !important;
transition: all var(--wpa-transition-fast) !important;
}
.wpa-next-countdown__cancel:hover {
color: var(--wpa-text-primary) !important;
border-color: var(--wpa-glass-border-strong) !important;
box-shadow: 0 0 12px rgba(255, 45, 61, 0.25) !important;
}
/* OSD громкости */
.wpa-osd {
position: fixed !important;
top: 50% !important;
left: 50% !important;
transform: translate(-50%, -50%) scale(0.8) !important;
z-index: 999999996 !important;
display: flex !important;
align-items: center !important;
gap: 15px !important;
padding: 20px !important;
background: var(--wpa-bg-secondary) !important;
border: 1px solid rgba(255, 255, 255, 0.1) !important;
border-radius: var(--wpa-radius-xl) !important;
box-shadow: 0 8px 30px rgba(0, 0, 0, 0.5) !important;
opacity: 0 !important;
visibility: hidden !important;
transition: var(--wpa-transition-normal) !important;
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
}
.wpa-osd__bar {
flex: 1 !important;
height: 6px !important;
background: var(--wpa-bg-tertiary) !important;
border-radius: 3px !important;
overflow: hidden !important;
}
.wpa-osd__fill {
height: 100% !important;
background: var(--wpa-gradient-2) !important;
transition: width 0.2s ease-out !important;
}
.wpa-osd__value {
min-width: 40px !important;
text-align: right !important;
font-family: 'Geist', sans-serif !important;
font-size: 18px !important;
font-weight: 700 !important;
color: var(--wpa-text-primary) !important;
}
/* Модальное окно */
.wpa-modal-overlay {
position: fixed !important;
top: 0 !important;
left: 0 !important;
width: 100% !important;
height: 100% !important;
background: rgba(0, 0, 0, 0.9) !important;
backdrop-filter: blur(10px) !important;
-webkit-backdrop-filter: blur(10px) !important;
z-index: 999999995 !important;
display: flex !important;
align-items: center !important;
justify-content: center !important;
opacity: 0 !important;
visibility: hidden !important;
transition: var(--wpa-transition-normal) !important;
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
border: 1px solid rgba(255, 255, 255, 0.1) !important;
border-radius: var(--wpa-radius-xl) !important;
box-shadow: 0 10px 40px rgba(0, 0, 0, 0.5) !important;
display: flex !important;
flex-direction: column !important;
overflow: hidden !important;
transform: scale(0.9) !important;
transition: var(--wpa-transition-normal) !important;
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
font-family: 'Geist', sans-serif !important;
font-size: 18px !important;
font-weight: 700 !important;
color: var(--wpa-text-primary) !important;
}
.wpa-modal__close {
background: none !important;
border: none !important;
color: var(--wpa-text-secondary) !important;
cursor: pointer !important;
font-size: 24px !important;
padding: 5px !important;
border-radius: var(--wpa-radius-sm) !important;
transition: var(--wpa-transition-fast) !important;
}
.wpa-modal__close:hover {
color: var(--wpa-neon-cyan) !important;
}
.wpa-modal__body {
flex: 1 !important;
overflow-y: auto !important;
padding: 20px !important;
}
/* Карточки сериалов */
.wpa-show-card {
display: flex !important;
align-items: center !important;
gap: 15px !important;
padding: 15px !important;
background: var(--wpa-bg-secondary) !important;
border: 1px solid rgba(255, 255, 255, 0.1) !important;
border-radius: var(--wpa-radius-md) !important;
margin-bottom: 10px !important;
cursor: pointer !important;
transition: var(--wpa-transition-fast) !important;
}
.wpa-show-card:hover {
background: var(--wpa-bg-tertiary) !important;
border-color: rgba(255, 80, 95, 0.35) !important;
transform: translateX(5px) !important;
}
.wpa-show-card__icon {
width: 40px !important;
height: 40px !important;
background: var(--wpa-gradient-1) !important;
border-radius: var(--wpa-radius-sm) !important;
display: flex !important;
align-items: center !important;
justify-content: center !important;
}
.wpa-show-card__icon svg {
width: 20px !important;
height: 20px !important;
color: white !important;
}
.wpa-show-card__content {
flex: 1 !important;
}
.wpa-show-card__name {
font-family: 'Geist', sans-serif !important;
font-size: 15px !important;
font-weight: 600 !important;
color: var(--wpa-text-primary) !important;
margin-bottom: 3px !important;
}
.wpa-show-card__meta {
font-size: 13px !important;
color: var(--wpa-text-secondary) !important;
}
.wpa-show-card__arrow {
color: var(--wpa-text-muted) !important;
}
/* Пустое состояние */
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
font-family: 'Geist', sans-serif !important;
font-size: 15px !important;
color: var(--wpa-text-secondary) !important;
}
/* Адаптивность */
@media (max-width: 768px) {
.wpa-panel {
width: 100% !important;
max-width: 100% !important;
}
.wpa-fab {
bottom: 15px !important;
right: 15px !important;
width: 52px !important;
height: 52px !important;
}
.wpa-quick-actions {
grid-template-columns: repeat(2, 1fr) !important;
}
.wpa-stats-grid {
grid-template-columns: repeat(2, 1fr) !important;
}
}
@media (max-width: 480px) {
.wpa-panel__body {
padding: 20px 16px !important;
}
.wpa-option {
padding: 14px !important;
gap: 12px !important;
}
.wpa-quick-actions {
grid-template-columns: 1fr !important;
}
.wpa-stats-grid {
grid-template-columns: 1fr !important;
}
}
/* Дополнительные гарантии видимости */
body .wpa-fab {
display: flex !important;
visibility: visible !important;
opacity: 1 !important;
}
/* Переопределение возможных стилей сайта */
*:has(> .wpa-fab) {
position: static !important;
}
/* Убедимся, что FAB всегда на верху */
iframe body .wpa-fab,
#moviePlayer body .wpa-fab,
div body .wpa-fab {
z-index: 999999999 !important;
position: fixed !important;
}
/* Важно: !important на всех критических свойствах FAB */
.wpa-fab,
.wpa-fab * {
box-sizing: border-box !important;
font-family: 'Geist', sans-serif !important;
}
/* Гарантируем, что кнопка не скроется */
.wpa-fab[hidden],
.wpa-fab[style*="display: none"],
.wpa-fab[style*="visibility: hidden"] {
display: flex !important;
visibility: visible !important;
opacity: 1 !important;
}
`;
const style = document.createElement('style');
style.id = 'wpa-styles';
style.textContent = css;
document.head.appendChild(style);
State.cleanup.push(() => style.remove());
};
// ═══════════════════════════════════════════════════════════
// УПРАВЛЕНИЕ ИНТЕРФЕЙСОМ
// ═══════════════════════════════════════════════════════════
const Panel = {
elements: {},
cleanupFunctions: [],
/**
* Форматирование числа с падежами
* @param {number} number - Число
* @param {Array} titles - Массив форм слов [один, два, пять]
* @returns {string} - Отформатированное число с падежом
*/
formatNumber(number, titles) {
const cases = [2, 0, 1, 1, 1, 2];
return titles[(number % 100 > 4 && number % 100 < 20) ? 2 : cases[(number % 10 < 5) ? number % 10 : 5]];
},
/**
* Создание интерфейса
*/
create() {
if (!State.settings.showPanel || !IS_TOP) return;
// Check if elements already exist in DOM to prevent duplication
const fabs = Array.from(document.querySelectorAll('.wpa-fab'));
const panels = Array.from(document.querySelectorAll('.wpa-panel'));
const overlays = Array.from(document.querySelectorAll('.wpa-panel-overlay'));
const primaryFab = fabs.find(f => f.classList.contains('wpa-fab--open')) || fabs[0] || null;
const primaryPanel = panels[0] || null;
const primaryOverlay = overlays[0] || null;
fabs.forEach(f => { if (f !== primaryFab) f.remove(); });
panels.forEach(p => { if (p !== primaryPanel) p.remove(); });
overlays.forEach(o => { if (o !== primaryOverlay) o.remove(); });
// If elements already exist, just update them
if (primaryFab && primaryPanel) {
// Проверяем, связаны ли элементы с нашим экземпляром
if (!this.elements.fab || !this.elements.panel) {
// Если элементы существуют, но не связаны с нашим экземпляром, связываем их
this.elements.fab = primaryFab;
this.elements.panel = primaryPanel;
this.elements.overlay = primaryOverlay;
// Привязываем события заново
this.bindEvents();
}
this.updateLiveUI();
return;
}
this.cleanupFunctions.forEach(fn => fn());
this.cleanupFunctions = [];
// Remove ALL existing - удаляем все экземпляры элементов, чтобы избежать дублирования
document.querySelectorAll('.wpa-fab, .wpa-panel, .wpa-panel-overlay').forEach(el => el.remove());
this.createFAB();
this.createPanel();
this.bindEvents();
this.updateLiveUI();
},
/**
* Создание FAB кнопки
*/
createFAB() {
// Проверяем, существует ли уже кнопка в DOM
const existingFab = document.querySelector('.wpa-fab');
if (existingFab) {
// Если кнопка уже существует, используем её
this.elements.fab = existingFab;
return;
}
const fab = document.createElement('button');
fab.className = 'wpa-fab';
fab.innerHTML = `
<span class="wpa-fab__icon">${Icons.zap}</span>
${State.settings.autoNext ? '<span class="wpa-fab__badge">✓</span>' : ''}
`;
document.body.appendChild(fab);
this.elements.fab = fab;
},
/**
* Создание основной панели
*/
createPanel() {
// Overlay
const overlay = document.createElement('div');
overlay.className = 'wpa-panel-overlay';
document.body.appendChild(overlay);
this.elements.overlay = overlay;
// Panel
const panel = document.createElement('div');
panel.className = 'wpa-panel';
panel.innerHTML = this.getPanelHTML();
document.body.appendChild(panel);
this.elements.panel = panel;
},
/**
* Получение HTML панели
* @returns {string} - HTML панели
*/
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
<button class="wpa-panel__close" data-action="close">
${Icons.x}
</button>
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
<a href="https://github.com/DdepRest/wparty-auto-redesign" target="_blank" class="wpa-footer-link">
${Icons.github}
<span>GitHub</span>
</a>
<a href="https://github.com/DdepRest/wparty-auto-redesign/issues" target="_blank" class="wpa-footer-link">
${Icons.externalLink}
<span>Поддержка</span>
</a>
</div>
`;
},
/**
* Получение HTML вкладки автоматики
* @param {Object} s - Настройки
* @returns {string} - HTML вкладки
*/
getAutoTabHTML(s) {
const totals = (typeof MainMode !== 'undefined' && MainMode.getSeasonEpisodeTotals)
? MainMode.getSeasonEpisodeTotals()
: {};
const seasonTotal = totals.seasonTotal;
const episodeTotal = totals.episodeTotal;
const seasonCurrent = totals.seasonCurrent;
const episodeCurrent = totals.episodeCurrent;
const seasonTotalLabel = Number.isFinite(seasonTotal) && seasonTotal > 0 ? seasonTotal : '—';
const episodeTotalLabel = Number.isFinite(episodeTotal) && episodeTotal > 0 ? episodeTotal : '—';
const seasonCurrentLabel = Number.isFinite(seasonCurrent) && seasonCurrent > 0 ? seasonCurrent : '—';
const episodeCurrentLabel = Number.isFinite(episodeCurrent) && episodeCurrent > 0 ? episodeCurrent : '—';
return `
<div class="wpa-tab-content ${State.activeTab === 'auto' ? 'wpa-tab-content--active' : ''}" data-content="auto">
<div class="wpa-status ${s.autoNext ? 'wpa-status--active' : ''}">
<div class="wpa-status__dot"></div>
<div class="wpa-status__text">
<div class="wpa-status__title">${s.autoNext ? 'Автоматика активна' : 'Автоматика выключена'}</div>
<div class="wpa-status__desc">${s.autoNext ? 'Серии переключаются автоматически' : 'Включите автопереключение для работы'}</div>
</div>
</div>
<div class="wpa-now" data-now="container">
<div class="wpa-now__title">Сейчас в плеере</div>
<div class="wpa-now__row">
<div class="wpa-now__chip" data-now="season">Сезон ${seasonCurrentLabel} из ${seasonTotalLabel}</div>
<div class="wpa-now__chip" data-now="episode">Серия ${episodeCurrentLabel} из ${episodeTotalLabel}</div>
</div>
<div class="wpa-now__meta" data-now="total">Всего сезонов: ${seasonTotalLabel} • Всего серий: ${episodeTotalLabel}</div>
</div>
<div class="wpa-quick-actions">
<div class="wpa-quick-action ${s.autoNext ? 'wpa-quick-action--active' : ''}" data-quick="autoNext">
<div class="wpa-quick-action__icon">${Icons.skipForward}</div>
<div class="wpa-quick-action__label">Авто-серия</div>
</div>
<div class="wpa-quick-action ${s.skipCredits ? 'wpa-quick-action--active' : ''}" data-quick="skipCredits">
<div class="wpa-quick-action__icon">${Icons.clock}</div>
<div class="wpa-quick-action__label">Пропуск титров</div>
</div>
<div class="wpa-quick-action" data-quick="history">
<div class="wpa-quick-action__icon">${Icons.list}</div>
<div class="wpa-quick-action__label">История</div>
</div>
</div>
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
<div class="wpa-toggle__track">
<div class="wpa-toggle__thumb"></div>
</div>
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
<div class="wpa-toggle__track">
<div class="wpa-toggle__thumb"></div>
</div>
</label>
</div>
</div>
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
<div class="wpa-toggle__track">
<div class="wpa-toggle__thumb"></div>
</div>
</label>
</div>
<div data-live="skipCreditsExtra"></div>
</div>
<div class="wpa-section">
<div class="wpa-section__header">
<div class="wpa-section__icon">${Icons.volume}</div>
<div class="wpa-section__title">Громкость</div>
</div>
<div class="wpa-option">
<div class="wpa-option__icon">${Icons.volume}</div>
<div class="wpa-option__content">
<div class="wpa-option__title">Сохранение громкости</div>
<div class="wpa-option__desc">Запоминать уровень между сериями</div>
</div>
<label class="wpa-toggle">
<input type="checkbox" class="wpa-toggle__input" data-option="volumeControl" ${s.volumeControl ? 'checked' : ''}>
<div class="wpa-toggle__track">
<div class="wpa-toggle__thumb"></div>
</div>
</label>
</div>
<div data-live="volumeExtra"></div>
</div>
</div>
`;
},
/**
* Получение HTML вкладки статистики
* @returns {string} - HTML вкладки
*/
getStatsTabHTML() {
const history = Storage.getWatchHistory();
const lastShow = Object.values(history).sort((a, b) => b.timestamp - a.timestamp)[0];
const totals = (typeof MainMode !== 'undefined' && MainMode.getSeasonEpisodeTotals)
? MainMode.getSeasonEpisodeTotals()
: {};
const seasonTotal = totals.seasonTotal;
const episodeTotal = totals.episodeTotal;
const seasonCurrent = totals.seasonCurrent;
const seasonTotalLabel = Number.isFinite(seasonTotal) && seasonTotal > 0 ? seasonTotal : '—';
const episodeTotalLabel = Number.isFinite(episodeTotal) && episodeTotal > 0 ? episodeTotal : '—';
const seasonCurrentLabel = Number.isFinite(seasonCurrent) && seasonCurrent > 0 ? seasonCurrent : '—';
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
<div class="wpa-stat-card__value">${seasonTotalLabel}</div>
</div>
<div class="wpa-stat-card" data-live="stat-season">
<div class="wpa-stat-card__label">Сезон сейчас</div>
<div class="wpa-stat-card__value">${seasonCurrentLabel}</div>
</div>
<div class="wpa-stat-card" data-live="stat-episodes">
<div class="wpa-stat-card__label">Серий в сезоне</div>
<div class="wpa-stat-card__value">${episodeTotalLabel}</div>
</div>
</div>
<div class="wpa-stats-bar">
<div class="wpa-stats-last">
<div class="wpa-stats-last__label">Последний просмотр</div>
<div class="wpa-stats-last__value" data-live="stat-last">${lastShow ? lastShow.name : 'Нет данных'}</div>
</div>
<button class="wpa-clear-history-btn" type="button">
${Icons.x} Очистить
</button>
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
<div class="wpa-show-card__meta">Сезон ${this.formatNumber(show.season, ['сезон', 'сезона', 'сезонов'])}, ${this.formatNumber(show.episode, ['серия', 'серии', 'серий'])}</div>
</div>
<div class="wpa-show-card__arrow">${Icons.chevronRight}</div>
</div>
`).join('')}
</div>
</div>
</div>
`;
},
/**
* Получение HTML вкладки настроек
* @param {Object} s - Настройки
* @returns {string} - HTML вкладки
*/
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
<div class="wpa-toggle__track">
<div class="wpa-toggle__thumb"></div>
</div>
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
<div class="wpa-toggle__track">
<div class="wpa-toggle__thumb"></div>
</div>
</label>
</div>
<div class="wpa-option">
<div class="wpa-option__icon">${Icons.volume}</div>
<div class="wpa-option__content">
<div class="wpa-option__title">Компрессор звука</div>
<div class="wpa-option__desc">Выравнивание громкости, уменьшение перепадов</div>
</div>
<label class="wpa-toggle">
<input type="checkbox" class="wpa-toggle__input" data-option="compressor" ${s.compressor ? 'checked' : ''}>
<div class="wpa-toggle__track">
<div class="wpa-toggle__thumb"></div>
</div>
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
</div>
`;
},
/**
* Переключение видимости панели
* @param {boolean} open - Открыть или закрыть
*/
toggle(open = null) {
const shouldOpen = open !== null ? open : !State.panelOpen;
State.panelOpen = shouldOpen;
this.elements.panel?.classList.toggle('wpa-panel--open', shouldOpen);
this.elements.overlay?.classList.toggle('wpa-panel-overlay--visible', shouldOpen);
this.elements.fab?.classList.toggle('wpa-fab--open', shouldOpen);
},
/**
* Привязка событий
*/
bindEvents() {
// Сначала очищаем старые функции очистки, чтобы избежать дублирования обработчиков
this.cleanupFunctions.forEach(fn => fn());
this.cleanupFunctions = [];
const { fab, overlay, panel } = this.elements;
// FAB click
if (fab) {
const handleFab = () => this.toggle();
fab.addEventListener('click', handleFab);
this.cleanupFunctions.push(() => fab.removeEventListener('click', handleFab));
}
// Overlay click - only close when clicking directly on overlay, not on panel
if (overlay) {
const handleOverlay = (e) => {
// Check if the click target is the overlay itself, not a child element
if (e.target === overlay) {
this.toggle(false);
}
};
overlay.addEventListener('click', handleOverlay);
this.cleanupFunctions.push(() => overlay.removeEventListener('click', handleOverlay));
}
// Close button
const closeBtn = panel?.querySelector('[data-action="close"]');
if (closeBtn) {
const handleClose = () => this.toggle(false);
closeBtn.addEventListener('click', handleClose);
this.cleanupFunctions.push(() => closeBtn.removeEventListener('click', handleClose));
}
// Tabs
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
// ESC key
const handleEsc = (e) => {
if (e.key === 'Escape' && State.panelOpen) {
this.toggle(false);
}
};
document.addEventListener('keydown', handleEsc);
this.cleanupFunctions.push(() => document.removeEventListener('keydown', handleEsc));
this.startLiveObserver();
},
/**
* Запуск live-обновления UI через MutationObserver
*/
startLiveObserver() {
if (!IS_TOP) return;
if (State.ui.liveObserver?.observer) return;
const onChange = Utils.throttle(() => {
this.updateLiveUI();
}, 200);
const observer = new MutationObserver((mutations) => {
let shouldUpdate = false;
for (const m of mutations) {
const target = m.target;
if (target && target.closest && target.closest('.wpa-panel')) continue;
if (target && target.closest) {
if (target.closest('div[name="season"], div[name="episode"], #moviePlayer, iframe.videoContent, h1, .title')) {
shouldUpdate = true;
break;
}
}
if (m.type === 'attributes' && m.attributeName === 'title') {
shouldUpdate = true;
break;
}
if (m.addedNodes && m.addedNodes.length) {
for (const n of m.addedNodes) {
if (n.nodeType !== 1) continue;
if (n.matches?.('div[name="season"], div[name="episode"], #moviePlayer, iframe.videoContent, h1, .title')) {
shouldUpdate = true;
break;
}
if (n.querySelector?.('div[name="season"], div[name="episode"], #moviePlayer, iframe.videoContent, h1, .title')) {
shouldUpdate = true;
break;
}
}
if (shouldUpdate) break;
}
}
// If UI disappeared, restore it on any relevant mutation
if (State.settings.showPanel) {
const hasFab = !!document.querySelector('.wpa-fab');
const hasPanel = !!document.querySelector('.wpa-panel');
if (!hasFab || !hasPanel) {
this.create();
return;
}
}
if (shouldUpdate) onChange();
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
/**
* Привязка динамических контролов (без дубликатов)
* @param {Element} panel - Панель
*/
bindLiveControls(panel) {
if (!panel) return;
// Quick actions
panel.querySelectorAll('.wpa-quick-action').forEach(action => {
if (action.dataset.bound === '1') return;
action.dataset.bound = '1';
const handleAction = () => {
const key = action.dataset.quick;
if (key === 'history') {
this.showWatchList();
} else if (key === 'autoNext' || key === 'skipCredits') {
const newValue = !State.settings[key];
Storage.saveSettings({ [key]: newValue });
this.updateLiveUI();
}
};
action.addEventListener('click', handleAction);
this.cleanupFunctions.push(() => action.removeEventListener('click', handleAction));
});
// Segments
panel.querySelectorAll('.wpa-segment').forEach(seg => {
if (seg.dataset.bound === '1') return;
seg.dataset.bound = '1';
const handleSeg = () => {
Storage.saveSettings({ skipMode: seg.dataset.mode });
this.updateLiveUI();
};
seg.addEventListener('click', handleSeg);
this.cleanupFunctions.push(() => seg.removeEventListener('click', handleSeg));
});
// Toggles
panel.querySelectorAll('[data-option]').forEach(input => {
if (input.dataset.bound === '1') return;
input.dataset.bound = '1';
const handleChange = (e) => {
const key = input.dataset.option;
Storage.saveSettings({ [key]: e.target.checked });
if (key === 'volumeControl' && e.target.checked) {
Volume.hookControls();
setTimeout(() => Volume.apply(), 500);
}
if (key === 'compressor') {
AudioCompressor.toggle();
}
if (['skipCredits', 'volumeControl', 'compressor'].includes(key)) {
this.updateLiveUI();
}
};
input.addEventListener('change', handleChange);
this.cleanupFunctions.push(() => input.removeEventListener('change', handleChange));
});
// Number inputs
panel.querySelectorAll('[data-input]').forEach(input => {
if (input.dataset.bound === '1') return;
input.dataset.bound = '1';
const handleInput = Utils.debounce((e) => {
const key = State.settings.skipMode === 'percent' ? 'skipPercent' : 'skipSeconds';
const value = parseInt(e.target.value);
if (!isNaN(value)) {
Storage.saveSettings({ [key]: value });
}
}, CONFIG.debounce.input);
input.addEventListener('change', handleInput);
this.cleanupFunctions.push(() => input.removeEventListener('change', handleInput));
});
// Clear history button
panel.querySelectorAll('.wpa-clear-history-btn').forEach(clearBtn => {
if (clearBtn.dataset.bound === '1') return;
clearBtn.dataset.bound = '1';
const handleClear = () => {
if (confirm('Вы уверены, что хотите очистить всю историю просмотров?')) {
Storage.clearWatchHistory();
Notifications.show('История просмотров очищена', 'success', 3000);
this.updateLiveUI();
}
};
clearBtn.addEventListener('click', handleClear);
this.cleanupFunctions.push(() => clearBtn.removeEventListener('click', handleClear));
});
},
/**
* Обновление всего UI без пересоздания панели
*/
updateLiveUI() {
if (!IS_TOP) return;
const panel = this.elements.panel;
const fab = this.elements.fab;
if (State.settings.showPanel && (!panel || !fab)) {
this.create();
return;
}
if (!panel) return;
Storage.refreshCurrentShowName();
// Status
const status = panel.querySelector('.wpa-status');
const statusTitle = panel.querySelector('.wpa-status__title');
const statusDesc = panel.querySelector('.wpa-status__desc');
if (status) status.classList.toggle('wpa-status--active', !!State.settings.autoNext);
if (statusTitle) statusTitle.textContent = State.settings.autoNext ? 'Автоматика активна' : 'Автоматика выключена';
if (statusDesc) statusDesc.textContent = State.settings.autoNext
? 'Серии переключаются автоматически'
: 'Включите автопереключение для работы';
// FAB badge - обновляем значок на существующей кнопке
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
// Quick actions active state
panel.querySelectorAll('.wpa-quick-action').forEach(action => {
const key = action.dataset.quick;
if (key === 'autoNext' || key === 'skipCredits') {
action.classList.toggle('wpa-quick-action--active', !!State.settings[key]);
}
});
// Toggles state
panel.querySelectorAll('[data-option]').forEach(input => {
const key = input.dataset.option;
if (typeof State.settings[key] !== 'undefined') {
input.checked = !!State.settings[key];
}
});
// Segments
panel.querySelectorAll('.wpa-segment').forEach(seg => {
seg.classList.toggle('wpa-segment--active', seg.dataset.mode === State.settings.skipMode);
});
// Skip credits extra block
const skipContainer = panel.querySelector('[data-live="skipCreditsExtra"]');
if (skipContainer) {
const shouldShow = !!State.settings.skipCredits;
const isShown = skipContainer.childElementCount > 0;
if (shouldShow && !isShown) {
skipContainer.innerHTML = this.renderSkipCreditsExtra(State.settings);
} else if (!shouldShow && isShown) {
skipContainer.innerHTML = '';
} else if (shouldShow && isShown) {
// Update mode visuals without rebuilding
skipContainer.querySelectorAll('.wpa-segment').forEach(seg => {
seg.classList.toggle('wpa-segment--active', seg.dataset.mode === State.settings.skipMode);
});
const icon = skipContainer.querySelector('.wpa-option__icon');
const title = skipContainer.querySelector('.wpa-option__title');
const desc = skipContainer.querySelector('.wpa-option__desc');
if (icon) icon.innerHTML = State.settings.skipMode === 'percent' ? Icons.percent : Icons.clock;
if (title) title.textContent = State.settings.skipMode === 'percent' ? 'Процент просмотра' : 'Секунд до конца';
if (desc) desc.textContent = State.settings.skipMode === 'percent' ? 'От 50% до 99%' : 'От 10 до 300 сек';
const input = skipContainer.querySelector('[data-input="skipValue"]');
if (input && document.activeElement !== input) {
input.value = State.settings.skipMode === 'percent' ? State.settings.skipPercent : State.settings.skipSeconds;
input.min = State.settings.skipMode === 'percent' ? 50 : 10;
input.max = State.settings.skipMode === 'percent' ? 99 : 300;
}
}
}
// Volume extra block
const volumeContainer = panel.querySelector('[data-live="volumeExtra"]');
if (volumeContainer) {
const shouldShow = !!State.settings.volumeControl;
const isShown = volumeContainer.childElementCount > 0;
if (shouldShow && !isShown) {
volumeContainer.innerHTML = this.renderVolumeExtra(State.settings);
} else if (!shouldShow && isShown) {
volumeContainer.innerHTML = '';
}
}
// Now stats
this.updateNowStats(panel);
// Stats tab
this.updateStatsUI(panel);
// Re-bind any newly injected controls
this.bindLiveControls(panel);
},
/**
* Обновление блока "Сейчас в плеере"
*/
updateNowStats(panel) {
const container = panel.querySelector('[data-now="container"]');
if (!container) return;
const totals = (typeof MainMode !== 'undefined' && MainMode.getSeasonEpisodeTotals)
? MainMode.getSeasonEpisodeTotals()
: {};
const seasonTotal = totals.seasonTotal;
const episodeTotal = totals.episodeTotal;
const seasonCurrent = totals.seasonCurrent;
const episodeCurrent = totals.episodeCurrent;
const seasonTotalLabel = Number.isFinite(seasonTotal) && seasonTotal > 0 ? seasonTotal : '—';
const episodeTotalLabel = Number.isFinite(episodeTotal) && episodeTotal > 0 ? episodeTotal : '—';
const seasonCurrentLabel = Number.isFinite(seasonCurrent) && seasonCurrent > 0 ? seasonCurrent : '—';
const episodeCurrentLabel = Number.isFinite(episodeCurrent) && episodeCurrent > 0 ? episodeCurrent : '—';
const seasonEl = container.querySelector('[data-now="season"]');
const episodeEl = container.querySelector('[data-now="episode"]');
const totalEl = container.querySelector('[data-now="total"]');
if (seasonEl) seasonEl.textContent = `Сезон ${seasonCurrentLabel} из ${seasonTotalLabel}`;
if (episodeEl) episodeEl.textContent = `Серия ${episodeCurrentLabel} из ${episodeTotalLabel}`;
if (totalEl) totalEl.textContent = `Всего сезонов: ${seasonTotalLabel} • Всего серий: ${episodeTotalLabel}`;
},
/**
* Обновление статистики без пересоздания панели
*/
updateStatsUI(panel) {
const statsTab = panel.querySelector('[data-content="stats"]');
if (!statsTab) return;
const history = Storage.getWatchHistory();
const lastShow = Object.values(history).sort((a, b) => b.timestamp - a.timestamp)[0];
const totals = (typeof MainMode !== 'undefined' && MainMode.getSeasonEpisodeTotals)
? MainMode.getSeasonEpisodeTotals()
: {};
const seasonTotal = totals.seasonTotal;
const episodeTotal = totals.episodeTotal;
const seasonCurrent = totals.seasonCurrent;
const seasonTotalLabel = Number.isFinite(seasonTotal) && seasonTotal > 0 ? seasonTotal : '—';
const episodeTotalLabel = Number.isFinite(episodeTotal) && episodeTotal > 0 ? episodeTotal : '—';
const seasonCurrentLabel = Number.isFinite(seasonCurrent) && seasonCurrent > 0 ? seasonCurrent : '—';
const showsEl = statsTab.querySelector('[data-live="stat-seasons"] .wpa-stat-card__value');
const seasonEl = statsTab.querySelector('[data-live="stat-season"] .wpa-stat-card__value');
const episodesEl = statsTab.querySelector('[data-live="stat-episodes"] .wpa-stat-card__value');
const lastEl = statsTab.querySelector('[data-live="stat-last"]');
if (showsEl) showsEl.textContent = `${seasonTotalLabel}`;
if (seasonEl) seasonEl.textContent = `${seasonCurrentLabel}`;
if (episodesEl) episodesEl.textContent = `${episodeTotalLabel}`;
if (lastEl) lastEl.textContent = lastShow ? lastShow.name : 'Нет данных';
const signature = this.getHistorySignature(history);
if (State.ui.historySignature !== signature) {
State.ui.historySignature = signature;
const listEl = statsTab.querySelector('[data-live="history-list"]');
if (listEl) {
listEl.innerHTML = this.renderHistoryList(history);
}
}
},
/**
* Рендер дополнительных блоков
*/
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
<input type="number" class="wpa-input" data-input="skipValue"
value="${s.skipMode === 'percent' ? s.skipPercent : s.skipSeconds}"
min="${s.skipMode === 'percent' ? 50 : 10}"
max="${s.skipMode === 'percent' ? 99 : 300}">
</div>
`;
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
<div class="wpa-toggle__track">
<div class="wpa-toggle__thumb"></div>
</div>
</label>
</div>
`;
},
renderHistoryList(history) {
const entries = Object.entries(history)
.sort((a, b) => (b[1]?.timestamp || 0) - (a[1]?.timestamp || 0));
if (entries.length === 0) {
return `
<div class="wpa-empty">
<div class="wpa-empty__icon">${Icons.tv}</div>
<div class="wpa-empty__text">История просмотров пуста</div>
</div>
`;
}
return entries.map(([id, show]) => `
<div class="wpa-show-card" data-url="${show.url || ''}">
<div class="wpa-show-card__icon">${Icons.tv}</div>
<div class="wpa-show-card__content">
<div class="wpa-show-card__name">${show.name || 'Неизвестный сериал'}</div>
<div class="wpa-show-card__meta">Сезон ${this.formatNumber(show.season, ['сезон', 'сезона', 'сезонов'])}, ${this.formatNumber(show.episode, ['серия', 'серии', 'серий'])}</div>
</div>
<div class="wpa-show-card__arrow">${Icons.chevronRight}</div>
</div>
`).join('');
},
getHistorySignature(history) {
return Object.entries(history)
.map(([id, s]) => `${id}:${s.name}:${s.season}:${s.episode}:${s.timestamp}`)
.join('|');
},
/**
* Показать список просмотров
*/
showWatchList() {
if (State.showListOpen) return;
const history = Storage.getWatchHistory();
const shows = Object.entries(history)
.map(([id, d]) => ({ id, ...d }))
.sort((a, b) => b.timestamp - a.timestamp);
const overlay = document.createElement('div');
overlay.className = 'wpa-modal-overlay';
overlay.innerHTML = `
<div class="wpa-modal">
<div class="wpa-modal__header">
<div class="wpa-modal__header-content">
<span class="wpa-modal__title">История просмотров</span>
<button class="wpa-modal__close">${Icons.x}</button>
</div>
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
</div>
`;
document.body.appendChild(overlay);
State.showListOpen = true;
requestAnimationFrame(() => overlay.classList.add('wpa-modal-overlay--visible'));
const close = () => {
overlay.classList.remove('wpa-modal-overlay--visible');
setTimeout(() => {
overlay.remove();
State.showListOpen = false;
}, 300);
};
overlay.querySelector('.wpa-modal__close')?.addEventListener('click', close);
overlay.addEventListener('click', (e) => {
if (e.target === overlay) close();
});
overlay.querySelectorAll('.wpa-show-card').forEach(card => {
card.addEventListener('click', () => {
const url = card.dataset.url;
if (url) window.location.href = url;
});
});
}
};
// ═══════════════════════════════════════════════════════════
// РЕЖИМ ПЛЕЕРА
// ═══════════════════════════════════════════════════════════
const PlayerMode = {
/**
* Получение прогресса воспроизведения
* @returns {Object|null} - Объект с текущим и максимальным значением
*/
getProgress() {
const seek = DOM.seekSlider();
if (!seek) return null;
const cur = parseFloat(seek.getAttribute('aria-valuenow'));
const max = parseFloat(seek.getAttribute('aria-valuemax'));
if (isNaN(cur) || isNaN(max) || max <= 0) return null;
return { cur, max };
},
/**
* Отправка сообщения родительскому окну
* @param {number|null} remaining - Оставшееся время
*/
notifyParent(remaining = null) {
try {
window.parent.postMessage({
type: 'WPARTY_NEXT_EPISODE',
remaining
}, '*');
} catch (e) {
Logger.error(`Ошибка отправки сообщения родителю: ${e.message}`);
}
},
/**
* Запуск режима плеера
*/
run() {
Logger.info('Режим ПЛЕЕРА (iframe)');
if (State.settings.showPanel && IS_TOP) {
Panel.create();
}
State.intervals.progress = setInterval(() => {
const prog = this.getProgress();
if (!prog || State.hasTriggered) return;
const video = DOM.video();
if (!video || !video.duration) return;
if (Credits.shouldSkip(video.currentTime, video.duration)) {
State.hasTriggered = true;
Logger.success('Пропуск титров активирован!');
this.notifyParent(video.duration - video.currentTime);
setTimeout(() => {
State.hasTriggered = false;
}, CONFIG.timeouts.nextEpisode);
}
}, CONFIG.intervals.check);
if (State.settings.volumeControl) {
setTimeout(() => {
Volume.hookControls();
Volume.apply(true);
// Включить компрессор если нужен
if (State.settings.compressor && !AudioCompressor.sourceNode) {
AudioCompressor.enable();
} else if (State.settings.compressor && AudioCompressor.sourceNode) {
// Если компрессор включен, но источник изменился, переподключаем
const currentVideo = DOM.video();
if (currentVideo && AudioCompressor.sourceNode.mediaElement !== currentVideo) {
AudioCompressor.disable();  // Сначала отключаем старый
AudioCompressor.enable();   // Затем подключаем к новому видео
}
}
}, CONFIG.timeouts.volumeInitial);
setTimeout(() => Volume.apply(false), CONFIG.timeouts.volumeRetry);
}
Logger.success('Мониторинг плеера запущен');
}
};
// ═══════════════════════════════════════════════════════════
// РЕЖИМ ОСНОВНОЙ СТРАНИЦЫ
// ═══════════════════════════════════════════════════════════
const MainMode = {
/**
* Запуск обратного отсчета перед следующей серией
* @param {number} seconds - Длительность в секундах
* @param {Function} onComplete - Функция по завершению
*/
startNextCountdown(seconds, onComplete) {
if (!State.settings.autoNext) return;
// Очистить предыдущий отсчет
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
<div class="wpa-next-countdown__progress">
<div class="wpa-next-countdown__bar"></div>
</div>
<button class="wpa-next-countdown__cancel" type="button">Отмена</button>
`;
document.body.appendChild(box);
const timeEl = box.querySelector('.wpa-next-countdown__time');
const barEl = box.querySelector('.wpa-next-countdown__bar');
const cancelBtn = box.querySelector('.wpa-next-countdown__cancel');
const updateBar = () => {
const pct = (remaining / total) * 100;
if (barEl) barEl.style.width = `${pct}%`;
};
updateBar();
const cancel = () => {
clearInterval(State.ui.nextCountdown?.timer);
State.ui.nextCountdown = null;
box.remove();
Notifications.show('Автопереход отменён', 'info', 2000);
};
cancelBtn?.addEventListener('click', cancel);
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
/**
* Получение общего количества сезонов/серий и текущих значений
* @returns {Object} - Объект с total/current по сезонам и сериям
*/
getSeasonEpisodeTotals() {
let seasonTotal = null;
let episodeTotal = null;
let seasonCurrent = null;
let episodeCurrent = null;
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
/**
* Получение текущего сезона и серии
* @returns {Object} - Объект с номерами сезона и серии
*/
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
/**
* Получение информации о сериях
* @returns {Object|null} - Объект с информацией о сериях
*/
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
/**
* Переключение на следующую серию
* @returns {Promise<boolean>} - Promise с результатом переключения
*/
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
// Попробуем переключить сезон
const seasonDrop = DOM.select('div[name="season"]', false);
if (seasonDrop) {
const menu = seasonDrop.querySelector('.menu');
if (menu) {
const all = [...menu.querySelectorAll('.item')];
const cur = menu.querySelector('.item.active.selected');
if (cur) {
const idx = all.indexOf(cur);
if (idx >= 0 && idx < all.length - 1) {
// Есть следующий сезон
seasonDrop.click();
setTimeout(() => {
all[idx + 1].click();
Notifications.show('🎬 Переключаюсь на следующий сезон...', 'success', 4000);
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
/**
* Запуск основного режима
*/
run() {
Logger.info('Режим ОСНОВНОЙ СТРАНИЦЫ');
State.currentShowId = Storage.getShowId();
const handleMessage = (e) => {
if (!Utils.isTrustedOrigin(e.origin)) {
Logger.warn(`Недоверенный origin: ${e.origin}`);
return;
}
if (!Utils.validateMessage(e.data)) return;
if (e.data.type === 'WPARTY_NEXT_EPISODE') {
Logger.info('Получен сигнал переключения на следующую серию');
const seconds = Math.round(CONFIG.timeouts.nextCountdown / 1000);
this.startNextCountdown(seconds, () => this.switchNext());
}
};
window.addEventListener('message', handleMessage);
State.cleanup.push(() => window.removeEventListener('message', handleMessage));
setTimeout(() => {
Panel.create();
const { season, episode } = this.getSeasonEpisode();
Storage.saveWatchHistory(season, episode);
// Включить компрессор если нужен
if (State.settings.compressor && !AudioCompressor.sourceNode) {
AudioCompressor.enable();
} else if (State.settings.compressor && AudioCompressor.sourceNode) {
// Если компрессор включен, но источник изменился, переподключаем
const currentVideo = DOM.video();
if (currentVideo && AudioCompressor.sourceNode.mediaElement !== currentVideo) {
AudioCompressor.disable();  // Сначала отключаем старый
AudioCompressor.enable();   // Затем подключаем к новому видео
}
}
}, CONFIG.timeouts.domWait * 2);
}
};
// ═══════════════════════════════════════════════════════════
// СИСТЕМА ОЧИСТКИ РЕСУРСОВ
// ═══════════════════════════════════════════════════════════
const cleanup = () => {
Logger.info('Очистка ресурсов...');
// Очистка интервалов
Object.entries(State.intervals).forEach(([key, interval]) => {
if (interval) {
clearInterval(interval);
State.intervals[key] = null;
}
});
// Очистка наблюдателей DOM
State.dom.observers.forEach(obs => obs.disconnect());
State.dom.observers = [];
// Очистка наблюдателя громкости
if (State.volume.observer) {
State.volume.observer.disconnect();
State.volume.observer = null;
}
// Очистка канала громкости
if (State.volume.channel) {
State.volume.channel.close();
State.volume.channel = null;
}
// Очистка аудиокомпрессора
if (AudioCompressor.sourceNode && State.volume.compressor && State.volume.audioContext) {
try {
AudioCompressor.sourceNode.disconnect();
State.volume.compressor.disconnect();
} catch (e) {
// Игнорируем ошибки при отключении
}
AudioCompressor.sourceNode = null;
State.volume.compressor = null;
}
if (State.volume.audioContext && State.volume.audioContext.state !== 'closed') {
State.volume.audioContext.close();
State.volume.audioContext = null;
}
// Очистка общих функций
State.cleanup.forEach(fn => {
try {
fn();
} catch (e) {
Logger.error(`Ошибка cleanup: ${e.message}`);
}
});
State.cleanup = [];
// Очистка функций UI
Panel.cleanupFunctions.forEach(fn => {
try {
fn();
} catch (e) {
Logger.error(`Ошибка cleanup UI: ${e.message}`);
}
});
Panel.cleanupFunctions = [];
Logger.success('Ресурсы очищены');
};
// ═══════════════════════════════════════════════════════════
// ИНИЦИАЛИЗАЦИЯ СКРИПТА
// ═══════════════════════════════════════════════════════════
const init = () => {
try {
Storage.migrate();
State.settings = Storage.loadSettings();
if (State.settings.showPanel !== true) {
Storage.saveSettings({ showPanel: true });
}
Logger.info('═══════════════════════════════════════');
Logger.info(`WPARTY Auto v${CONFIG.version} - СТАРТ`);
Logger.info('═══════════════════════════════════════');
Logger.info(`Автопереключение: ${State.settings.autoNext ? 'ВКЛ' : 'ВЫКЛ'}`);
Logger.info(`Пропуск титров: ${State.settings.skipCredits ? 'ВКЛ' : 'ВЫКЛ'}`);
Logger.info(`Громкость: ${State.settings.volumeControl ? 'ВКЛ' : 'ВЫКЛ'}`);
Logger.info(`Компрессор: ${State.settings.compressor ? 'ВКЛ' : 'ВЫКЛ'}`);
injectStyles();
window.addEventListener('beforeunload', cleanup);
State.cleanup.push(() => window.removeEventListener('beforeunload', cleanup));
const isPlayer = window.location.hostname.includes('stloadi.live') || DOM.seekSlider();
if (isPlayer) {
PlayerMode.run();
} else {
MainMode.run();
}
// Fallback: ensure UI exists even if the page removes it
const ensureUI = () => {
if (!State.settings.showPanel || !IS_TOP) return;
// Check if UI elements exist in DOM but not in our reference
const existingFab = document.querySelector('.wpa-fab');
const existingPanel = document.querySelector('.wpa-panel');
// Only recreate if elements exist in DOM but not properly linked to our state
if ((!existingFab && !Panel.elements.fab) || (!existingPanel && !Panel.elements.panel)) {
// Clean up any existing elements that might be orphaned
document.querySelectorAll('.wpa-fab, .wpa-panel, .wpa-panel-overlay').forEach(el => el.remove());
Panel.create();
} else if (!existingFab && Panel.elements.fab) {
// FAB was removed from DOM, reattach it
// Но только если нет другой кнопки в DOM
if (!document.querySelector('.wpa-fab')) {
document.body.appendChild(Panel.elements.fab);
}
} else if (!existingPanel && Panel.elements.panel) {
// Panel was removed from DOM, reattach it
document.body.appendChild(Panel.elements.panel);
if (Panel.elements.overlay) {
document.body.appendChild(Panel.elements.overlay);
}
}
Panel.startLiveObserver();
};
if (document.body) {
requestAnimationFrame(ensureUI);
} else {
document.addEventListener('DOMContentLoaded', ensureUI, { once: true });
}
Logger.success('Инициализация завершена');
} catch (e) {
Logger.error(`Критическая ошибка инициализации: ${e.message}`);
console.error(e);
}
};
// Запуск скрипта
if (document.readyState === 'loading') {
document.addEventListener('DOMContentLoaded', init);
} else {
init();
}
})();
