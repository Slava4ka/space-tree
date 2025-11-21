import * as THREE from 'three';

/**
 * Менеджер рендерера
 * Отвечает за создание и управление WebGL рендерером
 */
export class RendererManager {
  constructor(canvas) {
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      alpha: true,
      antialias: true,
    });

    // Настройки согласно правилам Three.js
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1;

    // Ограничиваем pixelRatio для производительности на мобильных устройствах
    // На устройствах с высоким DPI (iPhone, iPad) это значительно снижает нагрузку
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    this.resize(window.innerWidth, window.innerHeight);
  }

  /**
   * Получить рендерер
   */
  getRenderer() {
    return this.renderer;
  }

  /**
   * Изменить размер рендерера
   */
  resize(width, height) {
    this.renderer.setSize(width, height);
  }

  /**
   * Рендерить сцену
   */
  render(scene, camera) {
    this.renderer.render(scene, camera);
  }

  /**
   * Освободить ресурсы
   */
  dispose() {
    this.renderer.dispose();
  }
}

