import type { CapacitorConfig } from '@capacitor/cli'

const developmentServerUrl = process.env.CAPACITOR_SERVER_URL?.trim()
const applicationUrl = developmentServerUrl || 'https://arcane-link.ru'

const config: CapacitorConfig = {
  appId: 'ru.arcanelink.app',
  appName: 'ArcaneLink',
  webDir: '../client.web/dist',
  server: {
    url: applicationUrl,
    cleartext: applicationUrl.startsWith('http://'),
  },
}

export default config
