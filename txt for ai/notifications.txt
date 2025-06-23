/**
 * Модуль для работы с уведомлениями пользователя
 * Предоставляет функции для отображения всплывающих уведомлений
 */

import * as i18n from './i18n.js';

// Переменная для очереди уведомлений, которые ждут закрытия модального окна
let notificationQueue = [];

// Флаг, указывающий открыто ли в данный момент модальное окно
let modalIsOpen = false;

// Переменные для отслеживания свайпа
let touchStartY = 0;
let touchEndY = 0;
const SWIPE_THRESHOLD = 50; // Минимальное расстояние свайпа для закрытия (в пикселях)

const crystalIcon = '<svg class="crystal-icon crystal-icon--medium"><use xlink:href="#crystal-icon"></use></svg>';

/**
 * Устанавливает состояние модального окна
 * @param {boolean} isOpen - Открыто ли модальное окно
 */
export function setModalState(isOpen) {
    modalIsOpen = isOpen;
    
    // Если модальное окно закрылось, проверяем очередь уведомлений
    if (!isOpen && notificationQueue.length > 0) {
        processNotificationQueue();
    }
}

/**
 * Обрабатывает очередь отложенных уведомлений
 */
function processNotificationQueue() {
    if (notificationQueue.length === 0) return;
    
    // Берем первое уведомление из очереди
    const nextNotification = notificationQueue.shift();
    
    // Показываем уведомление
    showNotificationDirectly(
        nextNotification.message, 
        nextNotification.options
    );
    
    // Устанавливаем таймер для обработки следующего уведомления
    // с небольшой задержкой между уведомлениями
    if (notificationQueue.length > 0) {
        setTimeout(processNotificationQueue, 500);
    }
}

/**
 * Показывает уведомление пользователю с плавной анимацией
 * @param {string} message - Текст сообщения для отображения
 * @param {object} options - Опции уведомления
 * @param {number} options.duration - Продолжительность показа в миллисекундах (по умолчанию 3000мс)
 * @param {string} options.type - Тип сообщения ('success', 'error', 'warning', 'info')
 * @param {boolean} options.useTranslation - Использовать ли перевод для сообщения (по умолчанию false)
 * @param {function} options.onClose - Функция, вызываемая при закрытии уведомления
 * @param {boolean} options.forceShow - Принудительно показать уведомление даже если открыто модальное окно
 * @returns {HTMLElement|null} Элемент уведомления или null, если уведомление добавлено в очередь
 */
export function showNotification(message, options = {}) {
    // Проверяем, открыто ли модальное окно и нужно ли отложить показ уведомления
    if (modalIsOpen && !options.forceShow) {
        // Если модальное окно открыто, добавляем уведомление в очередь
        notificationQueue.push({ message, options });
        return null;
    }
    
    // Если модальное окно не открыто, показываем уведомление сразу
    return showNotificationDirectly(message, options);
}

/**
 * Непосредственно показывает уведомление без проверки состояния модального окна
 * @param {string} message - Текст сообщения для отображения
 * @param {object} options - Опции уведомления
 * @returns {HTMLElement} Элемент уведомления
 */
