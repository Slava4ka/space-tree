import * as THREE from 'three';
import { ROOT_RADIUS, NODE_RADIUS, EDGE_LINE_COLOR } from '../utils/constants.js';

/**
 * Класс для обработки взаимодействий с узлами (клики, выделение)
 */
export class NodeInteraction {
    constructor(options) {
        this.container = options.container;
        this.scene = options.scene;
        this.camera = options.camera;
        this.nodeMeshes = options.nodeMeshes || [];
        this.isDetailMode = options.isDetailMode || (() => false);
        this.selectedNode = options.selectedNode || null;
        this.currentZoom = options.currentZoom || 1;
        this.cameraTarget = options.cameraTarget || new THREE.Vector3(0, 0, 0);
        this.cameraPosition = options.cameraPosition || new THREE.Vector3(0, 800, 1000);
        this.originalCameraPosition = options.originalCameraPosition || null;
        this.originalCameraTarget = options.originalCameraTarget || null;
        this.detailModeSystem = options.detailModeSystem || null;
        
        // Callbacks
        this.onNodeSelect = options.onNodeSelect || (() => {});
        this.onNodeDeselect = options.onNodeDeselect || (() => {});
        this.onEnterDetailMode = options.onEnterDetailMode || (() => {});
        
        // Raycaster для определения кликов
        this.raycaster = new THREE.Raycaster();
        this.mouse = new THREE.Vector2();
    }

    /**
     * Проверить клик по узлу (вызывается из Controls перед началом перетаскивания)
     */
    checkNodeClick(event) {
        // В режиме детального просмотра
        if (this.isDetailMode()) {
            // Проверяем, что клик не по UI элементам
            const target = event.target;
            if (target && typeof target.closest === 'function') {
                const uiElement = target.closest('.detail-exit-btn') ||
                                  target.closest('.zoom-controls') ||
                                  target.closest('.layout-controls');
                if (uiElement) {
                    return true; // Блокируем перетаскивание, но не закрываем детальный режим
                }
            }

            // Обрабатываем клик (мышь или touch)
            // Проверяем наличие координат клика
            if (event.clientX !== undefined && event.clientY !== undefined) {
                // В детальном режиме закрываем его при клике на сцену (canvas)
                // Проверяем клик по выбранному узлу через raycasting
                this.mouse.x = (event.clientX / this.container.clientWidth) * 2 - 1;
                this.mouse.y = -(event.clientY / this.container.clientHeight) * 2 + 1;

                // Обновляем матрицы всех объектов перед raycasting
                this.scene.updateMatrixWorld(true);

                this.raycaster.setFromCamera(this.mouse, this.camera);

                // Проверяем пересечения только с выбранным узлом (он видим в детальном режиме)
                if (this.detailModeSystem) {
                    const currentNode = this.detailModeSystem.getCurrentNode();
                    if (currentNode && currentNode.mesh) {
                        const intersects = this.raycaster.intersectObject(currentNode.mesh, true);
                        
                        // Фильтруем результаты, игнорируя оболочку и неоновое кольцо
                        const validIntersects = intersects.filter(intersect => 
                            !intersect.object.userData.isGlowShell &&
                            !intersect.object.userData.isNeonRing
                        );
                        
                        // Если клик по выбранному узлу - ничего не делаем
                        if (validIntersects.length > 0) {
                            return true; // Блокируем перетаскивание, но не закрываем детальный режим
                        }
                    }
                }
                
                // Клик не по выбранному узлу (на сцену) - закрываем детальный режим
                if (this.detailModeSystem) {
                    this.detailModeSystem.exit();
                }
                if (event.preventDefault) {
                    event.preventDefault();
                }
                if (event.stopPropagation) {
                    event.stopPropagation();
                }
                return true; // Блокируем перетаскивание
            }
            
            return true; // Блокируем перетаскивание
        }

        if (event.button === 0) { // Левая кнопка мыши
            // Проверяем клик по узлу
            this.mouse.x = (event.clientX / this.container.clientWidth) * 2 - 1;
            this.mouse.y = -(event.clientY / this.container.clientHeight) * 2 + 1;

            // Обновляем матрицы всех объектов перед raycasting
            this.scene.updateMatrixWorld(true);

            this.raycaster.setFromCamera(this.mouse, this.camera);

            // Проверяем пересечения со всеми узлами
            const allMeshes = this.nodeMeshes.map(n => n.mesh);
            const intersects = this.raycaster.intersectObjects(allMeshes, true);

            if (intersects.length > 0) {
                // Находим первый пересекаемый объект, который не является оболочкой
                let clickedMesh = null;
                for (let i = 0; i < intersects.length; i++) {
                    const obj = intersects[i].object;
                    // Игнорируем оболочку, неоновое кольцо и другие вспомогательные элементы
                    if (!obj.userData.isGlowShell && 
                        !obj.userData.isNeonRing && 
                        allMeshes.includes(obj)) {
                        clickedMesh = obj;
                        break;
                    }
                    // Если это child элемент, проверяем родителя
                    if (obj.parent && 
                        !obj.parent.userData.isGlowShell && 
                        !obj.parent.userData.isNeonRing && 
                        allMeshes.includes(obj.parent)) {
                        clickedMesh = obj.parent;
                        break;
                    }
                }
                
                if (clickedMesh) {
                    this.handleNodeClick(clickedMesh);
                    event.preventDefault();
                    event.stopPropagation();
                    return true; // Блокируем перетаскивание
                }
            }
        }
        
        return false; // Не клик по узлу, можно начинать перетаскивание
    }

