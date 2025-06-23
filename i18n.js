/**
 * Модуль для работы с многоязычностью
 */

// Словари с переводами для каждого языка
const translations = {
    ru: null, // Будет загружен из /translations/ru.json
    en: null  // Будет загружен из /translations/en.json
};

// Текущий язык пользователя
let currentLanguage = 'en';

// Ключ для хранения языка в localStorage
const LANGUAGE_STORAGE_KEY = 'giftgo_user_language';
const ORIGINAL_LANGUAGE_STORAGE_KEY = 'giftgo_original_language';
// Ключи для хранения переводов в localStorage
const TRANSLATIONS_STORAGE_KEY_PREFIX = 'giftgo_translations_';
// Версия переводов для инвалидации кэша при обновлении переводов
const TRANSLATIONS_VERSION_KEY = 'giftgo_translations_version';
// Время жизни кэша переводов в миллисекундах (12 часов)
const TRANSLATIONS_CACHE_TTL = 12 * 60 * 60 * 1000; // 12 часов в миллисекундах

// Объект для работы с версией переводов
const translationsVersionController = {
    // Текущая версия, обычно 'major.minor' формат
    current: '1.1.1416',
    
    // Получает текущую версию
    get: function() {
        return this.current;
    },
    
    // Обновляет версию переводов, увеличивая минорную часть на 0.1
    update: function() {
        const parts = this.current.split('.');
        
        // Обрабатываем разные форматы версий
        if (parts.length === 2) {
            // Формат X.Y
            const majorVersion = parseInt(parts[0], 10);
            const minorVersion = parseFloat(parts[1], 10) + 0.1;
            this.current = `${majorVersion}.${minorVersion.toFixed(1)}`;
        } else if (parts.length === 3) {
            // Формат X.Y.Z
            const majorVersion = parseInt(parts[0], 10);
            const minorVersion = parseInt(parts[1], 10);
            const patchVersion = parseInt(parts[2], 10) + 1;
            this.current = `${majorVersion}.${minorVersion}.${patchVersion}`;
        } else {
            // Неизвестный формат, просто добавляем .1
            this.current = this.current + '.1';
        }
        
        debugLog(`Версия переводов обновлена до ${this.current}`);
        return this.current;
    }
};

// Флаг для отладки
const DEBUG = true;

// Функция для расширенного логирования
function debugLog(...args) {
    if (DEBUG) {
        console.log('[i18n Debug]', ...args);
    }
}

/**
 * Инициализирует модуль i18n и загружает перевод для языка пользователя
 * 
 * @param {string} languageCode - Код языка пользователя из Telegram API или сохраненный в localStorage
 * @returns {Promise} - Promise, который разрешается после загрузки переводов
 */
