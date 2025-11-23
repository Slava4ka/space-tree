import * as THREE from 'three';
import {
  CAMERA_FOV,
  CAMERA_NEAR,
  CAMERA_FAR,
  CAMERA_INITIAL_POSITION,
  CAMERA_MIN_ZOOM,
  CAMERA_MAX_ZOOM,
  CAMERA_ZOOM_STEP
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
    
    this.baseDistance = Math.sqrt(
      CAMERA_INITIAL_POSITION.x ** 2 + 
      CAMERA_INITIAL_POSITION.y ** 2 + 
      CAMERA_INITIAL_POSITION.z ** 2
    );
    
    // Начальная цель - центр сцены
    this.cameraTarget = new THREE.Vector3(0, 0, 0);
    
    // Параметры зума
    this.currentZoom = 0.5;
    this.minZoom = 0.2;
    this.maxZoom = 3;
    this.zoomStepPercent = 0.15; // 15% от текущего зума для пропорционального шага
    
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
   */
  setZoom(zoom) {
console.trace()
    console.log(zoom);
    this.currentZoom = THREE.MathUtils.clamp(zoom, this.minZoom, this.maxZoom);
    console.log('Zoom:', this.currentZoom.toFixed(4), '(min:', this.minZoom.toFixed(4), ', max:', this.maxZoom.toFixed(4), ')');
    this.updatePosition();
  }

  /**
   * Получить текущий зум
   */
  getZoom() {
    return this.currentZoom;
  }

  /**
   * Вычислить адаптивный шаг зума на основе текущего значения
   * Использует процент от текущего зума для плавного изменения на любом уровне
   */
  getZoomStep() {
    // Используем процент от текущего зума, но не меньше минимального абсолютного значения
    const proportionalStep = this.currentZoom * this.zoomStepPercent;
    // Минимальный шаг для очень маленьких значений зума
    const minAbsoluteStep = 0.01;
    return Math.max(proportionalStep, minAbsoluteStep);
  }

  /**
   * Увеличить зум
   */
  zoomIn() {
    const step = this.getZoomStep();
    this.setZoom(this.currentZoom + step);
  }

  /**
   * Уменьшить зум
   */
  zoomOut() {
    const step = this.getZoomStep();
    this.setZoom(this.currentZoom - step);
  }


  /**
   * Установить минимальный зум
   * Используется для динамического расчета на основе размера сцены
   */
  setMinZoom(minZoom) {
    console.log('setMinZoom');
    
    const previousMinZoom = this.minZoom;
    // Убираем жесткое ограничение 0.05, чтобы позволить зум для очень больших сцен
    // Устанавливаем минимальный предел только для предотвращения ошибок (очень маленькие значения)
    const newMinZoom = Math.max(0.001, minZoom); // Минимум 0.001 для предотвращения ошибок
    
    this.minZoom = newMinZoom;
    
    // Если новый минимальный зум меньше предыдущего (сцена стала больше),
    // автоматически устанавливаем текущий зум на новый минимальный,
    // чтобы пользователь мог видеть всю сцену
    if (newMinZoom < previousMinZoom) {
      const step = this.getZoomStep();
      this.setZoom(newMinZoom + step);
    } else if (this.currentZoom < this.minZoom) {
      // Корректируем текущий зум, если он меньше нового минимального значения
      const step = this.getZoomStep();
      this.setZoom(this.minZoom + step);
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
}

