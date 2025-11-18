import * as THREE from 'three';
import { TreeNode } from './seriesMockData.js';
import { seriesMockData, actorsData } from './seriesMockData.js';

// Константы
const ROOT_RADIUS = 225;  // Радиус корневого узла (увеличен в 3 раза)
const NODE_RADIUS = 135;  // Радиус обычных узлов (увеличен в 3 раза)
const H_STEP = 50;       // Вертикальный шаг (на будущее, сейчас не используется)

// Кэш для деревьев (чтобы не пересчитывать каждый раз)
let cachedTrees = null;
let cachedDepth = null;

// Преобразование статического массива данных в структуру TreeNode
// Возвращает массив деревьев (несколько root узлов)
function buildTreesFromData(data, maxDepth) {
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

/**
 * Собираем листья дерева в порядке DFS.
 */
function collectLeavesDFS(node, leaves) {
    if (node.children.length === 0) {
        leaves.push(node);
        return;
    }
    node.children.forEach((child) => collectLeavesDFS(child, leaves));
}

/**
 * Назначаем углы:
 *  - листьям — равномерно по окружности;
 *  - внутренним узлам — средний угол по детям (с учётом цикличности).
 */
function assignAngles(root) {
    const leaves = [];
    collectLeavesDFS(root, leaves);
    
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
 * Группируем узлы по уровню.
 */
function groupNodesByLevel(nodes) {
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
 * Считаем максимальное количество узлов на каждом уровне для всех деревьев.
 */
function computeMaxNodesPerLevel(maxDepth) {
    const trees = buildTreesFromData(seriesMockData, maxDepth);
    const result = {};
    
    trees.forEach(({ nodes }) => {
        const levels = groupNodesByLevel(nodes);
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
    const spacingFactor = config?.spacingFactor ?? 1.4;
    const levelMarginFactor = config?.levelMarginFactor ?? 0.6;
    
    // Временно назначаем углы для расчета
    assignAngles(root);
    
    const levels = groupNodesByLevel(nodes);
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
    const spacingFactor = config?.spacingFactor ?? 1.4;       // 1–2
    const levelMarginFactor = config?.levelMarginFactor ?? 0.6; // 0–2
    const offset = config?.offset ?? new THREE.Vector3(0, 0, 0);
    
    // 1. Углы для всех узлов
    assignAngles(root);
    
    // 2. Группируем по уровням
    const levels = groupNodesByLevel(nodes);
    const maxLevel = Math.max(...nodes.map((n) => n.level));
    
    const radii = new Array(maxLevel + 1).fill(0);
    radii[0] = 0; // root в центре
    
    const nodeDiameter = 2 * NODE_RADIUS;
    const targetChord = nodeDiameter * spacingFactor; // желаемое расстояние между соседними центрами
    const baseLevelSeparation = ROOT_RADIUS + NODE_RADIUS; // минимальное разделение уровней без учёта фактора
    
    // 3. Считаем радиусы уровней
    for (let level = 1; level <= maxLevel; level += 1) {
        const levelNodes = levels.get(level) || [];
        
        // Если на уровне нет узлов (маловероятно) — просто увеличиваем радиус
        if (levelNodes.length === 0) {
            radii[level] = radii[level - 1] + baseLevelSeparation;
            continue;
        }
        
        // Считаем минимальную разницу углов между соседними узлами на уровне
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
        
        // Если узел один, берём полный круг
        if (levelNodes.length === 1) {
            minAngleDiff = 2 * Math.PI;
        }
        
        // Радиус из условия, что хорда >= targetChord
        let radiusFromSpacing;
        if (minAngleDiff > 1e-3) {
            radiusFromSpacing = targetChord / (2 * Math.sin(minAngleDiff / 2));
        } else {
            // На всякий случай, если углы почти совпали
            radiusFromSpacing = radii[level - 1] + baseLevelSeparation * 2;
        }
        
        // Минимальный радиус с учётом разделения уровней
        const radiusBase = Math.max(
            radiusFromSpacing,
            radii[level - 1] + baseLevelSeparation
        );
        
        // Добавляем настраиваемый радиальный зазор
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

// Создание визуализации дерева
class RadialTreeVisualization {
    constructor(containerId) {
        this.container = document.getElementById(containerId);
        this.scene = new THREE.Scene();
        this.camera = null;
        this.renderer = null;
        this.treeGroups = []; // Массив групп деревьев
        
        // Переменные для управления камерой мышью
        this.isDragging = false;
        this.previousMousePosition = { x: 0, y: 0 };
        this.cameraPosition = new THREE.Vector3(0, 800, 1000); // Позиция камеры (фиксированный угол сверху)
        this.cameraTarget = new THREE.Vector3(0, 0, 0); // Точка, на которую смотрит камера
        
        // Параметры layout'а (управляются слайдерами)
        this.spacingFactor = 1.4;       // множитель для расстояния по окружности (1–2 диаметров)
        this.levelMarginFactor = 0.6;   // множитель для радиального зазора между уровнями
        this.graphRotation = {          // вращение графа по осям в градусах
            x: 0,
            y: 0,
            z: 15
        };
        // Параметры светлячков
        this.fireflySize = 20;          // Размер светлячков
        this.fireflyOrbitRadius = 200;   // Радиус орбиты светлячков
        this.fireflyRotationSpeed = 1;    // Скорость вращения светлячков
        this.fireflies = [];             // Массив светлячков { mesh, nodeId, angle, speed }
        
        // Параметры для выделения узлов
        this.raycaster = new THREE.Raycaster();

        // Константы режима детального просмотра эпизодов
        this.DETAIL_MODE_SCREEN_SIZE_PERCENT = 22;  // Процент ширины экрана, который должен занимать узел (10-80%)
        this.DETAIL_MODE_ZOOM = 1.0;                // Значение зума в режиме детального просмотра (стандартный зум)
        this.DETAIL_MODE_ANIMATION_TIME = 1.0;      // Время анимации входа/выхода из режима (секунды)
        this.DETAIL_MODE_ACTOR_RADIUS = 400;        // Радиус расположения имен актеров вокруг узла

        // Переменные режима детального просмотра
        this.isDetailMode = false;              // Флаг режима детального просмотра
        this.detailModeNode = null;             // Выбранный узел в режиме детального просмотра
        this.detailModeOverlay = null;          // Оверлей затемнения
        this.detailModeExitButton = null;       // Кнопка выхода
        this.detailModeActorLabels = [];        // Массив меток с именами актеров
        this.detailModeOriginalStates = null;   // Сохраненные состояния деревьев до входа в режим
        this.detailModeOriginalZoom = null;      // Сохраненный зум до входа в режим
        this.mouse = new THREE.Vector2();
        this.nodeMeshes = [];            // Массив всех узлов { mesh, originalPosition, originalScale, originalMaterial, node }
        this.selectedNode = null;         // Текущий выделенный узел
        this.animationSpeed = 0.05;      // Скорость анимации (lerp factor)
        
        this.maxNodesPerLevel = computeMaxNodesPerLevel(4); // Глубина 4 уровня (сериал -> сезон -> режиссер -> серия)
        this.levelLimits = {
            1: this.maxNodesPerLevel[1] ?? 0,
            2: this.maxNodesPerLevel[2] ?? 0,
            3: this.maxNodesPerLevel[3] ?? 0,
            4: this.maxNodesPerLevel[4] ?? 0,
        };
        
        // Параметры зума (будет обновляться динамически)
        this.initialCameraDistance = 1500; // Расстояние для обзора нескольких деревьев
        this.currentZoom = 1;
        this.minZoom = 0.2;
        this.maxZoom = 3;
        this.zoomStep = 0.2;
        
        // Минимальное расстояние между центрами деревьев (будет вычисляться динамически)
        this.minTreeSpacing = 0;
        
        // Инициализация камеры должна быть до init()
        // Фиксированный угол обзора сверху (как было изначально)
        this.cameraPosition = new THREE.Vector3(0, 800, 1000);
        this.cameraTarget = new THREE.Vector3(0, 0, 0); // Начальная цель - центр сцены
        
        this.init();
        this.createTrees(4); // Глубина 4 уровня (сериал -> сезон -> режиссер -> серия)
        this.setupZoomControls();
        this.setupLayoutControls();
        this.animate();
    }
    
    init() {
        // Создание камеры
        const width = window.innerWidth;
        const height = window.innerHeight;
        
        // Увеличиваем far plane, чтобы все объекты были видны при любом зуме
        this.camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 50000);
        // Устанавливаем начальную позицию камеры
        this.camera.position.copy(this.cameraPosition);
        this.camera.lookAt(this.cameraTarget);
        
        // Создание рендерера
        this.renderer = new THREE.WebGLRenderer({
            canvas: this.container,
            alpha: true,
            antialias: true
        });
        this.renderer.setSize(width, height);
        this.renderer.setPixelRatio(window.devicePixelRatio);
        
        // Освещение
        const ambientLight = new THREE.AmbientLight(0x404040, 0.6);
        this.scene.add(ambientLight);
        
        const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
        directionalLight.position.set(200, 200, 200);
        this.scene.add(directionalLight);
        
        const pointLight = new THREE.PointLight(0xffa500, 1, 1000);
        pointLight.position.set(0, 0, 0);
        this.scene.add(pointLight);
        
        // Обработка изменения размера окна
        window.addEventListener('resize', () => this.onWindowResize());
        
        // Инициализация управления камерой мышью
        this.setupMouseControls();
        
        // Инициализация обработчика клика по узлам
        this.setupNodeClickHandler();
    }
    
    setupMouseControls() {
        // cameraDistance уже установлен в init()
        
        // Обработка нажатия мыши
        this.container.addEventListener('mousedown', (event) => {
            // В режиме детального просмотра блокируем все взаимодействия мыши
            if (this.isDetailMode) {
                return;
            }

            if (event.button === 0) { // Левая кнопка мыши
                // Сначала проверяем клик по узлу
                this.mouse.x = (event.clientX / this.container.clientWidth) * 2 - 1;
                this.mouse.y = -(event.clientY / this.container.clientHeight) * 2 + 1;

                // Обновляем матрицы всех объектов перед raycasting
                this.scene.updateMatrixWorld(true);

                this.raycaster.setFromCamera(this.mouse, this.camera);

                // Проверяем пересечения со всеми узлами
                const allMeshes = this.nodeMeshes.map(n => n.mesh);
                const intersects = this.raycaster.intersectObjects(allMeshes, true);

                if (intersects.length > 0) {
                    // Клик по узлу - не начинаем перетаскивание
                    const clickedMesh = intersects[0].object;
                    this.handleNodeClick(clickedMesh);
                    event.preventDefault();
                    event.stopPropagation();
                    return;
                }

                // Клик не по узлу - начинаем перетаскивание
                this.isDragging = true;
                this.previousMousePosition = {
                    x: event.clientX,
                    y: event.clientY
                };
                this.container.style.cursor = 'grabbing';
            }
        });
        
        // Обработка движения мыши
        this.container.addEventListener('mousemove', (event) => {
            if (this.isDragging) {
                const deltaX = event.clientX - this.previousMousePosition.x;
                const deltaY = event.clientY - this.previousMousePosition.y;
                
                // Панорамирование: перемещаем цель камеры в плоскости XZ (горизонтальная плоскость)
                // Вычисляем размер видимой области на текущем расстоянии
                const distanceToTarget = this.camera.position.distanceTo(this.cameraTarget);
                const fov = this.camera.fov * (Math.PI / 180);
                const visibleHeight = 2 * Math.tan(fov / 2) * distanceToTarget;
                const visibleWidth = visibleHeight * this.camera.aspect;
                
                // Скорость панорамирования: перемещение мыши в пикселях -> перемещение в мировых координатах
                // Это обеспечивает равномерное панорамирование независимо от зума
                const panSpeedX = visibleWidth / this.container.clientWidth;
                const panSpeedZ = visibleHeight / this.container.clientHeight;
                
                // Вычисляем смещение в плоскости XZ (горизонтальная плоскость)
                // При движении мыши вправо - сцена двигается влево (отрицательное X)
                // При движении мыши вверх - сцена двигается назад (отрицательное Z)
                const panDelta = new THREE.Vector3(
                    -deltaX * panSpeedX,
                    0,
                    -deltaY * panSpeedZ
                );
                
                // Обновляем только цель камеры
                this.cameraTarget.add(panDelta);
                
                // Пересчитываем позицию камеры на основе новой цели
                this.updateCameraPosition();
                
                this.previousMousePosition = {
                    x: event.clientX,
                    y: event.clientY
                };
            }
        });
        
        // Обработка отпускания мыши
        this.container.addEventListener('mouseup', () => {
            this.isDragging = false;
            this.container.style.cursor = 'default';
        });
        
        // Обработка выхода мыши за пределы canvas
        this.container.addEventListener('mouseleave', () => {
            this.isDragging = false;
            this.container.style.cursor = 'default';
        });
    }
    
    updateCameraPosition() {
        // Вычисляем направление от цели к камере (фиксированный угол сверху)
        // ВАЖНО: создаем новый вектор каждый раз, чтобы избежать мутации
        const baseDirection = new THREE.Vector3(0, 800, 1000).normalize();
        const baseDistance = Math.sqrt(800 * 800 + 1000 * 1000);
        
        // Расстояние с учетом зума
        const distance = baseDistance / this.currentZoom;
        
        // Позиция камеры = цель + направление * расстояние
        // Клонируем вектор направления, чтобы избежать мутации
        const offset = baseDirection.clone().multiplyScalar(distance);
        this.camera.position.copy(this.cameraTarget).add(offset);
        
        // Камера всегда смотрит на цель
        this.camera.lookAt(this.cameraTarget);
        
        // Обновляем матрицу проекции камеры
        this.camera.updateProjectionMatrix();
    }
    
    createTrees(depth) {
        // Сбрасываем кэш при пересоздании деревьев
        cachedTrees = null;
        
        // Очищаем массив узлов перед созданием новых
        this.nodeMeshes = [];
        cachedDepth = null;
        
        // Удаляем старые деревья
        this.treeGroups.forEach(treeGroup => {
            this.scene.remove(treeGroup);
            treeGroup.traverse((child) => {
                if (child.geometry) child.geometry.dispose();
                if (child.material) {
                    if (Array.isArray(child.material)) {
                        child.material.forEach(m => m.dispose());
                    } else {
                        child.material.dispose();
                    }
                }
            });
        });
        this.treeGroups = [];
        
        // Удаляем старые светлячки
        this.fireflies.forEach(firefly => {
            // Светлячки теперь в treeGroup, а не в scene, но treeGroup уже удален выше
            // Очищаем ресурсы меша и всех дочерних элементов (glow)
            firefly.mesh.traverse((child) => {
                if (child.geometry) child.geometry.dispose();
                if (child.material) {
                    if (Array.isArray(child.material)) {
                        child.material.forEach(m => m.dispose());
                    } else {
                        child.material.dispose();
                    }
                }
            });
        });
        this.fireflies = [];
        
        // Строим все деревья из данных
        const trees = buildTreesFromData(seriesMockData, depth);
        
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
        
        // Цвета для разных деревьев
        const rootColors = [
            0xff6b6b, // Красный для Ведьмака
            0x4ecdc4, // Бирюзовый для Очень странных дел
            0x95e1d3, // Зелёный для Игры престолов
            0xf38181, // Розовый для Во все тяжкие
        ];
        
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
                    color: 0x888888,
                    opacity: 0.5,
                    transparent: true
                });
                
                const line = new THREE.Line(geometry, material);
                    treeGroup.add(line);
            }
        });
        
        // Отладочная информация: считаем узлы уровня 3
        const level3Nodes = filteredNodes.filter(node => node.level === 3);
        let totalFirefliesForTree = 0;
        level3Nodes.forEach(node => {
            const actorCount = actorsData.filter(actor => actor.parentId === node.id).length;
            totalFirefliesForTree += actorCount;
        });
        
        // Создаем сферы (вершины)
        filteredNodes.forEach(node => {
                const isRoot = node.level === 0;
                const radius = getNodeRadius(node, isRoot);
            
            const geometry = new THREE.SphereGeometry(radius, 32, 32);
            
            let material;
            if (isRoot) {
                    // Корень - цвет зависит от дерева
                    const rootColor = rootColors[treeIndex] || 0xffa500;
                material = new THREE.MeshStandardMaterial({
                        color: rootColor,
                        emissive: rootColor,
                    emissiveIntensity: 0.5,
                    metalness: 0.3,
                    roughness: 0.2
                });
            } else {
                    // Обычные узлы - цвет зависит от уровня
                    const levelColors = [
                        0x4a90e2, // Синий для уровня 1 (сезоны)
                        0x7b68ee, // Фиолетовый для уровня 2 (режиссеры)
                        0x20b2aa, // Бирюзовый для уровня 3 (серии)
                    ];
                    const levelColor = levelColors[node.level - 1] || 0x888888;
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
                    color: isRoot ? 0xffffff : 0xffffff,
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
                const scaleFactor = 4;
                canvas.width = (textWidth + 20) * scaleFactor;
                canvas.height = (textHeight + 20) * scaleFactor;

                // Масштабируем контекст
                context.scale(scaleFactor, scaleFactor);
                
                // Перерисовываем текст
                    context.fillStyle = '#ffffff';
                    context.strokeStyle = '#000000';
                context.lineWidth = 3;
                context.font = `bold ${fontSize}px Arial`;
                context.textAlign = 'center';
                context.textBaseline = 'middle';
                
                // Рисуем текст с обводкой (координаты без учета масштаба контекста)
                context.strokeText(node.text, (textWidth + 20) / 2, (textHeight + 20) / 2);
                context.fillText(node.text, (textWidth + 20) / 2, (textHeight + 20) / 2);
                
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
                    sprite.scale.set((canvas.width / scaleFactor) * 1.5, (canvas.height / scaleFactor) * 1.5, 1); // Увеличено в 3 раза (0.5 * 3), скорректировано с учетом высокого разрешения
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
            
                
                // Создаем светлячков для узлов 4 уровня (серии)
                // Уровни: 0=сериал, 1=сезоны, 2=режиссеры, 3=эпизоды
                if (node.level === 3) {
                    // Находим количество актеров для этого эпизода
                    const actorsForEpisode = actorsData.filter(actor => actor.parentId === node.id);
                    const actorCount = actorsForEpisode.length;
                    
                    // Создаем светлячков только если есть актеры
                    if (actorCount > 0) {
                        for (let i = 0; i < actorCount; i++) {
                            // Случайный начальный угол (не равномерное распределение)
                            const baseAngle = (i / actorCount) * Math.PI * 2;
                            const randomOffset = (Math.random() - 0.5) * 0.5; // Случайное смещение до ±0.25 радиан
                            const angle = baseAngle + randomOffset;
                            
                            // Случайная скорость (от 0.5 до 1.5 от базовой скорости)
                            const speedMultiplier = 0.5 + Math.random(); // 0.5 - 1.5
                            const randomSpeed = this.fireflyRotationSpeed * speedMultiplier;
                            
                            // Случайное направление (по часовой или против часовой стрелки)
                            const direction = Math.random() > 0.5 ? 1 : -1;
                            
                            // Создаем светлячка
                            const firefly = this.createFirefly(new THREE.Vector3(0, 0, 0), angle);
                            // Позиция светлячка в локальной системе координат treeGroup
                            // Узел находится в treeGroup на позиции node.position
                            // Светлячок должен быть на орбите вокруг узла
                            const orbitX = Math.cos(angle) * this.fireflyOrbitRadius;
                            const orbitY = 0;
                            const orbitZ = Math.sin(angle) * this.fireflyOrbitRadius;
                            // Позиция = позиция узла + смещение на орбите
                            firefly.position.x = node.position.x + orbitX;
                            firefly.position.y = node.position.y + orbitY;
                            firefly.position.z = node.position.z + orbitZ;
                            
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
            
            this.scene.add(treeGroup);
            this.treeGroups.push(treeGroup);
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
        
        this.currentZoom = Math.min(this.currentZoom + this.zoomStep, this.maxZoom);
        this.updateCameraZoom();
    }
    
    zoomOut() {
        // В режиме детального просмотра зум заблокирован
        if (this.isDetailMode) return;
        
        this.currentZoom = Math.max(this.currentZoom - this.zoomStep, this.minZoom);
        this.updateCameraZoom();
    }
    
    resetZoom() {
        // В режиме детального просмотра зум заблокирован
        if (this.isDetailMode) return;
        
        this.currentZoom = 1;
        this.updateCameraZoom();
    }
    
    updateCameraZoom() {
        
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
            this.camera.position.copy(nodeData.targetCameraPosition);
            this.cameraTarget.copy(nodeData.targetCameraTarget);
            this.camera.lookAt(this.cameraTarget);
            this.camera.updateProjectionMatrix();
            
            // Отмечаем, что позиция камеры уже применена, чтобы анимация не конфликтовала
            nodeData.cameraPositionApplied = true;
            
        } else {
            // Если узла нет, просто обновляем позицию камеры
            this.updateCameraPosition();
        }
    }
    
    setupLayoutControls() {
        const spacingSlider = document.getElementById('spacing-factor');
        const spacingValue = document.getElementById('spacing-value');
        const marginSlider = document.getElementById('level-margin-factor');
        const marginValue = document.getElementById('level-margin-value');
        const level1Slider = document.getElementById('level1-count');
        const level1Value = document.getElementById('level1-value');
        const level2Slider = document.getElementById('level2-count');
        const level2Value = document.getElementById('level2-value');
        const level3Slider = document.getElementById('level3-count');
        const level3Value = document.getElementById('level3-value');
        
        if (spacingSlider && spacingValue) {
            spacingSlider.addEventListener('input', (event) => {
                const value = parseFloat(event.target.value);
                this.spacingFactor = value;
                spacingValue.textContent = value.toFixed(1);
                this.createTrees(4);
            });
        }
        
        if (marginSlider && marginValue) {
            marginSlider.addEventListener('input', (event) => {
                const value = parseFloat(event.target.value);
                this.levelMarginFactor = value;
                marginValue.textContent = value.toFixed(1);
                this.createTrees(4);
            });
        }

        // Инициализация и обработчики для количества узлов по уровням
        if (this.maxNodesPerLevel) {
            if (level1Slider && level1Value) {
                const max1 = this.maxNodesPerLevel[1] ?? 0;
                level1Slider.max = String(max1);
                level1Slider.value = String(this.levelLimits[1] ?? max1);
                level1Value.textContent = String(this.levelLimits[1] ?? max1);
                level1Slider.addEventListener('input', (event) => {
                    const value = parseInt(event.target.value, 10);
                    this.levelLimits[1] = value;
                    level1Value.textContent = String(value);
                    this.createTrees(4);
                });
            }
            if (level2Slider && level2Value) {
                const max2 = this.maxNodesPerLevel[2] ?? 0;
                level2Slider.max = String(max2);
                level2Slider.value = String(this.levelLimits[2] ?? max2);
                level2Value.textContent = String(this.levelLimits[2] ?? max2);
                level2Slider.addEventListener('input', (event) => {
                    const value = parseInt(event.target.value, 10);
                    this.levelLimits[2] = value;
                    level2Value.textContent = String(value);
                    this.createTrees(4);
                });
            }
            if (level3Slider && level3Value) {
                const max3 = this.maxNodesPerLevel[3] ?? 0;
                level3Slider.max = String(max3);
                level3Slider.value = String(this.levelLimits[3] ?? max3);
                level3Value.textContent = String(this.levelLimits[3] ?? max3);
                level3Slider.addEventListener('input', (event) => {
                    const value = parseInt(event.target.value, 10);
                    this.levelLimits[3] = value;
                    level3Value.textContent = String(value);
                    this.createTrees(4);
                });
            }
            // Добавляем слайдер для уровня 4 (серии)
            const level4Slider = document.getElementById('level4-count');
            const level4Value = document.getElementById('level4-value');
            if (level4Slider && level4Value) {
                const max4 = this.maxNodesPerLevel[4] ?? 0;
                level4Slider.max = String(max4);
                level4Slider.value = String(this.levelLimits[4] ?? max4);
                level4Value.textContent = String(this.levelLimits[4] ?? max4);
                level4Slider.addEventListener('input', (event) => {
                    const value = parseInt(event.target.value, 10);
                    this.levelLimits[4] = value;
                    level4Value.textContent = String(value);
                    this.createTrees(4);
                });
            }
            
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
                                    child.geometry = new THREE.SphereGeometry(value * 0.3, 32, 32);
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
                        this.updateDetailModeNodeScale();
                    }
                });
            }
        }
    }
    
    onWindowResize() {
        const width = window.innerWidth;
        const height = window.innerHeight;
        
        this.camera.aspect = width / height;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(width, height);
    }
    
    createFirefly(centerPosition, initialAngle) {
        // Создаем текстуру с радиальным градиентом для эффекта свечения
        const createGlowTexture = (size) => {
            const canvas = document.createElement('canvas');
            canvas.width = size;
            canvas.height = size;
            const context = canvas.getContext('2d');
            
            const centerX = size / 2;
            const centerY = size / 2;
            const radius = size / 2;
            
            // Создаем радиальный градиент
            const gradient = context.createRadialGradient(centerX, centerY, 0, centerX, centerY, radius);
            gradient.addColorStop(0, 'rgba(0, 200, 255, 1)'); // Яркий центр
            gradient.addColorStop(0.3, 'rgba(0, 200, 255, 0.8)');
            gradient.addColorStop(0.6, 'rgba(0, 180, 255, 0.4)');
            gradient.addColorStop(0.8, 'rgba(0, 160, 255, 0.15)');
            gradient.addColorStop(1, 'rgba(0, 160, 255, 0)'); // Прозрачные края
            
            context.fillStyle = gradient;
            context.fillRect(0, 0, size, size);
            
            const texture = new THREE.CanvasTexture(canvas);
            texture.needsUpdate = true;
            return texture;
        };
        
        // Создаем группу для светлячка
        const fireflyGroup = new THREE.Group();
        
        // Ядро - маленькая яркая сфера
        const coreGeometry = new THREE.SphereGeometry(this.fireflySize * 0.3, 32, 32);
        const coreMaterial = new THREE.MeshStandardMaterial({
            color: 0xffffff,
            emissive: 0x00c8ff,
            emissiveIntensity: 5.0,
            metalness: 0.0,
            roughness: 0.0
        });
        const core = new THREE.Mesh(coreGeometry, coreMaterial);
        fireflyGroup.add(core);
        
        // Создаем спрайт с радиальным градиентом для эффекта свечения
        const glowTexture = createGlowTexture(256);
        const glowMaterial = new THREE.SpriteMaterial({
            map: glowTexture,
            transparent: true,
            blending: THREE.AdditiveBlending,
            depthWrite: false
        });
        const glowSprite = new THREE.Sprite(glowMaterial);
        glowSprite.scale.set(this.fireflySize * 4, this.fireflySize * 4, 1);
        fireflyGroup.add(glowSprite);
        
        // Дополнительный слой свечения (больше размером)
        const outerGlowTexture = createGlowTexture(512);
        const outerGlowMaterial = new THREE.SpriteMaterial({
            map: outerGlowTexture,
            transparent: true,
            opacity: 0.6,
            blending: THREE.AdditiveBlending,
            depthWrite: false
        });
        const outerGlowSprite = new THREE.Sprite(outerGlowMaterial);
        outerGlowSprite.scale.set(this.fireflySize * 6, this.fireflySize * 6, 1);
        fireflyGroup.add(outerGlowSprite);
        
        return fireflyGroup;
    }
    
    setupNodeClickHandler() {
        // Обработчик клика уже добавлен в setupMouseControls
        // Здесь только инициализация
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
        // Для узлов 4 уровня (эпизоды) - вход в режим детального просмотра
        if (nodeData.node.level === 3) {
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
                edgeLines.material.color.setHex(0xffff00); // Желтый цвет обводки
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
        console.log('Entering detail mode for episode:', nodeData.node.text);

        this.isDetailMode = true;
        this.detailModeNode = nodeData;

        // Сохраняем исходный зум для восстановления при выходе
        this.detailModeOriginalZoom = this.currentZoom;

        // Сохраняем исходные состояния всех деревьев
        this.detailModeOriginalStates = [];
        this.treeGroups.forEach(treeGroup => {
            this.detailModeOriginalStates.push({
                group: treeGroup,
                originalPosition: treeGroup.position.clone(),
                originalScale: treeGroup.scale.clone(),
                originalOpacity: treeGroup.children.length > 0 ? treeGroup.children[0].material.opacity : 1
            });
        });

        // Блокируем элементы управления зумом
        this.disableZoomControls();

        // Создаем оверлей затемнения
        this.createDetailModeOverlay();

        // Создаем кнопку выхода
        this.createDetailModeExitButton();

        // Анимируем вход в режим
        this.animateDetailModeEnter();
    }

    // Создание оверлея затемнения для режима детального просмотра
    createDetailModeOverlay() {
        // Создаем геометрию плоскости, покрывающей весь экран (очень большую)
        const geometry = new THREE.PlaneGeometry(50000, 50000);

        // Создаем материал с радиальным градиентом (от центра к краям)
        const canvas = document.createElement('canvas');
        canvas.width = 1024;  // Увеличиваем разрешение
        canvas.height = 1024;
        const context = canvas.getContext('2d');

        const centerX = canvas.width / 2;
        const centerY = canvas.height / 2;
        const radius = canvas.width / 2;

        // Создаем более плавный градиент
        const gradient = context.createRadialGradient(centerX, centerY, 0, centerX, centerY, radius);
        gradient.addColorStop(0.0, 'rgba(0, 0, 0, 0.0)');  // Полностью прозрачный центр
        gradient.addColorStop(0.4, 'rgba(0, 0, 0, 0.0)');  // Еще прозрачный
        gradient.addColorStop(0.6, 'rgba(0, 0, 0, 0.1)');  // Начинаем затемнять
        gradient.addColorStop(0.8, 'rgba(0, 0, 0, 0.3)');  // Среднее затемнение
        gradient.addColorStop(1.0, 'rgba(0, 0, 0, 0.6)');  // Темные края

        context.fillStyle = gradient;
        context.fillRect(0, 0, canvas.width, canvas.height);

        const texture = new THREE.CanvasTexture(canvas);
        texture.needsUpdate = true;

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
            
            if (progress === 0) {
                console.log('[DETAIL MODE] Starting hide animation for trees');
                console.log('[DETAIL MODE] Selected mesh:', selectedMesh);
                console.log('[DETAIL MODE] Selected text sprite:', selectedTextSprite);
            }
            
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
                        if (progress === 0 || (progress >= 0.5 && progress < 0.52)) {
                            console.log('[DETAIL MODE] traverse() - Skipping selected firefly, visible:', object.visible, 'opacity:', object.material ? object.material.opacity : 'no material');
                        }
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
                        if (progress === 0 || (progress >= 0.5 && progress < 0.52)) {
                            console.log('[DETAIL MODE] traverse() - Skipping child of selected firefly, visible:', object.visible, 'opacity:', object.material ? object.material.opacity : 'no material');
                        }
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
                    if (progress === 0 || (progress >= 0.5 && progress < 0.52)) {
                        console.log('[DETAIL MODE] Setting firefly', index, 'visibility. visible:', firefly.mesh.visible, 'parent:', firefly.mesh.parent, 'parent.visible:', firefly.mesh.parent ? firefly.mesh.parent.visible : 'no parent');
                    }
                }
            });
            if (progress === 0 || (progress >= 0.5 && progress < 0.52)) {
                console.log('[DETAIL MODE] Fireflies visibility set count:', fireflyVisibilitySetCount, 'for selected node:', selectedNodeId);
            }
            
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
            
            // Логируем состояние в середине анимации
            if (progress >= 0.5 && progress < 0.52) {
                console.log('[DETAIL MODE] Mid-animation - Mesh visible:', selectedMesh.visible);
                console.log('[DETAIL MODE] Mid-animation - Mesh parent visible:', selectedMesh.parent ? selectedMesh.parent.visible : 'no parent');
                console.log('[DETAIL MODE] Mid-animation - Mesh material opacity:', selectedMesh.material ? (Array.isArray(selectedMesh.material) ? selectedMesh.material[0].opacity : selectedMesh.material.opacity) : 'no material');
            }
            
            if (progress === 0) {
                let hiddenCount = 0;
                let visibleCount = 0;
                this.treeGroups.forEach(treeGroup => {
                    treeGroup.traverse((object) => {
                        if (object === selectedMesh || object === selectedTextSprite) {
                            visibleCount++;
                        } else {
                            hiddenCount++;
                        }
                    });
                });
                console.log('[DETAIL MODE] Objects to hide:', hiddenCount);
                console.log('[DETAIL MODE] Objects to keep visible:', visibleCount);
            }

            // Удаляем только светлячки, которые НЕ принадлежат выбранному узлу
            // Светлячки выбранного узла остаются видимыми и продолжают крутиться
            if (progress === 0) {
                const selectedNodeId = nodeData.node.id;
                console.log('[DETAIL MODE] Processing fireflies. Selected node ID:', selectedNodeId);
                console.log('[DETAIL MODE] Total fireflies:', this.fireflies.length);
                let removedCount = 0;
                let keptCount = 0;
                let noParentCount = 0;
                this.fireflies.forEach((firefly, index) => {
                    if (firefly.mesh) {
                        if (firefly.mesh.parent) {
                            // Удаляем только светлячки других узлов
                            if (firefly.nodeId !== selectedNodeId) {
                                firefly.mesh.parent.remove(firefly.mesh);
                                removedCount++;
                            } else {
                                // Светлячки выбранного узла остаются видимыми
                                firefly.mesh.visible = true;
                                keptCount++;
                                console.log('[DETAIL MODE] Kept firefly', index, 'for node', firefly.nodeId, 'visible:', firefly.mesh.visible, 'parent:', firefly.mesh.parent);
                            }
                        } else {
                            noParentCount++;
                            console.log('[DETAIL MODE] Firefly', index, 'has no parent, nodeId:', firefly.nodeId);
                        }
                    } else {
                        console.log('[DETAIL MODE] Firefly', index, 'has no mesh');
                    }
                });
                console.log('[DETAIL MODE] Removed fireflies:', removedCount, 'out of', this.fireflies.length);
                console.log('[DETAIL MODE] Kept fireflies for selected node:', keptCount);
                console.log('[DETAIL MODE] Fireflies without parent:', noParentCount);
            }

            // Увеличиваем и центрируем выбранный узел
            // Вычисляем масштаб на основе процента ширины экрана
            const targetScaleValue = this.calculateDetailModeScale(nodeData);
            const baseScale = nodeData.originalScale || new THREE.Vector3(1, 1, 1);
            const targetScale = baseScale.clone().multiplyScalar(targetScaleValue);
            const currentScale = baseScale.clone().lerp(targetScale, easedProgress);
            nodeData.mesh.scale.copy(currentScale);

            if (progress === 0) {
                console.log('[DETAIL MODE] Node:', nodeData.node.text);
                console.log('[DETAIL MODE] Initial mesh position:', nodeData.mesh.position.clone());
                console.log('[DETAIL MODE] Has text sprite:', !!nodeData.textSprite);
                console.log('[DETAIL MODE] Mesh visible after traverse:', nodeData.mesh.visible);
            }

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

            if (progress >= 0.5 && progress < 0.52) {
                console.log('[DETAIL MODE] Mid-animation mesh position:', nodeData.mesh.position.clone());
                console.log('[DETAIL MODE] Current scale:', currentScale);
            }

            // Показываем оверлей затемнения
            if (this.detailModeOverlay) {
                this.detailModeOverlay.material.opacity = easedProgress * 0.8;
            }

            // Создаем метки актеров в конце анимации
            if (progress >= 0.8 && this.detailModeActorLabels.length === 0) {
                console.log('[DETAIL MODE] Creating actor labels at progress:', progress);
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
                console.log('[DETAIL MODE] Enter animation completed');
                console.log('[DETAIL MODE] Final mesh position:', nodeData.mesh.position.clone());
                console.log('[DETAIL MODE] Overlay opacity:', this.detailModeOverlay ? this.detailModeOverlay.material.opacity : 'N/A');
                console.log('[DETAIL MODE] Actor labels count:', this.detailModeActorLabels.length);
                
                // На всякий случай создаем метки, если их еще нет
                if (this.detailModeActorLabels.length === 0) {
                    console.log('[DETAIL MODE] Creating actor labels at end of animation');
                    this.createActorLabels();
                }
            }
        };

        animate();
    }

    // Выход из режима детального просмотра
    exitDetailMode() {
        console.log('[EXIT MODE] Exiting detail mode');
        console.log('[EXIT MODE] isDetailMode:', this.isDetailMode);
        console.log('[EXIT MODE] detailModeNode:', this.detailModeNode);

        // Запускаем анимацию зума сразу (начинается на 0.5 секунды раньше)
        this.animateZoomRestore();

        // Запускаем анимацию возврата узла через 0.5 секунды
        setTimeout(() => {
            this.animateNodeReturn();
        }, 500);
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
            }
            
            // Убеждаемся, что все дочерние элементы выбранного узла (edgeLines) остаются видимыми
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
            
            // Убеждаемся, что материал выбранного узла остается видимым
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
                this.camera.position.lerp(this.originalCameraPosition, easedProgress * 0.1);
                this.cameraTarget.lerp(this.originalCameraTarget || new THREE.Vector3(0, 0, 0), easedProgress * 0.1);
                this.camera.lookAt(this.cameraTarget);
            }

            if (progress < 1) {
                requestAnimationFrame(animate);
            } else {
                // Очищаем режим
                console.log('[EXIT MODE] Exit animation completed, cleaning up');
                this.cleanupDetailMode();
                console.log('[EXIT MODE] Cleanup completed');
                console.log('[EXIT MODE] isDetailMode after cleanup:', this.isDetailMode);
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

        // Восстанавливаем деревья
        this.detailModeOriginalStates.forEach(state => {
            this.setGroupOpacity(state.group, state.originalOpacity, state.originalOpacity < 1);
        });
        this.detailModeOriginalStates = null;

        // Разблокируем элементы управления зумом
        this.enableZoomControls();

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
        console.log('[ACTOR LABELS] Starting createActorLabels()');
        
        if (!this.detailModeNode) {
            console.warn('[ACTOR LABELS] No detailModeNode!');
            return;
        }

        const nodeData = this.detailModeNode;
        const episodeId = nodeData.node.id;
        console.log('[ACTOR LABELS] Episode ID:', episodeId, 'Name:', nodeData.node.text);

        // Находим актеров для этого эпизода
        const actors = actorsData.filter(actor => actor.parentId === episodeId);
        console.log('[ACTOR LABELS] Found actors count:', actors.length);
        console.log('[ACTOR LABELS] Actors:', actors);

        if (actors.length === 0) {
            // Даже если актеров нет, создаем одну метку "Нет информации"
            actors.push({ text: 'Нет информации об актёрах' });
            console.log('[ACTOR LABELS] No actors found, using placeholder');
        }

        const radius = this.DETAIL_MODE_ACTOR_RADIUS;
        const angleStep = (Math.PI * 2) / actors.length;
        
        console.log('[ACTOR LABELS] Creating labels at radius:', radius);
        console.log('[ACTOR LABELS] Angle step:', angleStep);

        actors.forEach((actor, index) => {
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

            const textWidth = context.measureText(actor.text).width;
            const textHeight = fontSize;

            // Увеличиваем разрешение для четкости
            const scaleFactor = 4;
            canvas.width = (textWidth + 20) * scaleFactor;
            canvas.height = (textHeight + 20) * scaleFactor;
            context.scale(scaleFactor, scaleFactor);
            context.font = `bold ${fontSize}px Arial`;
            context.textAlign = 'center';
            context.textBaseline = 'middle';

            // Рисуем текст с обводкой
            context.fillStyle = '#ffffff';
            context.strokeStyle = '#000000';
            context.lineWidth = 2;
            context.strokeText(actor.text, (textWidth + 20) / 2, (textHeight + 20) / 2);
            context.fillText(actor.text, (textWidth + 20) / 2, (textHeight + 20) / 2);

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
            sprite.scale.set((canvas.width / scaleFactor) * 0.8, (canvas.height / scaleFactor) * 0.8, 1);
            sprite.renderOrder = 2; // Над всем

            this.scene.add(sprite);
            
            console.log('[ACTOR LABELS] Created label', index, 'for:', actor.text, 'at position:', x, y, z);

            this.detailModeActorLabels.push({
                sprite: sprite,
                actor: actor,
                originalPosition: sprite.position.clone()
            });
        });
        
        console.log('[ACTOR LABELS] Total labels created:', this.detailModeActorLabels.length);

        // Анимируем появление меток актеров
        this.animateActorLabelsAppearance();
    }

    // Анимация появления меток актеров
    animateActorLabelsAppearance() {
        console.log('[ACTOR LABELS] Starting appearance animation');
        console.log('[ACTOR LABELS] Labels to animate:', this.detailModeActorLabels.length);
        
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
                console.log('[ACTOR LABELS] Appearance animation completed');
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
    
    animate() {
        requestAnimationFrame(() => this.animate());
        
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
                    console.log('[FIREFLY ANIMATION] Detail mode firefly', index, 'visible:', firefly.mesh.visible, 'position:', firefly.mesh.position, 'orbitRadius:', orbitRadius, 'nodeScale:', nodeScale);
                }
            }
            
            // Позиция = позиция узла + смещение на орбите
            firefly.mesh.position.x = nodePosition.x + orbitX;
            firefly.mesh.position.y = nodePosition.y + orbitY;
            firefly.mesh.position.z = nodePosition.z + orbitZ;
        });
        
        // Периодически логируем состояние светлячков в детальном режиме
        if (this.isDetailMode && detailModeFireflyCount > 0 && Math.floor(Date.now() / 2000) % 3 === 0) {
            console.log('[FIREFLY ANIMATION] Detail mode active, fireflies count:', detailModeFireflyCount);
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
                this.camera.position.lerp(nodeData.targetCameraPosition, this.animationSpeed);
                this.cameraTarget.lerp(nodeData.targetCameraTarget, this.animationSpeed);
                this.camera.lookAt(this.cameraTarget);
            } else {
                // Позиция уже применена, но нужно убедиться, что камера смотрит правильно
                this.camera.lookAt(this.cameraTarget);
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
                    this.camera.position.copy(nodeData.targetCameraPosition);
                    this.cameraTarget.copy(nodeData.targetCameraTarget);
                }
                this.camera.lookAt(this.cameraTarget);
                
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
        
        this.renderer.render(this.scene, this.camera);
    }
}

// Инициализация при загрузке страницы
window.addEventListener('DOMContentLoaded', () => {
    new RadialTreeVisualization('scene-canvas');
});

