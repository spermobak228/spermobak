/**
 * Модуль для работы с данными пользователя
 * Содержит функции для загрузки, обновления и хранения пользовательских данных
 */

import { formatNumber } from './ui-utils.js';
import * as i18n from './i18n.js';
import * as notifications from './notifications.js';

/**
 * Стоимость различных типов ставок
 */
export const betCosts = {
    "low": 25,
    "medium": 50,
    "high": 100,
    "ultra": 250
};

/**
 * Ключ для хранения флага инициализации приложения
 */
export const INITIALIZATION_FLAG_KEY = 'giftgo_initialized';

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
 * Очищает флаг инициализации приложения из localStorage
 * После вызова этой функции, следующий запуск приложения будет считаться первым
 * и будет выполнено определение IP и страны пользователя
 * 
 * @returns {boolean} - true если флаг был удален, false если возникла ошибка
 */
export function clearInitializationFlag() {
    try {
        // Удаляем флаг инициализации
        localStorage.removeItem(INITIALIZATION_FLAG_KEY);
        console.log('Флаг инициализации приложения успешно сброшен');
        return true;
    } catch (error) {
        console.warn(`Ошибка при сбросе флага инициализации: ${error.message}`);
        return false;
    }
}

/**
 * Загружает данные пользователя с сервера
 * @param {string} userId - ID пользователя
 * @param {Object} userData - Текущие данные пользователя
 * @returns {Promise<Object>} Результат операции
 */
export async function loadUserData(userId, userData) {
    try {
        console.log('Запрос на получение данных пользователя:', userId);
        
        // Проверяем, находимся ли мы в режиме разработки
        const isDevMode = window.isDevMode || false;
        const apiPrefix = isDevMode ? '/dev' : '';
        
        // Получаем оригинальный код языка из localStorage или используем переданный
        let languageCode = userData.language_code;
        
        // Создаем флаг, отслеживающий первый запуск приложения
        const isFirstLoad = !localStorage.getItem(INITIALIZATION_FLAG_KEY);
        
        // Импортируем i18n модуль для получения оригинального языка
        if (window.i18n && window.i18n.getOriginalLanguage) {
            const storedLanguage = window.i18n.getOriginalLanguage();
            if (storedLanguage) {
                console.log('Использование сохраненного кода языка из localStorage:', storedLanguage);
                languageCode = storedLanguage;
            }
        }
        
        // Создаем объект для запроса данных пользователя
        const requestData = {
            user_id: userId,
            first_name: userData.first_name,
            last_name: userData.last_name,
            photo_url: userData.photo_url,
            username: userData.username,
            start_param: userData.start_param, // Реферальный код из ссылки
            init_app: isFirstLoad, // Флаг, указывающий, что это первый запуск приложения
            initData: getTelegramInitData() // Добавляем initData для авторизации
        };
        
        // Всегда добавляем языковой код, если он доступен
        // Сервер ожидает этот параметр, даже при повторных запросах
        if (languageCode) {
            requestData.language_code = languageCode;
        }
        
        console.log('Отправка запроса данных пользователя, это инициализация приложения:', isFirstLoad);
        
        // Получаем данные пользователя с сервера через объединенный API эндпоинт
        const response = await fetch(`${apiPrefix}/api/user_data`, {
            method: 'POST',
            headers: createTelegramHeaders(),
            body: JSON.stringify(requestData)
        });
        
        const data = await response.json();
        console.log('Получен ответ от сервера:', data);
        
        // После первого успешного запроса отмечаем, что приложение инициализировано
        if (isFirstLoad && data.success) {
            localStorage.setItem(INITIALIZATION_FLAG_KEY, 'true');
        }
        
        // Обработка ошибок авторизации
        if (response.status === 401 || (data.error && data.error === 'auth_failed')) {
            console.error('Ошибка авторизации пользователя');
            return {
                success: false,
                error: {
                    auth_failed: true,
                    redirect: data.redirect || 'auth_error'
                }
            };
        }
        
        if (data.success) {
            // Создаем объект настроек, если он еще не существует
            if (!window.appSettings) {
                window.appSettings = {};
            }
            
            // Проверяем, есть ли настройки игры в ответе
            if (data.game_settings) {
                console.log('Настройки игры получены с сервера:', data.game_settings);
                
                // Обновляем типы ставок
                if (data.game_settings.bet_types) {
                    window.appSettings.BET_TYPES = data.game_settings.bet_types;
                }
                
                // Обновляем настройки колеса лотереи
                if (data.game_settings.lottery_wheels) {
                    window.appSettings.LOTTERY_WHEELS = data.game_settings.lottery_wheels;
                }
                
                // Обновляем настройки подарков для каждого типа ставки
                if (data.game_settings.bet_gifts) {
                    window.appSettings.BET_GIFTS = data.game_settings.bet_gifts;
                }
            } else {
                console.warn('Настройки игры не получены с сервера, используем настройки по умолчанию');
                
                // Создаем базовые настройки по умолчанию
                if (!window.appSettings.BET_TYPES) {
                    window.appSettings.BET_TYPES = {
                        "low": {
                            "price": 25,
                            "symbol": "crystal",
                            "name": "Маленькая"
                        },
                        "medium": {
                            "price": 50,
                            "symbol": "crystal",
                            "name": "Средняя"
                        },
                        "high": {
                            "price": 100,
                            "symbol": "crystal",
                            "name": "Большая"
                        }
                    };
                }
                
                // Простые настройки для колеса лотереи по умолчанию
                if (!window.appSettings.LOTTERY_WHEELS) {
                    window.appSettings.LOTTERY_WHEELS = {
                        "low": [],
                        "medium": [],
                        "high": []
                    };
                }
            }
            
            console.log('Итоговые настройки игры:', window.appSettings);
            
            // Теперь все данные получены в одном запросе
            // Возвращаем данные
            return {
                success: true,
                userData: data.user, // Данные пользователя уже включают подарки
                gifts: data.all_gifts
            };
        }
        
        throw new Error(data.error || "Ошибка загрузки данных пользователя");
    } catch (error) {
        console.error('Ошибка при загрузке данных пользователя:', error);
        return {
            success: false,
            error: error.message || "Ошибка соединения с сервером"
        };
    }
}

