/**
 * Утилиты для работы с текстом
 * Централизованные функции для разбиения и обработки текста
 */
export class TextUtils {
  /**
   * Разбить текст на строки по максимальному количеству слов
   * @param {string} text - Текст для разбиения
   * @param {number} maxWordsPerLine - Максимальное количество слов в строке (0 или undefined = без ограничений)
   * @returns {string[]} Массив строк
   */
  static splitTextIntoLines(text, maxWordsPerLine) {
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
}

