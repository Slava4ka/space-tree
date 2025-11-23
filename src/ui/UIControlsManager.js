import * as THREE from 'three';
import { debounce } from 'lodash';
import { FIREFLY_CORE_SIZE_MULTIPLIER, SPHERE_SEGMENTS, SPHERE_RINGS } from '../utils/constants.js';

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
        this.selectedNode = options.selectedNode || null;
        
        // Callbacks для обновления параметров
        this.onSpacingFactorChange = options.onSpacingFactorChange || (() => {});
        this.onLevelMarginFactorChange = options.onLevelMarginFactorChange || (() => {});
        this.onGraphRotationChange = options.onGraphRotationChange || (() => {});
        this.onFireflySizeChange = options.onFireflySizeChange || (() => {});
        this.onFireflyRadiusChange = options.onFireflyRadiusChange || (() => {});
        this.onFireflySpeedChange = options.onFireflySpeedChange || (() => {});
        this.onDetailModeSizeChange = options.onDetailModeSizeChange || (() => {});
        
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
     * Настройка layout контролов (слайдеры)
     */
    setupLayoutControls() {
        // Логика сворачивания/разворачивания панели настроек
        const layoutControls = document.querySelector('.layout-controls');
        const layoutToggle = document.querySelector('.layout-toggle');
        
        if (layoutToggle && layoutControls) {
            // На мобильных сворачиваем панель по умолчанию
            const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
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
    }
}

