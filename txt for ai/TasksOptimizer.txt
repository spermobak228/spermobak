/**
 * Модуль для оптимизированного получения заданий с кэшированием
 */

class TasksOptimizer {
    constructor() {
        this.cache = new Map();
        this.CACHE_PREFIX = 'tasks_cache_';
        this.SESSION_PREFIX = 'tasks_session_';
        
        // Типы действий
        this.ACTION_TYPES = {
            INITIAL_LOAD: 'initial_load',
            GAME: 'game',
            INVENTORY_CHANGE: 'inventory_change'
        };
        
        // Задания, которые не нужно перепроверять
        this.STATIC_TASKS = new Set(['daily-login']);
        
        // Задания, зависящие от игр
        this.GAME_DEPENDENT_TASKS = new Set([
            'daily-play-five-games',
            'daily-play-ten-games', 
            'weekly-play-500-games'
        ]);
        
        // Задания, зависящие от инвентаря
        this.INVENTORY_DEPENDENT_TASKS = new Set(['weekly-collection']);
        
        // Единоразовые задания
        this.ONE_TIME_TASK_PREFIXES = ['special-', 'achievement-'];
        
        // Инициализируем кэш сессии
        this.initSessionCache();
    }
    
    /**
     * Инициализация кэша сессии
     */
    initSessionCache() {
        // Помечаем задания, которые уже были проверены в текущей сессии
        this.sessionCache = new Set();
        
        // Очищаем старые сессионные данные при новой сессии
        const sessionKey = this.SESSION_PREFIX + 'initialized';
        if (!sessionStorage.getItem(sessionKey)) {
            this.clearSessionCache();
            sessionStorage.setItem(sessionKey, 'true');
        }
    }
    
    /**
     * Очистка кэша сессии
     */
    clearSessionCache() {
        const keys = Object.keys(sessionStorage);
        keys.forEach(key => {
            if (key.startsWith(this.SESSION_PREFIX)) {
                sessionStorage.removeItem(key);
            }
        });
    }
    
    /**
     * Получение заданий с оптимизацией
     */
    async getOptimizedTasks(userId, actionType = this.ACTION_TYPES.INITIAL_LOAD, specificTaskIds = null) {
        try {
            // Используем оптимизированный эндпоинт для всех типов действий
            const shouldUseOptimized = actionType === this.ACTION_TYPES.GAME || 
                                     actionType === this.ACTION_TYPES.INITIAL_LOAD ||
                                     actionType === this.ACTION_TYPES.INVENTORY_CHANGE;
            
            const apiUrl = window.isDevMode ? 
                (shouldUseOptimized ? '/dev/api/tasks/get/optimized' : '/dev/api/tasks/get') :
                (shouldUseOptimized ? '/api/tasks/get/optimized' : '/api/tasks/get');
            
            console.log(`TasksOptimizer: actionType=${actionType}, useOptimized=${shouldUseOptimized}, apiUrl=${apiUrl}`);
            
            const requestBody = {
                user_id: userId,
                action_type: actionType
            };
            
            // Добавляем фильтр заданий для оптимизированного запроса
            if (shouldUseOptimized && actionType === this.ACTION_TYPES.GAME) {
                // При игре проверяем только игровые задания
                requestBody.task_ids = Array.from(this.GAME_DEPENDENT_TASKS);
            } else if (shouldUseOptimized && actionType === this.ACTION_TYPES.INVENTORY_CHANGE) {
                // При изменении инвентаря проверяем только задания коллекции
                requestBody.task_ids = Array.from(this.INVENTORY_DEPENDENT_TASKS);
            } else if (specificTaskIds) {
                requestBody.task_ids = specificTaskIds;
            }
            // Для INITIAL_LOAD не добавляем task_ids, чтобы получить все задания
            
            const response = await fetch(apiUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(requestBody)
            });
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }
            
            const result = await response.json();
            
            if (!result.success) {
                throw new Error(result.error || 'Ошибка получения заданий');
            }
            
            // Логируем статистику оптимизации
            if (result.cached_count !== undefined) {
                console.log(`Задания: ${result.checked_count} проверено, ${result.cached_count} из кэша`);
            }
            
            // Кэшируем результаты в localStorage для более долгого хранения
            this.cacheTasksLocally(userId, result.tasks, actionType);
            
