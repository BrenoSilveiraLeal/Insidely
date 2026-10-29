import { describe, expect, it } from "vitest";
import { moderateChatMessage } from "./chat-moderation";

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
