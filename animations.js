/**
 * Модуль для управления анимациями в игре
 * Содержит функции для анимации лотереи, баланса и других элементов интерфейса
 */

import { formatNumber } from './ui-utils.js';

// Глобальный объект для хранения состояния анимации
const animationState = {
    spinTimer: null,    // Таймер для завершения прокрутки
    skipTriggered: false,  // Флаг, указывающий был ли активирован пропуск
    skipTimestamp: null  // Время активации пропуска
};

/**
 * Анимирует лотерею с полученным результатом
 * @param {Object} result - Результат игры с сервера
 * @param {Object} gameState - Состояние игры
 * @param {HTMLElement} lotteryItems - Контейнер с элементами лотереи
 * @param {Function} finishCallback - Функция, вызываемая по завершении анимации
 */
export function animateLottery(result, gameState, lotteryItems, finishCallback) {
    const { sequence, winning_gift_id, winning_gift_type, winning_gift } = result;
    
    // Останавливаем медленную анимацию ожидания перед запуском игры
    stopIdleAnimation(lotteryItems);
    
    // Очищаем предыдущий таймер, если он есть
    if (animationState.spinTimer) {
        clearTimeout(animationState.spinTimer);
        animationState.spinTimer = null;
    }
    
    // Сбрасываем флаг пропуска при запуске новой анимации
    animationState.skipTriggered = false;
    animationState.skipTimestamp = null;
    
    // Проверяем данные для надежности
    if (!sequence || !winning_gift_type || !winning_gift) {
        console.error('Отсутствуют необходимые данные для анимации лотереи');
        finishCallback(false);
        return;
    }
    
    // Сбрасываем сохраненную позицию и содержимое при запуске новой анимации
    delete lotteryItems.dataset.lastPosition;
    delete lotteryItems.dataset.lastContent;
    
    // Удаляем класс завершенной анимации, если он был
    lotteryItems.classList.remove('animation-completed');
    
    // Создаем элементы лотереи для анимации
    createLotteryElements(sequence, winning_gift_type, gameState.gifts, lotteryItems);
    
    // Запускаем анимацию прокрутки
    startSpinAnimation(sequence, winning_gift_id, winning_gift_type, winning_gift, lotteryItems, finishCallback);
}

/**
 * Создает элементы лотереи для анимации
 * @param {Array} sequence - Последовательность типов подарков
 * @param {string} winning_gift_type - Тип выигрышного подарка
 * @param {Object} gifts - Объект со всеми подарками
 * @param {HTMLElement} lotteryItems - Контейнер с элементами лотереи
 */
