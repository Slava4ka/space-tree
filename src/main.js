import '../styles.css';
import * as THREE from 'three';
import { mockData } from './mockData.js';
import { SceneManager } from './core/SceneManager.js';
import { CameraManager } from './core/CameraManager.js';
import { RendererManager } from './core/RendererManager.js';
import { Loop } from './core/Loop.js';
import { Controls } from './systems/Controls.js';
import { LoadingScreen } from './ui/LoadingScreen.js';
import { DetailModeSystem } from './systems/DetailModeSystem.js';
import { TreeBuilder } from './systems/TreeBuilder.js';
import { TreeRenderer } from './systems/TreeRenderer.js';
import { NodeInteraction } from './systems/NodeInteraction.js';
import { NodeAnimation } from './systems/NodeAnimation.js';
import { UIControlsManager } from './ui/UIControlsManager.js';
import { BackgroundVideo } from './ui/BackgroundVideo.js';
import {
    FIREFLY_SIZE,
    FIREFLY_ORBIT_RADIUS,
    FIREFLY_ROTATION_SPEED,
    DETAIL_MODE_SCREEN_SIZE_PERCENT,
    DETAIL_MODE_ZOOM,
    DETAIL_MODE_ANIMATION_TIME,
    DETAIL_MODE_ACTOR_RADIUS,
    ANIMATION_SPEED,
    CAMERA_INITIAL_DISTANCE,
    CAMERA_FOV
} from './utils/constants.js';

// Инициализация фонового видео
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => BackgroundVideo.init());
        } else {
    BackgroundVideo.init();
}

/**
 * Главный класс визуализации радиального дерева
 * Координирует работу всех систем
 */
class RadialTreeVisualization {
    constructor(containerId) {
        this.loadingScreen = new LoadingScreen();
        this.loadingScreen.updateProgress(10);
        this.container = document.getElementById(containerId);
        
        // Инициализация core модулей
        this.sceneManager = new SceneManager();
        this.scene = this.sceneManager.getScene();
        
        const aspect = window.innerWidth / window.innerHeight;
        this.cameraManager = new CameraManager(aspect);
        this.camera = this.cameraManager.getCamera();
        
        this.rendererManager = new RendererManager(this.container);
        this.renderer = this.rendererManager.getRenderer();
        
        this.loop = new Loop();
        
        // Параметры layout'а
        this.spacingFactor = 1.4;
        this.levelMarginFactor = 0.6;
        this.graphRotation = { x: 0, y: 0, z: 15 };
        
        // Параметры светлячков
        this.fireflySize = FIREFLY_SIZE;
        this.fireflyOrbitRadius = FIREFLY_ORBIT_RADIUS;
        this.fireflyRotationSpeed = FIREFLY_ROTATION_SPEED;
        
        // Константы режима детального просмотра
        this.DETAIL_MODE_SCREEN_SIZE_PERCENT = DETAIL_MODE_SCREEN_SIZE_PERCENT;
        this.DETAIL_MODE_ZOOM = DETAIL_MODE_ZOOM;
        this.DETAIL_MODE_ANIMATION_TIME = DETAIL_MODE_ANIMATION_TIME;
        this.DETAIL_MODE_ACTOR_RADIUS = DETAIL_MODE_ACTOR_RADIUS;

        // Переменные для управления камерой
        this.cameraPosition = new THREE.Vector3(0, 800, 1000);
        this.cameraTarget = this.cameraManager.getTarget();
        this.currentZoom = this.cameraManager.getZoom();
        this.initialCameraDistance = CAMERA_INITIAL_DISTANCE;
        this.originalCameraPosition = null;
        this.originalCameraTarget = null;
        
        // Состояние
        this.isDetailMode = false;
        this.detailModeNode = null;
        this.selectedNode = null;
        this.animationSpeed = ANIMATION_SPEED;
        
        // Массивы (будут заполнены TreeRenderer)
        this.nodeMeshes = [];
        this.treeGroups = [];
        this.fireflies = [];
        
        // TreeBuilder для вычисления maxNodesPerLevel
        this.treeBuilder = new TreeBuilder();
        this.maxNodesPerLevel = this.treeBuilder.computeMaxNodesPerLevel(mockData, 3);
        this.levelLimits = {
            1: this.maxNodesPerLevel[1] ?? 0,
            2: 0,
        };
        
        // Инициализация систем
        this.init();
        
        // Создание деревьев
        this.createTrees(3);
        
        // Настройка UI контролов
        this.setupUIControls();
        
        // Настройка анимационного цикла
        this.setupAnimationLoop();
    }
    
