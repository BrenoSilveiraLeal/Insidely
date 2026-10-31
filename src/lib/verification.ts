// What the consultant's proof of employment is, for a current or a former job. Older requests used
// the legacy values below.
export const VERIFICATION_METHODS = [
  { value: "badge", label: "Crachá da empresa", hint: "Foto do crachá (atual ou antigo) com seu nome e o nome ou logo da empresa visíveis." },
  { value: "timesheet", label: "Folha de ponto ou holerite", hint: "Print ou PDF (pode ser antigo) com seu nome, o nome da empresa e o mês. Pode cobrir valores e dados bancários." },
  { value: "work_card", label: "Carteira de trabalho digital", hint: "Print da Carteira de Trabalho Digital mostrando o contrato com a empresa, com a data de entrada e, se você já saiu, a de saída." },
  // Stored as the older "employment_document" value, which submit_verification already accepts.
  { value: "employment_document", label: "Termo de rescisão (para quem já saiu)", hint: "TRCT ou outro documento de desligamento com seu nome, o nome da empresa e as datas. Pode cobrir valores." },
  { value: "other_document", label: "Outro documento", hint: "Contrato, declaração da empresa ou outro documento com seu nome e o da empresa." },
] as const;

const LEGACY_LABELS: Record<string, string> = { company_email: "E-mail corporativo", professional_reference: "Referência profissional" };

export function verificationMethodLabel(method: string) {
  return VERIFICATION_METHODS.find((item) => item.value === method)?.label ?? LEGACY_LABELS[method] ?? method;
}
