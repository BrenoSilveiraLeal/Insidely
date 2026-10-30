// What the consultant's proof of employment is. Older requests used the last three values.
export const VERIFICATION_METHODS = [
  { value: "badge", label: "Crachá da empresa", hint: "Foto do crachá com seu nome e o nome ou logo da empresa visíveis." },
  { value: "timesheet", label: "Folha de ponto ou holerite", hint: "Print ou PDF com seu nome e o nome da empresa. Pode cobrir valores e dados bancários." },
  { value: "work_card", label: "Carteira de trabalho digital", hint: "Print da Carteira de Trabalho Digital mostrando o contrato com a empresa." },
  { value: "other_document", label: "Outro documento", hint: "Contrato, declaração da empresa ou outro documento com seu nome e o da empresa." },
] as const;

const LEGACY_LABELS: Record<string, string> = { company_email: "E-mail corporativo", employment_document: "Documento profissional", professional_reference: "Referência profissional" };

export function verificationMethodLabel(method: string) {
  return VERIFICATION_METHODS.find((item) => item.value === method)?.label ?? LEGACY_LABELS[method] ?? method;
}
