type ArcaneDesktop = {
  openAttachment: (url: string) => Promise<void>
  copyFile?: (url: string, name: string) => Promise<void>
  openWindowSettings?: () => Promise<void>
}

export function arcaneDesktop() {
  return (window as Window & { arcaneDesktop?: ArcaneDesktop }).arcaneDesktop
}
