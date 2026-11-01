import { cpfDigits, isValidCpf } from "./identity";

// A Pix key is stored the way the Banco Central writes it: CPF as 11 digits, phone as +55DDNNNNNNNNN,
// e-mail in lower case and the random key (EVP) as a lower-case UUID. The form shows each type with
// its own mask and the server stores the normalized form.
export type PixKeyType = "CPF" | "PHONE" | "EMAIL" | "RANDOM";

export const PIX_KEY_TYPES: { value: PixKeyType; label: string }[] = [
  { value: "CPF", label: "CPF" },
  { value: "PHONE", label: "Celular" },
  { value: "EMAIL", label: "E-mail" },
  { value: "RANDOM", label: "Chave aleatória" },
];

const EMAIL = /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Phone digits without the country code: DDD + 8 or 9 digits.
function phoneDigits(value: string) {
  const digits = value.replace(/\D/g, "");
  return value.trim().startsWith("+55") || (digits.length > 11 && digits.startsWith("55")) ? digits.slice(2) : digits;
}

// Guesses the type of a key saved before the form asked for it (or pasted without choosing).
export function detectPixKeyType(value: string | null | undefined): PixKeyType {
  const text = (value ?? "").trim();
  if (text.includes("@")) return "EMAIL";
  if (UUID.test(text)) return "RANDOM";
  if (!text.startsWith("+") && cpfDigits(text).length === 11 && isValidCpf(text)) return "CPF";
  if (/^[\d\s()+.-]+$/.test(text) && text.replace(/\D/g, "").length >= 10) return "PHONE";
  return text ? "RANDOM" : "CPF";
}

// What the person sees while typing: 000.000.000-00, (00) 00000-0000, the e-mail or the UUID as typed.
export function maskPixKey(type: PixKeyType, value: string) {
  if (type === "CPF") {
    const digits = cpfDigits(value).slice(0, 11);
    return [digits.slice(0, 3), digits.slice(3, 6), digits.slice(6, 9)].filter(Boolean).join(".") + (digits.length > 9 ? `-${digits.slice(9)}` : "");
  }
  if (type === "PHONE") {
    const digits = phoneDigits(value).slice(0, 11);
    if (digits.length <= 2) return digits ? `(${digits}` : "";
    const split = digits[2] === "9" ? 7 : 6; // mobiles start with 9 after the DDD
    return `(${digits.slice(0, 2)}) ${digits.slice(2, split)}${digits.length > split ? `-${digits.slice(split)}` : ""}`;
  }
  return value.trim();
}

// The stored form, or null while the key is incomplete or invalid for its type.
export function normalizePixKey(type: PixKeyType, value: string): string | null {
  const text = value.trim();
  if (type === "CPF") return isValidCpf(text) ? cpfDigits(text) : null;
  if (type === "PHONE") { const digits = phoneDigits(text); return /^[1-9]{2}9?\d{8}$/.test(digits) ? `+55${digits}` : null; }
  if (type === "EMAIL") return EMAIL.test(text) && text.length <= 77 ? text.toLowerCase() : null;
  return UUID.test(text) ? text.toLowerCase() : null;
}

export function pixKeyError(type: PixKeyType) {
  return {
    CPF: "Confira o CPF: os números não formam um CPF válido.",
    PHONE: "Confira o celular: DDD e número, como (21) 97354-9107.",
    EMAIL: "Confira o e-mail da chave Pix.",
    RANDOM: "A chave aleatória tem 32 letras e números separados por traços, como o banco mostra.",
  }[type];
}

// How a stored key reads back in the form field.
export function displayPixKey(value: string | null | undefined) {
  const text = (value ?? "").trim();
  const type = detectPixKeyType(text);
  return { type, text: maskPixKey(type, text) };
}
