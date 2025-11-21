import { TreeNode } from '../mockData.js';
import { LayoutCalculator } from './LayoutCalculator.js';
import { ROOT_RADIUS, NODE_RADIUS } from '../utils/constants.js';

/**
 * Класс для построения и обработки деревьев из данных
 */
export class TreeBuilder {
    constructor() {
        // Кэш для деревьев (чтобы не пересчитывать каждый раз)
        this.cachedTrees = null;
        this.cachedDepth = null;
    }

    /**
     * Преобразование статического массива данных в структуру TreeNode
     * Возвращает массив деревьев (несколько root узлов)
     */
    buildTreesFromData(data, maxDepth, childrenCache = null) {
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
        if (this.cachedTrees && this.cachedDepth === maxDepth) {
            // Возвращаем глубокую копию узлов, чтобы избежать мутации
            return this.cachedTrees.map(({ root, nodes }) => {
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
        const calculateLevel = (nodeId, level) => {
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
        };
        
        // Вычисляем уровни для каждого корня
        roots.forEach(root => {
            calculateLevel(root.id, 0);
        });
        
        // Устанавливаем связи и собираем узлы для каждого дерева
        const trees = roots.map(root => {
            const nodes = [];
            
            // Собираем все узлы этого дерева
            const collectNodes = (nodeId) => {
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
            };
            
            collectNodes(root.id);
        
            return { root, nodes };
        });
        
        this.cachedTrees = trees;
        this.cachedDepth = maxDepth;
        
        return trees;
    }

    /**
     * Получить радиус узла
     */
    getNodeRadius(node, isRoot = false) {
        return isRoot ? ROOT_RADIUS : NODE_RADIUS;
    }

    /**
     * Считаем максимальное количество узлов на каждом уровне для всех деревьев
     */
    computeMaxNodesPerLevel(data, maxDepth) {
        const trees = this.buildTreesFromData(data, maxDepth);
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
     * Фильтрация дерева по максимальному количеству узлов на каждом уровне
     * levelLimits: { 1: number, 2: number, 3: number }
     */
    filterTreeByLevel(root, nodes, levelLimits) {
        const levelCounts = new Map(); // level -> count
        const allowedNodes = new Set();
        
        const dfs = (node) => {
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
        };
        
        dfs(root);
        
        const filteredNodes = nodes.filter((node) => allowedNodes.has(node));
        return { root, nodes: filteredNodes };
    }

    /**
     * Вычисляет максимальный радиус дерева (до вычисления позиций)
     * Возвращает максимальный радиус, который будет у дерева
     */
    calculateMaxTreeRadius(root, nodes, config) {
        return LayoutCalculator.calculateMaxTreeRadius(root, nodes, config);
    }

    /**
     * Вычисляем позиции узлов по радиальному layout
     * Параметры:
     *  - spacingFactor: множитель для желаемого расстояния между соседями на уровне (в диаметрах)
     *  - levelMarginFactor: множитель дополнительного радиального зазора между уровнями (в диаметрах)
     *  - offset: смещение центра дерева (для размещения нескольких деревьев)
     */
    calculatePositions(root, nodes, config) {
        return LayoutCalculator.calculatePositions(root, nodes, config);
    }

    /**
     * Очистить кэш деревьев
     */
    clearCache() {
        this.cachedTrees = null;
        this.cachedDepth = null;
    }
}

