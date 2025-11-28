/**
 * Централизованные константы проекта
 * Все константы приложения должны быть определены здесь
 */

// ==================== Layout константы ====================
export const ROOT_RADIUS = 225;  // Радиус корневого узла
export const NODE_RADIUS = 135;  // Радиус обычных узлов
export const H_STEP = 50;        // Вертикальный шаг (на будущее, сейчас не используется)

// ==================== Firefly константы ====================
export const FIREFLY_SIZE = 20;                    // Размер светлячков
export const FIREFLY_ORBIT_RADIUS = 65;           // Смещение радиуса орбиты светлячков от радиуса узла (NODE_RADIUS + это значение)
export const FIREFLY_ROTATION_SPEED = 1.0;        // Скорость вращения светлячков
export const FIREFLY_CORE_SIZE_MULTIPLIER = 0.3;  // Множитель размера ядра светлячка
export const FIREFLY_GLOW_SCALE_MULTIPLIER = 4;   // Множитель масштаба свечения
export const FIREFLY_OUTER_GLOW_SCALE_MULTIPLIER = 6; // Множитель масштаба внешнего свечения
export const FIREFLY_GLOW_TEXTURE_SIZE = 128;     // Размер текстуры свечения (снижено с 256 для производительности)
export const FIREFLY_OUTER_GLOW_TEXTURE_SIZE = 256; // Размер текстуры внешнего свечения (снижено с 512 для производительности)
export const FIREFLY_EMISSIVE_COLOR = 0x00c8ff;   // Цвет свечения светлячка
export const FIREFLY_EMISSIVE_INTENSITY = 5.0;    // Интенсивность свечения
export const FIREFLY_OUTER_GLOW_OPACITY = 0.6;    // Прозрачность внешнего свечения
export const FIREFLY_DELTA_TIME_MULTIPLIER = 0.01; // Множитель для deltaTime при обновлении позиции

// ==================== Camera константы ====================
export const CAMERA_FOV = 75;                     // Поле зрения камеры
export const CAMERA_NEAR = 0.1;                   // Ближняя плоскость отсечения
export const CAMERA_FAR = 50000;                  // Дальняя плоскость отсечения
export const CAMERA_INITIAL_POSITION = { x: 0, y: 800, z: 1000 }; // Начальная позиция камеры
export const CAMERA_INITIAL_DISTANCE = 1500;      // Начальное расстояние камеры для обзора нескольких деревьев
export const CAMERA_ZOOM_STEPS = [0.015, 0.02, 0.04, 0.06, 0.1, 0.15, 0.2, 0.35, 0.5, 0.7, 1.0, 2.2, 3.0];
export const CAMERA_MIN_ZOOM = CAMERA_ZOOM_STEPS[0];               // Минимальный зум
export const CAMERA_MAX_ZOOM = CAMERA_ZOOM_STEPS[CAMERA_ZOOM_STEPS.length - 1];                 // Максимальный зум

// ==================== Detail Mode константы ====================
export const DETAIL_MODE_SCREEN_SIZE_PERCENT = 22;  // Процент ширины экрана, который должен занимать узел (10-80%)
export const DETAIL_MODE_ZOOM = 1.0;                // Значение зума в режиме детального просмотра
export const DETAIL_MODE_ANIMATION_TIME = 1.0;      // Время анимации входа/выхода из режима (секунды)
export const DETAIL_MODE_ACTOR_RADIUS = 400;        // Радиус расположения имен актеров вокруг узла

// ==================== Animation константы ====================
export const ANIMATION_SPEED = 0.05;               // Скорость анимации (lerp factor)

// ==================== Lighting константы ====================
export const AMBIENT_LIGHT_COLOR = 0x404040;       // Цвет окружающего света
export const AMBIENT_LIGHT_INTENSITY = 0.6;        // Интенсивность окружающего света
export const DIRECTIONAL_LIGHT_COLOR = 0xffffff;   // Цвет направленного света
export const DIRECTIONAL_LIGHT_INTENSITY = 0.8;     // Интенсивность направленного света
export const DIRECTIONAL_LIGHT_POSITION = { x: 200, y: 200, z: 200 }; // Позиция направленного света
export const POINT_LIGHT_COLOR = 0xffa500;         // Цвет точечного света
export const POINT_LIGHT_INTENSITY = 1;            // Интенсивность точечного света
export const POINT_LIGHT_DISTANCE = 1000;          // Расстояние точечного света

