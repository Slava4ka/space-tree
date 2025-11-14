import * as THREE from 'three';
import { CSS2DRenderer, CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';
import { gsap } from 'gsap';

/**
 * Класс для создания орбитального объекта с подписью
 */
export class OrbitText {
    /**
     * @param {string} text - Текст подписи
     * @param {number} radius - Радиус орбиты
     * @param {number} angle - Угол на орбите (в радианах)
     * @param {number} sphereSize - Размер сферы
     * @param {string} color - Цвет сферы (hex)
     * @param {string} description - Описание для модального окна
     */
    constructor(text, radius, angle, sphereSize = 0.7, color = '#00ccff', description = '') {
        this.text = text;
        this.radius = radius;
        this.angle = angle;
        this.sphereSize = sphereSize;
        this.color = color;
        this.description = description;
        
        // Создаём группу для сферы и подписи
        this.group = new THREE.Group();
        
        // Создаём сферу
        this.createSphere();
        
        // Создаём подпись
        this.createLabel();
        
        // Устанавливаем начальную позицию
        this.updatePosition();
        
        // Сохраняем исходный масштаб для анимации наведения
        this.originalScale = 1;
    }
    
    /**
     * Создаёт 3D сферу
     */
    createSphere() {
        const geometry = new THREE.SphereGeometry(this.sphereSize, 32, 32);
        const material = new THREE.MeshPhongMaterial({
            color: this.color,
            emissive: this.color,
            emissiveIntensity: 0.5,
            shininess: 100,
            transparent: true,
            opacity: 0.9,
        });
        
        this.sphere = new THREE.Mesh(geometry, material);
        this.group.add(this.sphere);
        
        // Добавляем эффект свечения через дополнительный слой
        const glowGeometry = new THREE.SphereGeometry(this.sphereSize * 1.2, 32, 32);
        const glowMaterial = new THREE.MeshBasicMaterial({
            color: this.color,
            transparent: true,
            opacity: 0.2,
            side: THREE.BackSide,
        });
        
        this.glow = new THREE.Mesh(glowGeometry, glowMaterial);
        this.group.add(this.glow);
        
        // Делаем сферу интерактивной
        this.sphere.userData.orbitText = this;
    }
    
    /**
     * Создаёт HTML-подпись с использованием CSS2D
     */
    createLabel() {
        const labelDiv = document.createElement('div');
        labelDiv.className = 'orbit-label';
        labelDiv.textContent = this.text;
        
        this.label = new CSS2DObject(labelDiv);
        this.label.position.set(0, this.sphereSize + 0.5, 0);
        this.group.add(this.label);
    }
    
    /**
     * Обновляет позицию на орбите
     */
    updatePosition() {
        const x = Math.cos(this.angle) * this.radius;
        const z = Math.sin(this.angle) * this.radius;
        this.group.position.set(x, 0, z);
        
        // Поворачиваем сферу к центру
        this.group.lookAt(0, 0, 0);
    }
    
    /**
     * Вращает объект вокруг центра
     * @param {number} deltaAngle - Изменение угла
     */
    rotate(deltaAngle) {
        this.angle += deltaAngle;
        this.updatePosition();
    }
    
    /**
     * Анимация наведения (увеличение и подсветка)
     * @param {boolean} isHovered - Наведена ли мышь
     */
    setHovered(isHovered) {
        const targetScale = isHovered ? 1.3 : 1;
        const targetEmissiveIntensity = isHovered ? 1 : 0.5;
        
        // Плавная анимация через GSAP
        gsap.to(this.group.scale, {
            x: targetScale,
            y: targetScale,
            z: targetScale,
            duration: 0.3,
            ease: 'power2.out',
        });
        
        gsap.to(this.sphere.material, {
            emissiveIntensity: targetEmissiveIntensity,
            duration: 0.3,
        });
    }
    
    /**
     * Получает группу для добавления в сцену
     * @returns {THREE.Group}
     */
    getGroup() {
        return this.group;
    }
    
    /**
     * Получает сферу для проверки пересечений
     * @returns {THREE.Mesh}
     */
    getSphere() {
        return this.sphere;
    }
}

