// Импортируем функции из модулей
import { applyTelegramColorScheme, formatNumber, formatGiftPrice, setupScrollbarVisibility, triggerHapticFeedback, initTgsSupport, animateBalance } from './modules/ui-utils.js';
import TasksOptimizer from './modules/tasks/TasksOptimizer.js';
import { showSuccess, showError, showWarning, showInfo, showDailyLimitReached, showNotification, showTaskPlayTenGamesCompleted, showTaskPlayFiveGamesCompleted, showTaskCompleted, showTaskPlay500GamesCompleted, showTaskCollectionCompleted, showTaskAchievementFastPlayCompleted } from './modules/notifications.js';
import { 
    getAvailableGiftsForBet, 
    generateSequenceWithWinningGift, 
    generateDemoResult,
    getServerResult,
    validateAndFixResult,
    sellGift,
    selectRandomGiftByChance
} from './modules/game-logic.js';
import {
    animateLottery,
    showBalanceUpdateAnimation,
    animateGiftToProfile,
    initLotteryDisplay,
    centerLotteryItems,
    markAnimationSkipped,
    positionLotteryForWinningItem,
    startIdleAnimation,
    stopIdleAnimation
} from './modules/animations.js';
import {
    betCosts,
    loadUserData,
    saveGift,
    updateUserInfo,
    updateUserAvatar,
    updateBalanceDisplay,
    updateSpinButton,
    canStartSpin,
    updateUserStatsForSpin,
    loadUserGifts,
    getUserLevelData
} from './modules/user-data.js';
import {
    showWinModal,
    closeWinModal,
    initModalHandlers
} from './modules/modal.js';
import { setupNavigation } from './modules/navigation.js';
import { updateExperienceDisplay } from './modules/experience.js';

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
    console.log('DOM загружен, начинаем инициализацию приложения');
    
    // Проверяем, загружены ли переводы
    if (window.i18n && window.i18n.getCurrentLanguage && typeof window.i18n.getCurrentLanguage() === 'string') {
        console.log('Переводы уже загружены, инициализируем приложение');
        initializeApp();
    } else {
        console.log('Ожидаем загрузки переводов...');
        // Ожидаем загрузки переводов
        document.addEventListener('translationsLoaded', function() {
            console.log('Получено событие загрузки переводов, инициализируем приложение');
            initializeApp();
        }, { once: true });
    }
});

