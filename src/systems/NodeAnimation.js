import * as THREE from 'three';
import { ROOT_RADIUS, NODE_RADIUS } from '../utils/constants.js';

/**
 * Класс для управления анимациями узлов
 */
export class NodeAnimation {
    constructor(options) {
        this.nodeMeshes = options.nodeMeshes || [];
        this.fireflies = options.fireflies || [];
        this.selectedNode = options.selectedNode || null;
        this.animationSpeed = options.animationSpeed || 0.1;
        this.fireflyOrbitRadius = options.fireflyOrbitRadius || 200;
        this.isDetailMode = options.isDetailMode || (() => false);
        this.detailModeNode = options.detailModeNode || null;
        this.camera = options.camera || null;
        this.cameraTarget = options.cameraTarget || new THREE.Vector3(0, 0, 0);
        this.updateCameraPosition = options.updateCameraPosition || (() => {});
    }

    /**
     * Обновление анимаций (вызывается каждый кадр)
     */
    update(deltaTime) {
        this.updateFireflies();
        this.updateSelectedNode();
        this.updateReturningNodes();
        this.updatePushingNodes();
        this.updateTextSprites();
    }

    /**
     * Обновление позиций светлячков
     */
    updateFireflies() {
        this.fireflies.forEach((firefly, index) => {
            if (!firefly.mesh) return;
            
            // Обновляем угол с учетом скорости
            firefly.angle += firefly.speed * 0.01;
            
            // Вычисляем радиус орбиты (зависит от размера узла в детальном режиме)
            let orbitRadius = firefly.orbitRadius !== undefined ? firefly.orbitRadius : this.fireflyOrbitRadius;
            const isDetailModeFirefly = this.isDetailMode() && 
                this.detailModeNode && 
                firefly.nodeId === this.detailModeNode.node.id;
            
            if (isDetailModeFirefly && firefly.orbitRadius === undefined) {
                // В детальном режиме радиус орбиты должен масштабироваться вместе с узлом
                // Получаем текущий масштаб узла (используем среднее значение по осям)
                const nodeScale = this.detailModeNode.mesh.scale;
                const averageScale = (nodeScale.x + nodeScale.y + nodeScale.z) / 3;
                // Применяем масштаб к радиусу орбиты (fallback, если orbitRadius не установлен)
                orbitRadius = this.fireflyOrbitRadius * averageScale;
            }
            
            // Вычисляем новую позицию на орбите в локальной системе координат treeGroup
            // Орбита в горизонтальной плоскости XZ (локальная относительно узла)
            const orbitX = Math.cos(firefly.angle) * orbitRadius;
            const orbitY = 0; // На уровне узла
            const orbitZ = Math.sin(firefly.angle) * orbitRadius;
            
            // В детальном режиме для светлячков выбранного узла используем текущую позицию узла (0, 0, 0)
            let nodePosition = firefly.nodePosition;
            if (isDetailModeFirefly) {
                // В детальном режиме узел находится в центре (0, 0, 0)
                nodePosition = new THREE.Vector3(0, 0, 0);
            }
            
            // Позиция = позиция узла + смещение на орбите
            firefly.mesh.position.x = nodePosition.x + orbitX;
            firefly.mesh.position.y = nodePosition.y + orbitY;
            firefly.mesh.position.z = nodePosition.z + orbitZ;
        });
    }

