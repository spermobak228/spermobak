/**
 * Модуль для работы с модальными окнами
 * Содержит функции для отображения и управления модальными окнами
 */

import { formatNumber, formatGiftPrice } from './ui-utils.js';
import { showSuccess, showError, showWarning, showInfo, setModalState } from './notifications.js';
import { animateGiftToProfile } from './animations.js';
import * as i18n from './i18n.js';

// Экспортируем функции из отдельных модулей
export { showWinModal, closeWinModal, initWinModalHandlers } from './win-gift-modal.js';
export { createGiftModal, showGiftModal } from './preview-gift-modal.js';
export { createTopUpModal, showTopUpModal } from './top-up-modal.js';
export { showExclusiveGiftInfoModal } from './exclusive-gift-modal.js';

// Алиас для обратной совместимости
import { initWinModalHandlers } from './win-gift-modal.js';
export const initModalHandlers = initWinModalHandlers;

/**
 * Показывает диалог подтверждения 
 * @param {Object} options - Опции для диалога
 * @param {string} options.title - Заголовок диалога
 * @param {string} options.message - Сообщение диалога
 * @param {string} options.confirmText - Текст кнопки подтверждения
 * @param {string} options.cancelText - Текст кнопки отмены
 * @param {string} options.sellText - Текст кнопки продажи (опционально)
 * @param {Function} options.onConfirm - Функция, вызываемая при подтверждении
 * @param {Function} options.onCancel - Функция, вызываемая при отмене
 * @param {Function} options.onSell - Функция, вызываемая при продаже (опционально)
 * @returns {HTMLElement} - Созданный диалог
 */
export function showConfirmationDialog(options) {
    // Уведомляем модуль notifications, что открывается модальное окно
    setModalState(true);
    
    const {
        title = i18n.t('common.confirm'),
        message = i18n.t('common.are_you_sure'),
        confirmText = i18n.t('common.confirm'),
        cancelText = i18n.t('common.cancel'),
        sellText = null,
        onConfirm,
        onCancel,
        onSell,
        hideTitle = false
    } = options;
    
    console.log('Создаем диалог подтверждения:', {title, confirmText, cancelText, sellText});
    
    // Проверяем, существует ли уже диалог
    let confirmDialog = document.getElementById('giftConfirmDialog');
    if (confirmDialog) {
        // Если диалог уже существует, удаляем его
        console.log('Найден существующий диалог, удаляем');
        confirmDialog.remove();
    }
    
    // Создаем новый диалог
    confirmDialog = document.createElement('div');
    confirmDialog.id = 'giftConfirmDialog';
    confirmDialog.className = 'win-modal confirmation-dialog';
    
    // Определяем HTML для кнопок в зависимости от наличия sellText
    let buttonsHtml = '';
    
    if (sellText) {
        // Если есть кнопка продажи - организуем кнопки через grid как в основном окне
        buttonsHtml = `
            <div class="win-actions confirmation-actions">
                <button class="action-button confirm-button">${confirmText}</button>
                <button class="action-button cancel-button">${cancelText}</button>
                <button class="action-button sell-button">${sellText}</button>
            </div>
        `;
    } else {
        // Стандартный вариант с двумя кнопками
        buttonsHtml = `
            <div class="win-actions confirmation-actions">
                <button class="action-button confirm-button">${confirmText}</button>
                <button class="action-button cancel-button">${cancelText}</button>
            </div>
        `;
    }
    
    // Создаем содержимое диалога
    confirmDialog.innerHTML = `
        ${!hideTitle ? `<h2>${title}</h2>` : ''}
        <p class="confirmation-message">${message}</p>
        ${buttonsHtml}
    `;
    
    // Добавляем стили для confirmation-dialog если их нет
    if (!document.getElementById('confirmation-dialog-styles')) {
        console.log('Добавляем стили для диалога подтверждения');
        const styleElement = document.createElement('style');
        styleElement.id = 'confirmation-dialog-styles';
        styleElement.textContent = `
            .confirmation-dialog {
                padding: 20px;
                text-align: center;
            }
            .confirmation-dialog .confirmation-message {
                margin-bottom: 20px;
                line-height: 1.5;
                color: var(--tg-theme-text-color, #000000);
                text-align: center;
                max-width: 340px;
                width: 100%;
            }
            .confirmation-actions {
                display: grid;
                grid-template-columns: 1fr 1fr;
                gap: 10px;
                width: 100%;
                max-width: 340px;
                justify-content: center;
                align-items: center;
                margin: 0 auto;
            }
            .confirmation-actions .action-button {
                background-color: var(--tg-theme-button-color, #2196F3);
                color: var(--tg-theme-button-text-color, white);
                border: none;
                border-radius: 10px;
                padding: 12px 20px;
                font-size: 16px;
                font-weight: 500;
                cursor: pointer;
                transition: opacity 0.2s ease;
                height: calc(12px + 12px + 16px);
                display: flex;
                align-items: center;
                justify-content: center;
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
                margin: 0 auto;
            }
            .confirmation-actions .action-button:active {
                opacity: 0.8;
            }
            .confirmation-actions .sell-button {
                grid-column: 1 / -1;
                height: calc(2 * (12px + 12px + 16px));
                font-size: 18px;
                font-weight: 600;
                margin-top: 0;
                margin-bottom: 0;
                margin-left: auto;
                margin-right: auto;
                width: 100%;
                justify-self: center;
            }
        `;
        document.head.appendChild(styleElement);
    }
    
    // Добавляем диалог на страницу
    document.body.appendChild(confirmDialog);
    
    // Получаем ссылки на кнопки
    const confirmButton = confirmDialog.querySelector('.confirm-button');
    const cancelButton = confirmDialog.querySelector('.cancel-button');
    const sellButton = confirmDialog.querySelector('.sell-button');
    
    console.log('Найдены кнопки в диалоге:', {confirmButton, cancelButton, sellButton});
    
    // Функция для закрытия диалога с уведомлением модуля notifications
    const closeDialog = () => {
        confirmDialog.classList.remove('show');
        
        // Уведомляем модуль notifications, что модальное окно закрылось
        setModalState(false);
        
        setTimeout(() => {
            confirmDialog.remove();
        }, 300);
    };
    
    // Добавляем обработчики событий
    if (confirmButton) {
        confirmButton.addEventListener('click', function() {
            console.log('Нажата кнопка подтверждения');
            if (typeof onConfirm === 'function') {
                onConfirm();
            }
            closeDialog();
        });
    }
    
    if (cancelButton) {
        cancelButton.addEventListener('click', function() {
            console.log('Нажата кнопка отмены');
            if (typeof onCancel === 'function') {
                onCancel();
            }
            closeDialog();
        });
    }
    
    if (sellButton && typeof onSell === 'function') {
        sellButton.addEventListener('click', function() {
            console.log('Нажата кнопка продажи');
            onSell();
            closeDialog();
        });
    }
    
    // Показываем диалог
    confirmDialog.classList.add('show');
    
    return confirmDialog;
} 