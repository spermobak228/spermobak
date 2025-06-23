/**
 * Модуль для работы с модальным окном выигрыша подарка
 * Содержит функции для отображения и управления модальным окном победы
 */

import { formatNumber, formatGiftPrice } from './ui-utils.js';
import { animateGiftToProfile } from './animations.js';
import { showConfirmationDialog } from './modal.js';
import * as i18n from './i18n.js';
import { showSuccess, showError, showWarning, showDailyLimitReached, setModalState } from './notifications.js';
import { showUsernameRequiredDialog, displayGiftAnimation, handleExclusiveGiftReceive, handleRegularGiftReceive } from './gift-actions.js';

// Глобальный объект для хранения обработчиков и данных
let handlers = {
    userData: null,
    saveGiftFn: null,
    sellGiftFn: null,
    updateUiFn: null
};

/**
 * Показывает модальное окно с выигрышем
 * @param {string} winning_gift_id - ID выигрышного подарка
 * @param {Object} winning_gift - Данные о выигрышном подарке
 * @param {boolean} demoMode - Включен ли демо-режим
 */
export function showWinModal(winning_gift_id, winning_gift, demoMode) {
    // Уведомляем модуль notifications, что открывается модальное окно
    setModalState(true);
    
    // Получаем ссылки на модальные окна
    const winModal = document.getElementById('winModal');
    const demoWinModal = document.getElementById('demoWinModal');
    
    // Выбираем модальное окно в зависимости от режима
    const modal = demoMode ? demoWinModal : winModal;
    
    // Если модальное окно не найдено, выходим
    if (!modal) {
        console.error('Не удалось найти модальные окна для отображения выигрыша');
        return;
    }
    
    // Получаем значение подарка, используя star_count (приоритетно)
    const giftValue = winning_gift.star_count || winning_gift.value || 0;
    
    // Проверяем, является ли подарок эксклюзивным
    const isExclusive = winning_gift.type === 'exclusive' || winning_gift.gift_type === 'exclusive';
    
    // Очищаем содержимое модального окна и создаем новое
    modal.innerHTML = '';
    
    // Добавляем содержимое в зависимости от типа модального окна
    if (demoMode) {
        modal.innerHTML = `
            <div class="modal-content">
                <h2>${i18n.t('gifts.demo_win_title')}</h2>
                <div class="won-gift" id="demoWonGift"></div>
                <div class="gift-name">${i18n.t('gifts.demo_description')}</div>
                <div class="win-actions">
                    <button class="action-button" id="demoCloseBtn">${i18n.t('common.close')}</button>
                    <button class="action-button" id="demoDisableBtn">${i18n.t('gifts.disable_demo')}</button>
                </div>
            </div>
        `;
    } else {
        modal.innerHTML = `
            <div class="modal-content">
                <h2>${i18n.t('gifts.win_title')}</h2>
                <div class="won-gift" id="wonGift"></div>
                <div class="gift-name" id="giftName" ${!isExclusive ? 'style="display: none;"' : ''}>${isExclusive ? `<strong>${winning_gift.name || winning_gift.gift_id || winning_gift_id || i18n.t('gifts.exclusive_gift')}</strong>` : ''}</div>
                <div class="win-actions">
                    <button class="action-button" id="receiveGift">${i18n.t('gifts.receive')}</button>
                    <button class="action-button" id="keepGift">${i18n.t('gifts.keep')}</button>
                    <button class="action-button" id="sellGift">
                        <div class="sell-button-content">
                            <div class="sell-button-main">${i18n.t('gifts.sell_for')} ${formatGiftPrice(giftValue)}<svg class="crystal-icon"><use xlink:href="#crystal-icon"></use></svg></div>
                            <div class="sell-button-sub">${i18n.t('gifts.try_luck_again')}</div>
                        </div>
                    </button>
                </div>
            </div>
        `;
    }
    
    // Получаем ссылки на элементы для отображения подарка
    const wonGift = demoMode ? 
        modal.querySelector('#demoWonGift') : 
        modal.querySelector('#wonGift');
    
    // Получаем ссылки на кнопки
    const receiveGift = modal.querySelector('#receiveGift');
    const keepGift = modal.querySelector('#keepGift');
    const sellGiftBtn = modal.querySelector('#sellGift');
    
    // Сбрасываем состояние блокировки кнопок перед новым использованием
    if (receiveGift) receiveGift.disabled = false;
    if (keepGift) keepGift.disabled = false;
    if (sellGiftBtn) sellGiftBtn.disabled = false;
    
    // Используем общую функцию для отображения анимации подарка
    displayGiftAnimation(winning_gift, wonGift);
    
    // Добавляем данные о подарке в кнопки для дальнейшей обработки
    setGiftDataForButtons(winning_gift_id, winning_gift, modal);
    
    // Добавляем класс для эксклюзивного подарка, если необходимо
    if (isExclusive) {
        // Добавляем класс к модальному окну
        modal.classList.add('exclusive-gift-modal');
        
        // Меняем текст кнопки "Получить"
        if (receiveGift) {
            receiveGift.textContent = i18n.t('gifts.receive');
        }
    } else {
        // Убираем класс, если был добавлен ранее
        modal.classList.remove('exclusive-gift-modal');
    }
    
    // Привязываем обработчики событий к кнопкам модального окна
    if (demoMode) {
        const demoButtons = modal.querySelectorAll('.action-button');
        demoButtons.forEach(button => {
            button.disabled = false; // Сначала разблокируем все кнопки
        });
        
        const demoCloseBtn = modal.querySelector('#demoCloseBtn');
        const demoDisableBtn = modal.querySelector('#demoDisableBtn');
        
        // Привязываем обработчики событий
        if (demoCloseBtn) {
            demoCloseBtn.addEventListener('click', () => closeWinModal(true));
        }
        
        if (demoDisableBtn) {
            demoDisableBtn.addEventListener('click', () => {
                disableDemoMode(() => {
                    if (typeof handlers.updateUiFn === 'function') {
                        handlers.updateUiFn();
                    }
                });
                closeWinModal(true);
            });
        }
    } else {
        // Добавляем обработчики для кнопок внутри модального окна
        attachButtonHandlers(modal, winning_gift_id, winning_gift);
    }
    
    // Блокируем основной интерфейс при открытии модального окна
    toggleMainInterface(true);
    
    // Показываем модальное окно
    modal.classList.add('show');
    
    // Добавляем класс для запрета прокрутки страницы
    document.body.classList.add('modal-open');
}

