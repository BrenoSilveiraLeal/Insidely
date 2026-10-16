export function GoogleCalendarFeedback({ code }: { code?: string }) {
  if (code === "added") return <p className="form-feedback" role="status">Conversa adicionada ao Google Calendário, com lembrete por e-mail uma hora antes.</p>;
  if (code === "account-mismatch") return <p className="form-error" role="alert">Use a mesma conta Google vinculada ao seu perfil Insidely.</p>;
  if (code === "permission-error" || code === "connect-error") return <p className="form-error" role="alert">Não foi possível autorizar o Google Calendário. Confira a permissão e tente novamente.</p>;
  if (code === "error") return <p className="form-error" role="alert">Não foi possível adicionar este agendamento ao calendário.</p>;
  return null;
}
