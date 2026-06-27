# Deploy na Locaweb — cmbusinesstoken.com/politicapp

Guia para colocar o Politapp (front + auth PHP + MySQL) no ar na Locaweb.

- **URL final:** https://cmbusinesstoken.com/politicapp
- **Pasta no servidor:** `/public_html/politicapp`
- **FTP:** `ftp.cmbusinesstoken1.hospedagemdesites.ws`

> O front e o PHP ficam no **mesmo domínio** (same-origin). O `auth-config.js`
> detecta o host `cmbusinesstoken.com` e ativa o auth PHP automaticamente —
> não precisa editar a flag.

---

## 1. Banco de dados (MySQL)

No painel MySQL da Locaweb (phpMyAdmin), no banco `politicapp_bd`, rode **nesta ordem**:

1. `sql/locaweb-mysql-schema.sql` — tabelas da aplicação
2. `sql/locaweb-auth-php.sql` — login (auth_users, sessões, OTP)
3. `sql/locaweb-uploads.sql` — upload de arquivos

Se aparecer `#1359 Trigger already exists`, os scripts já são idempotentes
(têm `DROP TRIGGER IF EXISTS`) — basta rodar de novo.

---

## 2. Upload dos arquivos (FTP)

Envie para **`/public_html/politicapp/`** mantendo esta estrutura final no servidor:

```
/public_html/politicapp/
├─ index.html, login-locaweb.html, *.html      (todos os HTML do repo)
├─ css/  js/  data/  favicon.svg  ...           (assets do repo)
├─ auth/         ←  conteúdo de  php/auth/
├─ files/        ←  conteúdo de  php/files/
├─ lib/          ←  conteúdo de  php/lib/
├─ storage/      ←  conteúdo de  php/storage/   (uploads/ gravável)
├─ config.php    ←  cópia de     php/config.example.php (preenchida)
└─ .htaccess     ←  de           php/.htaccess  (MIME .mjs + protege config.php)
```

> O `.htaccess` em `/politicapp/` é **obrigatório**: ele ensina o Apache a
> servir `.mjs` como JavaScript. Sem ele, todos os módulos ES quebram e os
> botões "não respondem ao clicar".

⚠️ **Atenção ao mapear o `php/`:** o conteúdo de `php/` é "achatado" na raiz de
`/politicapp/`. Ou seja, `php/auth/login.php` vai para `/politicapp/auth/login.php`
(e **não** `/politicapp/php/auth/...`) — é assim que o front encontra os endpoints.

---

## 3. config.php

1. Copie `php/config.example.php` → `config.php` (na raiz `/politicapp/`).
2. Preencha (de preferência por variáveis de ambiente do painel Locaweb):
   - `DB_PASS` — a senha do MySQL (**troque a que foi exposta no chat**)
   - `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`
   - Os defaults de `redirect_uri`, `app_url` e `allowed_origins` já apontam
     para `cmbusinesstoken.com/politicapp`.
3. Confirme que `config.php` **não** é acessível pela web (o `.htaccess` da
   pasta já bloqueia; teste abrindo `…/politicapp/config.php` → deve dar 403).

---

## 4. Google OAuth

No [Google Cloud Console](https://console.cloud.google.com/) → Credenciais →
OAuth 2.0 Client:
- **Authorized redirect URI:** `https://cmbusinesstoken.com/politicapp/auth/google-callback.php`
- Copie Client ID e Secret para o `config.php`.

---

## 5. Permissões

- `storage/uploads/` precisa ser **gravável** pelo PHP (geralmente `755`/`775`).
- Confirme que o `.htaccess` em `storage/uploads/` está presente (desliga
  execução de PHP na pasta de uploads).

---

## 6. SMS (login por telefone)

O envio de SMS está como stub em `lib/auth.php` → `pa_send_sms()`. Integre o
gateway contratado (Zenvia, Twilio, etc.) nessa função para o OTP por telefone
funcionar. E-mail+senha e Google funcionam sem isso.

---

## 7. Testes pós-deploy

Abra `https://cmbusinesstoken.com/politicapp/login-locaweb.html` e valide:

1. **Cadastro e-mail/senha** → cria conta (fica `pendente` até aprovação do admin).
2. **Login e-mail/senha** → entra e redireciona ao app.
3. **Google** → botão leva ao Google e volta logado.
4. **Telefone** → só após integrar o gateway de SMS.
5. Abrir uma página protegida (ex.: `index.html`) sem login → deve mandar para
   `login-locaweb.html`.

Se algo falhar, confira o log de erros do PHP no painel Locaweb e o console do
navegador (erros de CORS/cookie aparecem lá).

---

## Troubleshooting

- **Botões "não respondem ao clicar" / página estática:** o Apache está servindo
  `.mjs` como `text/plain`. Confirme:
  `curl -I https://cmbusinesstoken.com/politicapp/js/site-nav.mjs` deve mostrar
  `Content-Type: application/javascript`. Se mostrar `text/plain`, falta a linha
  `AddType application/javascript .mjs` no `.htaccess` de `/politicapp/`.
- **CORS/cookie no login:** só ocorre se o front e o PHP estiverem em domínios
  diferentes. Como tudo está em `cmbusinesstoken.com/politicapp` (same-origin),
  não deve haver CORS. Se aparecer, confira `allowed_origins` no `config.php`.
- **Erro 500 nos `.php`:** veja o log de erros PHP no painel; geralmente é
  `config.php` ausente ou credencial de banco errada.

## Aprovar contas (admin)

Toda conta nova entra como `conta_status = 'pendente'`. Para liberar acesso,
um admin muda para `'aprovado'` em `profiles` (ou pela tela de admin, quando
ligada ao novo backend). Para promover o primeiro admin manualmente:

```sql
UPDATE profiles SET grupo='admin', conta_status='aprovado' WHERE id='<UUID_do_usuario>';
```
