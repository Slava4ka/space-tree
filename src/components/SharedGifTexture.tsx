import { Texture, TextureLoader, ClampToEdgeWrapping } from 'three'

let sharedTexture: Texture | null = null
let isLoading = false
const textureCallbacks: Array<(texture: Texture) => void> = []

export function initSharedImageTexture() {
  if (sharedTexture) return sharedTexture
  if (isLoading) return null

  isLoading = true
  const loader = new TextureLoader()
  
  loader.load(
    '/ball.gif', // Используем ball.gif как статичное изображение (первый кадр)
    (texture) => {
      texture.wrapS = ClampToEdgeWrapping
      texture.wrapT = ClampToEdgeWrapping
      texture.repeat.set(1, 1)
      texture.offset.set(0, 0)
      sharedTexture = texture
      isLoading = false
      
      // Уведомляем все компоненты о загрузке текстуры
      textureCallbacks.forEach(callback => callback(texture))
      textureCallbacks.length = 0
    },
    undefined,
    (error) => {
      console.error('Error loading image texture:', error)
      isLoading = false
    }
  )

  return sharedTexture
}

export function getSharedImageTexture() {
  return sharedTexture
}

export function onTextureLoaded(callback: (texture: Texture) => void) {
  if (sharedTexture) {
    callback(sharedTexture)
  } else {
    textureCallbacks.push(callback)
  }
}

