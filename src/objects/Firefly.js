import * as THREE from 'three';
import { TextureGenerator } from '../utils/TextureGenerator.js';
import {
  FIREFLY_ROTATION_SPEED,
  FIREFLY_ORBIT_RADIUS,
  FIREFLY_CORE_SIZE_MULTIPLIER,
  FIREFLY_GLOW_SCALE_MULTIPLIER,
  FIREFLY_OUTER_GLOW_SCALE_MULTIPLIER,
  FIREFLY_GLOW_TEXTURE_SIZE,
  FIREFLY_OUTER_GLOW_TEXTURE_SIZE,
  FIREFLY_EMISSIVE_COLOR,
  FIREFLY_EMISSIVE_INTENSITY,
  FIREFLY_OUTER_GLOW_OPACITY,
  FIREFLY_DELTA_TIME_MULTIPLIER,
  SPHERE_SEGMENTS,
  SPHERE_RINGS,
  MATERIAL_METALNESS,
  MATERIAL_ROUGHNESS
} from '../utils/constants.js';

export class Firefly {
  constructor(centerPosition, initialAngle, size) {
    this.nodePosition = centerPosition.clone();
    this.angle = initialAngle;
    this.speed = FIREFLY_ROTATION_SPEED;
    this.size = size;
    this.orbitRadius = FIREFLY_ORBIT_RADIUS;
    this.mesh = this.createMesh();
  }

  createMesh() {
    const fireflyGroup = new THREE.Group();
    const coreGeometry = new THREE.SphereGeometry(this.size * FIREFLY_CORE_SIZE_MULTIPLIER, SPHERE_SEGMENTS, SPHERE_RINGS);
    const coreMaterial = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      emissive: FIREFLY_EMISSIVE_COLOR,
      emissiveIntensity: FIREFLY_EMISSIVE_INTENSITY,
      metalness: MATERIAL_METALNESS,
      roughness: MATERIAL_ROUGHNESS
    });
    const core = new THREE.Mesh(coreGeometry, coreMaterial);
    fireflyGroup.add(core);
    const glowTexture = TextureGenerator.createGlowTexture(FIREFLY_GLOW_TEXTURE_SIZE);
    const glowMaterial = new THREE.SpriteMaterial({
      map: glowTexture,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });
    const glowSprite = new THREE.Sprite(glowMaterial);
    glowSprite.scale.set(this.size * FIREFLY_GLOW_SCALE_MULTIPLIER, this.size * FIREFLY_GLOW_SCALE_MULTIPLIER, 1);
    fireflyGroup.add(glowSprite);
    const outerGlowTexture = TextureGenerator.createGlowTexture(FIREFLY_OUTER_GLOW_TEXTURE_SIZE);
    const outerGlowMaterial = new THREE.SpriteMaterial({
      map: outerGlowTexture,
      transparent: true,
      opacity: FIREFLY_OUTER_GLOW_OPACITY,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });
    const outerGlowSprite = new THREE.Sprite(outerGlowMaterial);
    outerGlowSprite.scale.set(this.size * FIREFLY_OUTER_GLOW_SCALE_MULTIPLIER, this.size * FIREFLY_OUTER_GLOW_SCALE_MULTIPLIER, 1);
    fireflyGroup.add(outerGlowSprite);
    return fireflyGroup;
  }

  updateSize(newSize) {
    this.size = newSize;
    this.mesh.children.forEach((child, index) => {
      if (index === 0) {
        if (child.geometry) {
          child.geometry.dispose();
          child.geometry = new THREE.SphereGeometry(newSize * FIREFLY_CORE_SIZE_MULTIPLIER, SPHERE_SEGMENTS, SPHERE_RINGS);
        }
      } else if (child instanceof THREE.Sprite) {
        if (index === 1) {
          child.scale.set(newSize * FIREFLY_GLOW_SCALE_MULTIPLIER, newSize * FIREFLY_GLOW_SCALE_MULTIPLIER, 1);
        } else if (index === 2) {
          child.scale.set(newSize * FIREFLY_OUTER_GLOW_SCALE_MULTIPLIER, newSize * FIREFLY_OUTER_GLOW_SCALE_MULTIPLIER, 1);
        }
      }
    });
  }

  updatePosition(orbitRadius, deltaTime) {
    this.angle += this.speed * deltaTime * FIREFLY_DELTA_TIME_MULTIPLIER;
    const orbitX = Math.cos(this.angle) * orbitRadius;
    const orbitY = 0;
    const orbitZ = Math.sin(this.angle) * orbitRadius;
    this.mesh.position.x = this.nodePosition.x + orbitX;
    this.mesh.position.y = this.nodePosition.y + orbitY;
    this.mesh.position.z = this.nodePosition.z + orbitZ;
  }

  setSpeed(speed) {
    this.speed = speed;
  }

  setOrbitRadius(radius) {
    this.orbitRadius = radius;
  }

  setNodePosition(position) {
    this.nodePosition.copy(position);
  }
}
