/**
 * Модуль для унифицированного отображения награды в карточках заданий
 */

/**
 * Создает элемент для отображения награды
 * @param {Object} reward - Объект с информацией о награде
 * @param {string|number} reward.value - Значение награды
 * @param {string} reward.icon - Иконка награды
 * @param {string} [reward.type] - Тип награды (currency, telegram_gift и т.д.)
 * @returns {HTMLElement} - Созданный элемент с наградой
 */
export function renderReward(reward) {
    // Создаем блок с наградой
    const rewardElement = document.createElement('div');
    rewardElement.className = 'task-reward';
    
    // Для валюты добавляем класс для стилизации
    if (reward.type === 'currency' || !reward.type) {
        rewardElement.classList.add('currency-reward');
    } else {
        // Для других типов наград добавляем соответствующий класс
        rewardElement.classList.add(`${reward.type}-reward`);
    }
    
    // Значение награды
    const rewardValue = document.createElement('span');
    rewardValue.className = 'reward-value';
    rewardValue.textContent = reward.value;
    
    // Иконка награды
    const rewardIcon = document.createElement('span');
    rewardIcon.className = 'reward-icon';
    
    // Если иконка - это кристалл (💎), заменяем на SVG
    if (reward.icon === '💎') {
        rewardIcon.innerHTML = '<svg class="crystal-icon crystal-icon--medium"><use xlink:href="#crystal-icon"></use></svg>';
        rewardIcon.classList.add('diamond');
    } else {
        rewardIcon.textContent = reward.icon;
    }
    
    // Собираем компоненты награды в зависимости от типа
    if (reward.type === 'feature') {
        // Для наград-функций отображаем иконку и текст
        rewardElement.classList.add('feature-reward');
        
        // Значение награды (текст функции)
        const rewardValueFeature = document.createElement('span');
        rewardValueFeature.className = 'reward-value feature-text';
        
        // Используем переводы для текста функции на основе внутреннего значения
        let displayText = reward.value;
        if (typeof window.i18n !== 'undefined') {
            // Создаем ключ перевода на основе значения
            const translationKey = `tasks.reward_values.achievement_${reward.value}`;
            const translatedText = window.i18n.t(translationKey);
            
            // Если перевод найден (не равен ключу), используем его
            if (translatedText !== translationKey) {
                displayText = translatedText;
            } else {
                // Иначе пробуем прямой ключ
                const directKey = `tasks.reward_values.${reward.value}`;
                const directTranslation = window.i18n.t(directKey);
                if (directTranslation !== directKey) {
                    displayText = directTranslation;
                }
            }
        }
        
        rewardValueFeature.textContent = displayText;
        
        // Для наград-функций добавляем только текст (эмодзи уже в тексте из переводов)
        rewardElement.appendChild(rewardValueFeature);
    } else if (reward.type === 'telegram_gift') {
        // Для подарков Telegram сначала иконка, потом значение
        rewardElement.appendChild(rewardIcon);
        rewardElement.appendChild(rewardValue);
    } else {
        // Для остальных типов сначала значение, потом иконка
        rewardElement.appendChild(rewardValue);
        rewardElement.appendChild(rewardIcon);
    }
    
    return rewardElement;
} 