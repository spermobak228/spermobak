/**
 * Модуль для централизованного управления таймерами подписок на каналы
 * Предоставляет единый интерфейс для создания, обновления и отслеживания таймеров
 */

// Константы для ключей localStorage
const TIMER_KEY_PREFIX = 'subscription_timer_';
const TIMER_EXPIRED_KEY_PREFIX = 'subscription_timer_expired_';
const ACTIVE_TIMERS_KEY = 'active_subscription_timers';

// Кэш активных таймеров в памяти (оптимизированный)
let activeTimers = new Map();
let activeIntervals = new Map();
let cleanupInterval = null;

/**
 * Инициализирует менеджер таймеров (оптимизированная версия)
 * Загружает существующие таймеры из localStorage и запускает периодическую очистку
 */
export function initTimerManager() {
    // Загружаем список активных таймеров из localStorage
    const savedTimers = localStorage.getItem(ACTIVE_TIMERS_KEY);
    if (savedTimers) {
        try {
            const timerList = JSON.parse(savedTimers);
            const currentTime = Date.now();
            
            // Проверяем каждый таймер и обновляем кэш только для актуальных
            timerList.forEach(taskId => {
                const timerValue = localStorage.getItem(`${TIMER_KEY_PREFIX}${taskId}`);
                if (timerValue) {
                    const waitUntil = parseInt(timerValue);
                    // Загружаем только не истекшие таймеры
                    if (waitUntil > currentTime) {
                        activeTimers.set(taskId, waitUntil);
                    } else {
                        // Сразу помечаем истекшие таймеры
                        localStorage.setItem(`${TIMER_EXPIRED_KEY_PREFIX}${taskId}`, 'true');
                        localStorage.removeItem(`${TIMER_KEY_PREFIX}${taskId}`);
                    }
                }
            });
            
            console.log(`Загружено ${activeTimers.size} активных таймеров из localStorage`);
        } catch (error) {
            console.error('Ошибка при загрузке таймеров из localStorage:', error);
            // Очищаем потенциально поврежденные данные
            localStorage.removeItem(ACTIVE_TIMERS_KEY);
        }
    }
    
    // Запускаем периодическую очистку устаревших таймеров (каждые 60 секунд)
    if (!cleanupInterval) {
        cleanupInterval = setInterval(cleanupExpiredTimers, 60000);
    }
}

/**
 * Сохраняет список активных таймеров в localStorage
 */
function saveActiveTimers() {
    const timerList = Array.from(activeTimers.keys());
    localStorage.setItem(ACTIVE_TIMERS_KEY, JSON.stringify(timerList));
}

/**
 * Создает или обновляет таймер для задания
 * @param {string} taskId - ID задания
 * @param {number} waitUntil - Время в миллисекундах, до которого нужно ждать
 * @param {HTMLElement} [taskElement=null] - Элемент карточки задания (если доступен)
 * @returns {boolean} - true, если таймер создан или обновлен
 */
export function setTimer(taskId, waitUntil, taskElement = null) {
    if (!taskId || !waitUntil) {
        console.error('Неверные параметры для создания таймера');
        return false;
    }
    
    // ВАЖНО: Сначала очищаем любые существующие таймеры для этого задания
    clearTimer(taskId);
    
    const now = Date.now();
    
    // Проверяем, не истекло ли уже время
    if (waitUntil <= now) {
        console.log('Указанное время уже прошло, устанавливаем флаг истекшего таймера');
        setExpiredFlag(taskId);
        return true;
    }
    
    // Сохраняем таймер в localStorage и кэше
    localStorage.setItem(`${TIMER_KEY_PREFIX}${taskId}`, waitUntil.toString());
    activeTimers.set(taskId, waitUntil);
    
    // Обновляем список активных таймеров
    saveActiveTimers();
    
    // Если элемент задания доступен, обновляем UI
    if (taskElement) {
        renderTimer(taskId, waitUntil, taskElement);
    }
    
    return true;
}

/**
 * Устанавливает флаг истекшего таймера
 * @param {string} taskId - ID задания
 * @param {HTMLElement} [taskElement=null] - Элемент карточки задания (если доступен)
 */
