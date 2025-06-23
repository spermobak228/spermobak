/**
 * Модуль содержит общие функции для работы с подарками
 * Используется модальными окнами выигрыша и просмотра подарков
 */

import { formatGiftPrice } from './ui-utils.js';
import { showConfirmDialog, createSellButtonText } from './confirm-modal.js';
import * as i18n from './i18n.js';
import { showSuccess, showError, showWarning, showDailyLimitReached, setModalState } from './notifications.js';

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

/**
 * Показывает модальное окно с предупреждением о необходимости установки юзернейма
 * @param {Function} onClose - Функция, вызываемая при закрытии окна
 * @returns {HTMLElement} - Созданное модальное окно
 */
export function showUsernameRequiredDialog(onClose) {
    // Уведомляем модуль notifications, что открывается модальное окно
    setModalState(true);
    
    // Проверяем, существует ли уже диалог
    let usernameDialog = document.getElementById('usernameRequiredDialog');
    if (usernameDialog) {
        // Если диалог уже существует, удаляем его
        usernameDialog.remove();
    }
    
    // Создаем новый диалог
    usernameDialog = document.createElement('div');
    usernameDialog.id = 'usernameRequiredDialog';
    usernameDialog.className = 'win-modal confirmation-dialog';
    
    // Создаем содержимое диалога
    usernameDialog.innerHTML = `
        <h2>${i18n.t('gifts.username_required')}</h2>
        <p class="confirmation-message">
            ⚠️ ${i18n.t('gifts.username_required_explanation')}
            <br>
            ${i18n.t('gifts.exclusive_fragment_requirement')}
        </p>
        <div class="win-actions confirmation-actions">
            <button class="action-button confirm-button">${i18n.t('common.understand')}</button>
        </div>
    `;
    
    // Добавляем стили для диалога если их нет
    if (!document.getElementById('username-dialog-styles')) {
        const styleElement = document.createElement('style');
        styleElement.id = 'username-dialog-styles';
        styleElement.textContent = `
            #usernameRequiredDialog .confirmation-message {
                margin-bottom: 20px;
                line-height: 1.5;
                color: var(--tg-theme-text-color, #000000);
                text-align: center;
                max-width: 340px;
                width: 100%;
            }
            #usernameRequiredDialog .action-button {
                background-color: var(--tg-theme-button-color, #2196F3);
                color: var(--tg-theme-button-text-color, white);
                font-weight: bold;
                height: 50px;
                line-height: 46px;
                font-size: 16px;
                padding: 0 15px;
            }
            #usernameRequiredDialog.confirmation-dialog {
                padding: 20px;
            }
        `;
        document.head.appendChild(styleElement);
    }
    
    // Добавляем диалог на страницу
    document.body.appendChild(usernameDialog);
    
    // Получаем ссылку на кнопку
    const confirmButton = usernameDialog.querySelector('.confirm-button');
    
    // Добавляем обработчик события
    if (confirmButton) {
        confirmButton.addEventListener('click', function() {
            if (typeof onClose === 'function') {
                onClose();
            }
            usernameDialog.classList.remove('show');
            setTimeout(() => {
                usernameDialog.remove();
            }, 300);
        });
    }
    
    // Показываем диалог
    usernameDialog.classList.add('show');
    
    return usernameDialog;
}

/**
 * Отображает анимацию подарка в контейнере
 * @param {Object} gift - Объект с данными подарка
 * @param {HTMLElement} container - Контейнер для отображения подарка
 */
