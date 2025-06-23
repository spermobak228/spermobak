/**
 * Основной JavaScript файл для страницы заданий
 * Инициализирует страницу и отображает карточки заданий
 */

// Импортируем необходимые модули
import { applyTelegramColorScheme, setupScrollbarVisibility, initTgsSupport } from './modules/ui-utils.js';
import { setupNavigation } from './modules/navigation.js';
import { renderTask, completeTask, verifyTaskCompletion, TaskTypes, openChannelForSubscription } from './modules/tasks/index_tasks.js';
import { showTaskComplete } from './modules/tasks/task-complete-modal.js';
import TimerManager from './modules/tasks/utils/TimerManager.js';
import TasksOptimizer from './modules/tasks/TasksOptimizer.js';

// Глобальные переменные
let telegram = window.Telegram.WebApp;
let userInfo = null;
let isTasksPageInitialized = false; // Флаг для отслеживания инициализации
let tasksData = [];
let renderPromise = null; // Promise для отслеживания завершения рендера // Массив заданий, полученных с сервера

// Функция для инициализации страницы
async function initTasksPage() {
    // Проверяем, была ли страница уже инициализирована
    if (isTasksPageInitialized) {
        console.log('Страница заданий уже инициализирована, пропускаем');
        return;
    }
    
    // Устанавливаем флаг инициализации
    isTasksPageInitialized = true;
    
    console.log('Инициализация страницы заданий');
    
    let initSuccess = false;
    
    try {
        // Применяем цветовую схему Telegram и настраиваем навигацию сразу для лучшего UX
        applyTelegramColorScheme();
        setupScrollbarVisibility();
        setupNavigation(document.querySelectorAll('.bottom-nav .nav-item'), {});
        
        // Инициализация Telegram WebApp
        if (telegram) {
            telegram.expand(); // Расширяем приложение на весь экран
        }
        
        // Инициализируем поддержку TGS анимаций
        initTgsSupport();
        
        // Инициализируем TimerManager как можно раньше
        try {
            TimerManager.initTimerManager();
            console.log('TimerManager инициализирован');
        } catch (timerError) {
            console.error('Ошибка инициализации TimerManager:', timerError);
        }
        
        // Инициализируем оптимизатор заданий
        if (!window.tasksOptimizer) {
            try {
                window.tasksOptimizer = new TasksOptimizer();
                console.log('TasksOptimizer инициализирован');
            } catch (optimizerError) {
                console.error('Ошибка инициализации TasksOptimizer:', optimizerError);
            }
        }
        
        // Обновляем тексты фильтров с использованием i18n
        if (window.i18n) {
            try {
                document.querySelectorAll('.tasks-filter-item').forEach(item => {
                    const key = item.getAttribute('data-i18n');
                    if (key) {
                        item.textContent = window.i18n.t(key);
                    }
                });
                console.log('Локализация фильтров применена');
            } catch (i18nError) {
                console.error('Ошибка локализации фильтров:', i18nError);
            }
        }
        
        // Получаем данные пользователя
        try {
            userInfo = telegram?.initDataUnsafe?.user || null;
            
            if (!userInfo || !userInfo.id) {
                // Попытка получить ID из URL или других источников в режиме разработки
                if (window.isDevMode) {
                    userInfo = { id: 136814725, first_name: 'Test User' };
                    console.log('Используем тестового пользователя в режиме разработки');
                } else {
                    throw new Error('Не удалось получить данные пользователя');
                }
            }
            
            console.log('Данные пользователя:', userInfo);
        } catch (error) {
            console.error('Ошибка при получении данных пользователя:', error);
            showTasksError('Ошибка: не удалось получить данные пользователя');
            return;
        }
        
        // Инициализируем фильтры заданий
        try {
            initTaskFilters();
            console.log('Фильтры заданий инициализированы');
        } catch (filtersError) {
            console.error('Ошибка инициализации фильтров:', filtersError);
        }
        
        // Получаем задания с сервера
        console.log('Начинаем загрузку заданий...');
        await fetchTasks();
        
        // Ждем завершения рендера всех карточек перед скрытием прелоадера
        console.log('⏳ Ожидаем завершения рендера карточек перед скрытием прелоадера...');
        const renderStartTime = performance.now();
        await waitForTasksRender();
        const renderEndTime = performance.now();
        console.log(`✅ Рендер завершен за ${Math.round(renderEndTime - renderStartTime)}мс`);
        
        initSuccess = true;
        console.log('Инициализация страницы заданий завершена успешно');
        
    } catch (error) {
        console.error('Критическая ошибка при инициализации страницы заданий:', error);
        
        // Показываем пользователю сообщение об ошибке
        showTasksError('Ошибка инициализации приложения. Попробуйте перезагрузить страницу.');
        
    } finally {
        // Скрываем прелоадер после загрузки всех данных (даже при ошибке)
        try {
            const preloader = document.getElementById('preloader');
            if (preloader) {
                console.log(`🎭 Скрываем прелоадер (статус: ${initSuccess ? 'успех' : 'ошибка'})`);
                preloader.classList.add('hidden');
                setTimeout(() => {
                    if (preloader.parentNode) {
                        preloader.style.display = 'none';
                        console.log('🎭 Прелоадер полностью скрыт');
                    }
                }, initSuccess ? 300 : 1000); // Увеличиваем время при ошибке
            }
        } catch (preloaderError) {
            console.error('Ошибка при скрытии прелоадера:', preloaderError);
        }
    }
}

