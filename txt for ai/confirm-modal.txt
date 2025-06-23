/**
 * Модуль для отображения кастомных диалогов подтверждения
 * Позволяет отображать HTML-контент в диалогах подтверждения, включая SVG иконки
 */

import { setModalState } from './notifications.js';
import * as i18n from './i18n.js';

/**
 * Показывает диалог подтверждения с кастомным HTML-контентом
 * @param {Object} options - Опции для диалога
 * @param {string} options.title - Заголовок диалога
 * @param {string} options.message - Сообщение диалога (может содержать HTML)
 * @param {string} options.confirmText - Текст кнопки подтверждения
 * @param {string} options.cancelText - Текст кнопки отмены
 * @param {string} options.sellText - Текст кнопки продажи (опционально)
 * @param {Function} options.onConfirm - Функция, вызываемая при подтверждении
 * @param {Function} options.onCancel - Функция, вызываемая при отмене
 * @param {Function} options.onSell - Функция, вызываемая при продаже (опционально)
 * @param {boolean} options.hideTitle - Флаг для скрытия заголовка
 * @param {boolean} options.simpleLayout - Флаг для использования упрощенного макета кнопок (OK справа, Отмена слева)
 * @param {boolean} options.reverseButtons - Флаг для обратного порядка кнопок (OK слева, Отмена справа)
 * @param {Object} options.topUpOptions - Опции для слайдера пополнения баланса (опционально)
 * @param {number} options.topUpOptions.missingAmount - Недостающая сумма
 * @param {Function} options.topUpOptions.onAmountSelect - Функция обратного вызова при выборе суммы
 * @returns {HTMLElement} - Созданный диалог
 */