export function displayGiftAnimation(gift, container) {
    if (!container) return;
    
    // Очищаем контейнер
    container.innerHTML = '';
    
    // Отображаем анимацию подарка, если она доступна
    const animationPath = gift.animation_path || gift.animation;
    
    if (animationPath) {
        if (animationPath.endsWith('.tgs')) {
            try {
                // Проверяем наличие tgs-player
                if (customElements.get('tgs-player')) {
                    // Используем tgs-player для TGS анимаций
                    const tgsPlayer = document.createElement('tgs-player');
                    // Добавляем проверку на наличие префикса '/dev' для режима разработки
                    const isDevMode = window.isDevMode || window.location.pathname.includes('/dev/');
                    const apiPrefix = isDevMode && !animationPath.startsWith('/dev') ? '/dev' : '';
                    tgsPlayer.setAttribute('src', apiPrefix + animationPath);
                    tgsPlayer.setAttribute('autoplay', 'true');
                    container.appendChild(tgsPlayer);
                } else {
                    // Если tgs-player не доступен, используем эмодзи
                    container.innerHTML = `<div class="gift-emoji">${gift.emoji || '🎁'}</div>`;
                }
            } catch (e) {
                console.error('Ошибка при загрузке TGS анимации:', e);
                container.innerHTML = `<div class="gift-emoji">${gift.emoji || '🎁'}</div>`;
            }
        } else if (animationPath.endsWith('.json')) {
            try {
                // Добавляем проверку на наличие lottie
                if (typeof lottie !== 'undefined') {
                    lottie.loadAnimation({
                        container: container,
                        renderer: 'svg',
                        loop: true,
                        autoplay: true,
                        path: animationPath
                    });
                } else {
                    console.error('Lottie библиотека не загружена');
                    container.innerHTML = `<div class="gift-emoji">${gift.emoji || '🎁'}</div>`;
                }
            } catch (e) {
                console.error('Ошибка при загрузке JSON анимации:', e);
                container.innerHTML = `<div class="gift-emoji">${gift.emoji || '🎁'}</div>`;
            }
        } else {
            container.innerHTML = `<div class="gift-emoji">${gift.emoji || '🎁'}</div>`;
        }
    } else {
        // Если анимации нет, отображаем эмодзи
        container.innerHTML = `<div class="gift-emoji">${gift.emoji || '🎁'}</div>`;
    }
}

/**
 * Обрабатывает получение эксклюзивного подарка
 * @param {Object} gift - Объект с данными подарка
 * @param {Function} closeModalFn - Функция для закрытия модального окна
 * @param {Function} updateUiFn - Функция для обновления интерфейса
 * @param {HTMLElement} buttonElement - Кнопка, которая была нажата
 */