/**
 * Загружает список подарков пользователя с сервера
 * @param {string} userId - ID пользователя
 * @returns {Promise<Object>} Результат операции
 */
export async function loadUserGifts(userId) {
    try {
        // Проверяем, что userId определен и не равен null
        if (userId === undefined || userId === null) {
            console.error('Ошибка при загрузке подарков: ID пользователя не определен');
            return {
                success: false,
                error: 'ID пользователя не определен'
            };
        }
        
        // Проверяем, находимся ли мы в режиме разработки
        const isDevMode = window.isDevMode || false;
        const apiPrefix = isDevMode ? '/dev' : '';
        
        // Создаем URL с initData в заголовке
        const response = await fetch(`${apiPrefix}/api/user_gifts?user_id=${userId}`, {
            method: 'GET',
            headers: createTelegramHeaders()
        });
        const data = await response.json();
        
        if (data.success) {
            return {
                success: true,
                gifts: data.gifts,
                all_gifts: data.all_gifts
            };
        } else {
            console.error('Ошибка при загрузке подарков:', data.error);
            return {
                success: false,
                error: data.error
            };
        }
    } catch (error) {
        console.error('Ошибка при загрузке подарков:', error);
        return {
            success: false,
            error: 'Ошибка соединения с сервером'
        };
    }
}

/**
 * Загружает историю игр пользователя с сервера
 * @param {string} userId - ID пользователя
 * @returns {Promise<Object>} Результат операции
 */
export async function loadUserHistory(userId) {
    try {
        // Проверяем, находимся ли мы в режиме разработки
        const isDevMode = window.isDevMode || false;
        const apiPrefix = isDevMode ? '/dev' : '';
        
        const response = await fetch(`${apiPrefix}/api/user_history?user_id=${userId}`, {
            method: 'GET',
            headers: createTelegramHeaders()
        });
        const data = await response.json();
        
        if (data.success) {
            return {
                success: true,
                history: data.history
            };
        } else {
            console.error('Ошибка при загрузке истории:', data.error);
            return {
                success: false,
                error: data.error
            };
        }
    } catch (error) {
        console.error('Ошибка при загрузке истории:', error);
        return {
            success: false,
            error: 'Ошибка соединения с сервером'
        };
    }
}

/**
 * Сохраняет подарок в базе данных
 * @param {string} userId - ID пользователя
 * @param {string} giftId - ID подарка
 * @param {string} giftEmoji - Эмодзи подарка
 * @param {number} giftValue - Стоимость подарка
 * @returns {Promise<Object>} Результат операции
 */
export async function saveGift(userId, giftId, giftEmoji, giftValue) {
    try {
        // Проверяем, находимся ли мы в режиме разработки
        const isDevMode = window.isDevMode || false;
        const apiPrefix = isDevMode ? '/dev' : '';
        
        const response = await fetch(`${apiPrefix}/api/save_gift`, {
            method: 'POST',
            headers: createTelegramHeaders(),
            body: JSON.stringify({
                user_id: userId,
                gift_id: giftId,
                emoji: giftEmoji,
                value: giftValue,
                initData: getTelegramInitData() // Добавляем initData для авторизации
            })
        });
        
        const data = await response.json();
        
        if (data.success) {
            return {
                success: true,
                gift_id: data.gift_id
            };
        } else {
            console.error('Ошибка при сохранении подарка:', data.error);
            return {
                success: false,
                error: data.error
            };
        }
    } catch (error) {
        console.error('Ошибка при сохранении подарка:', error);
        return {
            success: false,
            error: 'Ошибка соединения с сервером'
        };
    }
}

/**
 * Продает подарок пользователя
 * @param {string} userId - ID пользователя
 * @param {string} giftId - ID подарка для продажи
 * @returns {Promise<Object>} Результат операции
 */
export async function sellGift(userId, giftId) {
    try {
        // Проверяем, находимся ли мы в режиме разработки
        const isDevMode = window.isDevMode || false;
        const apiPrefix = isDevMode ? '/dev' : '';
        
        const response = await fetch(`${apiPrefix}/api/sell`, {
            method: 'POST',
            headers: createTelegramHeaders(),
            body: JSON.stringify({
                user_id: userId,
                gift_id: giftId,
                initData: getTelegramInitData() // Добавляем initData для авторизации
            })
        });
        
        const data = await response.json();
        
        if (data.success) {
            // Отправляем событие обновления баланса
            window.dispatchEvent(new CustomEvent('balance-updated', {
                detail: {
                    newBalance: data.new_balance,
                    oldBalance: data.previous_balance,
                    reason: 'gift_sold'
                }
            }));
            
            // Получаем обновленный список подарков пользователя без дополнительных запросов
            // Сервер должен вернуть обновленные данные в ответе
            const userGifts = data.gifts || [];
            const allGifts = data.all_gifts || {};
            
            // Отправляем событие об обновлении подарков пользователя
            window.dispatchEvent(new CustomEvent('user-gifts-updated', {
                detail: {
                    gifts: userGifts,
                    all_gifts: allGifts
                }
            }));
            
            return {
                success: true,
                new_balance: data.new_balance,
                sold_value: data.sold_value,
                gifts: userGifts,
                all_gifts: allGifts
            };
        } else {
            console.error('Ошибка при продаже подарка:', data.error);
            
            // Проверяем, является ли ошибка связанной с колдауном
            if (data.cooldown && data.remaining) {
                return {
                    success: false,
                    error: data.error,
                    cooldown: true,
                    remaining: data.remaining
                };
            }
            
            return {
                success: false,
                error: data.error
            };
        }
    } catch (error) {
        console.error('Ошибка при продаже подарка:', error);
        return {
            success: false,
            error: 'Ошибка соединения с сервером'
        };
    }
}

