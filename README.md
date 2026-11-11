# Party Pantry Pals

Aplicação colaborativa para organizar a lista de contribuições de uma festa. Os convidados podem consultar os itens, informar o que vão levar e reservar quantidades; o organizador administra os itens e os detalhes do evento.

## Arquitetura independente

- **Aplicação:** TanStack Start + React + Vite.
- **Código e automação:** GitHub.
- **Banco e tempo real:** Supabase.
- **Hospedagem da aplicação:** Render (configuração versionada em `render.yaml`).
- **Pacotes:** Bun, com dependências registradas em `bun.lock`.

O projeto não precisa do editor, do gateway ou do ambiente de execução do Lovable para instalar dependências, desenvolver, testar, compilar ou hospedar a aplicação. O Supabase continua sendo um serviço separado e deve permanecer configurado com o mesmo projeto para preservar os dados existentes.

## Requisitos

- Bun (versão compatível com o lockfile).
- Node.js 22 ou superior para execução de produção.
- Um projeto Supabase com o esquema e as políticas já utilizados pela aplicação.

## Desenvolvimento local

```bash
git clone https://github.com/andersonfgmarques-cloud/party-pantry-pals.git
cd party-pantry-pals
bun install --frozen-lockfile
cp .env.example .env
```

Preencha o arquivo `.env` com as credenciais do seu projeto Supabase e uma senha forte para o organizador. Em seguida:

```bash
bun run dev
```

## Variáveis de ambiente

| Variável | Uso |
| --- | --- |
| `SUPABASE_URL` | URL do projeto Supabase no servidor |
| `SUPABASE_PUBLISHABLE_KEY` | Chave publicável do Supabase no servidor |
| `SUPABASE_SERVICE_ROLE_KEY` | Chave privilegiada, somente no servidor |
| `ORGANIZER_PASSWORD` | Senha da área administrativa |
| `VITE_SUPABASE_URL` | URL pública do Supabase incorporada ao cliente |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Chave publicável incorporada ao cliente |

As variáveis `VITE_*` são entregues ao navegador. Use nelas somente a URL e a chave publicável. Nunca use uma chave `service_role` ou `sb_secret_*` com prefixo `VITE_`.

## Verificações

```bash
bun run lint
bun run test
bun run typecheck
bun run build
```

O GitHub Actions executa essas verificações em cada push e pull request.

## Publicação independente no Render

1. Importe este repositório no Render usando o Blueprint `render.yaml`.
2. Configure os valores de Supabase e `ORGANIZER_PASSWORD` nos Environment Variables do serviço.
3. O Blueprint executa `bun install --frozen-lockfile && bun run build` e inicia `node .output/server/index.mjs`.
4. O serviço usa o preset Nitro `render-com`; o Render fornece a porta HTTP.

A publicação da aplicação não executa migrations, não limpa tabelas e não altera os dados da festa. O banco Supabase existente continua sendo usado.

## Segurança operacional

- Mantenha `.env` fora do Git; use `.env.example` apenas como modelo.
- A chave de serviço do Supabase e a senha do organizador devem ser configuradas como segredos no provedor de hospedagem.
- Faça mudanças de banco separadamente, com revisão e confirmação do projeto de destino.
