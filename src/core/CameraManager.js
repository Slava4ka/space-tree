import * as THREE from 'three';
import {
  CAMERA_FOV,
  CAMERA_NEAR,
  CAMERA_FAR,
  CAMERA_INITIAL_POSITION,
  CAMERA_ZOOM_STEPS,
  CAMERA_MIN_ZOOM,
  CAMERA_MAX_ZOOM,
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
    // Фиксированные шаги зума: больше шагов в диапазоне < 1 (более чувствительно), меньше шагов в диапазоне > 2
    this.zoomSteps = CAMERA_ZOOM_STEPS;
    this.minZoom = CAMERA_MIN_ZOOM;
    this.maxZoom = CAMERA_MAX_ZOOM;
    this.currentZoom = CAMERA_ZOOM_STEPS[6];
    // Находим индекс начального зума (0.2 находится на индексе 5)
    this.currentZoomIndex = this.zoomSteps.indexOf(this.currentZoom);
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
    let closestStep = this.zoomSteps[0];
    let minDiff = Math.abs(clampedZoom - this.zoomSteps[0]);
    
    for (let i = 0; i < this.zoomSteps.length; i++) {
      const diff = Math.abs(clampedZoom - this.zoomSteps[i]);
      if (diff < minDiff) {
        minDiff = diff;
        closestStep = this.zoomSteps[i];
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
    let minDiff = Math.abs(this.currentZoom - this.zoomSteps[0]);
    
    for (let i = 1; i < this.zoomSteps.length; i++) {
      const diff = Math.abs(this.currentZoom - this.zoomSteps[i]);
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
    if (this.currentZoomIndex < this.zoomSteps.length - 1) {
      this.currentZoomIndex++;
      this.currentZoom = this.zoomSteps[this.currentZoomIndex];
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
      this.currentZoom = this.zoomSteps[this.currentZoomIndex];
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
      this.setZoom(this.zoomSteps[0]);
    } else if (this.currentZoom < this.minZoom) {
      // Корректируем текущий зум, если он меньше нового минимального значения
      // Устанавливаем на минимальный доступный шаг
      this.setZoom(this.zoomSteps[0]);
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

