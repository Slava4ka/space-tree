import * as THREE from 'three';
import { CSS2DRenderer } from 'three/addons/renderers/CSS2DRenderer.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { gsap } from 'gsap';
import { createParticles, updateParticles, applyMouseParallax } from './particles.js';
import { OrbitText } from './OrbitText.js';

// Глобальные переменные
let scene, camera, renderer, labelRenderer;
let composer;
let centralSphere;
let orbitGroup;
let particles;
let raycaster, mouse;
let hoveredObject = null;
let autoRotate = true;
let autoRotateSpeed = 0.001;

// Данные для орбитальных сфер
const orbitData = [
    {
        text: 'Старение населения и новые болезни',
        description: 'Развитие медицины и биотехнологий для решения демографических вызовов и борьбы с новыми заболеваниями.',
    },
    {
        text: 'Производственная безопасность',
        description: 'Внедрение современных технологий для обеспечения безопасности на производстве и предотвращения аварий.',
    },
    {
        text: 'Сырьевая зависимость и цифровая революция',
        description: 'Переход от сырьевой экономики к цифровой, развитие высоких технологий и инноваций.',
    },
    {
        text: 'Гибридные внешние угрозы национальной безопасности',
        description: 'Защита от кибератак, информационных войн и других современных угроз безопасности государства.',
    },
    {
        text: 'Освоение территорий страны, мирового океана, Арктики, Антарктики',
        description: 'Развитие технологий для исследования и освоения труднодоступных территорий и акваторий.',
    },
    {
        text: 'Истощение природных ресурсов и ухудшение экологии',
        description: 'Разработка экологически чистых технологий и методов рационального использования ресурсов.',
    },
    {
        text: 'Продовольственная безопасность',
        description: 'Обеспечение продовольственной независимости через развитие агротехнологий и биотехнологий.',
    },
    {
        text: 'Выработка и сохранение энергии',
        description: 'Развитие возобновляемых источников энергии и технологий её эффективного хранения и использования.',
    },
];

/**
 * Инициализация сцены
 */
function init() {
    // Создание сцены
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x000011);
    
    // Создание камеры
    camera = new THREE.PerspectiveCamera(
        60,
        window.innerWidth / window.innerHeight,
        0.1,
        1000
    );
    camera.position.set(0, 0, 20);
    
    // Создание рендерера
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    document.getElementById('canvas-container').appendChild(renderer.domElement);
    
    // Создание CSS2D рендерера для подписей
    labelRenderer = new CSS2DRenderer();
    labelRenderer.setSize(window.innerWidth, window.innerHeight);
    labelRenderer.domElement.style.position = 'absolute';
    labelRenderer.domElement.style.top = '0';
    labelRenderer.domElement.style.pointerEvents = 'none';
    document.getElementById('canvas-container').appendChild(labelRenderer.domElement);
    
    // Настройка постобработки для эффекта свечения
    composer = new EffectComposer(renderer);
    const renderPass = new RenderPass(scene, camera);
    composer.addPass(renderPass);
    
    const bloomPass = new UnrealBloomPass(
        new THREE.Vector2(window.innerWidth, window.innerHeight),
        1.5, // strength
        0.4, // radius
        0.85 // threshold
    );
    composer.addPass(bloomPass);
    
    // Освещение
    const ambientLight = new THREE.AmbientLight(0x004080, 0.3);
    scene.add(ambientLight);
    
    const pointLight = new THREE.PointLight(0xffffff, 2, 100);
    pointLight.position.set(0, 0, 0);
    scene.add(pointLight);
    
    // Дополнительные источники света для лучшей видимости
    const light1 = new THREE.PointLight(0x00bfff, 0.5, 50);
    light1.position.set(10, 10, 10);
    scene.add(light1);
    
    const light2 = new THREE.PointLight(0x00bfff, 0.5, 50);
    light2.position.set(-10, -10, -10);
    scene.add(light2);
    
    // Создание центральной сферы
    createCentralSphere();
    
    // Создание орбитальных сфер
    createOrbitalSpheres();
    
    // Создание фоновых частиц
    particles = createParticles(1000);
    scene.add(particles);
    
    // Настройка Raycaster для взаимодействия
    raycaster = new THREE.Raycaster();
    mouse = new THREE.Vector2();
    
    // Обработчики событий
    setupEventListeners();
    
    // Анимация появления
    animateEntrance();
    
    // Запуск анимации
    animate();
}

/**
 * Создание центральной сферы
 */
function createCentralSphere() {
    const geometry = new THREE.SphereGeometry(3, 64, 64);
    const material = new THREE.MeshPhongMaterial({
        color: 0x00bfff,
        emissive: 0x00bfff,
        emissiveIntensity: 0.3,
        shininess: 100,
        transparent: true,
        opacity: 0.9,
    });
    
    centralSphere = new THREE.Mesh(geometry, material);
    scene.add(centralSphere);
    
    // Добавляем эффект свечения
    const glowGeometry = new THREE.SphereGeometry(3.3, 64, 64);
    const glowMaterial = new THREE.MeshBasicMaterial({
        color: 0x00bfff,
        transparent: true,
        opacity: 0.2,
        side: THREE.BackSide,
    });
    
    const glow = new THREE.Mesh(glowGeometry, glowMaterial);
    centralSphere.add(glow);
}

/**
 * Создание орбитальных сфер
 */