// Функция для получения заданий с сервера (ОПТИМИЗИРОВАННАЯ)
async function fetchTasks() {
    try {
        // Получаем ID пользователя
        const userId = userInfo?.id;
        
        if (!userId) {
            console.error('Не удалось получить ID пользователя');
            // Показываем ошибку пользователю
            showTasksError('Ошибка: не удалось получить данные пользователя');
            return;
        }
        
        let result;
        let attemptCount = 0;
        const maxAttempts = 3;
        
        // Пытаемся получить задания с несколькими попытками
        while (attemptCount < maxAttempts) {
            try {
                attemptCount++;
                console.log(`Попытка ${attemptCount} получения заданий для пользователя ${userId}`);
                
                // Всегда используем оптимизированный загрузчик заданий для страницы заданий
                if (window.tasksOptimizer) {
                    console.log('Используем оптимизированное получение заданий для INITIAL_LOAD');
                    result = await window.tasksOptimizer.getOptimizedTasks(
                        userId, 
                        window.tasksOptimizer.ACTION_TYPES.INITIAL_LOAD
                    );
                    console.log('Результат оптимизированного запроса:', result);
                } else {
                    console.warn('TasksOptimizer недоступен, используем обычный API');
                    result = await fetchTasksFallback(userId);
                }
                
                // Если получили успешный результат, прерываем цикл
                if (result && result.success) {
                    break;
                }
                
                console.warn(`Попытка ${attemptCount} неудачна:`, result?.error || 'Неизвестная ошибка');
                
                // Если это не последняя попытка, ждем перед повтором
                if (attemptCount < maxAttempts) {
                    await new Promise(resolve => setTimeout(resolve, 1000 * attemptCount));
                }
                
            } catch (error) {
                console.error(`Ошибка в попытке ${attemptCount}:`, error);
                
                // Если это последняя попытка или критическая ошибка, используем fallback
                if (attemptCount === maxAttempts || error.message.includes('NetworkError')) {
                    console.warn('Переключаемся на fallback API');
                    try {
                        result = await fetchTasksFallback(userId);
                        if (result && result.success) {
                            break;
                        }
                    } catch (fallbackError) {
                        console.error('Fallback API также не работает:', fallbackError);
                    }
                }
                
                // Если это не последняя попытка, ждем перед повтором
                if (attemptCount < maxAttempts) {
                    await new Promise(resolve => setTimeout(resolve, 1000 * attemptCount));
                }
            }
        }
        
        // Проверяем итоговый результат
        if (!result || !result.success) {
            throw new Error(result?.error || 'Не удалось получить задания после всех попыток');
        }
        
        // Сохраняем полученные задания
        tasksData = result.tasks || [];
        
        if (tasksData.length > 0) {
            console.log(`Получено ${tasksData.length} заданий, начинаем рендер`);
            // Рендерим полученные задания и сохраняем Promise
            renderPromise = renderServerTasks(tasksData);
        } else {
            console.log('Получен пустой список заданий');
            // Показываем сообщение о том, что заданий нет
            showEmptyTasksMessage();
            renderPromise = Promise.resolve(); // Создаем resolved Promise для пустого списка
        }
        
        // Скрываем заглушки если есть задания
        hideEmptyMessagesIfTasksExist();
        
    } catch (error) {
        console.error('Критическая ошибка при получении заданий:', error);
        showTasksError('Ошибка загрузки заданий. Попробуйте перезагрузить страницу.');
        renderPromise = Promise.resolve(); // Устанавливаем resolved Promise при ошибке
    }
}