export function handleExclusiveGiftReceive(gift, closeModalFn, updateUiFn, buttonElement) {
    showConfirmDialog({
        hideTitle: true, // Скрываем заголовок
        message: `${gift.emoji || '🎁'} ${i18n.t('gifts.exclusive_gift_manual_message')}`,
        confirmText: 'OK',
        cancelText: i18n.t('common.cancel'),
        simpleLayout: true, // Используем простой макет с ОК справа и темной Отмена слева
        onConfirm: async () => {
            try {
                // Закрываем модальное окно сразу
                if (typeof closeModalFn === 'function') {
                    closeModalFn();
                }
                
                // Отключаем кнопку, но не меняем текст
                buttonElement.disabled = true;
                
                // Получаем данные пользователя
                const tg = window.Telegram.WebApp;
                const userId = tg.initDataUnsafe?.user?.id;
                const firstName = tg.initDataUnsafe?.user?.first_name || '';
                const username = tg.initDataUnsafe?.user?.username || '';
                
                if (!userId) {
                    showError(i18n.t('errors.failed_to_get_user_id'));
                    buttonElement.disabled = false;
                    return;
                }
                
                // Формируем данные для запроса
                const requestData = {
                    user_id: userId,
                    gift_id: gift.gift_id || gift.id,
                    exclusive_request: true, // Флаг для обозначения запроса эксклюзивного подарка
                    user_info: {
                        first_name: firstName,
                        username: username
                    }
                };
                
                // Если есть ugift_id, добавляем его в запрос
                if (gift.ugift_id) {
                    requestData.ugift_id = gift.ugift_id;
                }
                
                // Получаем текущий тип ставки из локального хранилища или используем значение из gift
                const betSource = gift.bet_amount || localStorage.getItem('selectedBetType') || 'low';
                requestData.bet_amount = betSource;
                
                // Проверяем, находимся ли мы в режиме разработки
                const isDevMode = window.isDevMode || window.location.pathname.includes('/dev/');
                const apiPrefix = isDevMode ? '/dev' : '';
                
                // Отправляем запрос на сервер для запроса эксклюзивного подарка
                const response = await fetch(`${apiPrefix}/api/send_gift`, {
                    method: 'POST',
                    headers: createTelegramHeaders(),
                    body: JSON.stringify({
                        ...requestData,
                        initData: getTelegramInitData() // Добавляем initData для авторизации
                    })
                });
                
                const result = await response.json();
                
                if (result.success) {
                    // Проверяем наличие username после успешной отправки заявки
                    if (!username) {
                        // Показываем модальное окно о необходимости установки username
                        showUsernameRequiredDialog(() => {
                            console.log('Диалог с предупреждением о необходимости установки username закрыт');
                            
                            // Показываем сообщение об успешной отправке заявки ПОСЛЕ закрытия диалога username
                            showSuccess(i18n.t('gifts.request_sent_success'));
                            
                            // Обновляем интерфейс если нужно
                            if (typeof updateUiFn === 'function') {
                                updateUiFn();
                            }
                        });
                        
                        // Отправляем запрос на сервер для уведомления в бот о необходимости установки username
                        fetch(`${apiPrefix}/api/send_gift`, {
                            method: 'POST',
                            headers: createTelegramHeaders(),
                            body: JSON.stringify({
                                user_id: userId,
                                username_required_notification: true,
                                gift_id: gift.gift_id || gift.id,
                                initData: getTelegramInitData() // Добавляем initData для авторизации
                            })
                        }).catch(error => {
                            console.error('Ошибка при отправке уведомления о необходимости username:', error);
                        });
                    } else {
                        // Если username есть, показываем стандартное сообщение об успешной отправке заявки
                        showSuccess(i18n.t('gifts.request_sent_success'));
                        
                        // Обновляем интерфейс если нужно
                        if (typeof updateUiFn === 'function') {
                            updateUiFn();
                        }
                    }
                } else {
                    // Проверяем наличие ошибки о достижении дневного лимита
                    if (result.error_key === 'daily_limit_reached' || (result.error && result.error.includes('daily_limit_reached'))) {
                        showDailyLimitReached(result.reset_time_str);
                    } else {
                        // Показываем другие ошибки
                        showError(result.error || i18n.t('errors.failed_to_send_request'));
                        
                        // Восстанавливаем кнопку
                        buttonElement.disabled = false;
                    }
                }
            } catch (error) {
                // В случае ошибки показываем сообщение
                console.error('Ошибка при отправке заявки:', error);
                showError(i18n.t('errors.request_error'));
                
                // Восстанавливаем кнопку
                buttonElement.disabled = false;
            }
        },
        onCancel: () => {
            // Сбрасываем флаг отправки при отмене, НЕ закрывая основное модальное окно
            buttonElement.disabled = false;
            console.log('Отмена подтверждения для эксклюзивного подарка');
            
            // Проверяем, есть ли у элемента кнопки свойство __isSending
            // и сбрасываем его, чтобы разблокировать возможность повторного нажатия
            if (buttonElement) {
                // Ищем родительский элемент с isSending
                let parent = buttonElement.parentNode;
                while (parent) {
                    if (parent.querySelector && parent.querySelector('#receiveModalGift')) {
                        const receiveButton = parent.querySelector('#receiveModalGift');
                        // Устанавливаем свойство через dataset для доступа из обработчика кнопки
                        receiveButton.dataset.isSending = 'false';
                        break;
                    }
                    parent = parent.parentNode;
                }
            }
        }
    });
}

/**
 * Обрабатывает получение обычного подарка
 * @param {Object} gift - Объект с данными подарка
 * @param {Function} closeModalFn - Функция для закрытия модального окна
 * @param {Function} updateUiFn - Функция для обновления интерфейса
 * @param {Function} sellGiftFn - Функция для продажи подарка
 * @param {HTMLElement} buttonElement - Кнопка, которая была нажата
 */
