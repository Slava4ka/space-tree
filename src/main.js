import '../styles.css';
import * as THREE from 'three';
import { TreeNode, mockData } from './mockData.js';
import { debounce } from 'lodash';

// Инициализация фонового видео для мобильных устройств
function initBackgroundVideo() {
    const video = document.querySelector('.video-background video');
    if (video) {
        // Пытаемся запустить видео
        const playPromise = video.play();
        
        if (playPromise !== undefined) {
            playPromise.catch(error => {
                console.warn('Autoplay заблокирован на мобильном устройстве:', error);
                // Fallback: скрываем видео, показываем градиентный фон
                const videoContainer = document.querySelector('.video-background');
                if (videoContainer) {
                    videoContainer.style.background = 'linear-gradient(135deg, #000428 0%, #004e92 100%)';
                    video.style.display = 'none';
                }
            });
        }
        
        // Дополнительно пытаемся запустить при взаимодействии пользователя
        const tryPlay = () => {
            if (video.paused) {
                video.play().catch(() => {});
            }
            document.removeEventListener('touchstart', tryPlay);
            document.removeEventListener('click', tryPlay);
        };
        
        document.addEventListener('touchstart', tryPlay, { once: true });
        document.addEventListener('click', tryPlay, { once: true });
    }
}

// Запускаем инициализацию видео после загрузки DOM
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initBackgroundVideo);
} else {
    initBackgroundVideo();
}
import { SceneManager } from './core/SceneManager.js';
import { CameraManager } from './core/CameraManager.js';
import { RendererManager } from './core/RendererManager.js';
import { Loop } from './core/Loop.js';
import { TextureGenerator } from './utils/TextureGenerator.js';
import { Firefly } from './objects/Firefly.js';
import { LayoutCalculator } from './systems/LayoutCalculator.js';
import { Controls } from './systems/Controls.js';
import { LoadingScreen } from './ui/LoadingScreen.js';
import { DetailModeSystem } from './systems/DetailModeSystem.js';
import {
    ROOT_RADIUS,
    NODE_RADIUS,
    H_STEP,
    FIREFLY_SIZE,
    FIREFLY_ORBIT_RADIUS,
    FIREFLY_ROTATION_SPEED,
    FIREFLY_CORE_SIZE_MULTIPLIER,
    DETAIL_MODE_SCREEN_SIZE_PERCENT,
    DETAIL_MODE_ZOOM,
    DETAIL_MODE_ANIMATION_TIME,
    DETAIL_MODE_ACTOR_RADIUS,
    ANIMATION_SPEED,
    CAMERA_INITIAL_DISTANCE,
    ROOT_NODE_COLOR,
    LEVEL_1_COLOR,
    LEVEL_2_COLOR,
    LEVEL_3_COLOR,
    DEFAULT_NODE_COLOR,
    NODE_MATERIAL_COLOR,
    EDGE_LINE_COLOR,
    EDGE_LINE_COLOR_WHITE,
    TEXT_COLOR,
    TEXT_STROKE_COLOR,
    TEXT_STROKE_WIDTH,
    SPHERE_SEGMENTS,
    SPHERE_RINGS,
    TEXT_SCALE_FACTOR,
    TEXT_PADDING
} from './utils/constants.js';

// Кэш для деревьев (чтобы не пересчитывать каждый раз)
let cachedTrees = null;
let cachedDepth = null;

// Преобразование статического массива данных в структуру TreeNode
// Возвращает массив деревьев (несколько root узлов)
function buildTreesFromData(data, maxDepth, childrenCache = null) {
    // Создаем кэш детей если не передан
    if (!childrenCache) {
        childrenCache = new Map();
        data.forEach(item => {
            if (!childrenCache.has(item.parentId)) {
                childrenCache.set(item.parentId, []);
            }
            childrenCache.get(item.parentId).push(item);
        });
    }

    // Используем кэш, если глубина не изменилась
    if (cachedTrees && cachedDepth === maxDepth) {
        // Возвращаем глубокую копию узлов, чтобы избежать мутации
        return cachedTrees.map(({ root, nodes }) => {
            // Создаем копии узлов
    const nodeMap = new Map();
            const newNodes = [];

            nodes.forEach(node => {
                const newNode = new TreeNode(node.id, null, node.level);
                newNode.text = node.text;
                newNode.position.copy(node.position);
                newNode.angle = node.angle;
                nodeMap.set(node.id, newNode);
                newNodes.push(newNode);
            });

            // Восстанавливаем связи
            nodes.forEach(node => {
                const newNode = nodeMap.get(node.id);
                if (node.parent) {
                    newNode.parent = nodeMap.get(node.parent.id);
                }
                node.children.forEach(child => {
                    newNode.children.push(nodeMap.get(child.id));
                });
            });

            const newRoot = nodeMap.get(root.id);
            return { root: newRoot, nodes: newNodes };
        });
    }

    const nodeMap = new Map();
    const roots = [];
    
    // Создаем все узлы
    data.forEach(item => {
        const node = new TreeNode(item.id, null, 0);
        node.text = item.text;
        nodeMap.set(item.id, { node, parentId: item.parentId });
        
        if (item.parentId === null) {
            roots.push(node);
        }
    });
    
    // Вычисляем уровни рекурсивно для каждого корня
    function calculateLevel(nodeId, level) {
        if (level > maxDepth) return;
        
        const item = nodeMap.get(nodeId);
        if (!item) return;
        
        item.node.level = level;
        
        // Находим всех потомков
        data.forEach(childItem => {
            if (childItem.parentId === nodeId) {
                calculateLevel(childItem.id, level + 1);
            }
        });
    }
    
    // Вычисляем уровни для каждого корня
    roots.forEach(root => {
        calculateLevel(root.id, 0);
    });
    
    // Устанавливаем связи и собираем узлы для каждого дерева
    const trees = roots.map(root => {
        const nodes = [];
        
        // Собираем все узлы этого дерева
        function collectNodes(nodeId) {
            const item = nodeMap.get(nodeId);
            if (!item || item.node.level > maxDepth) return;
            
            nodes.push(item.node);
            
            // Устанавливаем связи
            if (item.parentId !== null) {
                const parentItem = nodeMap.get(item.parentId);
                if (parentItem && parentItem.node.level < maxDepth) {
                    item.node.parent = parentItem.node;
                    parentItem.node.children.push(item.node);
                }
            }
            
            // Рекурсивно собираем потомков
            data.forEach(childItem => {
                if (childItem.parentId === nodeId) {
                    collectNodes(childItem.id);
        }
    });
        }
        
        collectNodes(root.id);
    
    return { root, nodes };
    });
    
    cachedTrees = trees;
    cachedDepth = maxDepth;
    
    return trees;
}

// Получить радиус узла
function getNodeRadius(node, isRoot = false) {
    return isRoot ? ROOT_RADIUS : NODE_RADIUS;
}

// === Радиальный layout без force-layout ====================================

// Функция collectLeavesDFS перенесена в LayoutCalculator

/**
 * Назначаем углы:
 *  - листьям — равномерно по окружности;
 *  - внутренним узлам — средний угол по детям (с учётом цикличности).
 */
// Функции перенесены в LayoutCalculator
// Используем LayoutCalculator.assignAngles() и LayoutCalculator.groupNodesByLevel()

/**
 * Считаем максимальное количество узлов на каждом уровне для всех деревьев.
 */
function computeMaxNodesPerLevel(maxDepth) {
    const trees = buildTreesFromData(mockData, maxDepth);
    const result = {};
    
    trees.forEach(({ nodes }) => {
        const levels = LayoutCalculator.groupNodesByLevel(nodes);
    levels.forEach((levelNodes, level) => {
            const current = result[level] ?? 0;
            result[level] = Math.max(current, levelNodes.length);
    });
    });
    
    return result;
}

/**
 * Фильтрация дерева по максимальному количеству узлов на каждом уровне.
 * levelLimits: { 1: number, 2: number, 3: number }
 */
function filterTreeByLevel(root, nodes, levelLimits) {
    const levelCounts = new Map(); // level -> count
    const allowedNodes = new Set();
    
    function dfs(node) {
        const level = node.level;
        
        if (level > 0) {
            const maxForLevel = levelLimits[level] ?? Infinity;
            const current = levelCounts.get(level) ?? 0;
            
            if (current >= maxForLevel) {
                // Пропускаем этот узел и всё его поддерево
                return false;
            }
            
            levelCounts.set(level, current + 1);
        }
        
        allowedNodes.add(node);
        
        const newChildren = [];
        node.children.forEach((child) => {
            if (dfs(child)) {
                newChildren.push(child);
            }
        });
        node.children = newChildren;
        
        return true;
    }
    
    dfs(root);
    
    const filteredNodes = nodes.filter((node) => allowedNodes.has(node));
    return { root, nodes: filteredNodes };
}

/**
 * Вычисляет максимальный радиус дерева (до вычисления позиций)
 * Возвращает максимальный радиус, который будет у дерева
 */
function calculateMaxTreeRadius(root, nodes, config) {
    return LayoutCalculator.calculateMaxTreeRadius(root, nodes, config);
}

// Старая реализация удалена, используем LayoutCalculator
function calculateMaxTreeRadius_OLD(root, nodes, config) {
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
    // Максимальный радиус = максимальный радиус уровня + радиус узла этого уровня
    // Также учитываем радиус корневого узла
    const maxLevelRadius = Math.max(...radii);
    // Берем максимальное значение: либо радиус самого дальнего уровня + размер узла, либо радиус корня
    const maxRadius = Math.max(maxLevelRadius + NODE_RADIUS, ROOT_RADIUS);
    // Добавляем дополнительный запас для безопасности (10% от максимального радиуса)
    return maxRadius * 1.1;
}

/**
 * Вычисляем позиции узлов по радиальному layout.
 * Параметры:
 *  - spacingFactor: множитель для желаемого расстояния между соседями на уровне (в диаметрах),
 *  - levelMarginFactor: множитель дополнительного радиального зазора между уровнями (в диаметрах).
 *  - offset: смещение центра дерева (для размещения нескольких деревьев)
 */
