import * as THREE from 'three';
import { CameraManager } from '../core/CameraManager.js';

/**
 * Система управления камерой мышью
 * Отвечает за панорамирование и зум
 */
export class Controls {
  constructor(canvas, cameraManager, onNodeClickCheck, onCameraUpdate) {
    this.canvas = canvas;
    this.cameraManager = cameraManager;
    this.onNodeClickCheck = onNodeClickCheck; // Callback для проверки клика по узлу перед началом перетаскивания
    this.onCameraUpdate = onCameraUpdate; // Callback для обновления позиции камеры после панорамирования
    
    this.isDragging = false;
    this.previousMousePosition = { x: 0, y: 0 };
    this.isEnabled = true;
    
    this.setupEventListeners();
  }

  /**
   * Настроить обработчики событий
   */
  setupEventListeners() {
    // Нажатие мыши
    this.canvas.addEventListener('mousedown', this.handleMouseDown);
    
    // Движение мыши
    this.canvas.addEventListener('mousemove', this.handleMouseMove);
    
    // Отпускание мыши
    this.canvas.addEventListener('mouseup', this.handleMouseUp);
    
    // Выход мыши за пределы canvas
    this.canvas.addEventListener('mouseleave', this.handleMouseLeave);
    
    // Колесико мыши для зума
    this.canvas.addEventListener('wheel', this.handleWheel);
  }

  /**
   * Обработка нажатия мыши
   */
  handleMouseDown = (event) => {
    if (!this.isEnabled) return;
    
    if (event.button === 0) { // Левая кнопка мыши
      // Проверяем, не кликнули ли по узлу (если есть callback)
      if (this.onNodeClickCheck && this.onNodeClickCheck(event)) {
        // Клик по узлу - не начинаем перетаскивание
        return;
      }
      
      // Клик не по узлу - начинаем перетаскивание
      this.isDragging = true;
      this.previousMousePosition = {
        x: event.clientX,
        y: event.clientY
      };
      this.canvas.style.cursor = 'grabbing';
    }
  };

  /**
   * Обработка движения мыши
   */
  handleMouseMove = (event) => {
    if (!this.isEnabled) return;
    
    if (this.isDragging) {
      const deltaX = event.clientX - this.previousMousePosition.x;
      const deltaY = event.clientY - this.previousMousePosition.y;
      
      // Панорамирование
      const panSpeed = this.cameraManager.getPanSpeed(
        this.canvas.clientWidth,
        this.canvas.clientHeight
      );
      
      // Вычисляем смещение в плоскости XZ
      const panDelta = new THREE.Vector3(
        -deltaX * panSpeed.x,
        0,
        -deltaY * panSpeed.z
      );
      
      // Обновляем цель камеры
      this.cameraManager.panTarget(panDelta);
      
      // Вызываем callback для обновления позиции камеры в main.js
      if (this.onCameraUpdate) {
        this.onCameraUpdate();
      }
      
      this.previousMousePosition = {
        x: event.clientX,
        y: event.clientY
      };
    }
  };

  /**
   * Обработка отпускания мыши
   */
  handleMouseUp = () => {
    this.isDragging = false;
    this.canvas.style.cursor = 'default';
  };

  /**
   * Обработка выхода мыши за пределы canvas
   */
  handleMouseLeave = () => {
    this.isDragging = false;
    this.canvas.style.cursor = 'default';
  };

  /**
   * Обработка колесика мыши
   */
  handleWheel = (event) => {
    if (!this.isEnabled) return;
    
    event.preventDefault();
    
    if (event.deltaY < 0) {
      this.cameraManager.zoomIn();
    } else {
      this.cameraManager.zoomOut();
    }
  };

  /**
   * Включить управление
   */
  enable() {
    this.isEnabled = true;
  }

  /**
   * Отключить управление
   */
  disable() {
    this.isEnabled = false;
    this.isDragging = false;
    this.canvas.style.cursor = 'default';
  }

  /**
   * Освободить ресурсы
   */
  dispose() {
    this.canvas.removeEventListener('mousedown', this.handleMouseDown);
    this.canvas.removeEventListener('mousemove', this.handleMouseMove);
    this.canvas.removeEventListener('mouseup', this.handleMouseUp);
    this.canvas.removeEventListener('mouseleave', this.handleMouseLeave);
    this.canvas.removeEventListener('wheel', this.handleWheel);
  }
}

