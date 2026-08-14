export const fallbackAvatarAccent = '139, 94, 255'

export function toAvatarAccent(image: HTMLImageElement) {
  const sampleSize = 24
  const canvas = document.createElement('canvas')
  const context = canvas.getContext('2d', { willReadFrequently: true })

  if (!context) {
    return fallbackAvatarAccent
  }

  canvas.width = sampleSize
  canvas.height = sampleSize
  context.drawImage(image, 0, 0, sampleSize, sampleSize)

  const { data } = context.getImageData(0, 0, sampleSize, sampleSize)
  let red = 0
  let green = 0
  let blue = 0
  let totalWeight = 0

  for (let index = 0; index < data.length; index += 4) {
    const alpha = data[index + 3] / 255

    if (alpha < 0.35) {
      continue
    }

    const pixelRed = data[index]
    const pixelGreen = data[index + 1]
    const pixelBlue = data[index + 2]
    const max = Math.max(pixelRed, pixelGreen, pixelBlue)
    const min = Math.min(pixelRed, pixelGreen, pixelBlue)
    const saturation = max === 0 ? 0 : (max - min) / max
    const brightness = max / 255
    const weight = alpha * (0.35 + saturation) * (0.55 + brightness)

    red += pixelRed * weight
    green += pixelGreen * weight
    blue += pixelBlue * weight
    totalWeight += weight
  }

  if (totalWeight === 0) {
    return fallbackAvatarAccent
  }

  return `${Math.round(red / totalWeight)}, ${Math.round(
    green / totalWeight,
  )}, ${Math.round(blue / totalWeight)}`
}
