/**
 * Класс для инициализации фонового видео для мобильных устройств
 */
export class BackgroundVideo {
    /**
     * Инициализация фонового видео
     */
    static init() {
        const video = document.querySelector('.video-background video');
        if (video) {
            // Пытаемся запустить видео
            const playPromise = video.play();
            
            if (playPromise !== undefined) {
                playPromise.catch(error => {
                    console.warn('Autoplay заблокирован на мобильном устройстве:', error);
                    // Fallback: скрываем видео, показываем градиентный фон
                    const videoContainer = document.querySelector('.video-background');
                    if (videoContainer) {
                        videoContainer.style.background = 'linear-gradient(135deg, #000428 0%, #004e92 100%)';
                        video.style.display = 'none';
                    }
                });
            }
            
            // Дополнительно пытаемся запустить при взаимодействии пользователя
            const tryPlay = () => {
                if (video.paused) {
                    video.play().catch(() => {});
                }
                document.removeEventListener('touchstart', tryPlay);
                document.removeEventListener('click', tryPlay);
            };
            
            document.addEventListener('touchstart', tryPlay, { once: true });
            document.addEventListener('click', tryPlay, { once: true });
        }
    }
}