    /**
     * Обработка клика по узлу
     */
    handleNodeClick(mesh) {
        // Если кликнули по уже выделенному узлу - ничего не делаем
        if (this.selectedNode && this.selectedNode.mesh === mesh) {
            return;
        }
        
        // Возвращаем предыдущий узел на место, если есть
        if (this.selectedNode) {
            this.deselectNode(this.selectedNode);
        }
        
        // Выделяем новый узел
        const nodeData = this.nodeMeshes.find(n => n.mesh === mesh);
        if (nodeData) {
            this.selectNode(nodeData);
        }
    }

    /**
     * Выделение узла
     */
    selectNode(nodeData) {
        // Для узлов уровня 0 (корневые) и уровня 1 (задачи) - вход в режим детального просмотра
        if (nodeData.node.level === 0 || nodeData.node.level === 1) {
            this.enterDetailMode(nodeData);
            return;
        }

        this.selectedNode = nodeData;
        
        // Получаем текущую мировую позицию узла (узел остается на месте!)
        const worldPosition = new THREE.Vector3();
        nodeData.mesh.getWorldPosition(worldPosition);
        
        // Сохраняем исходную позицию камеры для возврата
        if (!this.originalCameraPosition) {
            this.originalCameraPosition = this.camera.position.clone();
            this.originalCameraTarget = this.cameraTarget.clone();
        }
        
        // Узел НЕ перемещается - остается на месте
        // Только масштабирование и изменение стиля
        nodeData.targetScale = new THREE.Vector3(2, 2, 2);
        if (nodeData.originalSpriteScale) {
            nodeData.targetSpriteScale = nodeData.originalSpriteScale.clone().multiplyScalar(2);
        }
        nodeData.isAnimating = true;
        
        // Находим соседние узлы и отодвигаем их, чтобы не было пересечений
        this.pushAwayNeighborNodes(nodeData);
        
        // Вычисляем целевую позицию камеры (чтобы узел был в центре экрана)
        // При выборе узла ПРИБЛИЖАЕМ камеру (увеличиваем зум) - используем меньшее расстояние
        const baseDirection = new THREE.Vector3(0, 800, 1000).normalize();
        const baseDistance = Math.sqrt(800 * 800 + 1000 * 1000);
        
        // При выборе узла применяем дополнительный зум для приближения
        // Используем зум 2x для приближения к узлу (можно настроить)
        const zoomForNodeSelection = 2.0;
        const effectiveZoom = this.currentZoom * zoomForNodeSelection;
        const distance = baseDistance / effectiveZoom;
        
        // Позиция камеры = позиция узла + смещение (сохраняем тот же угол обзора, ПРИБЛИЖАЕМ камеру)
        nodeData.targetCameraPosition = worldPosition.clone().add(
            baseDirection.clone().multiplyScalar(distance)
        );
        nodeData.targetCameraTarget = worldPosition.clone();
        
        // Сохраняем эффективный зум для этого узла
        nodeData.effectiveZoom = effectiveZoom;
        
        // ВСЕГДА используем плавную анимацию при выборе узла
        // Позиция камеры будет анимироваться к целевой позиции с учетом текущего зума
        nodeData.cameraPositionApplied = false;
        
        // Создаем выделенный материал
        const originalColor = nodeData.originalMaterial.color.getHex();
        nodeData.highlightMaterial = nodeData.mesh.material.clone();
        nodeData.highlightMaterial.emissive.setHex(originalColor);
        nodeData.highlightMaterial.emissiveIntensity = 1.5;
        nodeData.highlightMaterial.metalness = 0.8;
        nodeData.highlightMaterial.roughness = 0.1;
        
        // Увеличиваем обводку
        if (nodeData.mesh.children.length > 0) {
            const edgeLines = nodeData.mesh.children[0];
            if (edgeLines instanceof THREE.LineSegments) {
                edgeLines.material.opacity = 1.0;
                edgeLines.material.color.setHex(EDGE_LINE_COLOR); // Желтый цвет обводки
            }
        }
        
        // Вызываем callback
        this.onNodeSelect(nodeData);
    }

