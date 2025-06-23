/**
 * Модуль игровой логики
 * Содержит функции для управления игровым процессом лотереи
 */

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
 * Выбирает случайный подарок с учетом шансов
 * @param {Array} availableGifts - Массив доступных подарков
 * @param {boolean} useAttractiveChances - Использовать привлекательные шансы вместо реальных
 * @returns {Object} Выбранный подарок и его ID
 */
export function selectRandomGiftByChance(availableGifts, useAttractiveChances = false) {
    // Логируем, какой тип шансов используется
    console.log(`Выбор подарка с использованием ${useAttractiveChances ? 'привлекательных' : 'реальных'} шансов`);
    
    // Вычисляем общую сумму шансов, используя привлекательные или оригинальные шансы
    const totalChance = availableGifts.reduce((sum, [id, gift]) => {
        // Используем привлекательные шансы (chance) если useAttractiveChances=true,
        // иначе используем originalChance, или обычный chance как запасной вариант
        const chanceValue = useAttractiveChances ? 
            gift.chance : (gift.originalChance !== undefined ? gift.originalChance : gift.chance);
        return sum + chanceValue;
    }, 0);
    
    // Выбираем случайное число от 0 до totalChance
    const randomNum = Math.random() * totalChance;
    
    // Определяем, какой подарок выпал
    let currentSum = 0;
    let winningGiftId = availableGifts[0][0];
    let winningGift = availableGifts[0][1];
    
    // Для отладки - собираем данные о шансах всех подарков
    if (availableGifts.length <= 10) { // Ограничиваем вывод для больших списков
        const chancesDebug = availableGifts.map(([id, gift]) => {
            const chanceValue = useAttractiveChances ? 
                gift.chance : (gift.originalChance !== undefined ? gift.originalChance : gift.chance);
            return `${id} (${gift.emoji}): ${chanceValue.toFixed(2)}%`;
        });
        console.log('Шансы подарков:', chancesDebug.join(', '));
    }
    
    for (const [id, gift] of availableGifts) {
        // Используем привлекательные шансы (chance) если useAttractiveChances=true, 
        // иначе используем originalChance, или обычный chance как запасной вариант
        const chanceValue = useAttractiveChances ? 
            gift.chance : (gift.originalChance !== undefined ? gift.originalChance : gift.chance);
        
        currentSum += chanceValue;
        if (randomNum <= currentSum) {
            winningGiftId = id;
            winningGift = gift;
            console.log(`Выпал подарок ${winningGiftId} (${winningGift.emoji}) с шансом ${chanceValue.toFixed(2)}%, при случайном числе ${randomNum.toFixed(2)} из ${totalChance.toFixed(2)}`);
            break;
        }
    }
    
    return { giftId: winningGiftId, gift: winningGift };
}

/**
 * Возвращает список доступных подарков для указанного типа ставки
 * @param {Object} gifts - Словарь всех подарков
 * @param {string} betType - Тип ставки (low/medium/high)
 * @returns {Array} Массив подарков, доступных для данного типа ставки
 */