export function showConfirmDialog(options) {
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
        hideTitle = false,
        simpleLayout = false,
        reverseButtons = false,
        topUpOptions = null
    } = options;
    
    console.log('Создаем диалог подтверждения:', {title, confirmText, cancelText, sellText});
    
    // Проверяем, существует ли уже диалог
    let confirmDialog = document.getElementById('confirmDialog');
    if (confirmDialog) {
        // Если диалог уже существует, удаляем его
        console.log('Найден существующий диалог, удаляем');
        confirmDialog.remove();
    }
    
    // Создаем новый диалог
    confirmDialog = document.createElement('div');
    confirmDialog.id = 'confirmDialog';
    confirmDialog.className = 'confirm-modal';
    
    // Определяем HTML для кнопок в зависимости от наличия sellText и simpleLayout
    let buttonsHtml = '';
    
    if (sellText) {
        // Если есть кнопка продажи - организуем кнопки через grid как в основном окне
        buttonsHtml = `
            <div class="confirm-actions">
                <button class="confirm-button action-button">${confirmText}</button>
                <button class="cancel-button action-button">${cancelText}</button>
                <button class="sell-button action-button">${sellText}</button>
            </div>
        `;
    } else if (simpleLayout) {
        // Простой макет с кнопками в ряд
        if (reverseButtons) {
            // Обратный порядок (OK слева, Отмена справа)
            buttonsHtml = `
                <div class="confirm-actions simple-layout">
                    <button class="confirm-button action-button dark">OK</button>
                    <button class="cancel-button action-button">${cancelText}</button>
                </div>
            `;
        } else {
            // Стандартный порядок (Отмена слева, OK справа)
            buttonsHtml = `
                <div class="confirm-actions simple-layout">
                    <button class="cancel-button action-button dark">${cancelText}</button>
                    <button class="confirm-button action-button">OK</button>
                </div>
            `;
        }
    } else {
        // Стандартный вариант с двумя кнопками в сетке
        buttonsHtml = `
            <div class="confirm-actions">
                <button class="confirm-button action-button">${confirmText}</button>
                <button class="cancel-button action-button">${cancelText}</button>
            </div>
        `;
    }
    
    // Создаем HTML для слайдера пополнения баланса, если он нужен
    let topUpSliderHtml = '';
    if (topUpOptions) {
        topUpSliderHtml = createTopUpSliderHtml(topUpOptions.missingAmount);
    }
    
    // Создаем содержимое диалога
    confirmDialog.innerHTML = `
        <div class="confirm-modal-content">
            ${!hideTitle ? `<h2>${title}</h2>` : ''}
            <p class="confirm-message">${message}</p>
            ${topUpSliderHtml}
            ${buttonsHtml}
        </div>
    `;
    
    // Добавляем стили для confirm-dialog если их нет
    if (!document.getElementById('confirm-dialog-styles')) {
        console.log('Добавляем стили для диалога подтверждения');
        const styleElement = document.createElement('style');
        styleElement.id = 'confirm-dialog-styles';
        styleElement.textContent = `
            .confirm-modal {
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background-color: rgba(0, 0, 0, 0.7);
                display: flex;
                align-items: center;
                justify-content: center;
                z-index: 1000;
                opacity: 0;
                transition: opacity 0.3s ease;
                backdrop-filter: blur(5px);
            }
            
            .confirm-modal.show {
                opacity: 1;
            }
            
            .confirm-modal-content {
                width: 90%;
                max-width: 340px;
                background-color: var(--tg-theme-bg-color, #ffffff);
                border-radius: 16px;
                padding: 20px;
                box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
                text-align: center;
                transform: scale(0.9);
                transition: transform 0.3s ease;
            }
            
            .confirm-modal.show .confirm-modal-content {
                transform: scale(1);
            }
            
            .confirm-modal h2 {
                margin-top: 0;
                margin-bottom: 16px;
                font-size: 20px;
                font-weight: 600;
                color: var(--tg-theme-text-color, #000000);
            }
            
            .confirm-message {
                margin-bottom: 20px;
                line-height: 1.5;
                color: var(--tg-theme-text-color, #000000);
                font-size: 16px;
            }
            
            .confirm-actions {
                display: grid;
                grid-template-columns: 1fr 1fr;
                gap: 10px;
                width: 100%;
                justify-content: center;
                align-items: center;
                margin: 0 auto;
            }
            
            /* Простой макет для кнопок в ряд */
            .confirm-actions.simple-layout {
                display: flex;
                flex-direction: row;
                justify-content: space-between;
                grid-template-columns: none;
            }
            
            .confirm-actions .action-button {
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
                width: 100%;
            }
            
            /* Темная кнопка для кнопки отмены */
            .confirm-actions .action-button.dark {
                background-color: var(--tg-theme-secondary-bg-color, #313131);
                color: var(--tg-theme-text-color, white);
            }
            
            .confirm-actions .action-button:active {
                opacity: 0.8;
            }
            
            .confirm-actions .sell-button {
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
            
            /* Стили для SVG иконки кристалла */
            .confirm-modal .crystal-icon,
            .crystal-icon.confirm-modal-crystal {
                width: 16px;
                height: 16px;
                fill: var(--tg-theme-button-text-color, white);
                margin-left: 0px;
                vertical-align: middle;
                display: inline-flex;
                align-items: center;
                position: relative;
                top: -1px; /* Тонкая настройка вертикального выравнивания */
            }
            
            /* Стили для иконки кристалла в тексте (не в кнопке) */
            .confirm-modal .crystal-icon.in-text,
            .crystal-icon.in-text.confirm-modal-crystal {
                fill: var(--tg-theme-text-color, black);
                width: 14px;
                height: 14px;
                vertical-align: baseline;
                position: relative;
                top: 2px; /* Корректировка вертикального положения для базовой линии */
            }
            
            /* Стили для слайдера пополнения баланса */
            .topup-slider-container {
                width: 100%;
                margin: 0 0 20px 0;
                overflow-x: auto;
                -webkit-overflow-scrolling: touch;
                scrollbar-width: none; /* Firefox */
                -ms-overflow-style: none; /* IE and Edge */
            }
            
            .topup-slider-container::-webkit-scrollbar {
                display: none; /* Chrome, Safari, Opera */
            }
            
            .topup-slider {
                display: flex;
                gap: 8px;
                padding: 4px 2px;
                min-width: 100%;
                width: max-content;
                margin: 0 auto;
            }
            
            .topup-option {
                flex: 0 0 auto;
                min-width: 70px;
                padding: 10px 12px;
                background-color: var(--tg-theme-secondary-bg-color, #f1f1f1);
                border-radius: 12px;
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                cursor: pointer;
                border: 2px solid transparent;
                transition: all 0.2s ease;
                position: relative;
                overflow: hidden;
            }
            
            .topup-option.selected {
                border-color: var(--tg-theme-button-color, #2196F3);
                background-color: rgba(var(--tg-theme-button-color-rgb, 33, 150, 243), 0.1);
            }
            
            .topup-option:active {
                transform: scale(0.95);
            }
            
            .topup-option-value {
                font-weight: 600;
                font-size: 14px;
                color: var(--tg-theme-text-color, #000000);
                display: flex;
                align-items: baseline;
                justify-content: center;
            }
            
            .confirm-modal .topup-option-value .crystal-icon.in-text,
            .topup-option-value .crystal-icon.in-text.confirm-modal-crystal {
                margin-left: 4px;
                position: relative;
                top: 2px; /* Корректировка вертикального положения для выравнивания с текстом */
                vertical-align: baseline;
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
            
            // Проверяем, есть ли еще открытые диалоги
            const openDialogs = document.querySelectorAll('.confirm-modal');
            if (openDialogs.length === 0) {
                // Если открытых диалогов нет, можно удалить стили
                const styleElement = document.getElementById('confirm-dialog-styles');
                if (styleElement && !document.querySelector('.confirm-modal')) {
                    styleElement.remove();
                }
            }
        }, 300);
    };
    
    // Добавляем обработчики для опций пополнения баланса, если они есть
    if (topUpOptions) {
        // Создаем переменную для хранения выбранной суммы в родительской области видимости
        let selectedAmount = topUpOptions.missingAmount;
        
        const topupOptions = confirmDialog.querySelectorAll('.topup-option');
        topupOptions.forEach(option => {
            option.addEventListener('click', function() {
                // Убираем класс selected у всех опций
                topupOptions.forEach(opt => opt.classList.remove('selected'));
                // Добавляем класс selected текущей опции
                this.classList.add('selected');
                
                // Получаем выбранную сумму и сохраняем ее
                selectedAmount = parseInt(this.dataset.amount);
                console.log('Выбрана сумма пополнения:', selectedAmount);
                
                // Создаем новую функцию onConfirm, которая будет использовать выбранную сумму
                if (typeof topUpOptions.onAmountSelect === 'function') {
                    // Убираем переопределение options.onConfirm здесь, т.к. теперь это будет делаться
                    // непосредственно при клике на кнопку подтверждения
                }
            });
        });
        
        // Выбираем опцию с недостающей суммой по умолчанию
        const defaultOption = confirmDialog.querySelector(`.topup-option[data-amount="${topUpOptions.missingAmount}"]`);
        if (defaultOption) {
            defaultOption.click();
        } else {
            // Если не нашли опцию с недостающей суммой, выбираем первую
            const firstOption = confirmDialog.querySelector('.topup-option');
            if (firstOption) {
                firstOption.click();
            }
        }
        
        // Переопределяем обработчик кнопки подтверждения для слайдера
        if (confirmButton) {
            confirmButton.addEventListener('click', function() {
                console.log('Нажата кнопка подтверждения с выбранной суммой:', selectedAmount);
                if (typeof topUpOptions.onAmountSelect === 'function') {
                    // Используем функцию выбора суммы с текущей выбранной суммой
                    topUpOptions.onAmountSelect(selectedAmount);
                }
                closeDialog();
            });
        }
    } else {
        // Стандартное поведение для диалогов без слайдера
        if (confirmButton) {
            confirmButton.addEventListener('click', function() {
                console.log('Нажата кнопка подтверждения');
                if (typeof onConfirm === 'function') {
                    onConfirm();
                }
                closeDialog();
            });
        }
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
    
    // Показываем диалог после небольшой задержки для анимации
    setTimeout(() => {
        confirmDialog.classList.add('show');
    }, 10);
    
    return confirmDialog;
}

/**
 * Создает HTML для слайдера с опциями пополнения баланса
 * @param {number} missingAmount - Недостающая сумма кристаллов
 * @returns {string} HTML-строка слайдера
 */
function createTopUpSliderHtml(missingAmount) {
    // Доступные суммы пополнения
    const amounts = [25, 50, 100, 250, 500, 1000, 2500, 5000, 10000];
    
    // Отфильтруем суммы, которые меньше недостающей
    const filteredAmounts = amounts.filter(amount => amount >= missingAmount);
    
    // Если недостающая сумма не входит в стандартный набор,
    // добавляем ее в начало списка
    if (!amounts.includes(missingAmount) && missingAmount > 0) {
        filteredAmounts.unshift(missingAmount);
    }
    
    // Сортируем суммы по возрастанию
    const sortedAmounts = [...new Set(filteredAmounts)].sort((a, b) => a - b);
    
    // Функция для форматирования числа с разделением тысяч
    const formatAmount = (amount) => {
        return amount.toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ");
    };
    
    // Создаем HTML для каждой опции
    let optionsHtml = '';
    sortedAmounts.forEach(amount => {
        const isSelected = amount === missingAmount;
        const formattedAmount = formatAmount(amount);
        
        optionsHtml += `
            <div class="topup-option ${isSelected ? 'selected' : ''}" data-amount="${amount}">
                <div class="topup-option-value">${formattedAmount}<svg class="crystal-icon in-text confirm-modal-crystal"><use xlink:href="#crystal-icon"></use></svg></div>
            </div>
        `;
    });
    
    // Возвращаем HTML-контейнер со слайдером
    return `
        <div class="topup-slider-container">
            <div class="topup-slider">
                ${optionsHtml}
            </div>
        </div>
    `;
}

/**
 * Создает текст для кнопки продажи с иконкой кристалла
 * @param {string} baseText - Базовый текст
 * @param {number} amount - Сумма
 * @returns {string} HTML-строка с текстом и иконкой
 */
export function createSellButtonText(baseText, amount) {
    return `${baseText} ${amount}<svg class="crystal-icon confirm-modal-crystal"><use xlink:href="#crystal-icon"></use></svg>`;
}

/**
 * Заменяет в тексте слово "crystal" на SVG-иконку кристалла
 * @param {string} text - Исходный текст
 * @returns {string} Текст с заменой слова "crystal" на SVG-иконку
 */
export function replaceCrystalWithIcon(text) {
    const crystalIcon = '<svg class="crystal-icon crystal-icon--small crystal-icon--inline confirm-modal-crystal"><use xlink:href="#crystal-icon"></use></svg>';
    return text.replace(/crystal/g, crystalIcon);
} 