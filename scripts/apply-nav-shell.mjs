import fs from "fs";
import path from "path";

const root = path.join(import.meta.dirname, "..");
const CSS = `  <link rel="stylesheet" href="css/site-shell-nav.css?v=4" />\n  <link rel="stylesheet" href="css/site-theme.css?v=1" />\n`;
const SKIP = `  <a class="politapp-skip" href="#politapp-main">Ir ao conteúdo</a>\n`;
const SKIP_LOGIN = `  <a class="politapp-skip" href="#politapp-main">Ir ao conteúdo</a>\n`;

const IGNORE = new Set(["_tre_rj_dados.html"]);

function addGuia(s) {
  if (s.includes("guia-uso.html")) return s;
  const gFull = `      <a href="guia-uso.html">Guia de uso</a>\n`;
  const gLogin = `        <a href="guia-uso.html">Guia de uso</a>\n`;
  let t = s.replace(
    /(\r?\n\s*<a href="whatsapp\.html"[^>]*>WhatsApp<\/a>)\r?\n(\s*<a href="tarefas\.html")/,
    `$1\n${gFull}$2`
  );
  if (t !== s) return t;
  t = s.replace(
    /(\r?\n\s*<a href="whatsapp\.html"[^>]*>WhatsApp<\/a>)\r?\n(\s*<\/nav>)/,
    `$1\n${gFull}$2`
  );
  if (t !== s) return t;
  t = s.replace(
    /(\r?\n\s*<a href="whatsapp\.html">WhatsApp<\/a>)\r?\n(\s*<a href="index\.html">Início<\/a>)/,
    `$1\n${gFull}$2`
  );
  if (t !== s) return t;
  t = s.replace(
    /(\r?\n\s*<a href="whatsapp\.html">WhatsApp<\/a>)\r?\n(\s*<a href="tarefas\.html")/,
    `$1\n${gLogin}$2`
  );
  return t;
}

function addCss(s) {
  if (s.includes("site-theme.css")) return s;
  return s.replace("</head>", `${CSS}</head>`);
}

function addSkip(s, base) {
  if (s.includes("politapp-skip")) return s;
  if (base === "login.html") {
    return s.replace(/<body>\r?\n  <div class="login-bg"/, `<body>\n${SKIP_LOGIN}  <div class="login-bg"`);
  }
  if (s.includes("<body>") && s.includes('<script src="js/auth-config.js">')) {
    const t = s.replace(
      /<body>\r?\n  <script src="js\/auth-config\.js"><\/script>/,
      `<body>\n${SKIP}  <script src="js/auth-config.js"></script>`
    );
    if (t !== s) return t;
  }
  if (base === "404.html") {
    return s.replace(/<body>\r?\n  <h1>/, `<body>\n${SKIP}<h1 id="politapp-main" tabindex="-1">`);
  }
  if (base === "aguarde-aprovacao.html") {
    let t = s.replace(/<body>\r?\n  <div class="card" id="root">/, `<body>\n${SKIP}<div class="card" id="root">`);
    t = t.replace("<h1>Aguardando aprovação</h1>", '<h1 id="politapp-main" tabindex="-1">Aguardando aprovação</h1>');
    return t;
  }
  if (base === "conta-recusada.html") {
    let t = s.replace(/<body>\r?\n  <div class="card">/, `<body>\n${SKIP}<div class="card">`);
    t = t.replace("<h1>Acesso não autorizado</h1>", '<h1 id="politapp-main" tabindex="-1">Acesso não autorizado</h1>');
    return t;
  }
  return s.replace(/<body>\r?\n/, `<body>\n${SKIP}`);
}

function addMainId(s, base) {
  if (s.includes('id="politapp-main"') || s.includes("id='politapp-main'")) return s;
  if (base === "login.html") {
    return s.replace(
      '<main class="login-grid">',
      '<main id="politapp-main" class="login-grid" tabindex="-1">'
    );
  }
  if (base === "candidato.html") {
    return s.replace(
      `    <a class="back" href="index.html">← Voltar à lista</a>
    <div id="app"><div class="loading"><div class="spinner"></div>Carregando perfil…</div>

    <footer class="site-credit"`,
      `    <div id="politapp-main" tabindex="-1">
    <a class="back" href="index.html">← Voltar à lista</a>
    <div id="app"><div class="loading"><div class="spinner"></div>Carregando perfil…</div>
    </div>

    <footer class="site-credit"`
    );
  }
  let t = s.replace(
    /\r?\n    <header class="no-print">\r?\n      <h1>/,
    `\n    <header id="politapp-main" tabindex="-1" class="no-print">\n      <h1>`
  );
  if (t !== s) return t;
  t = s.replace(/\r?\n\r?\n    <header>\r?\n      <h1>/, `\n\n    <header id="politapp-main" tabindex="-1">\n      <h1>`);
  if (t !== s) return t;
  t = s.replace(/\r?\n    <header>\r?\n      <h1>/, `\n    <header id="politapp-main" tabindex="-1">\n      <h1>`);
  if (t !== s) return t;
  if (base === "admin-unidades.html") {
    return s.replace(/\r?\n    <h1>Unidades<\/h1>/, `\n    <h1 id="politapp-main" tabindex="-1">Unidades</h1>`);
  }
  if (base === "admin-aprovacoes.html") {
    return s.replace(
      /\r?\n    <h1>Pedidos de conta pendentes<\/h1>/,
      `\n    <h1 id="politapp-main" tabindex="-1">Pedidos de conta pendentes</h1>`
    );
  }
  if (base === "index.html") {
    return s.replace(/\r?\n    <header>\r?\n      <div class="header-top">/, `\n    <header id="politapp-main" tabindex="-1">\n      <div class="header-top">`);
  }
  return s;
}

for (const f of fs.readdirSync(root)) {
  if (!f.endsWith(".html") || IGNORE.has(f)) continue;
  const fp = path.join(root, f);
  let s = fs.readFileSync(fp, "utf8");
  const before = s;
  s = addCss(s);
  s = addSkip(s, f);
  s = addGuia(s);
  s = addMainId(s, f);
  if (s !== before) fs.writeFileSync(fp, s);
}

console.log("apply-nav-shell: concluído.");