/**
 * Обновляет отображение информации о пользователе
 * @param {Object} userData - Данные пользователя
 */
export function updateUserInfo(userData) {
    const userNameElement = document.getElementById('userName');
    const spinsCountElement = document.getElementById('spinsCount');
    
    if (userNameElement) {
        // Формируем имя пользователя
        const displayName = userData.first_name ? 
            `${userData.first_name}${userData.last_name ? ' ' + userData.last_name : ''}` : 
            'Пользователь';
        userNameElement.textContent = displayName;
    }
    
    if (spinsCountElement) {
        // Отображаем количество игр
        spinsCountElement.textContent = userData.spins_count || 0;
    }
}

/**
 * Обновляет отображение аватарки пользователя
 * @param {Object} userData - Данные пользователя
 * @param {HTMLElement|string} [avatarElement] - Элемент аватара или его ID
 */
export function updateUserAvatar(userData, avatarElement) {
    // Если передан ID или ничего не передано, ищем элемент
    if (!avatarElement || typeof avatarElement === 'string') {
        const elementId = avatarElement || 'userAvatar';
        avatarElement = document.getElementById(elementId);
        
        // Если не нашли по переданному ID, ищем по стандартному ID или по ID для профиля
        if (!avatarElement) {
            avatarElement = document.getElementById('userAvatar') || 
                            document.getElementById('profileAvatar');
        }
    }
    
    if (!avatarElement) return;
    
    let avatarHTML = '';
    
    if (userData.photo_url) {
        // Если у пользователя есть аватарка, отображаем её
        avatarHTML = `<img src="${userData.photo_url}" alt="Аватар пользователя" class="user-avatar-img">`;
    } else if (userData.id) {
        // Если аватарки нет в данных пользователя, но есть ID пользователя, пробуем получить аватарку через API
        const firstLetter = userData.first_name ? userData.first_name.charAt(0).toUpperCase() : '?';
        // Проверяем, находимся ли мы в режиме разработки
        const isDevMode = window.isDevMode || false;
        const apiPrefix = isDevMode ? '/dev' : '';
        avatarHTML = `<img src="${apiPrefix}/api/user_photo/${userData.id}" alt="Аватар пользователя" class="user-avatar-img" onerror="this.style.display='none'; this.parentNode.innerHTML='<div class=\\'user-avatar-placeholder\\'>${firstLetter}</div>'">`;
    } else {
        // Если аватарки нет, отображаем первую букву имени пользователя
        const firstLetter = userData.first_name ? userData.first_name.charAt(0).toUpperCase() : '?';
        avatarHTML = `<div class="user-avatar-placeholder">${firstLetter}</div>`;
    }
    
    avatarElement.innerHTML = avatarHTML;
}

/**
 * Обновляет отображение баланса пользователя
 * @param {Object} userData - Данные пользователя
 * @param {HTMLElement|string} [balanceElement] - Элемент баланса или его ID
 */
export function updateBalanceDisplay(userData, balanceElement) {
    // Если передан ID или ничего не передано, ищем элемент
    if (!balanceElement || typeof balanceElement === 'string') {
        const elementId = balanceElement || 'balanceValue';
        balanceElement = document.getElementById(elementId);
        
        // Если не нашли по переданному ID, ищем по стандартному ID или по ID для профиля
        if (!balanceElement) {
            balanceElement = document.getElementById('balanceValue') || 
                             document.getElementById('profileBalanceValue');
        }
    }
    
    if (balanceElement) {
        // Обновляем текстовое содержимое
        balanceElement.textContent = formatNumber(userData.balance);
        
        // Устанавливаем реальное значение в data-атрибут
        balanceElement.dataset.realValue = userData.balance;
    }
}

/**
 * Обновляет текст кнопки прокрутки
 * @param {boolean} demoMode - Режим демонстрации
 * @param {string} selectedBet - Выбранный тип ставки
 */
export function updateSpinButton(demoMode, selectedBet) {
    const spinButton = document.getElementById('spinButton');
    if (!spinButton) return;
    
    // Используем текст из атрибута data-i18n и переводим его
    const i18n = window.i18n;
    const buttonText = i18n && i18n.t ? i18n.t('main_page.spin_button') : 'Мне повезёт, Go!';
    
    // Если демо-режим, отображаем FREE, иначе отображаем стоимость ставки без плашки
    const tagContent = demoMode ? 
        '<span class="free-tag">FREE</span>' : 
        ` ${formatNumber(betCosts[selectedBet])}<svg class="crystal-icon"><use xlink:href="#crystal-icon"></use></svg>`;
        
    spinButton.innerHTML = `${buttonText}${tagContent}`;
}

/**
 * Получение актуального баланса пользователя напрямую из DOM
 * @returns {number} Текущий баланс пользователя
 */
