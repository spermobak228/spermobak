/**
 * Модуль для работы с интерфейсом
 * Содержит утилиты для работы с UI и Telegram WebApp
 */

/**
 * Применяет цветовую схему Telegram к приложению
 */
export function applyTelegramColorScheme() {
    const tg = window.Telegram.WebApp;
    
    // Если Telegram WebApp доступен, применяем его цветовую схему
    if (tg) {
        // Получаем параметры темы
        const {
            bg_color,
            text_color,
            hint_color,
            link_color,
            button_color,
            button_text_color,
            secondary_bg_color
        } = tg.themeParams;
        
        // Базовые CSS-переменные
        const cssVars = {
            '--tg-theme-bg-color': bg_color || '#18222d',
            '--tg-theme-text-color': text_color || '#ffffff',
            '--tg-theme-hint-color': hint_color || '#7d7d7d',
            '--tg-theme-link-color': link_color || '#5eacef',
            '--tg-theme-button-color': button_color || '#5eacef',
            '--tg-theme-button-text-color': button_text_color || '#ffffff',
            '--tg-theme-secondary-bg-color': secondary_bg_color || '#232e3c'
        };
        
        // Устанавливаем CSS-переменные и создаем RGB-версии
        Object.entries(cssVars).forEach(([key, value]) => {
            // Устанавливаем основную переменную
            document.documentElement.style.setProperty(key, value);
            
            // Создаем RGB-версию для всех цветовых переменных
            const rgb = hexToRgb(value);
            if (rgb) {
                document.documentElement.style.setProperty(`${key}-rgb`, rgb);
            }
        });
        
        // Определяем цвет теней в зависимости от цветовой схемы, а не от цвета текста
        const colorScheme = tg.colorScheme || 'dark'; // 'dark' или 'light'
        
        if (colorScheme === 'dark') {
            // Темные тени для темной темы
            document.documentElement.style.setProperty('--lottery-barrel-shadow-color-05', 'rgba(0, 0, 0, 0.5)');
            document.documentElement.style.setProperty('--lottery-barrel-shadow-color-03', 'rgba(0, 0, 0, 0.3)');
            document.documentElement.style.setProperty('--lottery-barrel-shadow-color-01', 'rgba(0, 0, 0, 0.1)');
        } else {
            // Светлые тени для светлой темы
            document.documentElement.style.setProperty('--lottery-barrel-shadow-color-05', 'rgba(220, 220, 220, 0.5)');
            document.documentElement.style.setProperty('--lottery-barrel-shadow-color-03', 'rgba(220, 220, 220, 0.3)');
            document.documentElement.style.setProperty('--lottery-barrel-shadow-color-01', 'rgba(220, 220, 220, 0.1)');
        }
        
        console.log('Telegram theme applied:', tg.themeParams, 'Color scheme:', colorScheme);
    } else {
        console.warn('Telegram WebApp is not available');
    }
}

// Экспортируем функцию в глобальный объект window для доступа из других скриптов
window.applyTelegramColorScheme = applyTelegramColorScheme;

/**
 * Преобразует HEX-цвет в RGB формат
 * @param {string} hex - HEX-цвет
 * @returns {string|null} RGB значения в формате "r, g, b"
 */
function hexToRgb(hex) {
    // Проверяем, что hex не пустой
    if (!hex) return null;
    
    // Удаляем # если есть
    hex = hex.replace('#', '');
    
    // Проверяем длину HEX-кода
    if (hex.length !== 6 && hex.length !== 3) return null;
    
    // Если короткий формат (#RGB), преобразуем в полный (#RRGGBB)
    if (hex.length === 3) {
        hex = hex.split('').map(h => h + h).join('');
    }
    
    // Преобразуем в RGB
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);
    
    // Проверяем на корректность значений
    if (isNaN(r) || isNaN(g) || isNaN(b)) return null;
    
    return `${r}, ${g}, ${b}`;
}

/**
 * Форматирует число, добавляя пробелы между разрядами
 * @param {number} number - Число для форматирования
 * @returns {string} Отформатированное число
 */
export function formatNumber(number) {
    return number.toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}

/**
 * Форматирует цену подарка БЕЗ пробелов между разрядами
 * Используется специально для отображения стоимости подарков в блоке вероятных выигрышей
 * @param {number} number - Число для форматирования
 * @returns {string} Отформатированное число без пробелов
 */
export function formatGiftPrice(number) {
    return number.toString();
}

/**
 * Настраивает отображение полосы прокрутки
 */
export function setupScrollbarVisibility() {
    const html = document.documentElement;
    let scrollTimeout;
    
    // Используем throttle для оптимизации обработки события скролла
    const throttleScroll = (() => {
        let lastCall = 0;
        const threshold = 100; // минимальный интервал между вызовами в мс
        
        return () => {
            const now = Date.now();
            
            if (now - lastCall >= threshold) {
                lastCall = now;
                
                // Показываем полосу прокрутки
                html.classList.add('scrolling');
                
                // Очищаем предыдущий таймер
                clearTimeout(scrollTimeout);
                
                // Устанавливаем новый таймер для скрытия полосы прокрутки
                scrollTimeout = setTimeout(() => {
                    html.classList.remove('scrolling');
                }, 250); // Увеличенная задержка для лучшего UX
            }
        };
    })();
    
    // Добавляем обработчик события скролла с троттлингом
    window.addEventListener('scroll', throttleScroll, { passive: true });
}

/**
 * Возвращает тактильный отклик через Telegram WebApp
 * @param {string} type - Тип отклика ('impact', 'notification', 'selection')
 * @param {string} style - Стиль отклика
 */
