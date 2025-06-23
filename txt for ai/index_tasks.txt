/**
 * Модуль для работы с заданиями
 * Экспортирует типы заданий и компоненты для страницы заданий
 */

// Импортируем универсальный компонент карточки задания
import { renderTaskCard } from './components/TaskCard.js';

// Импорт верификаторов заданий
import { checkAppActivity } from './verifiers/ActivityVerifier.js';
import { checkInventory } from './verifiers/InventoryVerifier.js';
import { checkSubscription, openChannelForSubscription } from './verifiers/SubscriptionVerifier.js';
import { checkExperience } from './verifiers/ExperienceVerifier.js';

// Импорт модального окна для завершения задания
import { showTaskComplete } from './task-complete-modal.js';

// Импорт i18n модуля для переводов
import * as i18n from '../i18n.js';

// Импорт TimerManager для управления таймерами истечения
import TimerManager from './utils/TimerManager.js';

/**
 * Получает initData для авторизации Telegram WebApp
 * @returns {string} initData или пустая строка
 */
function getTelegramInitData() {
    return window.Telegram?.WebApp?.initData || '';
}

/**
 * Создает заголовки с Telegram initData для API запросов
 * @returns {Object} Объект с заголовками
 */
function createTelegramHeaders() {
    const headers = {
        'Content-Type': 'application/json'
    };
    
    const initData = getTelegramInitData();
    if (initData) {
        headers['X-Telegram-Init-Data'] = initData;
    }
    
    return headers;
}

// Заглушка для верификатора, который еще не реализован
const checkExternalActivity = () => Promise.resolve(false);

// Типы заданий
export const TaskTypes = {
    DAILY: 'daily',
    WEEKLY: 'weekly',
    SPECIAL: 'special',
    ACHIEVEMENT: 'achievement'
};

// Экспорт модулей проверки
export const TaskVerifiers = {
    checkAppActivity,
    checkInventory,
    checkExternalActivity,
    checkSubscription,
    checkExperience
};

/**
 * Вспомогательная функция для получения переведенного названия задания
 * @param {string} taskId - Идентификатор задания
 * @param {string} defaultTitle - Название задания по умолчанию
 * @returns {string} - Переведенное название задания
 */
export function getLocalizedTaskTitle(taskId, defaultTitle = '') {
    if (!taskId) return defaultTitle;
    const taskKey = taskId.replace(/-/g, '_'); // Заменяем дефисы на подчеркивания для совместимости с ключами перевода
    return i18n.t(`tasks.task_titles.${taskKey}`, { defaultValue: defaultTitle });
}

/**
 * Рендерит задание в контейнер
 * @param {Object} task - Объект задания
 * @param {HTMLElement} container - Контейнер для размещения задания
 * @param {Function} onActionClick - Обработчик нажатия на кнопку действия
 */
export function renderTask(task, container, onActionClick) {
    // Добавляем признак важности для особых заданий
    if (task.type === TaskTypes.SPECIAL) {
        task.isImportant = true;
    }
    
    // Рендерим карточку с помощью универсального компонента
    const cardElement = renderTaskCard(task, onActionClick);
    
    // Добавляем специфические классы в зависимости от типа задания
    if (task.type === TaskTypes.DAILY) {
        cardElement.classList.add('daily-task');
    } else if (task.type === TaskTypes.WEEKLY) {
        cardElement.classList.add('weekly-task');
    } else if (task.type === TaskTypes.SPECIAL) {
        cardElement.classList.add('special-task');
    } else if (task.type === TaskTypes.ACHIEVEMENT) {
        cardElement.classList.add('achievement-task');
    }
    
    // Проверяем, есть ли таймер истечения для задания
    // Правило 1: Истекающие таймеры должны показываться только на невыполненных задачах
    // Правило 2: Если задание выполнено (прогресс 100%), таймер не показываем (кроме заданий подписки)
    // КРИТИЧЕСКАЯ ЗАЩИТА: Если задание имеет статус 'completed', таймер НЕ показываем НИ ПРИ КАКИХ ОБСТОЯТЕЛЬСТВАХ
    const isTaskCompleted = task.progress >= 100;
    const isSubscriptionTask = task.verifierType === 'subscription';
    const isTaskFullyCompleted = task.status === 'completed'; // КРИТИЧЕСКАЯ ПРОВЕРКА
    
    const shouldShowExpirationTimer = task.expiration_timer && 
                                      !isTaskFullyCompleted && // КРИТИЧЕСКАЯ ЗАЩИТА
                                      (!isTaskCompleted || isSubscriptionTask);
    
    if (shouldShowExpirationTimer) {
        // Устанавливаем таймер истечения через TimerManager
        const expirationTime = task.expiration_timer; // время уже в миллисекундах
        TimerManager.setTimer(`expiration_${task.id}`, expirationTime, cardElement);
        
        // Добавляем класс для стилизации заданий с таймером
        cardElement.classList.add('task-with-expiration-timer');
        
        // Проверяем критическое время
        const now = Date.now();
        const timeLeft = expirationTime - now;
        const oneHour = 60 * 60 * 1000; // 1 час в миллисекундах
        const thirtyMinutes = 30 * 60 * 1000; // 30 минут в миллисекундах
        
        if (timeLeft <= thirtyMinutes && timeLeft > 0) {
            cardElement.classList.add('task-expiring-critical');
        } else if (timeLeft <= oneHour && timeLeft > 0) {
            cardElement.classList.add('task-expiring-soon');
        }
    }
    
    // Добавляем в контейнер
    if (container && cardElement) {
        container.appendChild(cardElement);
    }
    
    return cardElement;
}