function getActualBalance() {
    // Получаем баланс напрямую из DOM-элемента
    const balanceElement = document.getElementById('balanceValue');
    if (balanceElement) {
        // Сначала проверяем data-атрибут с реальным значением
        if (balanceElement.dataset.realValue !== undefined) {
            return parseInt(balanceElement.dataset.realValue);
        }
        // Если атрибута нет, используем текст как запасной вариант
        return parseInt(balanceElement.textContent.replace(/\D/g, ''));
    }
    return 0;
}

/**
 * Проверяет возможность начать игру
 * @param {boolean} isSpinning - Происходит ли прокрутка в данный момент
 * @param {boolean} demoMode - Режим демонстрации
 * @param {Object} userData - Данные пользователя
 * @param {string} selectedBet - Выбранный тип ставки
 * @returns {boolean} Возможность начать игру
 */
export function canStartSpin(isSpinning, demoMode, userData, selectedBet) {
    // Проверяем, не крутится ли уже лотерея
    if (isSpinning) return false;
    
    // Получаем актуальный баланс напрямую из DOM
    const actualBalance = getActualBalance();
    
    // Если демо-режим выключен, проверяем хватает ли кристаллов
    if (!demoMode && actualBalance < betCosts[selectedBet]) {
        // Вычисляем недостающее количество кристаллов
        const missingAmount = betCosts[selectedBet] - actualBalance;
        
        // Сохраняем информацию о попытке запуска лотереи
        window.pendingBetType = selectedBet;
        
        // Получаем объект i18n
        const i18n = window.i18n;
        
        // Импортируем функции из модуля confirm-modal.js динамически
        import('./confirm-modal.js').then(confirmModalModule => {
            const { showConfirmDialog, replaceCrystalWithIcon } = confirmModalModule;
            
            // Получаем сообщение с заменой слова crystal на иконку
            const message = replaceCrystalWithIcon(
                i18n.t('payment.insufficient_funds', { amount: formatNumber(missingAmount) })
            );
            
            // Показываем кастомный диалог подтверждения со слайдером пополнения
            showConfirmDialog({
                hideTitle: true, // Скрываем заголовок
                message: message,
                confirmText: 'OK', // Используем OK вместо "Пополнить на {{amount}}"
                cancelText: i18n.t('common.cancel'),
                simpleLayout: true, // Используем простой макет (OK справа, Отмена слева)
                topUpOptions: {
                    missingAmount: missingAmount,
                    onAmountSelect: (amount) => {
                        // Если пользователь выбрал сумму, запускаем процесс пополнения
                        buyStars(amount);
                    }
                },
                onConfirm: () => {
                    // Эта функция будет переопределена в обработчике выбора суммы
                    // По умолчанию используем недостающую сумму
                    buyStars(missingAmount);
                },
                onCancel: () => {
                    // Если пользователь отказался, очищаем информацию о попытке запуска
                    window.pendingBetType = null;
                }
            });
        });
        
        return false;
    }
    
    return true;
}

/**
 * Увеличивает счетчик игр и обновляет баланс при начале игры
 * @param {Object} userData - Данные пользователя
 * @param {boolean} demoMode - Режим демонстрации
 * @param {string} selectedBet - Выбранный тип ставки
 * @returns {number} Стоимость ставки
 */
export function updateUserStatsForSpin(userData, demoMode, selectedBet) {
    if (demoMode) return 0;
    
    // Увеличиваем счетчик игр
    userData.spins_count = (userData.spins_count || 0) + 1;
    
    // Уменьшаем баланс на стоимость ставки
    const betCost = betCosts[selectedBet];
    userData.balance -= betCost;
    
    return betCost;
}

/**
 * Покупка звезд для пополнения баланса
 * @param {number} amount - Количество недостающих кристаллов
 * @returns {Promise<boolean>} - Promise с результатом операции
 */
