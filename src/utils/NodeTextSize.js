import { CAMERA_MIN_ZOOM } from './constants.js';

/**
 * Утилита для расчета размера шрифта надписей узлов на основе зума камеры
 */
export class NodeTextSize {
    constructor(cameraManager, detailModeSystem = null) {
        this.cameraManager = cameraManager;
        this.detailModeSystem = detailModeSystem;
    }

    /**
     * Рассчитывает размер шрифта на основе зума камеры
     * Формула: fontSize = baseSize * (minZoom / currentZoom)
     * Чем больше зум (ближе камера), тем меньше размер шрифта
     * 
     * @param {number} baseFontSize - Базовый размер шрифта
     * @param {boolean} isRoot - Является ли узел корневым
     * @param {boolean} applyZoomScaling - Применять ли масштабирование на основе зума (по умолчанию true)
     * @returns {number} - Рассчитанный размер шрифта
     */
    calculateFontSize(baseFontSize, isRoot, applyZoomScaling = true) {
        let fontSize = baseFontSize;

        // Проверяем, нужно ли применять масштабирование на основе зума
        if (applyZoomScaling && this.cameraManager) {
            // В детальном режиме не применяем масштабирование на основе зума
            const isDetailMode = this.detailModeSystem && this.detailModeSystem.isActive();
            
            if (!isDetailMode) {
                const currentZoom = this.cameraManager.getZoom();
                
                // Используем более плавную формулу с нормализацией
                // При минимальном зуме (0.015) размер = baseFontSize
                // При максимальном зуме (3.0) размер будет минимальным, но разумным
                const normalizedZoom = (currentZoom - CAMERA_MIN_ZOOM) / (3.0 - CAMERA_MIN_ZOOM); // 0..1
                const scaleFactor = 1 - (normalizedZoom * 0.9); // От 1.0 до 0.3
                fontSize = baseFontSize * scaleFactor;
            }
            // В детальном режиме fontSize остается равным baseFontSize
        }

        // Применяем минимальный размер один раз
        // При масштабировании используем меньший минимум, иначе - больший
        const isScaled = applyZoomScaling && this.cameraManager && 
                         (!this.detailModeSystem || !this.detailModeSystem.isActive());
        const minFontSize = isScaled 
            ? (isRoot ? 32 : 20)
            : (isRoot ? 72 : 38);
        
        fontSize = Math.max(fontSize, minFontSize);

        console.log(fontSize);
        

        return fontSize;
    }
}