    init() {
        // Обработка изменения размера окна
        window.addEventListener('resize', () => this.onWindowResize());
        
        // Инициализация управления камерой мышью
        this.controls = new Controls(
            this.container,
            this.cameraManager,
            (event) => this.nodeInteraction.checkNodeClick(event),
            () => this.updateCameraPosition()
        );
        
        // Инициализация системы детального режима
        this.detailModeSystem = new DetailModeSystem({
            scene: this.scene,
            camera: this.camera,
            cameraManager: this.cameraManager,
            treeGroups: this.treeGroups,
            fireflies: this.fireflies,
            nodeMeshes: this.nodeMeshes,
            controls: this.controls,
            DETAIL_MODE_SCREEN_SIZE_PERCENT: this.DETAIL_MODE_SCREEN_SIZE_PERCENT,
            DETAIL_MODE_ZOOM: this.DETAIL_MODE_ZOOM,
            DETAIL_MODE_ANIMATION_TIME: this.DETAIL_MODE_ANIMATION_TIME,
            DETAIL_MODE_ACTOR_RADIUS: this.DETAIL_MODE_ACTOR_RADIUS,
            initialCameraDistance: this.initialCameraDistance,
            onZoomChange: (newZoom) => {
                this.currentZoom = newZoom;
                this.updateCameraZoom();
            },
            onCameraTargetChange: (newTarget) => {
                this.cameraTarget.copy(newTarget);
                this.updateCameraPosition();
            },
            onCameraPositionChange: (newPosition) => {
                this.camera.position.copy(newPosition);
            },
            onStateChange: (isActive, node) => {
                this.isDetailMode = isActive;
                this.detailModeNode = node;
            }
        });
        
        // Инициализация NodeInteraction
        this.nodeInteraction = new NodeInteraction({
            container: this.container,
            scene: this.scene,
            camera: this.camera,
            nodeMeshes: this.nodeMeshes,
            isDetailMode: () => this.isDetailMode,
            selectedNode: this.selectedNode,
            currentZoom: this.currentZoom,
            cameraTarget: this.cameraTarget,
            cameraPosition: this.cameraPosition,
            originalCameraPosition: this.originalCameraPosition,
            originalCameraTarget: this.originalCameraTarget,
            detailModeSystem: this.detailModeSystem,
            onNodeSelect: (nodeData) => {
                this.selectedNode = nodeData;
            },
            onNodeDeselect: (nodeData) => {
                if (this.selectedNode === nodeData) {
                    this.selectedNode = null;
                }
            },
            onEnterDetailMode: (nodeData) => {
                // Обработка входа в детальный режим
            }
        });
        
        // Инициализация NodeAnimation
        this.nodeAnimation = new NodeAnimation({
            nodeMeshes: this.nodeMeshes,
            fireflies: this.fireflies,
            selectedNode: this.selectedNode,
            animationSpeed: this.animationSpeed,
            fireflyOrbitRadius: this.fireflyOrbitRadius,
            isDetailMode: () => this.isDetailMode,
            detailModeNode: () => this.detailModeNode,
            camera: this.camera,
            cameraTarget: this.cameraTarget,
            updateCameraPosition: () => this.updateCameraPosition(),
            DETAIL_MODE_SCREEN_SIZE_PERCENT: this.DETAIL_MODE_SCREEN_SIZE_PERCENT,
            initialCameraDistance: this.cameraManager.initialDistance
        });
        
        // Инициализация TreeRenderer
        this.treeRenderer = new TreeRenderer({
            scene: this.scene,
            sceneManager: this.sceneManager,
            loadingScreen: this.loadingScreen,
            detailModeSystem: this.detailModeSystem,
                spacingFactor: this.spacingFactor,
                levelMarginFactor: this.levelMarginFactor,
            levelLimits: this.levelLimits,
            graphRotation: this.graphRotation,
            fireflySize: this.fireflySize,
            fireflyOrbitRadius: this.fireflyOrbitRadius,
            fireflyRotationSpeed: this.fireflyRotationSpeed,
            onNodeMeshesUpdate: (nodeMeshes) => {
                this.nodeMeshes = nodeMeshes;
                this.nodeInteraction.updateNodeMeshes(nodeMeshes);
                this.nodeAnimation.updateReferences(nodeMeshes, this.fireflies, this.selectedNode);
            },
            onTreeGroupsUpdate: (treeGroups) => {
                this.treeGroups = treeGroups;
                if (this.detailModeSystem) {
                    this.detailModeSystem.treeGroups = treeGroups;
                }
            },
            onFirefliesUpdate: (fireflies) => {
                this.fireflies = fireflies;
                this.nodeAnimation.updateReferences(this.nodeMeshes, fireflies, this.selectedNode);
                if (this.detailModeSystem) {
                    this.detailModeSystem.fireflies = fireflies;
                }
            }
        });
    }
    