export function setExpiredFlag(taskId, taskElement = null) {
    // Удаляем таймер, если он существует
    clearTimer(taskId);
    
    // Устанавливаем флаг истекшего таймера
    localStorage.setItem(`${TIMER_EXPIRED_KEY_PREFIX}${taskId}`, 'true');
    
    // Если элемент задания доступен, обновляем UI
    if (taskElement) {
        // Обновляем UI напрямую, без импорта SubscriptionVerifier
        const actionButton = taskElement.querySelector('.task-button');
        if (actionButton) {
            actionButton.textContent = window.i18n?.t('tasks.btn_claim') || 'Получить';
            actionButton.disabled = false;
            actionButton.style.display = '';
        }
        
        // Удаляем таймер, если он есть в DOM
        const timerElement = taskElement.querySelector('.task-timer');
        if (timerElement) {
            timerElement.remove();
        }
    }
}

/**
 * Очищает таймер для задания
 * @param {string} taskId - ID задания
 */
export function clearTimer(taskId) {
    // Удаляем таймер из localStorage
    localStorage.removeItem(`${TIMER_KEY_PREFIX}${taskId}`);
    
    // Удаляем из кэша
    activeTimers.delete(taskId);
    
    // Очищаем интервал, если он существует
    if (activeIntervals.has(taskId)) {
        clearInterval(activeIntervals.get(taskId));
        activeIntervals.delete(taskId);
    }
    
    // Обновляем список активных таймеров
    saveActiveTimers();
}

/**
 * Проверяет наличие и состояние таймера для задания
 * @param {string} taskId - ID задания
 * @param {HTMLElement} [taskElement=null] - Элемент карточки задания (если доступен)
 * @returns {Object} - Объект с информацией о таймере {isExpired, hasTimer, isActive, timeLeft}
 */
export function checkTimer(taskId, taskElement = null) {
    // Проверяем наличие флага истекшего таймера
    const isExpired = localStorage.getItem(`${TIMER_EXPIRED_KEY_PREFIX}${taskId}`) === 'true';
    
    if (isExpired) {
        return { isExpired: true, hasTimer: false, isActive: false, timeLeft: 0 };
    }
    
    // Проверяем наличие активного таймера
    let waitUntil = activeTimers.get(taskId);
    
    // Если нет в кэше, проверяем localStorage
    if (!waitUntil) {
        const savedTimer = localStorage.getItem(`${TIMER_KEY_PREFIX}${taskId}`);
        if (savedTimer) {
            waitUntil = parseInt(savedTimer);
            activeTimers.set(taskId, waitUntil);
            saveActiveTimers();
        }
    }
    
    if (waitUntil) {
        const now = Date.now();
        const timeLeft = waitUntil - now;
        
        // Если время уже истекло
        if (timeLeft <= 0) {
            setExpiredFlag(taskId, taskElement);
            return { isExpired: true, hasTimer: false, isActive: false, timeLeft: 0 };
        }
        
        // Если таймер активен и элемент доступен, отображаем таймер
        if (taskElement) {
            renderTimer(taskId, waitUntil, taskElement);
        }
        
        return { isExpired: false, hasTimer: true, isActive: true, timeLeft, waitUntil };
    }
    
    // Таймер не найден
    return { isExpired: false, hasTimer: false, isActive: false, timeLeft: 0 };
}

/**
 * Отображает таймер в элементе задания
 * @param {string} taskId - ID задания
 * @param {number} waitUntil - Время в миллисекундах, до которого нужно ждать
 * @param {HTMLElement} taskElement - Элемент карточки задания
 */
