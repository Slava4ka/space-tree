import * as THREE from 'three';
import { CameraManager } from '../core/CameraManager.js';

/**
 * Система управления камерой мышью и касаниями
 * Отвечает за панорамирование и зум на десктопе и мобильных устройствах
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
    
    // Для поддержки мультитач (pinch-to-zoom)
    this.previousTouchDistance = 0;
    this.touches = [];
    
    this.setupEventListeners();
  }

  /**
   * Настроить обработчики событий (мышь + touch для мобильных)
   */
  setupEventListeners() {
    // События мыши (для десктопа)
    this.canvas.addEventListener('mousedown', this.handleMouseDown);
    this.canvas.addEventListener('mousemove', this.handleMouseMove);
    this.canvas.addEventListener('mouseup', this.handleMouseUp);
    this.canvas.addEventListener('mouseleave', this.handleMouseLeave);
    this.canvas.addEventListener('wheel', this.handleWheel);
    
    // Touch события (для мобильных устройств)
    this.canvas.addEventListener('touchstart', this.handleTouchStart, { passive: false });
    this.canvas.addEventListener('touchmove', this.handleTouchMove, { passive: false });
    this.canvas.addEventListener('touchend', this.handleTouchEnd);
    this.canvas.addEventListener('touchcancel', this.handleTouchEnd);
  }

  /**
   * Обработка нажатия мыши
   */
  handleMouseDown = (event) => {
    if (event.button === 0) { // Левая кнопка мыши
      // Проверяем клик по узлу/закрытие детального режима (даже если controls отключены)
      if (this.onNodeClickCheck && this.onNodeClickCheck(event)) {
        // Клик обработан (по узлу или закрыт детальный режим) - не начинаем перетаскивание
        return;
      }
    }
    
    // Если controls отключены - не обрабатываем дальше
    if (!this.isEnabled) return;
    
    if (event.button === 0) { // Левая кнопка мыши
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
   * Обработка начала касания (touch)
   */
  handleTouchStart = (event) => {
    event.preventDefault();
    
    this.touches = Array.from(event.touches);
    
    if (this.touches.length === 1) {
      // Одно касание - панорамирование
      const touch = this.touches[0];
      
      // Проверяем клик по узлу/закрытие детального режима (даже если controls отключены)
      const mouseEvent = {
        button: 0,
        clientX: touch.clientX,
        clientY: touch.clientY,
        target: event.target, // Передаем оригинальный target для проверки UI элементов
        preventDefault: () => {},
        stopPropagation: () => {}
      };
      
      if (this.onNodeClickCheck && this.onNodeClickCheck(mouseEvent)) {
        return;
      }
    }
    
    // Если controls отключены - не обрабатываем дальше
    if (!this.isEnabled) return;
    
    if (this.touches.length === 1) {
      // Одно касание - начинаем перетаскивание
      const touch = this.touches[0];
      this.isDragging = true;
      this.previousMousePosition = {
        x: touch.clientX,
        y: touch.clientY
      };
    } else if (this.touches.length === 2) {
      // Два касания - зум (pinch)
      this.isDragging = false;
      const touch1 = this.touches[0];
      const touch2 = this.touches[1];
      this.previousTouchDistance = Math.hypot(
        touch2.clientX - touch1.clientX,
        touch2.clientY - touch1.clientY
      );
    }
  };

  /**
   * Обработка движения касания (touch)
   */
  handleTouchMove = (event) => {
    if (!this.isEnabled) return;
    
    event.preventDefault();
    
    this.touches = Array.from(event.touches);
    
    if (this.touches.length === 1 && this.isDragging) {
      // Одно касание - панорамирование
      const touch = this.touches[0];
      const deltaX = touch.clientX - this.previousMousePosition.x;
      const deltaY = touch.clientY - this.previousMousePosition.y;
      
      const panSpeed = this.cameraManager.getPanSpeed(
        this.canvas.clientWidth,
        this.canvas.clientHeight
      );
      
      const panDelta = new THREE.Vector3(
        -deltaX * panSpeed.x,
        0,
        -deltaY * panSpeed.z
      );
      
      this.cameraManager.panTarget(panDelta);
      
      if (this.onCameraUpdate) {
        this.onCameraUpdate();
      }
      
      this.previousMousePosition = {
        x: touch.clientX,
        y: touch.clientY
      };
    } else if (this.touches.length === 2) {
      // Два касания - зум (pinch)
      const touch1 = this.touches[0];
      const touch2 = this.touches[1];
      const distance = Math.hypot(
        touch2.clientX - touch1.clientX,
        touch2.clientY - touch1.clientY
      );
      
      if (this.previousTouchDistance > 0) {
        const delta = distance - this.previousTouchDistance;
        
        // Зум в зависимости от изменения расстояния между пальцами
        if (delta > 5) {
          this.cameraManager.zoomIn();
        } else if (delta < -5) {
          this.cameraManager.zoomOut();
        }
      }
      
      this.previousTouchDistance = distance;
    }
  };

  /**
   * Обработка окончания касания (touch)
   */
  handleTouchEnd = (event) => {
    if (!this.isEnabled) return;
    
    this.isDragging = false;
    this.previousTouchDistance = 0;
    this.touches = [];
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
    // Удаляем события мыши
    this.canvas.removeEventListener('mousedown', this.handleMouseDown);
    this.canvas.removeEventListener('mousemove', this.handleMouseMove);
    this.canvas.removeEventListener('mouseup', this.handleMouseUp);
    this.canvas.removeEventListener('mouseleave', this.handleMouseLeave);
    this.canvas.removeEventListener('wheel', this.handleWheel);
    
    // Удаляем touch события
    this.canvas.removeEventListener('touchstart', this.handleTouchStart);
    this.canvas.removeEventListener('touchmove', this.handleTouchMove);
    this.canvas.removeEventListener('touchend', this.handleTouchEnd);
    this.canvas.removeEventListener('touchcancel', this.handleTouchEnd);
  }
}