function showNotificationDirectly(message, options = {}) {
    // Устанавливаем значения по умолчанию
    const {
        duration = 3000,
        type = 'info',
        useTranslation = false,
        onClose = null,
        placeholders = {}
    } = options;
    
    // Если нужно использовать перевод
    const displayMessage = useTranslation ? i18n.t(message, placeholders) : message;
    
    // Создаем элементы стилей, если они еще не существуют
    ensureStyles();
    
    // Создаем элемент уведомления
    const notificationElement = document.createElement('div');
    notificationElement.className = `giftgo-notification giftgo-notification-${type}`;
    
    // Создаем внутренний контейнер для содержимого
    const contentContainer = document.createElement('div');
    contentContainer.className = 'giftgo-notification-content';
    
    // Добавляем иконку в зависимости от типа уведомления
    let iconElement = '';
    switch (type) {
        case 'success':
            iconElement = '<span class="giftgo-notification-icon">✅</span>';
            break;
        case 'error':
            iconElement = '<span class="giftgo-notification-icon">❌</span>';
            break;
        case 'warning':
            iconElement = '<span class="giftgo-notification-icon">⚠️</span>';
            break;
        case 'info':
            iconElement = '<span class="giftgo-notification-icon">ℹ️</span>';
            break;
    }
    
    // Устанавливаем HTML содержимое контейнера
    contentContainer.innerHTML = `
        ${iconElement}
        <div class="giftgo-notification-message">${displayMessage}</div>
    `;
    
    // Добавляем контейнер в уведомление
    notificationElement.appendChild(contentContainer);
    
    // Добавляем элемент на страницу
    document.body.appendChild(notificationElement);
    
    // Показываем уведомление с задержкой для анимации
    setTimeout(() => {
        notificationElement.classList.add('show');
    }, 10);
    
    // Удаляем уведомление через указанное время
    const timeoutId = setTimeout(() => {
        hideNotification(notificationElement, onClose);
    }, duration);
    
    // Сохраняем ID таймаута для возможности отмены
    notificationElement._timeoutId = timeoutId;
    
    // Добавляем обработчик клика для закрытия уведомления
    notificationElement.addEventListener('click', () => {
        // Очищаем таймаут, чтобы предотвратить двойное удаление
        clearTimeout(notificationElement._timeoutId);
        hideNotification(notificationElement, onClose);
    });
    
    // Добавляем обработчики для свайпа вверх
    notificationElement.addEventListener('touchstart', handleTouchStart, { passive: true });
    notificationElement.addEventListener('touchmove', handleTouchMove, { passive: false });
    notificationElement.addEventListener('touchend', (e) => handleTouchEnd(e, notificationElement, onClose), { passive: true });
    
    return notificationElement;
}

/**
 * Обрабатывает начало касания для отслеживания свайпа
 * @param {TouchEvent} event - Событие касания
 */
function handleTouchStart(event) {
    touchStartY = event.touches[0].clientY;
}

/**
 * Обрабатывает движение касания для отслеживания свайпа
 * @param {TouchEvent} event - Событие касания
 */
function handleTouchMove(event) {
    if (!touchStartY) return;
    
    touchEndY = event.touches[0].clientY;
    
    // Вычисляем расстояние свайпа
    const deltaY = touchStartY - touchEndY;
    
    // Если свайп идет вверх (deltaY > 0), начинаем трансформацию
    if (deltaY > 0) {
        // Применяем трансформацию только если свайп вверх
        event.currentTarget.style.transform = `translateY(-${deltaY}px)`;
        
        // Уменьшаем непрозрачность пропорционально перемещению
        const opacity = Math.max(1 - (deltaY / 150), 0.3);
        event.currentTarget.style.opacity = opacity;
        
        // Предотвращаем прокрутку страницы при свайпе уведомления
        event.preventDefault();
    }
}

/**
 * Обрабатывает окончание касания для завершения свайпа
 * @param {TouchEvent} event - Событие касания
 * @param {HTMLElement} notificationElement - Элемент уведомления
 * @param {function|null} onClose - Функция обратного вызова после закрытия
 */
function handleTouchEnd(event, notificationElement, onClose) {
    if (!touchStartY || !touchEndY) return;
    
    // Вычисляем дистанцию свайпа
    const deltaY = touchStartY - touchEndY;
    
    // Если свайп был достаточно длинным и в правильном направлении (вверх)
    if (deltaY > SWIPE_THRESHOLD) {
        // Очищаем таймаут, чтобы предотвратить двойное удаление
        clearTimeout(notificationElement._timeoutId);
        
        // Сначала полностью уводим уведомление вверх с анимацией
        notificationElement.style.transform = `translateY(-100px)`;
        notificationElement.style.opacity = '0';
        
        // После завершения анимации удаляем элемент
        setTimeout(() => {
            hideNotification(notificationElement, onClose);
        }, 150);
    } else {
        // Возвращаем элемент на место, если свайп был недостаточным
        notificationElement.style.transform = '';
        notificationElement.style.opacity = '';
    }
    
    // Сбрасываем переменные отслеживания
    touchStartY = 0;
    touchEndY = 0;
}

/**
 * Скрывает уведомление с анимацией
 * @param {HTMLElement} notificationElement - Элемент уведомления
 * @param {function|null} onClose - Функция обратного вызова после закрытия
 */
function hideNotification(notificationElement, onClose) {
    notificationElement.classList.remove('show');
    
    // Удаляем элемент после завершения анимации
    setTimeout(() => {
        if (notificationElement.parentNode) {
            notificationElement.parentNode.removeChild(notificationElement);
            
            // Вызываем функцию обратного вызова, если она предоставлена
            if (typeof onClose === 'function') {
                onClose();
            }
        }
    }, 300);
}