export async function buyStars(amount) {
    return new Promise(async (resolve) => {
        try {
            // Проверяем, работаем ли мы в Telegram Mini App
            if (!window.Telegram || !window.Telegram.WebApp) {
                console.error('Telegram WebApp API недоступен');
                alert('Для пополнения баланса необходимо открыть приложение в Telegram.');
                resolve(false);
                return;
            }
            
            // Валидация суммы
            amount = parseInt(amount, 10);
            if (isNaN(amount) || amount <= 0 || amount > 10000) {
                console.error('Недопустимая сумма пополнения:', amount);
                alert('Пожалуйста, укажите корректную сумму пополнения (1-10000)');
                resolve(false);
                return;
            }
            
            console.log('Запрос на пополнение баланса на', amount, 'кристаллов');
            
            // Проверяем, находимся ли мы в режиме разработки
            const isDevMode = window.isDevMode || false;
            const apiPrefix = isDevMode ? '/dev' : '';
            
            // Запрос на создание инвойса
            const response = await fetch(`${apiPrefix}/api/create_invoice`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    user_id: window.Telegram.WebApp.initDataUnsafe?.user?.id,
                    amount: amount,
                    initData: window.Telegram.WebApp.initData || ''
                })
            });
            
            const data = await response.json();
            console.log('Ответ от сервера create_invoice:', data);
            
            if (data.success && data.invoice_link) {
                console.log('Получена ссылка на инвойс:', data.invoice_link);
                
                // Регистрируем обработчик события invoiceClosed
                const handleInvoiceClosed = (eventData) => {
                    console.log('Событие invoiceClosed получено:', eventData);
                    if (eventData && eventData.status === 'paid') {
                        // В событии invoiceClosed должен приходить payment_id 
                        // и telegram_payment_charge_id в случае успешной оплаты
                        console.log('Инвойс успешно оплачен, данные платежа:', eventData);
                        
                        // Более надежное получение payment_id и telegram_payment_charge_id
                        // для верификации платежа
                        let paymentId = '';
                        let telegramPaymentChargeId = '';
                        
                        // Telegram MiniApp может предоставить информацию о платеже в момент
                        // закрытия инвойса с успешным статусом, проверяем на наличие этих данных
                        if (window.Telegram.WebApp.initDataUnsafe && 
                            window.Telegram.WebApp.initDataUnsafe.payment) {
                            telegramPaymentChargeId = window.Telegram.WebApp.initDataUnsafe.payment.telegram_payment_charge_id;
                            console.log('ID платежа получен из initDataUnsafe.payment:', telegramPaymentChargeId);
                        }
                        
                        // Если не удалось получить из initDataUnsafe, пробуем из CloudStorage
                        if (!telegramPaymentChargeId && window.Telegram.WebApp.CloudStorage && 
                            window.Telegram.WebApp.CloudStorage.getItem) {
                            // Пытаемся получить telegram_payment_charge_id из хранилища
                            const storedPaymentId = window.Telegram.WebApp.CloudStorage.getItem('last_payment_id');
                            
                            if (storedPaymentId) {
                                paymentId = storedPaymentId;
                                console.log('ID платежа получен из CloudStorage:', paymentId);
                                
                                // Если в хранилище был telegram_payment_charge_id (длинный ID)
                                if (paymentId.length > 20) {
                                    telegramPaymentChargeId = paymentId;
                                }
                            }
                        }
                        
                        // Если ID всё ещё не найден, просим пользователя ввести его вручную, 
                        // чтобы можно было зафиксировать платеж
                        if (!paymentId && window.Telegram.WebApp.showPopup) {
                            window.Telegram.WebApp.showPopup({
                                title: 'Ожидается подтверждение платежа',
                                message: 'Для подтверждения оплаты нам нужна информация о вашем платеже. Вы можете скопировать ID платежа из чека в Telegram.',
                                buttons: [
                                    {id: 'ok', type: 'default', text: 'Продолжить без подтверждения'}
                                ]
                            }, () => {
                                // В любом случае отправляем запрос с доступной информацией
                                sendVerificationRequest();
                            });
                        } else {
                            // У нас есть payment_id, отправляем запрос
                            sendVerificationRequest();
                        }
                        
                        // Функция отправки запроса верификации
                        function sendVerificationRequest() {
                            // Проверяем, находимся ли мы в режиме разработки
                            const isDevMode = window.isDevMode || false;
                            const apiPrefix = isDevMode ? '/dev' : '';
                            
                            // Если есть telegram_payment_charge_id, приоритетно используем его
                            const idToSend = telegramPaymentChargeId || paymentId || '';
                            
                            console.log('Отправляем ID платежа для верификации:', idToSend);
                            
                            // Запрашиваем верификацию платежа и обновление баланса
                            fetch(`${apiPrefix}/api/verify_and_update_balance`, {
                                method: 'POST',
                                headers: {
                                    'Content-Type': 'application/json'
                                },
                                body: JSON.stringify({
                                    user_id: window.Telegram.WebApp.initDataUnsafe?.user?.id,
                                    amount: amount,
                                    payment_id: idToSend ? idToSend : "",
                                    telegram_payment_charge_id: telegramPaymentChargeId || '',
                                    initData: window.Telegram.WebApp.initData || ''
                                })
                            })
                            .then(response => response.json())
                            .then(data => {
                                console.log('Ответ от сервера verify_and_update_balance:', data);
                                
                                if (data.success) {
                                    // ВАЖНОЕ ИЗМЕНЕНИЕ: Обновляем баланс в глобальной переменной userData
                                    window.userData = window.userData || {};
                                    const oldBalance = window.userData.balance || 0;
                                    window.userData.balance = data.balance;
                                    
                                    // Показываем уведомление об успешном пополнении баланса
                                    if (data.balance > oldBalance) {
                                        // Используем либо amount из запроса к API, либо разницу между старым и новым балансом
                                        const addedAmount = (data.balance_change && data.balance_change.amount > 0) 
                                            ? data.balance_change.amount 
                                            : amount || (data.balance - oldBalance);
                                        
                                        if (addedAmount > 0) {
                                            notifications.showBalanceAdded(addedAmount);
                                        }
                                    }
                                    
                                    // Важно! Обновляем локальный объект userData, если он доступен в глобальной области
                                    if (typeof userData !== 'undefined') {
                                        userData.balance = data.balance;
                                        console.log('Локальный объект userData обновлен:', userData.balance);
                                    }
                                    
                                    // Проверяем есть ли функция formatNumber
                                    const formattedBalance = typeof formatNumber === 'function' 
                                        ? formatNumber(data.balance) 
                                        : data.balance;
                                    
                                    // Обновляем все элементы с балансом на странице
                                    const balanceElements = document.querySelectorAll('[id*="balance"], [id*="Balance"]');
                                    balanceElements.forEach(element => {
                                        // Проверяем, что элемент не содержит HTML разметку и не является кнопкой
                                        if (!element.innerHTML.includes("<") && 
                                            !element.classList.contains('add-balance-button') && 
                                            element.id !== 'addBalanceButton') {
                                            element.textContent = formattedBalance;
                                            console.log(`Обновлен элемент ${element.id}:`, element.textContent);
                                        }
                                    });
                                    
                                    // Если доступна функция updateUI, вызываем ее
                                    if (typeof updateUI === 'function') {
                                        updateUI();
                                        console.log('Вызвана функция updateUI()');
                                    }
                                    
                                    // ВАЖНЫЙ ШАГ: Создаем глобальный объект с актуальным балансом и публикуем событие
                                    const balanceUpdatedEvent = new CustomEvent('balanceUpdated', {
                                        detail: { value: data.amount, newBalance: data.balance, source: 'payment' }
                                    });
                                    document.dispatchEvent(balanceUpdatedEvent);
                                    
                                    // Проверяем флаг auto_start_lottery от сервера
                                    if (data.auto_start_lottery) {
                                        console.log('Сервер рекомендует автоматический запуск лотереи');
                                        // Используем логику запуска лотереи на основе pendingBetType
                                        if (window.pendingBetType) {
                                            console.log('Найдена отложенная попытка запуска лотереи с типом ставки:', window.pendingBetType);
                                            
                                            // Проверяем достаточно ли средств для ставки
                                            const betCost = betCosts[window.pendingBetType];
                                            if (data.balance >= betCost) {
                                                console.log('Баланс после пополнения достаточен для автоматического запуска лотереи');
                                                
                                                // Сохраняем тип ставки и очищаем переменную
                                                const betType = window.pendingBetType;
                                                window.pendingBetType = null;
                                                
                                                // Запускаем лотерею сразу без задержки
                                                if (typeof window.spinLottery === 'function') {
                                                    console.log('Автоматически запускаем лотерею после пополнения баланса');
                                                    window.spinLottery();
                                                } else {
                                                    console.warn('Функция запуска лотереи недоступна');
                                                }
                                            } else {
                                                console.log('Баланса все равно недостаточно для запуска лотереи');
                                                window.pendingBetType = null;
                                            }
                                        }
                                    }
                                    
                                    // Разрешаем Promise с успешным результатом
                                    resolve(true);
                                } else {
                                    console.error('Ошибка при верификации платежа:', data.error);
                                    alert(i18n.t('payment.verification_error'));
                                    resolve(false);
                                }
                            })
                            .catch(error => {
                                console.error('Ошибка при верификации платежа:', error);
                                alert(i18n.t('payment.verification_network_error'));
                                resolve(false);
                            });
                        }
                    } else if (status === 'failed') {
                        console.error('Платеж не выполнен');
                        alert(i18n.t('payment.payment_failed'));
                        resolve(false);
                    } else if (status === 'cancelled') {
                        console.log('Платеж отменен пользователем');
                        // Ничего не делаем, пользователь сам отменил платеж
                        resolve(false);
                    }
                };
                
                // Добавляем обработчик события перед открытием инвойса
                if (window.Telegram.WebApp.onEvent) {
                    window.Telegram.WebApp.onEvent('invoiceClosed', handleInvoiceClosed);
                    console.log('Зарегистрирован обработчик события invoiceClosed');
                }
                
                // Открываем инвойс в Telegram WebApp
                window.Telegram.WebApp.openInvoice(data.invoice_link, (status) => {
                    console.log('Invoice closed with status:', status);
                    
                    // Удаляем обработчик события после закрытия инвойса
                    if (window.Telegram.WebApp.offEvent) {
                        window.Telegram.WebApp.offEvent('invoiceClosed', handleInvoiceClosed);
                        console.log('Обработчик события invoiceClosed удален');
                    }
                    
                    if (status === 'paid') {
                        console.log('Платеж выполнен успешно!');
                        
                        // Более надежное получение payment_id и telegram_payment_charge_id
                        // для верификации платежа
                        let paymentId = '';
                        let telegramPaymentChargeId = '';
                        
                        // Telegram MiniApp может предоставить информацию о платеже в момент
                        // закрытия инвойса с успешным статусом, проверяем на наличие этих данных
                        if (window.Telegram.WebApp.initDataUnsafe && 
                            window.Telegram.WebApp.initDataUnsafe.payment) {
                            telegramPaymentChargeId = window.Telegram.WebApp.initDataUnsafe.payment.telegram_payment_charge_id;
                            console.log('ID платежа получен из initDataUnsafe.payment:', telegramPaymentChargeId);
                        }
                        
                        // Если не удалось получить из initDataUnsafe, пробуем из CloudStorage
                        if (!telegramPaymentChargeId && window.Telegram.WebApp.CloudStorage && 
                            window.Telegram.WebApp.CloudStorage.getItem) {
                            // Пытаемся получить telegram_payment_charge_id из хранилища
                            const storedPaymentId = window.Telegram.WebApp.CloudStorage.getItem('last_payment_id');
                            
                            if (storedPaymentId) {
                                paymentId = storedPaymentId;
                                console.log('ID платежа получен из CloudStorage:', paymentId);
                                
                                // Если в хранилище был telegram_payment_charge_id (длинный ID)
                                if (paymentId.length > 20) {
                                    telegramPaymentChargeId = paymentId;
                                }
                            }
                        }
                        
                        // Если ID всё ещё не найден, просим пользователя ввести его вручную, 
                        // чтобы можно было зафиксировать платеж
                        if (!paymentId && window.Telegram.WebApp.showPopup) {
                            window.Telegram.WebApp.showPopup({
                                title: 'Ожидается подтверждение платежа',
                                message: 'Для подтверждения оплаты нам нужна информация о вашем платеже. Вы можете скопировать ID платежа из чека в Telegram.',
                                buttons: [
                                    {id: 'ok', type: 'default', text: 'Продолжить без подтверждения'}
                                ]
                            }, () => {
                                // В любом случае отправляем запрос с доступной информацией
                                sendVerificationRequest();
                            });
                        } else {
                            // У нас есть payment_id, отправляем запрос
                            sendVerificationRequest();
                        }
                        
                        // Функция отправки запроса верификации
                        function sendVerificationRequest() {
                            // Проверяем, находимся ли мы в режиме разработки
                            const isDevMode = window.isDevMode || false;
                            const apiPrefix = isDevMode ? '/dev' : '';
                            
                            // Если есть telegram_payment_charge_id, приоритетно используем его
                            const idToSend = telegramPaymentChargeId || paymentId || '';
                            
                            console.log('Отправляем ID платежа для верификации:', idToSend);
                            
                            // Запрашиваем верификацию платежа и обновление баланса
                            fetch(`${apiPrefix}/api/verify_and_update_balance`, {
                                method: 'POST',
                                headers: {
                                    'Content-Type': 'application/json'
                                },
                                body: JSON.stringify({
                                    user_id: window.Telegram.WebApp.initDataUnsafe?.user?.id,
                                    amount: amount,
                                    payment_id: idToSend ? idToSend : "",
                                    telegram_payment_charge_id: telegramPaymentChargeId || '',
                                    initData: window.Telegram.WebApp.initData || ''
                                })
                            })
                            .then(response => response.json())
                            .then(data => {
                                console.log('Ответ от сервера verify_and_update_balance:', data);
                                
                                if (data.success) {
                                    // ВАЖНОЕ ИЗМЕНЕНИЕ: Обновляем баланс в глобальной переменной userData
                                    window.userData = window.userData || {};
                                    const oldBalance = window.userData.balance || 0;
                                    window.userData.balance = data.balance;
                                    
                                    // Показываем уведомление об успешном пополнении баланса
                                    if (data.balance > oldBalance) {
                                        // Используем либо amount из запроса к API, либо разницу между старым и новым балансом
                                        const addedAmount = (data.balance_change && data.balance_change.amount > 0) 
                                            ? data.balance_change.amount 
                                            : amount || (data.balance - oldBalance);
                                        
                                        if (addedAmount > 0) {
                                            notifications.showBalanceAdded(addedAmount);
                                        }
                                    }
                                    
                                    // Важно! Обновляем локальный объект userData, если он доступен в глобальной области
                                    if (typeof userData !== 'undefined') {
                                        userData.balance = data.balance;
                                        console.log('Локальный объект userData обновлен:', userData.balance);
                                    }
                                    
                                    // Проверяем есть ли функция formatNumber
                                    const formattedBalance = typeof formatNumber === 'function' 
                                        ? formatNumber(data.balance) 
                                        : data.balance;
                                    
                                    // Обновляем все элементы с балансом на странице
                                    const balanceElements = document.querySelectorAll('[id*="balance"], [id*="Balance"]');
                                    balanceElements.forEach(element => {
                                        // Проверяем, что элемент не содержит HTML разметку и не является кнопкой
                                        if (!element.innerHTML.includes("<") && 
                                            !element.classList.contains('add-balance-button') && 
                                            element.id !== 'addBalanceButton') {
                                            element.textContent = formattedBalance;
                                            console.log(`Обновлен элемент ${element.id}:`, element.textContent);
                                        }
                                    });
                                    
                                    // Если доступна функция updateUI, вызываем ее
                                    if (typeof updateUI === 'function') {
                                        updateUI();
                                        console.log('Вызвана функция updateUI()');
                                    }
                                    
                                    // ВАЖНЫЙ ШАГ: Создаем глобальный объект с актуальным балансом и публикуем событие
                                    const balanceUpdatedEvent = new CustomEvent('balanceUpdated', {
                                        detail: { value: data.amount, newBalance: data.balance, source: 'payment' }
                                    });
                                    document.dispatchEvent(balanceUpdatedEvent);
                                    
                                    // Проверяем флаг auto_start_lottery от сервера
                                    if (data.auto_start_lottery) {
                                        console.log('Сервер рекомендует автоматический запуск лотереи');
                                        // Используем логику запуска лотереи на основе pendingBetType
                                        if (window.pendingBetType) {
                                            console.log('Найдена отложенная попытка запуска лотереи с типом ставки:', window.pendingBetType);
                                            
                                            // Проверяем достаточно ли средств для ставки
                                            const betCost = betCosts[window.pendingBetType];
                                            if (data.balance >= betCost) {
                                                console.log('Баланс после пополнения достаточен для автоматического запуска лотереи');
                                                
                                                // Сохраняем тип ставки и очищаем переменную
                                                const betType = window.pendingBetType;
                                                window.pendingBetType = null;
                                                
                                                // Запускаем лотерею сразу без задержки
                                                if (typeof window.spinLottery === 'function') {
                                                    console.log('Автоматически запускаем лотерею после пополнения баланса');
                                                    window.spinLottery();
                                                } else {
                                                    console.warn('Функция запуска лотереи недоступна');
                                                }
                                            } else {
                                                console.log('Баланса все равно недостаточно для запуска лотереи');
                                                window.pendingBetType = null;
                                            }
                                        }
                                    }
                                    
                                    // Разрешаем Promise с успешным результатом
                                    resolve(true);
                                } else {
                                    console.error('Ошибка при верификации платежа:', data.error);
                                    alert(i18n.t('payment.verification_error'));
                                    resolve(false);
                                }
                            })
                            .catch(error => {
                                console.error('Ошибка при верификации платежа:', error);
                                alert(i18n.t('payment.verification_network_error'));
                                resolve(false);
                            });
                        }
                    } else if (status === 'failed') {
                        console.error('Платеж не выполнен');
                        alert(i18n.t('payment.payment_failed'));
                        resolve(false);
                    } else if (status === 'cancelled') {
                        console.log('Платеж отменен пользователем');
                        // Ничего не делаем, пользователь сам отменил платеж
                        resolve(false);
                    }
                });
            } else {
                console.error('Ошибка при создании инвойса:', data.error);
                alert(i18n.t('payment.invoice_creation_error'));
                resolve(false);
            }
        } catch (error) {
            console.error('Ошибка при пополнении баланса:', error);
            alert(i18n.t('payment.general_error'));
            resolve(false);
        }
    });
}

