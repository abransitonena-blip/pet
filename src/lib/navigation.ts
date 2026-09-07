export function isPanelRouteActive(pathname: string, href: string): boolean {
  if (pathname === href) return true

  const pathSegments = href.split('/').filter(Boolean)
  if (pathSegments.length <= 1) return false

  return pathname.startsWith(`${href}/`)
}