/**
 * Показывает уведомление об ошибке
 * @param {string} message - Текст сообщения
 * @param {object} options - Дополнительные опции
 * @returns {HTMLElement} Элемент уведомления
 */
export function showError(message, options = {}) {
    return showNotification(message, { ...options, type: 'error' });
}

/**
 * Показывает уведомление об успехе
 * @param {string} message - Текст сообщения
 * @param {object} options - Дополнительные опции
 * @returns {HTMLElement} Элемент уведомления
 */
export function showSuccess(message, options = {}) {
    return showNotification(message, { ...options, type: 'success' });
}

/**
 * Показывает предупреждающее уведомление
 * @param {string} message - Текст сообщения
 * @param {object} options - Дополнительные опции
 * @returns {HTMLElement} Элемент уведомления
 */
export function showWarning(message, options = {}) {
    return showNotification(message, { ...options, type: 'warning' });
}

/**
 * Показывает информационное уведомление
 * @param {string} message - Текст сообщения
 * @param {object} options - Дополнительные опции
 * @returns {HTMLElement} Элемент уведомления
 */
export function showInfo(message, options = {}) {
    return showNotification(message, { ...options, type: 'info' });
}

/**
 * Создает и добавляет стили для уведомлений, если они еще не существуют
 */
function ensureStyles() {
    if (document.getElementById('giftgo-notification-styles')) {
        return;
    }
    
    const styleElement = document.createElement('style');
    styleElement.id = 'giftgo-notification-styles';
    
    // Используем цветовую схему Telegram через CSS переменные
    styleElement.textContent = `
        .giftgo-notification {
            position: fixed;
            top: -100px;
            left: 0;
            right: 0;
            width: calc(100% - 16px);
            margin-left: auto;
            margin-right: auto;
            padding: 0;
            border-radius: 12px;
            background-color: rgba(var(--tg-theme-bg-color-rgb, 24, 34, 45), 0.8);
            color: var(--tg-theme-text-color, #ffffff);
            backdrop-filter: blur(8px);
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
            z-index: 9999;
            transition: transform 0.3s ease-out, opacity 0.3s ease-out, top 0.3s ease-out;
            opacity: 0;
            max-width: 600px;
            touch-action: none; /* Предотвращаем стандартное поведение свайпа */
            user-select: none; /* Предотвращаем выделение текста при свайпе */
        }
        
        .giftgo-notification-content {
            padding: 12px 16px;
            display: flex;
            align-items: flex-start;
            text-align: left;
        }
        
        .giftgo-notification.show {
            top: 16px;
            opacity: 1;
        }
        
        .giftgo-notification-icon {
            flex-shrink: 0;
            margin-right: 10px;
            font-size: 18px;
        }
        
        .giftgo-notification-message {
            flex-grow: 1;
            font-size: 15px;
            line-height: 1.4;
        }
        
        .giftgo-notification .crystal-icon {
            width: 16px;
            height: 16px;
            fill: var(--tg-theme-text-color, #fff);
            margin-left: 2px;
            vertical-align: middle;
            display: inline-flex;
            align-items: center;
        }
        
        .giftgo-notification-success {
            border-left: 4px solid #4CAF50;
        }
        
        .giftgo-notification-error {
            border-left: 4px solid #F44336;
        }
        
        .giftgo-notification-warning {
            border-left: 4px solid #FFC107;
        }
        
        .giftgo-notification-info {
            border-left: 4px solid var(--tg-theme-button-color, #5eacef);
        }
        
        @media (max-width: 480px) {
            .giftgo-notification {
                width: calc(100% - 16px);
            }
        }
    `;
    
    document.head.appendChild(styleElement);
}

/**
 * Закрывает все открытые модальные окна в приложении
 */
