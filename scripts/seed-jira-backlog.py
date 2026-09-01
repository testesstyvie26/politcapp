#!/usr/bin/env python3
"""Popula o projeto Jira POLITCAP (Politapp): épicos, entregas, testes e backlog."""

from __future__ import annotations

import base64
import json
import os
import sys
import time
import urllib.error
import urllib.request

SITE = os.environ.get("JIRA_SITE", "coinmarketbrasil.atlassian.net").strip().rstrip("/")
EMAIL = os.environ.get("JIRA_EMAIL", "rafael_styvie@hotmail.com")
TOKEN = os.environ.get("JIRA_API_TOKEN", "")
PROJECT = os.environ.get("JIRA_PROJECT", "POLITCAP")


def safe_print(msg: str) -> None:
    enc = getattr(sys.stdout, "encoding", None) or "utf-8"
    try:
        print(msg)
    except UnicodeEncodeError:
        print(msg.encode(enc, errors="replace").decode(enc))


def auth_header() -> str:
    return "Basic " + base64.b64encode(f"{EMAIL}:{TOKEN}".encode()).decode()


def jira(path: str, method: str = "GET", body: dict | None = None):
    url = f"https://{SITE}{path}"
    data = None if body is None else json.dumps(body).encode("utf-8")
    req = urllib.request.Request(
        url,
        data=data,
        method=method,
        headers={
            "Authorization": auth_header(),
            "Accept": "application/json",
            "Content-Type": "application/json",
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=45) as resp:
            raw = resp.read().decode("utf-8")
            return resp.status, json.loads(raw) if raw else {}
    except urllib.error.HTTPError as e:
        err = e.read().decode("utf-8", errors="replace")
        raise RuntimeError(f"HTTP {e.code} {path}: {err[:500]}") from e


def desc(text: str) -> dict:
    return {
        "type": "doc",
        "version": 1,
        "content": [{"type": "paragraph", "content": [{"type": "text", "text": text}]}],
    }


def get_issue_types() -> dict[str, str]:
    _, data = jira(f"/rest/api/3/project/{PROJECT}")
    return {t["name"].lower(): t["id"] for t in data.get("issueTypes", [])}


def pick_type(types: dict[str, str], *names: str) -> str:
    for n in names:
        tid = types.get(n.lower())
        if tid:
            return tid
    return next(iter(types.values()))


def create_issue(
    types: dict[str, str],
    summary: str,
    description: str,
    issue_type_names: tuple[str, ...],
    labels: list[str],
    parent_key: str | None = None,
) -> str:
    it = pick_type(types, *issue_type_names)
    fields: dict = {
        "project": {"key": PROJECT},
        "summary": summary,
        "description": desc(description),
        "issuetype": {"id": it},
        "labels": labels,
    }
    if parent_key:
        fields["parent"] = {"key": parent_key}
    _, res = jira("/rest/api/3/issue", "POST", {"fields": fields})
    return res["key"]


def transition_done(issue_key: str) -> bool:
    _, trans = jira(f"/rest/api/3/issue/{issue_key}/transitions")
    done_id = None
    for t in trans.get("transitions", []):
        name = (t.get("name") or "").lower()
        if name in ("done", "concluído", "concluido", "itens concluídos", "itens concluidos"):
            done_id = t["id"]
            break
    if not done_id:
        return False
    jira(f"/rest/api/3/issue/{issue_key}/transitions", "POST", {"transition": {"id": done_id}})
    return True


def fetch_existing_summaries() -> set[str]:
    summaries: set[str] = set()
    next_page: str | None = None
    while True:
        body: dict = {
            "jql": f"project = {PROJECT}",
            "maxResults": 100,
            "fields": ["summary"],
        }
        if next_page:
            body["nextPageToken"] = next_page
        _, data = jira("/rest/api/3/search/jql", "POST", body)
        issues = data.get("issues", [])
        for issue in issues:
            summaries.add(issue["fields"]["summary"])
        next_page = data.get("nextPageToken")
        if not next_page or not issues:
            break
    return summaries


def fetch_epic_keys() -> dict[str, str]:
    mapping: dict[str, str] = {}
    next_page: str | None = None
    while True:
        body: dict = {
            "jql": f'project = {PROJECT} AND summary ~ "\\"[Epic]\\""',
            "maxResults": 50,
            "fields": ["summary"],
        }
        if next_page:
            body["nextPageToken"] = next_page
        _, data = jira("/rest/api/3/search/jql", "POST", body)
        for issue in data.get("issues", []):
            summary = issue["fields"]["summary"]
            for ref, name, _ in EPICS:
                if f"[Epic] {name}" == summary:
                    mapping[ref] = issue["key"]
        next_page = data.get("nextPageToken")
        if not next_page or not data.get("issues"):
            break
    return mapping


EPICS = [
    ("EPIC-AUTH", "Autenticação e contas", "Supabase Google, PHP Locaweb, OTP, aprovação de conta."),
    ("EPIC-ORG", "Organização e admin", "Unidades, perfis, hub admin, aprovações, anúncios."),
    ("EPIC-TAREF", "Tarefas e lideranças", "Tarefas diárias por unidade, notas, lideranças RJ cloud."),
    ("EPIC-DADOS", "Dados eleitorais e transparência", "TSE, Câmara, vereadores RJ, portal transparência."),
    ("EPIC-UI", "UI e navegação", "Menu responsivo v11, landings, guia, termos, 404."),
    ("EPIC-DEPLOY", "Deploy e infra", "Locaweb PHP+MySQL, GitHub Pages, CI, Cloudflare Worker."),
    ("EPIC-TEST", "Testes e QA", "Auth, tarefas, admin, dados, acessibilidade."),
    ("EPIC-ROAD", "Roadmap e melhorias", "WhatsApp API, PWA, multi-estado, LGPD, automação TSE."),
]

TASKS: list[tuple[str, str, str, str]] = [
    # AUTH — entregue
    ("EPIC-AUTH", "Login Google via Supabase (auth-client.js)", "docs/supabase-login-setup.md, auth-config.js.", "done"),
    ("EPIC-AUTH", "Auth PHP Locaweb — e-mail, Google OAuth, OTP SMS", "php/auth/*, bcrypt, rate limit, sessões.", "done"),
    ("EPIC-AUTH", "Provider dual Locaweb/Supabase (auth-config.js)", "POLITAPP_AUTH_PROVIDER, POLITAPP_AUTH_BASE.", "done"),
    ("EPIC-AUTH", "Cross-origin token Bearer (locaweb-auth.js)", "GitHub Pages → PHP sem cookies terceiros.", "done"),
    ("EPIC-AUTH", "auth-guard.js + login.js + login-locaweb.html", "Fluxo login, redirect pós-auth.", "done"),
    ("EPIC-AUTH", "Fluxo aguarde-aprovacao e conta-recusada", "aguarde-aprovacao.js, SQL conta-aprovacao.", "done"),
    ("EPIC-AUTH", "Página conta.html (perfil usuário)", "conta.js, dados do me.php.", "done"),
    ("EPIC-AUTH", "Logout UI (logout-ui.js, politapp-logout-if-session)", "Encerramento sessão limpa.", "done"),
    ("EPIC-AUTH", "Upload arquivos seguro (files/upload.php, serve.php)", "MIME finfo, 8MB, storage/uploads/.", "done"),
    # ORG / ADMIN — entregue
    ("EPIC-ORG", "Hub admin (admin.html + admin-hub.js)", "Guard provider-aware grupo admin.", "done"),
    ("EPIC-ORG", "Admin unidades (admin-unidades.html/js)", "CRUD unidades organizacionais.", "done"),
    ("EPIC-ORG", "Admin aprovações de conta (admin-aprovacoes)", "Workflow pending/approved/rejected.", "done"),
    ("EPIC-ORG", "Admin anúncio global tarefas (admin-anuncio)", "Mensagem broadcast por unidade.", "done"),
    ("EPIC-ORG", "admin-guard.js + org-api.js perfis/unidades", "RLS Supabase + policies SQL.", "done"),
    ("EPIC-ORG", "SQL Supabase org-tarefas, policies, backfill", "sql/supabase-*.sql suite completa.", "done"),
    ("EPIC-ORG", "SQL MySQL Locaweb schema + auth + uploads", "locaweb-mysql-schema, locaweb-auth-php.", "done"),
    # TAREFAS — entregue
    ("EPIC-TAREF", "Módulo tarefas diárias (tarefas.html + tarefas-app.js)", "Lista, toggle, notas por dia/unidade.", "done"),
    ("EPIC-TAREF", "Data-layer dual Supabase/Locaweb (locaweb-data.js)", "api/tarefas.php, api/anuncio.php.", "done"),
    ("EPIC-TAREF", "Lideranças RJ cloud (executivo-liderancas-cloud.js)", "Persistência por unidade, api/liderancas.php.", "done"),
    ("EPIC-TAREF", "WhatsApp click-to-chat (whatsapp-disparo.js)", "wa.me templates {{nome}}, conformidade manual.", "done"),
    ("EPIC-TAREF", "Página whatsapp.html disparo assistido", "Lista contatos liderancas_rj da unidade.", "done"),
    # DADOS — entregue
    ("EPIC-DADOS", "Index deputados federais — API Dados Abertos Câmara", "index.html, candidatos, filtros.", "done"),
    ("EPIC-DADOS", "Visão executiva campanhas (executivo.html)", "Chart.js, dados TSE RJ, receitas partidos.", "done"),
    ("EPIC-DADOS", "Vereadores RJ — listagem, mapa votos, zonas", "vereadores-rj*.html, JSON TSE 2024.", "done"),
    ("EPIC-DADOS", "Prefeituras RJ (prefeituras-rj.html)", "Dados nominatim + TSE prefeitos 2024.", "done"),
    ("EPIC-DADOS", "Eleição 2022 deputado federal por UF", "eleicao-2022-deputado-federal.html + data/tse-ele2022-df.", "done"),
    ("EPIC-DADOS", "Insights RJ (insights-rj.html)", "Fragments e análises territoriais.", "done"),
    ("EPIC-DADOS", "Transparência partidos e verbas (transparencia.html)", "Portal Transparência + receitas TSE.", "done"),
    ("EPIC-DADOS", "Scripts build dados TSE (npm run build:*)", "prefeitos, vereadores, DF, partidos, executivo.", "done"),
    ("EPIC-DADOS", "Proxy Portal Transparência (Worker Cloudflare)", "workers/portal-transparencia-proxy.js, wrangler.toml.", "done"),
    ("EPIC-DADOS", "Proxy escuta social (escuta-social-proxy.cjs)", "dev:escuta-proxy, data escuta-social.", "done"),
    ("EPIC-DADOS", "Páginas candidato e comparativos vereador", "candidato.html, vereador-heitor-*.html.", "done"),
    # UI — entregue
    ("EPIC-UI", "Menu responsivo site-shell-nav v11", "css/site-shell-nav.css, js/site-nav.js, ARIA.", "done"),
    ("EPIC-UI", "site-bg.js + site-interactions.js", "Efeitos visuais e micro-interações.", "done"),
    ("EPIC-UI", "Landings (landing, landing-app, landing-publico)", "Funil público e app.", "done"),
    ("EPIC-UI", "Guia de uso (guia-uso.html)", "Documentação in-app para operadores.", "done"),
    ("EPIC-UI", "Termos, privacidade, 404", "termos-uso.html, privacidade.html, 404.html.", "done"),
    ("EPIC-UI", "apply-nav-shell.mjs — aplicar menu em páginas", "Script manutenção nav em massa.", "done"),
    ("EPIC-UI", "Mídia social e Instagram (midia-social, instagram)", "Páginas campanha digital.", "done"),
    # DEPLOY — entregue
    ("EPIC-DEPLOY", "Deploy Locaweb cmbusinesstoken.com/politicapp", "docs/deploy-locaweb.md, FTP, .htaccess .mjs.", "done"),
    ("EPIC-DEPLOY", "deploy-locaweb-ftp.sh", "Upload automatizado estrutura php achatada.", "done"),
    ("EPIC-DEPLOY", "CI GitHub Actions — verificação estática", "ci.yml checa HTML, JS, SQL principais.", "done"),
    ("EPIC-DEPLOY", "Dev server local (politapp-dev-server.cjs)", "npm run dev.", "done"),
    ("EPIC-DEPLOY", "PDF apresentação comercial (generate-apresentacao-pdf.mjs)", "build:pdf-apresentacao*, Playwright/pdf-lib.", "done"),
    ("EPIC-DEPLOY", "MENU_DOCUMENTATION.md nav v11", "Breakpoints, acessibilidade, customização.", "done"),
    # TESTES — backlog QA
    ("EPIC-TEST", "[Test] Login Locaweb e-mail+senha E2E", "register.php, login.php, me.php.", "test"),
    ("EPIC-TEST", "[Test] Login cross-origin token (GitHub Pages sim)", "localStorage Bearer, _token query.", "test"),
    ("EPIC-TEST", "[Test] Fluxo aprovação conta admin", "pending → approved → acesso tarefas.", "test"),
    ("EPIC-TEST", "[Test] CRUD tarefas Locaweb API", "add/toggle/del/nota por unidade.", "test"),
    ("EPIC-TEST", "[Test] Admin unidades — permissões grupo", "Não-admin bloqueado em admin.html.", "test"),
    ("EPIC-TEST", "[Test] Upload MIME inválido rejeitado", "upload.php rejeita exe/php disfarçado.", "test"),
    ("EPIC-TEST", "[Test] Unit normalizePhoneBR WhatsApp", "DDD, DDI 55, casos edge.", "test"),
    ("EPIC-TEST", "[Test] Unit renderTemplate wa.me", "Campos {{nome}}, {{partido}}.", "test"),
    ("EPIC-TEST", "[Test] Build scripts TSE smoke", "npm run build:executivo-data sem erro.", "test"),
    ("EPIC-TEST", "[Test] Portal transparencia proxy Worker", "wrangler dev resposta CORS.", "test"),
    ("EPIC-TEST", "[Test] Menu nav v11 — acessibilidade teclado", "Focus trap, Escape, aria-current.", "test"),
    ("EPIC-TEST", "[Test] OTP rate limit 5 falhas/15min", "auth_tentativas_login bloqueio.", "test"),
    ("EPIC-TEST", "[Test] Playwright login Google mock", "Redirect login.html → index.", "test"),
    ("EPIC-TEST", "[Test] CI estende checagem páginas HTML críticas", "executivo, tarefas, transparencia.", "test"),
    # BACKLOG melhorias
    ("EPIC-AUTH", "Gateway SMS produção (Zenvia/Twilio)", "Implementar pa_send_sms() real.", "backlog"),
    ("EPIC-AUTH", "Migração completa off Supabase", "Remover fallback inerte, só Locaweb.", "backlog"),
    ("EPIC-TAREF", "WhatsApp Cloud API + templates Meta", "Disparo automatizado pós-migração.", "backlog"),
    ("EPIC-TAREF", "Notificações push tarefas pendentes", "Web Push ou e-mail digest.", "backlog"),
    ("EPIC-DADOS", "Atualização automática dados TSE (cron)", "Pipeline mensal pós-eleição.", "backlog"),
    ("EPIC-DADOS", "Mapas Leaflet interativos — todo RJ", "Camadas voto, zona, município.", "backlog"),
    ("EPIC-DADOS", "API REST documentada dados eleitorais", "OpenAPI + rate limit público.", "backlog"),
    ("EPIC-UI", "PWA — install prompt + offline shell", "service worker páginas estáticas.", "backlog"),
    ("EPIC-UI", "Tema claro/escuro toggle manual", "Além de prefers-color-scheme.", "backlog"),
    ("EPIC-ORG", "Dashboard analytics admin", "KPIs uso por unidade, logins, tarefas.", "backlog"),
    ("EPIC-ORG", "Auditoria LGPD — log consentimento", "Trilha opt-in WhatsApp e dados.", "backlog"),
    # ROADMAP Q4
    ("EPIC-ROAD", "[Q4 2026] Multi-estado além do RJ", "SP, MG datasets TSE equivalentes.", "backlog"),
    ("EPIC-ROAD", "[Q4 2026] Integração Meta Ads insights", "Campanha digital midia-social.", "backlog"),
    ("EPIC-ROAD", "Export PDF relatório campanha por unidade", "Lideranças + tarefas + métricas.", "backlog"),
    ("EPIC-ROAD", "WebSocket sync tarefas tempo real", "Colaboração multi-operador.", "backlog"),
    ("EPIC-ROAD", "Conformidade eleitoral — audit log ações", "Registro disparos e alterações.", "backlog"),
    ("EPIC-ROAD", "App mobile nativo ou Capacitor", "Tarefas e WhatsApp em campo.", "backlog"),
    ("EPIC-ROAD", "Integração CKAN/TSE API oficial", "Substituir CSV manual onde possível.", "backlog"),
    ("EPIC-DEPLOY", "Staging environment separado Locaweb", "Deploy FTP branch develop.", "backlog"),
    ("EPIC-DEPLOY", "Secrets scan pre-commit", "Evitar config.php/senhas no git.", "backlog"),
    ("EPIC-DEPLOY", "Monitor uptime cmbusinesstoken.com", "Healthcheck auth/me.php.", "backlog"),
]


def labels_for(status: str) -> list[str]:
    base = ["politapp"]
    if status == "done":
        return base + ["entregue"]
    if status == "test":
        return base + ["teste", "qa"]
    return base + ["backlog", "roadmap"]


def main():
    if not TOKEN:
        raise SystemExit("Defina JIRA_API_TOKEN.")

    safe_print(f"Projeto: {PROJECT} @ https://{SITE}")
    types = get_issue_types()
    safe_print("Tipos: " + ", ".join(sorted(types)))

    story_types = ("história", "historia", "story", "feature", "tarefa")
    epic_keys: dict[str, str] = {}

    if os.environ.get("JIRA_CREATE_EPICS") == "1":
        for ref, name, description in EPICS:
            key = create_issue(
                types,
                f"[Epic] {name}",
                description,
                ("epic",),
                ["epic", "politapp"],
            )
            epic_keys[ref] = key
            safe_print(f"Epic {ref} -> {key}")
            time.sleep(0.35)
    else:
        epic_keys = fetch_epic_keys()
        if len(epic_keys) < len(EPICS):
            safe_print(
                f"Aviso: {len(epic_keys)}/{len(EPICS)} épicos. "
                "Use JIRA_CREATE_EPICS=1 se necessário."
            )
        else:
            safe_print("Épicos: " + ", ".join(f"{k}={v}" for k, v in sorted(epic_keys.items())))

    existing = fetch_existing_summaries()
    skipped = 0
    created_done = []
    created_backlog = []
    created_test = []

    for epic_ref, summary, description, status in TASKS:
        if summary in existing:
            skipped += 1
            safe_print(f"Skip  (já existe) — {summary[:60]}")
            continue
        parent = epic_keys.get(epic_ref)
        labels = labels_for(status)
        if status == "backlog" and epic_ref == "EPIC-ROAD":
            labels.append("q4-2026")

        key = create_issue(types, summary, description, story_types, labels, parent_key=parent)
        if status == "done":
            if transition_done(key):
                created_done.append(key)
                safe_print(f"Done  {key} — {summary[:50]}")
            else:
                safe_print(f"OK    {key} — {summary[:50]} (transição Done não encontrada)")
        elif status == "test":
            created_test.append(key)
            safe_print(f"Test  {key} — {summary[:50]}")
        else:
            created_backlog.append(key)
            safe_print(f"Backlog {key} — {summary[:50]}")
        time.sleep(0.35)

    board = os.environ.get("JIRA_BOARD_ID", "")
    board_url = (
        f"https://{SITE}/jira/software/projects/{PROJECT}/boards/{board}"
        if board
        else f"https://{SITE}/jira/software/projects/{PROJECT}/boards"
    )

    safe_print("\n=== Resumo ===")
    safe_print(f"Épicos: {len(epic_keys)}")
    safe_print(f"Ignorados (duplicados): {skipped}")
    safe_print(f"Entregues (Done): {len(created_done)}")
    safe_print(f"Testes (backlog QA): {len(created_test)}")
    safe_print(f"Backlog/Roadmap: {len(created_backlog)}")
    safe_print(f"Board: {board_url}")


if __name__ == "__main__":
    main()