/**
 * Создает счет для пополнения баланса
 * @param {string} userId - ID пользователя
 * @param {number} amount - Сумма пополнения
 * @returns {Promise<Object>} Результат операции
 */
export async function createPaymentInvoice(userId, amount) {
    try {
        // Проверяем, находимся ли мы в режиме разработки
        const isDevMode = window.isDevMode || false;
        const apiPrefix = isDevMode ? '/dev' : '';
        
        const response = await fetch(`${apiPrefix}/api/create_invoice`, {
            method: 'POST',
            headers: createTelegramHeaders(),
            body: JSON.stringify({
                user_id: userId,
                amount: amount,
                initData: getTelegramInitData() // Добавляем initData для авторизации
            })
        });
        
        const data = await response.json();
        
        if (data.success) {
            return {
                success: true,
                payment_url: data.payment_url
            };
        } else {
            console.error('Ошибка при создании счета:', data.error);
            return {
                success: false,
                error: data.error
            };
        }
    } catch (error) {
        console.error('Ошибка при создании счета:', error);
        return {
            success: false,
            error: 'Ошибка соединения с сервером'
        };
    }
}

/**
 * Проверяет статус платежа и обновляет баланс пользователя
 * @param {string} userId - ID пользователя
 * @param {string} paymentId - ID платежа
 * @returns {Promise<Object>} Результат операции
 */