export function getAvailableGiftsForBet(gifts, betType) {
    // Получаем настройки из глобального объекта
    const appSettings = window.appSettings || {};
    
    // Логируем полученные настройки для отладки
    console.log('appSettings:', appSettings);
    console.log('Доступные подарки:', gifts);
    
    // Получаем список подарков для этого типа ставки из LOTTERY_WHEELS
    const wheelGifts = appSettings.LOTTERY_WHEELS && appSettings.LOTTERY_WHEELS[betType] || [];
    
    // Логируем полученные wheelGifts для отладки
    console.log(`Подарки в колесе для типа ставки ${betType}:`, wheelGifts);
    
    // Если список wheelGifts пуст, используем все доступные подарки (для режима отладки)
    if (wheelGifts.length === 0) {
        console.warn(`Список подарков для типа ставки ${betType} пуст! Используем все доступные подарки.`);
        
        // Вернем все подарки, ограничив их по типу ставки
        return Object.entries(gifts).map(([id, gift]) => {
            // Создаем копию подарка, чтобы не изменять оригинал
            const giftCopy = {...gift};
            
            if (giftCopy.animation_path !== undefined && giftCopy.animation === undefined) {
                giftCopy.animation = giftCopy.animation_path;
            }
            
            if (giftCopy.type !== undefined && giftCopy.gift_type === undefined) {
                giftCopy.gift_type = giftCopy.type;
            }
            
            return [id, giftCopy];
        });
    }
    
    // Получаем подарки для текущего типа ставки
    const betGifts = appSettings.BET_GIFTS && appSettings.BET_GIFTS[betType] || {};
    
    // Фильтруем подарки и включаем все подарки, которые есть в колесе для текущего типа ставки
    const availableGifts = Object.entries(gifts)
        .filter(([id, gift]) => wheelGifts.includes(id))
        .map(([id, gift]) => {
            // Создаем копию подарка, чтобы не изменять оригинал
            const giftCopy = {...gift};
            
            // Если для этого типа ставки есть информация о подарке, обновляем только некоторые данные
            if (betGifts[id]) {
                // Обновляем шанс, если он есть
                if (typeof betGifts[id].chance === 'number') {
                    giftCopy.chance = betGifts[id].chance;
                }
                
                // Используем только данные, которые не влияют на стоимость
                if (betGifts[id].emoji) giftCopy.emoji = betGifts[id].emoji;
                // НЕ обновляем star_count из демо-данных
                if (betGifts[id].animation_path) giftCopy.animation_path = betGifts[id].animation_path;
                if (betGifts[id].thumbnail_path) giftCopy.thumbnail_path = betGifts[id].thumbnail_path;
                if (betGifts[id].type) giftCopy.type = betGifts[id].type;
                
                // Устанавливаем реальный шанс в originalChance, если он доступен
                if (betGifts[id].real_chance !== undefined) {
                    giftCopy.originalChance = betGifts[id].real_chance;
                }
            }
            // Если для подарка нет информации о шансе, добавляем дефолтный шанс
            // Это обеспечит отображение всех подарков в интерфейсе с каким-то шансом
            if (typeof giftCopy.chance !== 'number' || isNaN(giftCopy.chance)) {
                // Рассчитываем шанс обратно пропорционально стоимости подарка
                const giftValue = giftCopy.star_count || 1;
                // Используем простую формулу для расчета шанса: чем дороже подарок, тем меньше шанс
                giftCopy.chance = Math.max(1, Math.min(20, 100 / giftValue));
                console.log(`Установлен дефолтный шанс ${giftCopy.chance} для подарка ${id}`);
            }

            if (giftCopy.animation_path !== undefined && giftCopy.animation === undefined) {
                giftCopy.animation = giftCopy.animation_path;
            }
            
            if (giftCopy.type !== undefined && giftCopy.gift_type === undefined) {
                giftCopy.gift_type = giftCopy.type;
            }
            
            // Форматируем шанс, чтобы он был с двумя десятичными знаками (сотые)
            if (giftCopy.chance !== undefined) {
                giftCopy.chance = parseFloat(giftCopy.chance.toFixed(2));
            }
            
            // Если originalChance не был установлен, используем chance
            if (giftCopy.originalChance === undefined) {
                giftCopy.originalChance = giftCopy.chance;
            }
            
            return [id, giftCopy];
        });
    
    return availableGifts;
}

/**
 * Генерирует последовательность с выигрышным подарком посередине
 * @param {Array} availableGifts - Массив доступных подарков
 * @param {string} winningGiftId - ID выигрышного подарка
 * @param {number} seqLength - Длина последовательности (по умолчанию 41)
 * @returns {Array} Последовательность ID подарков
 */
export function generateSequenceWithWinningGift(availableGifts, winningGiftId, seqLength = 41) {
    const sequence = [];
    
    // Вычисляем половину длины (округляем вниз)
    const halfLength = Math.floor(seqLength / 2);
    
    // Генерируем первую половину случайных элементов
    for (let i = 0; i < halfLength; i++) {
        const randomGift = availableGifts[Math.floor(Math.random() * availableGifts.length)][0];
        sequence.push(randomGift);
    }
    
    // Добавляем выигрышный элемент
    sequence.push(winningGiftId);
    
    // Добавляем вторую половину случайных элементов
    for (let i = 0; i < halfLength; i++) {
        const randomGift = availableGifts[Math.floor(Math.random() * availableGifts.length)][0];
        sequence.push(randomGift);
    }
    
    return sequence;
}

/**
 * Генерирует результат демо-игры для указанного типа ставки
 * @param {Object} gifts - Словарь всех подарков
 * @param {string} betType - Тип ставки (low/medium/high)
 * @returns {Promise<Object>} Результат игры
 */
export async function generateDemoResult(gifts, betType) {
    console.log(`Генерация результата демо-игры для типа ставки: ${betType}`);
    
    // Получаем список доступных подарков для этого типа ставки
    const availableGifts = getAvailableGiftsForBet(gifts, betType);
    
    // Если список пуст, возвращаем ошибку
    if (availableGifts.length === 0) {
        throw new Error('Нет доступных подарков для этого типа ставки');
    }
    
    // Выбираем случайный подарок с использованием привлекательных шансов
    // Важно: теперь в демо-режиме мы используем привлекательные шансы вместо реальных,
    // чтобы пользователи видели результаты, соответствующие отображаемым шансам
    const { giftId: winningGiftId, gift: winningGift } = selectRandomGiftByChance(availableGifts, true);
    
    // Удаляем искусственную задержку для мгновенной работы в демо-режиме
    
    // Создаем fake ID подарка
    const fakeGiftUuid = Date.now().toString();
    
    // Всегда используем star_count из оригинальных данных, полученных от API
    // Готовим объект подарка для результата
    const formattedGift = {
        id: winningGiftId,
        emoji: winningGift.emoji,
        star_count: winningGift.star_count,
        animation_path: winningGift.animation_path,
        animation: winningGift.animation_path, // Для обратной совместимости
        gift_type: winningGift.type || winningGift.gift_type,
        type: winningGift.type || winningGift.gift_type,
        thumbnail_path: winningGift.thumbnail_path
    };

    // Генерируем последовательность с выигрышным подарком в середине
    const sequence = generateSequenceWithWinningGift(availableGifts, winningGiftId);
    
    return {
        success: true,
        sequence: sequence,
        winning_gift_id: fakeGiftUuid,
        winning_gift_type: winningGiftId,
        winning_gift: formattedGift,
        new_balance: 123 // Демо-баланс для тестирования
    };
}

