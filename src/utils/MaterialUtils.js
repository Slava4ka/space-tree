/**
 * Утилиты для работы с материалами Three.js
 * Централизованные функции для dispose и управления материалами
 */
export class MaterialUtils {
  /**
   * Освободить ресурсы материала
   * @param {THREE.Material|THREE.Material[]} material - Материал или массив материалов
   */
  static disposeMaterial(material) {
    if (!material) return;
    
    if (Array.isArray(material)) {
      material.forEach(m => {
        if (m.map) m.map.dispose();
        m.dispose();
      });
    } else {
      if (material.map) {
        material.map.dispose();
      }
      material.dispose();
    }
  }
  
  /**
   * Освободить ресурсы объекта (геометрия и материал)
   * @param {THREE.Object3D} object - Объект Three.js
   */
  static disposeObject(object) {
    if (!object) return;
    
    if (object.geometry) {
      object.geometry.dispose();
    }
    
    if (object.material) {
      this.disposeMaterial(object.material);
    }
  }
  
  /**
   * Установить opacity и transparent для материала
   * @param {THREE.Material|THREE.Material[]} material - Материал или массив материалов
   * @param {number} opacity - Значение opacity (0-1)
   * @param {boolean} transparent - Флаг прозрачности
   */
  static setMaterialOpacity(material, opacity, transparent) {
    if (!material) return;
    
    if (Array.isArray(material)) {
      material.forEach(mat => {
        if (mat.opacity !== undefined) {
          mat.opacity = opacity;
        }
        if (mat.transparent !== undefined) {
          mat.transparent = transparent;
        }
      });
    } else {
      if (material.opacity !== undefined) {
        material.opacity = opacity;
      }
      if (material.transparent !== undefined) {
        material.transparent = transparent;
      }
    }
  }
  
  /**
   * Восстановить состояние материала из сохраненного состояния
   * @param {THREE.Material|THREE.Material[]} material - Материал или массив материалов
   * @param {Object|Object[]} originalState - Сохраненное состояние материала
   */
  static restoreMaterialState(material, originalState) {
    if (!material || !originalState) return;
    
    if (Array.isArray(material) && originalState.materials) {
      material.forEach((mat, index) => {
        if (originalState.materials[index]) {
          const state = originalState.materials[index];
          if (mat.opacity !== undefined) mat.opacity = state.opacity;
          if (mat.transparent !== undefined) mat.transparent = state.transparent;
          if (mat.depthTest !== undefined) mat.depthTest = state.depthTest;
          if (mat.depthWrite !== undefined) mat.depthWrite = state.depthWrite;
        }
      });
    } else if (!Array.isArray(material)) {
      if (material.opacity !== undefined) material.opacity = originalState.opacity;
      if (material.transparent !== undefined) material.transparent = originalState.transparent;
      if (material.depthTest !== undefined) material.depthTest = originalState.depthTest;
      if (material.depthWrite !== undefined) material.depthWrite = originalState.depthWrite;
    }
  }
  
  /**
   * Сохранить состояние материала
   * @param {THREE.Material|THREE.Material[]} material - Материал или массив материалов
   * @param {boolean} includeVisible - Сохранять ли видимость объекта
   * @returns {Object} Сохраненное состояние
   */
  static saveMaterialState(material, includeVisible = false) {
    if (!material) return null;
    
    if (Array.isArray(material)) {
      const states = material.map(mat => ({
        opacity: mat.opacity,
        transparent: mat.transparent,
        depthTest: mat.depthTest,
        depthWrite: mat.depthWrite
      }));
      return { materials: states };
    } else {
      return {
        opacity: material.opacity,
        transparent: material.transparent,
        depthTest: material.depthTest,
        depthWrite: material.depthWrite
      };
    }
  }

  /**
   * Установить свойства материала (opacity, transparent, depthTest, depthWrite, alphaTest)
   * @param {THREE.Material | THREE.Material[]} material - Материал или массив материалов
   * @param {object} properties - Объект со свойствами для установки
   * @param {number} [properties.opacity] - Значение opacity (0-1)
   * @param {boolean} [properties.transparent] - Флаг прозрачности
   * @param {boolean} [properties.depthTest] - Флаг depth test
   * @param {boolean} [properties.depthWrite] - Флаг depth write
   * @param {number} [properties.alphaTest] - Значение alpha test
   */
  static setMaterialProperties(material, properties) {
    if (!material || !properties) return;

    const applyProperties = (mat) => {
      if (properties.opacity !== undefined && mat.opacity !== undefined) {
        mat.opacity = properties.opacity;
      }
      if (properties.transparent !== undefined && mat.transparent !== undefined) {
        mat.transparent = properties.transparent;
      }
      if (properties.depthTest !== undefined && mat.depthTest !== undefined) {
        mat.depthTest = properties.depthTest;
      }
      if (properties.depthWrite !== undefined && mat.depthWrite !== undefined) {
        mat.depthWrite = properties.depthWrite;
      }
      if (properties.alphaTest !== undefined && mat.alphaTest !== undefined) {
        mat.alphaTest = properties.alphaTest;
      }
    };

    if (Array.isArray(material)) {
      material.forEach(applyProperties);
    } else {
      applyProperties(material);
    }
  }
}