export async function verifyAndUpdateBalance(userId, paymentId) {
    try {
        // Проверяем, находимся ли мы в режиме разработки
        const isDevMode = window.isDevMode || false;
        const apiPrefix = isDevMode ? '/dev' : '';
        
        // Проверяем и нормализуем payment_id
        const normalizedPaymentId = paymentId ? String(paymentId) : "";
        
        const response = await fetch(`${apiPrefix}/api/verify_and_update_balance`, {
            method: 'POST',
            headers: createTelegramHeaders(),
            body: JSON.stringify({
                user_id: userId,
                payment_id: normalizedPaymentId,
                initData: getTelegramInitData() // Добавляем initData для авторизации
            })
        });
        
        const data = await response.json();
        
        if (data.success) {
            // Отправляем событие обновления баланса
            window.dispatchEvent(new CustomEvent('balance-updated', {
                detail: {
                    newBalance: data.new_balance,
                    oldBalance: data.previous_balance,
                    reason: 'payment'
                }
            }));
            
            return {
                success: true,
                new_balance: data.new_balance,
                amount_added: data.amount_added
            };
        } else {
            console.error('Ошибка при проверке платежа:', data.error);
            return {
                success: false,
                error: data.error
            };
        }
    } catch (error) {
        console.error('Ошибка при проверке платежа:', error);
        return {
            success: false,
            error: 'Ошибка соединения с сервером'
        };
    }
}

