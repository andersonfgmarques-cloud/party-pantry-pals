# Party Pantry Pals

Aplicação colaborativa para organizar a lista de contribuições de uma festa. Os convidados podem consultar os itens, informar o que vão levar e reservar quantidades; o organizador administra os itens e os detalhes do evento.

## Arquitetura independente

- **Aplicação:** TanStack Start + React + Vite + Nitro.
- **Código e automação:** GitHub.
- **Banco e tempo real:** Supabase.
- **Hospedagem gratuita:** Cloudflare Workers (plano Free, sujeito aos limites vigentes da plataforma).
- **Pacotes:** Bun, com dependências registradas em `bun.lock`.

A aplicação mantém o Supabase existente. A publicação não executa migrations, não apaga tabelas e não altera os dados da festa. O projeto não depende do editor nem do runtime do Lovable.

## Desenvolvimento local

Requisitos: Bun e Node.js 22 ou superior.

```bash
git clone https://github.com/andersonfgmarques-cloud/party-pantry-pals.git
cd party-pantry-pals
bun install --frozen-lockfile
cp .env.example .env
bun run dev
```

Preencha o `.env` com as variáveis do seu projeto Supabase e uma senha forte para o organizador.

## Publicação gratuita pelo GitHub Actions

O workflow `Deploy Cloudflare Workers` tem duas etapas visíveis, **build** e **deploy**, no mesmo estilo do workflow do seu projeto InglesSpeak. Ele é executado automaticamente quando há push na branch `main` e também pode ser iniciado manualmente em **Actions → Deploy Cloudflare Workers → Run workflow**.

1. Crie uma conta gratuita na Cloudflare e habilite um subdomínio `workers.dev`.
2. No painel Cloudflare, crie um API Token com permissões de editar Workers e consultar a conta.
3. No GitHub, abra **Settings → Secrets and variables → Actions → New repository secret**.
4. Cadastre estes seis secrets:

| Nome | Conteúdo |
| --- | --- |
| `CLOUDFLARE_API_TOKEN` | Token de API da Cloudflare |
| `CLOUDFLARE_ACCOUNT_ID` | ID da conta Cloudflare |
| `SUPABASE_URL` | URL do projeto Supabase já utilizado pela aplicação |
| `SUPABASE_PUBLISHABLE_KEY` | Chave publicável do mesmo projeto |
| `SUPABASE_SERVICE_ROLE_KEY` | Chave service_role/secret, somente no servidor |
| `ORGANIZER_PASSWORD` | Senha da área administrativa |

5. Em **Actions**, selecione **Deploy Cloudflare Workers** e clique em **Run workflow**.

O workflow compila a aplicação para Cloudflare Workers, publica o serviço e configura os quatro segredos de servidor no Worker. A URL pública será exibida no resumo da execução, no formato `https://party-pantry-pals.<seu-subdominio>.workers.dev`.

As variáveis `VITE_SUPABASE_URL` e `VITE_SUPABASE_PUBLISHABLE_KEY` são preenchidas durante a compilação a partir dos secrets `SUPABASE_URL` e `SUPABASE_PUBLISHABLE_KEY`. Somente a chave publicável é enviada ao navegador. A chave de serviço e a senha do organizador nunca devem receber prefixo `VITE_`.

## Verificações

```bash
bun run lint
bun run test
bun run typecheck
bun run build
```

O workflow de CI executa lint, testes, verificação de tipos e build em cada push e pull request.

## Segurança operacional

- Nunca envie `.env`, tokens ou chaves privadas ao GitHub.
- Não coloque `SUPABASE_SERVICE_ROLE_KEY` ou `ORGANIZER_PASSWORD` em variáveis `VITE_*`.
- Use o mesmo projeto Supabase que contém os dados existentes; não crie outro projeto nem rode migrations para esta publicação.
- O plano gratuito tem limites de uso e pode mudar conforme as condições da Cloudflare e do Supabase.