function createLotteryElements(sequence, winning_gift_type, gifts, lotteryItems) {
    const winningItemIndex = Math.floor(sequence.length / 2);
    // Очищаем текущий список элементов
    lotteryItems.innerHTML = '';
    
    sequence.forEach((giftType, index) => {
        const gift = gifts[giftType];
        
        // Защита от некорректных данных
        if (!gift) {
            console.error(`Подарок типа ${giftType} не найден в библиотеке подарков`);
            return;
        }
        
        const item = document.createElement('div');
        item.className = 'lottery-item';
        
        // Помечаем элемент, если это выигрышный подарок
        if (index === winningItemIndex) {
            item.classList.add('winning');
            item.id = 'winning-item';
            
            // Убираем добавление классов обводки
            // Мы не добавляем gift-limited, gift-upgradable, gift-premium для барабана лотереи
        }
        
        let iconContent = '';
        
        // Проверяем наличие thumbnail_path в объекте подарка
        if (gift.thumbnail_path) {
            // Используем указанную миниатюру из библиотеки подарков
            // Добавляем проверку на наличие префикса '/dev' для режима разработки
            const isDevMode = window.isDevMode || window.location.pathname.includes('/dev/');
            const apiPrefix = isDevMode && !gift.thumbnail_path.startsWith('/dev') ? '/dev' : '';
            iconContent = `<img src="${apiPrefix}${gift.thumbnail_path}" alt="${gift.name || gift.emoji}" class="gift-thumbnail" />`;
            
            // Добавляем индикатор типа подарка при необходимости
            if (gift.gift_type === 'limited') {
                // Удаляем индикатор для всех типов подарков
            } else if (gift.gift_type === 'upgradable') {
                // Удаляем индикатор для всех типов подарков
            }
        } else if ((gift.gift_type === 'limited' || gift.gift_type === 'upgradable') && gift.emoji) {
            // Запасной вариант, если у специальных подарков нет миниатюры
            const emojiCode = gift.emoji.codePointAt(0).toString(16);
            // Добавляем проверку на наличие префикса '/dev' для режима разработки
            const isDevMode = window.isDevMode || window.location.pathname.includes('/dev/');
            const apiPrefix = isDevMode ? '/dev' : '';
            const thumbnailPath = `${apiPrefix}/static/thumbnails/${emojiCode}_${gift.gift_type}.webp`;
            iconContent = `<img src="${thumbnailPath}" alt="${gift.name || gift.emoji}" class="gift-thumbnail" />`;
            
            // Добавляем индикатор типа подарка
            if (gift.gift_type === 'limited') {
                // Удаляем индикатор для всех типов подарков
            } else if (gift.gift_type === 'upgradable') {
                // Удаляем индикатор для всех типов подарков
            }
        } else {
            // Для обычных подарков или если миниатюра не найдена используем эмодзи
            iconContent = gift.emoji;
        }
        
        // Определяем стоимость подарка (используя ТОЛЬКО star_count)
        const giftValue = gift.star_count || 0;
        
        item.innerHTML = `
            <div class="lottery-item-icon">${iconContent}</div>
            <div class="lottery-item-price">
                <span>${giftValue}</span>
                <span class="diamond">
                    <svg class="crystal-icon"><use xlink:href="#crystal-icon"></use></svg>
                </span>
            </div>
        `;
        
        lotteryItems.appendChild(item);
    });
}

/**
 * Запускает анимацию прокрутки лотереи
 * @param {Array} sequence - Последовательность типов подарков
 * @param {string} winning_gift_id - ID выигрышного подарка
 * @param {string} winning_gift_type - Тип выигрышного подарка
 * @param {Object} winning_gift - Выигрышный подарок
 * @param {HTMLElement} lotteryItems - Контейнер с элементами лотереи
 * @param {Function} finishCallback - Функция, вызываемая по завершении анимации
 */
function startSpinAnimation(sequence, winning_gift_id, winning_gift_type, winning_gift, lotteryItems, finishCallback) {
    const winningItemIndex = Math.floor(sequence.length / 2);
    const itemWidth = 156; // Ширина элемента + отступы (150px + 3px*2)
    const containerWidth = lotteryItems.parentElement.offsetWidth;
    
    // Генерируем смещение с предпочтением к краям блока
    let randomOffset;
    
    // С вероятностью 70% останавливаемся ближе к краям
    if (Math.random() < 0.7) {
        // Используем кубическое распределение для концентрации значений у краев
        // Math.random() в кубе даёт больше маленьких значений
        // 1 - Math.random() в кубе даёт больше значений ближе к 1
        // Выбираем случайно между этими двумя вариантами
        const edgeBias = Math.random() < 0.5 ? 
            Math.pow(Math.random(), 2) * 0.4 : // Смещение к левому краю (0 - 0.4)
            1 - Math.pow(Math.random(), 2) * 0.4; // Смещение к правому краю (0.6 - 1)
        
        // Преобразуем в диапазон -0.45 до 0.45
        randomOffset = (edgeBias - 0.5) * 0.9 * itemWidth;
    } else {
        // В 30% случаев используем обычное равномерное распределение
        randomOffset = (Math.random() * 0.7 - 0.35) * itemWidth;
    }
    
    // Целевая позиция с новым смещением
    const targetPosition = -winningItemIndex * itemWidth + containerWidth / 2 - itemWidth / 2 + randomOffset;
    
    // Сначала устанавливаем начальную позицию без анимации
    lotteryItems.style.transition = 'none';
    lotteryItems.style.left = '0px';
    
    // Форсируем перерисовку
    void lotteryItems.offsetWidth;
    
    // Запускаем анимацию с быстрым стартом и плавным замедлением
    lotteryItems.style.transition = 'left 6s cubic-bezier(0.1, 0.4, 0.1, 1)';
    lotteryItems.style.left = `${targetPosition}px`;
    
    // Проверяем, не был ли активирован пропуск анимации до её запуска
    // Это может произойти, если пользователь очень быстро нажал на кнопку пропуска
    if (animationState.skipTriggered) {
        console.log('Обнаружен ранний пропуск анимации, пропускаем таймер');
        return;
    }
    
    // Завершаем анимацию через 6.5 секунд
    animationState.spinTimer = setTimeout(() => {
        // Проверяем, был ли активирован пропуск анимации
        if (!animationState.skipTriggered) {
            // Если пропуск не был активирован, обрабатываем завершение анимации
            handleSpinCompletion(lotteryItems, winningItemIndex, winning_gift_type, winning_gift_id, winning_gift, finishCallback);
        } else {
            console.log('Анимация была пропущена, пропускаем стандартную обработку завершения');
        }
        // Сбрасываем таймер
        animationState.spinTimer = null;
    }, 6500);
}