function closeAllModals() {
    // Проверяем, не находимся ли мы в модальном окне оплаты Telegram
    if (window.Telegram && window.Telegram.WebApp && window.Telegram.WebApp.isExpanded) {
        console.log('[NOTIFICATION] Замечено, что открыто окно Telegram WebApp, не закрываем его');
        setModalState(false);
        return;
    }

    // Закрываем основное модальное окно выигрыша
    const winModal = document.getElementById('winModal');
    if (winModal && winModal.classList.contains('show')) {
        winModal.classList.remove('show');
    }
    
    // Закрываем демо-модальное окно
    const demoWinModal = document.getElementById('demoWinModal');
    if (demoWinModal && demoWinModal.classList.contains('show')) {
        demoWinModal.classList.remove('show');
    }
    
    // Закрываем модальное окно предпросмотра подарка
    const giftModal = document.getElementById('giftModal');
    if (giftModal && giftModal.classList.contains('show')) {
        giftModal.classList.remove('show');
    }
    
    // Закрываем модальное окно предпросмотра подарка (альтернативное id)
    const previewGiftModal = document.getElementById('previewGiftModal');
    if (previewGiftModal && previewGiftModal.classList.contains('show')) {
        previewGiftModal.classList.remove('show');
    }
    
    // Закрываем диалог подтверждения
    const confirmDialog = document.getElementById('giftConfirmDialog');
    if (confirmDialog && confirmDialog.classList.contains('show')) {
        confirmDialog.classList.remove('show');
        setTimeout(() => {
            if (confirmDialog && confirmDialog.parentNode) {
                confirmDialog.parentNode.removeChild(confirmDialog);
            }
        }, 300);
    }
    
    // Закрываем диалог username
    const usernameDialog = document.getElementById('usernameRequiredDialog');
    if (usernameDialog && usernameDialog.classList.contains('show')) {
        usernameDialog.classList.remove('show');
        setTimeout(() => {
            if (usernameDialog && usernameDialog.parentNode) {
                usernameDialog.parentNode.removeChild(usernameDialog);
            }
        }, 300);
    }
    
    // Убираем класс блокировки прокрутки страницы
    document.body.classList.remove('modal-open');
    
    // Устанавливаем состояние модальных окон как закрытое
    setModalState(false);
}

/**
 * Показывает уведомление о достижении дневного лимита отправки подарков
 * @param {string} resetTime - Время сброса лимита в формате HH:MM
 * @returns {HTMLElement} Элемент уведомления
 */
export function showDailyLimitReached(resetTime) {
    // Закрываем все модальные окна перед показом уведомления
    closeAllModals();
    
    // Показываем уведомление о превышении лимита
    return showError('errors.daily_limit_reached', { 
        useTranslation: true,
        duration: 5000,
        forceShow: true, // Принудительно показываем уведомление даже если модальное окно было открыто
        placeholders: { resetTime: resetTime || '--:--' }
    });
}

/**
 * Показывает уведомление об успешном пополнении баланса
 * @param {number} amount - Сумма пополнения
 * @returns {HTMLElement} Элемент уведомления
 */
export function showBalanceAdded(amount) {
    // Закрываем все модальные окна перед показом уведомления
    closeAllModals();
    
    // Проверим наличие перевода напрямую
    const translationKey = 'payment.balance_added';
    const translation = i18n.t(translationKey, { amount });
    
    // Если перевод совпадает с ключом, значит перевод не найден
    if (translation === translationKey) {
        // Вместо ключа используем универсальный текст на русском и английском
        const fallbackText = i18n.getCurrentLanguage() === 'ru' 
            ? `Баланс пополнен на ${amount}${crystalIcon}` 
            : `Balance added: ${amount}${crystalIcon}`;
        
        // Показываем уведомление с запасным текстом
        return showSuccess(fallbackText, { 
            useTranslation: false,
            duration: 4000,
            forceShow: true
        });
    }
    
    // Опции уведомления с подстановкой суммы в плейсхолдер
    const options = {
        useTranslation: true,
        duration: 4000,
        forceShow: true,
        placeholders: { amount }
    };
    
    // Заменяем слово crystal на SVG иконку в строке перевода
    const displayMessage = translation.replace('crystal', crystalIcon);
    
    // Показываем уведомление об успешном пополнении
    return showSuccess(displayMessage, {
        useTranslation: false, // Уже заменили текст, не нужен перевод
        duration: 4000,
        forceShow: true
    });
}

/**
 * Показывает уведомление об успешной продаже подарка
 * @param {number} amount - Сумма полученная от продажи
 * @returns {HTMLElement} Элемент уведомления
 */