/**
 * Добавляет обработчики для кнопок внутри модального окна
 * @param {HTMLElement} modal - Модальное окно
 * @param {string} winning_gift_id - ID выигрышного подарка
 * @param {Object} winning_gift - Данные о выигрышном подарке
 */
function attachButtonHandlers(modal, winning_gift_id, winning_gift) {
    // Получаем кнопки внутри модального окна
    const receiveGift = modal.querySelector('#receiveGift');
    const keepGift = modal.querySelector('#keepGift');
    const sellGiftBtn = modal.querySelector('#sellGift');
    
    // Обработчик для кнопки "Получить"
    if (receiveGift) {
        receiveGift.addEventListener('click', function() {
            console.log('Клик по кнопке receiveGift зарегистрирован');
            
            // Проверяем, является ли подарок эксклюзивным
            const isExclusive = modal.classList.contains('exclusive-gift-modal');
            
            // Создаем объект подарка для передачи в общие функции
            const gift = {
                gift_id: this.dataset.giftId,
                ugift_id: this.dataset.ugiftId,
                emoji: this.dataset.giftEmoji,
                value: this.dataset.giftValue,
                type: isExclusive ? 'exclusive' : 'regular'
            };
            
            // Отладка для проверки данных
            console.log('Подготовка к отправке подарка:', gift);
            
            if (isExclusive) {
                // Используем общую функцию для обработки эксклюзивных подарков
                handleExclusiveGiftReceive(
                    gift, 
                    () => closeWinModal(), 
                    handlers.updateUiFn, 
                    this
                );
            } else {
                // Используем общую функцию для обработки обычных подарков
                handleRegularGiftReceive(
                    gift, 
                    () => closeWinModal(), 
                    handlers.updateUiFn, 
                    (giftId, value, skipConfirmation) => handlers.sellGiftFn(handlers.userData.id, giftId, skipConfirmation),
                    this
                );
            }
        });
    }
    
    // Обработчик для кнопки "В профиль"
    if (keepGift) {
        keepGift.addEventListener('click', async function() {
            // Получаем данные из data-атрибутов кнопки
            const giftId = this.dataset.giftId;
            const giftEmoji = this.dataset.giftEmoji;
            const giftValue = this.dataset.giftValue;
            const button = this; // Сохраняем ссылку на кнопку
            
            // Проверяем данные перед блокировкой кнопки
            if (!giftId) {
                console.error('Ошибка: ID подарка не указан');
                showError(i18n.t('errors.error_prefix') + 'Не удалось сохранить подарок - ID не указан');
                return;
            }
            
            // Блокируем кнопку без изменения текста
            button.disabled = true;
            
            try {
                // Вызываем функцию сохранения подарка
                if (typeof handlers.saveGiftFn === 'function') {
                    let saveResult;
                    try {
                        saveResult = await handlers.saveGiftFn(handlers.userData.id, giftId);
                    } catch (saveError) {
                        console.error('Ошибка при сохранении подарка:', saveError);
                        // Разблокируем кнопку
                        button.disabled = false;
                        showError(i18n.t('errors.error_prefix') + 'Произошла ошибка при сохранении подарка');
                        return;
                    }
                    
                    if (saveResult.success) {
                        // Определяем, какое модальное окно активно (проверяем класс show, не active)
                        const demoWinModal = document.getElementById('demoWinModal');
                        const isDemoMode = demoWinModal && demoWinModal.classList.contains('show');
                        const modalElement = isDemoMode ? 
                            demoWinModal : 
                            document.getElementById('winModal');
                        
                        // Запускаем анимацию перед закрытием окна
                        try {
                            animateGiftToProfile(giftEmoji, modalElement);
                        } catch (error) {
                            console.error('Ошибка анимации подарка:', error);
                        }
                        
                        // Небольшая задержка перед закрытием окна для лучшего восприятия
                        setTimeout(() => {
                            // Закрываем модальное окно с учетом режима
                            closeWinModal(isDemoMode);
                            
                            // Обновляем интерфейс
                            if (typeof handlers.updateUiFn === 'function') {
                                handlers.updateUiFn();
                            }
                        }, 100);
                    } else {
                        // Проверяем наличие ошибки о достижении дневного лимита
                        if (saveResult.error_key === 'daily_limit_reached' || (saveResult.error && saveResult.error.includes('daily_limit_reached'))) {
                            showDailyLimitReached(saveResult.reset_time_str);
                        } else {
                            // Показываем ошибку
                            showError(saveResult.error || i18n.t('errors.failed_to_save_gift'));
                            
                            // Разблокируем кнопку
                            button.disabled = false;
                        }
                    }
                } else {
                    // Функция не предоставлена, выводим ошибку
                    console.error('Функция сохранения подарка не предоставлена');
                    showError(i18n.t('errors.error_prefix') + 'Невозможно сохранить подарок: внутренняя ошибка');
                    
                    // Разблокируем кнопку
                    button.disabled = false;
                }
            } catch (error) {
                // В случае ошибки выводим сообщение
                console.error('Ошибка при сохранении подарка:', error);
                showError(i18n.t('errors.error_prefix') + 'Произошла ошибка при сохранении подарка');
                
                // Разблокируем кнопку
                button.disabled = false;
            }
        });
    }
    
    // Обработчик для кнопки "Продать"
    if (sellGiftBtn) {
        // Флаг для отслеживания процесса продажи
        let isSelling = false;
        
        sellGiftBtn.addEventListener('click', function() {
            // Предотвращаем повторные нажатия во время активной продажи
            if (isSelling) {
                console.log('Процесс продажи уже идет, игнорируем повторное нажатие');
                return;
            }
            
            // Устанавливаем флаг продажи
            isSelling = true;
            
            // Отключаем кнопку, но не меняем текст
            sellGiftBtn.disabled = true;
            
            // Закрываем модальное окно сразу
            closeWinModal(false);
            
            const giftId = this.dataset.giftId;
            const giftValue = this.dataset.giftValue;
            
            // Вызываем функцию продажи
            handlers.sellGiftFn(handlers.userData.id, giftId)
                .then(result => {
                    // Отладочный вывод ответа сервера
                    console.log('Ответ от сервера при продаже подарка:', result);
                    
                    // Проверяем, была ли продажа отменена пользователем
                    if (result && result.canceled) {
                        console.log('Продажа отменена пользователем');
                        return;
                    }
                    
                    if (result && result.success) {
                        // Обновляем баланс пользователя
                        handlers.userData.balance = result.new_balance;
                        
                        // Показываем анимацию изменения баланса через событие
                        const event = new CustomEvent('balanceUpdated', { 
                            detail: { 
                                value: result.sold_value || giftValue,
                                newBalance: result.new_balance 
                            } 
                        });
                        document.dispatchEvent(event);
                        
                        // Прямой вызов функции анимации
                        import('./animations.js').then(module => {
                            module.showBalanceUpdateAnimation(+giftValue);
                        });
                        
                        // Если в ответе есть данные о подарках, отправляем событие об их обновлении
                        if (result.gifts && Array.isArray(result.gifts) && result.all_gifts) {
                            console.log('Используем данные о подарках из ответа сервера');
                            // Формируем пользовательское событие с данными
                            const giftsEvent = new CustomEvent('user-gifts-updated', {
                                detail: {
                                    gifts: result.gifts,
                                    all_gifts: result.all_gifts
                                }
                            });
                            window.dispatchEvent(giftsEvent);
                        }
                        
                        // Обновляем интерфейс если нужно, но без вызова дополнительных запросов
                        if (typeof handlers.updateUiFn === 'function') {
                            handlers.updateUiFn();
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
                    sellGiftBtn.disabled = false;
                });
        });
    }
}

/**
 * Закрывает модальное окно выигрыша
 * @param {boolean} demoMode - Режим демонстрации
 */
export function closeWinModal(demoMode) {
    // Уведомляем модуль notifications, что модальное окно закрылось
    setModalState(false);
    
    const winModal = document.getElementById('winModal');
    const demoWinModal = document.getElementById('demoWinModal');
    
    // Сбрасываем состояние кнопок в обоих модальных окнах
    resetModalButtons(winModal);
    resetModalButtons(demoWinModal);
    
    if (demoMode === true && demoWinModal) {
        demoWinModal.classList.remove('show');
        demoWinModal.classList.remove('active');
    } else {
        // Если demoMode не указан явно как true или отсутствует, закрываем стандартное окно
        if (winModal) {
            winModal.classList.remove('show');
            winModal.classList.remove('active');
        }
    }
    
    // Убираем класс блокировки прокрутки страницы
    document.body.classList.remove('modal-open');
    
    // Разблокируем основной интерфейс
    toggleMainInterface(false);
    
}

/**
 * Инициализирует обработчики событий для модальных окон выигрыша
 * @param {Object} options - Объект с опциями и зависимостями
 * @param {Object} options.userData - Данные о пользователе
 * @param {Function} options.saveGiftFn - Функция для сохранения подарка
 * @param {Function} options.sellGiftFn - Функция для продажи подарка
 * @param {Function} options.updateUiFn - Функция для обновления интерфейса
 */
export function initWinModalHandlers(options) {
    // Сохраняем зависимости в глобальном объекте
    handlers = { ...options };
}

/**
 * Блокирует или разблокирует основной интерфейс приложения
 * @param {boolean} isModalOpen - Открыто ли модальное окно (true - интерфейс блокируется, false - разблокируется)
 */
function toggleMainInterface(isModalOpen) {
    // Находим элементы основного интерфейса, которые нужно блокировать
    const mainInterface = document.querySelector('.main-interface');
    const betOptions = document.querySelectorAll('.bet-option');
    const spinButton = document.getElementById('spinButton');
    const navItems = document.querySelectorAll('.nav-item');
    
    if (isModalOpen) {
        // Блокируем основной интерфейс
        if (mainInterface) mainInterface.classList.add('disabled');
        
        // Блокируем кнопки ставок
        betOptions.forEach(option => option.classList.add('disabled'));
        
        // Блокируем кнопку прокрутки
        if (spinButton) spinButton.disabled = true;
        
        // Блокируем элементы навигации
        navItems.forEach(item => item.classList.add('disabled'));
    } else {
        // Разблокируем основной интерфейс
        if (mainInterface) mainInterface.classList.remove('disabled');
        
        // Разблокируем кнопки ставок
        betOptions.forEach(option => option.classList.remove('disabled'));
        
        // Разблокируем кнопку прокрутки
        if (spinButton) spinButton.disabled = false;
        
        // Разблокируем элементы навигации
        navItems.forEach(item => item.classList.remove('disabled'));
    }
}

/**
 * Сбрасывает состояние кнопок в модальном окне
 * @param {HTMLElement} modal - Модальное окно
 */
function resetModalButtons(modal) {
    if (!modal) return;
    
    // Находим все кнопки и разблокируем их
    const buttons = modal.querySelectorAll('button');
    buttons.forEach(button => {
        button.disabled = false;
    });
}

/**
 * Устанавливает данные подарка для кнопок действий
 * @param {string} winning_gift_id - ID выигрышного подарка
 * @param {Object} winning_gift - Объект с данными выигрышного подарка
 * @param {HTMLElement} modal - Модальное окно, внутри которого находятся кнопки
 */
function setGiftDataForButtons(winning_gift_id, winning_gift, modal) {
    const giftData = {
        giftId: winning_gift_id,
        giftEmoji: winning_gift.emoji,
        giftValue: winning_gift.star_count || winning_gift.value || 0,
        ugiftId: winning_gift.ugift_id
    };
    
    // Кнопка "Получить" внутри модального окна
    const receiveGift = modal.querySelector('#receiveGift');
    if (receiveGift) {
        Object.entries(giftData).forEach(([key, value]) => {
            receiveGift.dataset[key] = value;
        });
    }
    
    // Кнопка "В профиль" внутри модального окна
    const keepGift = modal.querySelector('#keepGift');
    if (keepGift) {
        Object.entries(giftData).forEach(([key, value]) => {
            keepGift.dataset[key] = value;
        });
    }
    
    // Кнопка "Продать" внутри модального окна
    const sellGiftBtn = modal.querySelector('#sellGift');
    if (sellGiftBtn) {
        sellGiftBtn.dataset.giftId = winning_gift_id;
        sellGiftBtn.dataset.giftValue = winning_gift.star_count || winning_gift.value || 0;
    }
}

/**
 * Отключает демо-режим
 * @param {Function} updateUiFn - Функция обновления интерфейса
 */
function disableDemoMode(updateUiFn) {
    const demoModeCheckbox = document.getElementById('demoMode');
    if (demoModeCheckbox) {
        demoModeCheckbox.checked = false;
        
        // Необходимо также обновить состояние игры в родительском компоненте
        const event = new CustomEvent('demoModeChanged', { detail: { enabled: false } });
        document.dispatchEvent(event);
        
        // Обновляем интерфейс
        if (updateUiFn) updateUiFn();
    }
}