/**
 * Получает результат игры с сервера
 * @param {string} userId - ID пользователя
 * @param {string} betType - Тип ставки ('low', 'medium', 'high')
 * @param {boolean} skipAnimation - Флаг пропуска анимации
 * @returns {Promise<Object>} Ответ от сервера
 */
export async function getServerResult(userId, betType, skipAnimation = false) {
    try {
        // Проверяем, находимся ли мы в режиме разработки
        const isDevMode = window.isDevMode || false;
        const apiPrefix = isDevMode ? '/dev' : '';
        
        const response = await fetch(`${apiPrefix}/api/play`, {
            method: 'POST',
            headers: createTelegramHeaders(),
            body: JSON.stringify({
                user_id: userId,
                bet_type: betType,
                skip_animation: skipAnimation, // Добавляем параметр пропуска анимации
                initData: getTelegramInitData() // Добавляем initData для авторизации
            })
        });
        
        return await response.json();
    } catch (error) {
        console.error('Ошибка при запросе к серверу:', error);
        return {
            success: false,
            error: "Ошибка соединения с сервером"
        };
    }
}

/**
 * Проверяет и исправляет результат игры при необходимости
 * @param {Object} result - Результат игры
 * @param {Object} gifts - Объект со всеми подарками
 * @param {string} betType - Тип ставки ('low', 'medium', 'high')
 * @returns {Object} Исправленный результат игры
 */
export function validateAndFixResult(result, gifts, betType) {
    // Если результат отсутствует, возвращаем null
    if (!result) return null;
    
    let { sequence, winning_gift_id, winning_gift_type, winning_gift } = result;
    const availableGifts = getAvailableGiftsForBet(gifts, betType);
    
    // В случае отсутствия winning_gift_type используем winning_gift_id
    winning_gift_type = winning_gift_type || winning_gift_id;
    
    // Проверяем и корректируем последовательность
    if (!Array.isArray(sequence) || sequence.length === 0) {
        console.warn('Последовательность отсутствует или пуста, генерируем локально');
        sequence = generateSequenceWithWinningGift(availableGifts, winning_gift_type);
    }
    
    // Проверяем выигрышный подарок
    if (!winning_gift && winning_gift_type) {
        console.warn('Объект выигрышного подарка отсутствует, используем из локальных данных');
        winning_gift = gifts[winning_gift_type];
    }
    
    // Если оба отсутствуют, выбираем случайный подарок с использованием привлекательных шансов
    if (!winning_gift_type || !winning_gift) {
        console.warn('Выигрышный подарок полностью отсутствует, выбираем случайный');
        const { giftId, gift } = selectRandomGiftByChance(availableGifts, true);
        winning_gift_id = giftId;
        winning_gift_type = giftId;
        winning_gift = gift;
        
        // Полностью регенерируем последовательность
        sequence = generateSequenceWithWinningGift(availableGifts, winning_gift_type);
    }
    
    // Проверяем, что выигрышный подарок находится в середине последовательности
    const winningItemIndex = Math.floor(sequence.length / 2);
    if (sequence[winningItemIndex] !== winning_gift_type) {
        console.warn('Выигрышный подарок не в середине последовательности, генерируем новую последовательность');
        // Полностью регенерируем последовательность с правильным подарком в центре
        sequence = generateSequenceWithWinningGift(availableGifts, winning_gift_type);
    }
    
    // Добавляем gift_id в объект winning_gift, чтобы использовать его для шеринга
    if (winning_gift && winning_gift_type) {
        winning_gift.gift_id = winning_gift_type;
    }
    
    console.log('Исправленный результат:', {
        winning_gift_id,
        winning_gift_type,
        winning_gift: winning_gift ? {
            ...winning_gift,
            gift_id: winning_gift.gift_id || winning_gift_type
        } : null
    });
    
    return {
        ...result,
        sequence,
        winning_gift_id,
        winning_gift_type,
        winning_gift: winning_gift ? {
            ...winning_gift,
            gift_id: winning_gift.gift_id || winning_gift_type
        } : winning_gift
    };
}

/**
 * Создает запрос на продажу подарка
 * @param {string} userId - ID пользователя
 * @param {string} giftId - ID подарка
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
        
        return await response.json();
    } catch (error) {
        console.error('Ошибка при запросе к серверу:', error);
        return {
            success: false,
            error: "Ошибка соединения с сервером"
        };
    }
} 