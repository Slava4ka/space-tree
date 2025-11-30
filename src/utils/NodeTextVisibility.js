/**
 * Утилита для определения видимости надписей узлов на основе зума
 */
export class NodeTextVisibility {
    constructor(cameraManager, detailModeSystem) {
        this.cameraManager = cameraManager;
        this.detailModeSystem = detailModeSystem;
    }

    /**
     * Проверяет, должна ли быть видна надпись для узла
     * @param {boolean} isRoot - является ли узел корневым
     * @returns {boolean} - true если надпись должна быть видна
     */
    shouldShowText(isRoot) {
        const isDetailMode = this.detailModeSystem && this.detailModeSystem.isActive();

        if (isDetailMode) {
            return true; // В детальном режиме все видимо
        }

        if (!this.cameraManager) {
            return true; // Если нет cameraManager, показываем все
        }

        const currentZoom = this.cameraManager.getZoom();

        if (isRoot) {
            return currentZoom < 0.4; // Root узлы видны при
        } else {            
            return currentZoom >= 0.25; // Дочерние узлы видны
        }
    }
}