function calculatePositions(root, nodes, config) {
    return LayoutCalculator.calculatePositions(root, nodes, config);
}


// Создание визуализации дерева
class RadialTreeVisualization {
    constructor(containerId) {
        this.loadingScreen = new LoadingScreen();
        this.loadingScreen.updateProgress(10); // Инициализация сцены
        this.container = document.getElementById(containerId);
        
        // Используем core модули
        this.sceneManager = new SceneManager();
        this.scene = this.sceneManager.getScene();
        
        const aspect = window.innerWidth / window.innerHeight;
        this.cameraManager = new CameraManager(aspect);
        this.camera = this.cameraManager.getCamera();
        
        this.rendererManager = new RendererManager(this.container);
        this.renderer = this.rendererManager.getRenderer();
        
        this.loop = new Loop();
        this.treeGroups = []; // Массив групп деревьев
        
        // Переменные для управления камерой (Controls управляет isDragging и previousMousePosition)
        this.cameraPosition = new THREE.Vector3(0, 800, 1000); // Позиция камеры (фиксированный угол сверху)
        // Синхронизируем cameraTarget с CameraManager
        this.cameraTarget = this.cameraManager.getTarget();
        
        // Параметры layout'а (управляются слайдерами)
        this.spacingFactor = 1.4;       // множитель для расстояния по окружности (1–2 диаметров)
        this.levelMarginFactor = 0.6;   // множитель для радиального зазора между уровнями
        this.graphRotation = {          // вращение графа по осям в градусах
            x: 0,
            y: 0,
            z: 15
        };
        // Параметры светлячков
        this.fireflySize = FIREFLY_SIZE;
        this.fireflyOrbitRadius = FIREFLY_ORBIT_RADIUS;
        this.fireflyRotationSpeed = FIREFLY_ROTATION_SPEED;
        this.fireflies = [];             // Массив светлячков { mesh, nodeId, angle, speed }
        
        // Параметры для выделения узлов
        this.raycaster = new THREE.Raycaster();

        // Константы режима детального просмотра эпизодов
        this.DETAIL_MODE_SCREEN_SIZE_PERCENT = DETAIL_MODE_SCREEN_SIZE_PERCENT;
        this.DETAIL_MODE_ZOOM = DETAIL_MODE_ZOOM;
        this.DETAIL_MODE_ANIMATION_TIME = DETAIL_MODE_ANIMATION_TIME;
        this.DETAIL_MODE_ACTOR_RADIUS = DETAIL_MODE_ACTOR_RADIUS;

        // Переменные режима детального просмотра (теперь управляются через DetailModeSystem)
        // Оставляем для обратной совместимости
        this.isDetailMode = false;
        this.detailModeNode = null;
        this.mouse = new THREE.Vector2();
        this.nodeMeshes = [];            // Массив всех узлов { mesh, originalPosition, originalScale, originalMaterial, node }
        this.selectedNode = null;         // Текущий выделенный узел
        this.animationSpeed = ANIMATION_SPEED;
        
        this.maxNodesPerLevel = computeMaxNodesPerLevel(3); // Глубина 3 уровня (вызов -> задача -> технология)
        this.levelLimits = {
            1: this.maxNodesPerLevel[1] ?? 0,  // Задачи (единственный управляемый уровень)
            2: 0,  // Технологии - всегда 0 (отображаются как светлячки)
        };
        
        // Параметры зума (используем из CameraManager)
        this.initialCameraDistance = CAMERA_INITIAL_DISTANCE;
        
        // Минимальное расстояние между центрами деревьев (будет вычисляться динамически)
        this.minTreeSpacing = 0;
        
        // Сохраняем ссылки для совместимости со старым кодом
        this.cameraPosition = new THREE.Vector3(0, 800, 1000);
        this.cameraTarget = this.cameraManager.getTarget();
        this.currentZoom = this.cameraManager.getZoom();
        
        this.init();
        this.createTrees(3); // Глубина 3 уровня (вызов -> задача -> технология)
        this.setupZoomControls();
        this.setupLayoutControls();
        this.setupAnimationLoop();
    }
    
