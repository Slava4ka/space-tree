import * as THREE from 'three';
import { TreeNode } from './mockData.js';
import { mockData } from './mockData.js';

// Константы
const ROOT_RADIUS = 75;  // Радиус корневого узла
const NODE_RADIUS = 45;  // Радиус обычных узлов
const H_STEP = 50;       // Вертикальный шаг (на будущее, сейчас не используется)

// Преобразование статического массива данных в структуру TreeNode
function buildTreeFromData(data, maxDepth) {
    const nodeMap = new Map();
    const nodes = [];
    let root = null;
    
    // Создаем все узлы
    data.forEach(item => {
        const node = new TreeNode(item.id, null, 0);
        node.text = item.text;
        nodeMap.set(item.id, { node, parentId: item.parentId });
        
        if (item.parentId === null) {
            root = node;
        }
    });
    
    // Вычисляем уровни рекурсивно
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
    
    // Вычисляем уровни начиная с корня
    if (root) {
        calculateLevel(root.id, 0);
    }
    
    // Устанавливаем связи и добавляем узлы в список
    nodeMap.forEach((item, nodeId) => {
        if (item.node.level <= maxDepth) {
            nodes.push(item.node);
            
            if (item.parentId !== null) {
                const parentItem = nodeMap.get(item.parentId);
                if (parentItem && parentItem.node.level < maxDepth) {
                    item.node.parent = parentItem.node;
                    parentItem.node.children.push(item.node);
                }
            }
        }
    });
    
    return { root, nodes };
}

