import AES from "crypto-js/aes";
import Utf8 from "crypto-js/enc-utf8";

const SECRET = process.env.ENCRYPTION_KEY || "fallback-key-for-dev";

export function encryptToken(token: string): string {
  return AES.encrypt(token, SECRET).toString();
}

export function decryptToken(encrypted: string): string {
  const bytes = AES.decrypt(encrypted, SECRET);
  return bytes.toString(Utf8);
}