/**
 * Верификатор заданий на опыт и уровни
 */

/**
 * Проверяет выполнение задания на достижение уровня
 * @param {Object} task - Объект задания
 * @returns {Promise<boolean>} Результат проверки
 */
export async function checkLevelAchievement(task) {
    const telegram = window.Telegram.WebApp;
    const userId = telegram.initDataUnsafe?.user?.id;
    
    if (!userId) {
        console.error('Не удалось получить ID пользователя');
        return false;
    }
    
    try {
        // Импортируем функцию расчета уровня
        const { calculateLevelData } = await import('../experience.js');
        
        // Получаем текущие данные пользователя из глобального объекта
        const userData = window.userData || {};
        const currentExp = userData.exp || 0;
        
        // Рассчитываем уровень
        const levelData = calculateLevelData(currentExp);
        
        // Проверяем достижение требуемого уровня
        return levelData.level >= (task.requiredLevel || 3);
        
    } catch (error) {
        console.error('Ошибка при проверке задания на уровень:', error);
        return false;
    }
}

/**
 * Основная функция для проверки заданий на опыт
 * @param {Object} task - Объект задания
 * @returns {Promise<boolean>} Результат проверки
 */
export async function checkExperience(task) {
    if (task.experienceType === 'reach_level') {
        return checkLevelAchievement(task);
    }
    
    console.warn(`Неизвестный тип задания на опыт: ${task.experienceType}`);
    return false;
} 