/**
 * Обработчик завершения анимации прокрутки
 * @param {HTMLElement} lotteryItems - Контейнер с элементами лотереи
 * @param {number} winningItemIndex - Индекс выигрышного элемента
 * @param {string} winning_gift_type - Тип выигрышного подарка
 * @param {string} winning_gift_id - ID выигрышного подарка
 * @param {Object} winning_gift - Выигрышный подарок
 * @param {Function} finishCallback - Функция, вызываемая по завершении анимации
 */
function handleSpinCompletion(lotteryItems, winningItemIndex, winning_gift_type, winning_gift_id, winning_gift, finishCallback) {
    // Добавляем класс для подсветки выигрышного элемента
    highlightWinningItem(lotteryItems, winningItemIndex, winning_gift_type);
    
    // Сохраняем текущее положение барабана в data-атрибут контейнера
    lotteryItems.dataset.lastPosition = lotteryItems.style.left;
    
    // Сохраняем HTML-содержимое барабана
    lotteryItems.dataset.lastContent = lotteryItems.innerHTML;
    
    // Вызываем коллбэк с результатом анимации
    finishCallback(true, winning_gift_id, winning_gift);
}

/**
 * Подсвечивает выигрышный элемент лотереи
 * @param {HTMLElement} lotteryItems - Контейнер с элементами лотереи
 * @param {number} winningItemIndex - Индекс выигрышного элемента
 * @param {string} expected_gift_type - Ожидаемый тип подарка
 */
function highlightWinningItem(lotteryItems, winningItemIndex, expected_gift_type) {
    // Получаем все элементы лотереи
    const items = lotteryItems.querySelectorAll('.lottery-item');
    
    // Если элемент существует, добавляем класс для подсветки
    if (items.length > winningItemIndex) {
        const winningItem = items[winningItemIndex];
        
        // Проверяем, соответствует ли выигрышный элемент ожидаемому типу подарка
        if (winningItem.dataset.giftType && winningItem.dataset.giftType !== expected_gift_type) {
            console.warn(`Несоответствие типа подарка: ${winningItem.dataset.giftType} вместо ${expected_gift_type}`);
        }
        
        winningItem.classList.add('winning');
    }
}

/**
 * Показывает анимацию изменения баланса
 * @param {number} value - Значение изменения баланса
 */
