import * as THREE from 'three';
import { debounce } from 'lodash';
import { FIREFLY_CORE_SIZE_MULTIPLIER, SPHERE_SEGMENTS, SPHERE_RINGS } from '../utils/constants.js';
import { isMobileDevice } from '../utils/DeviceUtils.js';

/**
 * Класс для управления UI контролами (зум, layout слайдеры)
 */
export class UIControlsManager {
    constructor(options) {
        this.container = options.container;
        this.cameraManager = options.cameraManager;
        this.isDetailMode = options.isDetailMode || (() => false);
        this.currentZoom = options.currentZoom || (() => 1);
        this.updateCurrentZoom = options.updateCurrentZoom || (() => {});
        this.updateCameraZoom = options.updateCameraZoom || (() => {});
        this.updateCameraPosition = options.updateCameraPosition || (() => {});
        this.onCameraUpdate = options.onCameraUpdate || (() => {});
        this.selectedNode = options.selectedNode || null;
        
        // Callbacks для обновления параметров
        this.onSpacingFactorChange = options.onSpacingFactorChange || (() => {});
        this.onLevelMarginFactorChange = options.onLevelMarginFactorChange || (() => {});
        this.onGraphRotationChange = options.onGraphRotationChange || (() => {});
        this.onFireflySizeChange = options.onFireflySizeChange || (() => {});
        this.onFireflyRadiusChange = options.onFireflyRadiusChange || (() => {});
        this.onFireflySpeedChange = options.onFireflySpeedChange || (() => {});
        this.onDetailModeSizeChange = options.onDetailModeSizeChange || (() => {});
        this.onRootRadiusChange = options.onRootRadiusChange || (() => {});
        this.onNodeRadiusChange = options.onNodeRadiusChange || (() => {});
        this.onMaxWordsPerLineChange = options.onMaxWordsPerLineChange || (() => {});
        
        // Параметры радиусов
        this.rootRadius = options.rootRadius || 225;
        this.nodeRadius = options.nodeRadius || 135;

        // Параметры размера текста
        this.maxWordsPerLine = options.maxWordsPerLine || 5;
        
        // Параметры для передачи в callbacks
        this.spacingFactor = options.spacingFactor || 1.4;
        this.levelMarginFactor = options.levelMarginFactor || 0.6;
        this.graphRotation = options.graphRotation || { x: 0, y: 0, z: 15 };
        this.fireflySize = options.fireflySize || 20;
        this.fireflyOrbitRadius = options.fireflyOrbitRadius || 65;
        this.fireflyRotationSpeed = options.fireflyRotationSpeed || 1;
        this.fireflies = options.fireflies || [];
        this.treeGroups = options.treeGroups || [];
        this.DETAIL_MODE_SCREEN_SIZE_PERCENT = options.DETAIL_MODE_SCREEN_SIZE_PERCENT || 30;
        this.detailModeSystem = options.detailModeSystem || null;
        
        // Состояние для непрерывного панорамирования
        this.navigationInterval = null;
        this.isNavigating = false;
        this.currentNavigationDirection = null;
        
        // Ссылки на кнопки навигации для визуальной обратной связи
        this.navButtons = {
            up: null,
            down: null,
            left: null,
            right: null,
            home: null
        };
    }

