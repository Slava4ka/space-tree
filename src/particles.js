import * as THREE from 'three';

/**
 * Создаёт систему фоновых частиц (звёздное небо)
 * @param {number} count - Количество частиц
 * @returns {THREE.Points} Объект Points с частицами
 */
export function createParticles(count = 1000) {
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(count * 3);
    const velocities = new Float32Array(count * 3);
    
    // Генерируем случайные позиции и скорости для частиц
    for (let i = 0; i < count * 3; i += 3) {
        // Распределяем частицы в сфере радиусом 50
        const radius = Math.random() * 50;
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.acos(Math.random() * 2 - 1);
        
        positions[i] = radius * Math.sin(phi) * Math.cos(theta);
        positions[i + 1] = radius * Math.sin(phi) * Math.sin(theta);
        positions[i + 2] = radius * Math.cos(phi);
        
        // Случайные скорости для движения
        velocities[i] = (Math.random() - 0.5) * 0.01;
        velocities[i + 1] = (Math.random() - 0.5) * 0.01;
        velocities[i + 2] = (Math.random() - 0.5) * 0.01;
    }
    
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    
    const material = new THREE.PointsMaterial({
        color: 0x00aaff,
        size: 0.02,
        transparent: true,
        opacity: 0.8,
        blending: THREE.AdditiveBlending,
        sizeAttenuation: true,
    });
    
    const points = new THREE.Points(geometry, material);
    
    // Сохраняем скорости для анимации
    points.userData.velocities = velocities;
    points.userData.initialPositions = positions.slice();
    
    return points;
}

/**
 * Обновляет позиции частиц для создания эффекта движения
 * @param {THREE.Points} points - Объект Points для обновления
 * @param {number} time - Время для создания плавного движения
 */
export function updateParticles(points, time) {
    const positions = points.geometry.attributes.position.array;
    const velocities = points.userData.velocities;
    
    for (let i = 0; i < positions.length; i += 3) {
        // Обновляем позиции с учётом времени
        positions[i] += velocities[i] * Math.sin(time * 0.001 + i * 0.01);
        positions[i + 1] += velocities[i + 1] * Math.cos(time * 0.001 + i * 0.01);
        positions[i + 2] += velocities[i + 2] * Math.sin(time * 0.001 + i * 0.01);
        
        // Ограничиваем движение, чтобы частицы не уходили слишком далеко
        const maxDistance = 50;
        const distance = Math.sqrt(
            positions[i] ** 2 + 
            positions[i + 1] ** 2 + 
            positions[i + 2] ** 2
        );
        
        if (distance > maxDistance) {
            // Возвращаем частицу ближе к центру
            const scale = maxDistance / distance;
            positions[i] *= scale;
            positions[i + 1] *= scale;
            positions[i + 2] *= scale;
        }
    }
    
    points.geometry.attributes.position.needsUpdate = true;
}

/**
 * Создаёт эффект параллакса при движении мыши
 * @param {THREE.Points} points - Объект Points
 * @param {number} mouseX - Нормализованная позиция мыши X (-1 до 1)
 * @param {number} mouseY - Нормализованная позиция мыши Y (-1 до 1)
 */
export function applyMouseParallax(points, mouseX, mouseY) {
    const positions = points.geometry.attributes.position.array;
    const initialPositions = points.userData.initialPositions;
    const parallaxStrength = 2;
    
    for (let i = 0; i < positions.length; i += 3) {
        // Восстанавливаем базовую позицию
        positions[i] = initialPositions[i];
        positions[i + 1] = initialPositions[i + 1];
        positions[i + 2] = initialPositions[i + 2];
        
        // Применяем смещение на основе позиции мыши
        const depth = initialPositions[i + 2] / 50; // Нормализуем глубину
        positions[i] += mouseX * parallaxStrength * (1 + depth);
        positions[i + 1] += mouseY * parallaxStrength * (1 + depth);
    }
    
    points.geometry.attributes.position.needsUpdate = true;
}


