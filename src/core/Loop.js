/**
 * Игровой цикл
 * Отвечает за управление циклом анимации
 */
export class Loop {
  constructor() {
    this.isRunning = false;
    this.animationFrameId = null;
    this.updateCallbacks = [];
    this.lastTime = 0;
  }

  /**
   * Добавить callback для обновления
   */
  addUpdateCallback(callback) {
    this.updateCallbacks.push(callback);
  }


  /**
   * Запустить цикл
   */
  start() {
    if (this.isRunning) return;

    this.isRunning = true;
    this.lastTime = performance.now();
    this.tick();
  }

  /**
   * Остановить цикл
   */
  stop() {
    this.isRunning = false;
    
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
  }

  /**
   * Один такт цикла
   */
  tick = () => {
    if (!this.isRunning) return;

    const currentTime = performance.now();
    const deltaTime = (currentTime - this.lastTime) / 1000; // в секундах
    this.lastTime = currentTime;

    // Вызываем все callbacks обновления
    this.updateCallbacks.forEach((callback) => {
      callback(deltaTime);
    });

    this.animationFrameId = requestAnimationFrame(this.tick);
  };
}