export function showGiftSold(amount) {
    // Закрываем все модальные окна перед показом уведомления
    closeAllModals();
    
    // Проверим наличие перевода
    const translationKey = 'payment.gift_sold';
    const translation = i18n.t(translationKey, { amount });
    
    // Если перевод не найден, используем запасной текст
    if (translation === translationKey) {
        const fallbackText = i18n.getCurrentLanguage() === 'ru' 
            ? `Ваш подарок успешно продан за ${amount}${crystalIcon}` 
            : `Your gift was successfully sold for ${amount}${crystalIcon}`;
        
        return showSuccess(fallbackText, { 
            useTranslation: false,
            duration: 4000,
            forceShow: true
        });
    }
    
    // Заменяем слово crystal на SVG иконку в строке перевода
    const displayMessage = translation.replace('crystal', crystalIcon);
    
    // Показываем уведомление
    return showSuccess(displayMessage, { 
        useTranslation: false, // Уже заменили текст, не нужен перевод
        duration: 4000,
        forceShow: true
    });
}

/**
 * Показывает уведомление о выполнении задания "Провести 10 игр"
 * @returns {HTMLElement} Элемент уведомления
 */
export function showTaskPlayTenGamesCompleted() {
    return showInfo(i18n.t('tasks.notification_play_ten_games_completed'), {
        duration: 5000
    });
}

/**
 * Показывает уведомление о выполнении задания "Провести 5 игр"
 * @returns {HTMLElement} Элемент уведомления
 */
export function showTaskPlayFiveGamesCompleted() {
    return showInfo(i18n.t('tasks.notification_play_five_games_completed'), {
        duration: 5000
    });
}

/**
 * Показывает уведомление о выполнении задания "Провести 500 игр"
 * @returns {HTMLElement} Элемент уведомления
 */
export function showTaskPlay500GamesCompleted() {
    return showInfo(i18n.t('tasks.notification_play_500_games_completed'), {
        duration: 5000
    });
}

/**
 * Показывает уведомление о выполнении задания сбора коллекции
 * @param {Object} task - Объект задания
 * @returns {HTMLElement} Элемент уведомления
 */
export function showTaskCollectionCompleted(task = null) {
    // Проверяем, передан ли объект задания
    if (!task) {
        // Если задание не передано, используем просто ключ перевода без параметров
        return showInfo(i18n.t('tasks.notification_collection_completed'), {
            duration: 5000
        });
    }
    
    // Если задание передано, используем параметры из него для подстановки в перевод
    const placeholders = {
        collectionEmoji: task.collectionEmoji || '',
        requiredCountForDisplay: task.requiredCountForDisplay || '',
        rewardValueForDisplay: task.rewardValueForDisplay || ''
    };
    
    // Получаем перевод с плейсхолдерами
    const translationText = i18n.t('tasks.notification_collection_completed', placeholders);
    
    // Заменяем слово "кристаллов" на SVG иконку в строке перевода
    const displayMessage = translationText.replace(/кристаллов|crystals/gi, crystalIcon);
    
    // Показываем уведомление с обработанным текстом
    return showInfo(displayMessage, {
        useTranslation: false, // Уже заменили текст, не нужен перевод
        duration: 5000
    });
}

/**
 * Показывает уведомление о выполнении задания достижения быстрой игры
 * @returns {HTMLElement} Элемент уведомления
 */
export function showTaskAchievementFastPlayCompleted() {
    return showInfo(i18n.t('tasks.notification_achievement_fast_play_completed'), {
        duration: 5000
    });
}

/**
 * Показывает уведомление о выполнении задания
 * @param {string|Object} taskTitleOrTask - Название задания или объект задания
 * @returns {HTMLElement} Элемент уведомления
 */
export function showTaskCompleted(taskTitleOrTask) {
    let taskTitle;
    
    // Проверяем, передан ли объект задания или строка
    if (typeof taskTitleOrTask === 'object' && taskTitleOrTask !== null) {
        // Если передан объект задания, пытаемся получить локализованное название
        if (taskTitleOrTask.id) {
            const taskKey = taskTitleOrTask.id.replace(/-/g, '_'); // Заменяем дефисы на подчеркивания
            taskTitle = i18n.t(`tasks.task_titles.${taskKey}`, { defaultValue: taskTitleOrTask.title });
        } else {
            taskTitle = taskTitleOrTask.title;
        }
    } else {
        // Если передана строка, используем её как название
        taskTitle = taskTitleOrTask;
    }
    
    return showInfo(i18n.t('tasks.notification_task_completed', { taskTitle }), {
        duration: 5000
    });
} 