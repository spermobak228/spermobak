/**
 * Модуль для проверки инвентаря пользователя
 * Используется для заданий, связанных с коллекционированием предметов
 */

/**
 * Проверяет количество подарков определенного типа у пользователя
 * @param {Object} task - Объект задания для проверки
 * @returns {Promise<boolean>} - Промис с результатом проверки
 */
export async function checkInventory(task) {
    // Получаем данные пользователя из Telegram WebApp
    const telegram = window.Telegram.WebApp;
    const userId = telegram.initDataUnsafe?.user?.id;
    
    if (!userId) {
        console.error('Не удалось получить ID пользователя');
        return false;
    }
    
    try {
        // Проверяем, есть ли необходимые параметры в задании
        if (!task.inventoryType || !task.requiredGiftId || !task.requiredCount) {
            console.error('Не указаны необходимые параметры задания');
            return false;
        }
        
        // Проверяем тип инвентаря
        switch (task.inventoryType) {
            case 'gift_collection':
                // Проверка коллекции подарков
                return await checkGiftCollection(userId, task.requiredGiftId, task.requiredCount);
            default:
                console.warn(`Неизвестный тип инвентаря: ${task.inventoryType}`);
                return false;
        }
    } catch (error) {
        console.error('Ошибка при проверке инвентаря:', error);
        return false;
    }
}

/**
 * Проверяет наличие необходимого количества подарков определенного типа
 * @param {number} userId - ID пользователя
 * @param {string} giftId - ID подарка для проверки
 * @param {number} requiredCount - Необходимое количество подарков
 * @returns {Promise<boolean>} - Промис с результатом проверки
 */
async function checkGiftCollection(userId, giftId, requiredCount) {
    try {
        // Формируем URL с учетом режима разработки
        const apiUrl = window.isDevMode ? '/dev/api/tasks/check_inventory' : '/api/tasks/check_inventory';
        
        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                user_id: userId,
                gift_id: giftId,
                required_count: requiredCount
            })
        });
        
        if (!response.ok) {
            console.error('Ошибка при проверке коллекции подарков');
            return false;
        }
        
        const result = await response.json();
        
        if (!result.success) {
            console.error('Ошибка при проверке коллекции подарков:', result.error);
            return false;
        }
        
        // Возвращаем результат проверки
        return result.completed;
    } catch (error) {
        console.error('Ошибка при проверке коллекции подарков:', error);
        return false;
    }
} 