import * as THREE from 'three';
import {
  CAMERA_FOV,
  CAMERA_NEAR,
  CAMERA_FAR,
  CAMERA_INITIAL_POSITION,
  CAMERA_BASE_DISTANCE,
  CAMERA_ZOOM_STEPS,
  CAMERA_MIN_ZOOM,
  CAMERA_MAX_ZOOM,
  CAMERA_ZOOM_DEFAULT_VALUE,
} from '../utils/constants.js';

/**
 * Менеджер камеры
 * Отвечает за создание и управление камерой
 */
export class CameraManager {
  constructor(aspect) {
    this.camera = new THREE.PerspectiveCamera(CAMERA_FOV, aspect, CAMERA_NEAR, CAMERA_FAR);
    
    // Базовое направление камеры (фиксированный угол сверху)
    this.baseDirection = new THREE.Vector3(
      CAMERA_INITIAL_POSITION.x,
      CAMERA_INITIAL_POSITION.y,
      CAMERA_INITIAL_POSITION.z
    ).normalize();
    
    this.baseDistance = CAMERA_BASE_DISTANCE; // Используем предвычисленную константу
    
    // Начальная цель - центр сцены
    this.cameraTarget = new THREE.Vector3(0, 0, 0);
    
    // Параметры зума
    // Фиксированные шаги зума: больше шагов в диапазоне < 1 (более чувствительно), меньше шагов в диапазоне > 2
    this.minZoom = CAMERA_MIN_ZOOM;
    this.maxZoom = CAMERA_MAX_ZOOM;
    this.currentZoom = CAMERA_ZOOM_DEFAULT_VALUE;
    // Находим индекс начального зума (0.2 находится на индексе 5)
    this.currentZoomIndex = CAMERA_ZOOM_STEPS.indexOf(this.currentZoom);
    if (this.currentZoomIndex === -1) {
      // Если точного совпадения нет, используем индекс 5 (0.2)
      this.currentZoomIndex = 5;
    }
    
    // Устанавливаем начальную позицию
    this.updatePosition();
  }

  /**
   * Получить камеру
   */
  getCamera() {
    return this.camera;
  }

  /**
   * Обновить aspect ratio
   */
  updateAspect(aspect) {
    this.camera.aspect = aspect;
    this.camera.updateProjectionMatrix();
  }

  /**
   * Получить цель камеры
   */
  getTarget() {
    return this.cameraTarget.clone();
  }

  /**
   * Получить базовое расстояние камеры
   */
  getBaseDistance() {
    return this.baseDistance;
  }

  /**
   * Сдвинуть цель камеры (панорамирование)
   */
  panTarget(delta) {
    this.cameraTarget.add(delta);
    this.updatePosition();
  }

  /**
   * Установить зум
   * Округляет значение до ближайшего дискретного шага из массива zoomSteps
   */
  setZoom(zoom) {
    const clampedZoom = THREE.MathUtils.clamp(zoom, this.minZoom, this.maxZoom);
    
    // Находим ближайший шаг
    let closestStep = CAMERA_ZOOM_STEPS[0];
    let minDiff = Math.abs(clampedZoom - CAMERA_ZOOM_STEPS[0]);
    
    for (let i = 0; i < CAMERA_ZOOM_STEPS.length; i++) {
      const diff = Math.abs(clampedZoom - CAMERA_ZOOM_STEPS[i]);
      if (diff < minDiff) {
        minDiff = diff;
        closestStep = CAMERA_ZOOM_STEPS[i];
        this.currentZoomIndex = i;
      }
    }
    
    this.currentZoom = closestStep;
    this.updatePosition();
  }

  /**
   * Получить текущий зум
   */
  getZoom() {
    return this.currentZoom;
  }

  /**
   * Получить индекс текущего шага зума
   */
  getCurrentZoomIndex() {
    // Находим ближайший шаг к текущему зуму
    let closestIndex = 0;
    let minDiff = Math.abs(this.currentZoom - CAMERA_ZOOM_STEPS[0]);
    
    for (let i = 1; i < CAMERA_ZOOM_STEPS.length; i++) {
      const diff = Math.abs(this.currentZoom - CAMERA_ZOOM_STEPS[i]);
      if (diff < minDiff) {
        minDiff = diff;
        closestIndex = i;
      }
    }
    
    return closestIndex;
  }

  /**
   * Увеличить зум
   * Переключается на следующий дискретный шаг
   */
  zoomIn() {
    this.currentZoomIndex = this.getCurrentZoomIndex();
    if (this.currentZoomIndex < CAMERA_ZOOM_STEPS.length - 1) {
      this.currentZoomIndex++;
      this.currentZoom = CAMERA_ZOOM_STEPS[this.currentZoomIndex];
      this.updatePosition();
    }
  }

  /**
   * Уменьшить зум
   * Переключается на предыдущий дискретный шаг
   */
  zoomOut() {
    this.currentZoomIndex = this.getCurrentZoomIndex();
    if (this.currentZoomIndex > 0) {
      this.currentZoomIndex--;
      this.currentZoom = CAMERA_ZOOM_STEPS[this.currentZoomIndex];
      this.updatePosition();
    }
  }


