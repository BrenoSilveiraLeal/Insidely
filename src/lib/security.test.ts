import {describe,expect,it} from "vitest";
import {safeInternalPath} from "./security";
import {moderateChatMessage} from "./chat-moderation";
describe("safeInternalPath",()=>{it.each([["//evil.example","/continuar"],["/\\evil.example","/continuar"],["https://evil.example","/continuar"],["/dashboard","/dashboard"]])("normaliza %s",(input,expected)=>expect(safeInternalPath(input)).toBe(expected))});
describe("proteção anti-bypass",()=>{it.each(["email@site.com","(11) 99999-8888","WhatsApp","https://pagamento.example"])("detecta contato em %s",value=>expect(moderateChatMessage(value).allowed).toBe(false))});
