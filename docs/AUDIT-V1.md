# Auditoria da V1

## Diagnóstico

A primeira reconstrução comunicava a proposta e oferecia navegação pública, mas ainda funcionava como protótipo de demonstração. Os principais limites identificados foram:

- papéis alternados por controles de demonstração, sem credenciais ou sessão segura;
- dependência do ambiente Sites/D1 e de um domínio `*.chatgpt.site`;
- contadores e alguns estados apresentados de forma fixa;
- catálogo reduzido e pouca variação de empresas, profissões e privacidade;
- fluxos de reserva, pagamento, mensagem, verificação e moderação sem persistência integral;
- movimento e transições abaixo da ambição editorial da referência visual;
- ausência de pacote convencional para VS Code, GitHub, PostgreSQL e Vercel.

## Decisões da versão atual

1. Repositório Next.js independente, sem código ou configuração de Sites.
2. PostgreSQL como fonte de verdade e Prisma para schema, migração e seed.
3. Auth.js Credentials, bcrypt e verificações de papel no servidor.
4. Indicadores sempre agregados de consultas ao banco.
5. Catálogo determinístico de 80 profissionais, 20 empresas e 25 profissões.
6. Transação para bloquear horário e criar consulta; pagamento explicitamente simulado.
7. Painéis distintos para usuário, consultor e administrador.
8. Design System editorial próprio, inspirado em princípios de ritmo, escala, cor e movimento — sem copiar identidade, texto ou composição da referência.
