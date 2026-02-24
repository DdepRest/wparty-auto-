# 🎬 WPARTY Auto — Redesign Edition

```
📱 Mobile Optimized Edition v11.3.0
```

![Version](https://img.shields.io/badge/version-11.3.0-blue)
![License](https://img.shields.io/badge/license-MIT-green)
![Tampermonkey](https://img.shields.io/badge/Tampermonkey-4.0+-orange)
![Last Update](https://img.shields.io/badge/updated-2026--02--24-brightgreen)
![Status](https://img.shields.io/badge/status-stable-success)

> 🎯 Современный пользовательский скрипт для автоматического переключения серий на **WPARTY.net** с умным пропуском титров, системой управления громкостью и расширенной статистикой.

---

## 📑 Содержание

<details>
<summary>Навигация по документу</summary>

1. [✨ Особенности](#-особенности)
2. [📦 Установка](#-установка)
3. [🎮 Использование](#-использование)
4. [⚙️ Настройки](#️-настройки)
5. [🔄 Обновления](#-обновления)
6. [📝 Журнал изменений](#-журнал-изменений)
7. [🐛 Известные проблемы](#-известные-проблемы)
8. [🤝 Вклад в проект](#-вклад-в-проект)
9. [📞 Поддержка](#-поддержка)

</details>

---

## ✨ Особенности

### 📺 Автопереключение серий

| Функция | Описание |
|---------|----------|
| 🔄 Автопереход | Автоматический переход на следующую серию после завершения текущей |
| 📚 Между сезонами | Поддержка автопереключения между сезонами |
| ⏳ Обратный отсчет | Визуальный таймер перед переключением (настраиваемый) |
| 💾 Прогресс | Сохранение прогресса просмотра между сеансами |

### ⏭️ Умный пропуск титров

- **Два режима пропуска:**
  - 📊 **По проценту** просмотра (50-99%)
  - ⏱️ **По времени** до конца (10-300 сек)
- Гибкая настройка порога срабатывания
- Интеллектуальное определение времени окончания
- Адаптивное запоминание длины титров для каждого сериала

### 🔊 Продвинутое управление громкостью

| Функция | Статус |
|---------|--------|
| Сохранение уровня | ✅ Между сериями и сеансами |
| OSD-индикатор | ✅ Визуальное отображение |
| Авто-восстановление | ✅ После переключения серии |
| Аудиокомпрессор | ✅ Выравнивание громкости (v10+) |
| Синхронизация вкладок | ✅ Единая громкость во всех вкладках |
| Тактильная отдача | ✅ Haptic Feedback (v11.3+) |

### 📱 Мобильная оптимизация *(v11.3+)*

- 🖐 **Менеджер жестов** — свайпы для управления панелью
- 📳 **Тактильная отдача** — 6 паттернов вибрации
- 🎯 **Увеличенные целевые области** — 48-56px
- 📐 **Адаптивный дизайн** — оптимизация для ≤768px и ≤480px

### 📊 Расширенная статистика

- ⏱️ Время просмотра за сегодня и за неделю
- 📜 История просмотров с деталями (сериал, сезон, серия)
- 📺 Список всех просмотренных сериалов
- 💾 Хранение данных за последние 30 дней

### 🎨 Современный интерфейс

- 🪟 **Glassmorphism дизайн** — полупрозрачные панели с размытием
- 🅰️ **Шрифт Geist** + SVG-иконки вместо эмодзи
- 🧭 **Вкладочная система** — Автоматика, Статистика, Настройки
- 🧷 **FAB-кнопка** — быстрый доступ в правом нижнем углу
- 🎬 **Настраиваемые анимации** — плавные переходы и эффекты
- 🌙 **Неон-тёмная тема** — с градиентами и акцентами

### 📴 Офлайн-режим *(v11.3+)*

- 📦 Кэширование через Service Worker API
- 💾 Сохранение состояния при потере соединения
- 🔄 Автосинхронизация после восстановления
- 📡 Мониторинг соединения в реальном времени

### 🔗 Межфреймовая коммуникация *(v11.3+)*

- 📨 Двусторонняя связь (main ↔ player iframe)
- 🔒 Защита от недоверенных origin
- 📊 Типы сообщений: `SET_VOLUME`, `GET_VOLUME`, `ADJUST_VOLUME`, `NEXT_EPISODE`

---

## 📦 Установка

### Шаг 1: Установите менеджер пользовательских скриптов

| Браузер | Ссылка |
|---------|--------|
| <img src="https://img.icons8.com/color/16/chrome.png" alt="Chrome"> Chrome | [Tampermonkey](https://chrome.google.com/webstore/detail/tampermonkey/dhdgffkkebhmkfjojejmpbldmpobfkfo) |
| <img src="https://img.icons8.com/color/16/firefox.png" alt="Firefox"> Firefox | [Tampermonkey](https://addons.mozilla.org/firefox/addon/tampermonkey/) |
| <img src="https://img.icons8.com/color/16/ms-edge-new.png" alt="Edge"> Edge | [Tampermonkey](https://microsoftedge.microsoft.com/addons/detail/tampermonkey/iikmkjmpaadaobahmlepeloendndfphd) |
| <img src="https://img.icons8.com/color/16/safari.png" alt="Safari"> Safari | [Tampermonkey](https://apps.apple.com/app/tampermonkey/id1482490089) |
| <img src="https://img.icons8.com/color/16/opera.png" alt="Opera"> Opera | [Tampermonkey](https://addons.opera.com/extensions/details/tampermonkey/) |

### Шаг 2: Установите скрипт

> ⚠️ **Важно:** Убедитесь, что у вас установлен Tampermonkey 4.0+

| Способ | Действие |
|--------|----------|
| 🚀 **Быстрая установка** | [⬇️ Нажми для установки](https://raw.githubusercontent.com/DdepRest/wparty-auto-redesign/main/wparty-auto.user.js) |
| 📋 **Ручная установка** | Скопируйте код из [wparty-auto.user.js](https://raw.githubusercontent.com/DdepRest/wparty-auto-redesign/main/wparty-auto.user.js) и вставьте в Tampermonkey |

**Ручная установка по шагам:**

1. Откройте Tampermonkey → **Создать новый скрипт**
2. Замените весь код на содержимое файла
3. Сохраните **(Ctrl+S / Cmd+S)**
4. Обновите страницу WPARTY.net

---

## 🎮 Использование

```
1️⃣  Откройте любой сериал на wparty.net
2️⃣  Найдите FAB-кнопку в правом нижнем углу
3️⃣  Нажмите для открытия панели управления
4️⃣  Настройте параметры на вкладках
5️⃣  Наслаждайтесь просмотром! 🍿
```

### 🧭 Вкладки панели управления

| Вкладка | Назначение |
|---------|------------|
| **🤖 Автоматика** | Настройки автопереключения и пропуска титров |
| **📊 Статистика** | История и статистика просмотров |
| **⚙️ Настройки** | Конфигурация интерфейса и дополнительных параметров |

### 🎯 Быстрые действия

| Действие | Способ |
|----------|--------|
| Открыть панель | Клик на FAB-кнопку |
| Закрыть панель | Клик вне панели / свайп влево (mobile) |
| Регулировка громкости | Кнопки +/- в интерфейсе |
| Синхронизация | Кнопка 🔄 в панели |

---

## ⚙️ Настройки

### 🔄 Автопереключение

| Опция | Описание | Значение по умолчанию |
|-------|----------|----------------------|
| Следующая серия | Автоматический переход при окончании | ✅ Включено |
| Следующий сезон | Переход на новый сезон | ✅ Включено |
| Обратный отсчет | Время ожидания перед переключением | 5-10 сек |

### ⏭️ Пропуск титров

| Опция | Описание | Диапазон |
|-------|----------|----------|
| Умный пропуск | Включить/выключить автоматический пропуск | On/Off |
| Режим пропуска | Процентный или временной режим | % / сек |
| Порог пропуска | Настройка триггера | 50-99% / 10-300 сек |

### 🔊 Громкость

| Опция | Описание | Статус |
|-------|----------|--------|
| Сохранение громкости | Запоминание уровня между сериями | ✅ |
| OSD индикатор | Визуальное отображение на экране | ✅ |
| Аудиокомпрессор | Выравнивание громкости | ✅ (v10+) |
| Мин. интервал применения | Защита от частых изменений | 500ms (v11.3+) |

### 🎨 Интерфейс

| Опция | Описание |
|-------|----------|
| Анимации | Включение плавных переходов и визуальных эффектов |
| Уведомления | Показ всплывающих сообщений о действиях |
| Показывать панель | Отображение панели управления |
| Компактный режим | Упрощенное отображение интерфейса |
| Позиция панели | Настройка положения (левый/правый край) |
| Тема оформления | Выбор цветовой схемы |

### 📱 Мобильные настройки *(v11.3+)*

| Опция | Описание |
|-------|----------|
| Жесты | Включение/выключение управления свайпами |
| Тактильная отдача | Вибрация при действиях |
| Адаптация UI | Автоматическая оптимизация для мобильных |

---

## 🔄 Обновления

### Автоматические

Скрипт автоматически проверяет наличие обновлений через Tampermonkey.

| Параметр | Значение |
|----------|----------|
| **Update URL** | [`wparty-auto.user.js`](https://raw.githubusercontent.com/DdepRest/wparty-auto-redesign/main/wparty-auto.user.js) |
| **Проверка** | Tampermonkey → Утилиты → Проверить обновления |

### Ручные

1. Перейдите на страницу репозитория
2. Скачайте последнюю версию
3. Обновите скрипт в Tampermonkey

---

## 📝 Журнал изменений

### 🔗 Полная история

Смотрите подробный [CHANGELOG.md](https://github.com/DdepRest/wparty-auto-redesign/blob/main/CHANGELOG.md)

### 🆕 Последняя версия (v11.3.0)

| Категория | Изменения |
|-----------|-----------|
| ✨ Добавлено | Мобильная оптимизация, жесты, тактильная отдача, офлайн-режим |
| 🔧 Изменено | Улучшено управление громкостью, аудиокомпрессор, логирование |
| 🐛 Исправлено | Утечки памяти, дублирование UI, конфликты жестов |
| 🗑️ Удалено | Избыточные CSS переменные, упрощены градиенты |

<details>
<summary>📜 Предыдущие версии</summary>

| Версия | Дата | Ключевые изменения |
|--------|------|-------------------|
| 10.0.4 | 2026-02-03 | Редизайн, glassmorphism, аудиокомпрессор, FAB-кнопка |
| 9.x-8.x | 2025 | Улучшения громкости и интерфейса |
| 7.0.0 | 2025-01-27 | Новый UI, графики статистики, OSD громкости |
| 4.0.0 | 2024 | Адаптивный пропуск титров, статистика времени |
| 3.0.0 | 2024 | UI панель, пропуск титров, история |

</details>

---

## 🐛 Известные проблемы

| Проблема | Статус | Обходное решение |
|----------|--------|------------------|
| Работает только на wparty.net и stloadi.live | ⚠️ Ожидание | — |
| Требуется включённый JavaScript | ⚠️ Требование | Включите JS в настройках браузера |
| Ограниченная работа в режиме инкогнито | ⚠️ Ограничение | Используйте обычный режим |
| Совместимость с Tampermonkey < 4.0 | ❌ Не поддерживается | Обновите Tampermonkey |

---

## 🤝 Вклад в проект

Хотите улучшить скрипт? Мы приветствуем ваш вклад! 🙌

### 📋 Как внести вклад

```bash
# 1. Fork репозитория
# 2. Создайте ветку для изменений
git checkout -b feature/your-feature

# 3. Внесите изменения и сделайте коммит
git commit -m 'feat: add new feature'

# 4. Загрузите изменения
git push origin feature/your-feature

# 5. Откройте Pull Request
```

### 📝 Требования к коду

| Требование | Описание |
|------------|----------|
| 📐 Стиль кода | Следуйте существующему стилю кодирования |
| 🌐 Совместимость | Обеспечьте работу в Chrome, Firefox, Edge |
| ✅ Тестирование | Протестируйте изменения перед отправкой |
| 📖 Документация | Обновите документацию при добавлении функций |

### 🏷️ Convention Commits

Мы используем [Conventional Commits](https://www.conventionalcommits.org/):

| Префикс | Описание |
|---------|----------|
| `feat:` | Новая функция |
| `fix:` | Исправление ошибки |
| `docs:` | Изменения в документации |
| `style:` | Форматирование, пробелы |
| `refactor:` | Рефакторинг кода |
| `perf:` | Улучшение производительности |
| `chore:` | Вспомогательные изменения |

---

## 📞 Поддержка

| Ресурс | Ссылка | Описание |
|--------|--------|----------|
| 🐛 **Сообщить об ошибке** | [GitHub Issues](https://github.com/DdepRest/wparty-auto-redesign/issues) | Баги и проблемы |
| 💬 **Обсуждение** | [Discussions](https://github.com/DdepRest/wparty-auto-redesign/discussions) | Вопросы и идеи |
| 📖 **Документация** | [Wiki](https://github.com/DdepRest/wparty-auto-redesign/wiki) | Подробные руководства |
| 📥 **Установить скрипт** | [Direct Link](https://raw.githubusercontent.com/DdepRest/wparty-auto-redesign/main/wparty-auto.user.js) | Последняя версия |

---

## 📄 Лицензия

Этот проект распространяется под лицензией **MIT**.

<details>
<summary>📜 Показать текст лицензии</summary>

```
MIT License

Copyright (c) 2025-2026 DdepRest

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

</details>

---

## 👥 Авторы

| Роль | Автор |
|------|-------|
| **Разработчик** | [@DdepRest](https://github.com/DdepRest) |
| **Лицензия** | [MIT](LICENSE) |

---

<div align="center">

---

### ⭐ Поддержите проект!

**Если скрипт помогает вам в просмотре сериалов — поставьте звезду на GitHub!**

[![GitHub stars](https://img.shields.io/github/stars/DdepRest/wparty-auto-redesign?style=social)](https://github.com/DdepRest/wparty-auto-redesign/stargazers)

---

[📥 Установить скрипт](https://raw.githubusercontent.com/DdepRest/wparty-auto-redesign/main/wparty-auto.user.js) • [🐛 Сообщить о проблеме](https://github.com/DdepRest/wparty-auto-redesign/issues) • [🐙 GitHub](https://github.com/DdepRest/wparty-auto-redesign)

---
