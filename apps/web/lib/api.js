const browserApiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';

export function publicApiUrl(path = '') {
  const cleanPath = path.replace(/^\//, '');
  if (typeof window !== 'undefined') {
    // In browser: use relative /api/ path so it works seamlessly on localhost and Cloudflare tunnel
    return `/api/${cleanPath}`;
  }
  const base = process.env.API_INTERNAL_URL || browserApiUrl;
  return `${base.replace(/\/$/, '')}/${cleanPath}`;
}

export function serverApiUrl(path = '') {
  const internalApiUrl = process.env.API_INTERNAL_URL || browserApiUrl;
  return `${internalApiUrl.replace(/\/$/, '')}/${path.replace(/^\//, '')}`;
}

export function publicAssetUrl(assetPath = '') {
  if (!assetPath) return '';
  if (assetPath.startsWith('http://') || assetPath.startsWith('https://')) return assetPath;
  if (typeof window !== 'undefined') {
    return assetPath.startsWith('/') ? assetPath : `/${assetPath}`;
  }
  const origin = browserApiUrl.replace(/\/api\/?$/, '');
  return `${origin}${assetPath.startsWith('/') ? assetPath : `/${assetPath}`}`;
}
