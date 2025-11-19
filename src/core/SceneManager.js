import * as THREE from 'three';
import {
  AMBIENT_LIGHT_COLOR,
  AMBIENT_LIGHT_INTENSITY,
  DIRECTIONAL_LIGHT_COLOR,
  DIRECTIONAL_LIGHT_INTENSITY,
  DIRECTIONAL_LIGHT_POSITION,
  POINT_LIGHT_COLOR,
  POINT_LIGHT_INTENSITY,
  POINT_LIGHT_DISTANCE
} from '../utils/constants.js';

/**
 * Менеджер сцены
 * Отвечает за создание и управление Three.js сценой
 */
export class SceneManager {
  constructor() {
    this.scene = new THREE.Scene();
    this.setupLighting();
  }

  /**
   * Настройка освещения сцены
   */
  setupLighting() {
    // Окружающий свет
    const ambientLight = new THREE.AmbientLight(AMBIENT_LIGHT_COLOR, AMBIENT_LIGHT_INTENSITY);
    this.scene.add(ambientLight);

    // Направленный свет
    const directionalLight = new THREE.DirectionalLight(DIRECTIONAL_LIGHT_COLOR, DIRECTIONAL_LIGHT_INTENSITY);
    directionalLight.position.set(
      DIRECTIONAL_LIGHT_POSITION.x,
      DIRECTIONAL_LIGHT_POSITION.y,
      DIRECTIONAL_LIGHT_POSITION.z
    );
    this.scene.add(directionalLight);

    // Точечный свет (для эффекта свечения центра)
    const pointLight = new THREE.PointLight(POINT_LIGHT_COLOR, POINT_LIGHT_INTENSITY, POINT_LIGHT_DISTANCE);
    pointLight.position.set(0, 0, 0);
    this.scene.add(pointLight);
  }

  /**
   * Получить сцену
   */
  getScene() {
    return this.scene;
  }

  /**
   * Добавить объект в сцену
   */
  add(object) {
    this.scene.add(object);
  }

  /**
   * Удалить объект из сцены
   */
  remove(object) {
    this.scene.remove(object);
  }
}

