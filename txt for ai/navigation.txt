/**
 * Модуль для работы с навигацией приложения
 * Содержит функции для перехода между страницами и обработки навигационных действий
 */

import * as notifications from './notifications.js';
import * as i18n from './i18n.js';

/**
 * Настраивает нижнюю панель навигации
 * @param {NodeList|string} navItems - Элементы навигации или селектор для их получения
 * @param {Object} handlers - Объект с обработчиками для каждого типа страницы
 */
export function setupNavigation(navItems, handlers = {}) {
    // Получаем DOM-элементы навигации
    if (typeof navItems === 'string') {
        navItems = document.querySelectorAll(navItems);
    }
    
    if (!navItems || !navItems.length) return;
    
    // Получаем префикс URL в зависимости от режима разработки
    const devPrefix = typeof window.isDevMode !== 'undefined' && window.isDevMode ? '/dev' : '';
    
    // Выводим сообщение в консоль для отладки
    console.log('Navigation setup with devMode:', window.isDevMode, 'using prefix:', devPrefix);
    
    // Функция для получения ключа перевода из элемента навигации
    function getNavKey(navItem) {
        // Сначала проверяем атрибут на самом .nav-text
        let navText = navItem.querySelector('.nav-text')?.getAttribute('data-i18n');
        
        // Если атрибута нет на .nav-text, ищем его внутри span в .nav-text
        if (!navText) {
            navText = navItem.querySelector('.nav-text span')?.getAttribute('data-i18n');
        }
        
        return navText || '';
    }
    
    // Добавляем обработчики событий на элементы навигации
    navItems.forEach(item => {
        // Пропускаем активный элемент, так как мы уже на этой странице
        if (item.classList.contains('active')) return;
        
        item.addEventListener('click', function() {
            // Получаем ключ перевода для элемента
            const navKey = getNavKey(this);
            
            // Выполняем соответствующее действие в зависимости от ключа перевода
            switch (navKey) {
                case 'common.play':
                    if (typeof handlers.play === 'function') {
                        handlers.play();
                    } else {
                        window.location.href = `${devPrefix}/`;
                    }
                    break;
                
                case 'common.profile':
                    if (typeof handlers.profile === 'function') {
                        handlers.profile();
                    } else {
                        window.location.href = `${devPrefix}/profile`;
                    }
                    break;
                
                case 'common.leaderboard':
                    if (typeof handlers.leaderboard === 'function') {
                        handlers.leaderboard();
                    } else {
                        // Используем правильный URL с префиксом для режима разработки
                        window.location.href = `${devPrefix}/leaderboard`;
                    }
                    break;
                
                case 'common.tasks':
                    if (typeof handlers.tasks === 'function') {
                        handlers.tasks();
                    } else {
                        window.location.href = `${devPrefix}/tasks`;
                    }
                    break;
                
                case 'common.giveaways':
                    if (typeof handlers.giveaways === 'function') {
                        handlers.giveaways();
                    } else {
                        // Показываем уведомление о скором появлении розыгрышей
                        notifications.showInfo('giveaways.coming_soon', { useTranslation: true });
                    }
                    break;
                
                default:
                    console.warn(`Неизвестный элемент навигации: ${navKey}`);
            }
        });
    });
} 