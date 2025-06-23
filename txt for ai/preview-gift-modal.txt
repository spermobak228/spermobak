/**
 * Модуль для работы с модальным окном просмотра подарка
 * Содержит функции для отображения и управления модальным окном просмотра подарка из профиля
 */

import { formatNumber, formatGiftPrice } from './ui-utils.js';
import { showConfirmationDialog } from './modal.js';
import * as i18n from './i18n.js';
import { showSuccess, showError, showWarning, showDailyLimitReached, setModalState } from './notifications.js';
import { showUsernameRequiredDialog, displayGiftAnimation, handleExclusiveGiftReceive, handleRegularGiftReceive } from './gift-actions.js';

/**
 * Создает модальное окно для просмотра подарка в профиле
 * @returns {HTMLElement} Созданное модальное окно
 */
export function createGiftModal(sellGiftCallback) {
    // Проверяем, существует ли уже модальное окно
    let giftModal = document.getElementById('giftModal');
    if (giftModal) {
        return giftModal;
    }
    
    // Создаем элементы модального окна
    giftModal = document.createElement('div');
    giftModal.className = 'win-modal';
    giftModal.id = 'giftModal';
    
    // Базовая структура модального окна
    // Конкретное содержимое будет добавлено при вызове showGiftModal
    giftModal.innerHTML = `
        <div class="win-modal-content">
            <button class="close-button" id="giftModalClose">✕</button>
            <h2>${i18n.t('gifts.your_gift')}</h2>
            <div class="won-gift" id="modalGift"></div>
            <div class="question-container">
                <div class="question-text" id="actionQuestionText">
                    ${i18n.t('gifts.what_do_you_want_to_do')}
                </div>
            </div>
            <div class="win-actions">
                <div class="send-button-container">
                    <button class="action-button" id="sendGift">
                        ${i18n.t('gifts.send_button')}
                    </button>
                    <div class="send-options-container" id="sendOptionsContainer">
                        <div class="send-options">
                            <button class="action-button" id="receiveModalGift">
                                ${i18n.t('gifts.send_to_self')}
                            </button>
                            <button class="action-button" id="shareModalGift">
                                ${i18n.t('gifts.send_to_friend')}
                            </button>
                        </div>
                    </div>
                </div>
                <button class="action-button" id="sellModalGift">${i18n.t('gifts.sell_for')} <span class="gift-value">0</span><svg class="crystal-icon"><use xlink:href="#crystal-icon"></use></svg></button>
            </div>
        </div>
    `;
    
    // Добавляем модальное окно на страницу
    document.body.appendChild(giftModal);
    
    return giftModal;
}

/**
 * Показывает модальное окно с подарком из профиля
 * @param {Object} gift - Данные о подарке
 * @param {Function} sellGiftFn - Функция для продажи подарка
 * @param {Function} updateGiftsFn - Функция для обновления списка подарков
 */