// Функция проверки выполнения задания в зависимости от его механизма
export function verifyTaskCompletion(task, forceCheck = false) {
    switch (task.verifierType) {
        case 'activity':
            return TaskVerifiers.checkAppActivity(task);
        case 'inventory':
            return TaskVerifiers.checkInventory(task);
        case 'external':
            return TaskVerifiers.checkExternalActivity(task);
        case 'subscription':
            return TaskVerifiers.checkSubscription(task, forceCheck);
        case 'experience':
            return TaskVerifiers.checkExperience(task);
        default:
            console.warn(`Неизвестный тип проверки: ${task.verifierType}`);
            return Promise.resolve(false);
    }
}

// Константы для состояний заданий
export const TaskStatus = {
    NOT_STARTED: 'not_started',
    IN_PROGRESS: 'in_progress',
    COMPLETED: 'completed',
    EXPIRED: 'expired'
};

// Экспортируем функцию для выполнения задания
export async function completeTask(taskId) {
    const telegram = window.Telegram.WebApp;
    const userId = telegram.initDataUnsafe?.user?.id;
    
    if (!userId) {
        console.error('Не удалось получить ID пользователя');
        return null;
    }
    
    try {
        // Формируем URL с учетом режима разработки
        const apiUrl = window.isDevMode ? '/dev/api/tasks/complete' : '/api/tasks/complete';
        
        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: createTelegramHeaders(),
            body: JSON.stringify({
                user_id: userId,
                task_id: taskId,
                initData: getTelegramInitData() // Добавляем initData для авторизации
            })
        });
        
        if (!response.ok) {
            console.error('Ошибка при выполнении задания');
            return null;
        }
        
        const result = await response.json();
        
        if (!result.success) {
            console.error('Ошибка при выполнении задания:', result.error);
            return null;
        }
        
        // Если задание успешно выполнено и получена награда, показываем модальное окно
        if (result.success && result.reward) {
            // Инвалидируем кэш для выполненного задания
            if (window.tasksOptimizer) {
                window.tasksOptimizer.invalidateTask(userId, taskId);
            }
            
            // Сбрасываем статус показа уведомления, если функция доступна
            if (window.resetTaskNotificationStatus) {
                window.resetTaskNotificationStatus(taskId);
            }
            
            // Получаем все данные о задании
            const taskInfo = await getTaskInfo(taskId);
            
            if (taskInfo) {
                // Отображаем модальное окно с наградой
                showTaskComplete({
                    ...taskInfo,
                    reward: result.reward
                }, () => {
                    // Функция, которая будет вызвана после закрытия модального окна
                    // Обновляем страницу, чтобы отобразить новые задания
                    window.location.reload();
                });
            }
        }
        
        return result;
    } catch (error) {
        console.error('Ошибка при обращении к API:', error);
        return null;
    }
}

// Функция для получения информации о задании
export async function getTaskInfo(taskId) {
    const telegram = window.Telegram.WebApp;
    const userId = telegram.initDataUnsafe?.user?.id;
    
    if (!userId) {
        console.error('Не удалось получить ID пользователя');
        return null;
    }
    
    try {
        // Формируем URL с учетом режима разработки
        const apiUrl = window.isDevMode ? '/dev/api/tasks/get' : '/api/tasks/get';
        
        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: createTelegramHeaders(),
            body: JSON.stringify({
                user_id: userId,
                initData: getTelegramInitData() // Добавляем initData для авторизации
            })
        });
        
        if (!response.ok) {
            console.error('Ошибка при получении заданий');
            return null;
        }
        
        const result = await response.json();
        
        if (!result.success) {
            console.error('Ошибка при получении заданий:', result.error);
            return null;
        }
        
        // Ищем задание по ID
        const task = result.tasks.find(task => task.id === taskId);
        
        return task || null;
    } catch (error) {
        console.error('Ошибка при получении информации о задании:', error);
        return null;
    }
}

// Экспортируем функцию для открытия канала подписки
export { openChannelForSubscription }; 