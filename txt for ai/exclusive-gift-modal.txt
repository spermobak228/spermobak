/**
 * Модальное окно для просмотра информации об эксклюзивном подарке
 */

import * as i18n from './i18n.js';

/**
 * Показывает модальное окно с информацией об эксклюзивном подарке
 * @param {Object} gift - Данные о подарке
 */
export function showExclusiveGiftInfoModal(gift) {
    // Создаем модальное окно, если его нет
    let exclusiveGiftModal = document.getElementById('exclusiveGiftInfoModal');
    
    if (!exclusiveGiftModal) {
        exclusiveGiftModal = document.createElement('div');
        exclusiveGiftModal.id = 'exclusiveGiftInfoModal';
        exclusiveGiftModal.className = 'win-modal';
        document.body.appendChild(exclusiveGiftModal);
    }
    
    // Проверяем, является ли подарок эксклюзивным
    const isExclusive = gift.type === 'exclusive' || gift.gift_type === 'exclusive';
    
    // Если подарок не эксклюзивный, просто выходим
    if (!isExclusive) {
        console.error('Подарок не является эксклюзивным');
        return;
    }
    
    // Получаем название подарка
    const giftDisplayName = gift.name || gift.gift_id || i18n.t('gifts.exclusive_gift');
    
    // Получаем путь к анимации
    const animationPath = gift.animation_path || gift.animation;
    
    // Создаем содержимое модального окна
    exclusiveGiftModal.innerHTML = `
        <button class="close-button" id="exclusiveGiftModalClose">✕</button>
        <div class="won-gift" id="exclusiveGiftAnimation"></div>
        <div class="gift-exclusive-message"><strong>${giftDisplayName}</strong></div>
        <div class="exclusive-gift-description">
            ${i18n.t('gifts.exclusive_description', { chance: gift.chance || 0 })}
            <br>
            <br>
            ${i18n.t('gifts.exclusive_tip')}
        </div>
    `;
    
    // Добавляем стили для описания, если их еще нет
    if (!document.getElementById('exclusive-gift-modal-styles')) {
        const styleElement = document.createElement('style');
        styleElement.id = 'exclusive-gift-modal-styles';
        styleElement.textContent = `
            #exclusiveGiftInfoModal {
                padding: 20px;
            }
            .exclusive-gift-description {
                color: var(--tg-theme-text-color, #000000);
                font-size: 14px;
                margin: 0 10px 20px;
                text-align: center;
                line-height: 1.4;
                max-width: 340px;
                width: 100%;
            }
            
            .gift-exclusive-message {
                margin-bottom: 20px;
                text-align: center;
                max-width: 340px;
                width: 100%;
            }
            
            .gift-exclusive-message strong {
                font-size: 18px;
            }
        `;
        document.head.appendChild(styleElement);
    }
    
    // Отображаем модальное окно
    exclusiveGiftModal.classList.add('show');
    
    // Получаем элемент для отображения анимации подарка
    const animationContainer = document.getElementById('exclusiveGiftAnimation');
    
    // Отображаем анимацию подарка, если она доступна
    if (animationPath) {
        // Очищаем контейнер
        animationContainer.innerHTML = '';
        
        if (animationPath.endsWith('.tgs')) {
            try {
                // Проверяем наличие tgs-player
                if (customElements.get('tgs-player')) {
                    // Используем tgs-player для TGS анимаций
                    const tgsPlayer = document.createElement('tgs-player');
                    // Добавляем проверку на наличие префикса '/dev' для режима разработки
                    const isDevMode = window.isDevMode || window.location.pathname.includes('/dev/');
                    const apiPrefix = isDevMode && !animationPath.startsWith('/dev') ? '/dev' : '';
                    tgsPlayer.setAttribute('src', apiPrefix + animationPath);
                    tgsPlayer.setAttribute('autoplay', 'true');
                    animationContainer.appendChild(tgsPlayer);
                } else {
                    // Если tgs-player не доступен, используем эмодзи
                    animationContainer.innerHTML = `<div class="gift-emoji">${gift.emoji || '🎁'}</div>`;
                }
            } catch (e) {
                console.error('Ошибка при загрузке TGS анимации:', e);
                animationContainer.innerHTML = `<div class="gift-emoji">${gift.emoji || '🎁'}</div>`;
            }
        } else if (animationPath.endsWith('.json')) {
            try {
                // Добавляем проверку на наличие lottie
                if (typeof lottie !== 'undefined') {
                    lottie.loadAnimation({
                        container: animationContainer,
                        renderer: 'svg',
                        loop: true,
                        autoplay: true,
                        path: animationPath
                    });
                } else {
                    console.error('Lottie библиотека не загружена');
                    animationContainer.innerHTML = `<div class="gift-emoji">${gift.emoji || '🎁'}</div>`;
                }
            } catch (e) {
                console.error('Ошибка при загрузке JSON анимации:', e);
                animationContainer.innerHTML = `<div class="gift-emoji">${gift.emoji || '🎁'}</div>`;
            }
        } else {
            animationContainer.innerHTML = `<div class="gift-emoji">${gift.emoji || '🎁'}</div>`;
        }
    } else {
        // Если анимации нет, отображаем эмодзи
        animationContainer.innerHTML = `<div class="gift-emoji">${gift.emoji || '🎁'}</div>`;
    }
    
    // Добавляем обработчик для кнопки закрытия
    const closeButton = document.getElementById('exclusiveGiftModalClose');
    if (closeButton) {
        closeButton.addEventListener('click', function() {
            exclusiveGiftModal.classList.remove('show');
        });
    }
} 