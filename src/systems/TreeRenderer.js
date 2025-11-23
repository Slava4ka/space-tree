import * as THREE from 'three';
import { Firefly } from '../objects/Firefly.js';
import { TreeBuilder } from './TreeBuilder.js';
import {
    ROOT_RADIUS,
    NODE_RADIUS,
    DEFAULT_NODE_COLOR,
    ROOT_NODE_COLOR,
    LEVEL_1_COLOR,
    LEVEL_2_COLOR,
    LEVEL_3_COLOR,
    NODE_MATERIAL_COLOR,
    TEXT_COLOR,
    TEXT_STROKE_COLOR,
    TEXT_STROKE_WIDTH,
    TEXT_SCALE_FACTOR,
    TEXT_PADDING,
    SPHERE_SEGMENTS,
    SPHERE_RINGS
} from '../utils/constants.js';

/**
 * Класс для создания и управления визуальными элементами деревьев
 */
export class TreeRenderer {
    constructor(options) {
        this.scene = options.scene;
        this.sceneManager = options.sceneManager;
        this.loadingScreen = options.loadingScreen;
        this.detailModeSystem = options.detailModeSystem || null;
        
        // Параметры
        this.spacingFactor = options.spacingFactor || 1.4;
        this.levelMarginFactor = options.levelMarginFactor || 0.6;
        this.levelLimits = options.levelLimits || {};
        this.graphRotation = options.graphRotation || { x: 0, y: 0, z: 15 };
        this.fireflySize = options.fireflySize || 20;
        this.fireflyOrbitRadius = options.fireflyOrbitRadius || 200;
        this.fireflyRotationSpeed = options.fireflyRotationSpeed || 1;
        
        // Массивы для хранения объектов
        this.nodeMeshes = [];
        this.treeGroups = [];
        this.fireflies = [];
        
        // Границы сцены (для расчета минимального зума)
        this.sceneBounds = null;
        
        // TreeBuilder для построения деревьев
        this.treeBuilder = new TreeBuilder();
        
        // Callbacks для обновления ссылок
        this.onNodeMeshesUpdate = options.onNodeMeshesUpdate || (() => {});
        this.onTreeGroupsUpdate = options.onTreeGroupsUpdate || (() => {});
        this.onFirefliesUpdate = options.onFirefliesUpdate || (() => {});
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
        
        // 6. Очищаем кэш TreeBuilder
        this.treeBuilder.clearCache();
        
        // 7. Вызываем callbacks для обновления ссылок
        this.onNodeMeshesUpdate(this.nodeMeshes);
        this.onTreeGroupsUpdate(this.treeGroups);
        this.onFirefliesUpdate(this.fireflies);
    }

    /**
     * Создание деревьев
     */
    createTrees(data, depth) {
        // Вызываем полную очистку перед созданием новых деревьев
        this.disposeScene();

        // Создаем кэш детей для быстрой фильтрации
        const childrenCache = new Map();
        data.forEach(item => {
            if (!childrenCache.has(item.parentId)) {
                childrenCache.set(item.parentId, []);
            }
            childrenCache.get(item.parentId).push(item);
        });

        // Строим все деревья из данных (тяжелая операция)
        const trees = this.treeBuilder.buildTreesFromData(data, depth, childrenCache);
        
        // Вычисляем радиусы для каждого дерева с учётом текущих параметров
        const treeData = trees.map(({ root, nodes }) => {
            const { root: filteredRoot, nodes: filteredNodes } = this.treeBuilder.filterTreeByLevel(
                root,
                nodes,
                this.levelLimits
            );
            const radius = this.treeBuilder.calculateMaxTreeRadius(filteredRoot, filteredNodes, {
                spacingFactor: this.spacingFactor,
                levelMarginFactor: this.levelMarginFactor,
            });
            return { root: filteredRoot, nodes: filteredNodes, radius };
        });
        
        // Располагаем деревья в виде решетки (сетки)
        const { positions, sceneBounds } = this.calculateTreePositions(treeData);
        this.sceneBounds = sceneBounds;
        
        // Создаем визуальные элементы для каждого дерева
        treeData.forEach(({ root: filteredRoot, nodes: filteredNodes }, treeIndex) => {
            const offset = positions[treeIndex] || new THREE.Vector3(0, 0, 0);
            this.createTreeVisuals(filteredRoot, filteredNodes, offset, childrenCache);
        });

        if (this.loadingScreen) {
            this.loadingScreen.updateProgress(80); // Деревья созданы
        }

        // Отложенное создание светлячков для производительности
        setTimeout(() => {
            this.createFirefliesForTrees(trees, childrenCache);
            if (this.loadingScreen) {
                this.loadingScreen.updateProgress(100); // Светлячки созданы
            }
        }, 100);
    }