export function showGiftModal(gift, sellGiftFn, updateGiftsFn) {
    // Уведомляем модуль notifications, что открывается модальное окно
    setModalState(true);
    
    // Создаем модальное окно
    let giftModal = document.getElementById('giftModal');
    
    // Если модальное окно не существует, создаем его
    if (!giftModal) {
        giftModal = document.createElement('div');
        giftModal.id = 'giftModal';
        giftModal.className = 'win-modal';
        document.body.appendChild(giftModal);
    }
    
    // Получаем значение подарка, используя star_count или value
    const giftValue = gift.star_count || gift.value || 0;
    
    // Проверяем доступность подарка
    const isAvailable = gift.available !== false; // Если available не определено или true - подарок доступен
    
    // Проверяем, является ли подарок эксклюзивным
    const isExclusive = gift.type === 'exclusive' || gift.gift_type === 'exclusive';
    
    // Для эксклюзивных подарков всегда считаем их доступными, даже если available=false
    const effectivelyAvailable = isExclusive ? true : isAvailable;
    
    // Создаем содержимое модального окна
    giftModal.innerHTML = `
        <div class="modal-content">
            <button class="close-button" id="giftModalClose">✕</button>
            <h2>${i18n.t('gifts.your_gift')}</h2>
            <div class="won-gift" id="modalGift"></div>
            ${!effectivelyAvailable ? `<div class="gift-unavailable-message">${i18n.t('gifts.gift_sold_out')}</div>` : ''}
            ${isExclusive ? `<div class="gift-exclusive-message" style="margin-bottom: 15px;"><strong>${gift.gift_id || i18n.t('gifts.exclusive_gift')}</strong></div>` : ''}
            <div class="question-container">
                <div class="question-text" id="actionQuestionText">
                    ${i18n.t('gifts.what_do_you_want_to_do')}
                </div>
            </div>
            <div class="win-actions">
                <div class="send-button-container">
                    <button class="action-button ${!effectivelyAvailable ? 'disabled' : ''}" id="sendGift" ${!effectivelyAvailable ? 'disabled' : ''}>
                        ${i18n.t('gifts.send_button')}
                    </button>
                    <div class="send-options-container" id="sendOptionsContainer">
                        <div class="send-options">
                            <button class="action-button" id="receiveModalGift">
                                ${i18n.t('gifts.send_to_self')}
                            </button>
                            <button class="action-button" id="shareModalGift">
                                ${i18n.t('gifts.send_to_friend')}
                            </button>
                        </div>
                    </div>
                </div>
                <button class="action-button" id="sellModalGift">${i18n.t('gifts.sell_for')} ${formatGiftPrice(giftValue)}<svg class="crystal-icon"><use xlink:href="#crystal-icon"></use></svg></button>
            </div>
        </div>
    `;
    
    // Добавляем стили для неактивной кнопки и сообщения о недоступности, если их еще нет
    if (!document.getElementById('gift-modal-styles')) {
        const styleElement = document.createElement('style');
        styleElement.id = 'gift-modal-styles';
        styleElement.textContent = `
            .disabled {
                opacity: 0.5;
                cursor: not-allowed;
            }
            .gift-unavailable-message {
                color: #ff5252;
                font-size: 14px;
                margin: 10px 0;
                text-align: center;
                font-weight: bold;
            }
            .gift-exclusive-message, .exclusive-gift-message {
                color: var(--tg-theme-text-color, #000000);
                font-size: 14px;
                margin: 10px 0;
                text-align: center;
                font-weight: bold;
            }
            .loading-spinner {
                display: block;
                width: 16px;
                height: 16px;
                border: 2px solid rgba(255, 255, 255, 0.3);
                border-top: 2px solid #ffffff;
                border-radius: 50%;
                animation: spin 1s linear infinite;
                margin: 0 auto;
            }
            .action-button.loading {
                display: flex;
                align-items: center;
                justify-content: center;
            }
            @keyframes spin {
                0% { transform: rotate(0deg); }
                100% { transform: rotate(360deg); }
            }
        `;
        document.head.appendChild(styleElement);
    }
    
    // Отображаем модальное окно
    giftModal.classList.add('show');
    
    // Получаем элемент для отображения подарка
    const modalGift = document.getElementById('modalGift');
    
    // Используем общую функцию для отображения анимации подарка
    displayGiftAnimation(gift, modalGift);
    
    // Добавляем обработчики событий
    
    // Кнопка закрытия
    const closeButton = document.getElementById('giftModalClose');
    if (closeButton) {
        closeButton.addEventListener('click', function() {
            giftModal.classList.remove('show');
            
            // Уведомляем модуль notifications, что модальное окно закрылось
            setModalState(false);
        });
    }
    
    // Кнопка "Отправить" для открытия опций выбора получателя
    const sendButton = document.getElementById('sendGift');
    const sendOptionsContainer = document.getElementById('sendOptionsContainer');
    const actionQuestionText = document.getElementById('actionQuestionText');
    
    if (sendButton && sendOptionsContainer && actionQuestionText) {
        sendButton.addEventListener('click', function() {
            // Показываем контейнер с опциями выбора получателя
            sendOptionsContainer.classList.add('show');
            
            // Меняем текст вопроса
            actionQuestionText.textContent = i18n.t('gifts.send_to_recipient_question');
            
            // Скрываем основную кнопку отправки с помощью класса
            sendButton.classList.add('hidden');
        });
    }
    
    // Кнопка "Получить" (Отправить себе)
    const receiveButton = document.getElementById('receiveModalGift');
    if (receiveButton) {
        // Инициализируем dataset.isSending
        receiveButton.dataset.isSending = 'false';
        
        receiveButton.addEventListener('click', function() {
            // Предотвращаем повторные нажатия во время активной отправки
            if (receiveButton.dataset.isSending === 'true') {
                console.log('Процесс отправки уже идет, игнорируем повторное нажатие');
                return;
            }
            
            // Устанавливаем флаг отправки
            receiveButton.dataset.isSending = 'true';
            
            // Создаем функцию для закрытия окна
            const closeModalFn = () => {
                giftModal.classList.remove('show');
                setModalState(false);
                // Сбрасываем флаг отправки
                receiveButton.dataset.isSending = 'false';
            };
            
            // Оборачиваем функцию для продажи подарка
            const wrappedSellGiftFn = (giftId, value, skipConfirmation) => {
                // Вызываем функцию продажи подарка
                return sellGiftFn(giftId, value, skipConfirmation)
                    .finally(() => {
                        // В любом случае сбрасываем флаг отправки
                        receiveButton.dataset.isSending = 'false';
                    });
            };
            
            // Проверяем, является ли подарок эксклюзивным
            const isExclusive = gift.type === 'exclusive' || gift.gift_type === 'exclusive';
            
            if (isExclusive) {
                // Используем общую функцию для обработки эксклюзивных подарков
                handleExclusiveGiftReceive(
                    gift,
                    closeModalFn,
                    updateGiftsFn,
                    this
                );
            } else {
                // Используем общую функцию для обработки обычных подарков
                handleRegularGiftReceive(
                    gift,
                    closeModalFn,
                    updateGiftsFn,
                    wrappedSellGiftFn,
                    this
                );
            }
        });
    }
    
    // Кнопка "Отправить другу"
    const shareButton = document.getElementById('shareModalGift');
    if (shareButton) {
        // Флаг для отслеживания процесса отправки
        let isSharing = false;
        
        shareButton.addEventListener('click', async function() {
            // Предотвращаем повторные нажатия во время активной отправки
            if (isSharing) {
                console.log('Процесс шеринга уже идет, игнорируем повторное нажатие');
                return;
            }
            
            // Устанавливаем флаг шеринга
            isSharing = true;
            
            try {
                const giftId = gift.id || gift.ugift_id;
                const giftData = gift;
                
                console.log('=== SHARE GIFT DEBUG ===');
                console.log('giftId:', giftId);
                console.log('giftData:', giftData);
                console.log('window.isDevMode:', window.isDevMode);
                console.log('Telegram WebApp:', window.Telegram?.WebApp);
                console.log('user_id:', window.Telegram?.WebApp?.initDataUnsafe?.user?.id);
                
                // Проверяем, можно ли делиться этим подарком
                if (giftData.type === 'exclusive' || giftData.gift_type === 'exclusive') {
                    console.log('Cannot share exclusive gift');
                    showError(i18n.t('gifts.cannot_share_exclusive', '❌ Эксклюзивными подарками нельзя делиться'));
                    isSharing = false;
                    return;
                }
                
                // Проверяем поддержку Telegram API 8.0+
                if (!window.Telegram?.WebApp?.isVersionAtLeast || !window.Telegram.WebApp.isVersionAtLeast('8.0')) {
                    console.log('Telegram API version not supported');
                    showWarning('Обновите Telegram для использования этой функции');
                    isSharing = false;
                    return;
                }
                
                // Показываем индикатор загрузки
                const originalText = shareButton.innerHTML;
                shareButton.innerHTML = '<span class="loading-spinner"></span>';
                shareButton.classList.add('loading');
                shareButton.disabled = true;
                
                // Подготавливаем сообщение через новый API
                const apiPrefix = window.isDevMode ? '/dev' : '';
                const requestData = {
                    user_id: window.Telegram?.WebApp?.initDataUnsafe?.user?.id,
                    gift_id: giftData.gift_id || giftData.id,
                    ugift_id: giftData.ugift_id || giftId
                };
                
                console.log('API prefix:', apiPrefix);
                console.log('Request URL:', `${apiPrefix}/api/share_gift`);
                console.log('Request data:', requestData);
                
                const response = await fetch(`${apiPrefix}/api/share_gift`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-Telegram-Init-Data': window.Telegram?.WebApp?.initData || ''
                    },
                    body: JSON.stringify({
                        ...requestData,
                        initData: window.Telegram?.WebApp?.initData || '' // Добавляем initData для авторизации
                    })
                });
                
                console.log('Response status:', response.status);
                console.log('Response headers:', response.headers);
                
                const data = await response.json();
                console.log('Response data:', data);
                
                if (data.error_key === 'cannot_share_exclusive') {
                    console.log('Server returned cannot_share_exclusive error');
                    showError(i18n.t('gifts.cannot_share_exclusive', '❌ Эксклюзивными подарками нельзя делиться'));
                    shareButton.classList.remove('loading');
                    shareButton.innerHTML = originalText;
                    shareButton.disabled = false;
                    isSharing = false;
                    return;
                }
                
                if (data.error_key === 'daily_limit_reached') {
                    console.log('Server returned daily_limit_reached error');
                    showDailyLimitReached(data.reset_time_str);
                    shareButton.classList.remove('loading');
                    shareButton.innerHTML = originalText;
                    shareButton.disabled = false;
                    isSharing = false;
                    return;
                }
                
                if (!data.success) {
                    console.log('Server returned error:', data.error);
                    throw new Error(data.error || 'Failed to prepare gift message');
                }
                
                if (data.prepared_message_id) {
                    console.log('Got prepared_message_id:', data.prepared_message_id);
                    console.log('Calling Telegram.WebApp.shareMessage...');
                    
                    // Используем Telegram shareMessage API
                    try {
                        await window.Telegram.WebApp.shareMessage(data.prepared_message_id, (success) => {
                            console.log('ShareMessage callback result:', success);
                            
                            if (success) {
                                showSuccess(i18n.t('gifts.share_success', '🎁 Подарок отправлен!'));
                                
                                // Закрываем модальное окно
                                giftModal.classList.remove('show');
                                setModalState(false);
                                
                                // Обновляем список подарков (подарок остается до получения)
                                if (typeof updateGiftsFn === 'function') {
                                    updateGiftsFn();
                                }
                            } else {
                                showWarning('Отправка отменена');
                            }
                        });
                        
                        console.log('ShareMessage API call completed');
                        
                    } catch (shareError) {
                        console.error('ShareMessage API error:', shareError);
                        
                        // Fallback - показываем уведомление что функция пока недоступна
                        showWarning('Функция шеринга пока недоступна в вашей версии Telegram');
                    }
                } else {
                    console.log('No prepared_message_id in response');
                    throw new Error('No prepared_message_id received');
                }
                
            } catch (error) {
                console.error('Share gift error:', error);
                showError('❌ Ошибка при отправке подарка');
            } finally {
                // Восстанавливаем состояние кнопки
                isSharing = false;
                shareButton.disabled = false;
                shareButton.classList.remove('loading');
                shareButton.innerHTML = originalText;
            }
        });
    }
    
    // Кнопка "Продать"
    const sellButton = document.getElementById('sellModalGift');
    if (sellButton && typeof sellGiftFn === 'function') {
        // Флаг для отслеживания процесса продажи
        let isSelling = false;
        
        sellButton.addEventListener('click', function() {
            // Предотвращаем повторные нажатия во время активной продажи
            if (isSelling) {
                console.log('Процесс продажи уже идет, игнорируем повторное нажатие');
                return;
            }
            
            // Устанавливаем флаг продажи
            isSelling = true;
            
            // Отключаем кнопку, но не меняем текст
            sellButton.disabled = true;
            
            const giftId = gift.id || gift.ugift_id;
            
            // Создаем текст кнопки продажи с иконкой кристалла
            const sellButtonText = `${i18n.t('gifts.sell_for')} ${formatGiftPrice(giftValue)}<svg class="crystal-icon"><use xlink:href="#crystal-icon"></use></svg>`;
            
            // Используем диалог подтверждения перед закрытием модального окна
            import('./confirm-modal.js').then(module => {
                module.showConfirmDialog({
                    hideTitle: true,
                    message: i18n.t('gifts.sell_description'),
                    confirmText: 'OK',
                    cancelText: i18n.t('common.cancel'),
                    simpleLayout: true,
                    onConfirm: () => {
                        // Закрываем модальное окно после подтверждения
                        giftModal.classList.remove('show');
                        setModalState(false);
                        
                        // Вызываем функцию продажи
                        sellGiftFn(giftId, giftValue, true)
                            .then(result => {
                                // Отладочный вывод ответа сервера
                                console.log('Ответ от сервера при продаже подарка в модальном окне:', result);
                                
                                if (result && result.success) {
                                    // Не нужно снова открывать модальное окно, обновляем список подарков
                                    if (typeof updateGiftsFn === 'function') {
                                        updateGiftsFn();
                                    }
                                } else {
                                    // Проверяем наличие ошибки о достижении дневного лимита
                                    if (result?.error_key === 'daily_limit_reached' || (result?.error && result.error.includes('daily_limit_reached'))) {
                                        showDailyLimitReached(result.reset_time_str);
                                    } else {
                                        // В случае ошибки показываем сообщение
                                        showError(result?.error || i18n.t('errors.failed_to_sell_gift'));
                                    }
                                }
                            })
                            .catch(error => {
                                // В случае ошибки показываем сообщение
                                console.error('Ошибка при продаже подарка:', error);
                                showError(i18n.t('errors.gift_sell_error'));
                            })
                            .finally(() => {
                                // Снимаем флаг продажи
                                isSelling = false;
                                
                                // Восстанавливаем кнопку
                                sellButton.disabled = false;
                            });
                    },
                    onCancel: () => {
                        // Снимаем флаг продажи и разблокируем кнопку при отмене
                        isSelling = false;
                        sellButton.disabled = false;
                    }
                });
            }).catch(error => {
                console.error('Ошибка при загрузке модуля confirm-modal.js:', error);
                isSelling = false;
                sellButton.disabled = false;
                showError(i18n.t('errors.error_prefix') + 'Не удалось загрузить модуль подтверждения');
            });
        });
    }
}

/**
 * Закрывает модальное окно предпросмотра подарка
 */
function closePreviewModal() {
    const giftModal = document.getElementById('previewGiftModal');
    if (giftModal) {
        giftModal.classList.remove('show');
        document.body.classList.remove('modal-open');

        // Уведомляем модуль notifications, что модальное окно закрылось
        setModalState(false);
    }
}