    createTrees(depth) {
        this.treeRenderer.createTrees(mockData, depth);
        
        // Обновляем ссылки после создания
        const refs = this.treeRenderer.getReferences();
        this.nodeMeshes = refs.nodeMeshes;
        this.treeGroups = refs.treeGroups;
        this.fireflies = refs.fireflies;
        
        // Обновляем ссылки в системах
        this.nodeInteraction.updateNodeMeshes(this.nodeMeshes);
        this.nodeAnimation.updateReferences(this.nodeMeshes, this.fireflies, this.selectedNode);
        
        // Вычисляем и устанавливаем минимальный зум на основе размера сцены
        this.calculateAndSetMinZoom();
    }
    
    /**
     * Вычисление минимального зума на основе размера сцены
     */
    calculateAndSetMinZoom() {
        const sceneBounds = this.treeRenderer.getSceneBounds();
        if (!sceneBounds) return;
        
        const maxRadius = sceneBounds.maxRadius;
        
        // Вычисляем требуемое расстояние для обзора всей сцены
        const fovRad = (CAMERA_FOV * Math.PI) / 180;
        const visibleHeight = 2 * maxRadius * 1.2; // +20% запас
        const requiredDistance = visibleHeight / (2 * Math.tan(fovRad / 2));
        
        // Вычисляем минимальный зум
        const baseDistance = this.cameraManager.getBaseDistance();
        const minZoom = baseDistance / requiredDistance;
        
        // Устанавливаем минимальный зум
        this.cameraManager.setMinZoom(minZoom);
    }
    
    setupUIControls() {
        // Инициализация UIControlsManager
        this.uiControls = new UIControlsManager({
            container: this.container,
            cameraManager: this.cameraManager,
            isDetailMode: () => this.isDetailMode,
            currentZoom: () => this.currentZoom,
            updateCurrentZoom: (newZoom) => {
                this.currentZoom = newZoom;
            },
            updateCameraZoom: () => this.updateCameraZoom(),
            updateCameraPosition: () => this.updateCameraPosition(),
            selectedNode: this.selectedNode,
            spacingFactor: this.spacingFactor,
            levelMarginFactor: this.levelMarginFactor,
            levelLimits: this.levelLimits,
            maxNodesPerLevel: this.maxNodesPerLevel,
            graphRotation: this.graphRotation,
            fireflySize: this.fireflySize,
            fireflyOrbitRadius: this.fireflyOrbitRadius,
            fireflyRotationSpeed: this.fireflyRotationSpeed,
            fireflies: this.fireflies,
            treeGroups: this.treeGroups,
            DETAIL_MODE_SCREEN_SIZE_PERCENT: this.DETAIL_MODE_SCREEN_SIZE_PERCENT,
            detailModeSystem: this.detailModeSystem,
            onSpacingFactorChange: (value) => {
                this.spacingFactor = value;
                this.treeRenderer.updateParams({ spacingFactor: value });
                this.createTrees(3);
            },
            onLevelMarginFactorChange: (value) => {
                this.levelMarginFactor = value;
                this.treeRenderer.updateParams({ levelMarginFactor: value });
                this.createTrees(3);
            },
            onLevelLimitsChange: (levelLimits) => {
                this.levelLimits = levelLimits;
                this.treeRenderer.updateParams({ levelLimits });
                this.createTrees(3);
            },
            onGraphRotationChange: (graphRotation) => {
                this.graphRotation = graphRotation;
                this.treeRenderer.updateParams({ graphRotation });
                // Обновляем вращение всех существующих деревьев
                this.treeGroups.forEach(treeGroup => {
                    treeGroup.rotation.x = (graphRotation.x * Math.PI) / 180;
                    treeGroup.rotation.y = (graphRotation.y * Math.PI) / 180;
                    treeGroup.rotation.z = (graphRotation.z * Math.PI) / 180;
                });
            },
            onFireflySizeChange: (value) => {
                this.fireflySize = value;
                this.treeRenderer.updateParams({ fireflySize: value });
                
                // Обновляем размер всех существующих светлячков
                this.fireflies.forEach(firefly => {
                    if (firefly.mesh && firefly.mesh.userData && firefly.mesh.userData.fireflyInstance) {
                        // Используем метод updateSize из экземпляра Firefly
                        firefly.mesh.userData.fireflyInstance.updateSize(value);
                    }
                });
            },
            onFireflyRadiusChange: (value) => {
                this.fireflyOrbitRadius = value;
                this.treeRenderer.updateParams({ fireflyOrbitRadius: value });
                this.nodeAnimation.updateParams({ fireflyOrbitRadius: value });
                
                // Обновляем смещение радиуса орбиты у всех существующих светлячков
                this.fireflies.forEach(firefly => {
                    firefly.orbitRadiusOffset = value;
                });
                
                // Если мы в детальном режиме, обновляем сохраненные смещения
                if (this.isDetailMode && this.detailModeSystem) {
                    this.detailModeSystem.updateFireflyOrbitRadius(value);
                }
            },
            onFireflySpeedChange: (value) => {
                this.fireflyRotationSpeed = value;
                this.treeRenderer.updateParams({ fireflyRotationSpeed: value });
                this.fireflies.forEach(firefly => {
                    firefly.speed = value;
                });
            },
            onDetailModeSizeChange: (value) => {
                this.DETAIL_MODE_SCREEN_SIZE_PERCENT = value;
                this.nodeAnimation.updateParams({ DETAIL_MODE_SCREEN_SIZE_PERCENT: value });
                if (this.isDetailMode && this.detailModeNode) {
                    this.detailModeSystem.setScreenSizePercent(value);
                }
            }
        });
        
        this.uiControls.setupZoomControls();
        this.uiControls.setupLayoutControls();
    }
    
