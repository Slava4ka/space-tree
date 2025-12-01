import * as THREE from 'three';
import { 
  GLOW_GRADIENT_COLORS
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

}
