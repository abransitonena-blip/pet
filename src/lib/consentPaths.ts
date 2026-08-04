export const AUTH_PATHS = ['/login', '/admin', '/walker', '/familia', '/paseador', '/mi-cuenta']

export function isAuthPath(pathname: string) {
  return AUTH_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`))
}
