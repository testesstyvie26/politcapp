# Login com Google (Supabase) — checklist

O front usa `js/auth-config.js` (URL do projeto + chave publishable). O que **não** pode faltar é a configuração no **painel Supabase** e no **Google Cloud**.

## 1. Supabase — URLs

1. Abra [Supabase Dashboard](https://supabase.com/dashboard) → seu projeto.
2. **Authentication → URL Configuration**
   - **Site URL:** a origem principal do site, por exemplo `https://politcapp.com.br` ou `http://127.0.0.1:5500` (porta do Live Server / `npx serve`).
   - **Redirect URLs:** inclua **todas** as URLs exatas de retorno após o login (uma por linha), por exemplo:
     - `https://politcapp.com.br/login.html`
     - `http://localhost:5500/login.html`
     - `http://127.0.0.1:5500/login.html`
     - Se usar GitHub Pages em subpasta: `https://SEU_USUARIO.github.io/REPO/login.html`

Sem isso, o Supabase bloqueia o redirect e o login falha após escolher a conta Google.

## 2. Supabase — Provedor Google

1. **Authentication → Providers → Google** → habilitar.
2. No [Google Cloud Console](https://console.cloud.google.com/apis/credentials) crie credenciais **OAuth client ID** (tipo **Aplicação Web**).
3. **URIs de redirecionamento autorizados** (no Google): adicione **exatamente** o callback do Supabase, no formato:

   `https://koqkdqrcuplhtjggvora.supabase.co/auth/v1/callback`

   (Substitua pelo host do seu projeto se for outro; o painel Supabase em *Authentication → Providers → Google* costuma mostrar essa URL.)

4. **Origens JavaScript autorizadas:** inclua as origens do seu site, por exemplo `https://politcapp.com.br` e `http://localhost:5500`.
5. Cole **Client ID** e **Client Secret** no formulário do Google em Supabase e salve.

## 3. Testar

1. Sirva o site por HTTP(S), não só `file://` (use Live Server, `npx serve`, etc.).
2. Abra `login.html` → **Continuar com Google**.
3. Após autenticar, você deve voltar para `login.html` (sem erro) e ser redirecionado para `index.html`, ou ver a conta em **Conta**.

## 4. Problemas comuns

| Sintoma | O que conferir |
|--------|------------------|
| `redirect_uri_mismatch` | URI de redirect no **Google** deve ser o host `*.supabase.co/auth/v1/callback`, não o seu `login.html`. |
| Erro após voltar do Google | **Redirect URLs** no Supabase devem incluir a URL **exata** de `login.html` (com `https`, domínio e caminho). |
| Nada acontece / sessão vazia | Confirme chave publishable e URL em `auth-config.js`; teste em `http://127.0.0.1` com a mesma porta nas Redirect URLs. |

A connection string **PostgreSQL** do painel não é usada pelo login no navegador — só por ferramentas SQL ou backend.
