# Backup do banco

O workflow `.github/workflows/backup.yml` gera um backup diário às 06:00 UTC (03:00 no horário de Brasília) e também pode ser iniciado em **Actions → Daily database backup → Run workflow**. Ele salva estrutura, dados e definições de roles como um artefato do GitHub Actions, com retenção de 7 dias. Os arquivos são removidos do runner ao final e nunca são enviados ao Git como commit.

## Configuração

No GitHub, abra **Settings → Secrets and variables → Actions → New repository secret** e crie:

- `SUPABASE_DB_URL`: string de conexão do banco Supabase. Use **Connect → Session pooler** no painel do Supabase.

O repositório precisa permanecer privado para armazenar esses artefatos com dados do banco.

## Conteúdo e limites

O workflow usa `supabase db dump` para gerar estrutura, dados e roles. O CLI exclui schemas gerenciados pelo Supabase, incluindo `auth` e `storage`; arquivos de Storage também não fazem parte do dump. Para uma recuperação completa desses serviços, mantenha também os backups nativos do Supabase.

## Restaurar

1. Baixe e extraia o artefato em um ambiente seguro: `tar xzf insidely-backup-AAAA-MM-DD.tar.gz`.
2. Em um banco Supabase de destino, aplique os arquivos conforme necessário com `psql` e a connection string do destino. Restaure primeiro `roles.sql`, depois `schema.sql` e `data.sql`.
3. Apague os arquivos extraídos quando terminar.
