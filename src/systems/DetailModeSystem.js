/**
 * Система детального режима просмотра узлов
 * Управляет входом/выходом в детальный режим, анимациями и UI элементами
 */
import * as THREE from 'three';
import { TextureGenerator } from '../utils/TextureGenerator.js';
import { mockData } from '../mockData.js';
import {
  ROOT_RADIUS,
  NODE_RADIUS,
  ROOT_TEXT_SIZE,
  NODE_TEXT_SIZE,
  TEXT_COLOR,
  TEXT_STROKE_COLOR,
  TEXT_STROKE_WIDTH,
  TEXT_SCALE_FACTOR,
  TEXT_PADDING,
  WORD_LABEL_FONT_SIZE,
  WORD_LABEL_CANVAS_WIDTH,
  WORD_LABEL_CANVAS_HEIGHT,
  WORD_LABEL_SCALE_MULTIPLIER,
  WORD_LABEL_PLACEMENT_RADIUS,
  WORD_LABEL_FLOAT_AMPLITUDE,
  WORD_LABEL_FLOAT_SPEED
} from '../utils/constants.js';

export class DetailModeSystem {
  constructor(config) {
    // Зависимости
    this.scene = config.scene;
    this.camera = config.camera;
    this.cameraManager = config.cameraManager;
    this.treeGroups = config.treeGroups;
    this.fireflies = config.fireflies;
    this.nodeMeshes = config.nodeMeshes;
    this.controls = config.controls;
    
    // Callbacks для обновления состояния в main.js
    this.onZoomChange = config.onZoomChange || (() => {});
    this.onCameraTargetChange = config.onCameraTargetChange || (() => {});
    this.onCameraPositionChange = config.onCameraPositionChange || (() => {});
    this.onStateChange = config.onStateChange || (() => {});
    
    // Константы
    this.DETAIL_MODE_SCREEN_SIZE_PERCENT = config.DETAIL_MODE_SCREEN_SIZE_PERCENT || 22;
    this.DETAIL_MODE_ZOOM = config.DETAIL_MODE_ZOOM || 1.0;
    this.DETAIL_MODE_ANIMATION_TIME = config.DETAIL_MODE_ANIMATION_TIME || 1.0;
    this.DETAIL_MODE_ACTOR_RADIUS = config.DETAIL_MODE_ACTOR_RADIUS || 400;
    this.initialCameraDistance = config.initialCameraDistance || 1280.6;
    this.rootRadius = config.rootRadius || ROOT_RADIUS;
    this.nodeRadius = config.nodeRadius || NODE_RADIUS;
    this.rootTextSize = config.rootTextSize || ROOT_TEXT_SIZE;
    this.nodeTextSize = config.nodeTextSize || NODE_TEXT_SIZE;
    this.maxWordsPerLine = config.maxWordsPerLine || 5;
    
    // Состояние
    this.isDetailMode = false;
    this.detailModeNode = null;
    this.detailModeOverlay = null;
    this.detailModeExitButton = null;
    this.detailModeActorLabels = [];
    this.detailModeWordLabels = []; // Метки слов, созданные из светлячков
    this.isAnimatingFirefliesToWords = false; // Флаг анимации превращения светлячков в слова
    this.isAnimatingWordsToFireflies = false; // Флаг анимации превращения слов в светлячков
    this.detailModeOriginalStates = null;
    this.detailModeOriginalObjectStates = null;
    this.detailModeOriginalZoom = null;
    this.originalCameraPosition = null;
    this.originalCameraTarget = null;
    this.detailModeOriginalFireflyPositions = null;
    this.neonRingRotationY = 0; // Текущий угол поворота кольца в детальном режиме
    this.ringRays = null; // Лучи вокруг кольца для детального режима
    this.isAnimatingEnter = false; // Флаг для отслеживания анимации входа
  }

  /**
   * Проверить, идет ли анимация входа в детальный режим
   */
  isAnimatingEnterMode() {
    return this.isAnimatingEnter;
  }

  /**
   * Вход в режим детального просмотра
   */
  enter(nodeData, currentZoom, originalCameraPosition, originalCameraTarget) {
    this.isDetailMode = true;
    this.detailModeNode = nodeData;
    
    // Уведомляем main.js об изменении состояния
    if (this.onStateChange) {
      this.onStateChange(true, nodeData);
    }
    this.detailModeOriginalZoom = currentZoom;
    this.originalCameraPosition = originalCameraPosition;
    this.originalCameraTarget = originalCameraTarget;

    // Сохраняем исходные состояния всех деревьев и объектов
    this.detailModeOriginalStates = [];
    this.detailModeOriginalObjectStates = new Map();
    
    this.treeGroups.forEach(treeGroup => {
      this.detailModeOriginalStates.push({
        group: treeGroup,
        originalPosition: treeGroup.position.clone(),
        originalScale: treeGroup.scale.clone(),
        originalOpacity: treeGroup.children.length > 0 ? treeGroup.children[0].material.opacity : 1
      });
      
      // Сохраняем исходные значения opacity, transparent, depthTest, depthWrite и visible для каждого объекта
      treeGroup.traverse((object) => {
        // Сохраняем исходное состояние видимости
        const originalVisible = object.visible;
        
        if (object.material) {
          if (Array.isArray(object.material)) {
            const states = object.material.map(mat => ({
              opacity: mat.opacity,
              transparent: mat.transparent,
              depthTest: mat.depthTest,
              depthWrite: mat.depthWrite
            }));
            this.detailModeOriginalObjectStates.set(object, { 
              materials: states,
              visible: originalVisible
            });
          } else {
            this.detailModeOriginalObjectStates.set(object, {
              opacity: object.material.opacity,
              transparent: object.material.transparent,
              depthTest: object.material.depthTest,
              depthWrite: object.material.depthWrite,
              visible: originalVisible
            });
          }
        } else {
          // Сохраняем видимость даже если нет материала
          this.detailModeOriginalObjectStates.set(object, {
            visible: originalVisible
          });
        }
        // Также сохраняем для спрайтов
        if (object instanceof THREE.Sprite && object.material instanceof THREE.SpriteMaterial) {
          this.detailModeOriginalObjectStates.set(object, {
            opacity: object.material.opacity,
            transparent: object.material.transparent,
            depthTest: object.material.depthTest,
            depthWrite: object.material.depthWrite,
            visible: originalVisible
          });
        }
      });
    });

    // Сохраняем исходные позиции и смещения радиусов орбит светлячков выбранного узла
    this.detailModeOriginalFireflyPositions = new Map();
    const selectedNodeId = nodeData.node.id;
    this.fireflies.forEach((firefly) => {
      if (firefly.mesh && firefly.nodeId === selectedNodeId && firefly.nodePosition) {
        this.detailModeOriginalFireflyPositions.set(firefly, {
          position: firefly.nodePosition.clone(),
          orbitRadiusOffset: firefly.orbitRadiusOffset !== undefined ? firefly.orbitRadiusOffset : firefly.originalOrbitRadius
        });
      }
    });

    // Блокируем элементы управления зумом
    this.disableZoomControls();
    
    // Блокируем управление камерой мышью
    if (this.controls) {
      this.controls.disable();
    }

    // Создаем оверлей затемнения
    this.createOverlay();

    // Создаем кнопку выхода
    this.createExitButton();

    // Создаем лучи вокруг кольца
    this.createRingRays(nodeData);

    // Устанавливаем правильный renderOrder для всех элементов узла
    if (nodeData.mesh) {
      nodeData.mesh.renderOrder = 100; // Основной узел
      nodeData.mesh.traverse((child) => {
        // Устанавливаем renderOrder для всех дочерних элементов (все меньше 999 для текста)
        if (child instanceof THREE.LineSegments) {
          child.renderOrder = 200; // Обводки
        } else if (child instanceof THREE.Mesh) {
          if (child.renderOrder === undefined || child.renderOrder >= 999) {
            child.renderOrder = 100; // Основные элементы узла
          }
        } else {
          if (child.renderOrder === undefined || child.renderOrder >= 999) {
            child.renderOrder = 100;
          }
        }
      });
    }

    // Устанавливаем renderOrder для неонового кольца
    if (nodeData.neonRing) {
      nodeData.neonRing.renderOrder = 200; // Кольцо выше узла, но ниже текста
      nodeData.neonRing.traverse((child) => {
        if (child.renderOrder === undefined || child.renderOrder >= 999) {
          child.renderOrder = 200; // Дочерние элементы кольца ниже текста
        }
      });
    }

    // Перерисовываем текст с увеличенным разрешением для четкости в детальном режиме
    if (nodeData.textSprite) {
      this.updateNodeTextSpriteForDetailMode(nodeData);
    }

    // Сначала скрываем все графы, кроме выбранного узла
    this.hideAllGraphsExceptSelected(nodeData);

    // Затем запускаем анимацию входа в режим
    this.animateEnter(currentZoom, originalCameraPosition, originalCameraTarget);
  }

  /**
   * Выход из режима детального просмотра
   */
  exit() {
    // Сначала превращаем слова обратно в светлячков
    this.transformWordsToFireflies();

    // Запускаем анимацию зума сразу
    this.animateZoomRestore();

    // Запускаем анимацию возврата узла через 0.5 секунды
    setTimeout(() => {
      this.animateNodeReturn();
    }, 500);
  }

  /**
   * Проверка, активен ли детальный режим
   */
  isActive() {
    return this.isDetailMode;
  }

  /**
   * Получить текущий узел детального режима
   */
  getCurrentNode() {
    return this.detailModeNode;
  }

  /**
   * Обновить размер узла в детальном режиме (при изменении слайдера)
   */
  updateNodeScale() {
    if (!this.isDetailMode || !this.detailModeNode) return;

    const nodeData = this.detailModeNode;
    const targetScale = this.calculateScale(nodeData);
    const baseScale = nodeData.originalScale || new THREE.Vector3(1, 1, 1);
    const newScale = baseScale.clone().multiplyScalar(targetScale);
    
    nodeData.mesh.scale.copy(newScale);

    // Обновляем масштаб текста
    if (nodeData.textSprite && nodeData.originalSpriteScale) {
      const newSpriteScale = nodeData.originalSpriteScale.clone().multiplyScalar(targetScale);
      nodeData.textSprite.scale.copy(newSpriteScale);
    }
  }

  /**
   * Установить процент размера экрана для детального режима
   */
  setScreenSizePercent(percent) {
    this.DETAIL_MODE_SCREEN_SIZE_PERCENT = percent;
    if (this.isDetailMode) {
      this.updateNodeScale();
    }
  }

  // Приватные методы

