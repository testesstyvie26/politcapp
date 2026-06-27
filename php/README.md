# Auth próprio (PHP) — Politapp

Autenticação para a migração à Locaweb, com 3 métodos: **e-mail+senha**, **Google (OAuth2)** e **telefone (OTP/SMS)**. Sem dependências externas (PDO + cURL).

## Estrutura

```
php/
├─ config.example.php      → copie para config.php e preencha
├─ lib/
│  ├─ db.php               → conexão PDO
│  └─ auth.php             → biblioteca de auth (sessão, Google, OTP)
└─ auth/
   ├─ register.php         POST {email,senha,nome}      → cadastro e-mail+senha
   ├─ login.php            POST {email,senha}           → login e-mail+senha
   ├─ logout.php           POST                         → encerra sessão
   ├─ me.php               GET                          → usuário logado (+profile)
   ├─ google-start.php     GET                          → redireciona ao Google
   ├─ google-callback.php  GET ?code&state              → conclui login Google
   ├─ phone-request.php    POST {telefone}              → envia OTP por SMS
   └─ phone-verify.php     POST {telefone,codigo}       → confere OTP e loga
```

## Pré-requisitos

1. Rode os schemas no MySQL da Locaweb (nesta ordem):
   - `sql/locaweb-mysql-schema.sql` (tabelas da aplicação)
   - `sql/locaweb-auth-php.sql` (tabelas de auth) — **substitui** o clone GoTrue
2. Reaponte as FKs do schema público para `auth_users(id)` (veja o bloco
   "INTEGRAÇÃO" em `locaweb-auth-php.sql`).

## Configuração

1. `cp php/config.example.php php/config.php`
2. Defina as variáveis de ambiente (recomendado) ou edite `config.php`:
   - `DB_HOST`, `DB_NAME`, `DB_USER`, `DB_PASS`
   - `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI`
   - `APP_URL` (para onde redirecionar após login)
3. No Google Cloud Console, crie credenciais OAuth 2.0 e registre o
   **redirect URI** = `https://SEU_DOMINIO/auth/google-callback.php`.
4. Integre um **gateway de SMS** em `pa_send_sms()` (Zenvia, Twilio, etc.) —
   hoje ela só escreve no log.

## Segurança (importante)

- **Nunca** comite `config.php` com a senha real. Use variáveis de ambiente.
  (`config.php` está no `.gitignore`.)
- O `.htaccess` bloqueia acesso web ao `config.php` e à pasta `lib/`.
  Em servidor não-Apache, configure o equivalente ou mova `config.php` para
  fora do webroot.
- Senhas: `password_hash`/`password_verify` (bcrypt). Sessões: cookie
  `HttpOnly`+`Secure`+`SameSite`; no banco guardamos só o `sha256` do token.
- OTP: 6 dígitos, expira em 10 min, máx. 5 tentativas; o código **nunca** é
  devolvido ao cliente (vai só pelo SMS).
- Rate limit: 5 falhas em 15 min bloqueiam temporariamente o identificador.
- O front nunca recebe a senha do banco nem tokens — só o cookie de sessão.

## Limpeza periódica (cron / evento MySQL)

```sql
DELETE FROM auth_sessions WHERE expira_em < NOW() OR revogado_em IS NOT NULL;
DELETE FROM auth_otp      WHERE expira_em < NOW();
DELETE FROM auth_tentativas_login WHERE created_at < (NOW() - INTERVAL 30 DAY);
```

## Nota sobre hospedagem

PHP **não roda no GitHub Pages** (host atual). Estes arquivos são para o
ambiente Locaweb (PHP + MySQL), após a migração.
