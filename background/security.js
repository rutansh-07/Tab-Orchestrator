/**
 * Security & Sanitization Layer
 * Follows Zero-Trust architecture principles.
 */

// Strip sensitive parameters from URLs to prevent PII/Token leakage
export function sanitizeUrl(rawUrl) {
  try {
    const url = new URL(rawUrl);
    const searchParams = url.searchParams;
    const sensitiveTokens = ['token', 'auth', 'session', 'secret', 'key', 'pwd', 'password'];
    
    // Remove if parameter name contains sensitive keywords
    for (const key of Array.from(searchParams.keys())) {
      const lowerKey = key.toLowerCase();
      if (sensitiveTokens.some(token => lowerKey.includes(token))) {
        searchParams.delete(key);
      }
    }
    
    return url.toString();
  } catch (e) {
    // If not a valid URL (e.g. chrome:// tabs), return as is
    return rawUrl;
  }
}

// Strip hex hashes or common UUIDs from titles
export function sanitizeTitle(title) {
  if (!title) return "";
  let cleanTitle = title;
  // Remove UUIDs
  cleanTitle = cleanTitle.replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/ig, '[UUID]');
  // Remove long hex strings (often hashes or session IDs)
  cleanTitle = cleanTitle.replace(/\b[0-9a-f]{16,}\b/ig, '[HASH]');
  return cleanTitle;
}

// Simple in-memory crypto implementation for state encryption before storage
// Generates a session encryption key
let sessionKey = null;

async function getCryptoKey() {
  if (sessionKey) return sessionKey;
  
  sessionKey = await crypto.subtle.generateKey(
    { name: "AES-GCM", length: 256 },
    true,
    ["encrypt", "decrypt"]
  );
  return sessionKey;
}

export async function encryptData(dataObject) {
  const key = await getCryptoKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encoded = new TextEncoder().encode(JSON.stringify(dataObject));
  
  const encryptedBuf = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv: iv },
    key,
    encoded
  );
  
  return {
    iv: Array.from(iv),
    data: Array.from(new Uint8Array(encryptedBuf))
  };
}

export async function decryptData(encryptedPayload) {
  if (!encryptedPayload || !encryptedPayload.iv || !encryptedPayload.data) return null;
  
  try {
    const key = await getCryptoKey();
    const iv = new Uint8Array(encryptedPayload.iv);
    const data = new Uint8Array(encryptedPayload.data);
    
    const decryptedBuf = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: iv },
      key,
      data
    );
    
    const decodedStr = new TextDecoder().decode(decryptedBuf);
    return JSON.parse(decodedStr);
  } catch (e) {
    console.error("Decryption failed. Key might have rotated on session restart.", e);
    // Since it's a session key, on restart we lose the key and data becomes unreadable.
    // This is a feature of zero-persistence! 
    return null;
  }
}
