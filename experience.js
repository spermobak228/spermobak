/**
 * Модуль для работы с системой опыта и уровней пользователя
 */

// Импортируем модуль для работы с локализацией
import { t } from './i18n.js';

/**
 * Рассчитывает данные об уровне пользователя на основе опыта
 * @param {number} exp - Количество опыта
 * @returns {Object} Данные об уровне (level, current_exp, level_exp, progress)
 */
export function calculateLevelData(exp) {
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
}

/**
 * Создает и обновляет шкалу прогресса опыта
 * @param {HTMLElement} container - Контейнер для шкалы прогресса
 * @param {number} progress - Процент прогресса (0-100)
 * @param {string} type - Тип шкалы прогресса ('profile' или 'header')
 */
export function updateProgressBar(container, progress, type = 'profile') {
    // Создаем шкалу прогресса, если она еще не существует
    if (!container.querySelector('.exp-progress-bar')) {
        const progressBarContainer = document.createElement('div');
        progressBarContainer.className = `exp-progress-container ${type}`;
        
        const progressBar = document.createElement('div');
        progressBar.className = 'exp-progress-bar';
        
        progressBarContainer.appendChild(progressBar);
        container.appendChild(progressBarContainer);
    }
    
    // Обновляем шкалу прогресса
    const progressBar = container.querySelector('.exp-progress-bar');
    progressBar.style.width = `${progress}%`;
}

/**
 * Получает оптимальный отступ для шкалы прогресса в зависимости от уровня
 * @param {number} level - Текущий уровень пользователя
 * @returns {string} Значение отступа в пикселях
 */
function getProgressBarOffset(level) {
    return level >= 10 ? '35px' : '30px';
}

/**
 * Создает и обновляет информацию об уровне
 * @param {HTMLElement} container - Контейнер для информации об уровне
 * @param {Object} levelData - Данные об уровне пользователя
 * @param {string} type - Тип отображения ('profile' или 'header')
 */
export function updateLevelInfo(container, levelData, type = 'profile') {
    // Получаем текст уровня из локализации
    const levelPrefix = t('common.level_short');
    
    // Создаем информацию об уровне, если она еще не существует
    if (!container.querySelector('.exp-level-info')) {
        const levelInfo = document.createElement('div');
        levelInfo.className = `exp-level-info ${type}`;
        
        // Для шапки добавляем только текст об уровне и блок для прогресса
        if (type === 'header') {
            // Добавляем текст уровня
            const levelText = document.createElement('div');
            levelText.className = 'exp-level-text';
            levelText.textContent = `${levelPrefix} ${levelData.level}`;
            levelInfo.appendChild(levelText);
            
            container.appendChild(levelInfo);
            
            // Добавляем шкалу прогресса
            const progressContainer = document.createElement('div');
            progressContainer.className = `exp-progress-container ${type}`;
            
            // Используем общую функцию для определения отступа
            progressContainer.style.left = getProgressBarOffset(levelData.level);
            
            const progressBar = document.createElement('div');
            progressBar.className = 'exp-progress-bar';
            progressBar.style.width = `${levelData.progress}%`;
            
            progressContainer.appendChild(progressBar);
            container.appendChild(progressContainer);
        } else {
            // Для страницы профиля: полный вид с опытом
            // Добавляем информацию об уровне
            const levelText = document.createElement('div');
            levelText.className = 'exp-level-text';
            levelText.textContent = `${levelPrefix} ${levelData.level}`;
            
            // Добавляем информацию о прогрессе опыта
            const expProgress = document.createElement('div');
            expProgress.className = 'exp-progress-text';
            expProgress.textContent = `${levelData.currentExp}/${levelData.levelExp}`;
            
            // Добавляем элементы в правильном порядке (сначала уровень слева, потом опыт справа)
            levelInfo.appendChild(levelText);
            levelInfo.appendChild(expProgress);
            
            container.appendChild(levelInfo);
            
            // Удаляем существующий контейнер шкалы прогресса, если он есть
            const existingProgressContainer = container.querySelector('.exp-progress-container');
            if (existingProgressContainer) {
                existingProgressContainer.remove();
            }
            
            // Создаем новую шкалу прогресса
            const progressBarContainer = document.createElement('div');
            progressBarContainer.className = `exp-progress-container ${type}`;
            
            const progressBar = document.createElement('div');
            progressBar.className = 'exp-progress-bar';
            progressBar.style.width = `${levelData.progress}%`;
            
            progressBarContainer.appendChild(progressBar);
            
            // Добавляем шкалу прогресса перед информацией об уровне
            container.insertBefore(progressBarContainer, levelInfo);
        }
    } else {
        // Обновляем существующую информацию
        if (type === 'header') {
            const levelText = container.querySelector('.exp-level-text');
            if (levelText) {
                levelText.textContent = `${levelPrefix} ${levelData.level}`;
            }
            
            const progressBar = container.querySelector('.exp-progress-bar');
            if (progressBar) {
                progressBar.style.width = `${levelData.progress}%`;
            }
            
            // Обновляем отступ с использованием общей функции
            const progressContainer = container.querySelector('.exp-progress-container');
            if (progressContainer) {
                progressContainer.style.left = getProgressBarOffset(levelData.level);
            }
        } else {
            // Обновляем информацию об уровне и прогрессе
            const levelText = container.querySelector('.exp-level-text');
            if (levelText) {
                levelText.textContent = `${levelPrefix} ${levelData.level}`;
            }
            
            // Обновляем информацию о прогрессе (только для страницы профиля)
            const expProgress = container.querySelector('.exp-progress-text');
            if (expProgress) {
                expProgress.textContent = `${levelData.currentExp}/${levelData.levelExp}`;
            }
            
            // Обновляем шкалу прогресса
            const progressBar = container.querySelector('.exp-progress-bar');
            if (progressBar) {
                progressBar.style.width = `${levelData.progress}%`;
            }
        }
    }
}

/**
 * Обновляет отображение опыта пользователя
 * @param {Object} userData - Данные пользователя
 * @param {string} containerSelector - Селектор контейнера для шкалы прогресса
 * @param {string} type - Тип отображения ('profile' или 'header')
 */
export function updateExperienceDisplay(userData, containerSelector, type = 'profile') {
    const container = document.querySelector(containerSelector);
    if (!container) return;
    
    // Получаем опыт из данных пользователя
    const exp = userData.exp || 0;
    
    // Рассчитываем данные об уровне
    const levelData = calculateLevelData(exp);
    
    // Для страницы профиля сначала обновляем шкалу прогресса, затем информацию об уровне
    if (type === 'profile') {
        // Обновляем шкалу прогресса
        updateProgressBar(container, levelData.progress, type);
        
        // Обновляем информацию об уровне
        updateLevelInfo(container, levelData, type);
    } else {
        // Для главной страницы обновляем только информацию об уровне,
        // шкала прогресса обновляется внутри updateLevelInfo
        updateLevelInfo(container, levelData, type);
    }
} 