    /**
     * Анимация выделенного узла
     */
    updateSelectedNode() {
        if (!this.selectedNode || !this.selectedNode.isAnimating) return;
        
        const nodeData = this.selectedNode;
        
        // Узел НЕ перемещается - остается на месте!
        // Только плавное масштабирование узла
        const currentScale = nodeData.mesh.scale;
        currentScale.lerp(nodeData.targetScale, this.animationSpeed);

        // Плавное масштабирование текста
        if (nodeData.textSprite && nodeData.targetSpriteScale) {
            nodeData.textSprite.scale.lerp(nodeData.targetSpriteScale, this.animationSpeed);
        }
        
        // Плавное перемещение камеры к узлу (только если позиция не была применена сразу)
        if (!nodeData.cameraPositionApplied) {
            this.cameraTarget.lerp(nodeData.targetCameraTarget, this.animationSpeed);
            this.updateCameraPosition();
        } else {
            // Позиция уже применена, но нужно убедиться, что камера смотрит правильно
            this.updateCameraPosition();
        }
        
        // Плавное изменение материала
        if (nodeData.highlightMaterial) {
            const currentMaterial = nodeData.mesh.material;
            if (currentMaterial !== nodeData.highlightMaterial) {
                // Плавный переход к выделенному материалу
                const t = Math.min(1, (currentScale.x - 1) / 1); // t от 0 до 1 при масштабе от 1 до 2
                if (currentMaterial.emissiveIntensity !== undefined) {
                    currentMaterial.emissiveIntensity = THREE.MathUtils.lerp(
                        nodeData.originalMaterial.emissiveIntensity || 0,
                        nodeData.highlightMaterial.emissiveIntensity,
                        t
                    );
                }
            } else {
                // Уже используем highlightMaterial, применяем его свойства
                currentMaterial.emissiveIntensity = nodeData.highlightMaterial.emissiveIntensity;
            }
        }
        
        // Проверяем, достигли ли мы целевых значений
        const scaleDiff = nodeData.mesh.scale.distanceTo(nodeData.targetScale);
        
        // Если позиция камеры была применена сразу, не проверяем расстояние камеры
        let cameraReached = nodeData.cameraPositionApplied || false;
        if (!cameraReached) {
            const cameraPosDiff = this.camera.position.distanceTo(nodeData.targetCameraPosition);
            const cameraTargetDiff = this.cameraTarget.distanceTo(nodeData.targetCameraTarget);
            cameraReached = cameraPosDiff < 0.1 && cameraTargetDiff < 0.1;
        }
        
        if (scaleDiff < 0.01 && cameraReached) {
            // Достигли целевых значений - применяем финальные значения
            nodeData.mesh.scale.copy(nodeData.targetScale);
            if (!nodeData.cameraPositionApplied) {
                this.cameraTarget.copy(nodeData.targetCameraTarget);
            }
            this.updateCameraPosition();
            
            if (nodeData.highlightMaterial) {
                nodeData.mesh.material = nodeData.highlightMaterial;
            }
            
            nodeData.isAnimating = false;
            // Сбрасываем флаг после завершения анимации
            nodeData.cameraPositionApplied = false;
        }
    }

    /**
     * Анимация возврата узла на исходный масштаб
     */
    updateReturningNodes() {
        this.nodeMeshes.forEach(nodeData => {
            if (nodeData !== this.selectedNode && nodeData.isAnimating && nodeData.targetScale) {
                // Плавное масштабирование узла обратно (узел остается на месте!)
                const currentScale = nodeData.mesh.scale;
                currentScale.lerp(nodeData.targetScale, this.animationSpeed);

                // Плавное масштабирование текста обратно
                if (nodeData.textSprite && nodeData.targetSpriteScale) {
                    nodeData.textSprite.scale.lerp(nodeData.targetSpriteScale, this.animationSpeed);
                }
                
                // Проверяем, достигли ли мы целевых значений
                const scaleDiff = nodeData.mesh.scale.distanceTo(nodeData.targetScale);
                
                if (scaleDiff < 0.01) {
                    // Достигли целевых значений
                    nodeData.mesh.scale.copy(nodeData.targetScale);
                    if (nodeData.textSprite && nodeData.targetSpriteScale) {
                        nodeData.textSprite.scale.copy(nodeData.targetSpriteScale);
                    }
                    nodeData.isAnimating = false;
                    nodeData.targetScale = null;
                    nodeData.targetSpriteScale = null;
                }
            }
        });
    }