/**
 * Принудительно вызывает инициализацию приложения, запрашивая новые данные о стране и IP
 * @param {string} userId - ID пользователя
 * @param {Object} userData - Текущие данные пользователя
 * @returns {Promise<Object>} Результат операции
 */
export async function forceInitialization(userId, userData) {
    try {
        // Сбрасываем флаг инициализации
        clearInitializationFlag();
        
        // Загружаем данные пользователя заново
        console.log('Выполняем принудительную инициализацию приложения, будут обновлены данные о стране и IP...');
        
        // Используем существующую функцию для загрузки данных
        const result = await loadUserData(userId, userData);
        
        if (result.success) {
            console.log('Принудительная инициализация выполнена успешно');
            return {
                success: true,
                message: 'Данные о стране и IP успешно обновлены',
                userData: result.userData
            };
        } else {
            console.error('Ошибка при выполнении принудительной инициализации:', result.error);
            return {
                success: false,
                error: result.error,
                message: 'Не удалось обновить данные о стране и IP'
            };
        }
    } catch (error) {
        console.error('Ошибка при выполнении принудительной инициализации:', error);
        return {
            success: false,
            error: error.message || 'Неизвестная ошибка',
            message: 'Не удалось выполнить принудительную инициализацию'
        };
    }
}

/**
 * Получает данные об уровне пользователя на основе опыта
 * @param {Object} userData - Данные пользователя
 * @returns {Object} Данные об уровне пользователя
 */
export function getUserLevelData(userData) {
    // Импортируем функцию calculateLevelData динамически для избежания циклических зависимостей
    const calculateLevelData = (exp) => {
        if (exp < 0) exp = 0;
        
        // Начальное значение опыта для первого уровня
        const baseExp = 100;
        // Начальное увеличение опыта для каждого уровня
        let expIncrease = 15;
        // Прогрессия увеличения
        const expProgression = 5;
        
        let totalExpNeeded = 0;
        let level = 1;
        let currentLevelExp = baseExp;
        
        // Рассчитываем уровень на основе опыта
        while (exp >= totalExpNeeded + currentLevelExp) {
            totalExpNeeded += currentLevelExp;
            level += 1;
            // Увеличиваем требуемый опыт для следующего уровня
            expIncrease += expProgression;
            currentLevelExp = baseExp + (level - 1) * expIncrease;
        }
        
        // Опыт на текущем уровне
        const currentExp = exp - totalExpNeeded;
        // Процент прогресса на текущем уровне
        const progress = (currentExp / currentLevelExp) * 100;
        
        return {
            level,
            currentExp,
            levelExp: currentLevelExp,
            totalExpNeeded,
            progress
        };
    };
    
    // Получаем опыт из данных пользователя (или 0, если не задан)
    const exp = userData.exp || 0;
    
    // Рассчитываем данные об уровне
    return calculateLevelData(exp);
} 