  /**
   * Установить минимальный зум
   * Используется для динамического расчета на основе размера сцены
   */
  setMinZoom(minZoom) {    
    const previousMinZoom = this.minZoom;
    // Убираем жесткое ограничение 0.05, чтобы позволить зум для очень больших сцен
    // Устанавливаем минимальный предел только для предотвращения ошибок (очень маленькие значения)
    const newMinZoom = Math.max(0.001, minZoom); // Минимум 0.001 для предотвращения ошибок
    
    this.minZoom = newMinZoom;
    
    // Если новый минимальный зум меньше предыдущего (сцена стала больше),
    // автоматически устанавливаем текущий зум на новый минимальный,
    // чтобы пользователь мог видеть всю сцену
    if (newMinZoom < previousMinZoom) {
      // Устанавливаем на минимальный доступный шаг
      this.setZoom(CAMERA_ZOOM_STEPS[0]);
    } else if (this.currentZoom < this.minZoom) {
      // Корректируем текущий зум, если он меньше нового минимального значения
      // Устанавливаем на минимальный доступный шаг
      this.setZoom(CAMERA_ZOOM_STEPS[0]);
    }
  }

  /**
   * Обновить позицию камеры на основе зума и цели
   */
  updatePosition() {
    const distance = this.baseDistance / this.currentZoom;
    const offset = this.baseDirection.clone().multiplyScalar(distance);
    
    this.camera.position.copy(this.cameraTarget).add(offset);
    this.camera.lookAt(this.cameraTarget);
    this.camera.updateProjectionMatrix();
  }

  /**
   * Вычислить размер видимой области
   */
  getVisibleSize() {
    const distanceToTarget = this.camera.position.distanceTo(this.cameraTarget);
    const fov = this.camera.fov * (Math.PI / 180);
    const height = 2 * Math.tan(fov / 2) * distanceToTarget;
    const width = height * this.camera.aspect;
    
    return { width, height };
  }

  /**
   * Получить скорость панорамирования на основе размера экрана
   */
  getPanSpeed(containerWidth, containerHeight) {
    const { width, height } = this.getVisibleSize();
    
    return {
      x: width / containerWidth,
      z: height / containerHeight,
    };
  }

  /**
   * Обновить дальнюю плоскость отсечения камеры
   * Используется для динамического обновления при изменении размера сцены
   */
  updateFarPlane(farDistance) {
    // Добавляем запас 50% для безопасности
    const safeFar = farDistance * 1.5;
    // Устанавливаем минимум 100000 для больших сцен
    this.camera.far = Math.max(safeFar, 100000);
    this.camera.updateProjectionMatrix();
  }

  /**
   * Сбросить камеру в исходное положение
   */
  resetToInitialPosition() {
    // Сброс цели камеры в центр сцены
    this.cameraTarget.set(0, 0, 0);
    
    // Сброс зума в начальное значение
    this.currentZoom = CAMERA_ZOOM_DEFAULT_VALUE;
    this.currentZoomIndex = 6;
    
    // Обновляем позицию камеры
    this.updatePosition();
  }

  /**
   * Панорамирование камеры по направлению
   * @param {string} direction - Направление: 'up', 'down', 'left', 'right'
   * @param {number} speed - Скорость панорамирования (умножается на базовую скорость)
   */
  panTargetByDirection(direction, speed = 1.0) {
    // Вычисляем базовую скорость панорамирования на основе текущего зума
    // Используем ту же логику, что и в Controls.js - получаем размер видимой области
    const { width, height } = this.getVisibleSize();
    const containerWidth = window.innerWidth;
    const containerHeight = window.innerHeight;
    
    // Вычисляем скорость панорамирования (аналогично Controls.js)
    const panSpeedX = (width / containerWidth) * speed * 10; // Множитель 10 для удобства
    const panSpeedZ = (height / containerHeight) * speed * 10;
    
    // Вычисляем направление панорамирования
    // Камера смотрит сверху под углом, поэтому вычисляем направления в плоскости XZ
    const up = new THREE.Vector3(0, 1, 0); // Глобальная ось Y (вверх)
    const cameraDirection = this.baseDirection.clone();
    
    // Вычисляем направление "вправо" в плоскости XZ (перпендикулярно направлению камеры)
    const cameraRight = new THREE.Vector3().crossVectors(cameraDirection, up).normalize();
    // Вычисляем направление "вперед" в плоскости XZ (перпендикулярно cameraRight)
    const cameraForward = new THREE.Vector3().crossVectors(up, cameraRight).normalize();
    
    let delta = new THREE.Vector3();
    
    switch (direction) {
      case 'up':
        // Вверх = против направления cameraForward (назад от камеры)
        delta.copy(cameraForward).multiplyScalar(-panSpeedZ);
        break;
      case 'down':
        // Вниз = по направлению cameraForward (вперед от камеры)
        delta.copy(cameraForward).multiplyScalar(panSpeedZ);
        break;
      case 'left':
        // Влево = по направлению cameraRight
        delta.copy(cameraRight).multiplyScalar(panSpeedX);
        break;
      case 'right':
        // Вправо = против направления cameraRight
        delta.copy(cameraRight).multiplyScalar(-panSpeedX);
        break;
      default:
        return;
    }
    
    this.panTarget(delta);
  }
}