    /**
     * Отодвигание соседних узлов при выделении
     */
    pushAwayNeighborNodes(selectedNodeData) {
        // Получаем радиус увеличенного узла
        const selectedRadius = selectedNodeData.node.level === 0 ? this.rootRadius : this.nodeRadius;
        const selectedScaledRadius = selectedRadius * 2; // Увеличенный узел в 2 раза
        
        // Получаем мировую позицию выбранного узла
        const selectedWorldPos = new THREE.Vector3();
        selectedNodeData.mesh.getWorldPosition(selectedWorldPos);
        
        // Находим все соседние узлы, которые могут пересекаться
        const nodesToPush = [];
        
        this.nodeMeshes.forEach(otherNodeData => {
            // Пропускаем сам выбранный узел
            if (otherNodeData === selectedNodeData) return;
            
            // Получаем радиус другого узла
            const otherRadius = otherNodeData.node.level === 0 ? this.rootRadius : this.nodeRadius;
            
            // Получаем мировую позицию другого узла
            const otherWorldPos = new THREE.Vector3();
            otherNodeData.mesh.getWorldPosition(otherWorldPos);
            
            // Вычисляем расстояние между узлами
            const distance = selectedWorldPos.distanceTo(otherWorldPos);
            
            // Если расстояние меньше суммы радиусов (с запасом 10%), нужно отодвинуть
            const minDistance = selectedScaledRadius + otherRadius;
            const safeDistance = minDistance * 1.1; // 10% запас
            
            if (distance < safeDistance) {
                // Вычисляем направление от выбранного узла к другому
                const direction = new THREE.Vector3()
                    .subVectors(otherWorldPos, selectedWorldPos)
                    .normalize();
                
                // Вычисляем целевую позицию для другого узла
                const targetWorldPos = selectedWorldPos.clone()
                    .add(direction.multiplyScalar(safeDistance));
                
                // Преобразуем в локальные координаты treeGroup
                const targetLocalPos = new THREE.Vector3();
                otherNodeData.treeGroup.worldToLocal(targetLocalPos.copy(targetWorldPos));
                
                nodesToPush.push({
                    nodeData: otherNodeData,
                    targetPosition: targetLocalPos,
                    originalPosition: otherNodeData.originalPosition.clone()
                });
            }
        });
        
        // Сохраняем информацию о узлах, которые нужно отодвинуть
        selectedNodeData.pushedNodes = nodesToPush;
        
        // Устанавливаем целевые позиции для отодвигания
        nodesToPush.forEach(({ nodeData, targetPosition }) => {
            nodeData.targetPushPosition = targetPosition;
            nodeData.isPushing = true;
            
            // Сохраняем исходную позицию спрайта, если он есть
            if (nodeData.textSprite) {
                if (!nodeData.originalSpritePosition) {
                    nodeData.originalSpritePosition = nodeData.textSprite.position.clone();
                }
            }
        });
    }

