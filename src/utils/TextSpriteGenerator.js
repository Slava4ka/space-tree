import * as THREE from 'three';
import { TextUtils } from './TextUtils.js';
import {
  TEXT_COLOR,
  TEXT_STROKE_COLOR,
  TEXT_STROKE_WIDTH,
  TEXT_SCALE_FACTOR,
  TEXT_PADDING,
  TEXT_OFFSET_Y
} from './constants.js';

/**
 * Генератор текстовых спрайтов для узлов
 * Унифицированная логика создания и обновления текстовых спрайтов
 */
export class TextSpriteGenerator {
  /**
   * Создать текстуру для текста
   * @param {string} text - Текст для отображения
   * @param {number} fontSize - Размер шрифта
   * @param {number} maxWordsPerLine - Максимальное количество слов в строке
   * @returns {THREE.CanvasTexture} Текстура с текстом
   */
  static createTextTexture(text, fontSize, maxWordsPerLine) {
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    
    const lineHeight = fontSize * 1.2; // Межстрочный интервал
    context.font = `bold ${fontSize}px Arial`;
    
    // Разбиваем текст на строки
    const lines = TextUtils.splitTextIntoLines(text, maxWordsPerLine);
    
    // Измеряем ширину каждой строки и находим максимальную
    let maxTextWidth = 0;
    lines.forEach(line => {
      const metrics = context.measureText(line);
      const width = metrics.width;
      if (width > maxTextWidth) {
        maxTextWidth = width;
      }
    });
    
    // Рассчитываем размеры canvas
    const textWidth = maxTextWidth;
    const textHeight = lines.length * lineHeight - (lineHeight - fontSize);
    
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
    
    // Рисуем каждую строку с правильным вертикальным смещением
    const centerX = (textWidth + TEXT_PADDING) / 2;
    const canvasCenterY = (textHeight + TEXT_PADDING) / 2;
    
    // Рассчитываем начальную позицию Y для первой строки
    const totalTextHeight = lines.length * lineHeight - (lineHeight - fontSize);
    const startY = canvasCenterY - (totalTextHeight / 2) + (fontSize / 2);
    
    lines.forEach((line, index) => {
      const y = startY + index * lineHeight;
      context.strokeText(line, centerX, y);
      context.fillText(line, centerX, y);
    });
    
    // Создаем текстуру из canvas
    const texture = new THREE.CanvasTexture(canvas);
    texture.needsUpdate = true;
    
    return texture;
  }
  
  /**
   * Создать текстовый спрайт
   * @param {Object} options - Параметры создания спрайта
   * @param {string} options.text - Текст для отображения
   * @param {number} options.fontSize - Размер шрифта
   * @param {number} options.maxWordsPerLine - Максимальное количество слов в строке
   * @param {THREE.Vector3} options.position - Позиция спрайта
   * @param {number} options.scaleMultiplier - Множитель масштаба (по умолчанию 1.5)
   * @param {boolean} options.visible - Видимость спрайта (по умолчанию true)
   * @returns {THREE.Sprite} Созданный спрайт
   */
  static createTextSprite(options) {
    const {
      text,
      fontSize,
      maxWordsPerLine,
      position,
      scaleMultiplier = 1.5,
      visible = true
    } = options;
    
    // Создаем текстуру
    const texture = this.createTextTexture(text, fontSize, maxWordsPerLine);
    
    // Создаем спрайт с текстом
    const spriteMaterial = new THREE.SpriteMaterial({
      map: texture,
      transparent: true,
      alphaTest: 0.1,
      depthTest: false,
      depthWrite: false
    });
    const sprite = new THREE.Sprite(spriteMaterial);
    
    // Позиционируем спрайт
    if (position) {
      sprite.position.copy(position);
    }
    
    // Рассчитываем масштаб
    const canvas = texture.image;
    const scaleX = (canvas.width / TEXT_SCALE_FACTOR) * scaleMultiplier;
    const scaleY = (canvas.height / TEXT_SCALE_FACTOR) * scaleMultiplier;
    sprite.scale.set(scaleX, scaleY, 1);
    
    sprite.renderOrder = 999; // Текст всегда поверх всех элементов
    sprite.visible = visible;
    
    return sprite;
  }
  
  /**
   * Обновить текстуру существующего спрайта
   * @param {THREE.Sprite} sprite - Существующий спрайт
   * @param {string} text - Новый текст
   * @param {number} fontSize - Размер шрифта
   * @param {number} maxWordsPerLine - Максимальное количество слов в строке
   * @param {number} scaleMultiplier - Множитель масштаба (по умолчанию 1.5)
   */
  static updateTextSprite(sprite, text, fontSize, maxWordsPerLine, scaleMultiplier = 1.5) {
    if (!sprite || !sprite.material) {
      return;
    }
    
    // Освобождаем старую текстуру
    if (sprite.material.map) {
      sprite.material.map.dispose();
    }
    
    // Создаем новую текстуру
    const texture = this.createTextTexture(text, fontSize, maxWordsPerLine);
    
    // Устанавливаем новую текстуру
    sprite.material.map = texture;
    sprite.material.needsUpdate = true;
    
    // Устанавливаем настройки для отображения поверх всех объектов
    sprite.renderOrder = 999;
    sprite.material.depthTest = false;
    sprite.material.depthWrite = false;
    
    // Рассчитываем новый масштаб
    const canvas = texture.image;
    const scaleX = (canvas.width / TEXT_SCALE_FACTOR) * scaleMultiplier;
    const scaleY = (canvas.height / TEXT_SCALE_FACTOR) * scaleMultiplier;
    sprite.scale.set(scaleX, scaleY, 1);
  }
}

