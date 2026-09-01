# Deploy automático do GitHub para Cloudflare Pages

O workflow `.github/workflows/deploy-cloudflare.yml` publica cada `push`:

- `main`: produção em `politcapp.pages.dev`;
- outras branches: preview isolado no Cloudflare Pages.

## Secrets necessários no GitHub

Em **Settings → Secrets and variables → Actions**, adicione:

- `CLOUDFLARE_API_TOKEN`: token restrito à conta, com permissão para editar Cloudflare Pages;
- `CLOUDFLARE_ACCOUNT_ID`: ID da conta Cloudflare que contém o projeto `politcapp`.

Nunca salve o token em `.env`, workflow, commit ou arquivo do projeto.

## Fluxo

1. O GitHub instala as dependências com `npm ci`.
2. O build Node gera `dist/`.
3. O Wrangler envia `dist/` ao projeto `politcapp`.
4. A branch e o SHA do commit ficam associados ao deployment.

## Pages Function

Após o deploy, `GET /api/deployment` retorna o projeto, branch, commit e URL que estão atendendo a requisição. A resposta não é armazenada em cache.

## Publicação manual

O workflow também aceita **Run workflow** na aba Actions do GitHub.
