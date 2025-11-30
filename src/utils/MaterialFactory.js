import * as THREE from 'three';
import { TextureGenerator } from './TextureGenerator.js';

/**
 * Фабрика материалов
 * Отвечает за создание различных Three.js материалов
 */
export class MaterialFactory {
  /**
   * Создать стандартный материал для узла
   */
  static createNodeMaterial(color, emissiveColor, emissiveIntensity = 0.5) {
    return new THREE.MeshStandardMaterial({
      color: color,
      emissive: emissiveColor,
      emissiveIntensity: emissiveIntensity,
      metalness: 0.3,
      roughness: 0.7,
    });
  }

  /**
   * Создать материал для корневого узла
   */
  static createRootMaterial() {
    return this.createNodeMaterial(0x4a90e2, 0x1a5fa0, 0.8);
  }

  /**
   * Создать материал для узла уровня 1
   */
  static createLevel1Material() {
    return this.createNodeMaterial(0x5cb3ff, 0x2d7fd6, 0.6);
  }

  /**
   * Создать материал для узла уровня 2
   */
  static createLevel2Material() {
    return this.createNodeMaterial(0x87ceeb, 0x4a9cd6, 0.4);
  }

  /**
   * Создать материал для выделенного узла
   */
  static createHighlightMaterial() {
    return this.createNodeMaterial(0x00ffff, 0x00aaff, 1.5);
  }

  /**
   * Создать материал для спрайта с текстом
   */
  static createTextSpriteMaterial(text, options = {}) {
    const texture = TextureGenerator.createTextTexture(text, options);
    return new THREE.SpriteMaterial({
      map: texture,
      transparent: true,
      depthTest: false,
      depthWrite: false,
    });
  }

  /**
   * Создать материал для спрайта свечения
   */
  static createGlowSpriteMaterial(size = 256) {
    const texture = TextureGenerator.createGlowTexture(size);
    return new THREE.SpriteMaterial({
      map: texture,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
  }

  /**
   * Создать материал для оверлея
   */
  static createOverlayMaterial(size = 1024) {
    const texture = TextureGenerator.createRadialGradientTexture(size);
    return new THREE.MeshBasicMaterial({
      map: texture,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
  }

  /**
   * Создать материал для светлячка (ядро)
   */
  static createFireflyCoreMaterial() {
    return new THREE.MeshStandardMaterial({
      color: 0xffffff,
      emissive: 0x00c8ff,
      emissiveIntensity: 5.0,
      metalness: 0.0,
      roughness: 0.0,
    });
  }
}