// Fallback функция для получения заданий через обычный API
async function fetchTasksFallback(userId) {
    // Формируем URL с учетом режима разработки
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

// Функция для рендеринга заданий, полученных с сервера
async function renderServerTasks(tasks) {
    console.log('Начинаем рендер заданий:', tasks.length);
    
    if (!tasks || tasks.length === 0) {
        console.log('Список заданий пуст');
        showEmptyTasksMessage();
        return Promise.resolve();
    }
    
    try {
        // Очищаем существующие контейнеры заданий
        clearTaskContainers();
        
        // Показываем индикаторы загрузки
        showLoadingIndicators();
        
        // Группируем задания по типу (делаем это синхронно для скорости)
        const dailyTasks = [];
        const weeklyTasks = [];
        const specialTasks = [];
        const achievementTasks = [];
        
        tasks.forEach(task => {
            if (!task || !task.type) {
                console.warn('Задание без типа:', task);
                return;
            }
            
            switch (task.type) {
                case 'daily':
                    dailyTasks.push(task);
                    break;
                case 'weekly':
                    weeklyTasks.push(task);
                    break;
                case 'special':
                    specialTasks.push(task);
                    break;
                case 'achievement':
                    achievementTasks.push(task);
                    break;
                default:
                    console.warn('Неизвестный тип задания:', task.type);
            }
        });
        
        console.log(`Сгруппированы задания: ежедневные=${dailyTasks.length}, еженедельные=${weeklyTasks.length}, особые=${specialTasks.length}, достижения=${achievementTasks.length}`);
        
        // Разделяем особые задания на выполненные и невыполненные
        const uncompletedSpecialTasks = specialTasks.filter(task => task.status !== 'completed');
        const completedSpecialTasks = specialTasks.filter(task => task.status === 'completed');
        
        // Используем requestAnimationFrame для плавного рендеринга и возвращаем Promise
        return new Promise((resolve, reject) => {
            requestAnimationFrame(() => {
                console.log('Очищаем контейнеры и начинаем рендер групп');
                clearTaskContainers();
                
                // Рендерим группы заданий последовательно для контроля производительности
                const renderPromises = [
                    renderTaskGroupAsync(uncompletedSpecialTasks, 'topSpecialTasks', 'невыполненные особые'),
                    renderTaskGroupAsync(dailyTasks, 'dailyTasks', 'ежедневные'),
                    renderTaskGroupAsync(weeklyTasks, 'weeklyTasks', 'еженедельные'),
                    renderTaskGroupAsync(completedSpecialTasks, 'specialTasks', 'выполненные особые'),
                    renderTaskGroupAsync(achievementTasks, 'achievementTasks', 'достижения')
                ];
                
                // Ждем завершения всех рендеров
                Promise.all(renderPromises).then(() => {
                    console.log('Все группы заданий отрендерены');
                    
                    // Восстанавливаем таймеры для заданий подписки
                    try {
                        restoreSubscriptionTimers([...specialTasks, ...dailyTasks, ...weeklyTasks, ...achievementTasks]);
                        console.log('Таймеры восстановлены');
                    } catch (timerError) {
                        console.error('Ошибка при восстановлении таймеров:', timerError);
                    }
                    
                    // Резолвим Promise после завершения всего рендера
                    resolve();
                    
                }).catch(renderError => {
                    console.error('Ошибка при рендере групп заданий:', renderError);
                    showTasksError('Ошибка отображения заданий');
                    reject(renderError);
                });
            });
        });
        
    } catch (error) {
        console.error('Критическая ошибка при рендере заданий:', error);
        showTasksError('Критическая ошибка отображения заданий');
        return Promise.reject(error);
    }
}

// Асинхронная функция рендера группы заданий
async function renderTaskGroupAsync(tasks, containerId, groupName) {
    return new Promise((resolve, reject) => {
        try {
            console.log(`Рендерим группу "${groupName}": ${tasks.length} заданий`);
            
            if (tasks.length === 0) {
                console.log(`Группа "${groupName}" пуста`);
                resolve();
                return;
            }
            
            // Используем setTimeout для асинхронного рендера
            setTimeout(() => {
                try {
                    renderTaskGroup(tasks, containerId);
                    console.log(`Группа "${groupName}" отрендерена успешно`);
                    resolve();
                } catch (error) {
                    console.error(`Ошибка рендера группы "${groupName}":`, error);
                    reject(error);
                }
            }, 0);
            
        } catch (error) {
            reject(error);
        }
    });
}

// Функция показа индикаторов загрузки
function showLoadingIndicators() {
    const containers = ['topSpecialTasks', 'dailyTasks', 'weeklyTasks', 'specialTasks', 'achievementTasks'];
    containers.forEach(containerId => {
        const container = document.getElementById(containerId);
        if (container) {
            const loadingIndicator = document.createElement('div');
            loadingIndicator.className = 'task-loading-indicator';
            loadingIndicator.textContent = window.i18n?.t('tasks.loading', { defaultValue: 'Загрузка...' }) || 'Загрузка...';
            container.appendChild(loadingIndicator);
        }
    });
}

// Функция для очистки контейнеров заданий
function clearTaskContainers() {
    const containers = [
        document.getElementById('topSpecialTasks'),
        document.getElementById('dailyTasks'),
        document.getElementById('weeklyTasks'),
        document.getElementById('specialTasks'),
        document.getElementById('achievementTasks')
    ];
    
    containers.forEach(container => {
        if (container) {
            container.innerHTML = '';
        }
    });
}

// Функция для рендеринга группы заданий в контейнер
function renderTaskGroup(tasks, containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;
    
    // Создаем фрагмент для эффективного добавления в DOM
    const fragment = document.createDocumentFragment();
    
    tasks.forEach(task => {
        // Используем единый компонент renderTask для всех типов карточек
        renderTask(task, fragment, handleTaskAction);
    });
    
    // Добавляем все карточки за одну DOM-операцию
    container.appendChild(fragment);
}

// Функция для инициализации фильтров заданий
function initTaskFilters() {
    const filterItems = document.querySelectorAll('.tasks-filter-item');
    
    // Добавляем обработчики нажатий на фильтры
    filterItems.forEach(item => {
        item.addEventListener('click', () => {
            // Убираем активный класс у всех фильтров
            filterItems.forEach(filter => filter.classList.remove('active'));
            
            // Добавляем активный класс к выбранному фильтру
            item.classList.add('active');
            
            // Фильтруем задания в зависимости от выбранного фильтра
            filterTasks(item.dataset.filter);
        });
    });
}

// Функция для фильтрации заданий
function filterTasks(filterType) {
    // Получаем заголовки и списки заданий
    const dailyHeader = document.querySelector('[data-i18n="tasks.daily"]');
    const weeklyHeader = document.querySelector('[data-i18n="tasks.weekly"]');
    const specialHeader = document.querySelector('[data-i18n="tasks.special"]');
    const achievementsHeader = document.querySelector('[data-i18n="tasks.achievements"]');
    
    const topSpecialTasksSection = document.getElementById('topSpecialTasksSection');
    const topSpecialTasks = document.getElementById('topSpecialTasks');
    const dailyTasks = document.getElementById('dailyTasks');
    const weeklyTasks = document.getElementById('weeklyTasks');
    const specialTasks = document.getElementById('specialTasks');
    const achievementTasks = document.getElementById('achievementTasks');
    
    // Получаем сообщения о пустых разделах
    const emptyDailyTasks = document.getElementById('emptyDailyTasks');
    const emptyWeeklyTasks = document.getElementById('emptyWeeklyTasks');
    const emptySpecialTasks = document.getElementById('emptySpecialTasks');
    const emptyAchievementTasks = document.getElementById('emptyAchievementTasks');
    
    // Установка правильных текстов для заглушек через i18n
    if (window.i18n) {
        const emptyText = window.i18n.t('tasks.no_tasks_available');
        if (emptyDailyTasks) emptyDailyTasks.textContent = emptyText;
        if (emptyWeeklyTasks) emptyWeeklyTasks.textContent = emptyText;
        if (emptySpecialTasks) emptySpecialTasks.textContent = emptyText;
        if (emptyAchievementTasks) emptyAchievementTasks.textContent = emptyText;
    }
    
    // Функция для проверки наличия заданий в разделе
    function hasTasksInSection(section) {
        if (!section) return false;
        const taskCards = section.querySelectorAll('.task-card');
        return taskCards.length > 0;
    }
    
    // Функция для отображения секции с учетом наличия заданий
    function showSection(section, emptyMessage, showHeader = true) {
        if (!section) return;
        
        section.style.display = '';
        
        if (hasTasksInSection(section)) {
            // Есть задания - скрываем заглушку
            if (emptyMessage) emptyMessage.style.display = 'none';
        } else {
            // Нет заданий - показываем заглушку
            if (emptyMessage) emptyMessage.style.display = '';
        }
    }
    
    // Функция для скрытия секции
    function hideSection(section, header) {
        if (section) section.style.display = 'none';
        if (header) header.style.display = 'none';
    }
    
    // Показываем или скрываем секции в зависимости от фильтра
    switch (filterType) {
        case 'all':
            // Показываем невыполненные особые задания вверху (только в фильтре "Все")
            showElement(topSpecialTasksSection);
            
            // Показываем все секции с заголовками
            showElement(dailyHeader);
            showSection(dailyTasks, emptyDailyTasks);
            
            showElement(weeklyHeader);
            showSection(weeklyTasks, emptyWeeklyTasks);
            
            showElement(specialHeader);
            showSection(specialTasks, emptySpecialTasks);
            
            showElement(achievementsHeader);
            showSection(achievementTasks, emptyAchievementTasks);
            break;
            
        case 'daily':
            // Скрываем верхний контейнер особых заданий в других фильтрах
            hideElement(topSpecialTasksSection);
            
            // Показываем только ежедневные задания без заголовка
            hideElement(dailyHeader);
            showSection(dailyTasks, emptyDailyTasks);
            
            hideSection(weeklyTasks, weeklyHeader);
            hideSection(specialTasks, specialHeader);
            hideSection(achievementTasks, achievementsHeader);
            break;
            
        case 'weekly':
            // Скрываем верхний контейнер особых заданий в других фильтрах
            hideElement(topSpecialTasksSection);
            
            // Показываем только еженедельные задания без заголовка
            hideSection(dailyTasks, dailyHeader);
            
            hideElement(weeklyHeader);
            showSection(weeklyTasks, emptyWeeklyTasks);
            
            hideSection(specialTasks, specialHeader);
            hideSection(achievementTasks, achievementsHeader);
            break;
            
        case 'special':
            // Скрываем верхний контейнер особых заданий в других фильтрах
            hideElement(topSpecialTasksSection);
            
            // Показываем только особые задания без заголовка
            hideSection(dailyTasks, dailyHeader);
            hideSection(weeklyTasks, weeklyHeader);
            
            hideElement(specialHeader);
            showSection(specialTasks, emptySpecialTasks);
            
            hideSection(achievementTasks, achievementsHeader);
            break;
    }
}

// Вспомогательные функции для показа/скрытия элементов
function showElement(element) {
    if (element) {
        element.style.display = '';
    }
}

function hideElement(element) {
    if (element) {
        element.style.display = 'none';
    }
}


// Функция для скрытия заглушек, если в соответствующих разделах есть задания
function hideEmptyMessagesIfTasksExist() {
    const sections = [
        { tasksId: 'dailyTasks', emptyId: 'emptyDailyTasks' },
        { tasksId: 'weeklyTasks', emptyId: 'emptyWeeklyTasks' },
        { tasksId: 'specialTasks', emptyId: 'emptySpecialTasks' },
        { tasksId: 'achievementTasks', emptyId: 'emptyAchievementTasks' }
    ];
    
    sections.forEach(section => {
        const tasksContainer = document.getElementById(section.tasksId);
        const emptyMessage = document.getElementById(section.emptyId);
        
        if (tasksContainer && emptyMessage) {
            // Проверяем наличие карточек заданий
            const hasCards = tasksContainer.querySelectorAll('.task-card').length > 0;
            
            // Скрываем заглушку, если есть карточки
            emptyMessage.style.display = hasCards ? 'none' : '';
        }
    });
}

// Обработчик нажатия на кнопку задания
async function handleTaskAction(task) {
    const taskElement = document.querySelector(`[data-task-id="${task.id}"]`);
    const button = taskElement?.querySelector('.task-button');
        
    console.log('Действие для задания:', task);
    
    try {
        // Специальная обработка для заданий подписки в статусе "Подписаться"
        if (task.verifierType === 'subscription' && task.status === 'not_started') {
            // Открываем канал для подписки
            openChannelForSubscription(task.subscriptionInfo?.inviteLink || "https://t.me/+hmWyUf44YdcwZDYy");
            
            // Показываем индикатор загрузки в кнопке
            if (button) {
                const originalText = button.innerHTML;
                button.innerHTML = '<span class="loading-spinner"></span>';
                button.classList.add('loading');
                button.disabled = true;
                button.dataset.originalText = originalText;
            }
            
            // Функция для проверки подписки с повторными попытками
            const checkSubscriptionWithRetries = async (attempt = 1, maxAttempts = 2) => {
                console.log(`Попытка проверки подписки ${attempt}/${maxAttempts} для задания ${task.id}`);
                
            const isSubscribed = await verifyTaskCompletion(task);
            
                         if (isSubscribed) {
                    console.log('Пользователь подписан, проверка завершена');
                 task.status = 'in_progress';
                 
                 if (taskElement && !taskElement.classList.contains('has-timer')) {
                     taskElement.classList.add('has-timer');
                 }
                
                    if (button) {
                        button.classList.remove('loading');
                    }
                    
                const timerElement = taskElement?.querySelector('.task-timer');
                if (timerElement) {
                    document.addEventListener('timerExpired', function timerExpiredHandler(e) {
                        if (e.detail.taskId === task.id) {
                                button.textContent = window.i18n?.t('tasks.btn_claim') || 'Получить';
                                button.disabled = false;
                                document.removeEventListener('timerExpired', timerExpiredHandler);
                            localStorage.setItem(`subscription_timer_expired_${task.id}`, 'true');
                        }
                    });
                }
                    return { success: true };
                }
                
                // Если не подписан и есть еще попытки
                if (attempt < maxAttempts) {
                    console.log(`Пользователь не подписан, ждем 3 секунды до следующей проверки (попытка ${attempt + 1}/${maxAttempts})`);
                    setTimeout(() => {
                        checkSubscriptionWithRetries(attempt + 1, maxAttempts);
                    }, 3000);
            } else {
                    // Если после всех попыток пользователь не подписан
                    console.log('Все попытки проверки исчерпаны, показываем кнопку "Проверить"');
                
                    task.status = 'check_manually';
                    
                if (button) {
                        button.innerHTML = window.i18n?.t('tasks.btn_check') || 'Проверить';
                    button.classList.remove('loading');
                    button.disabled = false;
                }
            }
            
                return { success: false };
            };
        
            // Первая проверка через 3 секунды
            setTimeout(() => {
                checkSubscriptionWithRetries(1, 2);
            }, 3000);
            
            return { success: false };
        }

        // Специальная обработка для заданий подписки в статусе "Проверить"
        if (task.verifierType === 'subscription' && task.status === 'check_manually') {
            console.log('Проверяем подписку вручную для задания:', task.id);
            
            // Показываем индикатор загрузки в кнопке
            if (button) {
                const originalText = button.innerHTML;
                button.innerHTML = '<span class="loading-spinner"></span>';
                button.classList.add('loading');
                button.disabled = true;
                button.dataset.originalText = originalText;
            }
            
            // Проверяем подписку без открытия канала (принудительная проверка)
            const isSubscribed = await verifyTaskCompletion(task, true);
            
            // Функция для проверки подписки с повторными попытками
            const checkSubscriptionWithRetries = async (attempt = 1, maxAttempts = 2) => {
                console.log(`Попытка проверки подписки ${attempt}/${maxAttempts} для задания ${task.id}`);
                
                const isSubscribed = await verifyTaskCompletion(task, true);
                
                if (isSubscribed) {
                    console.log('Пользователь подписан, проверка завершена');
                    task.status = 'in_progress';
                    
                    if (taskElement && !taskElement.classList.contains('has-timer')) {
                        taskElement.classList.add('has-timer');
                    }
                    
                    if (button) {
                        button.classList.remove('loading');
                    }
                    
                    const timerElement = taskElement?.querySelector('.task-timer');
                    if (timerElement) {
                        timerElement.addEventListener('click', () => {
                            const currentExpired = localStorage.getItem(`subscription_timer_expired_${task.id}`) === 'true';
                            if (currentExpired) {
                                handleTaskAction(task);
                            }
                        });
                        
                        document.addEventListener('timerExpired', function timerExpiredHandler(e) {
                            if (e.detail.taskId === task.id) {
                                    button.textContent = window.i18n?.t('tasks.btn_claim') || 'Получить';
                                button.style.display = '';
                                document.removeEventListener('timerExpired', timerExpiredHandler);
                            }
                        });
                    }
                    
                    return { success: true };
                } else {
                    console.log('Пользователь не подписан, возвращаем к начальному состоянию');
                    task.status = 'not_started';
                    if (button) {
                        button.innerHTML = window.i18n?.t('tasks.btn_subscribe') || 'Подписаться';
                        button.classList.remove('loading');
                        button.disabled = false;
                    }
                }
                
                return { success: false };
            };
            
            // Проверяем с повторными попытками
            if (isSubscribed) {
                return await checkSubscriptionWithRetries();
            } else {
                console.log('Пользователь не подписан, остается в статусе check_manually');
                
                if (taskElement) {
                    const existingTimer = taskElement.querySelector('.task-timer');
                    if (existingTimer) {
                        existingTimer.remove();
                    }
                    taskElement.classList.remove('has-timer');
                }
                
                const isSubscribed = await verifyTaskCompletion(task, true);
                if (!isSubscribed) {
                task.status = 'not_started';
                if (button) {
                    button.innerHTML = window.i18n?.t('tasks.btn_subscribe') || 'Подписаться';
                    button.classList.remove('loading');
                    button.disabled = false;
                }
                    console.log(`Задание ${task.id} сброшено к состоянию not_started из-за отписки`);
                
                    return { success: false };
                }
            }
            
            setTimeout(() => {
                return checkSubscriptionWithRetries();
            }, 3000);
            
            return { success: false };
                }
                
        // Обработка получения награды после истечения таймера подписки
        if (task.verifierType === 'subscription' && task.status === 'in_progress' && 
            (localStorage.getItem(`subscription_timer_expired_${task.id}`) === 'true' || !task.wait_until)) {
            
            return await executeTaskCompletion(task, taskElement, button, false);
        }

        // === ЕДИНАЯ ЛОГИКА ДЛЯ ВСЕХ ОСТАЛЬНЫХ ЗАДАНИЙ ===
        // Определяем, нужна ли верификация перед выполнением
        const needsVerification = task.verifierType !== 'experience';
        
        return await executeTaskCompletion(task, taskElement, button, needsVerification);

    } catch (error) {
        console.error('Ошибка при выполнении действия:', error);
        return { success: false };
    }
        }
        
/**
 * Единая функция выполнения задания с индикатором загрузки
 */
async function executeTaskCompletion(task, taskElement, button, needsVerification = true) {
            // Показываем индикатор загрузки в кнопке
            if (button) {
                const originalText = button.innerHTML;
                button.innerHTML = '<span class="loading-spinner"></span>';
                button.classList.add('loading');
                button.disabled = true;
                button.dataset.originalText = originalText;
            }
            
    try {
        // Проверяем выполнение задания, если нужно
        let isCompleted = true;
        if (needsVerification) {
            isCompleted = await verifyTaskCompletion(task);
        }

        if (isCompleted) {
            // Выполняем задание
            const result = await completeTask(task.id);
            
            if (result && result.success) {
                // Успешное выполнение
                return handleTaskSuccess(task, taskElement, button, result);
            } else {
                // Ошибка выполнения
                return handleTaskError(task, taskElement, button, result);
            }
        } else {
            // Задание не выполнено - обновляем прогресс
            return handleTaskProgress(task, taskElement, button);
        }
    } catch (error) {
        console.error('Ошибка при выполнении задания:', error);
        return handleTaskError(task, taskElement, button, { error: error.message });
    }
}

/**
 * Обработка успешного выполнения задания
 */
function handleTaskSuccess(task, taskElement, button, result) {
                // Обновляем отображение задания
                taskElement.classList.add('completed');
    taskElement.classList.remove('has-timer');
    
                if (button) {
                    button.textContent = '';
                    button.disabled = true;
        button.classList.remove('loading');
    }
    
    // Если это особое задание, перемещаем его в нижний блок
    if (task.type === 'special') {
        moveCompletedSpecialTask(task.id);
    }
    
    // Очищаем флаги таймера для заданий подписки
    if (task.verifierType === 'subscription') {
        localStorage.removeItem(`subscription_timer_expired_${task.id}`);
                }
                
                // Увеличиваем счетчик выполненных заданий
                incrementTasksCounter();
                
                // Показываем модальное окно с наградой
                showTaskComplete({
                    ...task,
                    reward: result.reward || task.reward
                }, () => {
                    console.log('Модальное окно закрыто');
                });
    
    return { success: true };
}

/**
 * Обработка ошибки выполнения задания
 */
function handleTaskError(task, taskElement, button, result) {
                if (button) {
                    button.disabled = false;
                    button.innerHTML = window.i18n?.t('tasks.btn_claim') || 'Получить';
                    button.classList.remove('loading');
                    
                    // Показываем сообщение об ошибке
                    const originalText = button.textContent;
                    button.textContent = result?.error === 'Задание не выполнено' ? 
                        (window.i18n?.t('tasks.btn_not_completed') || 'Не выполнено') : 
                        (window.i18n?.t('common.error') || 'Ошибка');
                    button.classList.add('task-button-error');
                    
                    // Возвращаем текст кнопки через 2 секунды
                    setTimeout(() => {
                        button.textContent = originalText;
                        button.classList.remove('task-button-error');
                    }, 2000);
                }
    
                console.error('Ошибка при выполнении задания:', result);
    return { success: false };
}

/**
 * Обработка обновления прогресса задания
 */
function handleTaskProgress(task, taskElement, button) {
            // Если задание не выполнено, но есть прогресс
            if (task.hasOwnProperty('progress')) {
                const currentProgress = task.progress;
                task.progress = Math.min(100, currentProgress + 20);
                
                const progressBar = taskElement.querySelector('.task-progress-bar');
                const progressText = taskElement.querySelector('.task-progress-text');
                
                if (progressBar) {
                    progressBar.style.width = `${task.progress}%`;
                }
                
                if (progressText) {
                    progressText.textContent = `${task.progress}%`;
                }
                
                // Если прогресс достиг 100%, меняем текст кнопки на "Получить"
                if (task.progress >= 100) {
                    if (button) {
                        button.textContent = window.i18n?.t('tasks.btn_claim') || 'Получить';
                button.classList.remove('loading');
                button.disabled = false;
                            }
                            
            // Рекурсивно вызываем выполнение задания
            return executeTaskCompletion(task, taskElement, button, true);
        }
    }
    
    // Восстанавливаем кнопку
                    if (button) {
        button.classList.remove('loading');
        button.disabled = false;
        button.innerHTML = button.dataset.originalText || (window.i18n?.t('tasks.btn_claim') || 'Получить');
                }
    
    return { success: false };
}

// Функция для восстановления таймеров заданий подписки
function restoreSubscriptionTimers(tasks) {
    console.log('Восстанавливаем таймеры для заданий:', tasks.length);
    
    tasks.forEach(task => {
        if (task.verifierType === 'subscription' && task.status === 'in_progress' && task.wait_until) {
            console.log(`Восстанавливаем таймер для задания ${task.id}, wait_until: ${task.wait_until}`);
            
            const taskCard = document.querySelector(`.task-card[data-task-id="${task.id}"]`);
            if (taskCard) {
                console.log(`Найдена карточка для задания ${task.id}, устанавливаем таймер`);
                
                // Проверяем, нет ли уже таймера в карточке
                const existingTimer = taskCard.querySelector('.task-timer');
                if (existingTimer) {
                    console.log(`Таймер для задания ${task.id} уже существует, удаляем старый`);
                    existingTimer.remove();
                }
                
                // Устанавливаем таймер
                TimerManager.setTimer(task.id, task.wait_until, taskCard);
                
                // Добавляем класс has-timer
                taskCard.classList.add('has-timer');
                
                // ВАЖНО: Скрываем кнопку пока таймер активен, но только если задание не выполнено
                const button = taskCard.querySelector('.task-button');
                if (button) {
                    // Проверяем, выполнено ли задание (прогресс >= 100%)
                    const isTaskCompleted = task.progress >= 100;
                    
                    if (!isTaskCompleted) {
                        button.style.display = 'none';
                        console.log(`Скрыли кнопку для задания ${task.id} пока таймер активен`);
                    } else {
                        // Если задание выполнено, показываем кнопку "Получить"
                        button.style.display = '';
                        button.textContent = window.i18n?.t('tasks.btn_claim') || 'Получить';
                        console.log(`Задание ${task.id} выполнено, показываем кнопку "Получить"`);
                    }
                }
                
                // Устанавливаем обработчик для истечения таймера
                document.addEventListener('timerExpired', function timerExpiredHandler(e) {
                    if (e.detail.taskId === task.id) {
                        // Удаляем обработчик
                        document.removeEventListener('timerExpired', timerExpiredHandler);
                        
                        // Обновляем кнопку после истечения таймера
                        const button = taskCard?.querySelector('.task-button');
                        if (button) {
                            button.style.display = '';  // Показываем кнопку
                            button.textContent = window.i18n?.t('tasks.btn_claim') || 'Получить';
                            button.disabled = false;
                            console.log(`Таймер истек для задания ${task.id}, показываем кнопку "Получить"`);
                        }
                        
                        // Сохраняем информацию об истечении таймера
                        localStorage.setItem(`subscription_timer_expired_${task.id}`, 'true');
                    }
                });
            } else {
                console.warn(`Карточка для задания ${task.id} не найдена в DOM`);
            }
        } else {
            console.log(`Задание ${task.id} не подходит для восстановления таймера: verifierType=${task.verifierType}, status=${task.status}, wait_until=${task.wait_until}`);
        }
    });
}

// Функция для перемещения выполненного особого задания из верхнего контейнера в нижний
function moveCompletedSpecialTask(taskId) {
    try {
        // Ищем карточку задания в верхнем контейнере
        const topContainer = document.getElementById('topSpecialTasks');
        const taskCard = topContainer?.querySelector(`.task-card[data-task-id="${taskId}"]`);
        
        if (taskCard) {
            // Получаем нижний контейнер особых заданий
            const bottomContainer = document.getElementById('specialTasks');
            
            if (bottomContainer) {
                // Перемещаем карточку из верхнего контейнера в нижний
                taskCard.remove();
                bottomContainer.appendChild(taskCard);
                
                console.log(`Особое задание ${taskId} перемещено из верхнего контейнера в нижний`);
                
                // Если верхний контейнер стал пустым, скрываем его секцию (но только если активен фильтр "all")
                const activeFilter = document.querySelector('.tasks-filter-item.active')?.dataset.filter;
                if (activeFilter === 'all' && topContainer.children.length === 0) {
                    const topSection = document.getElementById('topSpecialTasksSection');
                    if (topSection) {
                        topSection.style.display = 'none';
                    }
                }
                
                // Показываем заголовок особых заданий, если он был скрыт и теперь есть выполненные задания
                if (activeFilter === 'all') {
                    const specialHeader = document.querySelector('[data-i18n="tasks.special"]');
                    const specialTasksEmpty = document.getElementById('emptySpecialTasks');
                    
                    if (specialHeader) {
                        specialHeader.style.display = '';
                    }
                    if (specialTasksEmpty) {
                        specialTasksEmpty.style.display = 'none';
                    }
                }
            }
        }
    } catch (error) {
        console.error('Ошибка при перемещении особого задания:', error);
    }
}

// Функция для увеличения счетчика выполненных заданий
function incrementTasksCounter() {
    // Эта функция больше не используется, так как мы убрали блок с профилем пользователя,
    // но оставим ее для возможного использования в будущем
    console.log('Задание выполнено');
}

// Улучшенная система инициализации для устранения race condition
let initializationAttempted = false;
let initializationPromise = null;

// Безопасная функция инициализации с защитой от повторных вызовов
async function safeInitTasksPage() {
    // Если инициализация уже происходит, ждем ее завершения
    if (initializationPromise) {
        console.log('Инициализация уже выполняется, ожидаем завершения');
        return initializationPromise;
    }
    
    // Если инициализация уже была выполнена, не запускаем повторно
    if (initializationAttempted) {
        console.log('Инициализация уже была выполнена');
        return Promise.resolve();
    }
    
    initializationAttempted = true;
    console.log('Запускаем безопасную инициализацию страницы заданий');
    
    initializationPromise = initTasksPage();
    
    try {
        await initializationPromise;
        console.log('Инициализация успешно завершена');
    } catch (error) {
        console.error('Ошибка при инициализации:', error);
        // Сбрасываем флаги для возможности повторной попытки
        initializationAttempted = false;
        initializationPromise = null;
        throw error;
    }
    
    return initializationPromise;
}

// Функция проверки готовности к инициализации
function checkReadinessAndInit() {
    const isDomReady = document.readyState !== 'loading';
    const areTranslationsReady = window.i18n && typeof window.i18n.t === 'function';
    
    console.log(`Проверка готовности: DOM=${isDomReady}, переводы=${areTranslationsReady}`);
    
    if (isDomReady && areTranslationsReady && !initializationAttempted) {
        console.log('Все компоненты готовы, запускаем инициализацию');
        safeInitTasksPage().catch(error => {
            console.error('Критическая ошибка инициализации:', error);
        });
    }
}

// Ожидаем загрузку DOM и переводов
document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM загружен');
    
    // Проверяем готовность сразу
    checkReadinessAndInit();
    
    // Слушаем событие загрузки переводов
    document.addEventListener('translationsLoaded', () => {
        console.log('Событие translationsLoaded получено');
        checkReadinessAndInit();
    });
    
    // Добавляем обработчик события смены языка
    document.addEventListener('languageChanged', () => {
        // Обновляем тексты фильтров при смене языка
        document.querySelectorAll('.tasks-filter-item').forEach(item => {
            const key = item.getAttribute('data-i18n');
            if (key && window.i18n) {
                item.textContent = window.i18n.t(key);
            }
        });
    });
    
    // Запасной вариант с увеличенной задержкой
    setTimeout(() => {
        if (!initializationAttempted) {
            console.log('Запасная инициализация через 2 секунды');
            checkReadinessAndInit();
        }
    }, 2000);
});