export function triggerHapticFeedback(type, style = '') {
    const tg = window.Telegram.WebApp;
    const hapticFeedbackSupported = tg && tg.HapticFeedback !== undefined;
    
    if (!hapticFeedbackSupported) return;
    
    try {
        if (type === 'impact' && style) {
            tg.HapticFeedback.impactOccurred(style);
        } else if (type === 'notification' && style) {
            tg.HapticFeedback.notificationOccurred(style);
        } else if (type === 'selection') {
            tg.HapticFeedback.selectionChanged();
        }
    } catch (e) {
        console.warn('Ошибка при вызове тактильного отклика:', e);
    }
}

/**
 * Показывает временное сообщение пользователю (тост-уведомление)
 * @param {string} message - Текст сообщения для отображения
 * @param {number} duration - Продолжительность показа в миллисекундах (по умолчанию 1500мс)
 * @param {string} type - Тип сообщения ('success', 'error', 'info')
 */
export function showTemporaryMessage(message, duration = 1500, type = 'info') {
    // Создаем элемент для сообщения
    const messageElement = document.createElement('div');
    messageElement.className = `temporary-message temporary-message-${type}`;
    messageElement.textContent = message;
    
    // Добавляем элемент на страницу
    document.body.appendChild(messageElement);
    
    // Показываем сообщение с небольшой задержкой для анимации
    setTimeout(() => {
        messageElement.classList.add('show');
    }, 10);
    
    // Удаляем сообщение через указанное время
    setTimeout(() => {
        messageElement.classList.remove('show');
        setTimeout(() => {
            if (messageElement.parentNode) {
                messageElement.parentNode.removeChild(messageElement);
            }
        }, 300); // Задержка для завершения анимации скрытия
    }, duration);
}

/**
 * Инициализирует поддержку TGS анимаций
 */
export function initTgsSupport() {
    // Проверяем, зарегистрирован ли уже tgs-player
    if (!customElements.get('tgs-player')) {
        console.warn('Элемент tgs-player не зарегистрирован. Пробуем загрузить библиотеку динамически.');
        
        // Проверяем, загружена ли уже библиотека lottie-player
        if (typeof lottie === 'undefined') {
            console.warn('Lottie библиотека не найдена. Загружаем lottie-player.js');
            const lottiescript = document.createElement('script');
            lottiescript.src = '/static/js/lib/lottie-player.js';
            lottiescript.async = true;
            lottiescript.onload = function() {
                console.log('Lottie Player библиотека загружена динамически');
                // После загрузки lottie, загружаем tgs-player
                loadTgsPlayer();
            };
            lottiescript.onerror = function() {
                console.error('Не удалось загрузить Lottie Player библиотеку');
            };
            document.head.appendChild(lottiescript);
        } else {
            // Если lottie уже загружен, загружаем только tgs-player
            loadTgsPlayer();
        }
    } else {
        console.log('TGS Player поддержка уже инициализирована');
    }
    
    function loadTgsPlayer() {
        const script = document.createElement('script');
        script.src = '/static/js/lib/tgs-player.js';
        script.async = true;
        script.onload = function() {
            console.log('TGS Player библиотека загружена динамически');
        };
        script.onerror = function() {
            console.error('Не удалось загрузить TGS Player библиотеку');
        };
        document.head.appendChild(script);
    }
}

/**
 * Анимирует изменение баланса как барабанный счетчик
 * @param {HTMLElement} element - Элемент, в котором отображается баланс
 * @param {number} startValue - Начальное значение
 * @param {number} endValue - Конечное значение
 * @param {number} duration - Длительность анимации в миллисекундах
 */
export function animateBalance(element, startValue, endValue, duration = 800) {
    if (!element) return;
    
    // Убедимся, что начальное и конечное значения - числа
    startValue = parseInt(startValue) || 0;
    endValue = parseInt(endValue) || 0;
    
    // Если значения одинаковые, просто обновляем текст
    if (startValue === endValue) {
        element.textContent = formatNumber(endValue);
        return;
    }
    
    // Сохраняем реальное значение баланса
    element.dataset.realValue = endValue;
    
    // Разница значений для анимации
    const difference = endValue - startValue;
    
    // Определяем количество кадров - для более быстрой анимации
    const frameCount = Math.min(20, Math.abs(Math.floor(difference / 60)) + 8);
    const frameDuration = duration / frameCount;
    
    // Функция для плавного замедления с более быстрым началом
    const easeOutCubic = t => 1 - Math.pow(1 - t, 3);
    
    let currentFrame = 0;
    let lastFrameTime = performance.now();
    
    // Функция анимации с оптимизацией
    function animate() {
        const now = performance.now();
        const elapsed = now - lastFrameTime;
        
        // Пропускаем кадры для экономии ресурсов
        if (elapsed < frameDuration) {
            requestAnimationFrame(animate);
            return;
        }
        
        lastFrameTime = now;
        currentFrame++;
        
        if (currentFrame <= frameCount) {
            // Вычисляем текущее значение с эффектом замедления
            const progress = easeOutCubic(currentFrame / frameCount);
            const currentValue = Math.round(startValue + difference * progress);
            
            // Обновляем отображаемое значение (не фактическое)
            element.textContent = formatNumber(currentValue);
            
            requestAnimationFrame(animate);
        } else {
            // Завершение анимации - устанавливаем окончательное значение
            element.textContent = formatNumber(endValue);
        }
    }
    
    // Запускаем анимацию
    requestAnimationFrame(animate);
} 