function createOrbitalSpheres() {
    orbitGroup = new THREE.Group();
    const orbitRadius = 8;
    const count = orbitData.length;
    
    orbitData.forEach((data, index) => {
        const angle = (index / count) * Math.PI * 2;
        const orbitText = new OrbitText(
            data.text,
            orbitRadius,
            angle,
            0.7,
            '#00ccff',
            data.description
        );
        
        orbitGroup.add(orbitText.getGroup());
        scene.add(orbitGroup);
    });
}

/**
 * Настройка обработчиков событий
 */
function setupEventListeners() {
    // Изменение размера окна
    window.addEventListener('resize', onWindowResize);
    
    // Движение мыши
    window.addEventListener('mousemove', onMouseMove);
    
    // Клик по сфере
    window.addEventListener('click', onMouseClick);
    
    // Закрытие модального окна
    const modal = document.getElementById('modal');
    const closeBtn = document.getElementsByClassName('close')[0];
    
    closeBtn.onclick = () => {
        modal.style.display = 'none';
    };
    
    window.onclick = (event) => {
        if (event.target === modal) {
            modal.style.display = 'none';
        }
    };
}

/**
 * Обработка изменения размера окна
 */
function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    
    renderer.setSize(window.innerWidth, window.innerHeight);
    labelRenderer.setSize(window.innerWidth, window.innerHeight);
    
    composer.setSize(window.innerWidth, window.innerHeight);
}

/**
 * Обработка движения мыши
 */
function onMouseMove(event) {
    // Нормализуем координаты мыши (-1 до 1)
    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
    
    // Применяем параллакс к частицам
    if (particles) {
        applyMouseParallax(particles, mouse.x * 0.5, mouse.y * 0.5);
    }
    
    // Проверяем пересечение с орбитальными сферами
    raycaster.setFromCamera(mouse, camera);
    
    const orbitSpheres = [];
    orbitGroup.children.forEach((group) => {
        group.children.forEach((child) => {
            if (child instanceof THREE.Mesh && child.userData.orbitText) {
                orbitSpheres.push(child);
            }
        });
    });
    
    const intersects = raycaster.intersectObjects(orbitSpheres);
    
    if (intersects.length > 0) {
        const intersected = intersects[0].object;
        const orbitText = intersected.userData.orbitText;
        
        if (hoveredObject !== orbitText) {
            if (hoveredObject) {
                hoveredObject.setHovered(false);
            }
            hoveredObject = orbitText;
            hoveredObject.setHovered(true);
            document.body.style.cursor = 'pointer';
        }
    } else {
        if (hoveredObject) {
            hoveredObject.setHovered(false);
            hoveredObject = null;
            document.body.style.cursor = 'default';
        }
    }
}

/**
 * Обработка клика мыши
 */
function onMouseClick(event) {
    raycaster.setFromCamera(mouse, camera);
    
    const orbitSpheres = [];
    orbitGroup.children.forEach((group) => {
        group.children.forEach((child) => {
            if (child instanceof THREE.Mesh && child.userData.orbitText) {
                orbitSpheres.push(child);
            }
        });
    });
    
    const intersects = raycaster.intersectObjects(orbitSpheres);
    
    if (intersects.length > 0) {
        const orbitText = intersects[0].object.userData.orbitText;
        showModal(orbitText.text, orbitText.description);
    }
}

/**
 * Показ модального окна
 */
function showModal(title, description) {
    const modal = document.getElementById('modal');
    document.getElementById('modal-title').textContent = title;
    document.getElementById('modal-description').textContent = description;
    modal.style.display = 'block';
}

/**
 * Анимация появления элементов
 */
function animateEntrance() {
    // Анимация заголовка
    gsap.to('#title-overlay', {
        opacity: 1,
        duration: 2,
        delay: 0.5,
        ease: 'power2.out',
    });
    
    // Анимация центральной сферы
    if (centralSphere) {
        centralSphere.scale.set(0, 0, 0);
        gsap.to(centralSphere.scale, {
            x: 1,
            y: 1,
            z: 1,
            duration: 1.5,
            delay: 0.3,
            ease: 'back.out(1.7)',
        });
    }
    
    // Анимация орбитальных сфер
    if (orbitGroup) {
        orbitGroup.children.forEach((group, index) => {
            group.scale.set(0, 0, 0);
            gsap.to(group.scale, {
                x: 1,
                y: 1,
                z: 1,
                duration: 1,
                delay: 0.8 + index * 0.1,
                ease: 'back.out(1.7)',
            });
        });
    }
}

/**
 * Основной цикл анимации
 */
let time = 0;
function animate() {
    requestAnimationFrame(animate);
    
    time += 16; // Примерно 60 FPS
    
    // Вращение центральной сферы
    if (centralSphere) {
        centralSphere.rotation.y += 0.002;
    }
    
    // Вращение орбитальных сфер
    if (orbitGroup && autoRotate) {
        orbitGroup.rotation.y += autoRotateSpeed;
    }
    
    // Обновление частиц
    if (particles) {
        updateParticles(particles, time);
    }
    
    // Автоматическое вращение камеры (опционально)
    if (autoRotate) {
        const radius = 20;
        const angle = time * 0.0001;
        camera.position.x = Math.cos(angle) * radius;
        camera.position.z = Math.sin(angle) * radius;
        camera.lookAt(0, 0, 0);
    }
    
    // Рендеринг
    composer.render();
    labelRenderer.render(scene, camera);
}

// Запуск при загрузке
window.addEventListener('load', init);