// Проверяем сразу при загрузке модуля
checkReadinessAndInit();

// Функция для отображения ошибки загрузки заданий
function showTasksError(errorMessage) {
    const containers = ['dailyTasks', 'weeklyTasks', 'specialTasks', 'achievementTasks'];
    containers.forEach(containerId => {
        const container = document.getElementById(containerId);
        if (container) {
            container.innerHTML = `
                <div class="task-error">
                    <div class="error-icon">⚠️</div>
                    <div class="error-message">${errorMessage}</div>
                    <button class="retry-button" onclick="location.reload()">Перезагрузить</button>
                </div>
            `;
        }
    });
}

// Функция для отображения сообщения о пустых заданиях
function showEmptyTasksMessage() {
    const containers = ['dailyTasks', 'weeklyTasks', 'specialTasks', 'achievementTasks'];
    containers.forEach(containerId => {
        const container = document.getElementById(containerId);
        if (container) {
            const emptyMessage = container.querySelector('.empty-message');
            if (emptyMessage) {
                emptyMessage.style.display = 'block';
            }
        }
    });
}

// Функция ожидания завершения рендера заданий
async function waitForTasksRender() {
    if (renderPromise) {
        try {
            console.log('Ожидаем завершения рендера заданий...');
            await renderPromise;
            console.log('Рендер заданий завершен');
        } catch (error) {
            console.error('Ошибка при ожидании рендера:', error);
        }
    } else {
        console.log('Рендер заданий не был запущен');
    }
} 