    /**
     * Настройка контролов зума
     */
    setupZoomControls() {
        const zoomInBtn = document.getElementById('zoom-in');
        const zoomOutBtn = document.getElementById('zoom-out');

        if (zoomInBtn) {
            zoomInBtn.addEventListener('click', () => {
                if (!this.isDetailMode()) this.zoomIn();
            });
        }

        if (zoomOutBtn) {
            zoomOutBtn.addEventListener('click', () => {
                this.zoomOut();
            });
        }
        
        // Колесико мыши для зума
        if (this.container) {
            this.container.addEventListener('wheel', (event) => {
                // В режиме детального просмотра блокируем зум
                if (this.isDetailMode()) {
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
    }
    
    zoomIn() {
        // В режиме детального просмотра зум заблокирован
        if (this.isDetailMode()) return;
        
        this.cameraManager.zoomIn();
        const newZoom = this.cameraManager.getZoom();
        this.updateCurrentZoom(newZoom);
        this.updateCameraZoom();
    }
    
    zoomOut() {
        // В режиме детального просмотра кнопка zoom-out закрывает детальный режим
        if (this.isDetailMode()) {
            if (this.detailModeSystem) {
                this.detailModeSystem.exit();
            }
            return;
        }
        
        this.cameraManager.zoomOut();
        const newZoom = this.cameraManager.getZoom();
        this.updateCurrentZoom(newZoom);
        this.updateCameraZoom();
    }
    
    resetZoom() {
        // В режиме детального просмотра зум заблокирован
        if (this.isDetailMode()) return;
        
        this.cameraManager.resetZoom();
        const newZoom = this.cameraManager.getZoom();
        this.updateCurrentZoom(newZoom);
        this.updateCameraZoom();
    }

    /**
     * Настройка контролов навигации
     */
    setupNavigationControls() {
        const navUpBtn = document.getElementById('nav-up');
        const navDownBtn = document.getElementById('nav-down');
        const navLeftBtn = document.getElementById('nav-left');
        const navRightBtn = document.getElementById('nav-right');
        const navHomeBtn = document.getElementById('nav-home');

        // Сохраняем ссылки на кнопки для визуальной обратной связи с клавиатурой
        this.navButtons.up = navUpBtn;
        this.navButtons.down = navDownBtn;
        this.navButtons.left = navLeftBtn;
        this.navButtons.right = navRightBtn;
        this.navButtons.home = navHomeBtn;

        // Настройка кнопок с поддержкой удержания
        this.setupNavigationButton(navUpBtn, 'up');
        this.setupNavigationButton(navDownBtn, 'down');
        this.setupNavigationButton(navLeftBtn, 'left');
        this.setupNavigationButton(navRightBtn, 'right');
        
        if (navHomeBtn) {
            navHomeBtn.addEventListener('mousedown', () => {
                if (!this.isDetailMode()) {
                    navHomeBtn.classList.add('active');
                    this.resetCameraPosition();
                }
            });
            navHomeBtn.addEventListener('mouseup', () => {
                navHomeBtn.classList.remove('active');
            });
            navHomeBtn.addEventListener('mouseleave', () => {
                navHomeBtn.classList.remove('active');
            });
            navHomeBtn.addEventListener('touchstart', () => {
                if (!this.isDetailMode()) {
                    navHomeBtn.classList.add('active');
                    this.resetCameraPosition();
                }
            });
            navHomeBtn.addEventListener('touchend', () => {
                navHomeBtn.classList.remove('active');
            });
        }

        // Обработчики клавиатуры
        this.setupKeyboardNavigation();
    }

    /**
     * Настройка кнопки навигации с поддержкой удержания
     */
    setupNavigationButton(button, direction) {
        if (!button) return;
        
        const startNavigation = () => {
            if (this.isDetailMode()) return;
            
            this.isNavigating = true;
            this.currentNavigationDirection = direction;
            button.classList.add('active');
            
            // Первое движение сразу
            this.handleNavigation(direction);
            
            // Затем непрерывное движение с интервалом
            this.navigationInterval = setInterval(() => {
                if (this.isNavigating && this.currentNavigationDirection === direction) {
                    this.handleNavigation(direction);
                }
            }, 50); // Обновление каждые 50мс для плавности
        };
        
        const stopNavigation = () => {
            this.isNavigating = false;
            this.currentNavigationDirection = null;
            button.classList.remove('active');
            
            if (this.navigationInterval) {
                clearInterval(this.navigationInterval);
                this.navigationInterval = null;
            }
        };
        
        // Обработчики мыши
        button.addEventListener('mousedown', (e) => {
            e.preventDefault();
            startNavigation();
        });
        
        button.addEventListener('mouseup', stopNavigation);
        button.addEventListener('mouseleave', stopNavigation);
        
        // Обработчики для touch (мобильные устройства)
        button.addEventListener('touchstart', (e) => {
            e.preventDefault();
            startNavigation();
        });
        
        button.addEventListener('touchend', stopNavigation);
        button.addEventListener('touchcancel', stopNavigation);
    }

    /**
     * Обработка навигации по направлению
     */
    handleNavigation(direction) {
        if (this.isDetailMode()) return;
        
        this.cameraManager.panTargetByDirection(direction, 1.0);
        this.onCameraUpdate();
    }

    /**
     * Сброс камеры в исходное положение
     */
    resetCameraPosition() {
        if (this.isDetailMode()) return;
        
        this.cameraManager.resetToInitialPosition();
        const newZoom = this.cameraManager.getZoom();
        this.updateCurrentZoom(newZoom);
        this.updateCameraZoom();
        this.onCameraUpdate();
    }

    /**
     * Настройка обработчиков клавиатуры для навигации
     */
    setupKeyboardNavigation() {
        const pressedKeys = new Set();
        
        document.addEventListener('keydown', (event) => {
            // Проверяем, что фокус не в input/textarea элементах
            const activeElement = document.activeElement;
            if (activeElement && (activeElement.tagName === 'INPUT' || activeElement.tagName === 'TEXTAREA')) {
                return;
            }

            // Блокируем в детальном режиме
            if (this.isDetailMode()) return;

            // Предотвращаем повторную обработку, если клавиша уже нажата
            if (pressedKeys.has(event.key)) {
                return;
            }

            let button = null;
            let direction = null;

            switch (event.key) {
                case 'ArrowUp':
                    event.preventDefault();
                    direction = 'up';
                    button = this.navButtons.up;
                    break;
                case 'ArrowDown':
                    event.preventDefault();
                    direction = 'down';
                    button = this.navButtons.down;
                    break;
                case 'ArrowLeft':
                    event.preventDefault();
                    direction = 'left';
                    button = this.navButtons.left;
                    break;
                case 'ArrowRight':
                    event.preventDefault();
                    direction = 'right';
                    button = this.navButtons.right;
                    break;
                case 'Home':
                    event.preventDefault();
                    button = this.navButtons.home;
                    break;
            }

            if (button) {
                pressedKeys.add(event.key);
                button.classList.add('active');
                
                if (direction) {
                    // Начинаем непрерывное панорамирование
                    this.isNavigating = true;
                    this.currentNavigationDirection = direction;
                    
                    // Первое движение сразу
                    this.handleNavigation(direction);
                    
                    // Затем непрерывное движение с интервалом
                    if (this.navigationInterval) {
                        clearInterval(this.navigationInterval);
                    }
                    this.navigationInterval = setInterval(() => {
                        if (this.isNavigating && this.currentNavigationDirection === direction) {
                            this.handleNavigation(direction);
                        }
                    }, 50);
                } else if (event.key === 'Home') {
                    this.resetCameraPosition();
                }
            }
        });

        document.addEventListener('keyup', (event) => {
            // Проверяем, что фокус не в input/textarea элементах
            const activeElement = document.activeElement;
            if (activeElement && (activeElement.tagName === 'INPUT' || activeElement.tagName === 'TEXTAREA')) {
                return;
            }

            let button = null;
            let direction = null;

            switch (event.key) {
                case 'ArrowUp':
                    direction = 'up';
                    button = this.navButtons.up;
                    break;
                case 'ArrowDown':
                    direction = 'down';
                    button = this.navButtons.down;
                    break;
                case 'ArrowLeft':
                    direction = 'left';
                    button = this.navButtons.left;
                    break;
                case 'ArrowRight':
                    direction = 'right';
                    button = this.navButtons.right;
                    break;
                case 'Home':
                    button = this.navButtons.home;
                    break;
            }

            if (button) {
                pressedKeys.delete(event.key);
                button.classList.remove('active');
                
                if (direction && this.currentNavigationDirection === direction) {
                    // Останавливаем непрерывное панорамирование
                    this.isNavigating = false;
                    this.currentNavigationDirection = null;
                    
                    if (this.navigationInterval) {
                        clearInterval(this.navigationInterval);
                        this.navigationInterval = null;
                    }
                }
            }
        });
    }

    /**
     * Блокировка элементов управления зумом в режиме детального просмотра
     */
    disableZoomControls() {
        const zoomInBtn = document.getElementById('zoom-in');
        const zoomOutBtn = document.getElementById('zoom-out');

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
    }

    /**
     * Разблокировка элементов управления зумом
     */
    enableZoomControls() {
        const zoomInBtn = document.getElementById('zoom-in');
        const zoomOutBtn = document.getElementById('zoom-out');

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
    }

    /**
     * Блокировка элементов управления навигацией в режиме детального просмотра
     */
    disableNavigationControls() {
        const navUpBtn = document.getElementById('nav-up');
        const navDownBtn = document.getElementById('nav-down');
        const navLeftBtn = document.getElementById('nav-left');
        const navRightBtn = document.getElementById('nav-right');
        const navHomeBtn = document.getElementById('nav-home');

        [navUpBtn, navDownBtn, navLeftBtn, navRightBtn, navHomeBtn].forEach(btn => {
            if (btn) {
                btn.style.opacity = '0.3';
                btn.style.pointerEvents = 'none';
                btn.disabled = true;
            }
        });
    }

    /**
     * Разблокировка элементов управления навигацией
     */
    enableNavigationControls() {
        const navUpBtn = document.getElementById('nav-up');
        const navDownBtn = document.getElementById('nav-down');
        const navLeftBtn = document.getElementById('nav-left');
        const navRightBtn = document.getElementById('nav-right');
        const navHomeBtn = document.getElementById('nav-home');

        [navUpBtn, navDownBtn, navLeftBtn, navRightBtn, navHomeBtn].forEach(btn => {
            if (btn) {
                btn.style.opacity = '1';
                btn.style.pointerEvents = 'auto';
                btn.disabled = false;
            }
        });
    }

    /**
     * Настройка layout контролов (слайдеры)
     */
    setupLayoutControls() {
        // Настройка навигационных контролов
        this.setupNavigationControls();
        
        // Логика сворачивания/разворачивания панели настроек
        const layoutControls = document.querySelector('.layout-controls');
        const layoutToggle = document.querySelector('.layout-toggle');
        
        if (layoutToggle && layoutControls) {
            // На мобильных сворачиваем панель по умолчанию
            const isMobile = isMobileDevice();
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
        
        // Слайдеры для layout параметров
        this.setupSpacingSlider();
        this.setupMarginSlider();
        this.setupGraphRotationSliders();
        this.setupFireflySliders();
        this.setupDetailModeSizeSlider();
        this.setupNodeSizeSliders();
        this.setupMaxWordsPerLineSlider();
    }

    setupSpacingSlider() {
        const spacingSlider = document.getElementById('spacing-factor');
        const spacingValue = document.getElementById('spacing-value');
        
        if (spacingSlider && spacingValue) {
            spacingSlider.addEventListener('input', debounce((event) => {
                const value = parseFloat(event.target.value);
                this.spacingFactor = value;
                spacingValue.textContent = value.toFixed(1);
                this.onSpacingFactorChange(value);
            }, 300));
        }
    }

    setupMarginSlider() {
        const marginSlider = document.getElementById('level-margin-factor');
        const marginValue = document.getElementById('level-margin-value');
        
        if (marginSlider && marginValue) {
            marginSlider.addEventListener('input', debounce((event) => {
                const value = parseFloat(event.target.value);
                this.levelMarginFactor = value;
                marginValue.textContent = value.toFixed(1);
                this.onLevelMarginFactorChange(value);
            }, 300));
        }
    }


    setupGraphRotationSliders() {
        // Вращение по X
        const graphRotationXSlider = document.getElementById('graph-rotation-x');
        const graphRotationXValue = document.getElementById('graph-rotation-x-value');
        if (graphRotationXSlider && graphRotationXValue) {
            graphRotationXSlider.value = String(this.graphRotation.x);
            graphRotationXValue.textContent = String(this.graphRotation.x);
            graphRotationXSlider.addEventListener('input', (event) => {
                const value = parseInt(event.target.value, 10);
                this.graphRotation.x = value;
                graphRotationXValue.textContent = String(value);
                this.onGraphRotationChange(this.graphRotation);
            });
        }
        
        // Вращение по Y
        const graphRotationYSlider = document.getElementById('graph-rotation-y');
        const graphRotationYValue = document.getElementById('graph-rotation-y-value');
        if (graphRotationYSlider && graphRotationYValue) {
            graphRotationYSlider.value = String(this.graphRotation.y);
            graphRotationYValue.textContent = String(this.graphRotation.y);
            graphRotationYSlider.addEventListener('input', (event) => {
                const value = parseInt(event.target.value, 10);
                this.graphRotation.y = value;
                graphRotationYValue.textContent = String(value);
                this.onGraphRotationChange(this.graphRotation);
            });
        }
        
        // Вращение по Z
        const graphRotationZSlider = document.getElementById('graph-rotation-z');
        const graphRotationZValue = document.getElementById('graph-rotation-z-value');
        if (graphRotationZSlider && graphRotationZValue) {
            graphRotationZSlider.value = String(this.graphRotation.z);
            graphRotationZValue.textContent = String(this.graphRotation.z);
            graphRotationZSlider.addEventListener('input', (event) => {
                const value = parseInt(event.target.value, 10);
                this.graphRotation.z = value;
                graphRotationZValue.textContent = String(value);
                this.onGraphRotationChange(this.graphRotation);
            });
        }
    }

    setupFireflySliders() {
        // Размер светлячков
        const fireflySizeSlider = document.getElementById('firefly-size');
        const fireflySizeValue = document.getElementById('firefly-size-value');
        if (fireflySizeSlider && fireflySizeValue) {
            fireflySizeSlider.value = String(this.fireflySize);
            fireflySizeValue.textContent = String(this.fireflySize);
            fireflySizeSlider.addEventListener('input', (event) => {
                const value = parseInt(event.target.value, 10);
                this.fireflySize = value;
                fireflySizeValue.textContent = String(value);
                this.onFireflySizeChange(value);
            });
        }
        
        // Радиус орбиты светлячков
        const fireflyRadiusSlider = document.getElementById('firefly-radius');
        const fireflyRadiusValue = document.getElementById('firefly-radius-value');
        if (fireflyRadiusSlider && fireflyRadiusValue) {
            fireflyRadiusSlider.value = String(this.fireflyOrbitRadius);
            fireflyRadiusValue.textContent = String(this.fireflyOrbitRadius);
            fireflyRadiusSlider.addEventListener('input', (event) => {
                const value = parseInt(event.target.value, 10);
                this.fireflyOrbitRadius = value;
                fireflyRadiusValue.textContent = String(value);
                this.onFireflyRadiusChange(value);
            });
        }
        
        // Скорость вращения светлячков
        const fireflySpeedSlider = document.getElementById('firefly-speed');
        const fireflySpeedValue = document.getElementById('firefly-speed-value');
        if (fireflySpeedSlider && fireflySpeedValue) {
            fireflySpeedSlider.value = String(this.fireflyRotationSpeed);
            fireflySpeedValue.textContent = String(this.fireflyRotationSpeed);
            fireflySpeedSlider.addEventListener('input', (event) => {
                const value = parseFloat(event.target.value);
                this.fireflyRotationSpeed = value;
                fireflySpeedValue.textContent = String(value);
                this.onFireflySpeedChange(value);
            });
        }
    }

    setupDetailModeSizeSlider() {
        const detailModeSizeSlider = document.getElementById('detail-mode-size');
        const detailModeSizeValue = document.getElementById('detail-mode-size-value');
        if (detailModeSizeSlider && detailModeSizeValue) {
            detailModeSizeSlider.value = String(this.DETAIL_MODE_SCREEN_SIZE_PERCENT);
            detailModeSizeValue.textContent = String(this.DETAIL_MODE_SCREEN_SIZE_PERCENT);
            detailModeSizeSlider.addEventListener('input', (event) => {
                const value = parseInt(event.target.value, 10);
                this.DETAIL_MODE_SCREEN_SIZE_PERCENT = value;
                detailModeSizeValue.textContent = String(value);
                this.onDetailModeSizeChange(value);
            });
        }
    }
    
    setupNodeSizeSliders() {
        // Слайдер для корневых узлов
        const rootRadiusSlider = document.getElementById('root-radius');
        const rootRadiusValue = document.getElementById('root-radius-value');
        if (rootRadiusSlider && rootRadiusValue) {
            rootRadiusSlider.value = String(this.rootRadius);
            rootRadiusValue.textContent = String(this.rootRadius);
            rootRadiusSlider.addEventListener('input', debounce((event) => {
                const value = parseInt(event.target.value, 10);
                this.rootRadius = value;
                rootRadiusValue.textContent = String(value);
                this.onRootRadiusChange(value);
            }, 300));
        }
        
        // Слайдер для обычных узлов
        const nodeRadiusSlider = document.getElementById('node-radius');
        const nodeRadiusValue = document.getElementById('node-radius-value');
        if (nodeRadiusSlider && nodeRadiusValue) {
            nodeRadiusSlider.value = String(this.nodeRadius);
            nodeRadiusValue.textContent = String(this.nodeRadius);
            nodeRadiusSlider.addEventListener('input', debounce((event) => {
                const value = parseInt(event.target.value, 10);
                this.nodeRadius = value;
                nodeRadiusValue.textContent = String(value);
                this.onNodeRadiusChange(value);
            }, 300));
        }
    }

    setupMaxWordsPerLineSlider() {
        const maxWordsPerLineSlider = document.getElementById('max-words-per-line');
        const maxWordsPerLineValue = document.getElementById('max-words-per-line-value');
        if (maxWordsPerLineSlider && maxWordsPerLineValue) {
            maxWordsPerLineSlider.value = String(this.maxWordsPerLine);
            maxWordsPerLineValue.textContent = String(this.maxWordsPerLine);
            maxWordsPerLineSlider.addEventListener('input', debounce((event) => {
                const value = parseInt(event.target.value, 10);
                this.maxWordsPerLine = value;
                maxWordsPerLineValue.textContent = String(value);
                this.onMaxWordsPerLineChange(value);
            }, 300));
        }
    }

    /**
     * Обновить параметры (для синхронизации с внешним состоянием)
     */
    updateParams(params) {
        if (params.spacingFactor !== undefined) this.spacingFactor = params.spacingFactor;
        if (params.levelMarginFactor !== undefined) this.levelMarginFactor = params.levelMarginFactor;
        if (params.graphRotation !== undefined) this.graphRotation = params.graphRotation;
        if (params.fireflySize !== undefined) this.fireflySize = params.fireflySize;
        if (params.fireflyOrbitRadius !== undefined) this.fireflyOrbitRadius = params.fireflyOrbitRadius;
        if (params.fireflyRotationSpeed !== undefined) this.fireflyRotationSpeed = params.fireflyRotationSpeed;
        if (params.rootRadius !== undefined) {
            this.rootRadius = params.rootRadius;
            const rootRadiusSlider = document.getElementById('root-radius');
            const rootRadiusValue = document.getElementById('root-radius-value');
            if (rootRadiusSlider && rootRadiusValue) {
                rootRadiusSlider.value = String(this.rootRadius);
                rootRadiusValue.textContent = String(this.rootRadius);
            }
        }
        if (params.nodeRadius !== undefined) {
            this.nodeRadius = params.nodeRadius;
            const nodeRadiusSlider = document.getElementById('node-radius');
            const nodeRadiusValue = document.getElementById('node-radius-value');
            if (nodeRadiusSlider && nodeRadiusValue) {
                nodeRadiusSlider.value = String(this.nodeRadius);
                nodeRadiusValue.textContent = String(this.nodeRadius);
            }
        }
        if (params.maxWordsPerLine !== undefined) {
            this.maxWordsPerLine = params.maxWordsPerLine;
            const maxWordsPerLineSlider = document.getElementById('max-words-per-line');
            const maxWordsPerLineValue = document.getElementById('max-words-per-line-value');
            if (maxWordsPerLineSlider && maxWordsPerLineValue) {
                maxWordsPerLineSlider.value = String(this.maxWordsPerLine);
                maxWordsPerLineValue.textContent = String(this.maxWordsPerLine);
            }
        }
    }
}