export function showBalanceUpdateAnimation(value) {
    if (!value) return;
    
    // Удаляем старые элементы анимации, если они есть
    const oldElements = document.querySelectorAll('.balance-update');
    oldElements.forEach(el => el.parentNode && el.parentNode.removeChild(el));
    
    // Создаем элемент для анимации
    const balanceUpdateElement = document.createElement('div');
    balanceUpdateElement.className = 'balance-update';
    
    // Добавляем знак + или - в зависимости от значения
    const sign = value >= 0 ? '+' : '-';
    balanceUpdateElement.innerHTML = `${sign}${formatNumber(Math.abs(value))}<span class="diamond">
        <svg class="crystal-icon"><use xlink:href="#crystal-icon"></use></svg>
    </span>`;
    
    // Устанавливаем класс в зависимости от знака, вместо прямого задания цвета
    if (value < 0) {
        balanceUpdateElement.classList.add('negative-value');
    } else {
        balanceUpdateElement.classList.add('positive-value');
    }
    
    // Определяем какой элемент баланса используется на текущей странице
    // Сначала пытаемся найти элемент баланса на главной странице
    let balanceElement = document.getElementById('balanceValue');
    
    // Если элемент баланса главной страницы не найден, ищем элемент баланса в профиле
    if (!balanceElement) {
        balanceElement = document.getElementById('profileBalanceValue');
    }
    
    if (balanceElement) {
        // Получаем позицию и размеры элемента баланса
        const rect = balanceElement.getBoundingClientRect();
        
        // Получаем элемент с кристаллом
        const diamondElement = balanceElement.nextElementSibling;
        let diamondRect = null;
        
        // Если есть элемент с кристаллом, получаем его позицию
        if (diamondElement && diamondElement.classList.contains('diamond')) {
            diamondRect = diamondElement.getBoundingClientRect();
        }
        
        // Устанавливаем начальную позицию анимации по правому краю баланса
        balanceUpdateElement.style.top = `${rect.top}px`;
        
        // Если нашли элемент с кристаллом, выравниваем по нему
        if (diamondRect) {
            balanceUpdateElement.style.right = `${window.innerWidth - diamondRect.right}px`;
        } else {
            // Иначе выравниваем по правому краю элемента баланса
            balanceUpdateElement.style.right = `${window.innerWidth - rect.right}px`;
        }
        
        // Добавляем элемент в DOM
        document.body.appendChild(balanceUpdateElement);
        
        // Используем requestAnimationFrame для более плавной анимации
        requestAnimationFrame(() => {
            // Определяем класс анимации в зависимости от знака
            // Положительные значения (пополнение) - вверх, отрицательные (списание) - вниз
            if (value >= 0) {
                balanceUpdateElement.classList.add('animate-up'); // Анимация вверх для положительных значений
            } else {
                balanceUpdateElement.classList.add('animate'); // Анимация вниз для отрицательных значений
            }
            
            // Удаляем элемент после завершения анимации
            setTimeout(() => {
                if (balanceUpdateElement.parentNode) {
                    balanceUpdateElement.parentNode.removeChild(balanceUpdateElement);
                }
            }, 1000);
        });
    }
}

/**
 * Анимирует падение подарка в профиль пользователя
 * @param {string} giftEmoji - Эмодзи подарка
 * @param {HTMLElement} modalElement - Модальное окно, из которого начинается анимация
 */
export function animateGiftToProfile(giftEmoji, modalElement) {
    // Получаем необходимые элементы
    const profileButton = document.querySelector('.nav-item[data-nav="profile"]') || document.querySelector('.nav-item:nth-child(5)');
    // Находим блок с TGS-анимацией внутри модального окна
    const giftContainer = modalElement.querySelector('.won-gift');
    
    if (!modalElement || !profileButton || !giftContainer) {
        console.error('Не удалось найти элементы для анимации');
        return;
    }
    
    try {
        // Получаем размеры и позиции элементов
        const giftContainerRect = giftContainer.getBoundingClientRect();
        const profileRect = profileButton.getBoundingClientRect();
        
        // Создаем элемент для анимации
        const animatedGift = createAnimatedGiftElement(giftEmoji);
        
        // Вычисляем позиции из центра блока с анимацией
        const startX = giftContainerRect.left + giftContainerRect.width / 2 - 25;
        const startY = giftContainerRect.top + giftContainerRect.height / 2 - 25;
        const endX = profileRect.left + profileRect.width / 2 - 25;
        const endY = profileRect.top + profileRect.height / 2 - 25;
        
        // Устанавливаем начальную позицию
        animatedGift.style.left = `${startX}px`;
        animatedGift.style.top = `${startY}px`;
        
        // Добавляем элемент в DOM
        document.body.appendChild(animatedGift);
        
        // Анимируем падение подарка
        animateGiftElement(animatedGift, startY, endX, endY, profileButton);
    } catch (error) {
        console.error('Ошибка при запуске анимации подарка:', error);
        // В случае ошибки, хотя бы подсветим кнопку профиля
        if (profileButton) {
            highlightProfileButton(profileButton);
        }
    }
}