export async function initI18n(languageCode) {
    // Проверка режима разработки
    const isDevMode = window.isDevMode === true;
    debugLog(`Начало инициализации i18n, isDevMode=${isDevMode}, pathname=${window.location.pathname}`);
    
    try {
        // Проверяем версию переводов в localStorage
        const storedVersion = localStorage.getItem(TRANSLATIONS_VERSION_KEY);
        // Если версия переводов изменилась, очищаем кэш переводов
        if (storedVersion !== translationsVersionController.get()) {
            debugLog(`Версия переводов изменилась: ${storedVersion} -> ${translationsVersionController.get()}, очищаем кэш`);
            clearTranslationsCache();
            localStorage.setItem(TRANSLATIONS_VERSION_KEY, translationsVersionController.get());
            console.log("Версия кеша обновлена"); // Добавленный лог для пользователя
        }
        
        // Попытка получить язык из localStorage
        const savedLanguage = localStorage.getItem(LANGUAGE_STORAGE_KEY);
        
        // Выбираем язык: сначала проверяем переданный код, затем сохраненный, затем используем 'en'
        const languageToUse = languageCode || savedLanguage || 'en';
        
        // Выводим информацию об окружении приложения
        debugLog(`Режим разработки: ${isDevMode}, pathname: ${window.location.pathname}`);
        debugLog(`Используемый язык: ${languageToUse} (сохраненный: ${savedLanguage}, переданный: ${languageCode})`);
        
        // Нормализуем код языка (убираем региональные настройки, например, 'ru-RU' -> 'ru')
        const normalizedLanguage = normalizeLanguageCode(languageToUse);
        currentLanguage = normalizedLanguage;
        
        // Сохраняем оба кода языка в localStorage
        localStorage.setItem(LANGUAGE_STORAGE_KEY, normalizedLanguage);
        if (languageCode) {
            localStorage.setItem(ORIGINAL_LANGUAGE_STORAGE_KEY, languageCode);
        }
        
        // Логируем информацию о языке
        console.log(`Инициализация i18n с языком: ${normalizedLanguage} (изначально: ${languageToUse})`);
        
        // Добавлено для отладки - подробная информация о Telegram API
        if (window.Telegram?.WebApp) {
            const tg = window.Telegram.WebApp;
            debugLog('Telegram WebApp доступен:', {
                initDataUnsafe: tg.initDataUnsafe ? 'имеется' : 'отсутствует',
                user: tg.initDataUnsafe?.user ? 'имеется' : 'отсутствует',
                language_code: tg.initDataUnsafe?.user?.language_code || 'не определен',
                platformId: tg.platformId || 'не определен'
            });
        } else {
            debugLog('ПРЕДУПРЕЖДЕНИЕ: Telegram WebApp API не доступен!');
        }
        
        // Загружаем перевод для текущего языка, если он еще не загружен
        if (!translations[normalizedLanguage]) {
            try {
                debugLog(`Попытка загрузки переводов для языка ${normalizedLanguage}`);
                
                // Пытаемся загрузить переводы из localStorage
                const cachedTranslations = getTranslationsFromCache(normalizedLanguage);
                
                if (cachedTranslations) {
                    // Используем кэшированные переводы
                    translations[normalizedLanguage] = cachedTranslations;
                    debugLog(`Переводы для языка ${normalizedLanguage} загружены из localStorage, возраст: ${getCacheAge(normalizedLanguage)} мс`);
                } else {
                    // Если в кэше нет переводов, загружаем с сервера
                    await loadTranslations(normalizedLanguage);
                    debugLog(`Переводы для языка ${normalizedLanguage} загружены с сервера и сохранены в localStorage`);
                }
            } catch (error) {
                console.error(`Ошибка при загрузке перевода для языка ${normalizedLanguage}:`, error);
                debugLog(`Детали ошибки загрузки: ${error.message}, stack: ${error.stack}`);
                
                // Если произошла ошибка при загрузке указанного языка, пытаемся загрузить язык по умолчанию
                if (normalizedLanguage !== 'en') {
                    console.log('Попытка загрузить язык по умолчанию (en)');
                    currentLanguage = 'en';
                    localStorage.setItem(LANGUAGE_STORAGE_KEY, 'en');
                    
                    // Сначала проверяем кэш для языка по умолчанию
                    const cachedDefaultTranslations = getTranslationsFromCache('en');
                    
                    if (cachedDefaultTranslations) {
                        translations['en'] = cachedDefaultTranslations;
                        debugLog('Переводы для языка en (по умолчанию) загружены из localStorage');
                    } else {
                        try {
                            await loadTranslations('en');
                            debugLog('Переводы для языка en (по умолчанию) успешно загружены с сервера');
                        } catch (fallbackError) {
                            console.error('Критическая ошибка: не удалось загрузить перевод по умолчанию (en):', fallbackError);
                            debugLog(`Детали ошибки загрузки языка по умолчанию: ${fallbackError.message}, stack: ${fallbackError.stack}`);
                            
                            // Создаем минимальный резервный перевод, чтобы приложение не зависало
                            translations['en'] = { common: { loading: 'Loading...' } };
                            debugLog('Создан минимальный резервный перевод');
                        }
                    }
                } else {
                    // Если не удалось загрузить английский язык, создаем минимальный резервный перевод
                    translations['en'] = { common: { loading: 'Loading...' } };
                    debugLog('Создан минимальный резервный перевод для en');
                }
            }
        } else {
            debugLog(`Переводы для языка ${normalizedLanguage} уже загружены в памяти`);
        }
        
        debugLog('Завершение инициализации i18n:', { currentLanguage });
        return translations[currentLanguage];
    } catch (error) {
        console.error('Непредвиденная ошибка в initI18n:', error);
        debugLog(`Критическая ошибка в initI18n: ${error.message}, stack: ${error.stack}`);
        
        // Создаем минимальный резервный перевод в случае критической ошибки
        translations['en'] = { common: { loading: 'Loading...' } };
        currentLanguage = 'en';
        return translations[currentLanguage];
    }
}

/**
 * Загружает словарь переводов для указанного языка с сервера
 * 
 * @param {string} languageCode - Код языка для загрузки переводов
 * @returns {Promise} - Promise, который разрешается после загрузки переводов
 */
