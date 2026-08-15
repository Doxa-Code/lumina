import { createHash } from 'crypto';

export function hashApiKey(key: string): Promise<string> {
  const hash = createHash('sha256').update(key).digest('hex');
  return Promise.resolve(hash);
}

export async function verifyApiKey(
  key: string,
  hash: string
): Promise<boolean> {
  const keyHash = await hashApiKey(key);
  return keyHash === hash;
}

export function extractApiKeyFromHeader(authHeader?: string, xApiKey?: string): string | null {
  // Try x-api-key header first (common for OTLP)
  if (xApiKey && xApiKey.startsWith('obs_')) {
    return xApiKey;
  }

  // Then try Authorization: Bearer header
  if (authHeader) {
    if (authHeader.startsWith('Bearer ')) {
      const token = authHeader.slice(7);
      if (token.startsWith('obs_')) {
        return token;
      }
    }
    // Also accept direct obs_ key in Authorization header
    if (authHeader.startsWith('obs_')) {
      return authHeader;
    }
  }

  return null;
}
