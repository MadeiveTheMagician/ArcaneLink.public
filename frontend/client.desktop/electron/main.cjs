const { app, BrowserWindow, desktopCapturer, dialog, shell, session } = require('electron')
const { autoUpdater } = require('electron-updater')

const DEVELOPMENT_URL = process.env.ARCANELINK_DESKTOP_DEV_URL ?? 'http://localhost:5173'
const PRODUCTION_URL = process.env.ARCANELINK_DESKTOP_APP_URL ?? 'https://arcane-link.ru'
const UPDATE_CHECK_INTERVAL_MS = 10 * 60 * 1000
const VOICE_WORKSPACE_WINDOW_PREFIX = 'arcanelink-voice-workspace-'

const applicationUrl = app.isPackaged ? PRODUCTION_URL : DEVELOPMENT_URL
const trustedOrigins = new Set([
  new URL(DEVELOPMENT_URL).origin,
  new URL(PRODUCTION_URL).origin,
])

function isTrustedUrl(value) {
  try {
    return trustedOrigins.has(new URL(value).origin)
  } catch {
    return false
  }
}

function configurePermissions() {
  const allowedPermissions = new Set(['display-capture', 'media', 'notifications'])

  session.defaultSession.setPermissionCheckHandler((_webContents, permission, requestingOrigin) => {
    return allowedPermissions.has(permission) && isTrustedUrl(requestingOrigin)
  })

  session.defaultSession.setPermissionRequestHandler((webContents, permission, callback) => {
    const requestingUrl = webContents.getURL()
    callback(allowedPermissions.has(permission) && isTrustedUrl(requestingUrl))
  })

  session.defaultSession.setDisplayMediaRequestHandler(async (request, callback) => {
    if (!request.userGesture || !isTrustedUrl(request.securityOrigin)) {
      callback({})
      return
    }

    try {
      const sources = await desktopCapturer.getSources({
        types: ['screen', 'window'],
        thumbnailSize: { width: 0, height: 0 },
        fetchWindowIcons: false,
      })

      const primaryScreen = sources.find((source) => source.id.startsWith('screen:'))
      callback(primaryScreen ? { video: primaryScreen } : {})
    } catch (error) {
      console.error('ArcaneLink display capture failed:', error)
      callback({})
    }
  })
}

function configureAutoUpdates() {
  if (!app.isPackaged) {
    return
  }

  autoUpdater.autoDownload = true
  autoUpdater.autoInstallOnAppQuit = true

  autoUpdater.on('error', (error) => {
    console.error('ArcaneLink update check failed:', error)
  })

  autoUpdater.on('update-downloaded', async (updateInfo) => {
    const result = await dialog.showMessageBox({
      type: 'info',
      buttons: ['Перезапустить сейчас', 'Позже'],
      defaultId: 0,
      cancelId: 1,
      title: 'Обновление ArcaneLink',
      message: `Версия ${updateInfo.version} готова к установке.`,
      detail: 'Перезапустите ArcaneLink сейчас или установите обновление при следующем выходе из приложения.',
    })

    if (result.response === 0) {
      autoUpdater.quitAndInstall()
    }
  })

  const checkForUpdates = () => {
    void autoUpdater.checkForUpdates().catch((error) => {
      console.error('ArcaneLink update check failed:', error)
    })
  }

  checkForUpdates()
  setInterval(checkForUpdates, UPDATE_CHECK_INTERVAL_MS)
}

function createMainWindow() {
  const mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 900,
    minHeight: 600,
    backgroundColor: '#111318',
    title: 'ArcaneLink',
    autoHideMenuBar: true,
    show: false,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  })

  mainWindow.once('ready-to-show', () => mainWindow.show())

  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (!isTrustedUrl(url)) {
      event.preventDefault()
      void shell.openExternal(url)
    }
  })

  mainWindow.webContents.setWindowOpenHandler(({ url, frameName }) => {
    const isVoiceWorkspaceWindow =
      frameName.startsWith(VOICE_WORKSPACE_WINDOW_PREFIX) &&
      (url === '' || url === 'about:blank')

    if (isVoiceWorkspaceWindow) {
      return { action: 'allow' }
    }

    if (!isTrustedUrl(url)) {
      if (url !== '' && url !== 'about:blank') {
        void shell.openExternal(url)
      }
    }

    return { action: 'deny' }
  })

  void mainWindow.loadURL(applicationUrl)
}

app.whenReady().then(() => {
  configurePermissions()
  createMainWindow()
  configureAutoUpdates()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow()
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
