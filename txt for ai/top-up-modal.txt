/**
 * Модуль для работы с модальным окном пополнения баланса
 * Содержит функции для отображения и управления модальным окном пополнения
 */

import { formatNumber } from './ui-utils.js';
import * as i18n from './i18n.js';

/**
 * Создает модальное окно для пополнения баланса
 * @param {Function} buyStarsCallback - Функция обратного вызова для покупки звезд
 * @returns {HTMLElement} - DOM элемент модального окна
 */
export function createTopUpModal(buyStarsCallback) {
    // Проверяем, существует ли уже модальное окно
    let topUpModal = document.getElementById('topUpModal');
    if (topUpModal) {
        return topUpModal;
    }
    
    // Создаем элементы модального окна
    topUpModal = document.createElement('div');
    topUpModal.className = 'win-modal';
    topUpModal.id = 'topUpModal';
    
    // Массив опций пополнения
    const topUpAmounts = [
        { stars: 25, coins: 25 },
        { stars: 50, coins: 50 },
        { stars: 100, coins: 100 },
        { stars: 250, coins: 250 },
        { stars: 500, coins: 500 },
        { stars: 1000, coins: 1000 },
        { stars: 2500, coins: 2500 },
        { stars: 10000, coins: 10000 }
    ];
    
    // Создаем список опций
    let optionsHtml = '';
    topUpAmounts.forEach(option => {
        optionsHtml += `
            <div class="top-up-option" data-stars="${option.stars}" data-coins="${option.coins}">
                <div class="stars-option">
                    <span class="stars-icon">⭐</span>
                    <span>${option.stars} ${i18n.t('profile_page.stars')}</span>
                </div>
                <div class="coins-value">
                    <span>${option.coins}</span>
                    <span class="coins-icon"><svg class="crystal-icon"><use xlink:href="#crystal-icon"></use></svg></span>
                </div>
            </div>
        `;
    });
    
    topUpModal.innerHTML = `
        <div class="modal-content">
            <button class="close-button" id="topUpModalClose">✕</button>
            <h2>${i18n.t('profile_page.add_balance')}</h2>
            <p>${i18n.t('profile_page.select_amount')}</p>
            
            <div class="top-up-animation">
                <tgs-player src="/static/animations/5170521118301225164.tgs" 
                            autoplay 
                            style="width: 150px; height: 150px;" 
                            renderer="svg">
                </tgs-player>
            </div>
            
            <div class="top-up-options">
                ${optionsHtml}
            </div>
            
            <div class="terms-text">
                ${i18n.t('profile_page.terms_text')} <a href="https://telegram.org/tos/stars" target="_blank">${i18n.t('profile_page.terms_link')}</a>. ${i18n.t('profile_page.no_refund')}
            </div>
        </div>
    `;
    
    // Добавляем стили для модального окна пополнения баланса, если их еще нет
    if (!document.getElementById('top-up-modal-styles')) {
        const styleElement = document.createElement('style');
        styleElement.id = 'top-up-modal-styles';
        styleElement.textContent = `
            #topUpModal {
                padding: 20px;
                overflow-y: auto;
                max-height: 100vh;
            }
            #topUpModal p {
                margin: 10px 0 15px;
                text-align: center;
                color: var(--tg-theme-text-color);
                max-width: 340px;
                width: 100%;
            }
            .top-up-options {
                display: flex;
                flex-direction: column;
                gap: 8px;
                margin: 10px 0;
                max-width: 340px;
                width: 100%;
            }
            .terms-text {
                font-size: 12px;
                color: var(--tg-theme-hint-color);
                margin: 15px 0 5px;
                line-height: 1.4;
                text-align: center;
                max-width: 340px;
                width: 100%;
                padding-bottom: 10px;
            }
            .top-up-option {
                width: 100%;
            }
            @media (max-height: 600px) {
                .top-up-animation {
                    width: 80px;
                    height: 80px;
                }
            }
        `;
        document.head.appendChild(styleElement);
    }
    
    // Добавляем модальное окно на страницу
    document.body.appendChild(topUpModal);
    
    // Добавляем обработчики событий для кнопок
    const topUpModalClose = document.getElementById('topUpModalClose');
    
    topUpModalClose.addEventListener('click', function() {
        topUpModal.classList.remove('show');
    });
    
    // Добавляем обработчик для опций пополнения
    const optionElements = document.querySelectorAll('.top-up-option');
    optionElements.forEach(option => {
        option.addEventListener('click', function() {
            const stars = parseInt(this.dataset.stars);
            
            // Показываем индикатор загрузки на этой опции
            const originalContent = this.innerHTML;
            this.innerHTML = `<div class="loading-spinner-small"></div>`;
            this.classList.add('loading');
            
            // Отключаем все опции чтобы предотвратить многократные клики
            optionElements.forEach(el => {
                el.style.pointerEvents = 'none';
                if (el !== this) {
                    el.style.opacity = '0.5';
                }
            });
            
            // Не закрываем модальное окно при выборе суммы
            if (typeof buyStarsCallback === 'function') {
                // Вызываем колбэк с параметрами: сумма и функция для сброса состояния кнопки
                buyStarsCallback(stars, (success) => {
                    // Сбрасываем состояние кнопки после завершения
                    this.innerHTML = originalContent;
                    this.classList.remove('loading');
                    
                    // Возвращаем интерактивность всем опциям
                    optionElements.forEach(el => {
                        el.style.pointerEvents = '';
                        el.style.opacity = '';
                    });
                    
                    // Если операция успешна, закрываем модальное окно
                    if (success) {
                        topUpModal.classList.remove('show');
                    }
                });
            }
        });
    });
    
    return topUpModal;
}

/**
 * Показывает модальное окно для пополнения баланса
 * @param {Function} buyStarsCallback - Функция обратного вызова для покупки звезд
 */
export function showTopUpModal(buyStarsCallback) {
    // Создаем модальное окно, если его еще нет
    const topUpModal = createTopUpModal(buyStarsCallback);
    
    // Показываем модальное окно
    topUpModal.classList.add('show');
}
