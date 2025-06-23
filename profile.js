// Импортируем функции из модулей
import { applyTelegramColorScheme, formatNumber, setupScrollbarVisibility, initTgsSupport, animateBalance } from './modules/ui-utils.js';
import { showSuccess, showError, showWarning, showInfo, showGiftSold } from './modules/notifications.js';
import { loadUserData as fetchUserData, loadUserGifts as fetchUserGifts, sellGift as apiSellGift, updateUserAvatar, updateBalanceDisplay, getUserLevelData, buyStars } from './modules/user-data.js';
import { showGiftModal, showTopUpModal } from './modules/modal.js';
import { showConfirmDialog, createSellButtonText } from './modules/confirm-modal.js';
import { updateGiftsList, setupProfileTabs } from './modules/profile-ui.js';
import { setupNavigation } from './modules/navigation.js';
import { showBalanceUpdateAnimation } from './modules/animations.js';
import { updateExperienceDisplay } from './modules/experience.js';
import { initReferralStats, loadReferralStats, loadReferralHistory } from './modules/referral-stats.js';
import * as i18n from './modules/i18n.js';

// Функция для управления прелоадером
function hidePreloader() {
    const preloader = document.getElementById('preloader');
    if (preloader) {
        preloader.classList.add('hidden');
        setTimeout(() => {
            preloader.style.display = 'none';
        }, 500); // Ждем завершения анимации скрытия
    }
}

document.addEventListener('DOMContentLoaded', async function() {
    // Проверяем, загружены ли переводы
    if (window.i18n && window.i18n.getCurrentLanguage && typeof window.i18n.getCurrentLanguage() === 'string') {
        console.log('Переводы уже загружены, инициализируем профиль');
        initializeProfile();
    } else {
        console.log('Ожидаем загрузки переводов для профиля...');
        
        // Подключаем i18n модуль глобально
        try {
            const i18nModule = await import('./modules/i18n.js');
            window.i18n = i18nModule;
            const userLanguage = i18nModule.getLanguageFromTelegram();
            console.log('Загружаем переводы для языка:', userLanguage);
            await i18nModule.initI18n(userLanguage);
            
            // Применяем переводы ко всем элементам
            document.querySelectorAll('[data-i18n]').forEach(element => {
                const key = element.getAttribute('data-i18n');
                element.textContent = i18nModule.t(key);
            });
            
            initializeProfile();
        } catch (error) {
            console.error('Ошибка при загрузке модуля i18n:', error);
            // В случае ошибки все равно инициализируем
            initializeProfile();
        }
    }
});

