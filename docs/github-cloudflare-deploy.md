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

### Login Google no domínio do Politapp

Cadastre estas variáveis em **Workers & Pages → politcapp → Settings → Variables and Secrets**:

- `GOOGLE_CLIENT_ID`: ID público do cliente OAuth;
- `GOOGLE_CLIENT_SECRET`: segredo, marcado como **Secret**;
- `COOKIE_SECRET`: segredo aleatório forte, marcado como **Secret**.

No Google Cloud Console, o cliente OAuth deve ter exatamente esta URI em
**URIs de redirecionamento autorizados**:

`https://politcapp.com.br/api/google-callback`

O callback ocorre no Cloudflare Pages e o ID token é enviado ao backend PHP
para validação e criação da sessão compatível com o restante do Politapp.

## Publicação manual

O workflow também aceita **Run workflow** na aba Actions do GitHub.
