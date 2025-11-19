import * as THREE from 'three';
import { ROOT_RADIUS, NODE_RADIUS } from '../utils/constants.js';

/**
 * Калькулятор радиального layout для дерева
 * Отвечает за расчет позиций узлов в радиальном дереве
 */
export class LayoutCalculator {
  /**
   * Собрать все листья дерева
   */
  static collectLeavesDFS(node, leaves) {
    if (node.children.length === 0) {
      leaves.push(node);
    } else {
      node.children.forEach(child => {
        LayoutCalculator.collectLeavesDFS(child, leaves);
      });
    }
  }

  /**
   * Назначить углы узлам дерева
   */
  static assignAngles(root) {
    const leaves = [];
    LayoutCalculator.collectLeavesDFS(root, leaves);
    
    const leafCount = leaves.length || 1;
    
    // Равномерно распределяем листья по окружности
    leaves.forEach((leaf, index) => {
      const angle = (2 * Math.PI * (index + 0.5)) / leafCount;
      leaf.angle = angle;
    });
    
    // Рекурсивно назначаем углы внутренним узлам как среднее по детям
    function assignInternal(node) {
      if (node.children.length === 0) {
        return node.angle;
      }
      
      const angles = node.children.map(assignInternal);
      
      // Средний угол на окружности через сумму синусов/косинусов
      const sinSum = angles.reduce((sum, a) => sum + Math.sin(a), 0);
      const cosSum = angles.reduce((sum, a) => sum + Math.cos(a), 0);
      node.angle = Math.atan2(sinSum, cosSum);
      return node.angle;
    }
    
    assignInternal(root);
  }

  /**
   * Группировать узлы по уровню
   */
  static groupNodesByLevel(nodes) {
    const levels = new Map();
    nodes.forEach((node) => {
      if (!levels.has(node.level)) {
        levels.set(node.level, []);
      }
      levels.get(node.level).push(node);
    });
    return levels;
  }

  /**
   * Вычислить максимальный радиус дерева
   */
  static calculateMaxTreeRadius(root, nodes, config) {
    const spacingFactor = config?.spacingFactor ?? 1.4;
    const levelMarginFactor = config?.levelMarginFactor ?? 0.6;
    
    // Временно назначаем углы для расчета
    LayoutCalculator.assignAngles(root);
    
    const levels = LayoutCalculator.groupNodesByLevel(nodes);
    const maxLevel = Math.max(...nodes.map((n) => n.level));
    
    const radii = new Array(maxLevel + 1).fill(0);
    radii[0] = 0;
    
    const nodeDiameter = 2 * NODE_RADIUS;
    const targetChord = nodeDiameter * spacingFactor;
    const baseLevelSeparation = ROOT_RADIUS + NODE_RADIUS;
    
    for (let level = 1; level <= maxLevel; level += 1) {
      const levelNodes = levels.get(level) || [];
      
      if (levelNodes.length === 0) {
        radii[level] = radii[level - 1] + baseLevelSeparation;
        continue;
      }
      
      let minAngleDiff = 2 * Math.PI;
      if (levelNodes.length > 1) {
        const sorted = [...levelNodes].sort((a, b) => a.angle - b.angle);
        for (let i = 0; i < sorted.length; i += 1) {
          const current = sorted[i];
          const next = sorted[(i + 1) % sorted.length];
          let diff = next.angle - current.angle;
          if (diff < 0) diff += 2 * Math.PI;
          if (diff < minAngleDiff) minAngleDiff = diff;
        }
      }
      
      if (levelNodes.length === 1) {
        minAngleDiff = 2 * Math.PI;
      }
      
      let radiusFromSpacing;
      if (minAngleDiff > 1e-3) {
        radiusFromSpacing = targetChord / (2 * Math.sin(minAngleDiff / 2));
      } else {
        radiusFromSpacing = radii[level - 1] + baseLevelSeparation * 2;
      }
      
      const radiusBase = Math.max(
        radiusFromSpacing,
        radii[level - 1] + baseLevelSeparation
      );
      
      const extraGap = level * levelMarginFactor * nodeDiameter;
      radii[level] = radiusBase + extraGap;
    }
    
    // Возвращаем максимальный радиус дерева
    const maxLevelRadius = Math.max(...radii);
    const maxRadius = Math.max(maxLevelRadius + NODE_RADIUS, ROOT_RADIUS);
    return maxRadius * 1.1; // Добавляем 10% запас
  }

  /**
   * Вычислить позиции узлов по радиальному layout
   */
  static calculatePositions(root, nodes, config) {
    const spacingFactor = config?.spacingFactor ?? 1.4;
    const levelMarginFactor = config?.levelMarginFactor ?? 0.6;
    const offset = config?.offset ?? new THREE.Vector3(0, 0, 0);
    
    // 1. Углы для всех узлов
    LayoutCalculator.assignAngles(root);
    
    // 2. Группируем по уровням
    const levels = LayoutCalculator.groupNodesByLevel(nodes);
    const maxLevel = Math.max(...nodes.map((n) => n.level));
    
    const radii = new Array(maxLevel + 1).fill(0);
    radii[0] = 0; // root в центре
    
    const nodeDiameter = 2 * NODE_RADIUS;
    const targetChord = nodeDiameter * spacingFactor;
    const baseLevelSeparation = ROOT_RADIUS + NODE_RADIUS;
    
    // 3. Считаем радиусы уровней
    for (let level = 1; level <= maxLevel; level += 1) {
      const levelNodes = levels.get(level) || [];
      
      if (levelNodes.length === 0) {
        radii[level] = radii[level - 1] + baseLevelSeparation;
        continue;
      }
      
      let minAngleDiff = 2 * Math.PI;
      if (levelNodes.length > 1) {
        const sorted = [...levelNodes].sort((a, b) => a.angle - b.angle);
        for (let i = 0; i < sorted.length; i += 1) {
          const current = sorted[i];
          const next = sorted[(i + 1) % sorted.length];
          let diff = next.angle - current.angle;
          if (diff < 0) diff += 2 * Math.PI;
          if (diff < minAngleDiff) minAngleDiff = diff;
        }
      }
      
      if (levelNodes.length === 1) {
        minAngleDiff = 2 * Math.PI;
      }
      
      let radiusFromSpacing;
      if (minAngleDiff > 1e-3) {
        radiusFromSpacing = targetChord / (2 * Math.sin(minAngleDiff / 2));
      } else {
        radiusFromSpacing = radii[level - 1] + baseLevelSeparation * 2;
      }
      
      const radiusBase = Math.max(
        radiusFromSpacing,
        radii[level - 1] + baseLevelSeparation
      );
      
      const extraGap = level * levelMarginFactor * nodeDiameter;
      radii[level] = radiusBase + extraGap;
    }
    
    // 4. Присваиваем позиции с учётом смещения
    nodes.forEach((node) => {
      if (node.level === 0) {
        node.position.copy(offset);
        return;
      }
      const r = radii[node.level];
      const angle = node.angle ?? 0;
      const x = offset.x + r * Math.cos(angle);
      const z = offset.z + r * Math.sin(angle);
      node.position.set(x, offset.y, z);
    });
  }
}