    init() {
        // Камера, рендерер и сцена уже созданы через core модули
        // Обработка изменения размера окна
        window.addEventListener('resize', () => this.onWindowResize());
        
        // Инициализация управления камерой мышью
        this.controls = new Controls(
            this.container,
            this.cameraManager,
            (event) => this.checkNodeClick(event), // Callback для проверки клика по узлу
            () => this.updateCameraPosition() // Callback для обновления позиции камеры после панорамирования
        );
        
        // Инициализация системы детального режима (ссылки на treeGroups и fireflies обновятся после createTrees)
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
                // Обновляем позицию камеры с учетом текущего зума
                this.updateCameraPosition();
            },
            onCameraPositionChange: (newPosition) => {
                this.camera.position.copy(newPosition);
            },
            onStateChange: (isActive, node) => {
                // Синхронизируем состояние с main.js
                this.isDetailMode = isActive;
                this.detailModeNode = node;
            }
        });
    }
    
    /**
     * Проверить клик по узлу (вызывается из Controls перед началом перетаскивания)
     */
    checkNodeClick(event) {
        // В режиме детального просмотра блокируем все взаимодействия мыши
        if (this.isDetailMode) {
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
                // Клик по узлу - обрабатываем клик
                const clickedMesh = intersects[0].object;
                this.handleNodeClick(clickedMesh);
                event.preventDefault();
                event.stopPropagation();
                return true; // Блокируем перетаскивание
            }
        }
        
        return false; // Не клик по узлу, можно начинать перетаскивание
    }
    
    updateCameraPosition() {
        // В режиме детального просмотра не синхронизируем с CameraManager
        // (cameraTarget управляется через DetailModeSystem)
        if (!this.isDetailMode) {
            // Синхронизируем cameraTarget с CameraManager только вне детального режима
            this.cameraTarget = this.cameraManager.getTarget();
        }
        
        // Просто обновляем позицию камеры напрямую (для совместимости со старой логикой)
        const baseDirection = new THREE.Vector3(0, 800, 1000).normalize();
        const baseDistance = Math.sqrt(800 * 800 + 1000 * 1000);
        const distance = baseDistance / this.currentZoom;
        const offset = baseDirection.clone().multiplyScalar(distance);
        
        this.camera.position.copy(this.cameraTarget).add(offset);
        this.camera.lookAt(this.cameraTarget);
        this.camera.updateProjectionMatrix();
    }
    
    /**
     * Полная очистка сцены перед пересозданием
     * Освобождает все Three.js ресурсы для предотвращения утечек памяти
     */
    disposeScene() {
        // 1. Очистка узлов (nodeMeshes содержит дополнительные данные)
        this.nodeMeshes.forEach(nodeData => {
            // Текстовый спрайт
            if (nodeData.textSprite) {
                if (nodeData.textSprite.material) {
                    if (nodeData.textSprite.material.map) {
                        nodeData.textSprite.material.map.dispose();
                    }
                    nodeData.textSprite.material.dispose();
                }
            }
            
            // Основной меш
            if (nodeData.mesh) {
                if (nodeData.mesh.geometry) nodeData.mesh.geometry.dispose();
                
                // Dispose материалов и их текстур
                if (nodeData.mesh.material) {
                    if (Array.isArray(nodeData.mesh.material)) {
                        nodeData.mesh.material.forEach(m => {
                            if (m.map) m.map.dispose();
                            m.dispose();
                        });
                    } else {
                        if (nodeData.mesh.material.map) {
                            nodeData.mesh.material.map.dispose();
                        }
                        nodeData.mesh.material.dispose();
                    }
                }
                
                // Dispose детей (edges)
                nodeData.mesh.children.forEach(child => {
                    if (child.geometry) child.geometry.dispose();
                    if (child.material) child.material.dispose();
                });
            }
            
            // Оригинальные материалы (если есть)
            if (nodeData.originalMaterial) {
                nodeData.originalMaterial.dispose();
            }
            if (nodeData.highlightMaterial) {
                nodeData.highlightMaterial.dispose();
            }
        });
        
        // 2. Очистка деревьев
        this.treeGroups.forEach(treeGroup => {
            treeGroup.traverse(child => {
                if (child.geometry) child.geometry.dispose();
                if (child.material) {
                    if (Array.isArray(child.material)) {
                        child.material.forEach(m => {
                            if (m.map) m.map.dispose();
                            m.dispose();
                        });
                    } else {
                        if (child.material.map) child.material.map.dispose();
                        child.material.dispose();
                    }
                }
            });
            this.scene.remove(treeGroup);
        });
        
        // 3. Очистка светлячков
        // ВАЖНО: НЕ dispose текстуры светлячков - они кэшированы!
        this.fireflies.forEach(firefly => {
            firefly.mesh.traverse(child => {
                if (child.geometry) child.geometry.dispose();
                if (child.material) {
                    // Dispose материала, но НЕ текстуры (она в кэше)
                    child.material.dispose();
                }
            });
            this.scene.remove(firefly.mesh);
        });
        
        // 4. Очистка массивов
        this.nodeMeshes = [];
        this.treeGroups = [];
        this.fireflies = [];
        
        // 5. Обновляем ссылки в DetailModeSystem
        if (this.detailModeSystem) {
            this.detailModeSystem.treeGroups = this.treeGroups;
            this.detailModeSystem.fireflies = this.fireflies;
        }
    }
    
    createTrees(depth) {
        // Вызываем полную очистку перед созданием новых деревьев
        this.disposeScene();
        
        // Сбрасываем кэш при пересоздании деревьев
        cachedTrees = null;
        cachedDepth = null;

        // Создаем кэш детей для быстрой фильтрации
        const childrenCache = new Map();
        mockData.forEach(item => {
            if (!childrenCache.has(item.parentId)) {
                childrenCache.set(item.parentId, []);
            }
            childrenCache.get(item.parentId).push(item);
        });

        // Строим все деревья из данных (тяжелая операция)
        const trees = buildTreesFromData(mockData, depth, childrenCache);
        
        // Вычисляем радиусы для каждого дерева с учётом текущих параметров
        const treeData = trees.map(({ root, nodes }) => {
        const { root: filteredRoot, nodes: filteredNodes } = filterTreeByLevel(
            root,
            nodes,
            this.levelLimits
        );
            const radius = calculateMaxTreeRadius(filteredRoot, filteredNodes, {
                spacingFactor: this.spacingFactor,
                levelMarginFactor: this.levelMarginFactor,
            });
            return { root: filteredRoot, nodes: filteredNodes, radius };
        });
        
        // Располагаем деревья в виде решетки (сетки)
        // Вычисляем оптимальное количество колонок (ближайший квадратный корень)
        const gridCols = Math.ceil(Math.sqrt(treeData.length));
        const gridRows = Math.ceil(treeData.length / gridCols);
        const gap = ROOT_RADIUS; // Расстояние между краями деревьев
        
        // Вычисляем максимальные размеры для каждой колонки и строки
        const colWidths = new Array(gridCols).fill(0);
        const rowHeights = new Array(gridRows).fill(0);
        
        treeData.forEach(({ radius }, index) => {
            const row = Math.floor(index / gridCols);
            const col = index % gridCols;
            const diameter = radius * 2;
            
            colWidths[col] = Math.max(colWidths[col], diameter);
            rowHeights[row] = Math.max(rowHeights[row], diameter);
        });
        
        // Вычисляем позиции деревьев в сетке
        const positions = [];
        
        for (let row = 0; row < gridRows; row++) {
            for (let col = 0; col < gridCols; col++) {
                const index = row * gridCols + col;
                if (index < treeData.length) {
                    // Вычисляем X: сумма ширин предыдущих колонок + зазоры + половина текущей ячейки
                    let x = 0;
                    for (let c = 0; c < col; c++) {
                        x += colWidths[c] + gap;
                    }
                    x += colWidths[col] / 2;
                    
                    // Вычисляем Z: сумма высот предыдущих строк + зазоры + половина текущей ячейки
                    let z = 0;
                    for (let r = 0; r < row; r++) {
                        z += rowHeights[r] + gap;
                    }
                    z += rowHeights[row] / 2;
                    
                    positions.push(new THREE.Vector3(x, 0, z));
                }
            }
        }
        
        // Центрируем всю решетку относительно начала координат
        const totalWidth = colWidths.reduce((sum, w) => sum + w, 0) + gap * (gridCols - 1);
        const totalHeight = rowHeights.reduce((sum, h) => sum + h, 0) + gap * (gridRows - 1);
        const offsetX = -totalWidth / 2;
        const offsetZ = -totalHeight / 2;
        
        positions.forEach(pos => {
            pos.x += offsetX;
            pos.z += offsetZ;
        });
        
        // Все корневые узлы (вызовы) имеют одинаковый золотистый цвет
        
        treeData.forEach(({ root: filteredRoot, nodes: filteredNodes }, treeIndex) => {
            // Вычисляем позиции с учётом смещения для этого дерева
            const offset = positions[treeIndex] || new THREE.Vector3(0, 0, 0);
        calculatePositions(filteredRoot, filteredNodes, {
            spacingFactor: this.spacingFactor,
            levelMarginFactor: this.levelMarginFactor,
                offset: offset,
        });
        
        // Создаем группу для дерева
            const treeGroup = new THREE.Group();
        
        // Создаем линии (связи)
        filteredNodes.forEach(node => {
            if (node.parent !== null) {
                const geometry = new THREE.BufferGeometry().setFromPoints([
                    node.parent.position,
                    node.position
                ]);
                
                const material = new THREE.LineBasicMaterial({
                    color: DEFAULT_NODE_COLOR,
                    opacity: 0.5,
                    transparent: true
                });
                
                const line = new THREE.Line(geometry, material);
                    treeGroup.add(line);
            }
        });
        
            // Подсчитываем общее количество светлячков для отладки
            const level1Nodes = filteredNodes.filter(node => node.level === 1);
            const totalFirefliesForTree = level1Nodes.reduce((sum, node) =>
                sum + Math.min((childrenCache.get(node.id) || []).length, 20), 0);
        
        // Создаем сферы (вершины) - базовая сцена без светлячков
        filteredNodes.forEach(node => {
                const isRoot = node.level === 0;
                const radius = getNodeRadius(node, isRoot);
            
            const geometry = new THREE.SphereGeometry(radius, SPHERE_SEGMENTS, SPHERE_RINGS);
            
            let material;
            if (isRoot) {
                // Корневые узлы (вызовы) - одинаковый золотистый цвет для всех
                material = new THREE.MeshStandardMaterial({
                    color: ROOT_NODE_COLOR,
                    emissive: ROOT_NODE_COLOR,
                    emissiveIntensity: 0.5,
                    metalness: 0.3,
                    roughness: 0.2
                });
            } else {
                    // Обычные узлы - цвет зависит от уровня
                    const levelColors = [
                        LEVEL_1_COLOR, // Синий для уровня 1 (сезоны)
                        LEVEL_2_COLOR, // Фиолетовый для уровня 2 (режиссеры)
                        LEVEL_3_COLOR, // Бирюзовый для уровня 3 (серии)
                    ];
                    const levelColor = levelColors[node.level - 1] || DEFAULT_NODE_COLOR;
                material = new THREE.MeshStandardMaterial({
                        color: levelColor,
                    metalness: 0.5,
                    roughness: 0.5
                });
            }
            
            const sphere = new THREE.Mesh(geometry, material);
            sphere.position.copy(node.position);
                treeGroup.add(sphere);
            
            // Сохраняем ссылку на узел в mesh для raycasting
            sphere.userData.node = node;
            sphere.userData.isRoot = isRoot;
            sphere.userData.originalPosition = node.position.clone();
            sphere.userData.originalScale = new THREE.Vector3(1, 1, 1);
            sphere.userData.originalMaterial = material.clone();
            sphere.userData.treeGroup = treeGroup;
            sphere.userData.nodeId = node.id;
            sphere.userData.nodeText = node.text;
            
            // Добавляем обводку (Edges)
            const edges = new THREE.EdgesGeometry(geometry);
            const edgeMaterial = new THREE.LineBasicMaterial({
                    color: NODE_MATERIAL_COLOR,
                opacity: 0.3,
                transparent: true
            });
            const edgeLines = new THREE.LineSegments(edges, edgeMaterial);
            sphere.add(edgeLines);
            
            // Переменная для хранения спрайта текста
            let textSprite = null;
            
            // Добавляем текст на узле для всех уровней
            if (node.text) {
                const canvas = document.createElement('canvas');
                const context = canvas.getContext('2d');
                    // Размер шрифта зависит от уровня: корень - самый большой, дальше уменьшается (увеличен в 3 раза)
                    const fontSize = isRoot ? 84 : node.level === 1 ? 54 : node.level === 2 ? 42 : node.level === 3 ? 36 : 30;
                context.font = `bold ${fontSize}px Arial`;
                
                // Измеряем текст
                const metrics = context.measureText(node.text);
                const textWidth = metrics.width;
                const textHeight = fontSize;
                
                // Увеличиваем разрешение canvas для четкости при масштабировании
                canvas.width = (textWidth + TEXT_PADDING) * TEXT_SCALE_FACTOR;
                canvas.height = (textHeight + TEXT_PADDING) * TEXT_SCALE_FACTOR;

                // Масштабируем контекст
                context.scale(TEXT_SCALE_FACTOR, TEXT_SCALE_FACTOR);
                
                // Перерисовываем текст
                context.fillStyle = TEXT_COLOR;
                context.strokeStyle = TEXT_STROKE_COLOR;
                context.lineWidth = TEXT_STROKE_WIDTH;
                context.font = `bold ${fontSize}px Arial`;
                context.textAlign = 'center';
                context.textBaseline = 'middle';
                
                // Рисуем текст с обводкой (координаты без учета масштаба контекста)
                context.strokeText(node.text, (textWidth + TEXT_PADDING) / 2, (textHeight + TEXT_PADDING) / 2);
                context.fillText(node.text, (textWidth + TEXT_PADDING) / 2, (textHeight + TEXT_PADDING) / 2);
                
                // Создаем текстуру из canvas
                const texture = new THREE.CanvasTexture(canvas);
                texture.needsUpdate = true;
                
                // Создаем спрайт с текстом
                const spriteMaterial = new THREE.SpriteMaterial({
                    map: texture,
                    transparent: true,
                    alphaTest: 0.1
                });
                const sprite = new THREE.Sprite(spriteMaterial);
                
                // Позиционируем текст над сферой
                sprite.position.copy(node.position);
                    sprite.position.y += radius + 90; // Увеличено в 3 раза (30 * 3)
                    sprite.scale.set((canvas.width / TEXT_SCALE_FACTOR) * 1.5, (canvas.height / TEXT_SCALE_FACTOR) * 1.5, 1); // Увеличено в 3 раза (0.5 * 3), скорректировано с учетом высокого разрешения
                    sprite.renderOrder = 1; // Текст всегда поверх сфер

                    treeGroup.add(sprite);
                    textSprite = sprite; // Сохраняем ссылку на спрайт
                }
            
            // Сохраняем в массив всех узлов
            this.nodeMeshes.push({
                mesh: sphere,
                originalPosition: node.position.clone(),
                originalScale: new THREE.Vector3(1, 1, 1),
                originalMaterial: material.clone(),
                originalSpriteScale: textSprite ? textSprite.scale.clone() : null,
                node: node,
                treeGroup: treeGroup,
                textSprite: textSprite // Сохраняем ссылку на спрайт текста
            });
            
                
                // Создаем светлячков для узлов уровня 1 (задач)
                // Уровни: 0=вызовы (root), 1=задачи, 2=технологии
                // Светлячки создаются для задач (level 1), представляя их технологии (level 2)
                if (node.level === 1) {
                    // Находим все технологии (дети уровня 2) для этой задачи
                    const technologies = childrenCache.get(node.id) || [];
                    const technologyCount = technologies.length;
                    
                    // Создаем светлячков только если есть технологии (ограничение для производительности)
                    const maxFirefliesPerTask = 20; // Максимум 20 светлячков на задачу
                    const actualFireflyCount = Math.min(technologyCount, maxFirefliesPerTask);

                    if (actualFireflyCount > 0) {
                        for (let i = 0; i < actualFireflyCount; i++) {
                            // Случайный начальный угол (не равномерное распределение)
                            const baseAngle = (i / technologyCount) * Math.PI * 2;
                            const randomOffset = (Math.random() - 0.5) * 0.5; // Случайное смещение до ±0.25 радиан
                            const angle = baseAngle + randomOffset;
                            
                            // Случайная скорость (от 0.5 до 1.5 от базовой скорости)
                            const speedMultiplier = 0.5 + Math.random(); // 0.5 - 1.5
                            const randomSpeed = this.fireflyRotationSpeed * speedMultiplier;
                            
                            // Случайное направление (по часовой или против часовой стрелки)
                            const direction = Math.random() > 0.5 ? 1 : -1;
                            
                            // Создаем светлячка
                            const firefly = this.createFirefly(new THREE.Vector3(0, 0, 0), angle);
                            const orbitX = Math.cos(angle) * this.fireflyOrbitRadius;
                            const orbitZ = Math.sin(angle) * this.fireflyOrbitRadius;
                            firefly.position.set(
                                node.position.x + orbitX,
                                node.position.y,
                                node.position.z + orbitZ
                            );
                            
                            // Сохраняем информацию о технологии для светлячка
                            firefly.userData.technology = technologies[i];
                            
                            this.fireflies.push({
                                mesh: firefly, // firefly теперь группа
                                nodeId: node.id,
                                nodePosition: node.position.clone(), // Мировая позиция узла
                                angle: angle,
                                speed: randomSpeed * direction // Случайная скорость с направлением
                            });
                            // Добавляем светлячка в treeGroup, чтобы он вращался вместе с графом
                            treeGroup.add(firefly);
                        }
                    }
                }
            });
            
            // Применяем вращение графа по всем осям
            treeGroup.rotation.x = (this.graphRotation.x * Math.PI) / 180;
            treeGroup.rotation.y = (this.graphRotation.y * Math.PI) / 180;
            treeGroup.rotation.z = (this.graphRotation.z * Math.PI) / 180;
            
            this.sceneManager.add(treeGroup);
            this.treeGroups.push(treeGroup);
        });

            this.loadingScreen.updateProgress(80); // Деревья созданы

        // Отложенное создание светлячков для производительности
        setTimeout(() => {
            this.createFirefliesForTrees(trees, childrenCache);
            this.loadingScreen.updateProgress(100); // Светлячки созданы
        }, 100);

    }

    // Отдельный метод для создания светлячков
    createFirefliesForTrees(trees, childrenCache) {
        trees.forEach(({ root, nodes }) => {
            const filteredNodes = nodes.filter(node => node.level !== 2); // Исключаем уровень 2

        });
    }
    
    setupZoomControls() {
        const zoomInBtn = document.getElementById('zoom-in');
        const zoomOutBtn = document.getElementById('zoom-out');
        const zoomResetBtn = document.getElementById('zoom-reset');
        
        zoomInBtn.addEventListener('click', () => {
            if (!this.isDetailMode) this.zoomIn();
        });
        zoomOutBtn.addEventListener('click', () => {
            if (!this.isDetailMode) this.zoomOut();
        });
        zoomResetBtn.addEventListener('click', () => {
            if (!this.isDetailMode) this.resetZoom();
        });
        
        // Колесико мыши для зума
        this.container.addEventListener('wheel', (event) => {
            // В режиме детального просмотра блокируем зум
            if (this.isDetailMode) {
                return;
            }

            event.preventDefault();
            if (event.deltaY < 0) {
                this.zoomIn();
            } else {
                this.zoomOut();
            }
        });
    }
    
    zoomIn() {
        // В режиме детального просмотра зум заблокирован
        if (this.isDetailMode) return;
        
        this.cameraManager.zoomIn();
        this.currentZoom = this.cameraManager.getZoom();
        this.updateCameraZoom();
    }
    
    zoomOut() {
        // В режиме детального просмотра зум заблокирован
        if (this.isDetailMode) return;
        
        this.cameraManager.zoomOut();
        this.currentZoom = this.cameraManager.getZoom();
        this.updateCameraZoom();
    }
    
    resetZoom() {
        // В режиме детального просмотра зум заблокирован
        if (this.isDetailMode) return;
        
        this.cameraManager.resetZoom();
        this.currentZoom = this.cameraManager.getZoom();
        this.updateCameraZoom();
    }
    
    updateCameraZoom() {
        // В режиме детального просмотра зум управляется через DetailModeSystem
        if (this.isDetailMode) {
            // Просто обновляем позицию камеры с текущим зумом
            this.updateCameraPosition();
            return;
        }
        
        // Если есть выделенный узел, нужно обновить его целевую позицию камеры с учетом зума
        // И СРАЗУ применить новую позицию, чтобы избежать конфликта с анимацией
        if (this.selectedNode) {
            const nodeData = this.selectedNode;
            
            // Получаем текущую мировую позицию узла
            const worldPosition = new THREE.Vector3();
            nodeData.mesh.getWorldPosition(worldPosition);
            
            // Вычисляем целевую позицию камеры с учетом зума
            // Используем тот же эффективный зум, что был при выборе узла
            const baseDirection = new THREE.Vector3(0, 800, 1000).normalize();
            const baseDistance = Math.sqrt(800 * 800 + 1000 * 1000);
            
            // Используем эффективный зум узла, но обновляем его с учетом текущего зума
            const zoomForNodeSelection = 2.0; // Тот же множитель, что при выборе
            const effectiveZoom = this.currentZoom * zoomForNodeSelection;
            const distance = baseDistance / effectiveZoom;
            
            // Обновляем целевую позицию камеры для выделенного узла
            nodeData.targetCameraPosition = worldPosition.clone().add(
                baseDirection.clone().multiplyScalar(distance)
            );
            nodeData.targetCameraTarget = worldPosition.clone();
            nodeData.effectiveZoom = effectiveZoom;
            
            // ВАЖНО: Сразу применяем новую позицию камеры, чтобы зум работал мгновенно
            // А не ждал анимации lerp
            this.cameraTarget.copy(nodeData.targetCameraTarget);
            this.updateCameraPosition();
            
            // Отмечаем, что позиция камеры уже применена, чтобы анимация не конфликтовала
            nodeData.cameraPositionApplied = true;
            
        } else {
            // Если узла нет, просто обновляем позицию камеры
            this.updateCameraPosition();
        }
    }
    
    setupLayoutControls() {
        // Логика сворачивания/разворачивания панели настроек
        const layoutControls = document.querySelector('.layout-controls');
        const layoutToggle = document.querySelector('.layout-toggle');
        
        if (layoutToggle && layoutControls) {
            // На мобильных сворачиваем панель по умолчанию
            const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
            if (isMobile) {
                layoutControls.classList.add('collapsed');
                layoutToggle.textContent = '+';
            }
            
            layoutToggle.addEventListener('click', (e) => {
                e.stopPropagation();
                layoutControls.classList.toggle('collapsed');
                layoutToggle.textContent = layoutControls.classList.contains('collapsed') ? '+' : '−';
            });
            
            // Клик по всей панели в свернутом состоянии разворачивает её
            layoutControls.addEventListener('click', () => {
                if (layoutControls.classList.contains('collapsed')) {
                    layoutControls.classList.remove('collapsed');
                    layoutToggle.textContent = '−';
                }
            });
        }
        
        const spacingSlider = document.getElementById('spacing-factor');
        const spacingValue = document.getElementById('spacing-value');
        const marginSlider = document.getElementById('level-margin-factor');
        const marginValue = document.getElementById('level-margin-value');
        const level1Slider = document.getElementById('level1-count');
        const level1Value = document.getElementById('level1-value');
        
        if (spacingSlider && spacingValue) {
            spacingSlider.addEventListener('input', debounce((event) => {
                const value = parseFloat(event.target.value);
                this.spacingFactor = value;
                spacingValue.textContent = value.toFixed(1);
                this.createTrees(3);
            }, 300)); // 300ms задержка
        }

        if (marginSlider && marginValue) {
            marginSlider.addEventListener('input', debounce((event) => {
                const value = parseFloat(event.target.value);
                this.levelMarginFactor = value;
                marginValue.textContent = value.toFixed(1);
                this.createTrees(3);
            }, 300)); // 300ms задержка
        }

        // Инициализация и обработчики для количества узлов по уровням
        if (this.maxNodesPerLevel) {
            // Уровень 1 (задачи) - единственный управляемый уровень
            if (level1Slider && level1Value) {
                const max1 = this.maxNodesPerLevel[1] ?? 0;
                level1Slider.max = String(max1);
                level1Slider.value = String(this.levelLimits[1] ?? max1);
                level1Value.textContent = String(this.levelLimits[1] ?? max1);
                level1Slider.addEventListener('input', (event) => {
                    const value = parseInt(event.target.value, 10);
                    this.levelLimits[1] = value;
                    level1Value.textContent = String(value);
                    this.createTrees(3);
                });
            }
            // Уровень 0 (вызовы) всегда показывается полностью
            // Уровень 2 (технологии) всегда равен 0 - не имеет слайдера
        
            // Слайдеры для вращения графа по осям
            const graphRotationXSlider = document.getElementById('graph-rotation-x');
            const graphRotationXValue = document.getElementById('graph-rotation-x-value');
            if (graphRotationXSlider && graphRotationXValue) {
                graphRotationXSlider.value = String(this.graphRotation.x);
                graphRotationXValue.textContent = String(this.graphRotation.x);
                graphRotationXSlider.addEventListener('input', (event) => {
                    const value = parseInt(event.target.value, 10);
                    this.graphRotation.x = value;
                    graphRotationXValue.textContent = String(value);
                    // Обновляем вращение всех существующих деревьев без пересоздания
                    this.treeGroups.forEach(treeGroup => {
                        treeGroup.rotation.x = (value * Math.PI) / 180;
                    });
                });
            }
            
            const graphRotationYSlider = document.getElementById('graph-rotation-y');
            const graphRotationYValue = document.getElementById('graph-rotation-y-value');
            if (graphRotationYSlider && graphRotationYValue) {
                graphRotationYSlider.value = String(this.graphRotation.y);
                graphRotationYValue.textContent = String(this.graphRotation.y);
                graphRotationYSlider.addEventListener('input', (event) => {
                    const value = parseInt(event.target.value, 10);
                    this.graphRotation.y = value;
                    graphRotationYValue.textContent = String(value);
                    // Обновляем вращение всех существующих деревьев без пересоздания
                    this.treeGroups.forEach(treeGroup => {
                        treeGroup.rotation.y = (value * Math.PI) / 180;
                    });
                });
            }
            
            const graphRotationZSlider = document.getElementById('graph-rotation-z');
            const graphRotationZValue = document.getElementById('graph-rotation-z-value');
            if (graphRotationZSlider && graphRotationZValue) {
                graphRotationZSlider.value = String(this.graphRotation.z);
                graphRotationZValue.textContent = String(this.graphRotation.z);
                graphRotationZSlider.addEventListener('input', (event) => {
                    const value = parseInt(event.target.value, 10);
                    this.graphRotation.z = value;
                    graphRotationZValue.textContent = String(value);
                    // Обновляем вращение всех существующих деревьев без пересоздания
                    this.treeGroups.forEach(treeGroup => {
                        treeGroup.rotation.z = (value * Math.PI) / 180;
                    });
                });
            }
            
            // Слайдеры для светлячков
            const fireflySizeSlider = document.getElementById('firefly-size');
            const fireflySizeValue = document.getElementById('firefly-size-value');
            if (fireflySizeSlider && fireflySizeValue) {
                fireflySizeSlider.value = String(this.fireflySize);
                fireflySizeValue.textContent = String(this.fireflySize);
                fireflySizeSlider.addEventListener('input', (event) => {
                    const value = parseInt(event.target.value, 10);
                    this.fireflySize = value;
                    fireflySizeValue.textContent = String(value);
                    // Обновляем размер всех светлячков (теперь это группы)
                    this.fireflies.forEach(firefly => {
                        // Обновляем размеры всех слоев в группе
                        firefly.mesh.children.forEach((child, index) => {
                            if (index === 0) {
                                // Ядро - обновляем геометрию
                                if (child.geometry) {
                                    child.geometry.dispose();
                                    child.geometry = new THREE.SphereGeometry(value * FIREFLY_CORE_SIZE_MULTIPLIER, SPHERE_SEGMENTS, SPHERE_RINGS);
                                }
                            } else if (child instanceof THREE.Sprite) {
                                // Спрайты свечения - обновляем масштаб
                                if (index === 1) {
                                    child.scale.set(value * 4, value * 4, 1);
                                } else if (index === 2) {
                                    child.scale.set(value * 6, value * 6, 1);
                                }
                            }
                        });
                    });
                });
            }
            
            const fireflyRadiusSlider = document.getElementById('firefly-radius');
            const fireflyRadiusValue = document.getElementById('firefly-radius-value');
            if (fireflyRadiusSlider && fireflyRadiusValue) {
                fireflyRadiusSlider.value = String(this.fireflyOrbitRadius);
                fireflyRadiusValue.textContent = String(this.fireflyOrbitRadius);
                fireflyRadiusSlider.addEventListener('input', (event) => {
                    const value = parseInt(event.target.value, 10);
                    this.fireflyOrbitRadius = value;
                    fireflyRadiusValue.textContent = String(value);
                });
            }
            
            const fireflySpeedSlider = document.getElementById('firefly-speed');
            const fireflySpeedValue = document.getElementById('firefly-speed-value');
            if (fireflySpeedSlider && fireflySpeedValue) {
                fireflySpeedSlider.value = String(this.fireflyRotationSpeed);
                fireflySpeedValue.textContent = String(this.fireflyRotationSpeed);
                fireflySpeedSlider.addEventListener('input', (event) => {
                    const value = parseFloat(event.target.value);
                    this.fireflyRotationSpeed = value;
                    fireflySpeedValue.textContent = String(value);
                    // Обновляем скорость всех светлячков
                    this.fireflies.forEach(firefly => {
                        firefly.speed = value;
                    });
                });
            }
            
            // Слайдер для размера узла в режиме детального просмотра
            const detailModeSizeSlider = document.getElementById('detail-mode-size');
            const detailModeSizeValue = document.getElementById('detail-mode-size-value');
            if (detailModeSizeSlider && detailModeSizeValue) {
                detailModeSizeSlider.value = String(this.DETAIL_MODE_SCREEN_SIZE_PERCENT);
                detailModeSizeValue.textContent = String(this.DETAIL_MODE_SCREEN_SIZE_PERCENT);
                detailModeSizeSlider.addEventListener('input', (event) => {
                    const value = parseInt(event.target.value, 10);
                    this.DETAIL_MODE_SCREEN_SIZE_PERCENT = value;
                    detailModeSizeValue.textContent = String(value);
                    // Если мы в режиме детального просмотра, обновляем размер узла
                    if (this.isDetailMode && this.detailModeNode) {
                        this.detailModeSystem.setScreenSizePercent(value);
                    }
                });
            }
        }
    }
    
    onWindowResize() {
        const width = window.innerWidth;
        const height = window.innerHeight;
        
        this.cameraManager.updateAspect(width / height);
        this.rendererManager.resize(width, height);
    }
    
    createFirefly(centerPosition, initialAngle) {
        const firefly = new Firefly(centerPosition, initialAngle, this.fireflySize);
        firefly.setOrbitRadius(this.fireflyOrbitRadius);
        firefly.setSpeed(this.fireflyRotationSpeed);
        return firefly.mesh;
    }
    
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
    
    selectNode(nodeData) {
        // Для узлов уровня 1 (задачи) - вход в режим детального просмотра
        if (nodeData.node.level === 1) {
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
    }
    
    pushAwayNeighborNodes(selectedNodeData) {
        // Получаем радиус увеличенного узла
        const selectedRadius = selectedNodeData.node.level === 0 ? ROOT_RADIUS : NODE_RADIUS;
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
            const otherRadius = otherNodeData.node.level === 0 ? ROOT_RADIUS : NODE_RADIUS;
            
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
            } else {
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

    // Вход в режим детального просмотра эпизода
    enterDetailMode(nodeData) {
        // Сохраняем исходную позицию камеры для восстановления
        if (!this.originalCameraPosition) {
            this.originalCameraPosition = this.camera.position.clone();
            this.originalCameraTarget = this.cameraTarget.clone();
        }
        
        // Используем DetailModeSystem
        this.detailModeSystem.enter(
            nodeData,
            this.currentZoom,
            this.originalCameraPosition,
            this.originalCameraTarget
        );
        
        // Обновляем флаги для обратной совместимости
        this.isDetailMode = this.detailModeSystem.isActive();
        this.detailModeNode = this.detailModeSystem.getCurrentNode();
    }

    // Создание оверлея затемнения для режима детального просмотра
    createDetailModeOverlay() {
        // Создаем геометрию плоскости, покрывающей весь экран (очень большую)
        const geometry = new THREE.PlaneGeometry(50000, 50000);

        // Создаем материал с радиальным градиентом (от центра к краям)
        const texture = TextureGenerator.createRadialGradientTexture(1024, 1024);

        const material = new THREE.MeshBasicMaterial({
            map: texture,
            transparent: true,
            opacity: 0, // Начинаем с прозрачности 0 для анимации
            depthWrite: false,
            side: THREE.DoubleSide // Рендерим с обеих сторон
        });

        const overlay = new THREE.Mesh(geometry, material);
        overlay.position.set(0, 0, -200); // Еще дальше позади
        overlay.renderOrder = -2; // Рендерится самым первым

        this.scene.add(overlay);
        this.detailModeOverlay = overlay;
    }

    // Создание кнопки выхода из режима детального просмотра
    createDetailModeExitButton() {
        // Создаем HTML кнопку в правом верхнем углу
        const button = document.createElement('button');
        button.textContent = '×';
        button.className = 'zoom-btn detail-exit-btn'; // Используем стиль zoom-btn
        button.style.position = 'absolute';
        button.style.top = '20px';
        button.style.right = '20px';
        button.style.zIndex = '1000';
        button.style.opacity = '0'; // Начинаем с прозрачности 0 для анимации
        button.style.transition = 'opacity 0.3s ease-in-out';

        // Обработчик клика
        button.addEventListener('click', () => {
            this.exitDetailMode();
        });

        // Добавляем в DOM
        document.body.appendChild(button);
        this.detailModeExitButton = button;

        // Анимируем появление
        setTimeout(() => {
            button.style.opacity = '1';
        }, 100);
    }

    // Анимация входа в режим детального просмотра
    animateDetailModeEnter() {
        const startTime = Date.now();
        const duration = this.DETAIL_MODE_ANIMATION_TIME * 1000; // в миллисекундах
        const nodeData = this.detailModeNode; // Получаем nodeData из this

        const animate = () => {
            const elapsed = Date.now() - startTime;
            const progress = Math.min(elapsed / duration, 1);
            const easedProgress = this.easeInOut(progress);

            // Скрываем все деревья, КРОМЕ выбранного узла и его текста
            const selectedMesh = nodeData.mesh;
            const selectedTextSprite = nodeData.textSprite;
            
            
            // Сначала скрываем все объекты
            const selectedNodeId = nodeData.node.id;
            this.treeGroups.forEach(treeGroup => {
                treeGroup.traverse((object) => {
                    // Исключаем выбранный узел, его текст и все дочерние элементы из скрытия
                    if (object === selectedMesh || object === selectedTextSprite) {
                        return; // Пропускаем выбранный узел
                    }
                    
                    // Проверяем, является ли объект светлячком выбранного узла
                    const isSelectedFirefly = this.fireflies.some(firefly => 
                        firefly.mesh === object && firefly.nodeId === selectedNodeId
                    );
                    if (isSelectedFirefly) {
                        return; // Пропускаем светлячки выбранного узла
                    }
                    
                    // Проверяем, является ли объект дочерним элементом светлячка выбранного узла
                    let isChildOfSelectedFirefly = false;
                    let parentForFirefly = object.parent;
                    while (parentForFirefly) {
                        const isParentFirefly = this.fireflies.some(firefly => 
                            firefly.mesh === parentForFirefly && firefly.nodeId === selectedNodeId
                        );
                        if (isParentFirefly) {
                            isChildOfSelectedFirefly = true;
                            break;
                        }
                        parentForFirefly = parentForFirefly.parent;
                    }
                    
                    if (isChildOfSelectedFirefly) {
                        return; // Пропускаем дочерние элементы светлячков выбранного узла
                    }
                    
                    // Проверяем, является ли объект дочерним элементом выбранного узла (например, edgeLines)
                    let isChildOfSelected = false;
                    let parent = object.parent;
                    while (parent) {
                        if (parent === selectedMesh) {
                            isChildOfSelected = true;
                            break;
                        }
                        parent = parent.parent;
                    }
                    
                    if (isChildOfSelected) {
                        return; // Пропускаем дочерние элементы выбранного узла
                    }
                    
                    // Скрываем все остальные объекты через visible И opacity
                    // Полностью скрываем только когда анимация почти завершена
                    object.visible = easedProgress < 0.95; // Скрываем когда opacity уже очень низкий
                    
                    if (object.material) {
                        if (Array.isArray(object.material)) {
                            object.material.forEach(mat => {
                                mat.opacity = 1 - easedProgress;
                                mat.transparent = true;
                            });
                        } else {
                            object.material.opacity = 1 - easedProgress;
                            object.material.transparent = true;
                        }
                    }
                });
            });
            
            // ВАЖНО: После traverse() явно устанавливаем видимость выбранного узла
            // Это гарантирует, что он останется видимым, даже если traverse() его обработал
            selectedMesh.visible = true;
            if (selectedTextSprite) {
                selectedTextSprite.visible = true;
            }
            
            // Убеждаемся, что все дочерние элементы выбранного узла (например, edgeLines) остаются видимыми
            selectedMesh.traverse((child) => {
                if (child !== selectedMesh) {
                    child.visible = true;
                    if (child.material) {
                        if (Array.isArray(child.material)) {
                            child.material.forEach(mat => {
                                mat.opacity = 1;
                                mat.transparent = false;
                            });
                        } else {
                            child.material.opacity = 1;
                            child.material.transparent = false;
                        }
                    }
                }
            });
            
            // Убеждаемся, что светлячки выбранного узла остаются видимыми
            let fireflyVisibilitySetCount = 0;
            this.fireflies.forEach((firefly, index) => {
                if (firefly.mesh && firefly.nodeId === selectedNodeId) {
                    firefly.mesh.visible = true;
                    fireflyVisibilitySetCount++;
                    // Убеждаемся, что материал светлячка видим
                    firefly.mesh.traverse((child) => {
                        if (child.material) {
                            if (Array.isArray(child.material)) {
                                child.material.forEach(mat => {
                                    mat.opacity = 1;
                                    mat.transparent = false;
                                });
                            } else {
                                child.material.opacity = 1;
                                child.material.transparent = false;
                            }
                        }
                    });
                }
            });
            
            // КРИТИЧЕСКИ ВАЖНО: Убеждаемся, что родительская группа выбранного узла видима
            // Если родитель скрыт, дочерние объекты тоже не видны!
            if (selectedMesh.parent) {
                selectedMesh.parent.visible = true;
                // Рекурсивно проверяем всех родителей до корня
                let parent = selectedMesh.parent;
                while (parent && parent !== this.scene) {
                    parent.visible = true;
                    parent = parent.parent;
                }
            }
            
            if (selectedTextSprite && selectedTextSprite.parent) {
                selectedTextSprite.parent.visible = true;
                // Рекурсивно проверяем всех родителей до корня
                let parent = selectedTextSprite.parent;
                while (parent && parent !== this.scene) {
                    parent.visible = true;
                    parent = parent.parent;
                }
            }
            
            // Также убеждаемся, что материалы выбранного узла правильные
            if (selectedMesh.material) {
                if (Array.isArray(selectedMesh.material)) {
                    selectedMesh.material.forEach(mat => {
                        mat.opacity = 1;
                        mat.transparent = false;
                    });
                } else {
                    selectedMesh.material.opacity = 1;
                    selectedMesh.material.transparent = false;
                }
            }
            
            if (selectedTextSprite && selectedTextSprite.material) {
                selectedTextSprite.material.opacity = 1;
                selectedTextSprite.material.transparent = false;
            }
            
            // Удаляем только светлячки, которые НЕ принадлежат выбранному узлу
            // Светлячки выбранного узла остаются видимыми и продолжают крутиться
            if (progress === 0) {
                const selectedNodeId = nodeData.node.id;
                this.fireflies.forEach((firefly) => {
                    if (firefly.mesh && firefly.mesh.parent) {
                        // Удаляем только светлячки других узлов
                        if (firefly.nodeId !== selectedNodeId) {
                            firefly.mesh.parent.remove(firefly.mesh);
                        } else {
                            // Светлячки выбранного узла остаются видимыми
                            firefly.mesh.visible = true;
                        }
                    }
                });
            }

            // Увеличиваем и центрируем выбранный узел
            // Вычисляем масштаб на основе процента ширины экрана
            const targetScaleValue = this.calculateDetailModeScale(nodeData);
            const baseScale = nodeData.originalScale || new THREE.Vector3(1, 1, 1);
            const targetScale = baseScale.clone().multiplyScalar(targetScaleValue);
            const currentScale = baseScale.clone().lerp(targetScale, easedProgress);
            nodeData.mesh.scale.copy(currentScale);


            // Масштабируем текст узла
            if (nodeData.textSprite && nodeData.originalSpriteScale) {
                const targetSpriteScale = nodeData.originalSpriteScale.clone().multiplyScalar(targetScaleValue);
                nodeData.textSprite.scale.lerp(targetSpriteScale, easedProgress);
            }

            // Центрируем узел в сцене
            const targetPosition = new THREE.Vector3(0, 0, 0);
            nodeData.mesh.position.lerp(targetPosition, easedProgress);

            // Центрируем текст узла
            if (nodeData.textSprite) {
                const nodeRadius = NODE_RADIUS * currentScale.x; // currentScale теперь Vector3
                nodeData.textSprite.position.set(0, nodeRadius + 90, 0);
            }


            // Показываем оверлей затемнения
            if (this.detailModeOverlay) {
                this.detailModeOverlay.material.opacity = easedProgress * 0.8;
            }

            // Создаем метки актеров в конце анимации
            if (progress >= 0.8 && this.detailModeActorLabels.length === 0) {
                this.createActorLabels();
            }

            // Анимируем зум к стандартному значению
            const targetZoom = this.DETAIL_MODE_ZOOM;
            const startZoom = this.detailModeOriginalZoom || this.currentZoom;
            this.currentZoom = THREE.MathUtils.lerp(startZoom, targetZoom, easedProgress);
            this.updateCameraZoom();

            // Камера смотрит на центр
            this.cameraTarget.lerp(new THREE.Vector3(0, 0, 0), easedProgress * 0.1);
            this.camera.lookAt(this.cameraTarget);

            if (progress < 1) {
                requestAnimationFrame(animate);
            } else {
                // Анимация завершена
                // На всякий случай создаем метки, если их еще нет
                if (this.detailModeActorLabels.length === 0) {
                    this.createActorLabels();
                }
            }
        };

        animate();
    }

    // Выход из режима детального просмотра
    exitDetailMode() {
        // Используем DetailModeSystem
        // Флаги обновляются через onStateChange callback в DetailModeSystem
        this.detailModeSystem.exit();
    }

    // Анимация восстановления зума (начинается сразу)
    animateZoomRestore() {
        const startTime = Date.now();
        const duration = this.DETAIL_MODE_ANIMATION_TIME * 1000;

        const animate = () => {
            const elapsed = Date.now() - startTime;
            const progress = Math.min(elapsed / duration, 1);
            const easedProgress = this.easeInOut(progress);

            // Анимируем зум обратно к исходному значению
            const targetZoom = this.detailModeOriginalZoom || this.DETAIL_MODE_ZOOM;
            const startZoom = this.DETAIL_MODE_ZOOM; // Текущий зум в режиме детального просмотра
            this.currentZoom = THREE.MathUtils.lerp(startZoom, targetZoom, easedProgress);
            this.updateCameraZoom();

            if (progress < 1) {
                requestAnimationFrame(animate);
            }
        };

        animate();
    }

    // Анимация возврата узла на место (начинается через 0.5 секунды)
    animateNodeReturn() {
        const startTime = Date.now();
        const duration = this.DETAIL_MODE_ANIMATION_TIME * 1000;

        const animate = () => {
            const elapsed = Date.now() - startTime;
            const progress = Math.min(elapsed / duration, 1);
            const easedProgress = this.easeInOut(progress);

            // Возвращаем все деревья
            const nodeData = this.detailModeNode;
            const selectedMesh = nodeData.mesh;
            const selectedTextSprite = nodeData.textSprite;
            
            this.treeGroups.forEach(treeGroup => {
                treeGroup.traverse((object) => {
                    // Исключаем выбранный узел, его текст и все дочерние элементы из восстановления opacity
                    if (object === selectedMesh || object === selectedTextSprite) {
                        return; // Пропускаем выбранный узел
                    }
                    
                    // Проверяем, является ли объект дочерним элементом выбранного узла (например, edgeLines)
                    let isChildOfSelected = false;
                    let parent = object.parent;
                    while (parent) {
                        if (parent === selectedMesh) {
                            isChildOfSelected = true;
                            break;
                        }
                        parent = parent.parent;
                    }
                    
                    if (isChildOfSelected) {
                        return; // Пропускаем дочерние элементы выбранного узла
                    }
                    
                    // Восстанавливаем видимость всех остальных объектов
                    object.visible = true;
                    
                    // Восстанавливаем opacity для остальных объектов
                    if (object.material) {
                        if (Array.isArray(object.material)) {
                            object.material.forEach(mat => {
                                mat.opacity = easedProgress;
                                mat.transparent = easedProgress < 1;
                            });
                        } else {
                            object.material.opacity = easedProgress;
                            object.material.transparent = easedProgress < 1;
                        }
                    }
                });
            });
            
            // Явно устанавливаем видимость и opacity для выбранного узла и его дочерних элементов
            selectedMesh.visible = true;
            if (selectedTextSprite) {
                selectedTextSprite.visible = true;
                if (selectedTextSprite.material instanceof THREE.SpriteMaterial) {
                    selectedTextSprite.material.opacity = 1.0;
                }
            }
            
            // Убеждаемся, что все дочерние элементы выбранного узла (edgeLines) остаются видимыми
            selectedMesh.traverse((child) => {
                if (child !== selectedMesh) {
                    child.visible = true;
                    if (child.material) {
                        if (Array.isArray(child.material)) {
                            child.material.forEach(mat => {
                                mat.opacity = 1.0;
                                mat.transparent = false;
                            });
                        } else {
                            child.material.opacity = 1.0;
                            child.material.transparent = false;
                        }
                    }
                }
            });
            
            // Убеждаемся, что материал выбранного узла остается видимым
            if (selectedMesh.material) {
                if (Array.isArray(selectedMesh.material)) {
                    selectedMesh.material.forEach(mat => {
                        mat.opacity = 1.0;
                        mat.transparent = false;
                    });
                } else {
                    selectedMesh.material.opacity = 1.0;
                    selectedMesh.material.transparent = false;
                }
            }
            
            // В конце анимации (когда progress = 1) восстанавливаем исходные значения
            if (progress >= 1) {
                this.treeGroups.forEach(treeGroup => {
                    treeGroup.traverse((object) => {
                        object.visible = true;
                        
                        // Восстанавливаем исходные значения opacity и transparent
                        const originalState = this.detailModeOriginalObjectStates.get(object);
                        if (originalState) {
                            if (object.material) {
                                if (Array.isArray(object.material) && originalState.materials) {
                                    object.material.forEach((mat, index) => {
                                        if (originalState.materials[index]) {
                                            mat.opacity = originalState.materials[index].opacity;
                                            mat.transparent = originalState.materials[index].transparent;
                                        }
                                    });
                                } else if (!Array.isArray(object.material)) {
                                    object.material.opacity = originalState.opacity;
                                    object.material.transparent = originalState.transparent;
                                }
                            }
                            
                            if (object instanceof THREE.Sprite && object.material instanceof THREE.SpriteMaterial) {
                                object.material.opacity = originalState.opacity;
                                object.material.transparent = originalState.transparent;
                            }
                        }
                    });
                });
            }
            
            if (selectedTextSprite && selectedTextSprite.material) {
                selectedTextSprite.material.opacity = 1;
                selectedTextSprite.material.transparent = false;
            }

            // Добавляем светлячки обратно в treeGroup
            this.fireflies.forEach(firefly => {
                if (firefly.mesh && firefly.nodeId !== undefined) {
                    // Находим treeGroup для этого узла
                    const treeGroup = this.treeGroups.find(group =>
                        group.children.some(child =>
                            child.userData && child.userData.node && child.userData.node.id === firefly.nodeId
                        )
                    );
                    if (treeGroup && !firefly.mesh.parent) {
                        treeGroup.add(firefly.mesh);
                    }
                }
            });

            // Возвращаем выбранный узел к исходному состоянию
            // Вычисляем масштаб детального режима и возвращаем к исходному
            const detailScaleValue = this.calculateDetailModeScale(nodeData);
            const baseScale = nodeData.originalScale || new THREE.Vector3(1, 1, 1);
            const detailScale = baseScale.clone().multiplyScalar(detailScaleValue);
            const currentScale = detailScale.clone().lerp(baseScale, easedProgress);
            nodeData.mesh.scale.copy(currentScale);

            if (nodeData.textSprite && nodeData.originalSpriteScale) {
                const detailSpriteScale = nodeData.originalSpriteScale.clone().multiplyScalar(detailScaleValue);
                nodeData.textSprite.scale.lerp(nodeData.originalSpriteScale, easedProgress);
            }

            // Возвращаем позицию узла
            const originalPosition = nodeData.originalPosition;
            nodeData.mesh.position.lerp(originalPosition, easedProgress);

            // Возвращаем позицию текста
            if (nodeData.textSprite) {
                const nodeRadius = NODE_RADIUS * currentScale.x; // currentScale теперь Vector3
                const textPos = new THREE.Vector3(
                    originalPosition.x,
                    originalPosition.y + nodeRadius + 90,
                    originalPosition.z
                );
                nodeData.textSprite.position.lerp(textPos, easedProgress);
            }

            // Скрываем оверлей
            if (this.detailModeOverlay) {
                this.detailModeOverlay.material.opacity = (1 - easedProgress) * 0.8;
            }

            // Скрываем метки актеров
            this.detailModeActorLabels.forEach(label => {
                if (label.sprite) {
                    label.sprite.material.opacity = 1 - easedProgress;
                }
            });

            // Скрываем кнопку выхода
            if (this.detailModeExitButton) {
                this.detailModeExitButton.style.opacity = 1 - easedProgress;
            }

            // Возвращаем камеру
            if (this.originalCameraPosition) {
                // Синхронизируем с CameraManager - используем lerp для плавного перехода
                const newTarget = this.originalCameraTarget.clone().lerp(this.cameraTarget, 1 - easedProgress * 0.1);
                this.cameraManager.setTarget(newTarget);
                this.cameraTarget = this.cameraManager.getTarget();
                this.camera = this.cameraManager.getCamera();
                this.cameraTarget.lerp(this.originalCameraTarget || new THREE.Vector3(0, 0, 0), easedProgress * 0.1);
                this.camera.lookAt(this.cameraTarget);
            }

            if (progress < 1) {
                requestAnimationFrame(animate);
            } else {
                // Очищаем режим
                this.cleanupDetailMode();
            }
        };

        animate();
    }

    // Очистка режима детального просмотра
    cleanupDetailMode() {
        // Удаляем оверлей
        if (this.detailModeOverlay) {
            this.scene.remove(this.detailModeOverlay);
            this.detailModeOverlay.geometry.dispose();
            this.detailModeOverlay.material.dispose();
            this.detailModeOverlay = null;
        }

        // Удаляем кнопку выхода
        if (this.detailModeExitButton) {
            document.body.removeChild(this.detailModeExitButton);
            this.detailModeExitButton = null;
        }

        // Удаляем метки актеров
        this.detailModeActorLabels.forEach(label => {
            if (label.sprite) {
                this.scene.remove(label.sprite);
                label.sprite.geometry.dispose();
                label.sprite.material.dispose();
            }
        });
        this.detailModeActorLabels = [];

        // Восстанавливаем деревья - восстанавливаем исходные значения opacity и transparent
        this.treeGroups.forEach(treeGroup => {
            treeGroup.traverse((object) => {
                // Восстанавливаем видимость
                object.visible = true;
                
                // Восстанавливаем исходные значения opacity и transparent
                const originalState = this.detailModeOriginalObjectStates.get(object);
                if (originalState) {
                    if (object.material) {
                        if (Array.isArray(object.material) && originalState.materials) {
                            object.material.forEach((mat, index) => {
                                if (originalState.materials[index]) {
                                    mat.opacity = originalState.materials[index].opacity;
                                    mat.transparent = originalState.materials[index].transparent;
                                }
                            });
                        } else if (!Array.isArray(object.material)) {
                            object.material.opacity = originalState.opacity;
                            object.material.transparent = originalState.transparent;
                        }
                    }
                    
                    // Восстанавливаем для спрайтов
                    if (object instanceof THREE.Sprite && object.material instanceof THREE.SpriteMaterial) {
                        object.material.opacity = originalState.opacity;
                        object.material.transparent = originalState.transparent;
                        object.visible = true;
                    }
                } else {
                    // Если не нашли сохраненное состояние, устанавливаем значения по умолчанию
                    if (object.material) {
                        if (Array.isArray(object.material)) {
                            object.material.forEach(mat => {
                                mat.opacity = 1.0;
                                mat.transparent = false;
                            });
                        } else {
                            object.material.opacity = 1.0;
                            object.material.transparent = false;
                        }
                    }
                }
            });
        });
        
        this.detailModeOriginalStates = null;
        this.detailModeOriginalObjectStates.clear();

        // Разблокируем элементы управления зумом
        this.enableZoomControls();
        
        // Разблокируем управление камерой мышью
        if (this.controls) {
            this.controls.enable();
        }

        // Сбрасываем флаги
        this.isDetailMode = false;
        this.detailModeNode = null;
        this.detailModeOriginalZoom = null;
    }

    // Функция easing для плавных анимаций
    easeInOut(t) {
        return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
    }

    // Вычисление масштаба узла на основе процента ширины экрана
    calculateDetailModeScale(nodeData) {
        // Получаем исходный радиус узла
        const nodeRadius = nodeData.node.level === 0 ? ROOT_RADIUS : NODE_RADIUS;
        const nodeDiameter = nodeRadius * 2; // Диаметр узла в исходном размере

        // Вычисляем размер видимой области на стандартном расстоянии (зум = 1.0)
        // Используем initialCameraDistance, которое соответствует зуму 1.0
        const fov = this.camera.fov * (Math.PI / 180); // FOV в радианах
        const standardDistance = this.initialCameraDistance; // Расстояние при зуме 1.0
        const visibleHeight = 2 * Math.tan(fov / 2) * standardDistance;
        const visibleWidth = visibleHeight * this.camera.aspect;

        // Вычисляем желаемый размер узла (процент от ширины экрана)
        const targetSize = visibleWidth * (this.DETAIL_MODE_SCREEN_SIZE_PERCENT / 100);

        // Вычисляем нужный масштаб
        const scale = targetSize / nodeDiameter;

        return scale;
    }

    // Блокировка элементов управления зумом в режиме детального просмотра
    disableZoomControls() {
        const zoomInBtn = document.getElementById('zoom-in');
        const zoomOutBtn = document.getElementById('zoom-out');
        const zoomResetBtn = document.getElementById('zoom-reset');
        
        if (zoomInBtn) {
            zoomInBtn.style.opacity = '0.3';
            zoomInBtn.style.pointerEvents = 'none';
            zoomInBtn.disabled = true;
        }
        if (zoomOutBtn) {
            zoomOutBtn.style.opacity = '0.3';
            zoomOutBtn.style.pointerEvents = 'none';
            zoomOutBtn.disabled = true;
        }
        if (zoomResetBtn) {
            zoomResetBtn.style.opacity = '0.3';
            zoomResetBtn.style.pointerEvents = 'none';
            zoomResetBtn.disabled = true;
        }
    }

    // Разблокировка элементов управления зумом
    enableZoomControls() {
        const zoomInBtn = document.getElementById('zoom-in');
        const zoomOutBtn = document.getElementById('zoom-out');
        const zoomResetBtn = document.getElementById('zoom-reset');
        
        if (zoomInBtn) {
            zoomInBtn.style.opacity = '1';
            zoomInBtn.style.pointerEvents = 'auto';
            zoomInBtn.disabled = false;
        }
        if (zoomOutBtn) {
            zoomOutBtn.style.opacity = '1';
            zoomOutBtn.style.pointerEvents = 'auto';
            zoomOutBtn.disabled = false;
        }
        if (zoomResetBtn) {
            zoomResetBtn.style.opacity = '1';
            zoomResetBtn.style.pointerEvents = 'auto';
            zoomResetBtn.disabled = false;
        }
    }

    // Обновление размера узла в режиме детального просмотра (при изменении слайдера)
    updateDetailModeNodeScale() {
        if (!this.isDetailMode || !this.detailModeNode) return;

        const nodeData = this.detailModeNode;
        const targetScale = this.calculateDetailModeScale(nodeData);
        const baseScale = nodeData.originalScale || new THREE.Vector3(1, 1, 1);
        const newScale = baseScale.clone().multiplyScalar(targetScale);
        
        nodeData.mesh.scale.copy(newScale);

        // Обновляем масштаб текста
        if (nodeData.textSprite && nodeData.originalSpriteScale) {
            const newSpriteScale = nodeData.originalSpriteScale.clone().multiplyScalar(targetScale);
            nodeData.textSprite.scale.copy(newSpriteScale);
        }
    }

    // Рекурсивная функция для установки opacity всем объектам в группе
    setGroupOpacity(group, opacity, makeTransparent = true) {
        group.traverse((object) => {
            if (object.material) {
                if (Array.isArray(object.material)) {
                    object.material.forEach(mat => {
                        mat.opacity = opacity;
                        mat.transparent = makeTransparent && opacity < 1;
                    });
                } else {
                    object.material.opacity = opacity;
                    object.material.transparent = makeTransparent && opacity < 1;
                }
            }
        });
    }

    // Создание текстовых меток актеров по кругу
    createActorLabels() {
        if (!this.detailModeNode) {
            return;
        }

        const nodeData = this.detailModeNode;
        const taskId = nodeData.node.id;

        // Находим технологии для этой задачи
        // Получаем технологии (дети уровня 3) для задачи (taskId)
        const technologies = mockData.filter(item => item.parentId === taskId);

        if (technologies.length === 0) {
            // Даже если технологий нет, создаем одну метку "Нет информации"
            technologies.push({ text: 'Нет информации о технологиях' });
        }

        const radius = this.DETAIL_MODE_ACTOR_RADIUS;
        const angleStep = (Math.PI * 2) / technologies.length;

        technologies.forEach((technology, index) => {
            const angle = index * angleStep;

            // Позиция метки по кругу
            const x = Math.cos(angle) * radius;
            const z = Math.sin(angle) * radius;
            const y = 0; // На уровне узла

            // Создаем текстовый спрайт для актера
            const canvas = document.createElement('canvas');
            const context = canvas.getContext('2d');

            // Размер шрифта для актеров (меньше чем для узлов)
            const fontSize = 24;
            context.font = `bold ${fontSize}px Arial`;

            const textWidth = context.measureText(technology.text).width;
            const textHeight = fontSize;

            // Увеличиваем разрешение для четкости
            canvas.width = (textWidth + TEXT_PADDING) * TEXT_SCALE_FACTOR;
            canvas.height = (textHeight + TEXT_PADDING) * TEXT_SCALE_FACTOR;
            context.scale(TEXT_SCALE_FACTOR, TEXT_SCALE_FACTOR);
            context.font = `bold ${fontSize}px Arial`;
            context.textAlign = 'center';
            context.textBaseline = 'middle';

            // Рисуем текст с обводкой
            context.fillStyle = '#ffffff';
            context.strokeStyle = '#000000';
            context.lineWidth = 2;
            context.strokeText(technology.text, (textWidth + 20) / 2, (textHeight + 20) / 2);
            context.fillText(technology.text, (textWidth + 20) / 2, (textHeight + 20) / 2);

            const texture = new THREE.CanvasTexture(canvas);
            texture.needsUpdate = true;

            const spriteMaterial = new THREE.SpriteMaterial({
                map: texture,
                transparent: true,
                opacity: 0, // Начинаем с прозрачности 0 для анимации
                alphaTest: 0.1
            });

            const sprite = new THREE.Sprite(spriteMaterial);
            sprite.position.set(x, y, z);
            sprite.scale.set((canvas.width / TEXT_SCALE_FACTOR) * 0.8, (canvas.height / TEXT_SCALE_FACTOR) * 0.8, 1);
            sprite.renderOrder = 2; // Над всем

            this.scene.add(sprite);

            this.detailModeActorLabels.push({
                sprite: sprite,
                technology: technology,
                originalPosition: sprite.position.clone()
            });
        });

        // Анимируем появление меток актеров
        this.animateActorLabelsAppearance();
    }

    // Анимация появления меток актеров
    animateActorLabelsAppearance() {
        const startTime = Date.now();
        const duration = 0.5 * 1000; // 0.5 секунды

        const animate = () => {
            const elapsed = Date.now() - startTime;
            const progress = Math.min(elapsed / duration, 1);
            const easedProgress = this.easeInOut(progress);

            this.detailModeActorLabels.forEach((label, index) => {
                const delay = index * 0.1; // Задержка для каждого следующего
                const delayedProgress = Math.max(0, progress - delay);

                if (label.sprite) {
                    label.sprite.material.opacity = delayedProgress;
                    // Небольшая анимация масштаба
                    const scale = 0.8 + delayedProgress * 0.2;
                    label.sprite.scale.set(
                        label.sprite.scale.x * scale / label.sprite.scale.x,
                        label.sprite.scale.y * scale / label.sprite.scale.y,
                        1
                    );
                }
            });

            if (progress < 1) {
                requestAnimationFrame(animate);
            } else {
            }
        };

        animate();
    }

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
    }
    
    setupAnimationLoop() {
        // Используем Loop для управления анимацией
        this.loop.addUpdateCallback((deltaTime) => {
            this.update(deltaTime);
        });
        this.loop.start();
    }
    
    update(deltaTime) {
        // Перенесена логика из animate()
        
        // Обновляем позиции светлячков
        let detailModeFireflyCount = 0;
        this.fireflies.forEach((firefly, index) => {
            if (!firefly.mesh) return;
            
            // Обновляем угол с учетом скорости
            firefly.angle += firefly.speed * 0.01;
            
            // Вычисляем радиус орбиты (зависит от размера узла в детальном режиме)
            let orbitRadius = this.fireflyOrbitRadius;
            const isDetailModeFirefly = this.isDetailMode && this.detailModeNode && firefly.nodeId === this.detailModeNode.node.id;
            if (isDetailModeFirefly) {
                // В детальном режиме радиус орбиты должен масштабироваться вместе с узлом
                // Получаем текущий масштаб узла (используем среднее значение по осям)
                const nodeScale = this.detailModeNode.mesh.scale;
                const averageScale = (nodeScale.x + nodeScale.y + nodeScale.z) / 3;
                // Применяем масштаб к радиусу орбиты
                orbitRadius = this.fireflyOrbitRadius * averageScale;
                detailModeFireflyCount++;
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
                
                // Логируем периодически (каждые 60 кадров, примерно раз в секунду)
                if (index === 0 && Math.floor(Date.now() / 1000) % 2 === 0) {
                }
            }
            
            // Позиция = позиция узла + смещение на орбите
            firefly.mesh.position.x = nodePosition.x + orbitX;
            firefly.mesh.position.y = nodePosition.y + orbitY;
            firefly.mesh.position.z = nodePosition.z + orbitZ;
        });
        
        // Периодически логируем состояние светлячков в детальном режиме
        if (this.isDetailMode && detailModeFireflyCount > 0 && Math.floor(Date.now() / 2000) % 3 === 0) {
        }
        
        // Анимация выделенного узла
        if (this.selectedNode && this.selectedNode.isAnimating) {
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
        
        // Анимация возврата узла на исходный масштаб (если есть узлы, которые возвращаются)
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
        
        // Анимация отодвигания соседних узлов
        this.nodeMeshes.forEach(nodeData => {
            if (nodeData.isPushing && nodeData.targetPushPosition) {
                // Плавное перемещение узла
                const oldMeshPos = nodeData.mesh.position.clone();
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
        
        // Универсальное обновление позиций всех спрайтов каждый кадр
        // Это гарантирует, что спрайты всегда синхронизированы с узлами
        // НЕ обновляем спрайты, которые находятся в процессе отодвигания (они уже обновлены выше)
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
        
        this.rendererManager.render(this.scene, this.camera);
    }
}

// Функция обновления прогресса загрузки
// Функции перенесены в LoadingScreen класс
// Используем loadingScreen.updateProgress() и loadingScreen.hide()

// Инициализация при загрузке страницы
window.addEventListener('DOMContentLoaded', () => {
    const viz = new RadialTreeVisualization('scene-canvas');

    // Скрываем загрузочный экран после инициализации
    setTimeout(() => {
        const canvas = document.getElementById('scene-canvas');
        if (canvas) {
            canvas.style.display = 'block';
        }
        viz.loadingScreen.hide();
    }, 1000); // Даем время на финальную загрузку
});

