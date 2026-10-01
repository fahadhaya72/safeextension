const STATIC_ALLOWED_ORIGINS = new Set([
  'https://safeextension.vercel.app',
  'http://localhost:3000',
  'http://localhost:3001'
]);

export function isAllowedOrigin(origin, { allowedOrigin = '*', extensionId } = {}) {
  if (!origin || origin === 'null') return true;
  if (allowedOrigin === '*') return true;
  if (origin === allowedOrigin || STATIC_ALLOWED_ORIGINS.has(origin)) return true;

  const isConfiguredChromeExtensionId = /^[a-p]{32}$/.test(extensionId || '');
  return isConfiguredChromeExtensionId && origin === `chrome-extension://${extensionId}`;
}