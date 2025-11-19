/**
 * Экран загрузки
 * Отвечает за отображение прогресса загрузки
 */
export class LoadingScreen {
  constructor() {
    this.loadingScreen = document.getElementById('loading-screen');
    this.loadingBar = document.getElementById('loading-bar');
  }

  /**
   * Обновить прогресс загрузки
   */
  updateProgress(progress) {
    if (this.loadingBar) {
      this.loadingBar.style.width = `${progress}%`;
    }
  }

  /**
   * Скрыть экран загрузки
   */
  hide() {
    if (this.loadingScreen) {
      this.loadingScreen.style.opacity = '0';
      setTimeout(() => {
        this.loadingScreen.style.display = 'none';
      }, 500);
    }
  }

  /**
   * Показать экран загрузки
   */
  show() {
    if (this.loadingScreen) {
      this.loadingScreen.style.display = 'flex';
    }
  }
}