/**
 * Создает элемент анимированного подарка
 * @param {string} giftEmoji - Эмодзи подарка
 * @returns {HTMLElement} Созданный элемент
 */
function createAnimatedGiftElement(giftEmoji) {
    const animatedGift = document.createElement('div');
    animatedGift.className = 'animated-gift';
    animatedGift.textContent = giftEmoji;
    
    // Стилизуем элемент
    animatedGift.style.position = 'fixed';
    animatedGift.style.fontSize = '50px';
    animatedGift.style.zIndex = '9999';
    animatedGift.style.pointerEvents = 'none'; // Чтобы элемент не перехватывал клики
    
    return animatedGift;
}

/**
 * Анимирует элемент подарка
 * @param {HTMLElement} element - Элемент подарка
 * @param {number} startY - Начальная позиция по Y
 * @param {number} endX - Конечная позиция по X
 * @param {number} endY - Конечная позиция по Y
 * @param {HTMLElement} profileButton - Кнопка профиля
 */
function animateGiftElement(element, startY, endX, endY, profileButton) {
    // Форсируем перерисовку
    void element.offsetWidth;
    
    // Анимация 1: Подбрасывание вверх
    element.style.transition = 'top 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)';
    element.style.top = `${startY - 50}px`; // Подбрасываем на 50px вверх
    
    // Анимация 2: Падение в кнопку профиля
    setTimeout(() => {
        element.style.transition = 'left 0.8s ease-in, top 0.8s cubic-bezier(0.6, 0.1, 0.9, 0.9), transform 0.8s ease-in, opacity 0.1s ease-in 0.7s';
        element.style.left = `${endX}px`;
        element.style.top = `${endY}px`;
        element.style.transform = 'scale(0.2)';
        element.style.opacity = '0';
        
        // Подсвечиваем кнопку профиля
        highlightProfileButton(profileButton);
    }, 300);
    
    // Удаляем элемент после завершения анимации
    setTimeout(() => {
        if (element.parentNode) {
            element.parentNode.removeChild(element);
        }
    }, 1300);
}

/**
 * Подсвечивает кнопку профиля
 * @param {HTMLElement} profileButton - Кнопка профиля
 */
function highlightProfileButton(profileButton) {
    setTimeout(() => {
        profileButton.classList.add('profile-highlight');
        
        // Убираем подсветку через некоторое время
        setTimeout(() => {
            profileButton.classList.remove('profile-highlight');
        }, 500);
    }, 700);
}

/**
 * Инициализирует отображение лотереи
 * @param {HTMLElement} lotteryItems - Контейнер с элементами лотереи
 * @param {Array} availableGifts - Доступные подарки
 * @param {boolean} forceUpdate - Принудительно обновить содержимое (при смене ставки)
 */