// Получить радиус узла
function getNodeRadius(node) {
    return node.id === 0 ? ROOT_RADIUS : NODE_RADIUS;
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
 * Считаем максимальное количество узлов на каждом уровне для исходного дерева.
 */
function computeMaxNodesPerLevel(maxDepth) {
    const { root, nodes } = buildTreeFromData(mockData, maxDepth);
    const levels = groupNodesByLevel(nodes);
    const result = {};
    levels.forEach((levelNodes, level) => {
        result[level] = levelNodes.length;
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
 * Вычисляем позиции узлов по радиальному layout.
 * Параметры:
 *  - spacingFactor: множитель для желаемого расстояния между соседями на уровне (в диаметрах),
 *  - levelMarginFactor: множитель дополнительного радиального зазора между уровнями (в диаметрах).
 */
function calculatePositions(root, nodes, config) {
    const spacingFactor = config?.spacingFactor ?? 1.4;       // 1–2
    const levelMarginFactor = config?.levelMarginFactor ?? 0.6; // 0–2
    
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
            radii[level] = radii[level - 1] + baseRadialMargin;
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
    
    // 4. Присваиваем позиции
    nodes.forEach((node) => {
        if (node.level === 0) {
            node.position.set(0, 0, 0);
            return;
        }
        const r = radii[node.level];
        const angle = node.angle ?? 0;
        const x = r * Math.cos(angle);
        const z = r * Math.sin(angle);
        node.position.set(x, 0, z);
    });
}

// Создание визуализации дерева
class RadialTreeVisualization {
    constructor(containerId) {
        this.container = document.getElementById(containerId);
        this.scene = new THREE.Scene();
        this.camera = null;
        this.renderer = null;
        this.treeGroup = null;
        
        // Параметры layout'а (управляются слайдерами)
        this.spacingFactor = 1.4;       // множитель для расстояния по окружности (1–2 диаметров)
        this.levelMarginFactor = 0.6;   // множитель для радиального зазора между уровнями
        this.maxNodesPerLevel = computeMaxNodesPerLevel(3);
        this.levelLimits = {
            1: this.maxNodesPerLevel[1] ?? 0,
            2: this.maxNodesPerLevel[2] ?? 0,
            3: this.maxNodesPerLevel[3] ?? 0,
        };
        
        // Параметры зума
        this.initialCameraDistance = 640; // sqrt(400^2 + 500^2)
        this.currentZoom = 1;
        this.minZoom = 0.2;
        this.maxZoom = 3;
        this.zoomStep = 0.2;
        
        this.init();
        this.createTree(3); // Фиксированная глубина 3 уровня
        this.setupZoomControls();
        this.setupLayoutControls();
        this.animate();
    }
    
    init() {
        // Создание камеры
        const width = window.innerWidth;
        const height = window.innerHeight;
        
        this.camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 10000);
        // Камера сверху под углом для лучшего обзора
        this.camera.position.set(0, 400, 500);
        this.camera.lookAt(0, 0, 0);
        
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
    }
    
    createTree(depth) {
        // Удаляем старое дерево
        if (this.treeGroup) {
            this.scene.remove(this.treeGroup);
            this.treeGroup.traverse((child) => {
                if (child.geometry) child.geometry.dispose();
                if (child.material) {
                    if (Array.isArray(child.material)) {
                        child.material.forEach(m => m.dispose());
                    } else {
                        child.material.dispose();
                    }
                }
            });
        }
        
        // Строим дерево из статических данных
        const { root, nodes } = buildTreeFromData(mockData, depth);
        const { root: filteredRoot, nodes: filteredNodes } = filterTreeByLevel(
            root,
            nodes,
            this.levelLimits
        );
        
        // Вычисляем позиции с учётом параметров layout'а
        calculatePositions(filteredRoot, filteredNodes, {
            spacingFactor: this.spacingFactor,
            levelMarginFactor: this.levelMarginFactor,
        });
        
        // Создаем группу для дерева
        this.treeGroup = new THREE.Group();
        
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
                this.treeGroup.add(line);
            }
        });
        
        // Создаем сферы (вершины)
        filteredNodes.forEach(node => {
            const isRoot = node.id === 0;
            const radius = getNodeRadius(node);
            
            const geometry = new THREE.SphereGeometry(radius, 32, 32);
            
            let material;
            if (isRoot) {
                // Корень - жёлто-оранжевый с эмиссией
                material = new THREE.MeshStandardMaterial({
                    color: 0xffa500,
                    emissive: 0xff8800,
                    emissiveIntensity: 0.5,
                    metalness: 0.3,
                    roughness: 0.2
                });
            } else {
                // Обычные узлы - синие
                material = new THREE.MeshStandardMaterial({
                    color: 0x4a90e2,
                    metalness: 0.5,
                    roughness: 0.5
                });
            }
            
            const sphere = new THREE.Mesh(geometry, material);
            sphere.position.copy(node.position);
            this.treeGroup.add(sphere);
            
            // Добавляем обводку (Edges)
            const edges = new THREE.EdgesGeometry(geometry);
            const edgeMaterial = new THREE.LineBasicMaterial({
                color: isRoot ? 0xffaa00 : 0xffffff,
                opacity: 0.3,
                transparent: true
            });
            const edgeLines = new THREE.LineSegments(edges, edgeMaterial);
            sphere.add(edgeLines);
            
            // Добавляем текст на узле
            if (node.text) {
                const canvas = document.createElement('canvas');
                const context = canvas.getContext('2d');
                const fontSize = isRoot ? 24 : 16;
                context.font = `bold ${fontSize}px Arial`;
                
                // Измеряем текст
                const metrics = context.measureText(node.text);
                const textWidth = metrics.width;
                const textHeight = fontSize;
                
                // Устанавливаем размер canvas с отступами
                canvas.width = textWidth + 20;
                canvas.height = textHeight + 20;
                
                // Перерисовываем текст
                context.fillStyle = isRoot ? '#ffffff' : '#ffffff';
                context.strokeStyle = isRoot ? '#000000' : '#000000';
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
                sprite.position.y += radius + 30;
                sprite.scale.set(canvas.width * 0.5, canvas.height * 0.5, 1);
                
                this.treeGroup.add(sprite);
            }
        });
        
        // Наклоняем граф по оси Z для лучшего обзора (вращение вокруг оси Z)
        this.treeGroup.rotation.z = Math.PI / 12; // Наклон на 15 градусов
        
        this.scene.add(this.treeGroup);
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
        // Изменяем расстояние камеры от центра, сохраняя направление
        const targetDistance = this.initialCameraDistance / this.currentZoom;
        
        // Текущий вектор направления (нормализованный)
        const direction = new THREE.Vector3(0, 400, 500).normalize();
        
        // Новая позиция камеры
        this.camera.position.copy(direction.multiplyScalar(targetDistance));
        this.camera.lookAt(0, 0, 0);
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
                this.createTree(3);
            });
        }
        
        if (marginSlider && marginValue) {
            marginSlider.addEventListener('input', (event) => {
                const value = parseFloat(event.target.value);
                this.levelMarginFactor = value;
                marginValue.textContent = value.toFixed(1);
                this.createTree(3);
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
                    this.createTree(3);
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
                    this.createTree(3);
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
                    this.createTree(3);
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
    
    animate() {
        requestAnimationFrame(() => this.animate());
        this.renderer.render(this.scene, this.camera);
    }
}

// Инициализация при загрузке страницы
window.addEventListener('DOMContentLoaded', () => {
    new RadialTreeVisualization('scene-canvas');
});

