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
    }
    
    setupMouseControls() {
        // cameraDistance уже установлен в init()
        
        // Обработка нажатия мыши
        this.container.addEventListener('mousedown', (event) => {
            if (event.button === 0) { // Левая кнопка мыши
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
        console.log(`Дерево ${treeIndex}: узлов уровня 3 = ${level3Nodes.length}, всего светлячков = ${totalFirefliesForTree}`);
        
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
            
            // Добавляем обводку (Edges)
            const edges = new THREE.EdgesGeometry(geometry);
            const edgeMaterial = new THREE.LineBasicMaterial({
                    color: isRoot ? 0xffffff : 0xffffff,
                opacity: 0.3,
                transparent: true
            });
            const edgeLines = new THREE.LineSegments(edges, edgeMaterial);
            sphere.add(edgeLines);
            
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
                
                // Устанавливаем размер canvas с отступами
                canvas.width = textWidth + 20;
                canvas.height = textHeight + 20;
                
                // Перерисовываем текст
                    context.fillStyle = '#ffffff';
                    context.strokeStyle = '#000000';
                context.lineWidth = 3;
                context.font = `bold ${fontSize}px Arial`;
                context.textAlign = 'center';
                context.textBaseline = 'middle';
                
                // Рисуем текст с обводкой
                context.strokeText(node.text, canvas.width / 2, canvas.height / 2);
                context.fillText(node.text, canvas.width / 2, canvas.height / 2);
                
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
                    sprite.scale.set(canvas.width * 1.5, canvas.height * 1.5, 1); // Увеличено в 3 раза (0.5 * 3)
                    
                    treeGroup.add(sprite);
                }
                
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
        
        console.log(`Всего создано светлячков: ${this.fireflies.length}`);
        console.log(`Проверка: должно быть 75+126+57+141 = ${75+126+57+141}`);
    }
    
    setupZoomControls() {
        const zoomInBtn = document.getElementById('zoom-in');
        const zoomOutBtn = document.getElementById('zoom-out');
        const zoomResetBtn = document.getElementById('zoom-reset');
        
        zoomInBtn.addEventListener('click', () => this.zoomIn());
        zoomOutBtn.addEventListener('click', () => this.zoomOut());
        zoomResetBtn.addEventListener('click', () => this.resetZoom());
        
        // Колесико мыши для зума
        this.container.addEventListener('wheel', (event) => {
            event.preventDefault();
            if (event.deltaY < 0) {
                this.zoomIn();
            } else {
                this.zoomOut();
            }
        });
    }
    
    zoomIn() {
        this.currentZoom = Math.min(this.currentZoom + this.zoomStep, this.maxZoom);
        this.updateCameraZoom();
    }
    
    zoomOut() {
        this.currentZoom = Math.max(this.currentZoom - this.zoomStep, this.minZoom);
        this.updateCameraZoom();
    }
    
    resetZoom() {
        this.currentZoom = 1;
        this.updateCameraZoom();
    }
    
    updateCameraZoom() {
        // Обновляем позицию камеры с учётом зума
        this.updateCameraPosition();
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
    
    animate() {
        requestAnimationFrame(() => this.animate());
        
        // Обновляем позиции светлячков
        this.fireflies.forEach(firefly => {
            // Обновляем угол с учетом скорости
            firefly.angle += firefly.speed * 0.01;
            
            // Вычисляем новую позицию на орбите в локальной системе координат treeGroup
            // Орбита в горизонтальной плоскости XZ (локальная относительно узла)
            const orbitX = Math.cos(firefly.angle) * this.fireflyOrbitRadius;
            const orbitY = 0; // На уровне узла
            const orbitZ = Math.sin(firefly.angle) * this.fireflyOrbitRadius;
            
            // Позиция = позиция узла + смещение на орбите
            firefly.mesh.position.x = firefly.nodePosition.x + orbitX;
            firefly.mesh.position.y = firefly.nodePosition.y + orbitY;
            firefly.mesh.position.z = firefly.nodePosition.z + orbitZ;
        });
        
        this.renderer.render(this.scene, this.camera);
    }
}

// Инициализация при загрузке страницы
window.addEventListener('DOMContentLoaded', () => {
    new RadialTreeVisualization('scene-canvas');
});

