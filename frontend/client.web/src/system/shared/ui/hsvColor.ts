export type HsvColor = { hue: number; saturation: number; brightness: number }

export function hexToHsv(hex: string): HsvColor {
  const red = Number.parseInt(hex.slice(1, 3), 16) / 255
  const green = Number.parseInt(hex.slice(3, 5), 16) / 255
  const blue = Number.parseInt(hex.slice(5, 7), 16) / 255
  const brightness = Math.max(red, green, blue)
  const spread = brightness - Math.min(red, green, blue)
  const saturation = brightness === 0 ? 0 : spread / brightness

  if (!spread) return { hue: 0, saturation, brightness }

  const sector = brightness === red
    ? (green - blue) / spread
    : brightness === green
      ? (blue - red) / spread + 2
      : (red - green) / spread + 4

  return { hue: (sector * 60 + 360) % 360, saturation, brightness }
}

export function hsvToHex({ hue, saturation, brightness }: HsvColor) {
  const channel = (offset: number) => {
    const sector = (offset + hue / 60) % 6
    const level = brightness - brightness * saturation * Math.max(0, Math.min(sector, 4 - sector, 1))
    return Math.round(level * 255).toString(16).padStart(2, '0')
  }
  return `#${channel(5)}${channel(3)}${channel(1)}`
}
