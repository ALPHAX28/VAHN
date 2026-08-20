/**
 * Admin Route Encryption & Hashing Utility
 * Obfuscates and encrypts internal admin paths (e.g. /admin/products, /admin/products/1)
 * into opaque hash tokens (e.g. /admin/x_prd72, /admin/x_prd_1_k9a).
 */

const STATIC_ROUTE_MAP: Record<string, string> = {
  '/admin': 'x_dsh89',
  '/admin/': 'x_dsh89',
  '/admin/dashboard': 'x_dsh89',
  '/admin/products': 'x_prd72',
  '/admin/products/new': 'x_prdnw',
  '/admin/collections': 'x_cll36',
  '/admin/orders': 'x_ord81',
  '/admin/users': 'x_usr94',
  '/admin/reviews': 'x_rvw62',
  '/admin/size-guide': 'x_szgd5',
};

// Inverted lookup map
const REVERSE_STATIC_MAP: Record<string, string> = Object.entries(STATIC_ROUTE_MAP).reduce(
  (acc, [plain, hash]) => {
    acc[hash] = plain;
    return acc;
  },
  {} as Record<string, string>
);

// Helper for checksum computation
function simpleHash(str: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
  }
  return (hash >>> 0).toString(16).slice(0, 4);
}

/**
 * Checks if a URL token is an encrypted admin hash (starts with x_)
 */
export function isAdminEncryptedToken(token: string): boolean {
  if (!token) return false;
  const clean = token.split('?')[0].replace(/^\/+|\/+$/g, '');
  return clean.startsWith('x_');
}

/**
 * Encrypts / Encodes a plain admin path into an encrypted token URL.
 * Example:
 *   '/admin/products' -> '/admin/x_prd72'
 *   '/admin/products/1' -> '/admin/x_prd_1_3a8f'
 *   '/admin/orders/12' -> '/admin/x_ord_12_9f2e'
 */
export function encodeAdminPath(plainPath: string): string {
  const [basePath, search] = plainPath.split('?');
  const searchPart = search ? `?${search}` : '';

  // 1. Check static known routes
  if (STATIC_ROUTE_MAP[basePath]) {
    return `/admin/${STATIC_ROUTE_MAP[basePath]}${searchPart}`;
  }

  // 2. Check dynamic ID routes: /admin/products/[id]
  const prodMatch = basePath.match(/^\/admin\/products\/([^/]+)$/);
  if (prodMatch && prodMatch[1] !== 'new') {
    const id = prodMatch[1];
    const checksum = simpleHash(`prd_${id}`);
    return `/admin/x_prd_${id}_${checksum}${searchPart}`;
  }

  // 3. Check dynamic ID routes: /admin/orders/[id]
  const ordMatch = basePath.match(/^\/admin\/orders\/([^/]+)$/);
  if (ordMatch) {
    const id = ordMatch[1];
    const checksum = simpleHash(`ord_${id}`);
    return `/admin/x_ord_${id}_${checksum}${searchPart}`;
  }

  // 4. Check dynamic ID routes: /admin/users/[id]
  const usrMatch = basePath.match(/^\/admin\/users\/([^/]+)$/);
  if (usrMatch) {
    const id = usrMatch[1];
    const checksum = simpleHash(`usr_${id}`);
    return `/admin/x_usr_${id}_${checksum}${searchPart}`;
  }

  // 5. Arbitrary fallback encoding using URL-safe base64
  const sub = basePath.replace(/^\/admin\/?/, '');
  if (!sub) return `/admin/x_dsh89${searchPart}`;

  try {
    const encoded = typeof Buffer !== 'undefined'
      ? Buffer.from(sub).toString('base64url')
      : btoa(sub).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    const checksum = simpleHash(sub);
    return `/admin/x_e_${encoded}_${checksum}${searchPart}`;
  } catch {
    return plainPath;
  }
}

/**
 * Decrypts / Decodes an encrypted admin hash token into the real internal route.
 * Example:
 *   'x_prd72' -> '/admin/products'
 *   'x_prd_1_3a8f' -> '/admin/products/1'
 */
export function decodeAdminPath(token: string): string | null {
  const clean = token.split('?')[0].replace(/^\/+|\/+$/g, '');

  // 1. Check static known routes
  if (REVERSE_STATIC_MAP[clean]) {
    return REVERSE_STATIC_MAP[clean];
  }

  // 2. Check dynamic product: x_prd_[id]_[checksum]
  const prodMatch = clean.match(/^x_prd_([^_]+)_[a-f0-9]+$/);
  if (prodMatch) {
    return `/admin/products/${prodMatch[1]}`;
  }

  // 3. Check dynamic order: x_ord_[id]_[checksum]
  const ordMatch = clean.match(/^x_ord_([^_]+)_[a-f0-9]+$/);
  if (ordMatch) {
    return `/admin/orders/${ordMatch[1]}`;
  }

  // 4. Check dynamic user: x_usr_[id]_[checksum]
  const usrMatch = clean.match(/^x_usr_([^_]+)_[a-f0-9]+$/);
  if (usrMatch) {
    return `/admin/users/${usrMatch[1]}`;
  }

  // 5. Check arbitrary base64 token: x_e_[base64]_[checksum]
  const eMatch = clean.match(/^x_e_([^_]+)_[a-f0-9]+$/);
  if (eMatch) {
    try {
      const decoded = typeof Buffer !== 'undefined'
        ? Buffer.from(eMatch[1], 'base64url').toString('utf-8')
        : atob(eMatch[1].replace(/-/g, '+').replace(/_/g, '/'));
      return `/admin/${decoded}`;
    } catch {
      return null;
    }
  }

  return null;
}