    /**
     * Анимация отодвигания соседних узлов
     */
    updatePushingNodes() {
        this.nodeMeshes.forEach(nodeData => {
            if (nodeData.isPushing && nodeData.targetPushPosition) {
                // Плавное перемещение узла
                nodeData.mesh.position.lerp(nodeData.targetPushPosition, this.animationSpeed);
                
                // Перемещаем спрайт текста вместе с узлом
                if (nodeData.textSprite) {
                    const nodeRadius = (nodeData.node.level === 0 ? ROOT_RADIUS : NODE_RADIUS) * nodeData.mesh.scale.y;

                    // Получаем мировую позицию узла
                    const worldPos = new THREE.Vector3();
                    nodeData.mesh.getWorldPosition(worldPos);

                    // Преобразуем мировую позицию обратно в локальные координаты treeGroup
                    const localPos = new THREE.Vector3();
                    nodeData.treeGroup.worldToLocal(localPos.copy(worldPos));

                    // Обновляем позицию спрайта в локальных координатах
                    nodeData.textSprite.position.set(
                        localPos.x,
                        localPos.y + nodeRadius + 90,
                        localPos.z
                    );

                    // Принудительно обновляем матрицу спрайта
                    nodeData.textSprite.updateMatrix();
                    if (nodeData.textSprite.parent) {
                        nodeData.textSprite.parent.updateMatrixWorld(true);
                    }
                }

                // Проверяем, достигли ли мы целевой позиции
                const positionDiff = nodeData.mesh.position.distanceTo(nodeData.targetPushPosition);
                
                if (positionDiff < 0.1) {
                    // Достигли целевой позиции
                    nodeData.mesh.position.copy(nodeData.targetPushPosition);
                    if (nodeData.textSprite) {
                        const nodeRadius = (nodeData.node.level === 0 ? ROOT_RADIUS : NODE_RADIUS) * nodeData.mesh.scale.y;
                        nodeData.textSprite.position.set(
                            nodeData.mesh.position.x,
                            nodeData.mesh.position.y + nodeRadius + 90,
                            nodeData.mesh.position.z
                        );
                        // Принудительно обновляем матрицу спрайта и его родителя
                        nodeData.textSprite.updateMatrix();
                        if (nodeData.textSprite.parent) {
                            nodeData.textSprite.parent.updateMatrixWorld(true);
                        }
                    }
                    nodeData.isPushing = false;
                    nodeData.targetPushPosition = null;
                }
            }
        });
    }

    /**
     * Универсальное обновление позиций всех спрайтов каждый кадр
     * Это гарантирует, что спрайты всегда синхронизированы с узлами
     */
    updateTextSprites() {
        this.nodeMeshes.forEach(nodeData => {
            if (nodeData.textSprite && nodeData.mesh && !nodeData.isPushing) {
                const nodeRadius = (nodeData.node.level === 0 ? ROOT_RADIUS : NODE_RADIUS) * nodeData.mesh.scale.y;
                // Обновляем позицию спрайта, чтобы она точно соответствовала позиции узла
                nodeData.textSprite.position.set(
                    nodeData.mesh.position.x,
                    nodeData.mesh.position.y + nodeRadius + 90,
                    nodeData.mesh.position.z
                );
                // Принудительно обновляем матрицу спрайта для корректного отображения
                nodeData.textSprite.updateMatrix();
                if (nodeData.textSprite.parent) {
                    nodeData.textSprite.parent.updateMatrixWorld(true);
                }
            }
        });
    }

    /**
     * Обновить ссылки на массивы
     */
    updateReferences(nodeMeshes, fireflies, selectedNode) {
        this.nodeMeshes = nodeMeshes;
        this.fireflies = fireflies;
        this.selectedNode = selectedNode;
    }

    /**
     * Обновить параметры
     */
    updateParams(params) {
        if (params.animationSpeed !== undefined) this.animationSpeed = params.animationSpeed;
        if (params.fireflyOrbitRadius !== undefined) this.fireflyOrbitRadius = params.fireflyOrbitRadius;
    }
}

