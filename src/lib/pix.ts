function field(id: string, value: string) { return `${id}${String(value.length).padStart(2, "0")}${value}`; }
function crc16(value: string) { let crc = 0xffff; for (const char of value) { crc ^= char.charCodeAt(0) << 8; for (let i = 0; i < 8; i++) crc = (crc & 0x8000) ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff; } return crc.toString(16).toUpperCase().padStart(4, "0"); }

export function directPixPayload({ key, name, city, amount }: { key: string; name: string; city: string; amount: number }) {
  const merchantName = name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^A-Za-z0-9 ]/g, "").slice(0, 25).trim() || "PROFISSIONAL";
  const merchantCity = city.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^A-Za-z0-9 ]/g, "").slice(0, 15).trim() || "BRASIL";
  const account = field("00", "BR.GOV.BCB.PIX") + field("01", key.trim());
  const payload = field("00", "01") + field("26", account) + field("52", "0000") + field("53", "986") + field("54", amount.toFixed(2)) + field("58", "BR") + field("59", merchantName) + field("60", merchantCity) + field("62", field("05", "***"));
  return `${payload}6304${crc16(`${payload}6304`)}`;
}
