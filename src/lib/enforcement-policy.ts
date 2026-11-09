// Graduated enforcement (Terms, "Advertências, suspensões e banimento"). Every 3 warnings bring a
// suspension: the 1st lasts 7 days, the 2nd 30 days; after 3 more warnings the account is banned. Support and admins register the warnings, suspensions and bans.
export const WARNINGS_PER_SUSPENSION = 3;
export const SUSPENSION_DAYS_BY_ROUND = [7, 30] as const;
export const SUSPENSIONS_BEFORE_BAN = SUSPENSION_DAYS_BY_ROUND.length;

// Days of the next automatic suspension given how many suspensions the account already had,
// or null when the next round is a ban.
export function nextSuspensionDays(previousSuspensions: number) {
  return SUSPENSION_DAYS_BY_ROUND[previousSuspensions] ?? null;
}

export function enforcementSummary() {
  return `A cada ${WARNINGS_PER_SUSPENSION} advertências a conta é suspensa: a 1ª suspensão dura 1 semana e a 2ª dura 1 mês; depois de mais ${WARNINGS_PER_SUSPENSION} advertências, a conta é banida.`;
}

// What the next warnings lead to, for the staff page: the warnings still missing for the next step.
export function nextEnforcementStep(totalWarnings: number, previousSuspensions: number) {
  const remaining = WARNINGS_PER_SUSPENSION - (totalWarnings % WARNINGS_PER_SUSPENSION);
  const days = nextSuspensionDays(previousSuspensions);
  return { remaining, days, text: `${remaining} advertência(s) até ${days ? `a suspensão de ${days} dias` : "o banimento"}` };
}
