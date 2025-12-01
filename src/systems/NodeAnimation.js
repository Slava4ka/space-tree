import * as THREE from 'three';
import { ROOT_RADIUS, NODE_RADIUS, TEXT_OFFSET_Y, MOBILE_TEXT_OFFSET_Y, MOBILE_TEXT_OFFSET_X } from '../utils/constants.js';
import { isMobileDevice } from '../utils/DeviceUtils.js';

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
        this.detailModeNode = options.detailModeNode || (() => null);
        this.camera = options.camera || null;
        this.cameraTarget = options.cameraTarget || new THREE.Vector3(0, 0, 0);
        this.updateCameraPosition = options.updateCameraPosition || (() => {});
        this.DETAIL_MODE_SCREEN_SIZE_PERCENT = options.DETAIL_MODE_SCREEN_SIZE_PERCENT || 22;
        this.initialCameraDistance = options.initialCameraDistance || 1280.6;
        this.rootRadius = options.rootRadius || ROOT_RADIUS;
        this.nodeRadius = options.nodeRadius || NODE_RADIUS;
        this.isAnimatingEnter = options.isAnimatingEnter || (() => false);
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
        // Пропускаем обновление светлячков во время анимации входа в детальный режим
        // Позиции светлячков обновляются напрямую в DetailModeSystem.animateEnter()
        if (this.isAnimatingEnter && typeof this.isAnimatingEnter === 'function' && this.isAnimatingEnter()) {
            // Обновляем только углы для вращения, но не позиции
            this.fireflies.forEach((firefly) => {
                if (firefly.mesh) {
                    firefly.angle += firefly.speed * 0.01;
                }
            });
            return;
        }
        
        // Создаем Map для быстрого доступа к nodeMeshes по nodeId (O(1) вместо O(n))
        // Пересоздаем только если nodeMeshes изменились
        if (!this._nodeMeshesMap || this._nodeMeshesMapSize !== this.nodeMeshes.length) {
            this._nodeMeshesMap = new Map();
            this.nodeMeshes.forEach(nodeData => {
                this._nodeMeshesMap.set(nodeData.node.id, nodeData);
            });
            this._nodeMeshesMapSize = this.nodeMeshes.length;
        }
        
        this.fireflies.forEach((firefly, index) => {
            if (!firefly.mesh) return;
            
            // Обновляем угол с учетом скорости
            firefly.angle += firefly.speed * 0.01;
            
            // Находим узел для определения его радиуса (O(1) вместо O(n))
            const nodeData = this._nodeMeshesMap.get(firefly.nodeId);
            const detailModeNode = typeof this.detailModeNode === 'function' ? this.detailModeNode() : this.detailModeNode;
            const isDetailModeFirefly = this.isDetailMode() && 
                detailModeNode && 
                firefly.nodeId === detailModeNode.node.id;
            
            // Определяем базовый радиус узла
            let baseNodeRadius = nodeData ? (nodeData.node.level === 0 ? this.rootRadius : this.nodeRadius) : this.nodeRadius;
            
            // В детальном режиме умножаем базовый радиус на коэффициент масштаба узла
            if (isDetailModeFirefly && detailModeNode && nodeData) {
                const scaleFactor = this.calculateScale(nodeData);
                baseNodeRadius = baseNodeRadius * scaleFactor;
                firefly.mesh.visible = true;
            }
            
            // Вычисляем радиус орбиты: радиус узла + смещение из настройки
            const offset = firefly.orbitRadiusOffset !== undefined ? firefly.orbitRadiusOffset : this.fireflyOrbitRadius;
            const orbitRadius = baseNodeRadius + offset;
            
            // Вычисляем новую позицию на орбите
            const orbitX = Math.cos(firefly.angle) * orbitRadius;
            const orbitY = 0;
            const orbitZ = Math.sin(firefly.angle) * orbitRadius;
            
            // В детальном режиме узел в центре (0, 0, 0), в обычном - используем позицию узла
            if (isDetailModeFirefly) {
                firefly.mesh.position.set(orbitX, orbitY, orbitZ);
            } else {
                firefly.mesh.position.set(
                    firefly.nodePosition.x + orbitX,
                    firefly.nodePosition.y + orbitY,
                    firefly.nodePosition.z + orbitZ
                );
            }
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
     * Оптимизировано: группирует обновления матриц
     */
    updatePushingNodes() {
        // Собираем родительские группы для группового обновления матриц
        const parentGroupsToUpdate = new Set();
        
        this.nodeMeshes.forEach(nodeData => {
            if (nodeData.isPushing && nodeData.targetPushPosition) {
                // Плавное перемещение узла
                nodeData.mesh.position.lerp(nodeData.targetPushPosition, this.animationSpeed);
                
                // Перемещаем спрайт текста вместе с узлом
                if (nodeData.textSprite) {
                    const nodeRadius = (nodeData.node.level === 0 ? this.rootRadius : this.nodeRadius) * nodeData.mesh.scale.y;

                    // Используем локальную позицию напрямую (оптимизация - избегаем getWorldPosition)
                    nodeData.textSprite.position.set(
                        nodeData.mesh.position.x,
                        nodeData.mesh.position.y + nodeRadius + TEXT_OFFSET_Y,
                        nodeData.mesh.position.z
                    );

                    // Обновляем матрицу спрайта
                    nodeData.textSprite.updateMatrix();
                    
                    // Собираем родительские группы для группового обновления
                    if (nodeData.textSprite.parent) {
                        parentGroupsToUpdate.add(nodeData.textSprite.parent);
                    }
                }

                // Проверяем, достигли ли мы целевой позиции
                const positionDiff = nodeData.mesh.position.distanceTo(nodeData.targetPushPosition);
                
                if (positionDiff < 0.1) {
                    // Достигли целевой позиции
                    nodeData.mesh.position.copy(nodeData.targetPushPosition);
                    if (nodeData.textSprite) {
                        const nodeRadius = (nodeData.node.level === 0 ? this.rootRadius : this.nodeRadius) * nodeData.mesh.scale.y;
                        nodeData.textSprite.position.set(
                            nodeData.mesh.position.x,
                            nodeData.mesh.position.y + nodeRadius + TEXT_OFFSET_Y,
                            nodeData.mesh.position.z
                        );
                        nodeData.textSprite.updateMatrix();
                        if (nodeData.textSprite.parent) {
                            parentGroupsToUpdate.add(nodeData.textSprite.parent);
                        }
                    }
                    nodeData.isPushing = false;
                    nodeData.targetPushPosition = null;
                }
            }
        });
        
        // Групповое обновление матриц всех родительских групп (оптимизация)
        parentGroupsToUpdate.forEach(parent => {
            parent.updateMatrixWorld(true);
        });
    }

    /**
     * Универсальное обновление позиций всех спрайтов каждый кадр
     * Оптимизировано: обновляет только видимые спрайты и группирует обновления матриц
     */
    updateTextSprites() {
        const isDetailMode = typeof this.isDetailMode === 'function' ? this.isDetailMode() : this.isDetailMode;
        const detailModeNode = typeof this.detailModeNode === 'function' ? this.detailModeNode() : this.detailModeNode;
        const isMobile = isMobileDevice();
        
        // Собираем все родительские группы для группового обновления матриц
        const parentGroupsToUpdate = new Set();
        
        this.nodeMeshes.forEach(nodeData => {
            // Обновляем только видимые спрайты, которые не двигаются
            if (nodeData.textSprite && nodeData.mesh && !nodeData.isPushing && nodeData.textSprite.visible) {
                const nodeRadius = (nodeData.node.level === 0 ? this.rootRadius : this.nodeRadius) * nodeData.mesh.scale.y;
                
                // Для мобильных устройств в детальном режиме увеличиваем расстояние от текста до узла и добавляем отступ слева
                const isDetailModeNode = isDetailMode && detailModeNode && nodeData.node.id === detailModeNode.node.id;
                const textOffset = (isMobile && isDetailModeNode) ? MOBILE_TEXT_OFFSET_Y : TEXT_OFFSET_Y;
                const textOffsetX = (isMobile && isDetailModeNode) ? MOBILE_TEXT_OFFSET_X : 0;
                
                // Обновляем позицию спрайта, чтобы она точно соответствовала позиции узла
                nodeData.textSprite.position.set(
                    nodeData.mesh.position.x + textOffsetX,
                    nodeData.mesh.position.y + nodeRadius + textOffset,
                    nodeData.mesh.position.z
                );
                
                // Обновляем матрицу спрайта
                nodeData.textSprite.updateMatrix();
                
                // Собираем родительские группы для группового обновления
                if (nodeData.textSprite.parent) {
                    parentGroupsToUpdate.add(nodeData.textSprite.parent);
                }
            }
        });
        
        // Групповое обновление матриц всех родительских групп (оптимизация)
        parentGroupsToUpdate.forEach(parent => {
            parent.updateMatrixWorld(true);
        });
    }

    /**
     * Обновить ссылки на массивы
     */
    updateReferences(nodeMeshes, fireflies, selectedNode) {
        this.nodeMeshes = nodeMeshes;
        this.fireflies = fireflies;
        this.selectedNode = selectedNode;
        // Сбрасываем кэш Map при обновлении ссылок
        this._nodeMeshesMap = null;
        this._nodeMeshesMapSize = 0;
    }

    /**
     * Вычисление масштаба узла на основе процента ширины экрана (аналогично DetailModeSystem)
     */
    calculateScale(nodeData) {        
        const nodeRadius = nodeData.node.level === 0 ? this.rootRadius : this.nodeRadius;
        const nodeDiameter = nodeRadius * 2;

        const fov = this.camera.fov * (Math.PI / 180);
        const standardDistance = this.initialCameraDistance;
        const visibleHeight = 2 * Math.tan(fov / 2) * standardDistance;
        const visibleWidth = visibleHeight * this.camera.aspect;

        const targetSize = visibleWidth * (this.DETAIL_MODE_SCREEN_SIZE_PERCENT / 100);
        const scale = targetSize / nodeDiameter;

        return scale * 1.2;
    }

    /**
     * Обновить параметры
     */
    updateParams(params) {
        if (params.animationSpeed !== undefined) this.animationSpeed = params.animationSpeed;
        if (params.fireflyOrbitRadius !== undefined) this.fireflyOrbitRadius = params.fireflyOrbitRadius;
        if (params.DETAIL_MODE_SCREEN_SIZE_PERCENT !== undefined) this.DETAIL_MODE_SCREEN_SIZE_PERCENT = params.DETAIL_MODE_SCREEN_SIZE_PERCENT;
        if (params.rootRadius !== undefined) this.rootRadius = params.rootRadius;
        if (params.nodeRadius !== undefined) this.nodeRadius = params.nodeRadius;
    }
}