// ==================== Color константы ====================
export const LEVEL_1_COLOR = 0x4a90e2;             // Синий для уровня 1 (сезоны)
export const LEVEL_2_COLOR = 0x7b68ee;             // Фиолетовый для уровня 2 (режиссеры)
export const LEVEL_3_COLOR = 0x20b2aa;            // Бирюзовый для уровня 3 (серии)
export const DEFAULT_NODE_COLOR = 0x888888;        // Цвет по умолчанию для узлов
export const EDGE_LINE_COLOR = 0xffff00;          // Желтый цвет обводки (линий на планетах)
export const EDGE_LINE_COLOR_WHITE = 0xffffff;      // Белый цвет обводки (для детального режима)
export const TEXT_COLOR = '#ffffff';               // Цвет текста
export const TEXT_STROKE_COLOR = '#000000';        // Цвет обводки текста
export const TEXT_STROKE_WIDTH = 2;                // Толщина обводки текста

// ==================== Geometry константы ====================
export const SPHERE_SEGMENTS = 16;                  // Количество сегментов сферы (снижено с 32 для производительности)
export const SPHERE_RINGS = 16;                    // Количество колец сферы (снижено с 32 для производительности)

// ==================== Texture константы ====================
export const TEXT_SCALE_FACTOR = 2;                // Множитель масштаба для текстовых текстур (снижено с 4 для производительности)
export const TEXT_PADDING = 20;                    // Отступ для текстовых текстур

// ==================== Text Size константы ====================
export const ROOT_TEXT_SIZE = 84;                  // Размер шрифта текста корневых узлов
export const NODE_TEXT_SIZE = 42;                  // Размер шрифта текста обычных узлов (уровни 1-3)
export const MAX_WORDS_PER_LINE = 3;                // Максимальное количество слов в одной строке текста

// ==================== Word Label константы ====================
export const WORD_LABEL_FONT_SIZE = 44;            // Размер шрифта надписей слов
export const WORD_LABEL_CANVAS_WIDTH = 400;        // Ширина canvas надписи
export const WORD_LABEL_CANVAS_HEIGHT = 120;       // Высота canvas надписи
export const WORD_LABEL_SCALE_MULTIPLIER = 1.2;    // Множитель масштаба надписей
export const WORD_LABEL_PLACEMENT_RADIUS = 450;    // Радиус размещения надписей вокруг узла
export const WORD_LABEL_FLOAT_AMPLITUDE = 20;      // Амплитуда покачивания надписей (в единицах)
export const WORD_LABEL_FLOAT_SPEED = 0.8;         // Скорость покачивания надписей

// Градиент свечения для светлячков
export const GLOW_GRADIENT_COLORS = [
  { stop: 0, color: 'rgba(0, 200, 255, 1)' },      // Яркий центр
  { stop: 0.3, color: 'rgba(0, 200, 255, 0.8)' },
  { stop: 0.6, color: 'rgba(0, 180, 255, 0.4)' },
  { stop: 0.8, color: 'rgba(0, 160, 255, 0.15)' },
  { stop: 1, color: 'rgba(0, 160, 255, 0)' }      // Прозрачные края
];

// ==================== Material константы ====================
export const MATERIAL_METALNESS = 0.0;              // Металличность материала
export const MATERIAL_ROUGHNESS = 0.0;              // Шероховатость материала

// ==================== Renderer константы ====================
export const RENDERER_ALPHA = true;                 // Прозрачность рендерера
export const RENDERER_ANTIALIAS = true;             // Сглаживание рендерера

// ==================== UI константы ====================
export const LOADING_SCREEN_FADE_TIME = 500;       // Время затухания загрузочного экрана (мс)

