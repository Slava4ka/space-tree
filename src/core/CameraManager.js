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
    this.currentZoom = 1;
    this.minZoom = 0.2;
    this.maxZoom = 3;
    this.zoomStep = 0.2;
    
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
    this.currentZoom = THREE.MathUtils.clamp(zoom, this.minZoom, this.maxZoom);
    this.updatePosition();
  }

  /**
   * Получить текущий зум
   */
  getZoom() {
    return this.currentZoom;
  }

  /**
   * Увеличить зум
   */
  zoomIn() {
    this.setZoom(this.currentZoom + this.zoomStep);
  }

  /**
   * Уменьшить зум
   */
  zoomOut() {
    this.setZoom(this.currentZoom - this.zoomStep);
  }


  /**
   * Установить минимальный зум
   * Используется для динамического расчета на основе размера сцены
   */
  setMinZoom(minZoom) {
    this.minZoom = Math.max(0.05, minZoom); // Минимум 0.05 для безопасности
    // Корректируем текущий зум, если он меньше нового минимального значения
    if (this.currentZoom < this.minZoom) {
      this.setZoom(this.minZoom);
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
}

