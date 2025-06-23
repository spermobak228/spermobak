/**
 * Универсальный компонент карточки задания
 * Адаптивная карточка, которая заменяет различные типы карточек заданий
 */

import * as i18n from '../../i18n.js';
import TimerManager from '../utils/TimerManager.js';
import { renderReward } from './RewardDisplay.js';

/**
 * Создает унифицированную карточку задания
 * @param {Object} task - Объект задания
 * @param {string} task.id - Уникальный идентификатор задания
 * @param {string} task.title - Заголовок задания
 * @param {string} [task.description] - Описание задания (опционально)
 * @param {Object} task.reward - Объект с информацией о награде
 * @param {string} task.reward.type - Тип награды
 * @param {string|number} task.reward.value - Значение награды
 * @param {string} task.reward.icon - Иконка награды
 * @param {string} [task.backgroundImage] - URL фонового изображения (опционально)
 * @param {Object} [task.timer] - Объект с информацией о таймере (опционально)
 * @param {Date} task.timer.endTime - Время окончания задания
 * @param {string} [task.status] - Статус выполнения задания
 * @param {number} [task.progress] - Прогресс выполнения задания (0-100)
 * @param {number} [task.currentCount] - Текущее количество выполненных действий
 * @param {number} [task.requiredCount] - Требуемое количество действий для выполнения
 * @param {string} [task.activityType] - Тип активности для задания
 * @param {boolean} [task.isImportant] - Флаг, указывающий на важность задания (влияет на отображение)
 * @param {Function} [onActionClick] - Функция-обработчик нажатия на кнопку действия
 * @returns {HTMLElement} - Созданный элемент карточки
 */