async function loadTranslations(languageCode) {
    try {
        // Определяем правильный URL для загрузки переводов
        // Используем глобальную переменную isDevMode, которая устанавливается на странице
        const isDevMode = window.isDevMode === true;
        const apiPrefix = isDevMode ? '/dev' : '';
        const url = `${apiPrefix}/translations/${languageCode}.json`;
        
        debugLog(`Загрузка перевода с URL: ${url}, режим разработки: ${isDevMode}`);
        
        // Загружаем перевод через fetch с таймаутом
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 секунд таймаут
        
        const response = await fetch(url, { 
            signal: controller.signal,
            headers: { 'Cache-Control': 'no-cache' } // Отключаем кеширование
        });
        
        clearTimeout(timeoutId);
        
        if (!response.ok) {
            debugLog(`Ошибка при загрузке перевода: HTTP status ${response.status} ${response.statusText}`);
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const translationData = await response.json();
        debugLog(`Получены данные перевода размером: ${JSON.stringify(translationData).length} байт`);
        
        // Сохраняем переводы в памяти и в localStorage
        translations[languageCode] = translationData;
        saveTranslationsToCache(languageCode, translationData);
        
        console.log(`Перевод для языка ${languageCode} успешно загружен`);
        
        return translationData;
    } catch (error) {
        console.error(`Ошибка при загрузке перевода для языка ${languageCode}:`, error);
        debugLog(`Детали ошибки загрузки: ${error.name} - ${error.message}`);
        // Проверяем, не является ли ошибка отменой запроса по таймауту
        if (error.name === 'AbortError') {
            debugLog('Загрузка прервана по таймауту (10 секунд)');
        }
        throw error;
    }
}

/**
 * Сохраняет переводы в localStorage кэш с указанием времени сохранения
 * 
 * @param {string} languageCode - Код языка
 * @param {Object} translationData - Объект с переводами
 */
function saveTranslationsToCache(languageCode, translationData) {
    try {
        const key = TRANSLATIONS_STORAGE_KEY_PREFIX + languageCode;
        const cacheData = {
            data: translationData,
            timestamp: Date.now() // Добавляем текущее время для отслеживания TTL
        };
        localStorage.setItem(key, JSON.stringify(cacheData));
        debugLog(`Переводы для языка ${languageCode} сохранены в localStorage с меткой времени ${new Date().toISOString()}`);
    } catch (error) {
        console.warn(`Не удалось сохранить переводы в localStorage: ${error.message}`);
        // В случае ошибки (например, QuotaExceededError) просто продолжаем работу без кэширования
    }
}

/**
 * Получает время хранения кэша переводов в миллисекундах
 * 
 * @param {string} languageCode - Код языка 
 * @returns {number|null} - Возраст кэша в миллисекундах или null если кэша нет
 */
function getCacheAge(languageCode) {
    try {
        const key = TRANSLATIONS_STORAGE_KEY_PREFIX + languageCode;
        const cachedData = localStorage.getItem(key);
        
        if (cachedData) {
            const cache = JSON.parse(cachedData);
            if (cache.timestamp) {
                return Date.now() - cache.timestamp;
            }
        }
        return null;
    } catch (error) {
        console.warn(`Ошибка при получении возраста кэша: ${error.message}`);
        return null;
    }
}

/**
 * Проверяет, устарел ли кэш переводов
 * 
 * @param {string} languageCode - Код языка
 * @returns {boolean} - true если кэш устарел или его нет, false если кэш актуален
 */
function isCacheExpired(languageCode) {
    const cacheAge = getCacheAge(languageCode);
    
    if (cacheAge === null) {
        return true; // Кэша нет
    }
    
    return cacheAge > TRANSLATIONS_CACHE_TTL;
}

/**
 * Получает переводы из localStorage кэша, учитывая время жизни кэша
 * 
 * @param {string} languageCode - Код языка
 * @returns {Object|null} - Объект с переводами или null если кэш отсутствует или устарел
 */
function getTranslationsFromCache(languageCode) {
    try {
        const key = TRANSLATIONS_STORAGE_KEY_PREFIX + languageCode;
        const cachedData = localStorage.getItem(key);
        
        if (cachedData) {
            const cache = JSON.parse(cachedData);
            
            // Проверяем, не устарел ли кэш
            if (cache.timestamp && (Date.now() - cache.timestamp) <= TRANSLATIONS_CACHE_TTL) {
                debugLog(`Найдены валидные кэшированные переводы для ${languageCode}, возраст: ${(Date.now() - cache.timestamp) / 1000} сек.`);
                return cache.data;
            } else {
                debugLog(`Кэшированные переводы для ${languageCode} устарели (возраст: ${cache.timestamp ? ((Date.now() - cache.timestamp) / 1000) + ' сек.' : 'не определен'}), загружаем новые`);
                return null;
            }
        }
        debugLog(`Кэшированные переводы для ${languageCode} не найдены`);
        return null;
    } catch (error) {
        console.warn(`Ошибка при получении переводов из localStorage: ${error.message}`);
        return null;
    }
}

/**
 * Очищает все кэшированные переводы из localStorage
 */
function clearTranslationsCache() {
    try {
        const keysToRemove = [];
        
        // Находим все ключи, связанные с переводами
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && key.startsWith(TRANSLATIONS_STORAGE_KEY_PREFIX)) {
                keysToRemove.push(key);
            }
        }
        
        // Удаляем найденные ключи
        keysToRemove.forEach(key => localStorage.removeItem(key));
        debugLog(`Очищен кэш переводов, удалено ${keysToRemove.length} записей`);
    } catch (error) {
        console.warn(`Ошибка при очистке кэша переводов: ${error.message}`);
    }
}

