import { describe, expect, it } from "vitest";
import { findUnsafeProfileText, moderateChatMessage } from "./chat-moderation";

const reason = (text: string) => { const result = moderateChatMessage(text); return result.allowed ? null : result.reason; };

describe("chat moderation", () => {
  it.each([
    "me chama no zap", "meu whats é 11 98765-4321", "11987654321", "1 1 9 8 7 6 5 4 3 2 1", "nove nove oito sete seis cinco quatro tres dois",
    "fulano@gmail.com", "fulano arroba gmail", "me segue @fulano.dev", "w h a t s a p p", "t3l3gr4m", "acessa www.meusite.com.br", "meusite.com",
    "fulano ponto com ponto br", "pode me passar seu telefone?", "qual seu instagram", "vamos pagar por fora", "faz direto comigo sem a plataforma", "minha chave pix é o cpf", "123.456.789-09",
  ])("blocks contact sharing: %s", (text) => expect(reason(text)).toBe("contact"));

  it.each(["vai se foder", "seu idiota", "p0rr4", "caraaalho", "filho da puta", "vou te matar", "você é um otário"])("blocks offensive text: %s", (text) => expect(reason(text)).toBe("offensive"));

  it.each([
    "Oi! Obrigado por aceitar a conversa, quero entender a rotina de produto.",
    "Trabalhei lá de 2015-2020 e depois de 2021 a 2024.",
    "Pode entrar no link da sala no horário, combinado?",
    "Já paguei pelo pix da plataforma.",
    "Esse ponto com certeza vale discutir. Com calma a gente chega lá.",
    "A conversa é às 14:30 e dura 30 minutos.",
    "Vou instalar o app e entro no instante combinado.",
    "Meu salário era R$ 8.500,00 por mês.",
  ])("allows ordinary messages: %s", (text) => expect(reason(text)).toBeNull());
});

describe("profile text moderation", () => {
  it("finds contacts and offenses in public profile fields", () => {
    expect(findUnsafeProfileText([["Título", "Product Designer"], ["Apresentação", "Me chama no zap pra fechar direto"]])).toEqual({ label: "Apresentação", reason: "contact" });
    expect(findUnsafeProfileText([["Apresentação", "Trabalhei 5 anos em 3 empresas, liderei 12 pessoas e entreguei 40 projetos entre 2015-2020."]])).toBeNull();
  });
  it("blocks diminutives, spaced letters and slurs aimed at someone, but not identity words", () => {
    for (const text of ["seu cuzinho", "bichinha", "viadão", "putona", "v i a d o", "b1ch1nha", "seu gay", "sua lésbica", "gayzinho", "boiola", "toma no cu", "sua macaca", "seu gordo", "gay", "fala gay", "sua bichinha"]) {
      expect(moderateChatMessage(text)).toEqual({ allowed: false, reason: "offensive" });
    }
    for (const text of ["sou gay e queria saber sobre inclusão no time", "a empresa apoia pessoas gays?", "tem grupo LGBT lá?", "eu cozinho para o time às vezes", "a empresa tem grupo de pessoas trans?", "meu bichinho de estimação", "tem anta no zoológico", "o lixo eletrônico da empresa", "rola uma vaga?", "preto e branco", "quero ser analista de dados"]) {
      expect(moderateChatMessage(text)).toEqual({ allowed: true });
    }
  });
});
