import { describe, expect, it } from "vitest";
import { isRepetitive, tidyHeadline, tidyPresentation } from "./profile-text";

describe("profile text", () => {
  it("tidies the headline", () => {
    expect(tidyHeadline("  DEv   backend ")).toBe("Dev backend");
    expect(tidyHeadline("designer de UX na XP.")).toBe("Designer de UX na XP");
    expect(tidyHeadline("ANALISTA DE RH")).toBe("Analista de RH");
    expect(tidyHeadline("dev no iFood")).toBe("Dev no iFood");
  });
  it("tidies the presentation", () => {
    expect(tidyPresentation("trabalhei 4 anos com produto. posso contar sobre a rotina")).toBe("Trabalhei 4 anos com produto. Posso contar sobre a rotina.");
    expect(tidyPresentation("Fui analista na XP!")).toBe("Fui analista na XP!");
  });
  it("spots repeated filler", () => {
    expect(isRepetitive("Era devops Era devops Era devops")).toBe(true);
    expect(isRepetitive("teste teste teste teste teste teste")).toBe(true);
    expect(isRepetitive("Trabalhei quatro anos com produto em fintechs e posso contar como era a rotina do time.")).toBe(false);
  });
});
