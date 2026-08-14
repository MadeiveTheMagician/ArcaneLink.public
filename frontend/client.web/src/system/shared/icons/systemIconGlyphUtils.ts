import styles from './SystemIcon.module.css'

type SystemSvgShapeProps = {
  opacity?: number
  strokeWidth?: number
}

export function pathProps(props?: SystemSvgShapeProps) {
  return {
    className: styles.stroke,
    strokeWidth: 1.8,
    ...props,
  }
}

export function assertUnreachable(value: never): never {
  throw new Error(`Unsupported system icon: ${String(value)}`)
}
