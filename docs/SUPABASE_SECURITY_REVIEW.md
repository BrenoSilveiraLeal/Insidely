# Revisão de funções privilegiadas

Revisão registrada em 26/08/2026. As funções que precisam atravessar RLS permanecem `SECURITY DEFINER`; leituras públicas continuam invoker/views públicas com somente os campos editoriais necessários.

## Critérios aplicados

- `SECURITY DEFINER` usa `search_path = ''` e relações qualificadas (`public.*`/`auth.*`/`extensions.*`), sempre que a função precisa de privilégio.
- Toda função que recebe um identificador de usuário deriva a autorização de `auth.uid()` e não de `user_metadata` ou de um ID fornecido pelo cliente.
- Execução é revogada de `public` e `anon`; funções de produto recebem apenas `authenticated`; rotinas de sistema recebem apenas `service_role`.
- Dados privados (`passwordHash`, segredo 2FA, documentos, pagamento e chaves) não são retornados pelas views públicas.

## Escopo revisado

| Área | Funções | Resultado |
|---|---|---|
| Perfil e privacidade | `update_professional_profile`, `update_privacy`, `update_profile_image`, `update_profile_cover`, `remove_profile_cover` | vínculo ao consultor autenticado; experiências substituídas em lote com datas validadas; faixa etária opcional, sem data de nascimento |
| Dashboard | `get_consultant_summary`, `get_consultant_bookings`, `get_consultant_messages`, `get_consultant_notifications`, `get_consultant_gains` | cinco consultas paginadas, cada uma verifica consultor + `auth.uid()` |
| Agenda e conversa | `create_consultant_availability`, `remove_consultant_availability`, `send_message`, `set_recording_consent`, `confirm_booking`, `dispute_booking`, `complete_booking` | acesso limitado ao participante correto |
| Pagamento e repasse | `create_booking`, `report_booking_payment`, `admin_confirm_booking_payment`, `release_eligible_bookings_for_user`, `release_eligible_bookings_system` | usuário autenticado ou rotina de sistema conforme o caso; administração valida papel |
| Verificação e moderação | `submit_verification`, `admin_review_verification`, `create_profile_report`, `create_support_report`, `admin_resolve_report` | dono do recurso ou administrador validado por `auth.uid()` |

As alterações executáveis estão em `supabase/migrations/20260826010000_consultant_dashboard_pagination_privacy.sql`. Depois de aplicar a migration no projeto Supabase, executar no SQL Editor:

```sql
select n.nspname as schema_name, p.proname, pg_get_userbyid(p.proowner) as owner,
       p.prosecdef as security_definer, p.proconfig
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname in ('public','private')
  and p.prosecdef
order by 1,2;
```

O resultado deve ser comparado com esta tabela: funções de usuário devem ter `search_path={}` (ou uma lista explícita de schemas confiáveis), autorização por `auth.uid()` e grants mínimos. Views públicas devem ser inspecionadas com `pg_get_viewdef`; nenhuma pode incluir segredos ou dados de pagamento.