export function initLotteryDisplay(lotteryItems, availableGifts, forceUpdate = false) {
    // Проверяем, есть ли сохраненное состояние барабана и не требуется ли принудительное обновление
    if (!forceUpdate && lotteryItems.dataset.lastPosition && lotteryItems.dataset.lastContent) {
        // Если есть сохраненное состояние, просто вызываем centerLotteryItems для правильного позиционирования
        centerLotteryItems(lotteryItems);
        return;
    }
    
    // Сбрасываем сохраненное состояние при принудительном обновлении
    if (forceUpdate) {
        delete lotteryItems.dataset.lastPosition;
        delete lotteryItems.dataset.lastContent;
    }
    
    // Очищаем и сбрасываем стили контейнера лотереи
    lotteryItems.innerHTML = '';
    lotteryItems.style.transition = 'none';
    lotteryItems.style.transform = 'none';
    lotteryItems.style.left = '';
    
    // Создаем элементы для бесконечной прокрутки в режиме ожидания
    createInfiniteScrollElements(lotteryItems, availableGifts);
    
    // Центрируем лотерею
    centerLotteryItems(lotteryItems);
    
    // Запускаем медленную анимацию ожидания
    startIdleAnimation(lotteryItems);
}

/**
 * Создает элементы для плавной бесконечной прокрутки
 * @param {HTMLElement} lotteryItems - Контейнер с элементами лотереи
 * @param {Array} availableGifts - Доступные подарки
 */
function createInfiniteScrollElements(lotteryItems, availableGifts) {
    if (!availableGifts.length) return;
    
    // Создаем базовый набор из 10 элементов
    const baseElements = [];
    for (let i = 0; i < 10; i++) {
        const randomIndex = Math.floor(Math.random() * availableGifts.length);
        const [giftId, gift] = availableGifts[randomIndex];
        baseElements.push({ giftId, gift });
    }
    
    // Создаем элементы в DOM: основные + дублированные для плавности
    [...baseElements, ...baseElements].forEach(({ giftId, gift }) => {
        const item = createLotteryItemElement(gift);
        lotteryItems.appendChild(item);
    });
}

/**
 * Создает элемент лотереи
 * @param {Object} gift - Подарок
 * @returns {HTMLElement} Элемент лотереи
 */
function createLotteryItemElement(gift) {
    const item = document.createElement('div');
    item.className = 'lottery-item';
    
    // Создаем внутреннее содержимое элемента
    let iconContent = '';
    
    // Проверяем наличие thumbnail_path в объекте подарка
    if (gift.thumbnail_path) {
        // Используем указанную миниатюру из библиотеки подарков
        // Добавляем проверку на наличие префикса '/dev' для режима разработки
        const isDevMode = window.isDevMode || window.location.pathname.includes('/dev/');
        const apiPrefix = isDevMode && !gift.thumbnail_path.startsWith('/dev') ? '/dev' : '';
        iconContent = `<img src="${apiPrefix}${gift.thumbnail_path}" alt="${gift.name || gift.emoji}" class="gift-thumbnail" />`;
    } else if ((gift.gift_type === 'limited' || gift.gift_type === 'upgradable') && gift.emoji) {
        // Запасной вариант, если у специальных подарков нет миниатюры
        const emojiCode = gift.emoji.codePointAt(0).toString(16);
        // Добавляем проверку на наличие префикса '/dev' для режима разработки
        const isDevMode = window.isDevMode || window.location.pathname.includes('/dev/');
        const apiPrefix = isDevMode ? '/dev' : '';
        const thumbnailPath = `${apiPrefix}/static/thumbnails/${emojiCode}_${gift.gift_type}.webp`;
        iconContent = `<img src="${thumbnailPath}" alt="${gift.name || gift.emoji}" class="gift-thumbnail" />`;
    } else {
        // Для обычных подарков или если миниатюра не найдена используем эмодзи
        iconContent = gift.emoji;
    }
    
    // Определяем стоимость подарка (используя ТОЛЬКО star_count)
    const giftValue = gift.star_count || 0;
    
    item.innerHTML = `
        <div class="lottery-item-icon">${iconContent}</div>
        <div class="lottery-item-price">
            <span>${giftValue}</span>
            <span class="diamond">
                <svg class="crystal-icon"><use xlink:href="#crystal-icon"></use></svg>
            </span>
        </div>
    `;
    
    return item;
}

/**
 * Добавляет случайный элемент в контейнер лотереи
 * @param {HTMLElement} lotteryItems - Контейнер с элементами лотереи
 * @param {Array} availableGifts - Доступные подарки
 */
