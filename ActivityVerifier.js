/**
 * Модуль для проверки активности пользователя
 * Используется для заданий, связанных с активностью в приложении
 */

/**
 * Проверяет активность пользователя в приложении
 * @param {Object} task - Объект задания для проверки
 * @returns {Promise<boolean>} - Промис с результатом проверки
 */
export async function checkAppActivity(task) {
    // Получаем данные пользователя из Telegram WebApp
    const telegram = window.Telegram.WebApp;
    const userId = telegram.initDataUnsafe?.user?.id;
    
    if (!userId) {
        console.error('Не удалось получить ID пользователя');
        return false;
    }
    
    try {
        // Проверяем тип активности
        switch (task.activityType) {
            case 'login':
                // Проверка входа в приложение
                return await checkLoginActivity(userId);
            case 'play_games':
                // Проверка количества игр, которые провел пользователь
                return await checkGamesPlayed(userId, task.requiredCount || 0);
            case 'share_results':
                // Проверка поделился ли пользователь результатом
                return await checkShareActivity(userId);
            default:
                console.warn(`Неизвестный тип активности: ${task.activityType}`);
                return false;
        }
    } catch (error) {
        console.error('Ошибка при проверке активности:', error);
        return false;
    }
}

/**
 * Проверяет, входил ли пользователь в приложение сегодня
 * @param {number} userId - ID пользователя
 * @returns {Promise<boolean>} - Промис с результатом проверки
 */
async function checkLoginActivity(userId) {
    try {
        // Для ежедневного задания "Войти в приложение" автоматически возвращаем true,
        // так как если пользователь открыл страницу заданий, значит он уже вошел в приложение
        return true;
    } catch (error) {
        console.error('Ошибка при проверке входа в приложение:', error);
        return false;
    }
}

/**
 * Проверяет, сколько игр провел пользователь сегодня
 * @param {number} userId - ID пользователя
 * @param {number} requiredCount - Необходимое количество игр
 * @returns {Promise<boolean>} - Промис с результатом проверки
 */
async function checkGamesPlayed(userId, requiredCount) {
    try {
        // Запрос на API для получения информации о количестве игр сегодня
        // Формируем URL с учетом режима разработки
        const apiUrl = window.isDevMode ? '/dev/api/tasks/get' : '/api/tasks/get';
        
        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                user_id: userId
            })
        });
        
        if (!response.ok) {
            console.error('Ошибка при получении заданий');
            return false;
        }
        
        const result = await response.json();
        
        if (!result.success) {
            console.error('Ошибка при получении заданий:', result.error);
            return false;
        }
        
        // Ищем задание "Провести X игр"
        const playGamesTask = result.tasks.find(task => 
            task.activityType === 'play_games' && task.requiredCount === requiredCount
        );
        
        if (!playGamesTask) {
            console.error('Задание "Провести игры" не найдено');
            return false;
        }
        
        // Если у задания статус "completed", значит награда уже была получена
        if (playGamesTask.status === 'completed') {
            return true;
        }
        
        // Проверяем, достаточно ли игр провел пользователь
        // Если прогресс 100% или количество игр достигнуто, задание можно выполнить
        return playGamesTask.progress >= 100;
    } catch (error) {
        console.error('Ошибка при проверке количества игр:', error);
        return false;
    }
}

/**
 * Проверяет, поделился ли пользователь результатом
 * @param {number} userId - ID пользователя
 * @returns {Promise<boolean>} - Промис с результатом проверки
 */
async function checkShareActivity(userId) {
    try {
        // Запрос на API для проверки, поделился ли пользователь результатом сегодня
        // Заглушка на будущее, пока не реализовано API
        return false;
    } catch (error) {
        console.error('Ошибка при проверке действия "Поделиться":', error);
        return false;
    }
} 