// Функция инициализации приложения
async function initializeApp() {
    // Инициализация Telegram WebApp
    const tg = window.Telegram?.WebApp;
    
    if (!tg) {
        console.error('Telegram WebApp API не доступен. Приложение может работать некорректно.');
        // Продолжаем инициализацию приложения, даже если API не доступен
    } else {
        console.log('Telegram WebApp API инициализирован. Доступные методы:', Object.keys(tg));
        console.log('switchInlineQuery доступен:', !!tg.switchInlineQuery);
        tg.expand(); // Расширяем приложение на весь экран
    }
    
    // Для мобильных устройств Android добавляем хак для прокрутки
    const ENABLE_ANDROID_SCROLL_HACK = true;
    
    // Применяем цветовую схему Telegram
    applyTelegramColorScheme();
    
    // Инициализируем поддержку TGS анимаций
    initTgsSupport();
    
    // Инициализируем оптимизатор заданий
    if (!window.tasksOptimizer) {
        window.tasksOptimizer = new TasksOptimizer();
    }
    
    // Проверяем доступность HapticFeedback
    const hapticFeedbackSupported = tg.HapticFeedback !== undefined;
    
    // Используем уже загруженные переводы
    const i18n = window.i18n;
    if (!i18n) {
        console.error('Модуль i18n не найден. Функциональность перевода будет недоступна.');
    } else {
        console.log('Используем загруженный модуль i18n, текущий язык:', i18n.getCurrentLanguage());
        
        // Еще раз применяем переводы ко всем элементам для надежности
        document.querySelectorAll('[data-i18n]').forEach(element => {
            const key = element.getAttribute('data-i18n');
            element.textContent = i18n.t(key);
        });
    }
    
    // Данные пользователя и игры
    let userData = {
        id: tg.initDataUnsafe?.user?.id,
        first_name: tg.initDataUnsafe?.user?.first_name,
        last_name: tg.initDataUnsafe?.user?.last_name || '',
        photo_url: tg.initDataUnsafe?.user?.photo_url || '',
        username: tg.initDataUnsafe?.user?.username || '',
        language_code: tg.initDataUnsafe?.user?.language_code || 'ru',
        start_param: tg.initDataUnsafe?.start_param || null, // Реферальный код из ссылки
        balance: 0,
        gifts: []
    };
    
    console.log('Данные пользователя инициализированы:', 
                { id: userData.id, username: userData.username, language_code: userData.language_code });
    
    let gameState = {
        selectedBet: 'low',  // Выбранный тип ставки из localStorage или 'low' по умолчанию
        demoMode: false,     // Демо-режим выключен по умолчанию
        isSpinning: false,   // Происходит ли прокрутка в данный момент
        gifts: {
            // Данные будут загружены с сервера
        },
        lastGiftsUpdate: 0,   // Метка времени последнего обновления подарков
        lastGameResult: null  // Сохраняем результат последней игры для возможности пропуска анимации
    };
    
    // Объект для отслеживания показанных уведомлений о выполнении заданий
    const taskNotificationsShown = {
        // Ключ: task_id, значение: true если уведомление было показано
    };
    
    // Функция для проверки, было ли уже показано уведомление для задания
    function wasTaskNotificationShown(taskId) {
        const storageKey = `task_notification_${taskId}`;
        return localStorage.getItem(storageKey) === 'true';
    }

    // Функция для установки статуса показа уведомления задания
    function setTaskNotificationShown(taskId, isShown = true) {
        const storageKey = `task_notification_${taskId}`;
        if (isShown) {
            localStorage.setItem(storageKey, 'true');
        } else {
            localStorage.removeItem(storageKey);
        }
    }

    // Функция для сброса статуса показа уведомления задания
    function resetTaskNotificationStatus(taskId) {
        if (taskId) {
            setTaskNotificationShown(taskId, false);
            console.log(`Сброшен статус уведомления для задания ${taskId}`);
        }
    }

    // Экспортируем функцию для использования в других модулях
    window.resetTaskNotificationStatus = resetTaskNotificationStatus;
    
    // Элементы DOM
    const betOptions = document.querySelectorAll('.bet-option');
    const betOptionsContainer = document.querySelector('.bet-options');
    const lotteryItems = document.getElementById('lotteryItems');
    const spinButton = document.getElementById('spinButton');
    const demoModeToggle = document.getElementById('demoModeToggle');
    const demoModeCheckbox = document.getElementById('demoMode');
    const skipAnimationButton = document.getElementById('skipAnimationButton');
    const giftsContainer = document.getElementById('giftsContainer');
    const winModal = document.getElementById('winModal');
    const demoWinModal = document.getElementById('demoWinModal'); // Новое модальное окно для демо-режима
    const wonGift = document.getElementById('wonGift');
    const demoWonGift = document.getElementById('demoWonGift'); // Элемент для отображения подарка в демо-режиме
    const giftName = document.getElementById('giftName');
    const receiveGift = document.getElementById('receiveGift'); // Новая кнопка "Получить"
    const keepGift = document.getElementById('keepGift');
    const sellGiftBtn = document.getElementById('sellGift');
    const demoCloseBtn = document.getElementById('demoCloseBtn'); // Кнопка закрытия демо-окна
    const demoDisableBtn = document.getElementById('demoDisableBtn'); // Кнопка отключения демо-режима
    const balanceDisplay = document.getElementById('balanceDisplay');
    const balanceValue = document.getElementById('balanceValue');
    
    // Проверяем инициализацию элементов модального окна
    if (!winModal) console.error('Не удалось найти элемент #winModal');
    if (!demoWinModal) console.error('Не удалось найти элемент #demoWinModal');
    if (!wonGift) console.error('Не удалось найти элемент #wonGift');
    if (!demoWonGift) console.error('Не удалось найти элемент #demoWonGift');
    if (!giftName) console.error('Не удалось найти элемент #giftName');
    if (!receiveGift) console.error('Не удалось найти элемент #receiveGift');
    if (!keepGift) console.error('Не удалось найти элемент #keepGift');
    if (!sellGiftBtn) console.error('Не удалось найти элемент #sellGift');
    if (!demoCloseBtn) console.error('Не удалось найти элемент #demoCloseBtn');
    if (!demoDisableBtn) console.error('Не удалось найти элемент #demoDisableBtn');
    
    // Загружаем данные пользователя с сервера
    async function loadUserDataAndInitialize() {
        console.log('Начинаем загрузку данных пользователя');
        
        try {
            const result = await loadUserData(userData.id, userData);
            
            if (result.success) {
                console.log('Данные пользователя успешно загружены');
                userData = result.userData;
                gameState.gifts = result.gifts;
                gameState.lastGiftsUpdate = Date.now();
            } else {
                // Проверяем, является ли ошибка связанной с авторизацией
                if (result.error && result.error.auth_failed) {
                    console.error('Ошибка авторизации, перенаправление на страницу ошибки авторизации');
                    // Перенаправляем на страницу ошибки авторизации
                    window.location.href = result.error.redirect || 'auth_error';
                    return; // Прерываем выполнение функции
                }
                
                // Для других ошибок показываем сообщение
                console.warn('Проблема соединения с сервером:', result.error);
                
                // Попытка снова загрузить данные через 3 секунды
                console.log('Повторная попытка загрузки данных через 3 секунды...');
                setTimeout(loadUserDataAndInitialize, 3000);
                return;
            }
            
            // Обновляем интерфейс и инициализируем лотерею
            updateUI();
            setupLotteryDisplay();
            
            // Инициализируем обработчики модальных окон
            initModalHandlers({
                userData: userData,
                saveGiftFn: saveGift,
                sellGiftFn: sellGift,
                updateUiFn: updateUI
            });
            
            // Подписываемся на события из модального модуля
            document.addEventListener('balanceUpdated', handleBalanceUpdated);
            document.addEventListener('demoModeChanged', handleDemoModeChanged);
            document.addEventListener('user-gifts-updated', handleUserGiftsUpdated);
            
            // Скрываем прелоадер после инициализации
            console.log('Скрываем прелоадер после инициализации');
            hidePreloader();
            
            // Запускаем анимацию скролла сразу после инициализации
            animateGiftsContainerScroll();
            
            // Настраиваем автоматическое обновление данных о подарках
            setupAutoRefresh();
        } catch (error) {
            console.error('Критическая ошибка при загрузке данных пользователя:', error);
            
            // Показываем пользователю сообщение об ошибке в прелоадере
            const preloader = document.getElementById('preloader');
            if (preloader) {
                const preloaderContent = preloader.querySelector('.preloader-content') || preloader;
                preloaderContent.innerHTML = `
                    <div class="error-message">
                        <p>Возникла ошибка при загрузке приложения</p>
                        <button id="retryButton" class="retry-button">Повторить</button>
                    </div>
                `;
                
                // Добавляем обработчик для кнопки повтора
                const retryButton = document.getElementById('retryButton');
                if (retryButton) {
                    retryButton.addEventListener('click', function() {
                        // Возвращаем прелоадер в исходное состояние
                        preloaderContent.innerHTML = `
                            <div class="spinner"></div>
                            <p>Загрузка...</p>
                        `;
                        
                        // Пробуем загрузить данные снова
                        setTimeout(loadUserDataAndInitialize, 500);
                    });
                }
            }
        }
    }
    
    // Обновляет данные игры с сервера
    async function refreshGameData() {
        console.log('Обновление данных игры');
        
        try {
            // Используем функцию loadUserGifts из модуля user-data.js
            const result = await loadUserGifts(userData.id);
            
            if (result.success) {
                console.log('Данные подарков успешно обновлены');
                gameState.gifts = result.all_gifts;
                gameState.lastGiftsUpdate = Date.now();
                
                // Обновляем интерфейс
                updateGiftsDisplay();
                setupLotteryDisplay();
            } else {
                console.warn('Не удалось обновить данные о подарках:', result.error);
            }
        } catch (error) {
            console.error('Ошибка при обновлении данных игры:', error);
        }
    }
    
    // Настраивает автоматическое обновление данных
    function setupAutoRefresh() {
        // Функция проверки доступности Telegram WebApp API
        function isTelegramWebAppAvailable() {
            return window.Telegram?.WebApp?.initData;
        }
        
        // Обертка для безопасного выполнения обновления данных
        function safeRefreshGameData() {
            if (isTelegramWebAppAvailable() && !document.hidden) {
                refreshGameData();
            } else {
                console.log('Пропуск автоматического обновления: Telegram WebApp API недоступен или страница скрыта');
            }
        }
        
        // Обновляем данные при восстановлении видимости страницы
        document.addEventListener('visibilitychange', function() {
            if (!document.hidden && isTelegramWebAppAvailable()) {
                console.log('Страница стала видимой, обновляем данные о подарках');
                refreshGameData();
            }
        });
        
        // Устанавливаем периодическое обновление (каждые 5 минут)
        // ТОЛЬКО если Telegram WebApp доступен
        const REFRESH_INTERVAL = 5 * 60 * 1000; // 5 минут в миллисекундах
        if (isTelegramWebAppAvailable()) {
            setInterval(safeRefreshGameData, REFRESH_INTERVAL);
            console.log('Автоматическое обновление игровых данных включено (каждые 5 минут)');
        } else {
            console.log('Автоматическое обновление игровых данных отключено: Telegram WebApp недоступен');
        }
    }
    
    // Обновляем интерфейс на основе текущих данных
    function updateUI() {
        // Создаем объект с функциями обновления, чтобы можно было легко добавлять или изменять порядок
        const updaters = {
            gifts: updateGiftsDisplay,
            button: () => { updateSpinButton(gameState.demoMode, gameState.selectedBet); },
            betSelector: updateBetSelector,
            demoMode: () => { demoModeCheckbox.checked = gameState.demoMode; },
            balance: () => { updateBalanceDisplay(userData); },
            avatar: () => { updateUserAvatar(userData); },
            userInfo: () => { updateUserInfo(userData); },
            experience: () => { updateExperienceDisplay(userData, '#headerExpContainer', 'header'); }
        };
        
        // Выполняем все обновления
        Object.values(updaters).forEach(updater => updater());
    }
    
    // Обновляем отображение ползунка выбора ставки
    function updateBetSelector() {
        // Очищаем все классы выбора ставки
        betOptionsContainer.classList.remove('medium-selected', 'high-selected', 'ultra-selected');
        
        // Снимаем выделение со всех опций
        betOptions.forEach(option => option.classList.remove('selected'));
        
        // Выделяем выбранную опцию и добавляем соответствующий класс для ползунка
        const selectedIndex = ['low', 'medium', 'high', 'ultra'].indexOf(gameState.selectedBet);
        if (selectedIndex > 0) {
            betOptionsContainer.classList.add(`${gameState.selectedBet}-selected`);
        }
        
        if (selectedIndex >= 0 && selectedIndex < betOptions.length) {
            betOptions[selectedIndex].classList.add('selected');
        }
    }
    
    // Инициализируем отображение лотереи
    function setupLotteryDisplay(forceUpdate = false) {
        // Получаем подарки для текущего типа ставки
        const availableGifts = getAvailableGiftsForBetLocal(gameState.selectedBet);
        
        // Используем функцию из модуля animations.js
        initLotteryDisplay(lotteryItems, availableGifts, forceUpdate);
    }
    
    // Получает доступные подарки для текущего типа ставки
    function getAvailableGiftsForBetLocal(betType) {
        return getAvailableGiftsForBet(gameState.gifts, betType);
    }
    
    // Обновляем список возможных выигрышей
    function updateGiftsDisplay() {
        giftsContainer.innerHTML = '';
        
        // Получаем подарки для текущего типа ставки
        const availableGifts = getAvailableGiftsForBetLocal(gameState.selectedBet);
        
        // Если нет доступных подарков, выходим
        if (!availableGifts.length) return;
        
        // Сортируем по убыванию стоимости (от дорогих к дешёвым)
        availableGifts.sort((a, b) => {
            // Используем ТОЛЬКО star_count для сортировки
            const valueA = a[1].star_count || 0;
            const valueB = b[1].star_count || 0;
            return valueB - valueA;
        });
        
        // Создаем элементы для уникальных подарков
        renderUniqueGifts(availableGifts);
    }
    
    // Отображает уникальные подарки в контейнере
    function renderUniqueGifts(availableGifts) {
        // Создаем объект для отслеживания уникальных ID подарков
        const uniqueGiftIds = new Set();
        const fragment = document.createDocumentFragment();
        
        // Логируем доступные подарки для отладки
        console.log('Доступные подарки для отображения:', availableGifts.map(([id, gift]) => ({
            id, 
            emoji: gift.emoji, 
            star_count: gift.star_count, 
            chance: gift.chance,
            gift_type: gift.gift_type || gift.type
        })));
        
        // Создаем элементы для каждого уникального подарка
        availableGifts.forEach(([id, gift]) => {
            // Пропускаем уже обработанные ID
            if (uniqueGiftIds.has(id)) return;
            
            // Добавляем ID в набор уникальных
            uniqueGiftIds.add(id);
            
            // Создаем элемент подарка
            const giftElement = createGiftElement(gift);
            fragment.appendChild(giftElement);
        });
        
        // Логируем количество уникальных подарков
        console.log(`Отображаем ${uniqueGiftIds.size} уникальных подарка(ов)`);
        
        // Добавляем все элементы в DOM одной операцией
        giftsContainer.appendChild(fragment);
    }
    
    // Создает элемент подарка
    function createGiftElement(gift) {
        const giftElement = document.createElement('div');
        giftElement.className = 'gift-item';
        
        // Проверяем, является ли подарок эксклюзивным
        const isExclusive = gift.gift_type === 'exclusive' || gift.type === 'exclusive';
        
        // Добавляем класс в зависимости от типа подарка
        if (gift.gift_type === 'limited') {
            giftElement.classList.add('gift-limited');
        } else if (gift.gift_type === 'upgradable') {
            giftElement.classList.add('gift-upgradable');
        } else if (isExclusive) {
            giftElement.classList.add('gift-exclusive');
        }
        
        // Получаем значение подарка, используя star_count
        const giftValue = gift.star_count || 0;
        
        // Определяем класс ценового диапазона
        let priceTier = '';
        let labelTier = '';
        
        if (giftValue >= 500) {
            priceTier = 'gift-price-tier-5';
            labelTier = isExclusive ? 'price-tier-5-exclusive-label' : 'price-tier-5-label';
        } else if (giftValue >= 300) {
            priceTier = 'gift-price-tier-4';
            labelTier = isExclusive ? 'price-tier-4-exclusive-label' : 'price-tier-4-label';
        } else if (giftValue >= 200) {
            priceTier = 'gift-price-tier-3';
            labelTier = isExclusive ? 'price-tier-3-exclusive-label' : 'price-tier-3-label';
        } else if (giftValue >= 100) {
            priceTier = 'gift-price-tier-2';
            labelTier = isExclusive ? 'price-tier-2-exclusive-label' : 'price-tier-2-label';
        } else if (giftValue > 0) {
            // Для наименьшего ценового диапазона
            labelTier = isExclusive ? 'price-tier-1-exclusive-label' : 'price-tier-1-label';
        }
        
        // Добавляем класс ценового диапазона к элементу подарка
        if (priceTier) {
            giftElement.classList.add(priceTier);
        }
        
        // Создаем внутреннее содержимое подарка
        let giftIconContent = '';
        
        // Проверим наличие нужных данных
        console.log(`Подарок (${gift.emoji}):`, { 
            gift_type: gift.gift_type, 
            has_thumbnail: !!gift.thumbnail,
            has_thumbnail_path: !!gift.thumbnail_path,
            thumbnail_path: gift.thumbnail_path || 'нет путь',
            thumbnail_url: gift.thumbnail?.url || 'нет url',
            emoji_code: gift.emoji ? gift.emoji.codePointAt(0).toString(16) : 'нет emoji',
            chance: gift.chance || 0,
            price_tier: priceTier
        });
        
        // Проверяем наличие thumbnail_path для всех типов подарков
        if (gift.thumbnail_path) {
            // Используем миниатюру из пути thumbnail_path
            // Добавляем проверку на наличие префикса '/dev' для режима разработки
            const isDevMode = window.isDevMode || window.location.pathname.includes('/dev/');
            const apiPrefix = isDevMode && !gift.thumbnail_path.startsWith('/dev') ? '/dev' : '';
            giftIconContent = `<img src="${apiPrefix}${gift.thumbnail_path}" 
                alt="${gift.emoji}" class="gift-thumbnail" />`;
        } else if (gift.gift_type === 'limited' || gift.gift_type === 'upgradable' || isExclusive) {
            // Определяем путь к миниатюре для специальных типов
            let thumbnailPath = '';
            
            // Если есть прямой URL в объекте thumbnail, используем его
            if (gift.thumbnail && gift.thumbnail.url) {
                thumbnailPath = gift.thumbnail.url;
            } 
            // Иначе формируем путь на основе эмодзи и типа подарка
            else if (gift.emoji) {
                const emojiCode = gift.emoji.codePointAt(0).toString(16);
                // Добавляем проверку на наличие префикса '/dev' для режима разработки
                const isDevMode = window.isDevMode || window.location.pathname.includes('/dev/');
                const apiPrefix = isDevMode ? '/dev' : '';
                thumbnailPath = `${apiPrefix}/static/thumbnails/${emojiCode}_${gift.gift_type}.webp`;
            }
            
            if (thumbnailPath) {
                // Используем миниатюру для специальных типов
                giftIconContent = `<img src="${thumbnailPath}" 
                    alt="${gift.emoji}" class="gift-thumbnail" />`;
            } else {
                // Если путь не определен, используем эмодзи
                giftIconContent = gift.emoji;
            }
        } else if (giftValue === 100) {
            // Для премиум подарков без миниатюры
            const emojiCode = gift.emoji ? gift.emoji.codePointAt(0).toString(16) : '';
            if (emojiCode) {
                const thumbnailPath = `/static/thumbnails/${emojiCode}_regular.webp`;
                giftIconContent = `<img src="${thumbnailPath}" 
                    alt="${gift.emoji}" class="gift-thumbnail" />`;
            } else {
                giftIconContent = gift.emoji;
            }
        } else {
            // Для обычных подарков используем эмодзи
            giftIconContent = gift.emoji;
        }
        
        // Форматируем шанс для отображения до сотых (два десятичных знака)
        const formattedChance = typeof gift.chance === 'number' 
            ? gift.chance.toFixed(2) // Отображаем всегда с двумя знаками после запятой
            : '0.00';
        
        // Подготавливаем HTML для плашки, если нужно
        let limitedTagHTML = '';
        if (gift.gift_type === 'limited' || gift.gift_type === 'upgradable' || isExclusive) {
            // Используем либо новый класс на основе цены, либо стандартный класс
            const labelClass = labelTier || (
                gift.gift_type === 'limited' ? 'limited-label' : 
                gift.gift_type === 'upgradable' ? 'upgradable-label' : 
                'exclusive-label'
            );
            limitedTagHTML = `<div class="${labelClass}"></div>`;
        }
        
        // Добавляем иконку информации для эксклюзивных подарков
        let infoIconHTML = '';
        if (isExclusive) {
            infoIconHTML = `<div class="gift-info-icon">i</div>`;
        }
        
        giftElement.innerHTML = `
            ${limitedTagHTML}
            ${infoIconHTML}
            <div class="gift-icon">${giftIconContent}</div>
            <div class="gift-chance">${formattedChance}%</div>
            <div class="gift-price">
                <span class="gift-price-value">${formatGiftPrice(giftValue)}</span><span class="diamond"><svg class="crystal-icon"><use xlink:href="#crystal-icon"></use></svg></span>
            </div>
        `;
        
        // Добавляем обработчик клика на элемент подарка для всех подарков
        giftElement.addEventListener('click', function(event) {
            // Проверяем, является ли подарок эксклюзивным
            if (isExclusive) {
                // Если подарок эксклюзивный, открываем модальное окно с информацией
                // Импортируем функцию для отображения модального окна
                import('./modules/exclusive-gift-modal.js')
                    .then(module => {
                        module.showExclusiveGiftInfoModal(gift);
                    })
                    .catch(error => {
                        console.error('Ошибка при загрузке модуля exclusive-gift-modal.js:', error);
                    });
            } else {
                // Для обычных подарков запускаем лотерею если не в демо-режиме
                if (!gameState.demoMode) {
                    // Скрываем индикатор
                    hideElement(indicator);
                    
                    // Установка состояния
                    gameState.selectedGift = gift;
                    
                    // Запускаем лотерею
                    spinLottery();
                }
            }
        });
        
        return giftElement;
    }
    
    // Начинаем крутить лотерею
    async function spinLottery() {
        // Проверяем возможность начать игру
        if (!canStartSpin(gameState.isSpinning, gameState.demoMode, userData, gameState.selectedBet)) return;
        
        // Блокируем интерфейс без списания средств и запуска анимации
        gameState.isSpinning = true;
        
        // Блокируем кнопки ставок и переключатель демо-режима
        betOptionsContainer.classList.add('disabled');
        betOptions.forEach(option => option.classList.add('disabled'));
        demoModeToggle.classList.add('disabled');
        
        // Блокируем нижнюю навигацию
        const navItems = document.querySelectorAll('.nav-item');
        navItems.forEach(item => {
            item.classList.add('disabled');
        });
        
        try {
            // Сбрасываем предыдущий результат игры перед запросом нового
            gameState.lastGameResult = null;
            
            // Получаем результат игры (с сервера или локально)
            const gameResult = await getGameResult();
            
            // Если не удалось получить результат или есть ошибка кулдауна, восстанавливаем интерфейс
            if (!gameResult) {
                finishSpinning(false);
                return;
            }
            
            // Подготавливаем полный интерфейс к вращению только если получен успешный ответ
            prepareSpinning();
            
            // Сохраняем результат игры перед запуском анимации для возможности пропуска
            gameState.lastGameResult = gameResult;
            
            // Проверяем наличие необходимых данных в результате
            if (!gameResult.sequence || !gameResult.winning_gift_id || !gameResult.winning_gift) {
                console.error('Отсутствуют необходимые данные для анимации в результате игры');
                showError('❌ Ошибка данных результата игры');
                finishSpinning(false);
                return;
            }
            
            // Запускаем анимацию прокрутки лотереи (используем функцию из модуля)
            animateLottery(gameResult, gameState, lotteryItems, handleSpinCompletion);
        } catch (error) {
            console.error('Ошибка при запуске лотереи:', error);
            showError('❌ Произошла ошибка при запуске лотереи');
            finishSpinning(false);
        }
    }
    
    // Делаем функцию запуска лотереи доступной глобально
    window.spinLottery = function() {
        // Используем текущее состояние игры или сохраненный тип ставки
        if (window.pendingBetType) {
            const oldBetType = gameState.selectedBet;
            
            // Временно меняем тип ставки на сохраненный
            gameState.selectedBet = window.pendingBetType;
            
            // Обновляем интерфейс выбора ставки
            updateBetSelector();
            
            // Запускаем лотерею
            spinLottery();
            
            // Сбрасываем сохраненный тип ставки
            window.pendingBetType = null;
        } else {
            // Используем текущий выбранный тип ставки
            spinLottery();
        }
    };
    
    // Подготавливает интерфейс к вращению
    function prepareSpinning() {
        // Вызываем легкий тактильный отклик при старте прокрутки
        triggerHapticFeedback('impact', 'medium');
        
        // Блокируем демо-режим во время игры (но оставляем видимым)
        demoModeToggle.classList.add('disabled');
        
        // Показываем кнопку пропуска анимации только при разблокированной функции
        if (userData.available_fast_play) {
            skipAnimationButton.style.display = 'flex';
        }
        
        // Обновляем статистику пользователя (счетчик игр и баланс)
        const betCost = updateUserStatsForSpin(userData, gameState.demoMode, gameState.selectedBet);
        
        // Если у нас не демо-режим и была списана ставка, показываем анимацию
        if (betCost > 0) {
            // Получаем элемент баланса
            const balanceElement = document.getElementById('balanceValue');
            
            // Получаем значение баланса до списания ставки
            const oldBalance = userData.balance + betCost;
            
            // Анимируем обновление баланса
            if (balanceElement) {
                animateBalance(balanceElement, oldBalance, userData.balance, 800);
            } else {
                updateBalanceDisplay(userData);
            }
            
            // Показываем дополнительную анимацию
            showBalanceUpdateAnimation(-betCost);
        }
    }
    
    // Завершает процесс вращения, восстанавливая интерфейс
    function finishSpinning(success = true) {
        // Проверяем флаг вращения, чтобы избежать многократного вызова
        if (!gameState.isSpinning) {
            console.warn('Попытка завершить уже завершенное вращение');
            return;
        }
        
        // Сбрасываем флаг вращения
        gameState.isSpinning = false;
        
        // Возвращаем активность кнопкам ставок и переключателю демо-режима
        betOptionsContainer.classList.remove('disabled');
        betOptions.forEach(option => option.classList.remove('disabled'));
        demoModeToggle.classList.remove('disabled');
        
        // Скрываем кнопку пропуска анимации и разблокируем демо-режим
        skipAnimationButton.style.display = 'none';
        
        // Разблокируем нижнюю навигацию
        const navItems = document.querySelectorAll('.nav-item');
        navItems.forEach(item => {
            item.classList.remove('disabled');
        });
        
        // Если процесс был успешным, обновляем лотерею
        if (success) {
            // Обновляем отображение баланса
            updateBalanceDisplay(userData);
            
            // Инициализируем новое отображение лотереи только если модальное окно закрыто
            // Это предотвращает обновление лотереи при активном модальном окне после пропуска
            if (!document.querySelector('.win-modal.show')) {
                setupLotteryDisplay();
            }
        } else {
            // В случае ошибки, если не демо-режим, возвращаем списанные кристаллы
            if (!gameState.demoMode) {
                userData.balance += betCosts[gameState.selectedBet];
                updateBalanceDisplay(userData);
            }
        }
        
        // Сбрасываем сохраненный результат последней игры после успешного завершения
        // если это не было пропуском анимации
        if (success && !animationState.skipTriggered) {
            gameState.lastGameResult = null;
        }
    }

    // Получает результат игры (с сервера или локально)
    async function getGameResult() {
        try {
            let result;
            
            // В демо-режиме генерируем результат локально, иначе запрашиваем с сервера
            if (gameState.demoMode) {
                result = await generateDemoResult(gameState.gifts, gameState.selectedBet);
            } else {
                // Отправляем запрос без параметра skip_animation
                result = await getServerResult(userData.id, gameState.selectedBet, false);
                
                // Проверяем наличие ошибки кулдауна
                if (!result.success && result.cooldown) {
                    // Показываем уведомление о слишком быстрой попытке
                    const message = window.i18n.t('gifts.too_fast');
                    showWarning(message);
                    return null;
                }
                
                // Если получены данные об опыте и уровне, сразу обновляем их
                if (result.success && (result.exp !== undefined || result.level_data)) {
                    // Обновляем опыт в данных пользователя
                    if (result.exp !== undefined) {
                        userData.exp = result.exp;
                    }
                    
                    // Немедленно обновляем отображение опыта
                    updateExperienceDisplay(userData, '#headerExpContainer', 'header');
                    
                    console.log('Опыт пользователя обновлен после игры:', userData.exp);
                }
                
                // После успешной игры обновляем прогресс задания "Провести 10 игр"
                if (result.success) {
                    updateTasksProgress(userData.id);
                }
            }
            
            // Выводим полную информацию о результате в консоль для отладки
            console.log('Полный результат игры:', JSON.stringify(result, null, 2));
            console.log('Структура winning_gift_id:', result.winning_gift_id);
            console.log('Структура winning_gift_type:', result.winning_gift_type);
            console.log('Структура winning_gift:', result.winning_gift);
            
            // Проверяем и исправляем результат при необходимости
            result = validateAndFixResult(result, gameState.gifts, gameState.selectedBet);
            
            // Логируем результат после валидации
            console.log('Результат после валидации:');
            console.log('- winning_gift_id:', result.winning_gift_id);
            console.log('- winning_gift_type:', result.winning_gift_type);
            console.log('- winning_gift структура:', result.winning_gift);
            
            // Если успешно, возвращаем результат, иначе null
            return result.success ? result : null;
        } catch (error) {
            console.error('Ошибка при получении результата игры:', error);
            showError('❌ Ошибка при получении результата игры');
            return null;
        }
    }
    
    // Обновляет прогресс задания "Провести 10 игр" после каждой игры (ОПТИМИЗИРОВАННО)
    async function updateTasksProgress(userId) {
        // Если демо-режим, не обновляем задания
        if (gameState.demoMode) {
            return;
        }
        
        try {
            // Используем оптимизированный загрузчик заданий
            const result = await window.tasksOptimizer.getOptimizedTasks(
                userId, 
                window.tasksOptimizer.ACTION_TYPES.GAME
            );
            
            if (result.success) {
                console.log('Прогресс заданий успешно обновлен');
                
                // Находим все задания на игры, которые готовы к получению награды
                const playGamesTasks = result.tasks.filter(task => 
                    task.activityType === 'play_games' && 
                    task.status === 'in_progress' && 
                    task.progress === 100
                );
                
                // Находим задания на сбор коллекции, которые готовы к получению награды
                const collectionTasks = result.tasks.filter(task => 
                    task.verifierType === 'inventory' && 
                    task.inventoryType === 'gift_collection' && 
                    task.status === 'in_progress' && 
                    task.progress === 100
                );
                
                // Обрабатываем каждое задание
                playGamesTasks.forEach(task => {
                    // Показываем уведомление только если оно еще не было показано для этого задания
                    if (!wasTaskNotificationShown(task.id)) {
                        // Выбираем правильную функцию уведомления в зависимости от идентификатора задания
                        if (task.id === 'daily-play-five-games') {
                            showTaskPlayFiveGamesCompleted();
                        } else if (task.id === 'daily-play-ten-games') {
                            showTaskPlayTenGamesCompleted();
                        } else if (task.id === 'weekly-play-500-games') {
                            showTaskPlay500GamesCompleted();
                        } else {
                            // Для других заданий используем универсальную функцию
                            showTaskCompleted(task);
                        }
                        
                        // Запоминаем, что уведомление было показано
                        setTaskNotificationShown(task.id);
                    }
                });
                
                // Обрабатываем задания на сбор коллекции
                collectionTasks.forEach(task => {
                    // Показываем уведомление только если оно еще не было показано для этого задания
                    if (!wasTaskNotificationShown(task.id)) {
                        // Для задания еженедельной коллекции используем специальную функцию
                        if (task.id === 'weekly-collection') {
                            showTaskCollectionCompleted(task);
                        } else {
                            // Для других заданий коллекции используем универсальную функцию
                            showTaskCompleted(task);
                        }
                        
                        // Запоминаем, что уведомление было показано
                        setTaskNotificationShown(task.id);
                    }
                });
                
                // Обрабатываем задания на опыт (достижения)
                const experienceTasks = result.tasks.filter(task => 
                    task.verifierType === 'experience' && 
                    task.status === 'in_progress' && 
                    task.progress === 100
                );
                
                experienceTasks.forEach(task => {
                    // Показываем уведомление только если оно еще не было показано для этого задания
                    if (!wasTaskNotificationShown(task.id)) {
                        // Для задания достижения быстрой игры используем специальную функцию
                        if (task.id === 'achievement-fast-play') {
                            showTaskAchievementFastPlayCompleted();
                        } else {
                            // Для других заданий на опыт используем универсальную функцию
                            showTaskCompleted(task);
                        }
                        
                        // Запоминаем, что уведомление было показано
                        setTaskNotificationShown(task.id);
                    }
                });
                
                // Сбрасываем статус уведомлений для заданий, которые больше не в статусе готовности к получению награды
                result.tasks.forEach(task => {
                    if ((task.activityType === 'play_games' || task.verifierType === 'inventory' || task.verifierType === 'experience') && 
                        (task.status === 'completed' || task.progress < 100) && 
                        wasTaskNotificationShown(task.id)) {
                        resetTaskNotificationStatus(task.id);
                    }
                });
            } else {
                console.error('Ошибка при получении заданий:', result.error);
            }
        } catch (error) {
            console.error('Ошибка при обновлении прогресса заданий:', error);
        }
    }
    
    // Обрабатывает ошибку, возникшую при получении результата игры
    function handleGameError(result) {
                    // Если ошибка связана с отсутствием обязательных параметров, используем локальную генерацию
                    if (result.error && result.error.includes('обязательные параметры')) {
            console.warn('Ошибка сервера:', result.error);
            // Обработка будет продолжена в основной функции
                    } else {
                        alert(result.error || 'Произошла ошибка при игре');
        }
    }
    
    // Обработчик завершения прокрутки лотереи
    function handleSpinCompletion(success, winning_gift_id, winning_gift) {
        if (success && winning_gift_id && winning_gift) {
            // Добавляем уведомление об успехе
            triggerHapticFeedback('notification', 'success');
            
            // Показываем модальное окно с выигрышем
            showWinModal(winning_gift_id, winning_gift, gameState.demoMode);
        }
        
        // Завершаем процесс прокрутки
        finishSpinning(success);
    }
    
    // Обработчик события обновления баланса
    function handleBalanceUpdated(event) {
        const { value, newBalance, source, newExp } = event.detail;
        
        console.log(`Получено событие обновления баланса: ${value} (источник: ${source || 'неизвестно'})`);
        
        // Обновляем баланс в локальном объекте
        if (typeof newBalance === 'number') {
            // Получаем элемент баланса
            const balanceElement = document.getElementById('balanceValue');
            
            // Получаем текущее значение баланса из элемента
            const currentDisplayedBalance = balanceElement ? parseInt(balanceElement.textContent.replace(/\s/g, '')) || 0 : 0;
            
            // Анимируем обновление баланса если элемент существует и значения различаются
            if (balanceElement && currentDisplayedBalance !== newBalance) {
                animateBalance(balanceElement, currentDisplayedBalance, newBalance, 800);
            } else {
                // Иначе используем обычное обновление баланса
                userData.balance = newBalance;
                updateBalanceDisplay(userData);
            }
        }
        
        // Обновляем опыт в данных пользователя, если он передан
        if (newExp !== undefined) {
            userData.exp = newExp;
            // Обновляем отображение опыта
            updateExperienceDisplay(userData, '#headerExpContainer', 'header');
        }
        
        // Полностью обновляем интерфейс
        updateUI();
        
        // Показываем анимацию обновления баланса
        showBalanceUpdateAnimation(value);
    }
    
    // Обработчик события изменения демо-режима
    function handleDemoModeChanged(event) {
        const { enabled } = event.detail;
        
        // Обновляем состояние игры
        gameState.demoMode = enabled;
    }
    
    // Обработчик события обновления подарков пользователя
    function handleUserGiftsUpdated(event) {
        const { gifts, all_gifts } = event.detail;
        
        if (all_gifts) {
            console.log('Получено событие обновления подарков пользователя');
            
            // Обновляем данные о подарках
            gameState.gifts = all_gifts;
            gameState.lastGiftsUpdate = Date.now();
            
            // Обновляем интерфейс
            updateGiftsDisplay();
            setupLotteryDisplay();
        }
    }
    
    // Обработчики событий
    
    // Выбор типа ставки
    betOptions.forEach((option, index) => {
        option.addEventListener('click', function() {
            // Проверяем, не крутится ли лотерея
            if (gameState.isSpinning) return;
            
            // Определяем тип ставки на основе индекса кнопки
            const betTypes = ['low', 'medium', 'high', 'ultra'];
            const newBetType = betTypes[index];
            
            // Проверяем, действительно ли тип ставки изменился
            if (gameState.selectedBet === newBetType) {
                // Если тип ставки не изменился, ничего не делаем
                return;
            }
            
            // Вызываем мягкий тактильный отклик при выборе ставки
            triggerHapticFeedback('impact', 'soft');
            
            // Сохраняем новый тип ставки
            gameState.selectedBet = newBetType;
            
            console.log(`Тип ставки изменен на ${gameState.selectedBet}`);
            
            // Обновляем интерфейс
            updateUI();
            
            // Обновляем отображение лотереи с принудительным обновлением только при смене ставки
            setupLotteryDisplay(true);
        });
    });
    
    // Переключение демо-режима
    demoModeToggle.addEventListener('click', function() {
        // Проверяем, не крутится ли лотерея
        if (gameState.isSpinning) return;
        
        demoModeCheckbox.checked = !demoModeCheckbox.checked;
        gameState.demoMode = demoModeCheckbox.checked;
        updateUI();
    });
    
    demoModeCheckbox.addEventListener('change', function() {
        // Проверяем, не крутится ли лотерея
        if (gameState.isSpinning) {
            // Возвращаем предыдущее состояние, если лотерея крутится
            this.checked = gameState.demoMode;
            return;
        }
        
        gameState.demoMode = this.checked;
        updateUI();
    });
    
    // Кнопка прокрутки
    spinButton.addEventListener('click', spinLottery);
    
    // Кнопка пропуска анимации
    skipAnimationButton.addEventListener('click', async function() {
        // Проверяем доступность быстрой игры: только при выполненном задании
        if (!userData.available_fast_play) {
            console.warn('Функция пропуска анимации недоступна');
            return;
        }
        
        if (gameState.isSpinning) {
            // Проверяем, что результат игры доступен
            if (!gameState.lastGameResult || !gameState.lastGameResult.winning_gift_id || !gameState.lastGameResult.winning_gift) {
                console.warn('Невозможно пропустить анимацию: результат игры недоступен');
                return;
            }
            
            // Предотвращаем повторное нажатие (дебаунс)
            skipAnimationButton.disabled = true;
            
            try {
                // Отмечаем, что анимация была пропущена
                markAnimationSkipped();
                
                // Получаем сохраненный результат последней игры
                const gameResult = gameState.lastGameResult;
                
                // Остановка текущей анимации лотереи
                const lotteryItems = document.getElementById('lotteryItems');
                if (lotteryItems) {
                    // Останавливаем анимацию, делая переход мгновенным
                    lotteryItems.style.transition = 'none';
                    
                    // Мгновенно позиционируем барабан к выигрышному элементу
                    positionLotteryForWinningItem(lotteryItems, gameResult);
                    
                    // Добавляем тактильный отклик как при завершении обычной анимации
                    triggerHapticFeedback('notification', 'success');
                    
                    // Показываем модальное окно с выигрышем
                    showWinModal(gameResult.winning_gift_id, gameResult.winning_gift, gameState.demoMode);
                    
                    // Завершаем процесс прокрутки
                    finishSpinning(true);
                }
            } catch (error) {
                console.error('Ошибка при обработке пропуска анимации:', error);
            } finally {
                // Восстанавливаем кнопку через небольшую задержку
                setTimeout(() => {
                    skipAnimationButton.disabled = false;
                }, 500);
            }
        }
    });
    
    // Выбираем первую опцию ставки по умолчанию
    betOptions[0].classList.add('selected');
    
    // Загружаем данные пользователя и инициализируем приложение
    loadUserDataAndInitialize();

    // Инициализируем управление видимостью полосы прокрутки
    setupScrollbarVisibility();

    // Обработчик нажатия на элементы нижней навигации
    const navItems = document.querySelectorAll('.nav-item');
    setupNavigation(navItems, {});

    // Настройка анимации скролла для подарков при загрузке страницы
    function animateGiftsContainerScroll() {
        const giftsContainer = document.querySelector('.gifts-container');
        if (giftsContainer && giftsContainer.scrollWidth > giftsContainer.clientWidth) {
            // Если есть скролл (контент шире контейнера)
            // Уменьшаем расстояние сдвига вдвое
            const scrollAmount = Math.min(60, (giftsContainer.scrollWidth - giftsContainer.clientWidth) / 2);
            
            // Сначала сбрасываем позицию скролла
            giftsContainer.scrollTo({ left: 0, behavior: 'auto' });
            
            // Добавляем задержку 0.5 сек перед началом анимации
            setTimeout(() => {
                // Анимация вправо (медленнее)
                giftsContainer.scrollTo({ left: scrollAmount, behavior: 'smooth' });
                
                // Увеличиваем задержку до 1 секунды перед обратным движением
                setTimeout(() => {
                    giftsContainer.scrollTo({ left: 0, behavior: 'smooth' });
                }, 1000);
            }, 500);
        }
    }

    // Обработчик события обновления опыта
    function handleExperienceUpdated(event) {
        if (!event.detail || event.detail.exp === undefined) return;
        
        // Обновляем опыт в данных пользователя
        userData.exp = event.detail.exp;
        
        // Обновляем отображение опыта
        updateExperienceDisplay(userData, '#headerExpContainer', 'header');
    }

    // Добавляем обработчик события обновления опыта
    document.addEventListener('experienceUpdated', handleExperienceUpdated);
} 