function addRandomLotteryItem(lotteryItems, availableGifts) {
    if (!availableGifts.length) return;
    
    const randomIndex = Math.floor(Math.random() * availableGifts.length);
    const [giftId, gift] = availableGifts[randomIndex];
    
    const item = createLotteryItemElement(gift);
    lotteryItems.appendChild(item);
}

/**
 * Центрирует элементы лотереи в контейнере
 * @param {HTMLElement} lotteryItems - Контейнер с элементами лотереи
 */
export function centerLotteryItems(lotteryItems) {
    // Проверяем, есть ли сохраненная позиция и содержимое барабана
    if (lotteryItems.dataset.lastPosition && lotteryItems.dataset.lastContent) {
        // Восстанавливаем HTML-содержимое барабана
        if (lotteryItems.innerHTML === '') {
            lotteryItems.innerHTML = lotteryItems.dataset.lastContent;
        }
        
        // Используем сохраненную позицию
        lotteryItems.style.transition = 'none';
        lotteryItems.style.left = lotteryItems.dataset.lastPosition;
        
        // Форсируем перерисовку
        void lotteryItems.offsetWidth;
        return;
    }
    
    // Константы для расчета позиции
    const itemWidth = 156; // Ширина элемента + отступы (150px + 3px*2)
    const containerWidth = lotteryItems.parentElement.offsetWidth;
    const itemsWidth = lotteryItems.children.length * itemWidth;
    
    // Вычисляем начальную позицию, чтобы подарки были по центру
    const initialPosition = (containerWidth - itemsWidth) / 2;
    
    // Устанавливаем позицию без анимации
    lotteryItems.style.transition = 'none';
    lotteryItems.style.left = `${initialPosition}px`;
    
    // Форсируем перерисовку
    void lotteryItems.offsetWidth;
}

// Создаем элемент отображения подарка в барабане
function createGiftElement(gift) {
    const giftElement = document.createElement('div');
    giftElement.className = 'lottery-gift';
    giftElement.dataset.giftId = gift.id;
    
    // Устанавливаем значение подарка (используя ТОЛЬКО star_count)
    const giftValue = gift.star_count || 0;
    
    // Создаем содержимое элемента подарка
    let giftContent = '';
    
    // Проверяем наличие thumbnail_path в объекте подарка
    if (gift.thumbnail_path) {
        // Добавляем проверку на наличие префикса '/dev' для режима разработки
        const isDevMode = window.isDevMode || window.location.pathname.includes('/dev/');
        const apiPrefix = isDevMode && !gift.thumbnail_path.startsWith('/dev') ? '/dev' : '';
        giftContent = `<img src="${apiPrefix}${gift.thumbnail_path}" alt="${gift.emoji}" class="gift-thumbnail">`;
    } else {
        giftContent = gift.emoji;
    }
    
    giftElement.innerHTML = giftContent;
    
    // Добавляем класс для стоимости подарка на основе ценового диапазона
    if (giftValue >= 500) {
        giftElement.classList.add('gift-price-tier-5');
    } else if (giftValue >= 300) {
        giftElement.classList.add('gift-price-tier-4');
    } else if (giftValue >= 200) {
        giftElement.classList.add('gift-price-tier-3');
    } else if (giftValue >= 100) {
        giftElement.classList.add('gift-price-tier-2');
    }
    // Для подарков до 100 не применяем специальный класс
    
    return giftElement;
}

/**
 * Отмечает анимацию как пропущенную, чтобы избежать повторного показа результата
 */
export function markAnimationSkipped() {
    // Устанавливаем флаг пропуска анимации
    animationState.skipTriggered = true;
    
    // Очищаем таймер анимации, если он есть
    if (animationState.spinTimer) {
        clearTimeout(animationState.spinTimer);
        animationState.spinTimer = null;
    }
    
    // Добавляем свойство для отслеживания времени пропуска
    animationState.skipTimestamp = Date.now();
    
    console.log('Анимация отмечена как пропущенная');
}

