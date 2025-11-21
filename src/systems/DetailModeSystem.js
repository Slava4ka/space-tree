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
  TEXT_COLOR,
  TEXT_STROKE_COLOR,
  TEXT_STROKE_WIDTH,
  TEXT_SCALE_FACTOR,
  TEXT_PADDING
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
    
    // Состояние
    this.isDetailMode = false;
    this.detailModeNode = null;
    this.detailModeOverlay = null;
    this.detailModeExitButton = null;
    this.detailModeActorLabels = [];
    this.detailModeOriginalStates = null;
    this.detailModeOriginalObjectStates = null;
    this.detailModeOriginalZoom = null;
    this.originalCameraPosition = null;
    this.originalCameraTarget = null;
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
      
      // Сохраняем исходные значения opacity и transparent для каждого объекта
      treeGroup.traverse((object) => {
        if (object.material) {
          if (Array.isArray(object.material)) {
            const states = object.material.map(mat => ({
              opacity: mat.opacity,
              transparent: mat.transparent
            }));
            this.detailModeOriginalObjectStates.set(object, { materials: states });
          } else {
            this.detailModeOriginalObjectStates.set(object, {
              opacity: object.material.opacity,
              transparent: object.material.transparent
            });
          }
        }
        // Также сохраняем для спрайтов
        if (object instanceof THREE.Sprite && object.material instanceof THREE.SpriteMaterial) {
          this.detailModeOriginalObjectStates.set(object, {
            opacity: object.material.opacity,
            transparent: object.material.transparent
          });
        }
      });
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

    // Анимируем вход в режим
    this.animateEnter(currentZoom, originalCameraPosition, originalCameraTarget);
  }

  /**
   * Выход из режима детального просмотра
   */
  exit() {

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
   * Анимация входа в режим
   */
  animateEnter(currentZoom, originalCameraPosition, originalCameraTarget) {
    const startTime = Date.now();
    const duration = this.DETAIL_MODE_ANIMATION_TIME * 1000;
    const nodeData = this.detailModeNode;

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
      
      if (selectedTextSprite) {
        selectedTextSprite.visible = true;
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
      
      // Показываем светлячки выбранного узла
      this.fireflies.forEach((firefly) => {
        if (firefly.mesh && firefly.nodeId === selectedNodeId) {
          firefly.mesh.visible = true;
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
      
      // ВАЖНО: Убеждаемся, что treeGroup, содержащий выбранный узел, видим
      const selectedTreeGroup = this.treeGroups.find(group => {
        let containsSelected = false;
        group.traverse((obj) => {
          if (obj === selectedMesh) {
            containsSelected = true;
          }
        });
        return containsSelected;
      });
      if (selectedTreeGroup) {
        selectedTreeGroup.visible = true;
      }
      
      // Теперь скрываем остальные объекты
      this.treeGroups.forEach(treeGroup => {
        // Пропускаем treeGroup с выбранным узлом
        if (treeGroup === selectedTreeGroup) {
          // Внутри этого treeGroup скрываем только невыбранные объекты
          treeGroup.traverse((object) => {
          // Исключаем сам treeGroup из обработки
          if (object === treeGroup) {
            return;
          }
          
          // Исключаем выбранный узел, его текст и все дочерние элементы
          if (object === selectedMesh || object === selectedTextSprite) {
            // Явно устанавливаем видимость и opacity для выбранного узла
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
          object.visible = easedProgress < 0.95;
          
          if (object.material) {
            if (Array.isArray(object.material)) {
              object.material.forEach(mat => {
                mat.opacity = 1 - easedProgress;
                mat.transparent = true;
              });
            } else {
              object.material.opacity = 1 - easedProgress;
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
            
            // Скрываем все объекты в других treeGroup
            object.visible = easedProgress < 0.95;
            
            if (object.material) {
              if (Array.isArray(object.material)) {
                object.material.forEach(mat => {
                  mat.opacity = 1 - easedProgress;
                  mat.transparent = true;
                });
              } else {
                object.material.opacity = 1 - easedProgress;
                object.material.transparent = true;
              }
            }
          });
        }
      });
      
      // Повторно устанавливаем видимость выбранного узла после traverse
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
      
      if (selectedTextSprite) {
        selectedTextSprite.visible = true;
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
      
      // ВАЖНО: Повторно устанавливаем видимость selectedTreeGroup после всех операций
      if (selectedTreeGroup) {
        selectedTreeGroup.visible = true;
      }
      
      // Убеждаемся, что светлячки выбранного узла остаются видимыми
      this.fireflies.forEach((firefly) => {
        if (firefly.mesh && firefly.nodeId === selectedNodeId) {
          firefly.mesh.visible = true;
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

      // Увеличиваем и центрируем выбранный узел
      const targetScaleValue = this.calculateScale(nodeData);
      const baseScale = nodeData.originalScale || new THREE.Vector3(1, 1, 1);
      const targetScale = baseScale.clone().multiplyScalar(targetScaleValue);
      const currentScale = baseScale.clone().lerp(targetScale, easedProgress);
      nodeData.mesh.scale.copy(currentScale);

      // Масштабируем текст узла
      if (nodeData.textSprite && nodeData.originalSpriteScale) {
        const targetSpriteScale = nodeData.originalSpriteScale.clone().multiplyScalar(targetScaleValue);
        nodeData.textSprite.scale.lerp(targetSpriteScale, easedProgress);
      }

      // Центрируем узел в сцене
      const targetPosition = new THREE.Vector3(0, 0, 0);
      nodeData.mesh.position.lerp(targetPosition, easedProgress);

      // Центрируем текст узла
      if (nodeData.textSprite) {
        const nodeRadius = NODE_RADIUS * currentScale.x;
        nodeData.textSprite.position.set(0, nodeRadius + 90, 0);
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
        // Анимация завершена
        if (this.detailModeActorLabels.length === 0) {
          this.createActorLabels();
        }
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

    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const easedProgress = this.easeInOut(progress);

      const nodeData = this.detailModeNode;
      const selectedMesh = nodeData.mesh;
      const selectedTextSprite = nodeData.textSprite;
      
      // Восстанавливаем все деревья
      this.treeGroups.forEach(treeGroup => {
        treeGroup.traverse((object) => {
          // Исключаем выбранный узел, его текст и все дочерние элементы
          if (object === selectedMesh || object === selectedTextSprite) {
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
          
          // Восстанавливаем opacity для остальных объектов
          if (object.material) {
            if (Array.isArray(object.material)) {
              object.material.forEach(mat => {
                mat.opacity = easedProgress;
                mat.transparent = easedProgress < 1;
              });
            } else {
              object.material.opacity = easedProgress;
              object.material.transparent = easedProgress < 1;
            }
          }
        });
      });
      
      // Явно устанавливаем видимость и opacity для выбранного узла
      selectedMesh.visible = true;
      if (selectedTextSprite) {
        selectedTextSprite.visible = true;
        if (selectedTextSprite.material instanceof THREE.SpriteMaterial) {
          selectedTextSprite.material.opacity = 1.0;
        }
      }
      
      // Убеждаемся, что все дочерние элементы выбранного узла остаются видимыми
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
      
      // Убеждаемся, что материал выбранного узла остается видимым
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
      
      // В конце анимации (когда progress = 1) восстанавливаем исходные значения
      if (progress >= 1) {
        this.treeGroups.forEach(treeGroup => {
          treeGroup.traverse((object) => {
            object.visible = true;
            
            // Восстанавливаем исходные значения opacity и transparent
            const originalState = this.detailModeOriginalObjectStates.get(object);
            if (originalState) {
              if (object.material) {
                if (Array.isArray(object.material) && originalState.materials) {
                  object.material.forEach((mat, index) => {
                    if (originalState.materials[index]) {
                      mat.opacity = originalState.materials[index].opacity;
                      mat.transparent = originalState.materials[index].transparent;
                    }
                  });
                } else if (!Array.isArray(object.material)) {
                  object.material.opacity = originalState.opacity;
                  object.material.transparent = originalState.transparent;
                }
              }
              
              if (object instanceof THREE.Sprite && object.material instanceof THREE.SpriteMaterial) {
                object.material.opacity = originalState.opacity;
                object.material.transparent = originalState.transparent;
              }
            }
          });
        });
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
      nodeData.mesh.position.lerp(originalPosition, easedProgress);

      // Возвращаем позицию текста
      if (nodeData.textSprite) {
        const nodeRadius = NODE_RADIUS * currentScale.x;
        const textPos = new THREE.Vector3(
          originalPosition.x,
          originalPosition.y + nodeRadius + 90,
          originalPosition.z
        );
        nodeData.textSprite.position.lerp(textPos, easedProgress);
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

    // Восстанавливаем деревья - восстанавливаем исходные значения opacity и transparent
    this.treeGroups.forEach(treeGroup => {
      treeGroup.traverse((object) => {
        object.visible = true;
        
        const originalState = this.detailModeOriginalObjectStates.get(object);
        if (originalState) {
          if (object.material) {
            if (Array.isArray(object.material) && originalState.materials) {
              object.material.forEach((mat, index) => {
                if (originalState.materials[index]) {
                  mat.opacity = originalState.materials[index].opacity;
                  mat.transparent = originalState.materials[index].transparent;
                }
              });
            } else if (!Array.isArray(object.material)) {
              object.material.opacity = originalState.opacity;
              object.material.transparent = originalState.transparent;
            }
          }
          
          if (object instanceof THREE.Sprite && object.material instanceof THREE.SpriteMaterial) {
            object.material.opacity = originalState.opacity;
            object.material.transparent = originalState.transparent;
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
    
    this.detailModeOriginalStates = null;
    this.detailModeOriginalObjectStates.clear();

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
    
    // Вызываем callback для обновления состояния в main.js
    if (this.onStateChange) {
      this.onStateChange(false, null);
    }
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
   * Вычисление масштаба узла на основе процента ширины экрана
   */
  calculateScale(nodeData) {
    const nodeRadius = nodeData.node.level === 0 ? ROOT_RADIUS : NODE_RADIUS;
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
   */
  disableZoomControls() {
    const zoomInBtn = document.getElementById('zoom-in');
    const zoomOutBtn = document.getElementById('zoom-out');
    const zoomResetBtn = document.getElementById('zoom-reset');
    
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
    if (zoomResetBtn) {
      zoomResetBtn.style.opacity = '0.3';
      zoomResetBtn.style.pointerEvents = 'none';
      zoomResetBtn.disabled = true;
    }
  }

  /**
   * Разблокировка элементов управления зумом
   */
  enableZoomControls() {
    const zoomInBtn = document.getElementById('zoom-in');
    const zoomOutBtn = document.getElementById('zoom-out');
    const zoomResetBtn = document.getElementById('zoom-reset');
    
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
    if (zoomResetBtn) {
      zoomResetBtn.style.opacity = '1';
      zoomResetBtn.style.pointerEvents = 'auto';
      zoomResetBtn.disabled = false;
    }
  }
}

