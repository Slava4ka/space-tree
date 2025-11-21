import * as THREE from 'three';
import { 
  GLOW_GRADIENT_COLORS,
  TEXT_PADDING,
  TEXT_SCALE_FACTOR,
  TEXT_COLOR,
  TEXT_STROKE_COLOR,
  TEXT_STROKE_WIDTH
} from './constants.js';

/**
 * Генератор текстур
 * Отвечает за создание различных текстур для визуализации
 */
export class TextureGenerator {
  // Кэш текстур для оптимизации памяти (избегаем создания дубликатов)
  static textureCache = new Map();

  /**
   * Создать текстуру свечения для светлячков (с кэшированием)
   * @param {number} size - Размер текстуры
   * @returns {THREE.CanvasTexture}
   */
  static createGlowTexture(size) {
    const cacheKey = `glow_${size}`;
    
    // Проверяем кэш - если текстура уже создана, возвращаем её
    if (this.textureCache.has(cacheKey)) {
      return this.textureCache.get(cacheKey);
    }
    
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const context = canvas.getContext('2d');
    
    const centerX = size / 2;
    const centerY = size / 2;
    const radius = size / 2;
    
    // Создаем радиальный градиент
    const gradient = context.createRadialGradient(centerX, centerY, 0, centerX, centerY, radius);
    GLOW_GRADIENT_COLORS.forEach(colorStop => {
      gradient.addColorStop(colorStop.stop, colorStop.color);
    });
    
    context.fillStyle = gradient;
    context.fillRect(0, 0, size, size);
    
    const texture = new THREE.CanvasTexture(canvas);
    texture.needsUpdate = true;
    
    // Сохраняем в кэш для переиспользования
    // ВАЖНО: не очищаем canvas, так как CanvasTexture держит ссылку на него
    this.textureCache.set(cacheKey, texture);
    
    return texture;
  }

  /**
   * Очистить кэш текстур (вызывается при полном пересоздании сцены)
   */
  static clearCache() {
    // Dispose всех закэшированных текстур
    for (const texture of this.textureCache.values()) {
      texture.dispose();
    }
    this.textureCache.clear();
  }

  /**
   * Создать текстуру для текста узла
   * @param {string} text - Текст для отображения
   * @param {number} fontSize - Размер шрифта
   * @returns {THREE.CanvasTexture}
   */
  static createTextTexture(text, fontSize) {
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    
    // Устанавливаем шрифт для измерения
    context.font = `bold ${fontSize}px Arial`;
    
    // Измеряем текст
    const metrics = context.measureText(text);
    const textWidth = metrics.width;
    const textHeight = fontSize;
    
    // Увеличиваем разрешение canvas для четкости при масштабировании
    canvas.width = (textWidth + TEXT_PADDING) * TEXT_SCALE_FACTOR;
    canvas.height = (textHeight + TEXT_PADDING) * TEXT_SCALE_FACTOR;
    
    // Масштабируем контекст
    context.scale(TEXT_SCALE_FACTOR, TEXT_SCALE_FACTOR);
    
    // Перерисовываем текст
    context.fillStyle = TEXT_COLOR;
    context.strokeStyle = TEXT_STROKE_COLOR;
    context.lineWidth = TEXT_STROKE_WIDTH;
    context.font = `bold ${fontSize}px Arial`;
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    
    // Рисуем текст с обводкой
    context.strokeText(text, (textWidth + TEXT_PADDING) / 2, (textHeight + TEXT_PADDING) / 2);
    context.fillText(text, (textWidth + TEXT_PADDING) / 2, (textHeight + TEXT_PADDING) / 2);
    
    // Создаем текстуру из canvas
    const texture = new THREE.CanvasTexture(canvas);
    texture.needsUpdate = true;
    
    return texture;
  }

  /**
   * Создать текстуру радиального градиента для оверлея
   * @param {number} width - Ширина текстуры
   * @param {number} height - Высота текстуры
   * @returns {THREE.CanvasTexture}
   */
  static createRadialGradientTexture(width, height) {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d');
    
    const centerX = width / 2;
    const centerY = height / 2;
    const maxRadius = Math.max(width, height) / 2;
    
    // Создаем радиальный градиент от прозрачного центра к темным краям
    const gradient = context.createRadialGradient(centerX, centerY, 0, centerX, centerY, maxRadius);
    gradient.addColorStop(0, 'rgba(0, 0, 0, 0)');      // Прозрачный центр
    gradient.addColorStop(0.3, 'rgba(0, 0, 0, 0.1)');  // Легкое затемнение
    gradient.addColorStop(0.6, 'rgba(0, 0, 0, 0.2)');  // Среднее затемнение
    gradient.addColorStop(0.8, 'rgba(0, 0, 0, 0.3)');  // Среднее затемнение
    gradient.addColorStop(1.0, 'rgba(0, 0, 0, 0.6)');  // Темные края
    
    context.fillStyle = gradient;
    context.fillRect(0, 0, canvas.width, canvas.height);
    
    const texture = new THREE.CanvasTexture(canvas);
    texture.needsUpdate = true;
    
    return texture;
  }
}
