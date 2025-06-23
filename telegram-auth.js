/**
 * Модуль для проверки авторизации Telegram WebApp на клиентской стороне
 * Обеспечивает мгновенное перенаправление на страницу ошибки авторизации
 * если пользователь не находится в среде Telegram WebApp
 */

/**
 * Получает текущий префикс для URL (dev или production)
 * @returns {string} префикс URL
 */
function getCurrentUrlPrefix() {
    return window.isDevMode ? '/dev' : '';
}

/**
 * Отправляет лог авторизации на сервер для записи в debug.log
 * @param {string} level - уровень лога (WARNING, ERROR, INFO)
 * @param {string} message - сообщение
 * @param {Object} context - дополнительная информация
 */
async function sendAuthLog(level, message, context = {}) {
    try {
        const prefix = getCurrentUrlPrefix();
        
        const logData = {
            level: level,
            message: message,
            context: {
                page: window.location.pathname,
                userAgent: navigator.userAgent,
                timestamp: new Date().toISOString(),
                ...context
            }
        };

        // Отправляем лог на сервер (без ожидания ответа, чтобы не блокировать UI)
        fetch(`${prefix}/api/auth_log`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(logData)
        }).catch(error => {
            // Игнорируем ошибки отправки логов, чтобы не создавать бесконечные циклы
            console.debug('Failed to send auth log:', error);
        });
    } catch (error) {
        // Безопасное игнорирование ошибок логирования
        console.debug('Auth logging error:', error);
    }
}

/**
 * Проверяет доступность Telegram WebApp API
 * @returns {boolean} true если Telegram WebApp доступен
 */
export function isTelegramWebAppAvailable() {
    return !!(window.Telegram?.WebApp?.initData);
}

/**
 * Проверяет, находимся ли мы в среде Telegram WebApp
 * @returns {boolean} true если находимся в Telegram WebApp
 */
export function isInTelegramWebApp() {
    // Строгая проверка наличия настоящего Telegram WebApp
    if (typeof window.Telegram === 'undefined' || 
        window.Telegram === null ||
        typeof window.Telegram.WebApp === 'undefined' ||
        window.Telegram.WebApp === null ||
        typeof window.Telegram.WebApp.ready !== 'function') {
        return false;
    }
    
    // КЛЮЧЕВАЯ ПРОВЕРКА: если скрипт загружен, но мы НЕ в Telegram,
    // то initData будет пустыми, а version будет "7.0" (mock)
    const initData = window.Telegram.WebApp.initData;
    if (!initData || initData.length === 0) {
        return false;
    }
    
    // Дополнительная проверка: в обычном браузере WebApp.version может быть mock
    // В реальном Telegram будет конкретная версия с initData
    const version = window.Telegram.WebApp.version;
    if (!version || version === "7.0") {
        // Проверяем, есть ли реальные данные
        if (!initData || initData.length < 50) {
            return false;
        }
    }
    
    // Проверяем наличие данных пользователя
    const user = window.Telegram.WebApp.initDataUnsafe?.user;
    if (!user || !user.id) {
        return false;
    }
    
    return true;
}

/**
 * Перенаправляет пользователя на страницу ошибки авторизации
 */
export function redirectToAuthError() {
    const prefix = getCurrentUrlPrefix();
    console.warn('🚨 Перенаправление на страницу ошибки авторизации: пользователь не в Telegram WebApp');
    window.location.href = `${prefix}/auth_error`;
}

/**
 * Выполняет немедленную проверку авторизации Telegram WebApp
 * Если проверка не прошла, перенаправляет на страницу ошибки
 * 
 * @param {boolean} showLogs - показывать ли логи в консоли (по умолчанию false)
 */