    /**
     * Снятие выделения с узла
     */
    deselectNode(nodeData) {
        // Возвращаем масштаб узла к исходному (узел остается на месте!)
        nodeData.targetScale = new THREE.Vector3(1, 1, 1);
        if (nodeData.originalSpriteScale) {
            nodeData.targetSpriteScale = nodeData.originalSpriteScale.clone();
        }
        nodeData.isAnimating = true;
        
        // Возвращаем камеру к исходной позиции
        if (this.originalCameraPosition) {
            nodeData.targetCameraPosition = this.originalCameraPosition.clone();
            nodeData.targetCameraTarget = this.originalCameraTarget.clone();
        } else {
            nodeData.targetCameraPosition = this.cameraPosition.clone();
            nodeData.targetCameraTarget = this.cameraTarget.clone();
        }
        
        // Возвращаем соседние узлы на место
        if (nodeData.pushedNodes) {
            nodeData.pushedNodes.forEach(({ nodeData: pushedNodeData, originalPosition }) => {
                pushedNodeData.targetPushPosition = originalPosition;
                pushedNodeData.isPushing = true;
            });
            nodeData.pushedNodes = null;
        }
        
        // Восстанавливаем исходный материал
        nodeData.mesh.material = nodeData.originalMaterial;
        
        // Восстанавливаем обводку
        if (nodeData.mesh.children.length > 0) {
            const edgeLines = nodeData.mesh.children[0];
            if (edgeLines instanceof THREE.LineSegments) {
                edgeLines.material.opacity = 0.3;
                edgeLines.material.color.setHex(0xffffff);
            }
        }
        
        if (this.selectedNode === nodeData) {
            this.selectedNode = null;
        }
        
        // Вызываем callback
        this.onNodeDeselect(nodeData);
    }

    /**
     * Вход в режим детального просмотра
     */
    enterDetailMode(nodeData) {
        // ВСЕГДА обновляем сохраненные значения, чтобы использовать актуальные
        // Это важно, так как значения могут измениться после инициализации
        this.originalCameraPosition = this.camera.position.clone();
        this.originalCameraTarget = this.cameraTarget.clone();
        
        // Используем DetailModeSystem
        if (this.detailModeSystem) {
            this.detailModeSystem.enter(
                nodeData,
                this.currentZoom,
                this.originalCameraPosition,
                this.originalCameraTarget
            );
        }
        
        // Вызываем callback
        this.onEnterDetailMode(nodeData);
    }

    /**
     * Обновить ссылки на массивы узлов
     */
    updateNodeMeshes(nodeMeshes) {
        this.nodeMeshes = nodeMeshes;
    }

    /**
     * Обновить состояние (для синхронизации с внешним состоянием)
     */
    updateState(state) {
        if (state.selectedNode !== undefined) this.selectedNode = state.selectedNode;
        if (state.currentZoom !== undefined) this.currentZoom = state.currentZoom;
        if (state.cameraTarget !== undefined) {
            // Правильно копируем Vector3
            if (this.cameraTarget) {
                this.cameraTarget.copy(state.cameraTarget);
            } else {
                this.cameraTarget = state.cameraTarget.clone();
            }
        }
        if (state.originalCameraPosition !== undefined) this.originalCameraPosition = state.originalCameraPosition;
        if (state.originalCameraTarget !== undefined) this.originalCameraTarget = state.originalCameraTarget;
    }
    
    /**
     * Обновить параметры
     */
    updateParams(params) {
        if (params.rootRadius !== undefined) this.rootRadius = params.rootRadius;
        if (params.nodeRadius !== undefined) this.nodeRadius = params.nodeRadius;
    }
}