  /**
   * Создание оверлея затемнения
   */
  createOverlay() {
    const geometry = new THREE.PlaneGeometry(50000, 50000);
    const texture = TextureGenerator.createRadialGradientTexture(1024, 1024);

    const material = new THREE.MeshBasicMaterial({
      map: texture,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      side: THREE.DoubleSide
    });

    const overlay = new THREE.Mesh(geometry, material);
    overlay.position.set(0, 0, -200);
    overlay.renderOrder = -2;

    this.scene.add(overlay);
    this.detailModeOverlay = overlay;
  }

  /**
   * Создание кнопки выхода
   */
  createExitButton() {
    const button = document.createElement('button');
    button.textContent = '×';
    button.className = 'zoom-btn detail-exit-btn';
    
    // Определяем мобильное устройство
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    
    // Устанавливаем стили с учетом типа устройства
    button.style.position = 'fixed';
    
    // На мобильных - левый нижний угол, на десктопе - правый верхний
    if (isMobile) {
      button.style.bottom = '15px';
      button.style.left = '15px';
      button.style.top = 'auto';
      button.style.right = 'auto';
    } else {
      button.style.top = '20px';
      button.style.right = '20px';
      button.style.bottom = 'auto';
      button.style.left = 'auto';
    }
    
    button.style.zIndex = '10000';
    button.style.width = isMobile ? '55px' : '50px';
    button.style.height = isMobile ? '55px' : '50px';
    button.style.fontSize = isMobile ? '36px' : '32px';
    button.style.opacity = '0';
    button.style.transition = 'all 0.3s ease-in-out';
    button.style.boxShadow = '0 6px 20px rgba(0, 0, 0, 0.7)';
    button.style.background = 'rgba(0, 0, 0, 0.85)';
    button.style.border = '2px solid rgba(255, 255, 255, 0.3)';
    button.style.display = 'flex';
    button.style.alignItems = 'center';
    button.style.justifyContent = 'center';
    button.style.lineHeight = '1';
    button.style.color = 'white';

    button.addEventListener('click', () => {
      this.exit();
    });
    
    // Улучшенный hover эффект для десктопа
    if (!isMobile) {
      button.addEventListener('mouseenter', () => {
        button.style.background = 'rgba(255, 0, 0, 0.8)';
        button.style.transform = 'scale(1.1)';
      });
      
      button.addEventListener('mouseleave', () => {
        button.style.background = 'rgba(0, 0, 0, 0.85)';
        button.style.transform = 'scale(1)';
      });
    }

    document.body.appendChild(button);
    this.detailModeExitButton = button;

    setTimeout(() => {
      button.style.opacity = '1';
    }, 100);
  }

  /**
   * Создание радиальных лучей вокруг кольца
   */
  createRingRays(nodeData) {
    if (!nodeData.neonRing) return;

    const ring = nodeData.neonRing;
    const ringRadius = ring.geometry.parameters.radius;
    const rayCount = 60; // Количество лучей
    const rayInnerRadius = ringRadius * 1.02; // Начало луча (сразу за кольцом)
    const rayOuterRadius = ringRadius * 1.6; // Конец луча
    const rayOpacity = 0.6; // Увеличили яркость лучей

    const rayGeometry = new THREE.BufferGeometry();
    const positions = [];

    // Создаем лучи
    for (let i = 0; i < rayCount; i++) {
      const angle = (i / rayCount) * Math.PI * 2;

      // Чередуем короткие и длинные лучи для визуального разнообразия
      const isLong = i % 3 === 0;
      const outerRadius = isLong ? rayOuterRadius : rayOuterRadius * 0.7;

      // Начальная точка луча (у кольца)
      const x1 = Math.cos(angle) * rayInnerRadius;
      const y1 = Math.sin(angle) * rayInnerRadius;
      const z1 = 0;

      // Конечная точка луча (снаружи)
      const x2 = Math.cos(angle) * outerRadius;
      const y2 = Math.sin(angle) * outerRadius;
      const z2 = 0;

      positions.push(x1, y1, z1, x2, y2, z2);
    }

    rayGeometry.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(positions, 3)
    );

    const rayMaterial = new THREE.LineBasicMaterial({
      color: 0xccffff, // Более яркий голубой/белый цвет
      transparent: true,
      opacity: 0, // Начинаем с 0 для анимации появления
      linewidth: 1,
    });

    const rays = new THREE.LineSegments(rayGeometry, rayMaterial);
    rays.renderOrder = 200; // Лучи кольца выше узла, но ниже текста
    rays.position.copy(ring.position);
    rays.userData.targetOpacity = rayOpacity;
    rays.userData.isRingRays = true;