            return result;
            
        } catch (error) {
            console.error('Ошибка при получении оптимизированных заданий:', error);
            
            // Определяем тип ошибки для лучшей диагностики
            let errorType = 'unknown';
            if (error.message.includes('NetworkError') || error.message.includes('Failed to fetch')) {
                errorType = 'network';
            } else if (error.message.includes('timeout')) {
                errorType = 'timeout';
            } else if (error.message.includes('404') || error.message.includes('500')) {
                errorType = 'server';
            }
            
            console.log(`Тип ошибки определен как: ${errorType}`);
            
            // Fallback к обычному эндпоинту при ошибке
            try {
                console.log('Пытаемся использовать fallback API');
                const fallbackResult = await this.getFallbackTasks(userId);
                console.log('Fallback API сработал успешно');
                return fallbackResult;
            } catch (fallbackError) {
                console.error('Fallback API также не работает:', fallbackError);
                
                // Возвращаем пустой результат с ошибкой
                return {
                    success: false,
                    error: `Оптимизированный API: ${error.message}; Fallback API: ${fallbackError.message}`,
                    tasks: []
                };
            }
        }
    }
    
    /**
     * Fallback к обычному эндпоинту
     */
    async getFallbackTasks(userId) {
        const apiUrl = window.isDevMode ? '/dev/api/tasks/get' : '/api/tasks/get';
        
        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                user_id: userId
            })
        });
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }
        
        return response.json();
    }
    
    /**
     * Кэширование заданий в localStorage
     */
    cacheTasksLocally(userId, tasks, actionType) {
        const cacheKey = this.CACHE_PREFIX + userId;
        const cacheData = {
            tasks: {},
            timestamp: Date.now(),
            actionType: actionType
        };
        
        // Кэшируем каждое задание отдельно с TTL
        tasks.forEach(task => {
            const ttl = this.getClientCacheTTL(task);
            cacheData.tasks[task.id] = {
                data: task,
                expires: Date.now() + ttl
            };
        });
        
        try {
            localStorage.setItem(cacheKey, JSON.stringify(cacheData));
        } catch (e) {
            console.warn('Не удалось сохранить кэш заданий:', e);
        }
    }
    
    /**
     * Получение TTL для клиентского кэша
     */
    getClientCacheTTL(task) {
        // Выполненные задания кэшируем до их естественного сброса
        if (task.status === 'completed') {
            // Ежедневные задания - до 6:00 следующего дня МСК
            if (task.id.startsWith('daily-')) {
                const now = new Date();
                const tomorrow6AM = new Date(now);
                tomorrow6AM.setDate(tomorrow6AM.getDate() + 1);
                tomorrow6AM.setHours(6, 0, 0, 0);
                
                // Корректируем на MSK (UTC+3)
                const msk6AM = new Date(tomorrow6AM.getTime() - (3 * 60 * 60 * 1000));
                return Math.max(msk6AM.getTime() - now.getTime(), 5 * 60 * 1000);
            }
            
            // Еженедельные задания - до следующего понедельника 6:00 МСК
            if (task.id.startsWith('weekly-')) {
                const now = new Date();
                const nextMonday = new Date(now);
                const daysUntilMonday = (8 - now.getDay()) % 7 || 7; // 1-7 дней
                nextMonday.setDate(now.getDate() + daysUntilMonday);
                nextMonday.setHours(6, 0, 0, 0);
                
                // Корректируем на MSK (UTC+3)
                const mskMonday = new Date(nextMonday.getTime() - (3 * 60 * 60 * 1000));
                return Math.max(mskMonday.getTime() - now.getTime(), 5 * 60 * 1000);
            }
            
            // Единоразовые задания - кэшируем ОЧЕНЬ долго
            if (this.ONE_TIME_TASK_PREFIXES.some(prefix => task.id.startsWith(prefix))) {
                return 30 * 24 * 60 * 60 * 1000; // 30 дней
            }
            
            // Fallback для других выполненных заданий
            return 60 * 60 * 1000; // 1 час
        }
        
        // daily-login кэшируем до конца дня, если выполнен
        if (task.id === 'daily-login' && task.status === 'in_progress') {
            const now = new Date();
            const tomorrow6AM = new Date(now);
            tomorrow6AM.setDate(tomorrow6AM.getDate() + 1);
            tomorrow6AM.setHours(6, 0, 0, 0);
            
            // Корректируем на MSK (UTC+3)
            const msk6AM = new Date(tomorrow6AM.getTime() - (3 * 60 * 60 * 1000));
            return Math.max(msk6AM.getTime() - now.getTime(), 5 * 60 * 1000);
        }
        
        // Задания в процессе кэшируем на 5 минут
        if (task.status === 'in_progress') {
            return 5 * 60 * 1000; // 5 минут
        }
        
        // Не начатые задания кэшируем на 1 минуту
        return 60 * 1000; // 1 минута
    }
    
    /**
     * Получение заданий из локального кэша
     */
    getCachedTasks(userId, actionType) {
        const cacheKey = this.CACHE_PREFIX + userId;
        
        try {
            const cached = localStorage.getItem(cacheKey);
            if (!cached) return null;
            
            const cacheData = JSON.parse(cached);
            const now = Date.now();
            
            // Проверяем, не истек ли кэш
            const validTasks = [];
            
            Object.values(cacheData.tasks || {}).forEach(cachedTask => {
                if (cachedTask.expires > now) {
                    // Проверяем, нужно ли обновлять задание в зависимости от действия
                    const shouldCheck = this.shouldCheckTask(
                        cachedTask.data.id,
                        cachedTask.data.status,
                        actionType
                    );
                    
                    if (!shouldCheck) {
                        validTasks.push(cachedTask.data);
                    }
                }
            });
            
            return validTasks.length > 0 ? validTasks : null;
            
        } catch (e) {
            console.warn('Ошибка при чтении кэша заданий:', e);
            return null;
        }
    }
    
    /**
     * Определяет, нужно ли проверять задание
     */
    shouldCheckTask(taskId, taskStatus, actionType) {
        // Единоразовые задания: если выполнены - НИКОГДА не проверяем
        if (this.ONE_TIME_TASK_PREFIXES.some(prefix => taskId.startsWith(prefix))) {
            if (taskStatus === 'completed') {
                return false;
            }
            // Если не выполнены - проверяем только при первоначальной загрузке
            return actionType === this.ACTION_TYPES.INITIAL_LOAD;
        }
        
        // Периодические задания: если выполнены - не проверяем до сброса
        if (taskStatus === 'completed') {
            return false;
        }
        
        // daily-login проверяем только при первой загрузке в сессии
        if (this.STATIC_TASKS.has(taskId)) {
            const sessionKey = this.SESSION_PREFIX + taskId;
            if (actionType === this.ACTION_TYPES.INITIAL_LOAD && !sessionStorage.getItem(sessionKey)) {
                sessionStorage.setItem(sessionKey, 'true');
                return true;
            }
            return false;
        }
        
        // Задания на игры проверяем только при играх или первоначальной загрузке
        if (this.GAME_DEPENDENT_TASKS.has(taskId)) {
            return actionType === this.ACTION_TYPES.GAME || actionType === this.ACTION_TYPES.INITIAL_LOAD;
        }
        
        // Задания на инвентарь проверяем при изменении инвентаря или первоначальной загрузке
        if (this.INVENTORY_DEPENDENT_TASKS.has(taskId)) {
            return actionType === this.ACTION_TYPES.INVENTORY_CHANGE || actionType === this.ACTION_TYPES.INITIAL_LOAD;
        }
        
        // Для других заданий проверяем только при первоначальной загрузке
        return actionType === this.ACTION_TYPES.INITIAL_LOAD;
    }
    
    /**
     * Инвалидация кэша для конкретного задания
     */
    invalidateTask(userId, taskId) {
        const cacheKey = this.CACHE_PREFIX + userId;
        
        try {
            const cached = localStorage.getItem(cacheKey);
            if (cached) {
                const cacheData = JSON.parse(cached);
                if (cacheData.tasks && cacheData.tasks[taskId]) {
                    delete cacheData.tasks[taskId];
                    localStorage.setItem(cacheKey, JSON.stringify(cacheData));
                }
            }
        } catch (e) {
            console.warn('Ошибка при инвалидации кэша задания:', e);
        }
        
        // Также очищаем сессионный кэш
        const sessionKey = this.SESSION_PREFIX + taskId;
        sessionStorage.removeItem(sessionKey);
    }
    
    /**
     * Очистка всего кэша пользователя
     */
    clearUserCache(userId) {
        const cacheKey = this.CACHE_PREFIX + userId;
        localStorage.removeItem(cacheKey);
        this.clearSessionCache();
    }
}

// Создаем глобальный экземпляр
window.tasksOptimizer = new TasksOptimizer();

export default TasksOptimizer; 