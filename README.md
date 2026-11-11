# Party Pantry Pals

Aplicação colaborativa para organizar a lista de contribuições da Festa na Chácara.

## Arquitetura

- Frontend estático: React + TanStack Router + Vite, publicado no GitHub Pages.
- Banco, consultas públicas e Realtime: Supabase.
- Operações privilegiadas: Supabase Edge Function `party-api`.
- Chaves privadas permanecem nos secrets do Supabase; apenas a chave publicável é usada no navegador.

## Desenvolvimento local

Requisitos: Bun e Node.js 22+.

```bash
bun install --frozen-lockfile
cp .env.example .env
bun run dev
```

Preencha `.env` com a URL e a chave publicável do projeto Supabase.

## GitHub Pages

O workflow `Deploy GitHub Pages` publica automaticamente após push na branch `main` ou manualmente pela aba Actions.

Cadastre em **Settings → Secrets and variables → Actions**:

- `VITE_SUPABASE_URL`: `https://iwslbqggusklrjjrlvvr.supabase.co`
- `VITE_SUPABASE_PUBLISHABLE_KEY`: chave publicável do projeto Party Pantry Pals.

Não cadastre a service role key no GitHub Pages e nunca use prefixo `VITE_` em uma chave privada.

## Supabase

A migration `supabase/migrations/20261111000100_party_pantry_schema.sql` cria as tabelas, políticas de leitura pública e publicação Realtime. A função `party-api` executa as operações de gravação no servidor.

Configure o secret `ORGANIZER_PASSWORD` em **Supabase → Edge Functions → Secrets** antes de usar a área administrativa.

## Validação

```bash
bun run lint
bun run test
bun run typecheck
bun run build
```