export function enforceInstanceTelegramAuth(showLogs = false) {
    // Проверяем наличие скрипта Telegram WebApp
    const telegramScriptLoaded = typeof window.Telegram !== 'undefined' && window.Telegram !== null;
    const webAppObjectExists = telegramScriptLoaded && typeof window.Telegram.WebApp !== 'undefined' && window.Telegram.WebApp !== null;
    const hasWebAppMethods = webAppObjectExists && typeof window.Telegram.WebApp.ready === 'function';
    
    // Получаем данные для анализа
    const initDataLength = (webAppObjectExists && window.Telegram.WebApp.initData) ? window.Telegram.WebApp.initData.length : 0;
    const userId = (webAppObjectExists && window.Telegram.WebApp.initDataUnsafe?.user) ? window.Telegram.WebApp.initDataUnsafe.user.id : undefined;
    const webAppVersion = webAppObjectExists ? window.Telegram.WebApp.version : undefined;
    
    // ПРАВИЛЬНОЕ определение среды:
    // Если скрипт загружен НО initData пустые = обычный браузер с загруженным скриптом
    const isRealTelegram = hasWebAppMethods && initDataLength > 0;
    
    const telegramAvailable = isRealTelegram;
    const webAppAvailable = isRealTelegram;
    const inTelegramWebApp = isInTelegramWebApp();
    
    if (showLogs) {
        console.log('=== ПРОВЕРКА TELEGRAM WEBAPP ===');
        console.log('Telegram доступен:', telegramAvailable);
        console.log('WebApp доступен:', webAppAvailable);
        console.log('initData длина:', initDataLength);
        console.log('User ID:', userId);
        console.log('В Telegram WebApp:', inTelegramWebApp);
        console.log('================================');
    }
    
    // Строгая проверка - приложение работает ТОЛЬКО в Telegram WebApp
    if (!inTelegramWebApp) {
        // Определяем тип проблемы для логирования
        let logLevel = 'WARNING';
        let logMessage = '';
        let logContext = {
            telegram_available: telegramAvailable,
            webapp_available: webAppAvailable,
            initdata_length: initDataLength,
            user_id: userId,
            // Debug информация для диагностики
            debug_script_loaded: telegramScriptLoaded,
            debug_webapp_object_exists: webAppObjectExists,
            debug_has_methods: hasWebAppMethods,
            debug_is_real_telegram: isRealTelegram,
            debug_webapp_version: webAppVersion,
            debug_telegram_type: typeof window.Telegram,
            debug_webapp_type: webAppObjectExists ? typeof window.Telegram.WebApp : 'undefined'
        };
        
        if (!telegramScriptLoaded) {
            // Обычный браузер без скрипта - нормально
            logLevel = 'WARNING';
            logMessage = '⚠️ BROWSER_ACCESS: Попытка доступа через обычный браузер';
            logContext.access_type = 'browser';
        } else if (telegramScriptLoaded && !isRealTelegram) {
            // Скрипт загружен, но initData нет = обычный браузер со скриптом
            logLevel = 'WARNING';
            logMessage = '⚠️ BROWSER_WITH_SCRIPT: Обычный браузер с загруженным Telegram WebApp скриптом';
            logContext.access_type = 'browser_with_script';
        } else if (isRealTelegram && initDataLength === 0) {
            // Настоящий Telegram, но initData пустые - серьезная проблема
            logLevel = 'ERROR';
            logMessage = '🚨 TELEGRAM_EMPTY_INITDATA: Telegram WebApp доступен, но initData пустые';
            logContext.access_type = 'telegram_empty_initdata';
        } else if (isRealTelegram && !userId) {
            // Настоящий Telegram, initData есть, но пользователь не определен
            logLevel = 'ERROR';
            logMessage = '🚨 TELEGRAM_NO_USER: initData присутствуют, но данные пользователя отсутствуют';
            logContext.access_type = 'telegram_no_user';
        } else {
            // Неизвестная проблема
            logLevel = 'ERROR';
            logMessage = '🚨 TELEGRAM_UNKNOWN_AUTH_ISSUE: Неизвестная проблема с авторизацией Telegram WebApp';
            logContext.access_type = 'unknown_issue';
        }
        
        // Отправляем лог на сервер
        sendAuthLog(logLevel, logMessage, logContext);
        
        // Перенаправляем на страницу ошибки
        redirectToAuthError();
        return false;
    }
    
    // Успешная авторизация - логируем только в консоль, не отправляем на сервер
    if (showLogs) {
        console.log('✅ TELEGRAM_AUTH_SUCCESS: Успешная проверка авторизации Telegram WebApp', {
            access_type: 'telegram_success',
            user_id: userId,
            initdata_length: initDataLength
        });
    }
    
    return true;
}

/**
 * Инициализирует проверку авторизации при загрузке страницы
 * Должен вызываться в начале каждой защищенной страницы
 * 
 * @param {boolean} showLogs - показывать ли логи в консоли
 */
export function initTelegramAuth(showLogs = false) {
    // Немедленная проверка
    if (!enforceInstanceTelegramAuth(showLogs)) {
        return;
    }
    
    // Дополнительная проверка при изменении фокуса страницы
    // (защита от попыток обхода через developer tools)
    document.addEventListener('visibilitychange', () => {
        if (!document.hidden) {
            enforceInstanceTelegramAuth(false);
        }
    });
    
    // Проверка при изменении URL (защита от навигации)
    window.addEventListener('popstate', () => {
        enforceInstanceTelegramAuth(false);
    });
}

/**
 * Создает заголовки с данными авторизации Telegram для API запросов
 * @returns {Object} объект с заголовками
 */
export function createTelegramHeaders() {
    const headers = {
        'Content-Type': 'application/json'
    };
    
    if (isInTelegramWebApp()) {
        headers['X-Telegram-Init-Data'] = window.Telegram.WebApp.initData;
    }
    
    return headers;
}

/**
 * Получает данные пользователя из Telegram WebApp
 * @returns {Object|null} данные пользователя или null
 */
export function getTelegramUser() {
    if (!isInTelegramWebApp()) {
        return null;
    }
    
    return window.Telegram.WebApp.initDataUnsafe.user;
} 