export function renderTaskCard(task, onActionClick) {
    // Создаем основной элемент карточки
    const card = document.createElement('div');
    card.className = 'task-card';
    card.dataset.taskId = task.id;
    
    // Добавляем класс важности (влияет на размер и вид карточки)
    if (task.isImportant) {
        card.classList.add('task-card-important');
    }
    
    // Добавляем класс для карточек с описанием
    if (task.description && task.description.trim()) {
        card.classList.add('with-description');
    }
    
    // Добавляем статус задания в data-атрибут
    card.dataset.status = task.status || 'not_started';
    
    // Добавляем тип верификатора
    if (task.verifierType) {
        card.dataset.verifierType = task.verifierType;
    }
    
    // Добавляем классы в зависимости от статуса
    if (task.status === 'completed') {
        card.classList.add('completed');
    }
    
    // Добавляем класс для горящих заданий, если есть таймер и осталось мало времени
    if (task.timer && task.timer.endTime) {
        if (isUrgent(task.timer.endTime)) {
            card.classList.add('burning');
        }
        card.classList.add('has-timer'); // Добавляем класс для всех карточек с таймером
    }
    
    // Добавляем фоновое изображение, если есть
    if (task.backgroundImage) {
        const bgImage = document.createElement('img');
        bgImage.className = 'task-card-bg';
        bgImage.src = task.backgroundImage;
        bgImage.alt = '';
        card.appendChild(bgImage);
    }
    
    // === Создаем основную структуру карточки ===
    
    // Верхняя часть (заголовок + кнопка/статус)
    const headerContainer = document.createElement('div');
    headerContainer.className = 'task-header';
    
    // Заголовок задания
    const title = document.createElement('div');
    title.className = 'task-title';
    // Используем локализацию для заголовка
    const taskKey = task.id.replace(/-/g, '_');
    title.textContent = i18n.t(`tasks.task_titles.${taskKey}`, { defaultValue: task.title });
    headerContainer.appendChild(title);
    
    // Верхний правый блок (кнопка/таймер/статус)
    const actionContainer = document.createElement('div');
    actionContainer.className = 'task-action';
    
    // Добавляем таймер, если есть (но не для заданий подписки с wait_until - они восстанавливаются отдельно)
    // ИСПРАВЛЕНИЕ: Не показываем таймер для выполненных заданий (кроме заданий подписки)
    // КРИТИЧЕСКАЯ ЗАЩИТА: Если статус 'completed', таймер НЕ показываем НИ ПРИ КАКИХ ОБСТОЯТЕЛЬСТВАХ
    const hasRegularTimer = (task.timer && task.timer.endTime) || (task.wait_until && task.verifierType !== 'subscription');
    const isTaskCompleted = task.progress >= 100;
    const isSubscriptionTask = task.verifierType === 'subscription';
    const isTaskFullyCompleted = task.status === 'completed'; // КРИТИЧЕСКАЯ ПРОВЕРКА
    const shouldShowTimer = hasRegularTimer && !isTaskFullyCompleted && (!isTaskCompleted || isSubscriptionTask);
    
    if (shouldShowTimer) {
        const timerElement = document.createElement('div');
        timerElement.className = 'task-timer';
        actionContainer.appendChild(timerElement);
        
        // Инициализируем таймер с использованием менеджера таймеров
        const timerEndTime = task.wait_until || task.timer.endTime;
        TimerManager.setTimer(task.id, timerEndTime, card);
        
        // Добавляем класс has-timer для правильного отображения
        card.classList.add('has-timer');
    }
    
    // КРИТИЧЕСКАЯ ЗАЩИТА: Кнопка действия НЕ показывается для полностью выполненных заданий
    // Если статус 'completed', кнопка НЕ показывается НИ ПРИ КАКИХ ОБСТОЯТЕЛЬСТВАХ
    if (task.status !== 'completed') {
        const actionButton = document.createElement('button');
        actionButton.className = 'task-button';
        
        // Устанавливаем текст кнопки в зависимости от статуса и верификации
        if (task.verifierType === 'activity' && task.activityType === 'login') {
            // Для задания "Войти в приложение" кнопка всегда "Получить"
            actionButton.textContent = i18n.t('tasks.btn_claim');
        } else if (task.status === 'in_progress' && task.progress >= 100) {
            // Если задание в процессе и прогресс 100%, то "Получить"
            actionButton.textContent = i18n.t('tasks.btn_claim');
        } else if (task.verifierType === 'subscription') {
            // Для заданий подписки проверяем состояние и отображаем соответствующую кнопку
            
            if (task.status === 'in_progress') {
                // Если статус in_progress - показываем "Получить"
                actionButton.textContent = i18n.t('tasks.btn_claim');
            } else {
                // Иначе показываем "Подписаться" (status: not_started)
                const subscribeText = i18n.t('tasks.btn_subscribe', { defaultValue: 'Подписаться' });
                actionButton.textContent = subscribeText;
            }
        } else {
            // В остальных случаях используем или заданный текст, или "Выполнить"
            actionButton.textContent = task.actionText || i18n.t('tasks.btn_do_task');
        }
        
        // Добавляем обработчик нажатия
        actionButton.addEventListener('click', async (e) => {
            e.stopPropagation();
            
            // Для заданий типа "play_games" при нажатии "Выполнить" переходим на главную страницу
            // Но только если задание не выполнено полностью
            if (task.activityType === 'play_games' && task.status !== 'completed' && task.progress < 100) {
                // Проверяем режим разработки и формируем URL соответственно
                const isDevMode = window.isDevMode || window.location.pathname.includes('/dev/');
                const baseUrl = isDevMode ? '/dev/' : '/';
                
                // Переходим на главную страницу с учетом режима разработки
                window.location.href = baseUrl;
                return;
            }
            
            // Для остальных заданий показываем индикатор загрузки
            let isLoading = false;
            let taskCompleted = false;
            
            // Проверяем, нужно ли показывать индикатор загрузки
            const shouldShowLoader = task.verifierType === 'activity' || 
                                   task.verifierType === 'experience' || 
                                   (task.verifierType === 'subscription' && 
                                    (task.status === 'in_progress' || task.status === 'check_manually'));
            
            if (shouldShowLoader) {
                // Показываем индикатор загрузки
                const originalContent = actionButton.innerHTML;
                actionButton.innerHTML = '<span class="loading-spinner"></span>';
                actionButton.classList.add('loading');
                actionButton.disabled = true;
                isLoading = true;
                
                // Восстанавливаем кнопку через 15 секунд на всякий случай (увеличено с 10 секунд)
                const timeoutId = setTimeout(() => {
                    if (isLoading && !taskCompleted) {
                        console.warn('Таймаут выполнения задания, восстанавливаем кнопку');
                        actionButton.innerHTML = originalContent;
                        actionButton.classList.remove('loading');
                        actionButton.disabled = false;
                        isLoading = false;
                    }
                }, 15000);
                
                // Функция для восстановления кнопки при ошибке
                const restoreButtonOnError = () => {
                    if (isLoading && !taskCompleted) {
                        actionButton.innerHTML = originalContent;
                        actionButton.classList.remove('loading');
                        actionButton.disabled = false;
                        isLoading = false;
                    }
                };
                
                // Выполняем действие и ждем завершения
                try {
                    if (typeof onActionClick === 'function') {
                        const result = await onActionClick(task);
                        
                        // Проверяем, было ли задание успешно выполнено
                        // Это может быть объект с result.success или просто boolean
                        if (result && (result.success === true || result === true)) {
                            taskCompleted = true;
                            // Задание выполнено успешно - НЕ восстанавливаем кнопку
                            // Состояние кнопки будет обновлено в handleTaskAction
                        } else if (result === false || (result && result.success === false)) {
                            // Задание не выполнено - восстанавливаем кнопку
                            restoreButtonOnError();
                        }
                        // Если result undefined/null, ждем таймаут или handleTaskAction обновит состояние
                    }
                } catch (error) {
                    console.error('Ошибка при выполнении задания:', error);
                    // При ошибке восстанавливаем кнопку
                    restoreButtonOnError();
                } finally {
                    // Очищаем таймаут
                    clearTimeout(timeoutId);
                    // КРИТИЧЕСКОЕ ИЗМЕНЕНИЕ: НЕ восстанавливаем кнопку здесь автоматически
                    // Кнопка будет восстановлена только при ошибке или таймауте
                    // При успешном выполнении handleTaskAction установит статус 'completed'
                }
            } else {
                // Для других заданий просто вызываем обработчик
                if (typeof onActionClick === 'function') {
                    onActionClick(task);
                }
            }
        });
        
        // Не показываем кнопку "Выполнить" для заданий типа "play_games", "gift_collection" или "experience" если они не выполнены
        const shouldHideButton = 
            (task.activityType === 'play_games' && task.progress < 100) || 
            (task.inventoryType === 'gift_collection' && task.progress < 100) ||
            (task.verifierType === 'experience' && task.progress < 100);
            
        if (!shouldHideButton) {
            // ИСПРАВЛЕНИЕ: Скрываем кнопку, если показывается таймер И задание НЕ выполнено
            // Для выполненных заданий (прогресс >= 100%) кнопка "Получить" должна быть видна
            // Используем ту же логику, что и для показа таймера
            if (shouldShowTimer && !isTaskCompleted) {
                actionButton.style.display = 'none';
            }
            
            actionContainer.appendChild(actionButton);
        }
    }
    
    headerContainer.appendChild(actionContainer);
    card.appendChild(headerContainer);
    
    // Средняя часть (описание, если есть)
    if (task.description && task.description.trim()) {
        const description = document.createElement('div');
        description.className = 'task-description';
        // Используем локализацию для описания
        const taskKey = task.id.replace(/-/g, '_');
        
        // Подготавливаем параметры для подстановки в перевод
        const placeholders = {
            collectionEmoji: task.collectionEmoji || '',
            requiredCountForDisplay: task.requiredCountForDisplay || '',
            rewardValueForDisplay: task.rewardValueForDisplay || ''
        };
        
        description.textContent = i18n.t(`tasks.task_descriptions.${taskKey}`, { 
            defaultValue: task.description,
            ...placeholders
        });
        
        card.appendChild(description);
    }
    
    // Нижняя часть (награда + прогресс)
    const footerContainer = document.createElement('div');
    footerContainer.className = 'task-footer';
    
    // Блок с наградой
    const rewardContainer = renderReward({
        value: task.reward.value,
        icon: task.reward.icon,
        type: task.reward.type || 'currency'
    });
    footerContainer.appendChild(rewardContainer);
    
    // Добавляем индикатор прогресса, если есть
    if (task.hasOwnProperty('progress')) {
        const progressContainer = document.createElement('div');
        progressContainer.className = 'task-status';
        
        // Добавляем текст с прогрессом
        const progressText = document.createElement('div');
        progressText.className = 'task-progress-text';
        
        // Отображаем количество вместо процентов для заданий типа play_games, gift_collection или experience
        if ((task.activityType === 'play_games' || task.inventoryType === 'gift_collection' || task.verifierType === 'experience') && 
            task.hasOwnProperty('currentCount') && task.hasOwnProperty('requiredCount')) {
            // Если задание выполнено (прогресс 100%), показываем "100%"
            if (task.progress === 100) {
                progressText.textContent = `100%`;
            } else {
                // Иначе показываем формат "X/Y"
                progressText.textContent = `${task.currentCount}/${task.requiredCount}`;
            }
        } else {
            progressText.textContent = `${task.progress}%`;
        }
        
        // Прогресс-бар
        const progress = document.createElement('div');
        progress.className = 'task-progress';
        
        const progressBar = document.createElement('div');
        progressBar.className = 'task-progress-bar';
        progressBar.style.width = `${task.progress}%`;
        
        progress.appendChild(progressBar);
        
        // Изменяем порядок: сначала прогресс-бар, затем текст
        progressContainer.appendChild(progress);
        progressContainer.appendChild(progressText);
        
        footerContainer.appendChild(progressContainer);
    }
    
    card.appendChild(footerContainer);
    
    return card;
}

/**
 * Проверяет, является ли задание срочным (осталось мало времени)
 * @param {string|Date} endTime - Время окончания задания
 * @returns {boolean} - true, если задание срочное
 */
function isUrgent(endTime) {
    if (!endTime) return false;
    
    const end = new Date(endTime);
    const now = new Date();
    
    // Считаем задание срочным, если осталось меньше 6 часов
    const hoursDiff = (end - now) / (1000 * 60 * 60);
    return hoursDiff > 0 && hoursDiff <= 6;
} 