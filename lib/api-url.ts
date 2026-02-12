/**
 * URL helpers for constructing public URLs
 */

/**
 * Construct a full public URL for server-side use
 */
export function buildPublicUrl(path: string): string {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
  const cleanPath = path.startsWith('/') ? path : `/${path}`
  return `${appUrl}${cleanPath}`
}

/**
 * Construct an API URL (relative path)
 */
export function apiUrl(path: string): string {
  const cleanPath = path.startsWith('/') ? path.slice(1) : path
  return `/${cleanPath}`
}

/**
 * Construct an asset URL (relative path for static assets in the public folder)
 */
export function assetUrl(path: string): string {
  const cleanPath = path.startsWith('/') ? path : `/${path}`
  return cleanPath
}
