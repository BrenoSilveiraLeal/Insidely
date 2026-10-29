// Customer identity: every person who books a conversation registers a CPF and a birth date, so the
// platform can identify them if a conversation leads to a complaint or a legal process. Only the
// platform keeps the full CPF; the consultant sees it masked (see maskCpf).

export function cpfDigits(value: string) {
  return value.replace(/\D/g, "");
}

export function isValidCpf(value: string) {
  const digits = cpfDigits(value);
  if (digits.length !== 11 || /^(\d)\1{10}$/.test(digits)) return false;
  const check = (length: number) => {
    const sum = digits.slice(0, length).split("").reduce((total, digit, index) => total + Number(digit) * (length + 1 - index), 0);
    const rest = (sum * 10) % 11;
    return rest === 10 ? 0 : rest;
  };
  return check(9) === Number(digits[9]) && check(10) === Number(digits[10]);
}

export function formatCpf(value: string) {
  const digits = cpfDigits(value);
  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9, 11)}`;
}

// Same masking the Receita Federal uses on public documents: only the middle six digits show.
export function maskCpf(value: string) {
  const digits = cpfDigits(value);
  return `***.${digits.slice(3, 6)}.${digits.slice(6, 9)}-**`;
}

export function ageOn(birthDate: string, today = new Date()) {
  const [year, month, day] = birthDate.slice(0, 10).split("-").map(Number);
  if (!year || !month || !day) return NaN;
  let age = today.getFullYear() - year;
  if (today.getMonth() + 1 < month || (today.getMonth() + 1 === month && today.getDate() < day)) age--;
  return age;
}
