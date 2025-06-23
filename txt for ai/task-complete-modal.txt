/**
 * Модуль для работы с модальным окном завершения задания
 */

import * as i18n from '../i18n.js';
import { renderReward } from './components/RewardDisplay.js';

// Идентификаторы элементов модального окна
const MODAL_ID = 'taskCompleteModal';
const MESSAGE_ID = 'taskCompleteMessage';
const REWARD_CONTAINER_ID = 'taskCompleteReward';
const BUTTON_ID = 'taskCompleteButton';
const ANIMATION_ID = 'taskCompleteAnimation';

/**
 * Показывает модальное окно с информацией о завершении задания
 * @param {Object} task - Объект с данными о задании
 * @param {Function} onClose - Колбэк при закрытии модального окна
 */
export function showTaskComplete(task, onClose) {
    // Получаем модальное окно
    const modal = document.getElementById(MODAL_ID);
    if (!modal) return;
    
    // Заполняем данными
    fillTaskCompleteData(task);
    
    // Настраиваем кнопку закрытия
    setupCloseButton(onClose);
    
    // Показываем модальное окно
    modal.classList.add('show');
}

/**
 * Заполняет модальное окно данными о завершении задания
 * @param {Object} task - Объект с данными о задании
 */
function fillTaskCompleteData(task) {
    // Больше не отображаем сообщение о награде, так как оно скрыто
    // const messageElement = document.getElementById(MESSAGE_ID);
    // messageElement.textContent = getCompleteMessage(task);
    
    // Заполняем информацию о награде с помощью компонента RewardDisplay
    const rewardContainer = document.getElementById(REWARD_CONTAINER_ID);
    rewardContainer.innerHTML = ''; // Очищаем контейнер
    
    if (task.reward) {
        // Создаем объект награды
        const rewardObj = {
            icon: task.reward.icon || 'crystal',
            type: task.reward.type || 'currency'
        };
        
        // Для наград-функций не добавляем префикс "+"
        if (task.reward.type === 'feature') {
            rewardObj.value = task.reward.value || '';
        } else {
            rewardObj.value = `+${task.reward.value || ''}`;
        }
        
        // Используем модуль RewardDisplay для отображения награды
        const tempContainer = renderReward(rewardObj);
        
        // Добавляем дополнительный класс для стилизации награды в модальном окне
        tempContainer.classList.add('task-complete-reward-container');
        
        // Копируем содержимое в оригинальный контейнер
        rewardContainer.appendChild(tempContainer);
    }
    
    // Настраиваем анимацию
    setupCompleteAnimation();
}

/**
 * Получает сообщение в зависимости от типа награды
 * @param {Object} task - Объект с данными о задании
 * @returns {string} - Сообщение для модального окна
 */
function getCompleteMessage(task) {
    if (!task || !task.reward) {
        return i18n.t('tasks.completed_default');
    }
    
    switch (task.reward.type) {
        case 'currency':
            return i18n.t('tasks.reward_currency', { value: task.reward.value, icon: task.reward.icon });
        case 'telegram_gift':
            return i18n.t('tasks.reward_telegram_gift', { value: task.reward.value });
        case 'sticker_pack':
            return i18n.t('tasks.reward_sticker_pack');
        case 'feature':
            return i18n.t('tasks.reward_feature', { value: task.reward.value });
        case 'experience':
            return i18n.t('tasks.reward_experience', { value: task.reward.value });
        case 'temporary_bonus':
            return i18n.t('tasks.reward_temporary_bonus', { value: task.reward.value });
        case 'content':
            return i18n.t('tasks.reward_content');
        case 'status':
            return i18n.t('tasks.reward_status', { value: task.reward.value });
        default:
            return i18n.t('tasks.completed_default');
    }
}

/**
 * Настраивает анимацию в модальном окне
 */
function setupCompleteAnimation() {
    const animation = document.getElementById(ANIMATION_ID);
    if (animation) {
        // Меняем источник анимации на новый файл
        const isDevMode = window.isDevMode;
        const baseUrl = isDevMode ? '/dev' : '';
        animation.src = `${baseUrl}/static/animations/other/tasks_plus.tgs`;
        
        // Перезапускаем анимацию
        animation.load();
    }
}

/**
 * Настраивает кнопку закрытия модального окна
 * @param {Function} onClose - Колбэк при закрытии модального окна
 */
function setupCloseButton(onClose) {
    const closeButton = document.getElementById('taskCompleteClose');
    closeButton.onclick = () => {
        hideTaskComplete();
        
        if (typeof onClose === 'function') {
            onClose();
        }
    };
    
    // Закрытие по клику на темную область
    const modal = document.getElementById(MODAL_ID);
    modal.onclick = (event) => {
        if (event.target === modal) {
            hideTaskComplete();
            
            if (typeof onClose === 'function') {
                onClose();
            }
        }
    };
}

/**
 * Скрывает модальное окно с информацией о завершении задания
 */
export function hideTaskComplete() {
    const modal = document.getElementById(MODAL_ID);
    if (!modal) return;
    
    // Скрываем модальное окно
    modal.classList.remove('show');
} 