function renderTimer(taskId, waitUntil, taskElement) {
    // Очищаем предыдущий интервал, если он был
    if (activeIntervals.has(taskId)) {
        clearInterval(activeIntervals.get(taskId));
    }
    
    // Определяем тип таймера - истечение или подписка
    const isExpirationTimer = taskId.startsWith('expiration_');
    
    // Находим или создаем элемент для таймера
    let timerElement = taskElement.querySelector('.task-timer');
    if (!timerElement) {
        timerElement = document.createElement('div');
        timerElement.className = 'task-timer';
        
        // Добавляем специальный класс для таймеров истечения
        if (isExpirationTimer) {
            timerElement.classList.add('expiration-timer');
        }
        
        // Добавляем только значение таймера
        const timerValue = document.createElement('span');
        timerValue.className = 'timer-value';
        timerValue.style.fontFamily = 'monospace';
        timerValue.style.minWidth = '60px';
        timerValue.style.display = 'inline-block';
        timerValue.style.textAlign = 'center';
        
        timerElement.appendChild(timerValue);
        
        // Добавляем таймер в правильный контейнер (.task-action)
        const actionContainer = taskElement.querySelector('.task-action');
        if (actionContainer) {
            actionContainer.appendChild(timerElement);
        } else {
            // Если контейнер не найден, добавляем в карточку (фолбэк)
            taskElement.appendChild(timerElement);
        }
        
        // Скрываем кнопку действия
        const button = taskElement.querySelector('.task-button');
        if (button) {
            button.style.display = 'none';
        }
    } else {
        // Если элемент уже существует, но это таймер истечения, добавляем класс
        if (isExpirationTimer && !timerElement.classList.contains('expiration-timer')) {
            timerElement.classList.add('expiration-timer');
        }
    }
    
    // Функция для обновления таймера
    const updateTimer = () => {
        const now = Date.now();
        const timeLeft = waitUntil - now;
        
        if (timeLeft <= 0) {
            // Время истекло
            clearInterval(intervalId);
            activeIntervals.delete(taskId);
            
            // Устанавливаем флаг истекшего таймера
            setExpiredFlag(taskId, taskElement);
            return;
        }
        
        // Рассчитываем и отображаем оставшееся время
        const hours = Math.floor(timeLeft / (1000 * 60 * 60));
        const minutes = Math.floor((timeLeft % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((timeLeft % (1000 * 60)) / 1000);
        
        const timerValueElement = timerElement.querySelector('.timer-value');
        if (timerValueElement) {
            const formattedTime = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
            timerValueElement.textContent = formattedTime;
        }
        
        // Добавляем критические классы для таймеров истечения
        if (isExpirationTimer) {
            const oneHour = 60 * 60 * 1000;
            const thirtyMinutes = 30 * 60 * 1000;
            
            // Убираем предыдущие классы
            taskElement.classList.remove('task-expiring-soon', 'task-expiring-critical');
            
            if (timeLeft <= thirtyMinutes) {
                // Критическое время - менее 30 минут
                taskElement.classList.add('task-expiring-critical');
            } else if (timeLeft <= oneHour) {
                // Предупреждение - менее 1 часа
                taskElement.classList.add('task-expiring-soon');
            }
        }
    };
    
    // Обновляем таймер сразу и запускаем интервал
    updateTimer();
    const intervalId = setInterval(updateTimer, 1000);
    
    // Сохраняем интервал
    activeIntervals.set(taskId, intervalId);
}

/**
 * Проверяет все активные таймеры и обновляет их состояние
 * Используется при загрузке страницы
 */
export function checkAllTimers() {
    const now = Date.now();
    const timersToRemove = [];
    
    // Проверяем все таймеры в кэше
    activeTimers.forEach((waitUntil, taskId) => {
        if (waitUntil <= now) {
            // Таймер истек
            setExpiredFlag(taskId);
            timersToRemove.push(taskId);
        }
    });
    
    // Удаляем истекшие таймеры
    timersToRemove.forEach(taskId => {
        activeTimers.delete(taskId);
    });
    
    // Обновляем список активных таймеров
    if (timersToRemove.length > 0) {
        saveActiveTimers();
    }
}

/**
 * Автоматическая очистка истекших таймеров
 * Вызывается периодически для освобождения памяти
 */
function cleanupExpiredTimers() {
    const currentTime = Date.now();
    const expiredTimers = [];
    
    // Находим истекшие таймеры
    activeTimers.forEach((waitUntil, taskId) => {
        if (waitUntil <= currentTime) {
            expiredTimers.push(taskId);
        }
    });
    
    // Помечаем их как истекшие
    expiredTimers.forEach(taskId => {
        setExpiredFlag(taskId);
    });
    
    if (expiredTimers.length > 0) {
        console.log(`Автоматически очищено ${expiredTimers.length} истекших таймеров`);
    }
}

/**
 * Останавливает менеджер таймеров и очищает ресурсы
 */
export function destroyTimerManager() {
    // Очищаем все интервалы
    activeIntervals.forEach(intervalId => clearInterval(intervalId));
    activeIntervals.clear();
    
    // Останавливаем периодическую очистку
    if (cleanupInterval) {
        clearInterval(cleanupInterval);
        cleanupInterval = null;
    }
    
    // Очищаем кэш
    activeTimers.clear();
}

// Экспортируем все функции для использования в других модулях
export default {
    initTimerManager,
    setTimer,
    clearTimer,
    checkTimer,
    setExpiredFlag,
    checkAllTimers,
    destroyTimerManager
}; 