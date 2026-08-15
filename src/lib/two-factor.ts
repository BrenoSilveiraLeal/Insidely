import { createCipheriv, createDecipheriv, createHash, randomBytes } from "crypto";
import * as OTPAuth from "otpauth";

const APP_NAME = "Insidely";

function key() {
  const value = process.env.TWO_FACTOR_ENCRYPTION_KEY || process.env.AUTH_SECRET;
  if (!value) throw new Error("A chave de segurança do 2FA não está configurada.");
  return createHash("sha256").update(value).digest();
}

export function encryptTwoFactorSecret(value: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  return `${iv.toString("base64url")}.${cipher.getAuthTag().toString("base64url")}.${encrypted.toString("base64url")}`;
}

export function decryptTwoFactorSecret(value: string) {
  const [ivValue, tagValue, encryptedValue] = value.split(".");
  if (!ivValue || !tagValue || !encryptedValue) throw new Error("Segredo 2FA inválido.");
  const decipher = createDecipheriv("aes-256-gcm", key(), Buffer.from(ivValue, "base64url"));
  decipher.setAuthTag(Buffer.from(tagValue, "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(encryptedValue, "base64url")), decipher.final()]).toString("utf8");
}

export function createTwoFactorSetup(email: string) {
  const secret = new OTPAuth.Secret({ size: 20 });
  const totp = new OTPAuth.TOTP({ issuer: APP_NAME, label: email, algorithm: "SHA1", digits: 6, period: 30, secret });
  return { secret: secret.base32, uri: totp.toString() };
}

export function verifyTotp(secret: string, code: string) {
  const token = code.replace(/\s/g, "");
  if (!/^\d{6}$/.test(token)) return false;
  const totp = new OTPAuth.TOTP({ issuer: APP_NAME, algorithm: "SHA1", digits: 6, period: 30, secret: OTPAuth.Secret.fromBase32(secret) });
  return totp.validate({ token, window: 1 }) !== null;
}

export function createRecoveryCodes() {
  return Array.from({ length: 8 }, () => randomBytes(5).toString("hex").toUpperCase().match(/.{1,4}/g)!.join("-"));
}

export function hashRecoveryCode(code: string) {
  return createHash("sha256").update(code.replace(/[^A-Za-z0-9]/g, "").toUpperCase()).digest("hex");
}