export function handleRegularGiftReceive(gift, closeModalFn, updateUiFn, sellGiftFn, buttonElement) {
    const giftValue = gift.star_count || gift.value || 0;
    
    // Создаем текст кнопки продажи с иконкой кристалла
    const sellButtonText = createSellButtonText(i18n.t('gifts.sell_for'), formatGiftPrice(giftValue));
    
    showConfirmDialog({
        hideTitle: true, // Скрываем заголовок
        message: `${gift.emoji || '🎁'} ${i18n.t('gifts.send_to_self_warning')}`,
        confirmText: 'OK',
        cancelText: i18n.t('common.cancel'),
        simpleLayout: true, // Используем простой макет с ОК справа и темной Отмена слева
        reverseButtons: true, // Меняем порядок кнопок для окна подтверждения отправки подарка
        onConfirm: async () => {
            try {
                // Закрываем модальное окно сразу
                if (typeof closeModalFn === 'function') {
                    closeModalFn();
                }
                
                // Отключаем кнопку, но не меняем текст
                buttonElement.disabled = true;
                
                // Получаем данные пользователя из Telegram WebApp
                const tg = window.Telegram.WebApp;
                const userId = tg.initDataUnsafe?.user?.id;
                
                if (!userId) {
                    showError(i18n.t('errors.failed_to_get_user_id'));
                    buttonElement.disabled = false;
                    return;
                }
                
                // Формируем данные для запроса
                const requestData = {
                    user_id: userId,
                    gift_id: gift.gift_id || gift.id,
                };
                
                // Если есть ugift_id, добавляем его в запрос
                if (gift.ugift_id) {
                    requestData.ugift_id = gift.ugift_id;
                }
                
                // Проверяем, находимся ли мы в режиме разработки
                const isDevMode = window.isDevMode || window.location.pathname.includes('/dev/');
                const apiPrefix = isDevMode ? '/dev' : '';
                
                // Отправляем запрос на сервер для отправки подарка
                const response = await fetch(`${apiPrefix}/api/send_gift`, {
                    method: 'POST',
                    headers: createTelegramHeaders(),
                    body: JSON.stringify({
                        ...requestData,
                        initData: getTelegramInitData() // Добавляем initData для авторизации
                    })
                });
                
                const result = await response.json();
                
                if (result.success) {
                    // Показываем сообщение об успешной отправке
                    showSuccess('✅ ' + result.message);
                    
                    // Обновляем интерфейс если нужно
                    if (typeof updateUiFn === 'function') {
                        updateUiFn();
                    }
                } else {
                    // Проверяем наличие ошибки о достижении дневного лимита
                    if (result.error_key === 'daily_limit_reached' || (result.error && result.error.includes('daily_limit_reached'))) {
                        showDailyLimitReached(result.reset_time_str);
                    } else {
                        // Показываем другие ошибки
                        showError(result.error || i18n.t('errors.failed_to_send_gift'));
                        
                        // Восстанавливаем кнопку
                        buttonElement.disabled = false;
                    }
                }
            } catch (error) {
                // В случае ошибки показываем сообщение
                console.error('Ошибка при отправке подарка:', error);
                showError(i18n.t('errors.gift_send_error'));
                
                // Восстанавливаем кнопку
                buttonElement.disabled = false;
            }
        },
        onCancel: () => {
            // Сбрасываем флаг отправки при отмене, НЕ закрывая основное модальное окно
            buttonElement.disabled = false;
            console.log('Отмена подтверждения для обычного подарка');
            
            // Проверяем, есть ли у элемента кнопки свойство __isSending
            // и сбрасываем его, чтобы разблокировать возможность повторного нажатия
            if (buttonElement) {
                // Ищем родительский элемент с isSending
                let parent = buttonElement.parentNode;
                while (parent) {
                    if (parent.querySelector && parent.querySelector('#receiveModalGift')) {
                        const receiveButton = parent.querySelector('#receiveModalGift');
                        // Устанавливаем свойство через dataset для доступа из обработчика кнопки
                        receiveButton.dataset.isSending = 'false';
                        break;
                    }
                    parent = parent.parentNode;
                }
            }
        }
    });
} 