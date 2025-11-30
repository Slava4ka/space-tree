import * as THREE from 'three';
import { Firefly } from '../objects/Firefly.js';
import { TreeBuilder } from './TreeBuilder.js';
import {
    ROOT_RADIUS,
    NODE_RADIUS,
    ROOT_TEXT_SIZE,
    NODE_TEXT_SIZE,
    DEFAULT_NODE_COLOR,
    ROOT_COLOR,
    LEVEL_1_COLOR,
    LEVEL_2_COLOR,
    LEVEL_3_COLOR,
    TEXT_COLOR,
    TEXT_STROKE_COLOR,
    TEXT_STROKE_WIDTH,
    TEXT_SCALE_FACTOR,
    TEXT_PADDING,
    TEXT_OFFSET_Y,
    SPHERE_SEGMENTS,
    SPHERE_RINGS,
    CAMERA_MIN_ZOOM,
    CAMERA_ZOOM_STEPS
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
        this.cameraManager = options.cameraManager || null;
        
        // Параметры
        this.spacingFactor = options.spacingFactor || 1.4;
        this.levelMarginFactor = options.levelMarginFactor || 0.6;
        this.levelLimits = options.levelLimits || {};
        this.graphRotation = options.graphRotation || { x: 0, y: 0, z: 15 };
        this.fireflySize = options.fireflySize || 20;
        this.fireflyOrbitRadius = options.fireflyOrbitRadius || 200;
        this.fireflyRotationSpeed = options.fireflyRotationSpeed || 1;
        this.rootRadius = options.rootRadius || ROOT_RADIUS;
        this.nodeRadius = options.nodeRadius || NODE_RADIUS;
        this.rootTextSize = options.rootTextSize || ROOT_TEXT_SIZE;
        this.nodeTextSize = options.nodeTextSize || NODE_TEXT_SIZE;
        this.maxWordsPerLine = options.maxWordsPerLine || 5;
        
        // Массивы для хранения объектов
        this.nodeMeshes = [];
        this.treeGroups = [];
        this.fireflies = [];
        
        // Границы сцены (для расчета минимального зума)
        this.sceneBounds = null;
        
        // TreeBuilder для построения деревьев
        this.treeBuilder = new TreeBuilder(this.rootRadius, this.nodeRadius);
        
        // Callbacks для обновления ссылок
        this.onNodeMeshesUpdate = options.onNodeMeshesUpdate || (() => {});
        this.onTreeGroupsUpdate = options.onTreeGroupsUpdate || (() => {});
        this.onFirefliesUpdate = options.onFirefliesUpdate || (() => {});
        
        // Кэш материалов для оптимизации
        this.materialCache = {
            rootNode: null,
            rootGlowShell: null,
            regularGlowShell: null
        };
        
        // Кэш геометрий сетки для оптимизации (ключ: "segments_rings")
        this.wireframeGeometryCache = new Map();
    }

    /**
     * Очистка кэша материалов
     */
    disposeMaterialCache() {
        // Очищаем кэш материалов
        if (this.materialCache.rootNode) {
            this.materialCache.rootNode.dispose();
            this.materialCache.rootNode = null;
        }
        if (this.materialCache.rootGlowShell) {
            this.materialCache.rootGlowShell.dispose();
            this.materialCache.rootGlowShell = null;
        }
        if (this.materialCache.regularGlowShell) {
            this.materialCache.regularGlowShell.dispose();
            this.materialCache.regularGlowShell = null;
        }
    }

    /**
     * Очистка кэша геометрий сетки
     */
    disposeWireframeGeometryCache() {
        if (this.wireframeGeometryCache) {
            this.wireframeGeometryCache.forEach(geometry => {
                geometry.dispose();
            });
            this.wireframeGeometryCache.clear();
        }
    }

    /**
     * Полная очистка сцены перед пересозданием
     * Освобождает все Three.js ресурсы для предотвращения утечек памяти
     */
    disposeScene() {
        // Очищаем кэш материалов
        this.disposeMaterialCache();
        
        // Очищаем кэш геометрий сетки
        this.disposeWireframeGeometryCache();
        
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
                rootRadius: this.rootRadius,
                nodeRadius: this.nodeRadius
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
        const gap = this.rootRadius; // Расстояние между краями деревьев
        
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
            rootRadius: this.rootRadius,
            nodeRadius: this.nodeRadius
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
     * Общий шейдер для светящихся оболочек (оптимизация - один шейдер для всех типов)
     */
    static GLOW_SHELL_VERTEX_SHADER = `
        varying vec3 vNormal;
        varying vec3 vPosition;
        varying vec3 vWorldPosition;
        
        void main() {
            vNormal = normalize(normalMatrix * normal);
            vPosition = position;
            vec4 worldPos = modelMatrix * vec4(position, 1.0);
            vWorldPosition = worldPos.xyz;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
    `;

    static GLOW_SHELL_FRAGMENT_SHADER = `
        uniform vec3 glowColor;
        varying vec3 vNormal;
        varying vec3 vPosition;
        varying vec3 vWorldPosition;
        
        void main() {
            // Нормализуем позицию для определения полюсов
            vec3 normalizedPos = normalize(vPosition);
            
            // Вычисляем близость к полюсам (0 на экваторе, 1 на полюсах)
            float polarIntensity = abs(normalizedPos.y);
            polarIntensity = pow(polarIntensity, 3.0);
            
            // Эффект Френеля для свечения по краям
            vec3 viewDirection = normalize(cameraPosition - vWorldPosition);
            float fresnel = 1.0 - max(0.0, dot(vNormal, viewDirection));
            fresnel = pow(fresnel, 3.0);
            
            // Комбинируем эффекты для оболочки
            float glowIntensity = polarIntensity * fresnel * 2.0;
            
            vec3 finalColor = glowColor * glowIntensity;
            
            gl_FragColor = vec4(finalColor, glowIntensity * 0.8);
        }
    `;

    static ROOT_GLOW_SHELL_FRAGMENT_SHADER = `
        uniform vec3 glowColor;
        varying vec3 vNormal;
        varying vec3 vPosition;
        varying vec3 vWorldPosition;
        
        void main() {
            // Нормализуем позицию для определения полюсов
            vec3 normalizedPos = normalize(vPosition);
            
            // Вычисляем близость к полюсам (0 на экваторе, 1 на полюсах)
            float polarIntensity = abs(normalizedPos.y);
            polarIntensity = pow(polarIntensity, 3.0);
            
            // Эффект Френеля для свечения по краям
            vec3 viewDirection = normalize(cameraPosition - vWorldPosition);
            float fresnel = 1.0 - max(0.0, dot(vNormal, viewDirection));
            fresnel = pow(fresnel, 2.5);
            
            // Комбинируем эффекты для оболочки с очень ярким свечением
            float glowIntensity = (polarIntensity + fresnel) * 3.0;
            
            // Яркий неоновый пурпурный цвет
            vec3 finalColor = glowColor * glowIntensity;
            
            gl_FragColor = vec4(finalColor, glowIntensity * 0.6);
        }
    `;

    /**
     * Создание материала для светящейся оболочки (с кэшированием)
     * @param {number} glowColor - Цвет свечения в hex формате
     * @param {boolean} isRoot - Является ли оболочка для корневого узла
     */
    createGlowShellMaterial(glowColor = LEVEL_1_COLOR, isRoot = false) {
        const cacheKey = isRoot ? 'rootGlowShell' : 'regularGlowShell';
        
        // Используем кэш, если материал уже создан
        if (this.materialCache[cacheKey]) {
            // Обновляем цвет, если он изменился
            if (this.materialCache[cacheKey].uniforms.glowColor.value.getHex() !== glowColor) {
                this.materialCache[cacheKey].uniforms.glowColor.value.setHex(glowColor);
            }
            return this.materialCache[cacheKey];
        }
        
        // Создаем новый материал
        const material = new THREE.ShaderMaterial({
            uniforms: {
                glowColor: { value: new THREE.Color(glowColor) },
            },
            vertexShader: TreeRenderer.GLOW_SHELL_VERTEX_SHADER,
            fragmentShader: isRoot 
                ? TreeRenderer.ROOT_GLOW_SHELL_FRAGMENT_SHADER 
                : TreeRenderer.GLOW_SHELL_FRAGMENT_SHADER,
            transparent: true,
            side: THREE.DoubleSide,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
        });
        
        // Сохраняем в кэш
        this.materialCache[cacheKey] = material;
        
        return material;
    }

    /**
     * Создание материала для корневого узла (с кэшированием)
     */
    createRootNodeMaterial() {
        // Используем кэш, если материал уже создан
        if (this.materialCache.rootNode) {
            return this.materialCache.rootNode;
        }
        
        // Создаем новый материал с цветом для root узлов
        const rootColor = ROOT_COLOR; // Используем специальный цвет для root узлов
        const material = new THREE.MeshStandardMaterial({
            color: rootColor,
            emissive: rootColor,
            emissiveIntensity: 0.6, // Та же интенсивность, что и у дочерних узлов
            metalness: 0.2,
            roughness: 0.3,
            transparent: false,
        });
        
        // Сохраняем в кэш
        this.materialCache.rootNode = material;
        
        return material;
    }

    /**
     * Создание геометрии сетки сферы без диагональных линий (с кэшированием)
     * Создает только горизонтальные (параллели) и вертикальные (меридианы) линии
     * @param {number} radius - Радиус сферы
     * @param {number} segments - Количество вертикальных линий (меридианов)
     * @param {number} rings - Количество горизонтальных колец (параллелей)
     * @returns {THREE.BufferGeometry} Геометрия для LineSegments
     */
    createSphereWireframeGeometry(radius, segments, rings) {
        // Кэшируем геометрию по параметрам segments и rings (радиус применяется через scale)
        const cacheKey = `${segments}_${rings}`;
        
        // Проверяем кэш
        if (this.wireframeGeometryCache.has(cacheKey)) {
            const cachedGeometry = this.wireframeGeometryCache.get(cacheKey);
            // Клонируем геометрию и применяем масштаб для радиуса
            const geometry = cachedGeometry.clone();
            geometry.scale(radius, radius, radius);
            return geometry;
        }
        
        // Предвычисляем тригонометрические значения для оптимизации
        const phiValues = [];
        const sinPhiValues = [];
        const cosPhiValues = [];
        for (let ring = 0; ring <= rings; ring++) {
            const phi = (ring / rings) * Math.PI;
            phiValues.push(phi);
            sinPhiValues.push(Math.sin(phi));
            cosPhiValues.push(Math.cos(phi));
        }
        
        const thetaStep = (Math.PI * 2) / segments;
        const thetaValues = [];
        const cosThetaValues = [];
        const sinThetaValues = [];
        for (let seg = 0; seg <= segments; seg++) {
            const theta = seg * thetaStep;
            thetaValues.push(theta);
            cosThetaValues.push(Math.cos(theta));
            sinThetaValues.push(Math.sin(theta));
        }
        
        // Вычисляем размер массива заранее для оптимизации
        // Параллели: (rings + 1) * segments * 2 точек (начало и конец каждой линии)
        // Меридианы: segments * rings * 2 точек
        const totalLines = (rings + 1) * segments + segments * rings;
        const positions = new Float32Array(totalLines * 6); // 6 значений на линию (2 точки * 3 координаты)
        let positionIndex = 0;
        
        // Горизонтальные линии (параллели) - кольца вокруг сферы
        // Каждое кольцо - это замкнутая линия по окружности
        for (let ring = 0; ring <= rings; ring++) {
            const sinPhi = sinPhiValues[ring];
            const cosPhi = cosPhiValues[ring];
            
            // Создаем замкнутое кольцо: каждая точка соединяется со следующей
            for (let seg = 0; seg < segments; seg++) {
                // Текущая точка
                const cosTheta1 = cosThetaValues[seg];
                const sinTheta1 = sinThetaValues[seg];
                positions[positionIndex++] = sinPhi * cosTheta1; // x1
                positions[positionIndex++] = cosPhi; // y1
                positions[positionIndex++] = sinPhi * sinTheta1; // z1
                
                // Следующая точка
                const cosTheta2 = cosThetaValues[seg + 1];
                const sinTheta2 = sinThetaValues[seg + 1];
                positions[positionIndex++] = sinPhi * cosTheta2; // x2
                positions[positionIndex++] = cosPhi; // y2
                positions[positionIndex++] = sinPhi * sinTheta2; // z2
            }
        }
        
        // Вертикальные линии (меридианы) - линии от полюса к полюсу
        // Каждый меридиан - это линия от северного полюса к южному
        for (let seg = 0; seg < segments; seg++) {
            const cosTheta = cosThetaValues[seg];
            const sinTheta = sinThetaValues[seg];
            
            // Создаем меридиан: каждая точка соединяется со следующей по вертикали
            for (let ring = 0; ring < rings; ring++) {
                // Текущая точка
                const sinPhi1 = sinPhiValues[ring];
                const cosPhi1 = cosPhiValues[ring];
                positions[positionIndex++] = sinPhi1 * cosTheta; // x1
                positions[positionIndex++] = cosPhi1; // y1
                positions[positionIndex++] = sinPhi1 * sinTheta; // z1
                
                // Следующая точка (выше по меридиану)
                const sinPhi2 = sinPhiValues[ring + 1];
                const cosPhi2 = cosPhiValues[ring + 1];
                positions[positionIndex++] = sinPhi2 * cosTheta; // x2
                positions[positionIndex++] = cosPhi2; // y2
                positions[positionIndex++] = sinPhi2 * sinTheta; // z2
            }
        }
        
        // Создаем геометрию с единичным радиусом (радиус применяется через scale)
        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
        
        // Сохраняем в кэш с единичным радиусом
        this.wireframeGeometryCache.set(cacheKey, geometry);
        
        // Клонируем и применяем масштаб для текущего радиуса
        const scaledGeometry = geometry.clone();
        scaledGeometry.scale(radius, radius, radius);
        
        return scaledGeometry;
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
            // Корневые узлы - фиолетово-неоновый градиент
            material = this.createRootNodeMaterial();
        } else {
            // Обычные узлы - цвет зависит от уровня
            const levelColors = [
                LEVEL_1_COLOR, // Голубой для уровня 1
                LEVEL_2_COLOR, // Синий для уровня 2
                LEVEL_3_COLOR, // Светло-голубой для уровня 3
            ];
            const levelColor = levelColors[node.level - 1] || DEFAULT_NODE_COLOR;
            material = new THREE.MeshStandardMaterial({
              color: levelColor,
              emissive: levelColor, // Все ноды светятся
              emissiveIntensity: isRoot ? 0.8 : 0.6, // Увеличена интенсивность свечения
              metalness: 0.2,
              roughness: 0.3,
              transparent: true,
              opacity: 0.5,
            });
            // Помечаем материал как всегда прозрачный (только для обычных узлов)
            material.userData.alwaysTransparent = true;
        }
        
        const sphere = new THREE.Mesh(geometry, material);
        sphere.position.copy(node.position);
        sphere.renderOrder = 100; // Узлы ниже текста
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
        sphere.userData.rotationSpeed = 0.2 + Math.random() * 0.3;

        // Добавляем частую неоновую сетку на ноду - вращается вместе со сферой
        // Создаем сетку только из горизонтальных и вертикальных линий (без диагоналей)
        const wireframeRadius = radius * 1.01; // Чуть больше радиуса для видимости
        const wireframeSegments = SPHERE_SEGMENTS * 4; // Количество вертикальных линий (меридианов)
        const wireframeRings = SPHERE_RINGS * 2; // Количество горизонтальных колец (параллелей)
        
        const wireframeGeometry = this.createSphereWireframeGeometry(
            wireframeRadius,
            wireframeSegments,
            wireframeRings
        );
        
        const levelColors = [
            LEVEL_1_COLOR, // Синий для уровня 1
            LEVEL_2_COLOR, // Фиолетовый для уровня 2
            LEVEL_3_COLOR, // Бирюзовый для уровня 3
        ];
        const levelColor = levelColors[node.level - 1] || DEFAULT_NODE_COLOR;
        
        const wireMaterial = new THREE.LineBasicMaterial({
            color: levelColor,
            opacity: 0.4,
            transparent: true,
        });
        wireMaterial.userData.alwaysTransparent = true;
        
        const wireLines = new THREE.LineSegments(wireframeGeometry, wireMaterial);
        wireLines.renderOrder = 200; // Обводки выше узлов, но ниже текста
        sphere.add(wireLines); // Добавляем к сфере, чтобы вращалась вместе с ней

        // Создаем светящуюся оболочку как child
        // Для корневых узлов используем специальный цвет root узлов
        const shellMaterial = isRoot 
            ? this.createGlowShellMaterial(ROOT_COLOR, true) 
            : this.createGlowShellMaterial(LEVEL_1_COLOR, false);
        const shellGeometry = new THREE.SphereGeometry(
            radius * 1.15,
            SPHERE_SEGMENTS,
            SPHERE_RINGS
        );
        const shell = new THREE.Mesh(shellGeometry, shellMaterial);
        shell.renderOrder = 100; // Оболочка на том же уровне, что и узел, но ниже текста
        shell.userData.rotationSpeed = sphere.userData.rotationSpeed * 0.7;
        shell.userData.isGlowShell = true; // Метка для игнорирования в raycasting
        sphere.add(shell);

        // Создаем статичное неоновое кольцо - всегда ориентировано к камере
        const ringRadius = radius * 1.15;
        const ringGeometry = new THREE.TorusGeometry(
            ringRadius,
            ringRadius * 0.005, // Уменьшили толщину кольца
            16,
            64
        );
        const ringColor = isRoot ? ROOT_COLOR : LEVEL_1_COLOR;
        const ringMaterial = new THREE.MeshBasicMaterial({
            color: ringColor,
            transparent: true,
            opacity: 0.8,
        });
        const ring = new THREE.Mesh(ringGeometry, ringMaterial);
        ring.renderOrder = 200; // Кольцо выше узла, но ниже текста
        ring.position.copy(node.position); // Позиция узла
        ring.userData.isNeonRing = true;
        ring.userData.nodePosition = node.position.clone(); // Сохраняем для обновления
        treeGroup.add(ring); // Добавляем к группе, не к sphere

        // Добавляем свечение к окружности
        const ringGlowGeometry = new THREE.TorusGeometry(
            ringRadius,
            ringRadius * 0.01, // Уменьшили толщину свечения
            16,
            64
        );
        const ringGlowMaterial = new THREE.MeshBasicMaterial({
            color: ringColor,
            transparent: true,
            opacity: 0.4,
        });
        const ringGlow = new THREE.Mesh(ringGlowGeometry, ringGlowMaterial);
        ringGlow.userData.isNeonRing = true;
        ring.add(ringGlow);
        
        // Создаем текст на узле
        let textSprite = null;
        if (node.text) {
            textSprite = this.createTextSprite(node, isRoot, radius);
            if (textSprite) {
                treeGroup.add(textSprite);
            }
        }
        
        // Сохраняем в массив всех узлов
        this.nodeMeshes.push({
            mesh: sphere,
            shell: shell,
            neonRing: ring,
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
     * Разбить текст на строки по максимальному количеству слов
     * @param {string} text - Текст для разбиения
     * @param {number} maxWordsPerLine - Максимальное количество слов в строке (0 или undefined = без ограничений)
     * @returns {string[]} Массив строк
     */
    splitTextIntoLines(text, maxWordsPerLine) {
        if (!text || !text.trim()) {
            return [''];
        }

        // Если maxWordsPerLine = 0 или undefined, возвращаем весь текст одной строкой
        if (!maxWordsPerLine || maxWordsPerLine <= 0) {
            return [text.trim()];
        }

        // Разбиваем текст на слова по пробелам
        const words = text.trim().split(/\s+/);
        const lines = [];

        // Группируем слова в строки по maxWordsPerLine
        for (let i = 0; i < words.length; i += maxWordsPerLine) {
            const line = words.slice(i, i + maxWordsPerLine).join(' ');
            lines.push(line);
        }

        return lines;
    }

    /**
     * Создание текстового спрайта для узла
     */
    createTextSprite(node, isRoot, radius) {
        // Всегда создаем спрайты, видимость будет управляться в updateNodeTextSprite
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        
        // Базовый размер шрифта зависит от уровня и настроек
        const baseFontSize = isRoot ? this.rootTextSize : this.nodeTextSize;
        
        // Рассчитываем размер шрифта на основе зума камеры
        // Формула: fontSize = baseSize * (minZoom / currentZoom)
        // Чем больше зум (ближе камера), тем меньше размер шрифта
        let fontSize = baseFontSize;
        if (this.cameraManager) {
            const currentZoom = this.cameraManager.getZoom();
            fontSize = baseFontSize * (CAMERA_MIN_ZOOM / currentZoom);
            // Минимальный размер шрифта - 32 пикселя
            fontSize = Math.max(fontSize, isRoot ? 72 : 38);
        }
        
        const lineHeight = fontSize * 1.2; // Межстрочный интервал
        context.font = `bold ${fontSize}px Arial`;
        
        // Разбиваем текст на строки
        const lines = this.splitTextIntoLines(node.text, this.maxWordsPerLine);
        
        // Измеряем ширину каждой строки и находим максимальную
        let maxTextWidth = 0;
        const lineWidths = [];
        lines.forEach(line => {
            const metrics = context.measureText(line);
            const width = metrics.width;
            lineWidths.push(width);
            if (width > maxTextWidth) {
                maxTextWidth = width;
            }
        });
        
        // Рассчитываем размеры canvas
        const textWidth = maxTextWidth;
        const textHeight = lines.length * lineHeight - (lineHeight - fontSize); // Высота с учетом межстрочного интервала
        
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
        context.textBaseline = 'middle'; // Центрируем по вертикали
        
        // Рисуем каждую строку с правильным вертикальным смещением
        const centerX = (textWidth + TEXT_PADDING) / 2;
        const canvasCenterY = (textHeight + TEXT_PADDING) / 2; // Центр canvas по вертикали
        
        // Рассчитываем начальную позицию Y для первой строки
        // Чтобы весь текст был центрирован, первая строка должна быть выше центра
        const totalTextHeight = lines.length * lineHeight - (lineHeight - fontSize);
        const startY = canvasCenterY - (totalTextHeight / 2) + (fontSize / 2);
        
        lines.forEach((line, index) => {
            const y = startY + index * lineHeight;
            // Рисуем текст с обводкой
            context.strokeText(line, centerX, y);
            context.fillText(line, centerX, y);
        });
        
        // Создаем текстуру из canvas
        const texture = new THREE.CanvasTexture(canvas);
        texture.needsUpdate = true;
        
        // Создаем спрайт с текстом
        const spriteMaterial = new THREE.SpriteMaterial({
            map: texture,
            transparent: true,
            alphaTest: 0.1,
            depthTest: false, // Отключаем depth test для отображения поверх всех объектов
            depthWrite: false // Отключаем depth write для отображения поверх всех объектов
        });
        const sprite = new THREE.Sprite(spriteMaterial);
        
        // Позиционируем текст над сферой
        sprite.position.copy(node.position);
        sprite.position.y += radius + TEXT_OFFSET_Y;
        sprite.scale.set((canvas.width / TEXT_SCALE_FACTOR) * 1.5, (canvas.height / TEXT_SCALE_FACTOR) * 1.5, 1);
        sprite.renderOrder = 999; // Текст всегда поверх всех элементов
        
        // Устанавливаем начальную видимость на основе зума (для дочерних узлов)
        // Корневые узлы всегда видимы
        if (isRoot) {
            sprite.visible = true;
        } else {
            // Для дочерних узлов видимость зависит от зума
            const isDetailMode = this.detailModeSystem && this.detailModeSystem.isActive();
            if (isDetailMode) {
                sprite.visible = true; // В детальном режиме все видимо
            } else if (this.cameraManager) {
                const currentZoom = this.cameraManager.getZoom();
                sprite.visible = currentZoom >= 1.5;
            } else {
                sprite.visible = true; // Если нет cameraManager, показываем все
            }
        }
        
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
            // Определяем радиус узла (rootRadius для корневого узла, nodeRadius для остальных)
            const nodeRadius = node.level === 0 ? this.rootRadius : this.nodeRadius;
            // Вычисляем радиус орбиты: радиус узла + смещение из настройки
            const orbitRadius = nodeRadius + this.fireflyOrbitRadius;
            
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
                const orbitX = Math.cos(angle) * orbitRadius;
                const orbitZ = Math.sin(angle) * orbitRadius;
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
                    speed: randomSpeed * direction,
                    orbitRadiusOffset: this.fireflyOrbitRadius, // Сохраняем смещение, а не абсолютный радиус
                    originalOrbitRadius: this.fireflyOrbitRadius
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
        // Сохраняем ссылку на экземпляр Firefly в userData для возможности обновления размера
        firefly.mesh.userData.fireflyInstance = firefly;
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
        if (params.rootRadius !== undefined) {
            this.rootRadius = params.rootRadius;
            this.treeBuilder.updateRadii(this.rootRadius, this.nodeRadius);
        }
        if (params.nodeRadius !== undefined) {
            this.nodeRadius = params.nodeRadius;
            this.treeBuilder.updateRadii(this.rootRadius, this.nodeRadius);
        }
        if (params.rootTextSize !== undefined) {
            this.rootTextSize = params.rootTextSize;
            this.updateTextSizes();
        }
        if (params.nodeTextSize !== undefined) {
            this.nodeTextSize = params.nodeTextSize;
            this.updateTextSizes();
        }
        if (params.maxWordsPerLine !== undefined) {
            this.maxWordsPerLine = params.maxWordsPerLine;
            this.updateTextSizes();
        }
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
     * Обновить размер текста всех узлов
     */
    updateTextSizes() {
        this.nodeMeshes.forEach(nodeData => {
            if (nodeData.textSprite) {
                this.updateNodeTextSprite(nodeData);
            }
        });
    }

    /**
     * Обновить текст спрайт конкретного узла
     */
    updateNodeTextSprite(nodeData) {
        const node = nodeData.node;
        const isRoot = node.level === 0;
        const radius = isRoot ? this.rootRadius : this.nodeRadius;

        // Если зум меньше 1.5, скрываем надписи у дочерних узлов (не корневых)
        if (!isRoot && this.cameraManager && (!this.detailModeSystem || !this.detailModeSystem.isActive())) {
            const currentZoom = this.cameraManager.getZoom();
            
            if (currentZoom < CAMERA_ZOOM_STEPS[5]) {
                // Скрываем спрайт дочернего узла
                if (nodeData.textSprite) {
                    nodeData.textSprite.visible = false;
                }
                return; // Для дочерних узлов при зуме < 1.5 только скрываем, не обновляем текстуру
            } else {
                // Показываем спрайт дочернего узла или создаем его, если его нет
                if (nodeData.textSprite) {
                    nodeData.textSprite.visible = true;
                } else if (node.text && nodeData.treeGroup) {
                    // Создаем спрайт, если его нет и зум >= 1.5
                    const newSprite = this.createTextSprite(node, isRoot, radius);
                    if (newSprite) {
                        nodeData.textSprite = newSprite;
                        nodeData.treeGroup.add(newSprite);
                        // Обновляем originalSpriteScale
                        nodeData.originalSpriteScale = newSprite.scale.clone();
                    }
                }
            }
        }

        // Создаем новую текстуру
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');

        // Базовый размер шрифта зависит от уровня и настроек
        const baseFontSize = isRoot ? this.rootTextSize : this.nodeTextSize;
        
        // Рассчитываем размер шрифта на основе зума камеры
        // Формула: fontSize = baseSize * (minZoom / currentZoom)
        // Чем больше зум (ближе камера), тем меньше размер шрифта
        // Применяем только для общего вида (не в детальном режиме)
        let fontSize = baseFontSize;
        if (this.cameraManager && (!this.detailModeSystem || !this.detailModeSystem.isActive())) {
            const currentZoom = this.cameraManager.getZoom();
            fontSize = baseFontSize * (CAMERA_MIN_ZOOM / currentZoom);
            // Минимальный размер шрифта - 32 пикселя
            fontSize = Math.max(fontSize, isRoot ? 72 : 38);
        }
        
        const lineHeight = fontSize * 1.2; // Межстрочный интервал
        context.font = `bold ${fontSize}px Arial`;

        // Разбиваем текст на строки
        const lines = this.splitTextIntoLines(node.text, this.maxWordsPerLine);

        // Измеряем ширину каждой строки и находим максимальную
        let maxTextWidth = 0;
        const lineWidths = [];
        lines.forEach(line => {
            const metrics = context.measureText(line);
            const width = metrics.width;
            lineWidths.push(width);
            if (width > maxTextWidth) {
                maxTextWidth = width;
            }
        });

        // Рассчитываем размеры canvas
        const textWidth = maxTextWidth;
        const textHeight = lines.length * lineHeight - (lineHeight - fontSize); // Высота с учетом межстрочного интервала

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
        context.textBaseline = 'middle'; // Центрируем по вертикали

        // Рисуем каждую строку с правильным вертикальным смещением
        const centerX = (textWidth + TEXT_PADDING) / 2;
        const canvasCenterY = (textHeight + TEXT_PADDING) / 2; // Центр canvas по вертикали

        // Рассчитываем начальную позицию Y для первой строки
        // Чтобы весь текст был центрирован, первая строка должна быть выше центра
        const totalTextHeight = lines.length * lineHeight - (lineHeight - fontSize);
        const startY = canvasCenterY - (totalTextHeight / 2) + (fontSize / 2);

        lines.forEach((line, index) => {
            const y = startY + index * lineHeight;
            // Рисуем текст с обводкой
            context.strokeText(line, centerX, y);
            context.fillText(line, centerX, y);
        });

        // Создаем текстуру из canvas
        const texture = new THREE.CanvasTexture(canvas);
        texture.needsUpdate = true;

        // Обновляем существующий спрайт
        if (nodeData.textSprite) {
            // Освобождаем старую текстуру
            if (nodeData.textSprite.material.map) {
                nodeData.textSprite.material.map.dispose();
            }

            // Устанавливаем новую текстуру
            nodeData.textSprite.material.map = texture;
            nodeData.textSprite.material.needsUpdate = true;

            // Устанавливаем настройки для отображения поверх всех объектов
            nodeData.textSprite.renderOrder = 999;
            nodeData.textSprite.material.depthTest = false;
            nodeData.textSprite.material.depthWrite = false;
            
            // Убеждаемся, что корневые узлы всегда видимы
            if (isRoot) {
                nodeData.textSprite.visible = true;
            }

            // Рассчитываем новый масштаб
            nodeData.textSprite.scale.set((canvas.width / TEXT_SCALE_FACTOR) * 1.5, (canvas.height / TEXT_SCALE_FACTOR) * 1.5, 1);

            // Обновляем targetSpriteScale для анимаций
            nodeData.targetSpriteScale = nodeData.textSprite.scale.clone();
        }
    }

    /**
     * Получить границы сцены (для расчета минимального зума)
     */
    getSceneBounds() {
        return this.sceneBounds;
    }

    /**
     * Обновление анимации вращения сфер и ориентации колец
     */
    updateSphereRotations(deltaTime, camera) {
        // Обновляем uniform позиции камеры для оболочек корневых узлов
        if (camera) {
            this.nodeMeshes.forEach(nodeData => {
                if (nodeData.shell && nodeData.shell.material) {
                    const material = nodeData.shell.material;
                    // Проверяем, является ли материал ShaderMaterial для оболочки корневого узла
                    if (material instanceof THREE.ShaderMaterial && material.uniforms && material.uniforms.cameraPosition) {
                        // cameraPosition доступен автоматически в Three.js шейдерах
                        // Но если нужен uniform, можно добавить его обновление здесь
                    }
                }
            });
        }

        this.nodeMeshes.forEach(nodeData => {
            if (nodeData.mesh && nodeData.mesh.userData.rotationSpeed) {
                nodeData.mesh.rotation.y += nodeData.mesh.userData.rotationSpeed * deltaTime;
                nodeData.mesh.rotation.x += nodeData.mesh.userData.rotationSpeed * 0.5 * deltaTime;

                // Вращаем оболочку в обратном направлении для динамичности
                if (nodeData.shell) {
                    nodeData.shell.rotation.y -= nodeData.shell.userData.rotationSpeed * deltaTime;
                    nodeData.shell.rotation.x += nodeData.shell.userData.rotationSpeed * 0.3 * deltaTime;
                }

                // Ориентируем неоновое кольцо к камере (billboarding)
                if (nodeData.neonRing && camera) {
                    nodeData.neonRing.quaternion.copy(camera.quaternion);

                    // Применяем дополнительный поворот по Y в детальном режиме
                    if (this.detailModeSystem && this.detailModeSystem.isDetailMode) {
                        nodeData.neonRing.rotateY(this.detailModeSystem.neonRingRotationY);

                        // Ориентируем лучи также к камере с тем же поворотом
                        if (this.detailModeSystem.ringRays) {
                            this.detailModeSystem.ringRays.quaternion.copy(camera.quaternion);
                            this.detailModeSystem.ringRays.rotateY(this.detailModeSystem.neonRingRotationY);
                        }
                    }
                }
            }
        });
    }
}