// Функция инициализации профиля
async function initializeProfile() {
    // Инициализация Telegram WebApp
    const tg = window.Telegram.WebApp;
    tg.expand(); // Расширяем приложение на весь экран
    
    // Применяем цветовую схему Telegram
    applyTelegramColorScheme();
    
    // Инициализируем поддержку TGS анимаций
    initTgsSupport();
    
    // Используем уже загруженный модуль i18n
    const i18n = window.i18n;
    
    // Получаем язык пользователя
    const userLanguage = i18n ? i18n.getCurrentLanguage() : 'ru';
    
    // Данные пользователя
    let userData = {
        id: tg.initDataUnsafe?.user?.id,
        first_name: tg.initDataUnsafe?.user?.first_name,
        last_name: tg.initDataUnsafe?.user?.last_name || '',
        photo_url: tg.initDataUnsafe?.user?.photo_url || '',
        username: tg.initDataUnsafe?.user?.username || '',
        language_code: userLanguage,
        balance: 0,
        gifts: []
    };
    
    // Хранение полной информации о подарках
    let allGifts = {};
    
    // Элементы DOM
    const profileAvatar = document.getElementById('profileAvatar');
    const profileName = document.getElementById('profileName');
    const profileBalanceValue = document.getElementById('profileBalanceValue');
    const addBalanceButton = document.getElementById('addBalanceButton');
    const profileTabs = document.querySelectorAll('.profile-tab');
    const tabPanes = document.querySelectorAll('.tab-pane');
    const giftsList = document.getElementById('giftsList');
    const navItems = document.querySelectorAll('.nav-item');
    
    // Загружаем данные пользователя с сервера
    async function loadUserData() {
        try {
            // Используем функцию из модуля user-data.js
            const result = await fetchUserData(userData.id, userData);
            
            if (result.success) {
                userData = result.userData;
                allGifts = result.all_gifts || {};
                
                // Обновляем список подарков с использованием функции из profile-ui.js
                if (userData.gifts && Array.isArray(userData.gifts)) {
                    updateGiftsList(userData.gifts, giftsList, (gift) => {
                        showGiftModal(gift, sellGift, refreshUserGifts);
                    });
                }
                
                // Обновляем интерфейс
                updateUI();
            } else {
                // Используем демо-данные в случае ошибки
                updateUI();
            }
            
            // Скрываем прелоадер после загрузки данных
            hidePreloader();
        } catch (error) {
            console.error('Ошибка загрузки данных пользователя:', error);
            
            // Используем демо-данные в случае ошибки
            updateUI();
            
            // Скрываем прелоадер даже в случае ошибки
            hidePreloader();
        }
    }
    
    // Обновление данных о подарках пользователя (используется при необходимости обновить только подарки)
    async function refreshUserGifts() {
        try {
            // Проверяем, что userData и userData.id определены
            if (!userData || userData.id === undefined || userData.id === null) {
                console.error('Ошибка загрузки подарков: данные пользователя не определены или ID отсутствует');
                return;
            }
            
            // Используем функцию из модуля user-data.js
            const result = await fetchUserGifts(userData.id);
            
            if (result.success) {
                userData.gifts = result.gifts;
                
                // Сохраняем полную информацию о всех подарках
                if (result.all_gifts) {
                    allGifts = result.all_gifts;
                    
                    // Логируем информацию об обновлении для отладки
                    console.log('Получены обновленные данные о подарках:', {
                        userGiftsCount: userData.gifts.length,
                        allGiftsCount: Object.keys(allGifts).length
                    });
                }
                
                // Обновляем список подарков с использованием функции из profile-ui.js
                updateGiftsList(userData.gifts, giftsList, (gift) => {
                    showGiftModal(gift, sellGift, refreshUserGifts);
                });
            } else {
                console.error('Ошибка загрузки подарков пользователя:', result.error);
            }
        } catch (error) {
            console.error('Ошибка при запросе к серверу:', error);
        }
    }
    
    // Обновляем интерфейс на основе текущих данных
    function updateUI() {
        // Обновляем аватарку пользователя
        updateUserAvatar(userData, 'profileAvatar');
        
        // Обновляем имя пользователя
        let displayName = userData.first_name || 'Пользователь';
        if (userData.last_name) {
            displayName += ' ' + userData.last_name;
        }
        profileName.textContent = displayName;
        
        // Обновляем баланс без анимации
        updateBalanceDisplay(userData, 'profileBalanceValue');
        
        // Обновляем отображение опыта
        updateExperienceDisplay(userData, '#experienceContainer', 'profile');
    }
    
    // Функция проверки доступности Telegram WebApp API
    function isTelegramWebAppAvailable() {
        return window.Telegram?.WebApp?.initData;
    }
    
    // Обертка для безопасного выполнения обновления подарков
    function safeRefreshUserGifts() {
        if (isTelegramWebAppAvailable() && !document.hidden) {
            refreshUserGifts();
        } else {
            console.log('Пропуск автоматического обновления подарков: Telegram WebApp API недоступен или страница скрыта');
        }
    }
    
    // Настраиваем автоматическое обновление данных о подарках при активации страницы
    document.addEventListener('visibilitychange', function() {
        if (!document.hidden && isTelegramWebAppAvailable()) {
            console.log('Страница стала видимой, обновляем данные о подарках');
            refreshUserGifts();
        }
    });
    
    // Устанавливаем периодическое обновление подарков (каждые 5 минут)
    // ТОЛЬКО если Telegram WebApp доступен
    const REFRESH_INTERVAL = 5 * 60 * 1000; // 5 минут в миллисекундах
    if (isTelegramWebAppAvailable()) {
        setInterval(safeRefreshUserGifts, REFRESH_INTERVAL);
        console.log('Автоматическое обновление подарков включено (каждые 5 минут)');
    } else {
        console.log('Автоматическое обновление подарков отключено: Telegram WebApp недоступен');
    }
    
    /**
     * Продает подарок и обновляет интерфейс
     * @param {string} giftId - ID подарка
     * @param {number} giftValue - Стоимость подарка
     * @param {boolean} skipConfirmation - Флаг для пропуска подтверждения (когда вызывается из уже подтвержденного диалога)
     * @returns {Promise<Object>} Результат операции с сервера
     */
    async function sellGift(giftId, giftValue, skipConfirmation = false) {
        // Отладочная информация
        console.log(`Попытка продать подарок с ID: ${giftId}, Стоимость: ${giftValue}, Skip Confirmation: ${skipConfirmation}`);
        
        // Используем Promise для обработки асинхронного подтверждения
        return new Promise(async (resolve) => {
            // Подтверждение продажи подарка
            if (!skipConfirmation) {
                // Создаем текст кнопки продажи с иконкой кристалла
                const sellButtonText = createSellButtonText(i18n.t('gifts.sell_for'), formatNumber(giftValue));
                
                // Используем кастомный диалог вместо стандартного confirm
                showConfirmDialog({
                    hideTitle: true, // Скрываем заголовок
                    message: i18n.t('gifts.sell_description'),
                    confirmText: 'OK',
                    cancelText: i18n.t('common.cancel'),
                    simpleLayout: true, // Используем простой макет с ОК справа и темной Отмена слева
                    onConfirm: async () => {
                        // Продажа подтверждена, выполняем запрос к API
                        const result = await performSellGift(giftId, giftValue);
                        resolve(result);
                    },
                    onCancel: () => {
                        // Продажа отменена
                        resolve({ success: false, canceled: true });
                    }
                });
            } else {
                // Если подтверждение не требуется, сразу выполняем запрос
                const result = await performSellGift(giftId, giftValue);
                resolve(result);
            }
        });
        
        // Вспомогательная функция для выполнения запроса продажи подарка
        async function performSellGift(giftId, giftValue) {
            try {
                // Используем функцию из модуля user-data.js
                console.log(`Отправка запроса на продажу: user_id=${userData.id}, gift_id=${giftId}`);
                const data = await apiSellGift(userData.id, giftId);
                
                // Отладочная информация о полученном ответе
                console.log('Ответ от сервера на запрос продажи подарка:', data);
                
                if (data.success) {
                    // Получаем текущее значение баланса перед обновлением
                    const oldBalance = userData.balance;
                    
                    // Обновляем баланс пользователя в объекте данных
                    userData.balance = data.new_balance;
                    
                    // Получаем элемент баланса
                    const balanceElement = document.getElementById('profileBalanceValue');
                    
                    // Анимируем обновление баланса
                    if (balanceElement) {
                        animateBalance(balanceElement, oldBalance, userData.balance, 800);
                    } else {
                        updateBalanceDisplay(userData, 'profileBalanceValue');
                    }
                    
                    // Используем данные о подарках из ответа сервера вместо дополнительного запроса
                    if (data.gifts && Array.isArray(data.gifts)) {
                        userData.gifts = data.gifts;
                        
                        // Обновляем список подарков с использованием функции из profile-ui.js
                        updateGiftsList(userData.gifts, giftsList, (gift) => {
                            showGiftModal(gift, sellGift, refreshUserGifts);
                        });
                        
                        console.log('Список подарков обновлен из ответа сервера без дополнительного запроса');
                    } else {
                        // Если в ответе нет данных о подарках, делаем запрос для обновления
                        console.log('В ответе нет данных о подарках, делаем дополнительный запрос');
                        refreshUserGifts();
                    }
                    
                    // Показываем уведомление об успешной продаже подарка
                    showGiftSold(giftValue);
                } else {
                    console.error('Ошибка при продаже подарка:', data.error);
                    
                    // Проверяем наличие ошибки колдауна
                    if (data.cooldown && data.remaining) {
                        // Используем уведомление из модуля notifications
                        const message = `Слишком много запросов. Подождите ${data.remaining} сек.`;
                        showWarning(message);
                    } else {
                        // Для других ошибок показываем стандартное уведомление
                        showError(data.error || 'Не удалось продать подарок');
                    }
                }
                
                return data;
            } catch (error) {
                console.error('Ошибка при продаже подарка:', error);
                showError('Ошибка соединения с сервером');
                return { success: false, error: error.message };
            }
        }
    }
    
    // Обработчик нажатия на кнопку пополнения баланса
    addBalanceButton.addEventListener('click', function() {
        // Показываем модальное окно выбора суммы пополнения
        showTopUpModal(onBuyStarsSelected);
    });
    
    // Функция-обработчик выбора суммы пополнения
    function onBuyStarsSelected(amount, resetButtonState) {
        if (!amount || amount <= 0) {
            if (resetButtonState) resetButtonState(false);
            return;
        }
        
        // Сохраняем текущий баланс перед покупкой
        const oldBalance = userData.balance;
        
        // Вызываем функцию покупки звезд из модуля user-data.js
        buyStars(amount)
            .then(result => {
                if (result === true) {
                    // Обновляем баланс пользователя в объекте данных
                    // userData.balance обновляется внутри функции buyStars
                    
                    // Получаем элемент баланса
                    const balanceElement = document.getElementById('profileBalanceValue');
                    
                    // Анимируем обновление баланса
                    if (balanceElement) {
                        // Используем актуальное значение баланса
                        animateBalance(balanceElement, oldBalance, userData.balance, 800);
                    } else {
                        updateBalanceDisplay(userData, 'profileBalanceValue');
                    }
                    
                    // Обновляем остальные данные пользователя
                    loadUserData();
                    
                    // Передаем true в колбэк, чтобы указать на успешное завершение операции
                    if (resetButtonState) resetButtonState(true);
                } else {
                    // Если операция не удалась, передаем false
                    if (resetButtonState) resetButtonState(false);
                }
            })
            .catch(error => {
                console.error('Ошибка при покупке звезд:', error);
                // Сбрасываем состояние кнопки при ошибке и передаем false
                if (resetButtonState) resetButtonState(false);
            });
    }
    
    // Добавляем обработчик события для обновления баланса
    document.addEventListener('balanceUpdated', handleBalanceUpdated);
    
    // Обработчик события обновления баланса
    function handleBalanceUpdated(event) {
        const { value, newBalance, source } = event.detail;
        
        console.log(`Профиль: получено событие обновления баланса: ${value} (источник: ${source || 'неизвестно'})`);
        
        // Обновляем баланс в локальном объекте
        if (typeof newBalance === 'number') {
            // Получаем элемент баланса в профиле
            const balanceElement = document.getElementById('profileBalanceValue');
            
            // Получаем текущее значение баланса из элемента
            const currentDisplayedBalance = balanceElement ? parseInt(balanceElement.textContent.replace(/\s/g, '')) || 0 : 0;
            
            // Анимируем обновление баланса если элемент существует и значения различаются
            if (balanceElement && currentDisplayedBalance !== newBalance) {
                animateBalance(balanceElement, currentDisplayedBalance, newBalance, 800);
            } else {
                // Иначе используем обычное обновление баланса
                userData.balance = newBalance;
                updateBalanceDisplay(userData, 'profileBalanceValue');
            }
            
            // Обновляем интерфейс
            updateUI();
        }
    }
    
    // Настраиваем обработчики вкладок профиля с использованием функции из profile-ui.js
    setupProfileTabs(profileTabs, tabPanes);
    
    // Добавляем обработчик для вкладки friends для инициализации реферальной системы
    profileTabs.forEach(tab => {
        tab.addEventListener('click', function() {
            const tabName = this.getAttribute('data-tab');
            
            // Инициализируем реферальную систему при переключении на вкладку friends
            if (tabName === 'friends') {
                console.log('Инициализация реферальной системы для вкладки friends');
                initReferralStats(userData);
            }
        });
    });
    
    // Настраиваем нижнюю панель навигации
    setupNavigation(navItems, {});
    
    // Загружаем данные пользователя и инициализируем приложение
    loadUserData();
    
    // Инициализируем управление видимостью полосы прокрутки
    setupScrollbarVisibility();
} 