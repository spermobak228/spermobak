/**
 * Модуль для проверки подписок на каналы
 * Используется для заданий типа "Подписаться на канал"
 */
import TimerManager from '../utils/TimerManager.js';

/**
 * Проверяет подписку пользователя на канал
 * @param {Object} task - Объект задания для проверки
 * @param {boolean} forceCheck - Игнорировать кэш и делать прямой запрос к API
 * @returns {Promise<boolean>} - Промис с результатом проверки
 */
export async function checkSubscription(task, forceCheck = false) {
    // Получаем данные пользователя из Telegram WebApp
    const telegram = window.Telegram.WebApp;
    const userId = telegram.initDataUnsafe?.user?.id;
    
    if (!userId) {
        console.error('Не удалось получить ID пользователя');
        return false;
    }
    
    try {
        // Формируем URL с учетом режима разработки
        const apiUrl = window.isDevMode ? '/dev/api/tasks/check_subscription' : '/api/tasks/check_subscription';
        
        // Получаем информацию о канале из задания
        const channelUsername = task.subscriptionInfo?.channelUsername || "@GiftGo";
        
        // Подготавливаем заголовки с Telegram initData для авторизации
        const headers = {
            'Content-Type': 'application/json'
        };
        
        // Добавляем initData в заголовки для авторизации
        const initData = telegram.initData;
        if (initData) {
            headers['X-Telegram-Init-Data'] = initData;
        }

        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: headers,
            body: JSON.stringify({
                user_id: userId,
                task_id: task.id,
                channel_id: channelUsername,
                force_check: forceCheck
            })
        });
        
        if (!response.ok) {
            console.error('Ошибка при проверке подписки');
            return false;
        }
        
        const result = await response.json();
        
        if (!result.success) {
            console.error('Ошибка при проверке подписки:', result.error);
            return false;
        }
        
        // Если задание уже выполнено
        if (result.already_completed) {
            return true;
        }
        
        // Если пользователь подписан
        if (result.is_subscribed) {
            console.log('Сервер подтвердил подписку пользователя');
            
            // Проверяем, есть ли уже активный таймер для этого задания
            const existingTimer = TimerManager.checkTimer(task.id);
            
            // Если есть информация о времени ожидания И нет активного таймера
            if (result.wait_until && !existingTimer.isActive) {
                console.log('Устанавливаем таймер для задания подписки');
                
                // Находим карточку задания, если она отображается
                const taskCard = document.querySelector(`.task-card[data-task-id="${task.id}"]`);
                
                // Устанавливаем таймер для задания, используя существующий TimerManager и стили
                TimerManager.setTimer(task.id, result.wait_until, taskCard);
                
                // Добавляем класс has-timer для правильного отображения стилей из task-card.css
                if (taskCard) {
                    taskCard.classList.add('has-timer');
                }
                
                // Возвращаем true, так как пользователь подписан (таймер - это отдельная логика)
                console.log('Пользователь подписан, таймер установлен, возвращаем true');
                return true;
            }
            
            // Если есть активный таймер, проверяем его статус
            if (existingTimer.isActive) {
                console.log('У задания уже есть активный таймер, пользователь подписан');
                // Возвращаем true, так как пользователь подписан (независимо от статуса таймера)
                return true;
            }
            
            // Если нет активного таймера и нет wait_until, значит можно выполнять задание
            console.log('Пользователь подписан, таймера нет, можно выполнять задание');
            return true;
        }
        
        console.log('Пользователь не подписан');
        return false;
    } catch (error) {
        console.error('Ошибка при проверке подписки:', error);
        return false;
    }
}

/**
 * Открывает канал для подписки
 * @param {string} inviteLink - Ссылка для приглашения в канал
 */
export function openChannelForSubscription(inviteLink) {
    const telegram = window.Telegram.WebApp;
    
    console.log('Открываем канал для подписки:', inviteLink);
    
    // Проверяем, доступен ли Telegram WebApp
    if (telegram) {
        try {
            // Сначала пытаемся использовать openTelegramLink для открытия внутри Telegram
            if (telegram.openTelegramLink) {
                console.log('Используем openTelegramLink');
                telegram.openTelegramLink(inviteLink);
                return;
            }
            
            // Если openTelegramLink недоступна, используем openLink
            if (telegram.openLink) {
                console.log('Используем openLink');
                telegram.openLink(inviteLink);
                return;
            }
        } catch (error) {
            console.error('Ошибка при открытии ссылки через Telegram WebApp:', error);
        }
    }
    
    // Запасной вариант - прямое создание ссылки с telegram://
    // Преобразуем https://t.me/ в telegram:// для прямого открытия в Telegram
    if (inviteLink.startsWith('https://t.me/')) {
        let telegramLink;
        
        // Обрабатываем invite ссылки с +
        if (inviteLink.includes('/+')) {
            // Для invite ссылок вида https://t.me/+XXXXX
            const inviteHash = inviteLink.split('/+')[1];
            telegramLink = `telegram://join?invite=${inviteHash}`;
        } else {
            // Для обычных ссылок на каналы/группы
            const channelName = inviteLink.replace('https://t.me/', '');
            telegramLink = `telegram://resolve?domain=${channelName}`;
        }
        
        console.log('Пытаемся открыть telegram:// ссылку:', telegramLink);
        
        try {
            window.location.href = telegramLink;
            return;
        } catch (error) {
            console.error('Ошибка при открытии telegram:// ссылки:', error);
        }
    }
    
    // Финальный запасной вариант - открываем в текущем окне
    console.log('Используем запасной вариант - открытие в текущем окне');
    window.location.href = inviteLink;
} 