/**
 * Возвращает перевод для указанного ключа
 * 
 * @param {string} key - Ключ для перевода в формате "секция.ключ" или "секция.подсекция.ключ"
 * @param {Object} placeholders - Объект с плейсхолдерами для замены в тексте
 * @returns {string} - Переведенный текст или ключ, если перевод не найден
 */
export function t(key, placeholders = {}) {
    // Если нет загруженных переводов, возвращаем ключ
    if (!translations[currentLanguage]) {
        console.warn(`Перевод для языка ${currentLanguage} не загружен`);
        return placeholders.defaultValue || key;
    }
    
    // Разделяем ключ на части
    const parts = key.split('.');
    
    // Проверяем формат ключа
    if (parts.length < 2) {
        console.warn(`Некорректный формат ключа: ${key}. Ожидается формат "секция.ключ" или "секция.подсекция.ключ"`);
        return placeholders.defaultValue || key;
    }
    
    let result;
    
    if (parts.length === 2) {
        // Стандартный формат "секция.ключ"
        const [section, subkey] = parts;
        
        // Получаем секцию
        const sectionData = translations[currentLanguage][section];
        
        if (!sectionData) {
            console.warn(`Секция ${section} не найдена в переводе для языка ${currentLanguage}`);
            return placeholders.defaultValue || key;
        }
        
        // Получаем текст
        result = sectionData[subkey];
    } else {
        // Расширенный формат "секция.подсекция.ключ"
        let current = translations[currentLanguage];
        
        // Итеративно переходим по уровням ключа
        for (let i = 0; i < parts.length; i++) {
            if (current[parts[i]] === undefined) {
                console.warn(`Путь ${parts.slice(0, i+1).join('.')} не найден в переводе для языка ${currentLanguage}`);
                return placeholders.defaultValue || key;
            }
            current = current[parts[i]];
            
            // Если дошли до конца и получили строку, это наш результат
            if (i === parts.length - 1 || typeof current === 'string') {
                result = current;
                break;
            }
        }
    }
    
    if (result === undefined) {
        console.warn(`Ключ ${key} не найден для языка ${currentLanguage}`);
        return placeholders.defaultValue || key;
    }
    
    // Заменяем плейсхолдеры, если они есть
    if (Object.keys(placeholders).length > 0) {
        return replacePlaceholders(result, placeholders);
    }
    
    return result;
}

/**
 * Заменяет плейсхолдеры в тексте на значения из объекта
 * 
 * @param {string} text - Текст с плейсхолдерами вида {{placeholder}}
 * @param {Object} placeholders - Объект с заменами для плейсхолдеров
 * @returns {string} - Текст с замененными плейсхолдерами
 */
function replacePlaceholders(text, placeholders) {
    return text.replace(/\{\{(\w+)\}\}/g, (match, placeholder) => {
        return placeholders[placeholder] !== undefined ? placeholders[placeholder] : match;
    });
}

/**
 * Нормализует код языка
 * 
 * @param {string} languageCode - Код языка (может содержать региональные настройки)
 * @returns {string} - Нормализованный код языка или 'en', если язык не поддерживается
 */