    /**
     * Вычисление позиций деревьев в сетке
     */
    calculateTreePositions(treeData) {
        // Обработка пустого массива
        if (!treeData || treeData.length === 0) {
            return {
                positions: [],
                sceneBounds: {
                    maxWidth: 0,
                    maxHeight: 0,
                    maxRadius: 0,
                    maxTreeRadius: 0
                }
            };
        }
        
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
        
        // Вычисляем максимальный радиус сцены (диагональ от центра до самого дальнего угла)
        const maxWidth = totalWidth;
        const maxHeight = totalHeight;
        const maxRadius = Math.sqrt((maxWidth / 2) ** 2 + (maxHeight / 2) ** 2);
        
        // Находим максимальный радиус дерева для учета высоты
        const maxTreeRadius = Math.max(...treeData.map(({ radius }) => radius), 0);
        
        // Итоговый максимальный радиус = радиус сетки + радиус самого большого дерева
        const finalMaxRadius = maxRadius + maxTreeRadius;
        
        return {
            positions,
            sceneBounds: {
                maxWidth,
                maxHeight,
                maxRadius: finalMaxRadius,
                maxTreeRadius
            }
        };
    }

    /**
     * Создание визуальных элементов для одного дерева
     */
    createTreeVisuals(root, nodes, offset, childrenCache) {
        // Вычисляем позиции с учётом смещения для этого дерева
        this.treeBuilder.calculatePositions(root, nodes, {
            spacingFactor: this.spacingFactor,
            levelMarginFactor: this.levelMarginFactor,
            offset: offset,
        });
        
        // Создаем группу для дерева
        const treeGroup = new THREE.Group();
        
        // Создаем линии (связи)
        nodes.forEach(node => {
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
        
        // Создаем сферы (вершины) и текст
        nodes.forEach(node => {
            this.createNodeVisuals(node, treeGroup, childrenCache);
        });
        
        // Применяем вращение графа по всем осям
        treeGroup.rotation.x = (this.graphRotation.x * Math.PI) / 180;
        treeGroup.rotation.y = (this.graphRotation.y * Math.PI) / 180;
        treeGroup.rotation.z = (this.graphRotation.z * Math.PI) / 180;
        
        this.sceneManager.add(treeGroup);
        this.treeGroups.push(treeGroup);
    }

    /**
     * Создание визуальных элементов для одного узла
     */
    createNodeVisuals(node, treeGroup, childrenCache) {
        const isRoot = node.level === 0;
        const radius = this.treeBuilder.getNodeRadius(node, isRoot);
        
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
                LEVEL_1_COLOR, // Синий для уровня 1
                LEVEL_2_COLOR, // Фиолетовый для уровня 2
                LEVEL_3_COLOR, // Бирюзовый для уровня 3
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
        
        // Создаем текст на узле
        let textSprite = null;
        if (node.text) {
            textSprite = this.createTextSprite(node, isRoot, radius);
            treeGroup.add(textSprite);
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
            textSprite: textSprite
        });
        
        // Создаем светлячков для узлов уровня 1 (задач)
        if (node.level === 1) {
            this.createFirefliesForNode(node, treeGroup, childrenCache);
        }
    }

    /**
     * Создание текстового спрайта для узла
     */
    createTextSprite(node, isRoot, radius) {
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        
        // Размер шрифта зависит от уровня
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
        
        // Рисуем текст с обводкой
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
        sprite.position.y += radius + 90;
        sprite.scale.set((canvas.width / TEXT_SCALE_FACTOR) * 1.5, (canvas.height / TEXT_SCALE_FACTOR) * 1.5, 1);
        sprite.renderOrder = 1; // Текст всегда поверх сфер
        
        return sprite;
    }

    /**
     * Создание светлячков для узла уровня 1
     */
    createFirefliesForNode(node, treeGroup, childrenCache) {
        // Находим все технологии (дети уровня 2) для этой задачи
        const technologies = childrenCache.get(node.id) || [];
        const technologyCount = technologies.length;
        
        // Создаем светлячков только если есть технологии
        const maxFirefliesPerTask = 20; // Максимум 20 светлячков на задачу
        const actualFireflyCount = Math.min(technologyCount, maxFirefliesPerTask);

        if (actualFireflyCount > 0) {
            for (let i = 0; i < actualFireflyCount; i++) {
                // Случайный начальный угол
                const baseAngle = (i / technologyCount) * Math.PI * 2;
                const randomOffset = (Math.random() - 0.5) * 0.5;
                const angle = baseAngle + randomOffset;
                
                // Случайная скорость
                const speedMultiplier = 0.5 + Math.random();
                const randomSpeed = this.fireflyRotationSpeed * speedMultiplier;
                
                // Случайное направление
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
                    mesh: firefly,
                    nodeId: node.id,
                    nodePosition: node.position.clone(),
                    angle: angle,
                    speed: randomSpeed * direction
                });
                
                // Добавляем светлячка в treeGroup
                treeGroup.add(firefly);
            }
        }
    }

    /**
     * Создание одного светлячка
     */
    createFirefly(centerPosition, initialAngle) {
        const firefly = new Firefly(centerPosition, initialAngle, this.fireflySize);
        firefly.setOrbitRadius(this.fireflyOrbitRadius);
        firefly.setSpeed(this.fireflyRotationSpeed);
        return firefly.mesh;
    }

    /**
     * Отдельный метод для создания светлячков (заглушка, если нужна дополнительная логика)
     */
    createFirefliesForTrees(trees, childrenCache) {
        // Метод оставлен для совместимости, основная логика в createFirefliesForNode
        trees.forEach(({ root, nodes }) => {
            const filteredNodes = nodes.filter(node => node.level !== 2);
            // Дополнительная логика если нужна
        });
    }

    /**
     * Обновить параметры
     */
    updateParams(params) {
        if (params.spacingFactor !== undefined) this.spacingFactor = params.spacingFactor;
        if (params.levelMarginFactor !== undefined) this.levelMarginFactor = params.levelMarginFactor;
        if (params.levelLimits !== undefined) this.levelLimits = params.levelLimits;
        if (params.graphRotation !== undefined) this.graphRotation = params.graphRotation;
        if (params.fireflySize !== undefined) this.fireflySize = params.fireflySize;
        if (params.fireflyOrbitRadius !== undefined) this.fireflyOrbitRadius = params.fireflyOrbitRadius;
        if (params.fireflyRotationSpeed !== undefined) this.fireflyRotationSpeed = params.fireflyRotationSpeed;
    }

    /**
     * Получить ссылки на массивы
     */
    getReferences() {
        return {
            nodeMeshes: this.nodeMeshes,
            treeGroups: this.treeGroups,
            fireflies: this.fireflies
        };
    }

    /**
     * Получить границы сцены (для расчета минимального зума)
     */
    getSceneBounds() {
        return this.sceneBounds;
    }
}

