export type AppEntryRoute = 'app' | 'api-test'

export function resolveAppEntryRoute(
  pathname: string,
  isDevelopment: boolean,
): AppEntryRoute {
  return isDevelopment && pathname === '/api-test' ? 'api-test' : 'app'
}
