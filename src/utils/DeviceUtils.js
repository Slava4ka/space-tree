/**
 * Утилиты для определения типа устройства
 */
import { UAParser } from 'ua-parser-js';

/**
 * Проверяет, является ли устройство мобильным
 * @returns {boolean} true, если устройство мобильное, иначе false
 */
export function isMobileDevice() {
  const parser = new UAParser();
  const device = parser.getDevice();
  const os = parser.getOS();
  
  // Проверяем тип устройства
  if (device.type === 'mobile' || device.type === 'tablet') {
    return true;
  }
  
  // Дополнительная проверка по ОС для надежности
  const mobileOS = ['Android', 'iOS', 'Windows Phone', 'BlackBerry', 'Firefox OS'];
  if (mobileOS.includes(os.name)) {
    return true;
  }
  
  return false;
}