    updateCameraPosition() {
        // В режиме детального просмотра не синхронизируем с CameraManager
        if (!this.isDetailMode) {
            this.cameraTarget = this.cameraManager.getTarget();
        }
        
        // Обновляем позицию камеры
        const baseDirection = new THREE.Vector3(0, 800, 1000).normalize();
        const baseDistance = Math.sqrt(800 * 800 + 1000 * 1000);
        const distance = baseDistance / this.currentZoom;
        const offset = baseDirection.clone().multiplyScalar(distance);
        
        this.camera.position.copy(this.cameraTarget).add(offset);
        this.camera.lookAt(this.cameraTarget);
        this.camera.updateProjectionMatrix();
    }
    
    updateCameraZoom() {
        // В режиме детального просмотра зум управляется через DetailModeSystem
        if (this.isDetailMode) {
            this.updateCameraPosition();
            return;
        }
        
        // Если есть выделенный узел, обновляем его целевую позицию камеры
        if (this.selectedNode) {
            const nodeData = this.selectedNode;
            const worldPosition = new THREE.Vector3();
            nodeData.mesh.getWorldPosition(worldPosition);
            
            const baseDirection = new THREE.Vector3(0, 800, 1000).normalize();
            const baseDistance = Math.sqrt(800 * 800 + 1000 * 1000);
            const zoomForNodeSelection = 2.0;
            const effectiveZoom = this.currentZoom * zoomForNodeSelection;
            const distance = baseDistance / effectiveZoom;
            
            nodeData.targetCameraPosition = worldPosition.clone().add(
                baseDirection.clone().multiplyScalar(distance)
            );
            nodeData.targetCameraTarget = worldPosition.clone();
            nodeData.effectiveZoom = effectiveZoom;
            
            this.cameraTarget.copy(nodeData.targetCameraTarget);
            this.updateCameraPosition();
            nodeData.cameraPositionApplied = true;
        } else {
            this.updateCameraPosition();
        }
    }
    
    onWindowResize() {
        const width = window.innerWidth;
        const height = window.innerHeight;
        
        this.cameraManager.updateAspect(width / height);
        this.rendererManager.resize(width, height);
    }
    
    setupAnimationLoop() {
        this.loop.addUpdateCallback((deltaTime) => {
            this.update(deltaTime);
        });
        this.loop.start();
    }
    
    update(deltaTime) {
        // Обновляем анимации узлов
        this.nodeAnimation.update(deltaTime);
        
        // Обновляем состояние NodeInteraction
        this.nodeInteraction.updateState({
            selectedNode: this.selectedNode,
            currentZoom: this.currentZoom,
            cameraTarget: this.cameraTarget
        });
        
        // Обновляем состояние NodeAnimation
        this.nodeAnimation.updateReferences(this.nodeMeshes, this.fireflies, this.selectedNode);
        
        // Рендерим сцену
        this.rendererManager.render(this.scene, this.camera);
    }
}

// Инициализация приложения
window.addEventListener('DOMContentLoaded', () => {
    const viz = new RadialTreeVisualization('scene-canvas');

    // Скрываем загрузочный экран после инициализации
    setTimeout(() => {
        const canvas = document.getElementById('scene-canvas');
        if (canvas) {
            canvas.style.display = 'block';
        }
        viz.loadingScreen.hide();
    }, 1000);
});