function normalizeLanguageCode(languageCode) {
    debugLog(`Нормализация кода языка: ${languageCode}`);
    
    if (!languageCode) {
        debugLog('Код языка отсутствует, используем en по умолчанию');
        return 'en';
    }
    
    // Приводим к нижнему регистру и берем базовый код языка (до дефиса)
    const baseCode = languageCode.toLowerCase().split('-')[0];
    debugLog(`Базовый код языка после нормализации: ${baseCode}`);
    
    // Языки, для которых используем русский:
    // - ru: русский
    // - uk: украинский
    // - be: белорусский
    // - kk: казахский
    // - ky: кыргызский
    // - uz: узбекский
    // - tg: таджикский
    // - az: азербайджанский
    // - hy: армянский
    // - ro: молдавский (ro-MD)
    const postSovietLanguages = ['ru', 'uk', 'be', 'kk', 'ky', 'uz', 'tg', 'az', 'hy', 'ro'];
    
    if (postSovietLanguages.includes(baseCode)) {
        debugLog(`Язык ${baseCode} принадлежит к группе русскоговорящих стран, используем ru`);
        return 'ru';
    }
    
    // Проверяем, является ли язык поддерживаемым (не из русскоговорящих стран)
    if (baseCode === 'en') {
        debugLog(`Язык ${baseCode} поддерживается явно`);
        return baseCode;
    }
    
    // Для всех остальных языков используем английский
    debugLog(`Язык ${baseCode} не поддерживается явно, используем en по умолчанию`);
    return 'en';
}

/**
 * Возвращает текущий язык пользователя
 * 
 * @returns {string} - Код текущего языка
 */
export function getCurrentLanguage() {
    return currentLanguage;
}

/**
 * Возвращает оригинальный код языка пользователя (до нормализации)
 * 
 * @returns {string} - Оригинальный код языка или null если не сохранен
 */
export function getOriginalLanguage() {
    return localStorage.getItem(ORIGINAL_LANGUAGE_STORAGE_KEY) || null;
}

/**
 * Получает язык пользователя из Telegram WebApp или localStorage
 * 
 * @returns {string} - Код языка или 'en' если не удалось получить
 */
export function getLanguageFromTelegram() {
    debugLog('Попытка получить язык пользователя из Telegram WebApp или localStorage');
    
    // Сначала проверяем, есть ли сохраненный язык в localStorage
    const savedOriginalLanguage = localStorage.getItem(ORIGINAL_LANGUAGE_STORAGE_KEY);
    if (savedOriginalLanguage) {
        debugLog(`Язык пользователя найден в localStorage: ${savedOriginalLanguage}`);
        return savedOriginalLanguage;
    }
    
    try {
        // Получаем Telegram WebApp API
        const tg = window.Telegram?.WebApp;
        
        if (!tg) {
            debugLog('Telegram WebApp API не доступен');
            console.warn('Не удалось получить данные пользователя из Telegram WebApp: API недоступен');
            return 'en';
        }
        
        if (!tg.initDataUnsafe) {
            debugLog('tg.initDataUnsafe не доступен');
            console.warn('Не удалось получить данные пользователя из Telegram WebApp: initDataUnsafe отсутствует');
            return 'en';
        }
        
        if (!tg.initDataUnsafe.user) {
            debugLog('tg.initDataUnsafe.user не доступен');
            console.warn('Не удалось получить данные пользователя из Telegram WebApp: user отсутствует');
            return 'en';
        }
        
        // Подробное логирование данных пользователя и языка
        const userData = tg.initDataUnsafe.user;
        const rawLanguageCode = userData.language_code || 'en';
        
        // Подробное логирование доступных данных пользователя
        debugLog('Данные пользователя из Telegram WebApp:', {
            id: userData.id || 'не определен',
            first_name: userData.first_name || 'не определен',
            username: userData.username || 'не определен',
            language_code: rawLanguageCode
        });
        
        // Добавляем информативный лог о языке пользователя в консоль (всегда отображается)
        console.log('🌐 Язык пользователя из Telegram:', {
            rawLanguageCode,
            userId: userData.id || 'не определен',
            username: userData.username || 'не указан'
        });
        
        // Сохраняем оригинальный код языка в localStorage
        localStorage.setItem(ORIGINAL_LANGUAGE_STORAGE_KEY, rawLanguageCode);
        
        // Извлекаем код языка или используем 'en' по умолчанию
        const normalizedLanguage = normalizeLanguageCode(rawLanguageCode);
        
        // Логируем результат нормализации
        console.log(`🌐 Язык пользователя: исходный=${rawLanguageCode}, нормализованный=${normalizedLanguage}`);
        
        return rawLanguageCode;
    } catch (error) {
        debugLog(`Ошибка при получении языка из Telegram: ${error.message}`);
        console.error('Ошибка при получении языка пользователя из Telegram:', error);
        return 'en';
    }
}

// Экспортируем основные функции и константы
export default {
    initI18n,
    t,
    getCurrentLanguage,
    getOriginalLanguage,
    getLanguageFromTelegram
}; 