    this.scene.add(rays);
    this.ringRays = rays;
  }

  /**
   * Скрыть все графы, кроме выбранного узла
   */
  hideAllGraphsExceptSelected(nodeData) {
    const selectedMesh = nodeData.mesh;
    const selectedTextSprite = nodeData.textSprite;
    const selectedNodeId = nodeData.node.id;
    
    // Находим treeGroup, содержащий выбранный узел
      const selectedTreeGroup = this.treeGroups.find(group => {
        let containsSelected = false;
        group.traverse((obj) => {
          if (obj === selectedMesh) {
            containsSelected = true;
          }
        });
        return containsSelected;
      });
      
    // Скрываем все графы
      this.treeGroups.forEach(treeGroup => {
        if (treeGroup === selectedTreeGroup) {
          // Внутри этого treeGroup скрываем только невыбранные объекты
          treeGroup.traverse((object) => {
          // Исключаем сам treeGroup из обработки
          if (object === treeGroup) {
            return;
          }
          
          // Исключаем выбранный узел, его текст и все дочерние элементы
          if (object === selectedMesh || object === selectedTextSprite) {
            object.visible = true;
            if (object.material) {
              if (Array.isArray(object.material)) {
                object.material.forEach(mat => {
                  mat.opacity = 1;
                  mat.transparent = false;
                });
              } else {
                object.material.opacity = 1;
                object.material.transparent = false;
              }
            }
            return;
          }
          
          // Исключаем неоновое кольцо выбранного узла и его дочерние элементы
          if (object === nodeData.neonRing || object.parent === nodeData.neonRing) {
            object.visible = true;
            return;
          }
          
          // Исключаем лучи вокруг кольца выбранного узла и его дочерние элементы
          if (object === this.ringRays || object.parent === this.ringRays) {
            object.visible = true;
            return;
          }
          
          // Проверяем, является ли объект светлячком выбранного узла
          const isSelectedFirefly = this.fireflies.some(firefly => 
            firefly.mesh === object && firefly.nodeId === selectedNodeId
          );
          if (isSelectedFirefly) {
            return;
          }
          
          // Проверяем, является ли объект дочерним элементом светлячка выбранного узла
          let isChildOfSelectedFirefly = false;
          let parentForFirefly = object.parent;
          while (parentForFirefly) {
            const isParentFirefly = this.fireflies.some(firefly => 
              firefly.mesh === parentForFirefly && firefly.nodeId === selectedNodeId
            );
            if (isParentFirefly) {
              isChildOfSelectedFirefly = true;
              break;
            }
            parentForFirefly = parentForFirefly.parent;
          }
          
          if (isChildOfSelectedFirefly) {
            return;
          }
          
          // Проверяем, является ли объект дочерним элементом выбранного узла
          let isChildOfSelected = false;
          let parent = object.parent;
          while (parent) {
            if (parent === selectedMesh) {
              isChildOfSelected = true;
              break;
            }
            parent = parent.parent;
          }
          
          if (isChildOfSelected) {
            return;
          }
          
          // Скрываем все остальные объекты
          object.visible = false;
          
          if (object.material) {
            if (Array.isArray(object.material)) {
              object.material.forEach(mat => {
                mat.opacity = 0;
                mat.transparent = true;
              });
            } else {
              object.material.opacity = 0;
              object.material.transparent = true;
            }
          }
        });
        } else {
          // Для остальных treeGroup скрываем все объекты
          treeGroup.traverse((object) => {
            // Исключаем сам treeGroup из обработки
            if (object === treeGroup) {
              return;
            }
            
          object.visible = false;
            
            if (object.material) {
              if (Array.isArray(object.material)) {
                object.material.forEach(mat => {
                mat.opacity = 0;
                  mat.transparent = true;
                });
              } else {
              object.material.opacity = 0;
                object.material.transparent = true;
              }
            }
          });
        }
      });
      
    // Скрываем все светлячки, кроме выбранного узла
    this.fireflies.forEach((firefly) => {
      if (firefly.mesh && firefly.nodeId !== selectedNodeId) {
        firefly.mesh.visible = false;
        if (firefly.mesh.material) {
          if (Array.isArray(firefly.mesh.material)) {
            firefly.mesh.material.forEach(mat => {
              mat.opacity = 0;
              mat.transparent = true;
            });
          } else {
            firefly.mesh.material.opacity = 0;
            firefly.mesh.material.transparent = true;
          }
        }
      }
    });
  }

  /**
   * Анимация входа в режим
   */
  animateEnter(currentZoom, originalCameraPosition, originalCameraTarget) {
    this.isAnimatingEnter = true; // Устанавливаем флаг начала анимации
    const startTime = Date.now();
    const duration = this.DETAIL_MODE_ANIMATION_TIME * 1000;
    const nodeData = this.detailModeNode;

    // Сохраняем originalPosition и originalScale, если они еще не сохранены
    if (!nodeData.originalPosition && nodeData.mesh) {
      nodeData.originalPosition = nodeData.mesh.position.clone();
    }
    if (!nodeData.originalScale && nodeData.mesh) {
      nodeData.originalScale = nodeData.mesh.scale.clone();
    }
    if (!nodeData.originalSpriteScale && nodeData.textSprite) {
      nodeData.originalSpriteScale = nodeData.textSprite.scale.clone();
    }

    // Находим treeGroup, содержащий выбранный узел
    const selectedTreeGroup = this.treeGroups.find(group => {
      let containsSelected = false;
      group.traverse((obj) => {
        if (obj === nodeData.mesh) {
          containsSelected = true;
        }
      });
      return containsSelected;
    });

    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const easedProgress = this.easeInOut(progress);

      // Скрываем все деревья, КРОМЕ выбранного узла и его текста
      const selectedMesh = nodeData.mesh;
      const selectedTextSprite = nodeData.textSprite;
      const selectedNodeId = nodeData.node.id;
      
      // ВАЖНО: Сначала явно показываем выбранный узел и все его дочерние элементы
      // Это нужно сделать ДО traverse, чтобы узел не был скрыт
      selectedMesh.visible = true;
      selectedMesh.renderOrder = 100; // Убеждаемся, что renderOrder правильный
      if (selectedMesh.material) {
        if (Array.isArray(selectedMesh.material)) {
          selectedMesh.material.forEach(mat => {
            mat.opacity = 1;
            mat.transparent = false;
          });
        } else {
          selectedMesh.material.opacity = 1;
          selectedMesh.material.transparent = false;
        }
      }
      
      // Показываем все дочерние элементы выбранного узла
      selectedMesh.traverse((child) => {
        child.visible = true;
        // Устанавливаем правильный renderOrder для дочерних элементов (все меньше 999 для текста)
        if (child instanceof THREE.LineSegments) {
          child.renderOrder = 200; // Обводки
        } else if (child.userData && child.userData.fireflyInstance) {
          child.renderOrder = 300; // Светлячки
        } else if (child instanceof THREE.Mesh) {
          // Для всех остальных мешей (включая shell) устанавливаем renderOrder меньше текста
          if (child.renderOrder === undefined || child.renderOrder >= 999) {
            child.renderOrder = 100; // Основные элементы узла
          }
        } else {
          // Для всех остальных элементов устанавливаем renderOrder меньше текста
          if (child.renderOrder === undefined || child.renderOrder >= 999) {
            child.renderOrder = 100;
          }
        }
        if (child.material) {
          if (Array.isArray(child.material)) {
            child.material.forEach(mat => {
              mat.opacity = 1;
              mat.transparent = false;
              // Убеждаемся, что материалы дочерних элементов не перекрывают текст
              if (mat.depthTest !== undefined) {
                mat.depthTest = true; // Включаем depth test для дочерних элементов
              }
            });
          } else {
            child.material.opacity = 1;
            child.material.transparent = false;
            // Убеждаемся, что материалы дочерних элементов не перекрывают текст
            if (child.material.depthTest !== undefined) {
              child.material.depthTest = true; // Включаем depth test для дочерних элементов
            }
          }
        }
      });

      // Скрываем текст во время анимации, показываем только после завершения
      if (selectedTextSprite) {
        selectedTextSprite.visible = progress >= 1; // Показываем только после завершения анимации
        selectedTextSprite.renderOrder = 999; // Убеждаемся, что renderOrder правильный для текста
        if (selectedTextSprite.material) {
          if (Array.isArray(selectedTextSprite.material)) {
            selectedTextSprite.material.forEach(mat => {
              mat.opacity = 1;
              mat.transparent = false;
              mat.depthTest = false; // Отключаем depth test для текста в режиме детализации
              mat.depthWrite = false;
            });
          } else {
            selectedTextSprite.material.opacity = 1;
            selectedTextSprite.material.transparent = false;
            selectedTextSprite.material.depthTest = false; // Отключаем depth test для текста в режиме детализации
            selectedTextSprite.material.depthWrite = false;
          }
        }
      }
      // Показываем неоновое кольцо выбранного узла
      if (nodeData.neonRing) {
          nodeData.neonRing.visible = true;
          // Устанавливаем renderOrder для кольца и его дочерних элементов
          if (nodeData.neonRing.renderOrder === undefined || nodeData.neonRing.renderOrder >= 999) {
            nodeData.neonRing.renderOrder = 200; // Кольцо выше узла, но ниже текста
          }
          nodeData.neonRing.traverse((child) => {
            child.visible = true;
            // Устанавливаем renderOrder для дочерних элементов кольца
            if (child.renderOrder === undefined || child.renderOrder >= 999) {
              child.renderOrder = 200; // Дочерние элементы кольца ниже текста
            }
          });
      }
      
      // Показываем светлячки выбранного узла
      this.fireflies.forEach((firefly) => {
        if (firefly.mesh && firefly.nodeId === selectedNodeId) {
          firefly.mesh.visible = true;
          firefly.mesh.renderOrder = 300; // Убеждаемся, что renderOrder правильный для светлячков
          firefly.mesh.traverse((child) => {
            if (child.material) {
              if (Array.isArray(child.material)) {
                child.material.forEach(mat => {
                  mat.opacity = 1;
                  mat.transparent = false;
                });
              } else {
                child.material.opacity = 1;
                child.material.transparent = false;
              }
            }
          });
        }
      });
      
      // Графы уже скрыты в методе hideAllGraphsExceptSelected(), 
      // поэтому здесь только анимируем выбранный узел
      selectedMesh.visible = true;
      if (selectedMesh.material) {
        if (Array.isArray(selectedMesh.material)) {
          selectedMesh.material.forEach(mat => {
            mat.opacity = 1;
            mat.transparent = false;
          });
        } else {
          selectedMesh.material.opacity = 1;
          selectedMesh.material.transparent = false;
        }
      }
      
      // Скрываем текст во время анимации, показываем только после завершения
      if (selectedTextSprite) {
        selectedTextSprite.visible = progress >= 1; // Показываем только после завершения анимации
        if (selectedTextSprite.material) {
          if (Array.isArray(selectedTextSprite.material)) {
            selectedTextSprite.material.forEach(mat => {
              mat.opacity = 1;
              mat.transparent = false;
            });
          } else {
            selectedTextSprite.material.opacity = 1;
            selectedTextSprite.material.transparent = false;
          }
        }
      }
      
      // Убеждаемся, что все дочерние элементы выбранного узла остаются видимыми
      selectedMesh.traverse((child) => {
        child.visible = true;
        if (child.material) {
          if (Array.isArray(child.material)) {
            child.material.forEach(mat => {
              mat.opacity = 1;
              mat.transparent = false;
            });
          } else {
            child.material.opacity = 1;
            child.material.transparent = false;
          }
        }
      });

      // Убеждаемся, что неоновое кольцо остается видимым
      if (nodeData.neonRing) {
        nodeData.neonRing.visible = true;
        nodeData.neonRing.traverse((child) => {
          child.visible = true;
        });
      }
      
      // ВАЖНО: Повторно устанавливаем видимость selectedTreeGroup после всех операций
      if (selectedTreeGroup) {
        selectedTreeGroup.visible = true;
      }
      
      // Увеличиваем и центрируем выбранный узел
      const targetScaleValue = this.calculateScale(nodeData);
      const baseScale = nodeData.originalScale || nodeData.mesh.scale.clone() || new THREE.Vector3(1, 1, 1);
      const targetScale = baseScale.clone().multiplyScalar(targetScaleValue);
      // Используем lerp для плавной анимации масштаба
      const currentScale = baseScale.clone().lerp(targetScale, easedProgress);
      nodeData.mesh.scale.copy(currentScale);

      // Масштабируем текст узла
      if (nodeData.textSprite) {
        const baseSpriteScale = nodeData.originalSpriteScale || nodeData.textSprite.scale.clone();
        const targetSpriteScale = baseSpriteScale.clone().multiplyScalar(targetScaleValue);
        // Используем lerp для плавной анимации масштаба текста
        nodeData.textSprite.scale.copy(baseSpriteScale.clone().lerp(targetSpriteScale, easedProgress));
      }

      // Центрируем узел в сцене
      const targetPosition = new THREE.Vector3(0, 0, 0);
      const originalPosition = nodeData.originalPosition || nodeData.mesh.position.clone();
      // Используем lerp для плавной анимации позиции
      nodeData.mesh.position.copy(originalPosition.clone().lerp(targetPosition, easedProgress));

      // Вычисляем текущую позицию узла для обновления светлячков
      const currentNodePosition = originalPosition.clone().lerp(targetPosition, easedProgress);

      // Обновляем позиции и смещения радиусов орбит светлячков выбранного узла синхронно с перемещением узла
      const averageScale = (currentScale.x + currentScale.y + currentScale.z) / 3;
      const nodeDataForFirefly = this.nodeMeshes.find(n => n.node.id === selectedNodeId);
      const baseNodeRadius = nodeDataForFirefly ? (nodeDataForFirefly.node.level === 0 ? this.rootRadius : this.nodeRadius) : this.nodeRadius;
      
      this.fireflies.forEach((firefly) => {
        if (firefly.mesh && firefly.nodeId === selectedNodeId && this.detailModeOriginalFireflyPositions) {
          const originalFireflyData = this.detailModeOriginalFireflyPositions.get(firefly);
          if (originalFireflyData) {
            // Обновляем nodePosition для светлячка (базовая позиция узла)
            const targetFireflyPosition = new THREE.Vector3(0, 0, 0);
            firefly.nodePosition = originalPosition.clone().lerp(targetFireflyPosition, easedProgress);
            
            // Обновляем смещение радиуса орбиты (оно будет использоваться в NodeAnimation)
            if (originalFireflyData.orbitRadiusOffset !== undefined) {
              firefly.orbitRadiusOffset = originalFireflyData.orbitRadiusOffset;
            }
            
            // Вычисляем текущий радиус орбиты с учетом масштаба узла
            const offset = firefly.orbitRadiusOffset !== undefined ? firefly.orbitRadiusOffset : (firefly.originalOrbitRadius || 65);
            const currentOrbitRadius = (baseNodeRadius * currentScale.x) + offset;
            
            // Вычисляем позицию на орбите относительно текущей позиции узла
            const orbitX = Math.cos(firefly.angle) * currentOrbitRadius;
            const orbitY = 0;
            const orbitZ = Math.sin(firefly.angle) * currentOrbitRadius;
            
            // Устанавливаем позицию светлячка напрямую, чтобы перезаписать то, что делает NodeAnimation
            firefly.mesh.position.set(
              currentNodePosition.x + orbitX,
              currentNodePosition.y + orbitY,
              currentNodePosition.z + orbitZ
            );
          }
        }
      });
      
      // Убеждаемся, что светлячки выбранного узла остаются видимыми (после обновления позиций)
      this.fireflies.forEach((firefly) => {
        if (firefly.mesh && firefly.nodeId === selectedNodeId) {
          // Убеждаемся, что светлячок видим и находится в сцене
          firefly.mesh.visible = true;
          
          // Если светлячок не имеет родителя, добавляем его в treeGroup
          if (!firefly.mesh.parent && selectedTreeGroup) {
            selectedTreeGroup.add(firefly.mesh);
          }
          
          firefly.mesh.traverse((child) => {
            child.visible = true;
            if (child.material) {
              if (Array.isArray(child.material)) {
                child.material.forEach(mat => {
                  mat.opacity = 1;
                  mat.transparent = false;
                });
              } else {
                child.material.opacity = 1;
                child.material.transparent = false;
              }
            }
          });
          
        }
      });
      

      // Удаляем только светлячки, которые НЕ принадлежат выбранному узлу
      if (progress === 0) {
        this.fireflies.forEach((firefly) => {
          if (firefly.mesh && firefly.mesh.parent) {
            if (firefly.nodeId !== selectedNodeId) {
              firefly.mesh.parent.remove(firefly.mesh);
            }
          }
        });
      }

      // Центрируем текст узла - добавляем дополнительное расстояние пропорционально масштабу
      // Центрируем и масштабируем неоновое кольцо вместе с узлом
      if (nodeData.neonRing) {
        // Сохраняем исходную позицию кольца, если еще не сохранена
        if (!nodeData.neonRingOriginalPosition) {
          nodeData.neonRingOriginalPosition = nodeData.neonRing.position.clone();
        }
        // Используем lerp для плавной анимации позиции кольца
        nodeData.neonRing.position.copy(nodeData.neonRingOriginalPosition.clone().lerp(targetPosition, easedProgress));
        nodeData.neonRing.scale.copy(currentScale);
        nodeData.neonRing.scale.multiplyScalar(1.05);
        // Сохраняем угол поворота для применения в updateSphereRotations
        this.neonRingRotationY = ((10 * Math.PI) / 180) * easedProgress;
      }

      // Обновляем лучи вокруг кольца
      if (this.ringRays) {
        this.ringRays.position.copy(targetPosition);
        this.ringRays.scale.copy(currentScale);
        this.ringRays.scale.multiplyScalar(1.05);
        // Анимируем появление лучей
        if (this.ringRays.material) {
          this.ringRays.material.opacity =
            this.ringRays.userData.targetOpacity * easedProgress;
        }
      }

      // Центрируем текст узла
      if (nodeData.textSprite) {
        const nodeRadius = (nodeData.node.level === 0 ? this.rootRadius : this.nodeRadius) * currentScale.x;
        // Добавляем дополнительное расстояние, чтобы текст всегда был спереди от увеличенного узла
        const extraDistance = Math.max(0, (currentScale.x - 1) * 100); // Увеличиваем коэффициент для надежности
        nodeData.textSprite.position.set(0, nodeRadius + 90 + extraDistance, 0);
      }

      // Показываем оверлей затемнения
      if (this.detailModeOverlay) {
        this.detailModeOverlay.material.opacity = easedProgress * 0.8;
      }

      // Создаем метки актеров в конце анимации
      if (progress >= 0.8 && this.detailModeActorLabels.length === 0) {
        this.createActorLabels();
      }

      // Анимируем зум к стандартному значению
      const targetZoom = this.DETAIL_MODE_ZOOM;
      const startZoom = this.detailModeOriginalZoom || currentZoom;
      const newZoom = THREE.MathUtils.lerp(startZoom, targetZoom, easedProgress);
      this.onZoomChange(newZoom);

      // Камера смотрит на центр
      const cameraTarget = new THREE.Vector3(0, 0, 0);
      this.onCameraTargetChange(cameraTarget);
      // Обновляем позицию камеры через callback, который вызовет updateCameraPosition
      this.camera.lookAt(cameraTarget);

      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        // Анимация завершена - показываем текст
        this.isAnimatingEnter = false; // Сбрасываем флаг завершения анимации
        if (selectedTextSprite) {
          selectedTextSprite.visible = true;
        }
        if (this.detailModeActorLabels.length === 0) {
          this.createActorLabels();
        }
        // Запускаем превращение светлячков в слова после завершения анимации открытия
        this.transformFirefliesToWords();
      }
    };

    animate();
  }

  /**
   * Анимация восстановления зума
   */
  animateZoomRestore() {
    const startTime = Date.now();
    const duration = this.DETAIL_MODE_ANIMATION_TIME * 1000;

    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const easedProgress = this.easeInOut(progress);

      // Анимируем зум обратно к исходному значению
      const targetZoom = this.detailModeOriginalZoom || this.DETAIL_MODE_ZOOM;
      const startZoom = this.DETAIL_MODE_ZOOM;
      const newZoom = THREE.MathUtils.lerp(startZoom, targetZoom, easedProgress);
      this.onZoomChange(newZoom);

      if (progress < 1) {
        requestAnimationFrame(animate);
      }
    };

    animate();
  }

  /**
   * Анимация возврата узла на место
   */
  animateNodeReturn() {
    const startTime = Date.now();
    const duration = this.DETAIL_MODE_ANIMATION_TIME * 1000;
    const nodeData = this.detailModeNode;
    
    // Проверяем, что nodeData существует
    if (!nodeData) {
      console.warn('animateNodeReturn: nodeData is null, skipping animation');
      return;
    }
    
    const selectedMesh = nodeData.mesh;
    
    // СРАЗУ в начале анимации возврата делаем узел видимым
    if (selectedMesh) {
      selectedMesh.visible = true;
      if (selectedMesh.material) {
        if (Array.isArray(selectedMesh.material)) {
          selectedMesh.material.forEach(mat => {
            mat.opacity = 1.0;
            mat.transparent = false;
          });
        } else {
          selectedMesh.material.opacity = 1.0;
          selectedMesh.material.transparent = false;
        }
      }
      // Убеждаемся, что все дочерние элементы видны
      selectedMesh.traverse((child) => {
        if (child !== selectedMesh) {
          child.visible = true;
          if (child.material) {
            if (Array.isArray(child.material)) {
              child.material.forEach(mat => {
                mat.opacity = 1.0;
                mat.transparent = false;
              });
            } else {
              child.material.opacity = 1.0;
              child.material.transparent = false;
            }
          }
        }
      });
    }

    const animate = () => {
      // Проверяем, что nodeData все еще существует
      if (!nodeData || !this.detailModeNode) {
        return;
      }
      
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const easedProgress = this.easeInOut(progress);

      const selectedTextSprite = nodeData.textSprite;
      
      // Находим treeGroup, содержащий выбранный узел
      const selectedTreeGroup = this.treeGroups.find(group => {
        let containsSelected = false;
        group.traverse((obj) => {
          if (obj === selectedMesh) {
            containsSelected = true;
          }
        });
        return containsSelected;
      });
      
      // СНАЧАЛА устанавливаем видимость для выбранного узла, чтобы он не был скрыт
      // Убеждаемся, что treeGroup с выбранным узлом видим
      if (selectedTreeGroup) {
        selectedTreeGroup.visible = true;
      }
      
      // Явно устанавливаем видимость для выбранного узла во время анимации
      selectedMesh.visible = true;
      // Убеждаемся, что материал узла видим и непрозрачный
      if (selectedMesh.material) {
        if (Array.isArray(selectedMesh.material)) {
          selectedMesh.material.forEach(mat => {
            mat.opacity = 1.0;
            mat.transparent = false;
          });
        } else {
          selectedMesh.material.opacity = 1.0;
          selectedMesh.material.transparent = false;
        }
      }
      
      // Убеждаемся, что все дочерние элементы узла видны
      selectedMesh.traverse((child) => {
        if (child !== selectedMesh) {
          child.visible = true;
          if (child.material) {
            if (Array.isArray(child.material)) {
              child.material.forEach(mat => {
                mat.opacity = 1.0;
                mat.transparent = false;
              });
            } else {
              child.material.opacity = 1.0;
              child.material.transparent = false;
            }
          }
        }
      });
      
      if (selectedTextSprite) {
        selectedTextSprite.visible = true;
        if (selectedTextSprite.material) {
          selectedTextSprite.material.opacity = 1.0;
          selectedTextSprite.material.transparent = false;
        }
      }
      
      // Убеждаемся, что неоновое кольцо остается видимым
      if (nodeData.neonRing) {
        nodeData.neonRing.visible = true;
        if (nodeData.neonRing.material) {
          if (Array.isArray(nodeData.neonRing.material)) {
            nodeData.neonRing.material.forEach(mat => {
              mat.opacity = 1.0;
              mat.transparent = false;
            });
          } else {
            nodeData.neonRing.material.opacity = 1.0;
            nodeData.neonRing.material.transparent = false;
          }
        }
        nodeData.neonRing.traverse((child) => {
          child.visible = true;
          if (child.material) {
            if (Array.isArray(child.material)) {
              child.material.forEach(mat => {
                mat.opacity = 1.0;
                mat.transparent = false;
              });
            } else {
              child.material.opacity = 1.0;
              child.material.transparent = false;
            }
          }
        });
      }
      
      // Скрываем радиальные лучи сразу в начале анимации возврата
      if (this.ringRays) {
        this.ringRays.visible = false;
      }
      
      // Во время анимации графы остаются скрытыми, показываем их под конец анимации (80% прогресса)
      if (progress >= 0.8) {
        // Вычисляем прогресс появления графов (от 0 до 1, когда progress от 0.8 до 1.0)
        const graphAppearProgress = (progress - 0.8) / 0.2; // Нормализуем от 0.8 до 1.0 в диапазон 0-1
        const graphOpacity = Math.min(graphAppearProgress, 1.0);
        
        // Восстанавливаем все деревья под конец анимации с плавным появлением
        this.treeGroups.forEach(treeGroup => {
          treeGroup.traverse((object) => {
            // Исключаем выбранный узел, его текст и все дочерние элементы
            if (object === selectedMesh || object === selectedTextSprite) {
              return;
            }
            
            // Исключаем неоновое кольцо выбранного узла и его дочерние элементы
            if (
              object === nodeData.neonRing ||
              object.parent === nodeData.neonRing
            ) {
              return;
            }
            // Проверяем, является ли объект дочерним элементом выбранного узла
            let isChildOfSelected = false;
            let parent = object.parent;
            while (parent) {
              if (parent === selectedMesh) {
                isChildOfSelected = true;
                break;
              }
              parent = parent.parent;
            }
            
            if (isChildOfSelected) {
              return;
            }
            
            // Восстанавливаем видимость всех остальных объектов
            object.visible = true;
            
            // Плавно восстанавливаем opacity для остальных объектов
            if (object.material) {
              if (Array.isArray(object.material)) {
                object.material.forEach(mat => {
                  mat.opacity = graphOpacity;
                  mat.transparent = graphOpacity < 1;
                });
              } else {
                object.material.opacity = graphOpacity;
                object.material.transparent = graphOpacity < 1;
              }
            }
          });
        });
        
        // Плавно восстанавливаем видимость всех светлячков
        this.fireflies.forEach((firefly) => {
          if (firefly.mesh) {
            firefly.mesh.visible = true;
            if (firefly.mesh.material) {
              if (Array.isArray(firefly.mesh.material)) {
                firefly.mesh.material.forEach(mat => {
                  mat.opacity = graphOpacity;
                  mat.transparent = graphOpacity < 1;
                });
              } else {
                firefly.mesh.material.opacity = graphOpacity;
                firefly.mesh.material.transparent = graphOpacity < 1;
              }
            }
          }
        });
      } else {
        // Во время анимации графы остаются скрытыми
        this.treeGroups.forEach(treeGroup => {
          treeGroup.traverse((object) => {
            // Исключаем выбранный узел, его текст и все дочерние элементы
            if (object === selectedMesh || object === selectedTextSprite) {
              return;
            }
            
            // Исключаем неоновое кольцо выбранного узла и его дочерние элементы
            if (
              object === nodeData.neonRing ||
              object.parent === nodeData.neonRing
            ) {
              return;
            }
            // Проверяем, является ли объект дочерним элементом выбранного узла
            let isChildOfSelected = false;
            let parent = object.parent;
            while (parent) {
              if (parent === selectedMesh) {
                isChildOfSelected = true;
                break;
              }
              parent = parent.parent;
            }
            
            if (isChildOfSelected) {
              return;
            }
            
            // Графы остаются скрытыми во время анимации
            object.visible = false;
            
            if (object.material) {
              if (Array.isArray(object.material)) {
                object.material.forEach(mat => {
                  mat.opacity = 0;
                  mat.transparent = true;
                });
              } else {
                object.material.opacity = 0;
                object.material.transparent = true;
              }
            }
          });
        });
        
        // Светлячки также остаются скрытыми во время анимации
        this.fireflies.forEach((firefly) => {
          if (firefly.mesh && firefly.nodeId !== nodeData.node.id) {
            firefly.mesh.visible = false;
            if (firefly.mesh.material) {
              if (Array.isArray(firefly.mesh.material)) {
                firefly.mesh.material.forEach(mat => {
                  mat.opacity = 0;
                  mat.transparent = true;
                });
              } else {
                firefly.mesh.material.opacity = 0;
                firefly.mesh.material.transparent = true;
              }
            }
          }
        });
      }
      
      // КРИТИЧЕСКИ ВАЖНО: Устанавливаем видимость узла ПОСЛЕ блока скрытия графов,
      // чтобы гарантировать, что он не будет скрыт
      // Убеждаемся, что все родительские элементы узла видимы
      let parent = selectedMesh.parent;
      while (parent && parent !== this.scene) {
        parent.visible = true;
        parent = parent.parent;
      }
      
      // УБЕЖДАЕМСЯ, ЧТО УЗЕЛ ВИДЕН - устанавливаем видимость и материал КАЖДЫЙ КАДР
      selectedMesh.visible = true;
      if (selectedMesh.material) {
        if (Array.isArray(selectedMesh.material)) {
          selectedMesh.material.forEach(mat => {
            mat.opacity = 1.0;
            mat.transparent = false;
          });
        } else {
          selectedMesh.material.opacity = 1.0;
          selectedMesh.material.transparent = false;
        }
      }
      
      // Убеждаемся, что все дочерние элементы узла видны (включая shell, wireLines и т.д.)
      selectedMesh.traverse((child) => {
        if (child !== selectedMesh) {
          child.visible = true;
          if (child.material) {
            if (Array.isArray(child.material)) {
              child.material.forEach(mat => {
                mat.opacity = 1.0;
                mat.transparent = false;
              });
            } else {
              child.material.opacity = 1.0;
              child.material.transparent = false;
            }
          }
        }
      });
      
      // Убеждаемся, что неоновое кольцо видимо
      if (nodeData.neonRing) {
        nodeData.neonRing.visible = true;
        if (nodeData.neonRing.material) {
          if (Array.isArray(nodeData.neonRing.material)) {
            nodeData.neonRing.material.forEach(mat => {
              mat.opacity = 1.0;
              mat.transparent = false;
            });
          } else {
            nodeData.neonRing.material.opacity = 1.0;
            nodeData.neonRing.material.transparent = false;
          }
        }
        nodeData.neonRing.traverse((child) => {
          child.visible = true;
          if (child.material) {
            if (Array.isArray(child.material)) {
              child.material.forEach(mat => {
                mat.opacity = 1.0;
                mat.transparent = false;
              });
            } else {
              child.material.opacity = 1.0;
              child.material.transparent = false;
            }
          }
        });
      }
      
      // В конце анимации (когда progress = 1) восстанавливаем исходные значения
      if (progress >= 1) {
        // Восстанавливаем исходное состояние видимости обводки выбранного узла
        if (this.detailModeOriginalObjectStates) {
          selectedMesh.traverse((child) => {
            if (child !== selectedMesh && child instanceof THREE.LineSegments && child.renderOrder === 200) {
              const originalState = this.detailModeOriginalObjectStates.get(child);
              if (originalState && originalState.visible !== undefined) {
                child.visible = originalState.visible;
              }
            }
          });
          
          // Восстанавливаем материалы выбранного узла
          const originalMeshState = this.detailModeOriginalObjectStates.get(selectedMesh);
          if (originalMeshState) {
            if (selectedMesh.material) {
              if (Array.isArray(selectedMesh.material) && originalMeshState.materials) {
                selectedMesh.material.forEach((mat, index) => {
                  if (originalMeshState.materials[index]) {
                    mat.opacity = originalMeshState.materials[index].opacity;
                    mat.transparent = originalMeshState.materials[index].transparent;
                    mat.depthTest = originalMeshState.materials[index].depthTest;
                    mat.depthWrite = originalMeshState.materials[index].depthWrite;
                  }
                });
              } else if (!Array.isArray(selectedMesh.material)) {
                selectedMesh.material.opacity = originalMeshState.opacity;
                selectedMesh.material.transparent = originalMeshState.transparent;
                selectedMesh.material.depthTest = originalMeshState.depthTest;
                selectedMesh.material.depthWrite = originalMeshState.depthWrite;
              }
            }
          }
        }
        
        // Восстанавливаем материалы всех объектов
        if (this.detailModeOriginalObjectStates) {
          this.treeGroups.forEach(treeGroup => {
            treeGroup.traverse((object) => {
              // Восстанавливаем исходное состояние видимости из сохраненных данных
              const originalState = this.detailModeOriginalObjectStates.get(object);
              if (originalState && originalState.visible !== undefined) {
                object.visible = originalState.visible;
              } else {
                // Если состояние не сохранено, делаем видимым (по умолчанию)
                object.visible = true;
              }
              
              // Восстанавливаем исходные значения opacity и transparent
              if (originalState) {
                if (object.material) {
                  if (Array.isArray(object.material) && originalState.materials) {
                    object.material.forEach((mat, index) => {
                      if (originalState.materials[index]) {
                        mat.opacity = originalState.materials[index].opacity;
                        mat.transparent = originalState.materials[index].transparent;
                        mat.depthTest = originalState.materials[index].depthTest;
                        mat.depthWrite = originalState.materials[index].depthWrite;
                      }
                    });
                  } else if (!Array.isArray(object.material)) {
                    object.material.opacity = originalState.opacity;
                    object.material.transparent = originalState.transparent;
                    object.material.depthTest = originalState.depthTest;
                    object.material.depthWrite = originalState.depthWrite;
                  }
                }
                
                if (object instanceof THREE.Sprite && object.material instanceof THREE.SpriteMaterial) {
                  object.material.opacity = originalState.opacity;
                  object.material.transparent = originalState.transparent;
                  object.material.depthTest = originalState.depthTest;
                  object.material.depthWrite = originalState.depthWrite;
                }
              }
            });
          });
        }
      }
      
      if (selectedTextSprite && selectedTextSprite.material) {
        selectedTextSprite.material.opacity = 1;
        selectedTextSprite.material.transparent = false;
      }

      // Добавляем светлячки обратно в treeGroup
      this.fireflies.forEach(firefly => {
        if (firefly.mesh && firefly.nodeId !== undefined) {
          const treeGroup = this.treeGroups.find(group =>
            group.children.some(child =>
              child.userData && child.userData.node && child.userData.node.id === firefly.nodeId
            )
          );
          if (treeGroup && !firefly.mesh.parent) {
            treeGroup.add(firefly.mesh);
          }
        }
      });

      // Возвращаем выбранный узел к исходному состоянию
      const detailScaleValue = this.calculateScale(nodeData);
      const baseScale = nodeData.originalScale || new THREE.Vector3(1, 1, 1);
      const detailScale = baseScale.clone().multiplyScalar(detailScaleValue);
      const currentScale = detailScale.clone().lerp(baseScale, easedProgress);
      nodeData.mesh.scale.copy(currentScale);

      if (nodeData.textSprite && nodeData.originalSpriteScale) {
        const detailSpriteScale = nodeData.originalSpriteScale.clone().multiplyScalar(detailScaleValue);
        nodeData.textSprite.scale.lerp(nodeData.originalSpriteScale, easedProgress);
      }

      // Возвращаем позицию узла
      const originalPosition = nodeData.originalPosition;
      const centerPosition = new THREE.Vector3(0, 0, 0);
      nodeData.mesh.position.lerp(originalPosition, easedProgress);

      // Вычисляем текущую позицию узла для обновления светлячков
      // В начале анимации узел в центре (0, 0, 0), в конце - в originalPosition
      const currentNodePosition = centerPosition.clone().lerp(originalPosition, easedProgress);

      // Обновляем позиции и смещения радиусов орбит светлячков выбранного узла синхронно с возвратом узла
      const selectedNodeId = nodeData.node.id;
      const averageScale = (currentScale.x + currentScale.y + currentScale.z) / 3;
      this.fireflies.forEach((firefly) => {
        if (firefly.mesh && firefly.nodeId === selectedNodeId && firefly.nodePosition && this.detailModeOriginalFireflyPositions) {
          const originalFireflyData = this.detailModeOriginalFireflyPositions.get(firefly);
          if (originalFireflyData) {
            // Вычисляем смещение узла от центра к исходной позиции
            const nodePositionOffset = currentNodePosition.clone().sub(originalPosition);
            firefly.nodePosition.copy(originalFireflyData.position.clone().add(nodePositionOffset));
            // Обновляем смещение радиуса орбиты (оно будет использоваться в NodeAnimation)
            if (originalFireflyData.orbitRadiusOffset !== undefined) {
              firefly.orbitRadiusOffset = originalFireflyData.orbitRadiusOffset;
            }
          }
        }
      });
      // Возвращаем позицию и масштаб неонового кольца вместе с узлом
      if (nodeData.neonRing) {
        nodeData.neonRing.position.lerp(originalPosition, easedProgress);
        nodeData.neonRing.scale.copy(currentScale);
        // Сохраняем угол поворота для применения в updateSphereRotations
        this.neonRingRotationY = ((6 * Math.PI) / 180) * (1 - easedProgress);
      }

      // Возвращаем позицию текста
      if (nodeData.textSprite) {
        const nodeRadius = (nodeData.node.level === 0 ? this.rootRadius : this.nodeRadius) * currentScale.x;
        const textPos = new THREE.Vector3(
          originalPosition.x,
          originalPosition.y + nodeRadius + 90,
          originalPosition.z
        );
        nodeData.textSprite.position.lerp(textPos, easedProgress);
      }

      // Лучи уже скрыты в начале анимации, просто обновляем их позицию для корректности
      if (this.ringRays) {
        this.ringRays.visible = false; // Убеждаемся, что лучи скрыты
        this.ringRays.position.lerp(originalPosition, easedProgress);
        this.ringRays.scale.copy(currentScale);
      }

      // Скрываем оверлей
      if (this.detailModeOverlay) {
        this.detailModeOverlay.material.opacity = (1 - easedProgress) * 0.8;
      }

      // Скрываем метки актеров
      this.detailModeActorLabels.forEach(label => {
        if (label.sprite) {
          label.sprite.material.opacity = 1 - easedProgress;
        }
      });

      // Скрываем кнопку выхода
      if (this.detailModeExitButton) {
        this.detailModeExitButton.style.opacity = 1 - easedProgress;
      }

      // Возвращаем камеру к исходной позиции
      if (this.originalCameraTarget) {
        // Плавно возвращаем камеру к исходной позиции
        // В детальном режиме камера смотрит на (0,0,0), поэтому lerp от (0,0,0) к originalCameraTarget
        const currentTarget = new THREE.Vector3(0, 0, 0);
        const newTarget = currentTarget.clone().lerp(this.originalCameraTarget, easedProgress);
        this.onCameraTargetChange(newTarget);
        this.camera.lookAt(newTarget);
      }

      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        // Очищаем режим
        this.cleanup();
      }
    };

    animate();
  }

  /**
   * Очистка режима детального просмотра
   */
  cleanup() {
    // Удаляем оверлей
    if (this.detailModeOverlay) {
      this.scene.remove(this.detailModeOverlay);
      this.detailModeOverlay.geometry.dispose();
      this.detailModeOverlay.material.dispose();
      this.detailModeOverlay = null;
    }

    // Удаляем кнопку выхода
    if (this.detailModeExitButton) {
      document.body.removeChild(this.detailModeExitButton);
      this.detailModeExitButton = null;
    }

    // Удаляем метки актеров
    this.detailModeActorLabels.forEach(label => {
      if (label.sprite) {
        this.scene.remove(label.sprite);
        label.sprite.geometry.dispose();
        label.sprite.material.dispose();
      }
    });
    this.detailModeActorLabels = [];

    // Удаляем метки слов
    this.detailModeWordLabels.forEach(label => {
      if (label.sprite) {
        this.scene.remove(label.sprite);
        if (label.sprite.geometry) {
          label.sprite.geometry.dispose();
        }
        if (label.sprite.material) {
          if (label.sprite.material.map) {
            label.sprite.material.map.dispose();
          }
          label.sprite.material.dispose();
        }
      }
    });
    this.detailModeWordLabels = [];
    this.isAnimatingFirefliesToWords = false; // Сбрасываем флаг анимации
    this.isAnimatingWordsToFireflies = false; // Сбрасываем флаг обратной анимации

    // Удаляем лучи вокруг кольца
    if (this.ringRays) {
      this.scene.remove(this.ringRays);
      this.ringRays.geometry.dispose();
      this.ringRays.material.dispose();
      this.ringRays = null;
    }

    // Восстанавливаем деревья - восстанавливаем исходные значения opacity, transparent и visible
    if (this.detailModeOriginalObjectStates) {
      this.treeGroups.forEach(treeGroup => {
        treeGroup.traverse((object) => {
          // Восстанавливаем исходное состояние видимости из сохраненных данных
          const originalState = this.detailModeOriginalObjectStates.get(object);
          if (originalState && originalState.visible !== undefined) {
            object.visible = originalState.visible;
          } else {
            // Если состояние не сохранено, делаем видимым (по умолчанию)
            object.visible = true;
          }
          
          // Восстанавливаем исходные значения opacity и transparent
          if (originalState) {
            if (object.material) {
              if (Array.isArray(object.material) && originalState.materials) {
                object.material.forEach((mat, index) => {
                  if (originalState.materials[index]) {
                    mat.opacity = originalState.materials[index].opacity;
                    mat.transparent = originalState.materials[index].transparent;
                    mat.depthTest = originalState.materials[index].depthTest;
                    mat.depthWrite = originalState.materials[index].depthWrite;
                  }
                });
              } else if (!Array.isArray(object.material)) {
                object.material.opacity = originalState.opacity;
                object.material.transparent = originalState.transparent;
                object.material.depthTest = originalState.depthTest;
                object.material.depthWrite = originalState.depthWrite;
              }
            }
            
            if (object instanceof THREE.Sprite && object.material instanceof THREE.SpriteMaterial) {
              object.material.opacity = originalState.opacity;
              object.material.transparent = originalState.transparent;
              object.material.depthTest = originalState.depthTest;
              object.material.depthWrite = originalState.depthWrite;
              object.visible = true;
            }
          } else {
            // Если не нашли сохраненное состояние, устанавливаем значения по умолчанию
            if (object.material) {
              if (Array.isArray(object.material)) {
                object.material.forEach(mat => {
                  mat.opacity = 1.0;
                  mat.transparent = false;
                });
              } else {
                object.material.opacity = 1.0;
                object.material.transparent = false;
              }
            }
          }
        });
      });
    }
    
    this.detailModeOriginalStates = null;
    if (this.detailModeOriginalObjectStates) {
      this.detailModeOriginalObjectStates.clear();
    }
    this.detailModeOriginalObjectStates = null;
    if (this.detailModeOriginalFireflyPositions) {
      this.detailModeOriginalFireflyPositions.clear();
    }
    this.detailModeOriginalFireflyPositions = null;

    // Разблокируем элементы управления зумом
    this.enableZoomControls();
    
    // Разблокируем управление камерой мышью
    if (this.controls) {
      this.controls.enable();
    }

    // Сбрасываем флаги
    this.isDetailMode = false;
    this.detailModeNode = null;
    this.detailModeOriginalZoom = null;
    this.originalCameraPosition = null;
    this.originalCameraTarget = null;
    this.neonRingRotationY = 0; // Сбрасываем угол поворота кольца
    // Вызываем callback для обновления состояния в main.js
    if (this.onStateChange) {
      this.onStateChange(false, null);
    }
  }

  /**
   * Обновление сохраненных смещений радиусов орбит светлячков при изменении смещения
   * Вызывается при изменении смещения радиуса орбиты в детальном режиме
   */
  updateFireflyOrbitRadius(newOffset) {
    if (!this.isDetailMode || !this.detailModeNode || !this.detailModeOriginalFireflyPositions) {
      return;
    }

    const selectedNodeId = this.detailModeNode.node.id;

    // Обновляем сохраненные смещения для светлячков выбранного узла
    this.fireflies.forEach((firefly) => {
      if (firefly.mesh && firefly.nodeId === selectedNodeId && this.detailModeOriginalFireflyPositions) {
        const originalFireflyData = this.detailModeOriginalFireflyPositions.get(firefly);
        if (originalFireflyData) {
          // Сохраняем новое смещение
          originalFireflyData.orbitRadiusOffset = newOffset;
        }
      }
    });
  }

  /**
   * Создание текстовых меток актеров по кругу
   */
  createActorLabels() {
    if (!this.detailModeNode) {
      return;
    }

    const nodeData = this.detailModeNode;
    const taskId = nodeData.node.id;

    // Находим технологии для этой задачи
    const technologies = mockData.filter(item => item.parentId === taskId);

    if (technologies.length === 0) {
      technologies.push({ text: 'Нет информации о технологиях' });
    }

    const radius = this.DETAIL_MODE_ACTOR_RADIUS;
    const angleStep = (Math.PI * 2) / technologies.length;

    technologies.forEach((technology, index) => {
      const angle = index * angleStep;

      // Позиция метки по кругу
      const x = Math.cos(angle) * radius;
      const z = Math.sin(angle) * radius;
      const y = 0;

      // Создаем текстовый спрайт
      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d');

      const fontSize = 24;
      context.font = `bold ${fontSize}px Arial`;

      const textWidth = context.measureText(technology.text).width;
      const textHeight = fontSize;

      canvas.width = (textWidth + TEXT_PADDING) * TEXT_SCALE_FACTOR;
      canvas.height = (textHeight + TEXT_PADDING) * TEXT_SCALE_FACTOR;
      context.scale(TEXT_SCALE_FACTOR, TEXT_SCALE_FACTOR);
      context.font = `bold ${fontSize}px Arial`;
      context.textAlign = 'center';
      context.textBaseline = 'middle';

      // Рисуем текст с обводкой
      context.fillStyle = TEXT_COLOR;
      context.strokeStyle = TEXT_STROKE_COLOR;
      context.lineWidth = TEXT_STROKE_WIDTH;
      context.strokeText(technology.text, (textWidth + TEXT_PADDING) / 2, (textHeight + TEXT_PADDING) / 2);
      context.fillText(technology.text, (textWidth + TEXT_PADDING) / 2, (textHeight + TEXT_PADDING) / 2);

      const texture = new THREE.CanvasTexture(canvas);
      texture.needsUpdate = true;

      const spriteMaterial = new THREE.SpriteMaterial({
        map: texture,
        transparent: true,
        opacity: 0,
        alphaTest: 0.1
      });

      const sprite = new THREE.Sprite(spriteMaterial);
      sprite.position.set(x, y, z);
      sprite.scale.set((canvas.width / TEXT_SCALE_FACTOR) * 0.8, (canvas.height / TEXT_SCALE_FACTOR) * 0.8, 1);
      sprite.renderOrder = 2;

      this.scene.add(sprite);

      this.detailModeActorLabels.push({
        sprite: sprite,
        technology: technology,
        originalPosition: sprite.position.clone()
      });
    });

    // Анимируем появление меток актеров
    this.animateActorLabelsAppearance();
  }

  /**
   * Анимация появления меток актеров
   */
  animateActorLabelsAppearance() {
    const startTime = Date.now();
    const duration = 0.5 * 1000;

    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const easedProgress = this.easeInOut(progress);

      this.detailModeActorLabels.forEach((label, index) => {
        const delay = index * 0.1;
        const delayedProgress = Math.max(0, progress - delay);

        if (label.sprite) {
          label.sprite.material.opacity = delayedProgress;
          const scale = 0.8 + delayedProgress * 0.2;
          label.sprite.scale.set(
            label.sprite.scale.x * scale / label.sprite.scale.x,
            label.sprite.scale.y * scale / label.sprite.scale.y,
            1
          );
        }
      });

      if (progress < 1) {
        requestAnimationFrame(animate);
      }
    };

    animate();
  }

  /**
   * Создание текстовой метки из данных светлячка
   * @param {Object} firefly - Объект светлячка
   * @param {THREE.Vector3} startPosition - Начальная позиция (позиция светлячка)
   * @param {THREE.Vector3} targetPosition - Финальная позиция слова
   * @returns {Object} Объект с данными метки слова
   */
  createWordLabel(firefly, startPosition, targetPosition) {
    if (!firefly.mesh || !firefly.mesh.userData.technology) {
      return null;
    }

    const technology = firefly.mesh.userData.technology;
    const text = technology.text || '';

    // Создаем текстовый спрайт
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');

    const fontSize = WORD_LABEL_FONT_SIZE; // Одинаковый размер для всех надписей
    const lineHeight = fontSize * 1.2; // Межстрочный интервал
    context.font = `bold ${fontSize}px Arial`;

    // Разбиваем текст на строки (максимум 2 слова в строке)
    const lines = this.splitTextIntoLines(text, 2);

    // Измеряем ширину каждой строки и находим максимальную
    let maxTextWidth = 0;
    lines.forEach(line => {
      const metrics = context.measureText(line);
      const width = metrics.width;
      if (width > maxTextWidth) {
        maxTextWidth = width;
      }
    });

    // Рассчитываем реальную высоту текста
    const totalTextHeight = lines.length * lineHeight - (lineHeight - fontSize);

    // Рассчитываем размеры canvas на основе реального размера текста + отступы
    // Используем максимальное значение между реальным размером и минимальным фиксированным размером
    const minCanvasWidth = WORD_LABEL_CANVAS_WIDTH;
    const minCanvasHeight = WORD_LABEL_CANVAS_HEIGHT;
    
    const canvasWidth = Math.max(minCanvasWidth, maxTextWidth + TEXT_PADDING * 2);
    const canvasHeight = Math.max(minCanvasHeight, totalTextHeight + TEXT_PADDING * 2);

    // Увеличиваем разрешение canvas для четкости
    canvas.width = canvasWidth * TEXT_SCALE_FACTOR;
    canvas.height = canvasHeight * TEXT_SCALE_FACTOR;
    context.scale(TEXT_SCALE_FACTOR, TEXT_SCALE_FACTOR);

    // Перерисовываем текст
    context.fillStyle = TEXT_COLOR;
    context.strokeStyle = TEXT_STROKE_COLOR;
    context.lineWidth = TEXT_STROKE_WIDTH;
    context.font = `bold ${fontSize}px Arial`;
    context.textAlign = 'center';
    context.textBaseline = 'middle';

    // Рисуем каждую строку с правильным вертикальным смещением внутри canvas
    const centerX = canvasWidth / 2; // Центр по горизонтали
    const canvasCenterY = canvasHeight / 2; // Центр canvas по вертикали
    const startY = canvasCenterY - (totalTextHeight / 2) + (fontSize / 2);

    lines.forEach((line, index) => {
      const y = startY + index * lineHeight;
      context.strokeText(line, centerX, y);
      context.fillText(line, centerX, y);
    });

    const texture = new THREE.CanvasTexture(canvas);
    texture.needsUpdate = true;

    const spriteMaterial = new THREE.SpriteMaterial({
      map: texture,
      transparent: true,
      opacity: 0, // Начинаем с 0 для анимации
      alphaTest: 0.1,
      depthTest: false,
      depthWrite: false
    });

    const sprite = new THREE.Sprite(spriteMaterial);
    sprite.position.copy(startPosition); // Начинаем с позиции светлячка
    // Масштабируем спрайт пропорционально реальным размерам canvas
    // Это гарантирует, что весь текст будет виден
    sprite.scale.set(
      canvasWidth * WORD_LABEL_SCALE_MULTIPLIER,
      canvasHeight * WORD_LABEL_SCALE_MULTIPLIER,
      1
    );
    sprite.renderOrder = 999; // Выше всех элементов

    this.scene.add(sprite);

    return {
      sprite: sprite,
      firefly: firefly,
      originalFireflyPosition: startPosition.clone(),
      targetPosition: targetPosition.clone(),
      technology: technology
    };
  }

  /**
   * Превращение светлячков в слова
   * Создает текстовые метки из светлячков и запускает анимацию превращения
   */
  transformFirefliesToWords() {
    if (!this.isDetailMode || !this.detailModeNode) {
      return;
    }

    const nodeData = this.detailModeNode;
    const selectedNodeId = nodeData.node.id;

    // Очищаем предыдущие метки слов, если они есть
    this.detailModeWordLabels.forEach(label => {
      if (label.sprite) {
        this.scene.remove(label.sprite);
        label.sprite.geometry.dispose();
        label.sprite.material.dispose();
      }
    });
    this.detailModeWordLabels = [];

    // Находим все светлячки выбранного узла
    const nodeFireflies = this.fireflies.filter(
      firefly => firefly.mesh && firefly.nodeId === selectedNodeId && firefly.mesh.userData.technology
    );

    if (nodeFireflies.length === 0) {
      return;
    }

    // Располагаем слова равномерно по кругу на плоскости перпендикулярной камере
    const camera = this.camera;
    const cameraDirection = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
    const planeNormal = cameraDirection.clone().normalize();
    const planeDistance = this.DETAIL_MODE_ACTOR_RADIUS * 1.2; // Расстояние от центра до плоскости

    // Центр плоскости (точка на плоскости, ближайшая к центру)
    const planeCenter = planeNormal.clone().multiplyScalar(planeDistance);

    // Создаем ортогональные векторы для размещения слов на плоскости
    const up = new THREE.Vector3(0, 1, 0);
    const right = new THREE.Vector3().crossVectors(up, planeNormal).normalize();
    const planeUp = new THREE.Vector3().crossVectors(planeNormal, right).normalize();

    // Вычисляем реальный размер надписей (используем максимальные возможные размеры для безопасности)
    const maxWordWidth = WORD_LABEL_CANVAS_WIDTH * WORD_LABEL_SCALE_MULTIPLIER;
    const maxWordHeight = WORD_LABEL_CANVAS_HEIGHT * WORD_LABEL_SCALE_MULTIPLIER;

    // Минимальное расстояние между центрами надписей для предотвращения пересечения
    // Увеличиваем запас до 50% для гарантированного отсутствия пересечения
    const minDistance = Math.max(maxWordWidth, maxWordHeight) * 1.5;

    // Рассчитываем минимальный радиус для равномерного распределения
    const wordCount = nodeFireflies.length;
    const angleStep = (Math.PI * 2) / wordCount;
    
    // Функция для расчета расстояния между двумя точками на эллипсе
    const distanceOnEllipse = (angle1, angle2, radiusX, radiusY) => {
      const x1 = Math.cos(angle1) * radiusX;
      const y1 = Math.sin(angle1) * radiusY;
      const x2 = Math.cos(angle2) * radiusX;
      const y2 = Math.sin(angle2) * radiusY;
      return Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
    };
    
    // Находим оптимальные радиусы методом подбора
    // Ограничиваем максимальный радиус, чтобы блоки не выходили за экран
    const maxRadiusX = WORD_LABEL_PLACEMENT_RADIUS * 3.2; // Максимальный горизонтальный радиус
    const maxRadiusY = WORD_LABEL_PLACEMENT_RADIUS * 2.7; // Максимальный вертикальный радиус
    
    let ellipseRadiusX = Math.min(
      maxRadiusX,
      Math.max(WORD_LABEL_PLACEMENT_RADIUS * 1.1, minDistance / (2 * Math.sin(angleStep / 2)))
    );
    let ellipseRadiusY = Math.min(
      maxRadiusY,
      Math.max(WORD_LABEL_PLACEMENT_RADIUS * 0.85, minDistance / (2 * Math.sin(angleStep / 2)) * 0.75)
    );
    
    // Проверяем расстояние между соседними надписями на всех позициях
    let allDistancesValid = false;
    let iterations = 0;
    while (!allDistancesValid && iterations < 10) {
      allDistancesValid = true;
      for (let i = 0; i < wordCount; i++) {
        const angle1 = i * angleStep;
        const angle2 = ((i + 1) % wordCount) * angleStep;
        const dist = distanceOnEllipse(angle1, angle2, ellipseRadiusX, ellipseRadiusY);
        
        if (dist < minDistance) {
          allDistancesValid = false;
          // Увеличиваем радиусы пропорционально, но не превышаем максимум
          const scale = minDistance / dist;
          const newRadiusX = Math.min(maxRadiusX, ellipseRadiusX * scale * 1.05);
          const newRadiusY = Math.min(maxRadiusY, ellipseRadiusY * scale * 0.9);
          
          if (newRadiusX === maxRadiusX && newRadiusY === maxRadiusY && dist < minDistance * 0.9) {
            // Если достигли максимума, но расстояние все еще недостаточно, увеличиваем minDistance
            break;
          }
          
          ellipseRadiusX = newRadiusX;
          ellipseRadiusY = newRadiusY;
          break;
        }
      }
      iterations++;
    }

    // Создаем метки слов для каждого светлячка
    nodeFireflies.forEach((firefly, index) => {
      // Вычисляем позицию слова равномерно по эллипсу
      const angle = index * angleStep;
      
      const circleX = Math.cos(angle) * ellipseRadiusX;
      const circleY = Math.sin(angle) * ellipseRadiusY;

      const targetPosition = planeCenter.clone()
        .add(right.clone().multiplyScalar(circleX))
        .add(planeUp.clone().multiplyScalar(circleY));

      // Получаем текущую позицию светлячка
      const fireflyPosition = firefly.mesh.position.clone();

      // Создаем метку слова
      const wordLabel = this.createWordLabel(firefly, fireflyPosition, targetPosition);
      if (wordLabel) {
        this.detailModeWordLabels.push(wordLabel);
      }
    });

    // Запускаем анимацию превращения
    if (this.detailModeWordLabels.length > 0) {
      this.animateFirefliesToWords();
    }
  }

  /**
   * Анимация превращения светлячков в слова
   * Светлячки исчезают, слова появляются и перемещаются к финальным позициям
   */
  animateFirefliesToWords() {
    this.isAnimatingFirefliesToWords = true; // Устанавливаем флаг начала анимации
    const startTime = Date.now();
    const duration = 0.8 * 1000; // 0.8 секунды

    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const easedProgress = this.easeInOut(progress);

      this.detailModeWordLabels.forEach((label) => {
        if (!label.sprite || !label.firefly || !label.firefly.mesh) {
          return;
        }

        // Анимируем исчезновение светлячка
        label.firefly.mesh.traverse((child) => {
          if (child.material) {
            if (Array.isArray(child.material)) {
              child.material.forEach(mat => {
                if (mat.opacity !== undefined) {
                  mat.opacity = 1 - easedProgress;
                }
              });
            } else {
              if (child.material.opacity !== undefined) {
                child.material.opacity = 1 - easedProgress;
              }
            }
          }
        });
        label.firefly.mesh.visible = easedProgress < 1;

        // Анимируем появление и перемещение слова
        if (label.sprite) {
          // Плавно перемещаем от позиции светлячка к финальной позиции
          label.sprite.position.copy(
            label.originalFireflyPosition.clone().lerp(label.targetPosition, easedProgress)
          );

          // Плавно появляем слово
          label.sprite.material.opacity = easedProgress;
        }
      });

      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        // Анимация завершена - скрываем светлячки полностью
        this.detailModeWordLabels.forEach((label) => {
          if (label.firefly && label.firefly.mesh) {
            label.firefly.mesh.visible = false;
            label.firefly.mesh.traverse((child) => {
              // Скрываем все дочерние элементы
              child.visible = false;
              if (child.material) {
                if (Array.isArray(child.material)) {
                  child.material.forEach(mat => {
                    if (mat.opacity !== undefined) {
                      mat.opacity = 0;
                    }
                  });
                } else {
                  if (child.material.opacity !== undefined) {
                    child.material.opacity = 0;
                  }
                }
              }
            });
          }
          if (label.sprite) {
            // Устанавливаем финальную позицию для начала анимации покачивания
            label.sprite.position.copy(label.targetPosition);
            label.sprite.material.opacity = 1;
          }
        });
        // Анимация превращения завершена - можно начинать покачивание
        this.isAnimatingFirefliesToWords = false;
      }
    };

    animate();
  }

  /**
   * Превращение слов обратно в светлячков
   * Запускает анимацию обратного превращения
   */
  transformWordsToFireflies() {
    if (this.detailModeWordLabels.length === 0) {
      return;
    }

    // Запускаем анимацию обратного превращения
    this.animateWordsToFireflies();
  }

  /**
   * Анимация обратного превращения слов в светлячков
   * Слова перемещаются к позициям светлячков и исчезают, светлячки появляются
   */
  animateWordsToFireflies() {
    this.isAnimatingWordsToFireflies = true; // Устанавливаем флаг начала анимации
    const startTime = Date.now();
    const duration = 0.8 * 1000; // 0.8 секунды

    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const easedProgress = this.easeInOut(progress);

      this.detailModeWordLabels.forEach((label) => {
        if (!label.sprite || !label.firefly || !label.firefly.mesh) {
          return;
        }

        // Получаем текущую позицию светлячка (может измениться во время анимации возврата)
        const currentFireflyPosition = label.firefly.mesh.position.clone();

        // Анимируем перемещение слова к позиции светлячка
        if (label.sprite) {
          label.sprite.position.copy(
            label.targetPosition.clone().lerp(currentFireflyPosition, easedProgress)
          );

          // Плавно исчезаем слово
          label.sprite.material.opacity = 1 - easedProgress;
        }

        // Анимируем появление светлячка
        label.firefly.mesh.traverse((child) => {
          if (child.material) {
            if (Array.isArray(child.material)) {
              child.material.forEach(mat => {
                if (mat.opacity !== undefined) {
                  mat.opacity = easedProgress;
                }
              });
            } else {
              if (child.material.opacity !== undefined) {
                child.material.opacity = easedProgress;
              }
            }
          }
        });
        label.firefly.mesh.visible = easedProgress > 0;
      });

      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        // Анимация завершена - полностью скрываем слова и показываем светлячки
        this.detailModeWordLabels.forEach((label) => {
          if (label.sprite) {
            label.sprite.material.opacity = 0;
            label.sprite.visible = false;
          }
          if (label.firefly && label.firefly.mesh) {
            label.firefly.mesh.visible = true;
            label.firefly.mesh.traverse((child) => {
              if (child.material) {
                if (Array.isArray(child.material)) {
                  child.material.forEach(mat => {
                    if (mat.opacity !== undefined) {
                      mat.opacity = 1;
                    }
                  });
                } else {
                  if (child.material.opacity !== undefined) {
                    child.material.opacity = 1;
                  }
                }
              }
            });
          }
        });
        // Анимация обратного превращения завершена
        this.isAnimatingWordsToFireflies = false;
      }
    };

    animate();
  }

  /**
   * Вычисление масштаба узла на основе процента ширины экрана
   */
  calculateScale(nodeData) {
    const nodeRadius = nodeData.node.level === 0 ? this.rootRadius : this.nodeRadius;
    const nodeDiameter = nodeRadius * 2;

    const fov = this.camera.fov * (Math.PI / 180);
    const standardDistance = this.initialCameraDistance;
    const visibleHeight = 2 * Math.tan(fov / 2) * standardDistance;
    const visibleWidth = visibleHeight * this.camera.aspect;

    const targetSize = visibleWidth * (this.DETAIL_MODE_SCREEN_SIZE_PERCENT / 100);
    const scale = targetSize / nodeDiameter;

    return scale;
  }

  /**
   * Функция easing для плавных анимаций
   */
  easeInOut(t) {
    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  }

  /**
   * Блокировка элементов управления зумом
   * zoom-out не блокируется, так как используется для закрытия детального режима
   */
  disableZoomControls() {
    const zoomInBtn = document.getElementById('zoom-in');

    if (zoomInBtn) {
      zoomInBtn.style.opacity = '0.3';
      zoomInBtn.style.pointerEvents = 'none';
      zoomInBtn.disabled = true;
    }
    // zoom-out не блокируем - он используется для закрытия детального режима
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
   * Обновить размер текста в режиме детализации
   */
  updateTextSizes(rootTextSize, nodeTextSize) {
    if (!this.isDetailMode || !this.detailModeNode) return;

    this.rootTextSize = rootTextSize;
    this.nodeTextSize = nodeTextSize;

    // Обновляем текст только для выбранного узла в режиме детализации
    const nodeData = this.detailModeNode;
    if (nodeData.textSprite) {
      this.updateNodeTextSprite(nodeData);
    }
  }

  /**
   * Обновить текст спрайт для узла в режиме детализации
   */
  updateNodeTextSprite(nodeData) {
    const node = nodeData.node;
    const isRoot = node.level === 0;
    const fontSize = isRoot ? this.rootTextSize : this.nodeTextSize;
    const lineHeight = fontSize * 1.2; // Межстрочный интервал

    // Создаем новую текстуру
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');

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

      // Рассчитываем новый масштаб
      nodeData.textSprite.scale.set((canvas.width / TEXT_SCALE_FACTOR) * 1.5, (canvas.height / TEXT_SCALE_FACTOR) * 1.5, 1);
    }
  }

  /**
   * Обновить текст спрайт для узла в режиме детализации с увеличенным разрешением
   */
  updateNodeTextSpriteForDetailMode(nodeData) {
    const node = nodeData.node;
    const isRoot = node.level === 0;
    const fontSize = isRoot ? this.rootTextSize : this.nodeTextSize;
    const lineHeight = fontSize * 1.2; // Межстрочный интервал

    // Увеличиваем масштаб для детального режима (в 2 раза больше для четкости)
    const detailScaleFactor = TEXT_SCALE_FACTOR * 2;

    // Создаем новую текстуру
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');

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

    // Увеличиваем разрешение canvas для четкости при масштабировании в детальном режиме
    canvas.width = (textWidth + TEXT_PADDING) * detailScaleFactor;
    canvas.height = (textHeight + TEXT_PADDING) * detailScaleFactor;

    // Масштабируем контекст
    context.scale(detailScaleFactor, detailScaleFactor);

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

      // Рассчитываем новый масштаб с учетом увеличенного разрешения
      // Масштаб спрайта должен быть таким же, как и раньше, но текстура имеет большее разрешение
      nodeData.textSprite.scale.set((canvas.width / detailScaleFactor) * 1.5, (canvas.height / detailScaleFactor) * 1.5, 1);
    }
  }

  /**
   * Создать текст спрайт для режима детализации (вспомогательный метод)
   */
  createTextSprite(node, isRoot, radius, fontSize) {
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
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
    sprite.position.y += radius + 90;
    sprite.scale.set((canvas.width / TEXT_SCALE_FACTOR) * 1.5, (canvas.height / TEXT_SCALE_FACTOR) * 1.5, 1);
    sprite.renderOrder = 999; // Текст всегда поверх всех элементов

    return sprite;
  }
  
  /**
   * Обновление анимации надписей слов (вызывается каждый кадр)
   * Реализует легкое покачивание (floating) для надписей
   */
  updateWordLabels(deltaTime) {
    if (!this.isDetailMode || !this.detailModeNode || this.detailModeWordLabels.length === 0) {
      return;
    }

    // Не анимируем покачивание во время анимации превращения
    if (this.isAnimatingFirefliesToWords || this.isAnimatingWordsToFireflies) {
      return;
    }

    // Используем время для плавной анимации
    const time = Date.now() * 0.001; // Время в секундах

    this.detailModeWordLabels.forEach((label, index) => {
      if (!label.sprite || !label.targetPosition) return;

      // Легкое покачивание вверх-вниз
      // Разные фазы для каждой надписи, чтобы они не двигались синхронно
      const floatOffset = Math.sin(time * WORD_LABEL_FLOAT_SPEED + index * 0.5) * WORD_LABEL_FLOAT_AMPLITUDE;
      
      // Применяем анимацию к позиции (используем ось Y для вертикального покачивания)
      const basePosition = label.targetPosition.clone();
      basePosition.y += floatOffset;
      label.sprite.position.copy(basePosition);
    });
  }

  /**
   * Обновить параметры
   */
  updateParams(params) {
    if (params.rootRadius !== undefined) this.rootRadius = params.rootRadius;
    if (params.nodeRadius !== undefined) this.nodeRadius = params.nodeRadius;
    if (params.rootTextSize !== undefined) this.rootTextSize = params.rootTextSize;
    if (params.nodeTextSize !== undefined) this.nodeTextSize = params.nodeTextSize;
    if (params.maxWordsPerLine !== undefined) {
      this.maxWordsPerLine = params.maxWordsPerLine;
      // Обновляем текст в режиме детализации, если он активен
      if (this.isDetailMode && this.detailModeNode && this.detailModeNode.textSprite) {
        this.updateNodeTextSprite(this.detailModeNode);
      }
    }
  }
}