/**
 * Позиционирует барабан лотереи так, чтобы выигрышный подарок оказался под индикатором
 * @param {HTMLElement} lotteryItems - Контейнер с элементами лотереи
 * @param {Object} gameResult - Результат игры
 */
export function positionLotteryForWinningItem(lotteryItems, gameResult) {
    if (!lotteryItems || !gameResult || !gameResult.sequence) {
        console.error('Недостаточно данных для позиционирования барабана лотереи');
        return;
    }
    
    try {
        const { sequence, winning_gift_type } = gameResult;
        const winningItemIndex = Math.floor(sequence.length / 2);
        const itemWidth = 156; // Ширина элемента + отступы (150px + 3px*2)
        const containerWidth = lotteryItems.parentElement.offsetWidth;
        
        // Сбрасываем анимацию перемещения
        lotteryItems.style.transition = 'none';
        void lotteryItems.offsetWidth; // Форсируем перерисовку
        
        // Добавляем случайное смещение для более естественного позиционирования
        // Случайное смещение в пределах ±75px от центра (вся ширина карточки)
        const randomOffset = (Math.random() - 0.5) * 150; // от -75 до +75 пикселей
        
        // Позиционируем выигрышный элемент под индикатором с случайным смещением
        const targetPosition = -winningItemIndex * itemWidth + containerWidth / 2 - itemWidth / 2 + randomOffset;
        lotteryItems.style.left = `${targetPosition}px`;
        
        // Подсвечиваем выигрышный элемент
        highlightWinningItem(lotteryItems, winningItemIndex, winning_gift_type);
        
        // Сохраняем итоговое положение барабана
        lotteryItems.dataset.lastPosition = lotteryItems.style.left;
        lotteryItems.dataset.lastContent = lotteryItems.innerHTML;
        
        // Добавляем класс для визуального индикатора завершенной анимации
        lotteryItems.classList.add('animation-completed');
        
        console.log('Барабан лотереи успешно позиционирован на выигрышном элементе');
    } catch (error) {
        console.error('Ошибка при позиционировании барабана лотереи:', error);
    }
}

/**
 * Запускает медленную анимацию прокрутки в режиме ожидания
 * @param {HTMLElement} lotteryItems - Контейнер с элементами лотереи
 * @param {boolean} preservePosition - Сохранять ли текущую позицию (для случая после выигрыша)
 */
export function startIdleAnimation(lotteryItems, preservePosition = false) {
    if (!lotteryItems) return;
    
    // Останавливаем любую предыдущую анимацию
    stopIdleAnimation(lotteryItems);
    
    // Всегда сбрасываем transition для плавности анимации
    lotteryItems.style.transition = 'none';
    
    if (preservePosition && lotteryItems.dataset.lastPosition) {
        // Если нужно сохранить позицию, просто не сбрасываем left и используем стандартную анимацию
        // Не меняем left, оставляем текущую позицию
        lotteryItems.style.transform = '';
        lotteryItems.style.animation = '';
        
        // Добавляем класс для медленной анимации - анимация начнется с текущей позиции
        lotteryItems.classList.add('idle-animation');
        
        console.log('Запущена медленная анимация ожидания для лотереи с сохранением позиции');
    } else {
        // Если не нужно сохранять позицию, сбрасываем все стили
        lotteryItems.style.left = '';
        lotteryItems.style.transform = '';
        lotteryItems.style.animation = '';
        
        // Добавляем класс для медленной анимации
        lotteryItems.classList.add('idle-animation');
        
        console.log('Запущена медленная анимация ожидания для лотереи');
    }
}

/**
 * Останавливает медленную анимацию прокрутки в режиме ожидания
 * @param {HTMLElement} lotteryItems - Контейнер с элементами лотереи
 */
export function stopIdleAnimation(lotteryItems) {
    if (!lotteryItems) return;
    
    // Удаляем класс анимации
    lotteryItems.classList.remove('idle-animation');
    
    // Сбрасываем transform
    lotteryItems.style.transform = 'none';
    
    console.log('Остановлена медленная анимация ожидания для лотереи');
} 