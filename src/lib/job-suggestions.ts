import "server-only";
import { createSupabaseServiceClient } from "@/lib/supabase/service";

// Suggestions for the "Cargo" and "Área" fields: what consultants already use plus common
// titles and areas in Brazil. People can still type something that is not on the list.
const COMMON_TITLES = [
  "Analista Administrativo", "Analista de Dados", "Analista de Marketing", "Analista de Sistemas", "Analista Financeiro", "Analista de RH", "Analista de Produto",
  "Analista de Suporte", "Analista Comercial", "Analista de Logística", "Analista Fiscal", "Analista Contábil", "Analista de Compras", "Analista de Qualidade",
  "Assistente Administrativo", "Auxiliar Administrativo", "Atendente", "Vendedor", "Consultor de Vendas", "Representante Comercial", "Gerente Comercial",
  "Gerente de Projetos", "Gerente de Produto", "Product Manager", "Product Owner", "Product Designer", "UX Designer", "UI Designer", "Designer Gráfico",
  "Desenvolvedor Front-end", "Desenvolvedor Back-end", "Desenvolvedor Full Stack", "Desenvolvedor Mobile", "Engenheiro de Software", "Engenheiro de Dados",
  "Cientista de Dados", "Engenheiro de Machine Learning", "Analista de Segurança da Informação", "DevOps", "Arquiteto de Software", "Tech Lead", "QA / Testes",
  "Coordenador", "Supervisor", "Gerente", "Diretor", "Estagiário", "Trainee", "Jovem Aprendiz",
  "Engenheiro Civil", "Engenheiro de Produção", "Engenheiro Mecânico", "Engenheiro Eletricista", "Técnico de Manutenção", "Operador de Produção",
  "Contador", "Advogado", "Assistente Jurídico", "Enfermeiro", "Técnico de Enfermagem", "Médico", "Farmacêutico", "Nutricionista", "Psicólogo", "Fisioterapeuta",
  "Professor", "Coordenador Pedagógico", "Recrutador", "Business Partner de RH", "Comprador", "Especialista de Logística", "Motorista", "Caixa", "Repositor",
  "Gerente de Loja", "Social Media", "Redator", "Jornalista", "Customer Success", "SDR", "Executivo de Contas", "Analista de Investimentos", "Assessor de Investimentos",
];
const COMMON_AREAS = [
  "Administração", "Atendimento", "Comercial", "Compras", "Comunicação", "Contabilidade", "Dados", "Design", "Educação", "Engenharia", "Financeiro", "Jurídico",
  "Logística", "Marketing", "Negócios", "Operações", "Pessoas / RH", "Produto", "Qualidade", "Saúde", "Segurança da Informação", "Suporte", "Tecnologia", "Vendas", "Varejo",
];

export async function getJobSuggestions() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (createSupabaseServiceClient() as any).from("EmploymentExperience").select("title, area").limit(2000);
  const rows = (data ?? []) as { title: string; area: string }[];
  const unique = (values: string[]) => [...new Map(values.map((value) => value.trim()).filter((value) => value.length > 1 && value !== "Profissional").map((value) => [value.toLocaleLowerCase("pt-BR"), value])).values()].sort((a, b) => a.localeCompare(b, "pt-BR"));
  return { titles: unique([...COMMON_TITLES, ...rows.map((row) => row.title)]), areas: unique([...COMMON_AREAS, ...rows.map((row) => row.area)]) };
}
