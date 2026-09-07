# Politapp ERP

Nova camada do sistema para gestão de gabinetes políticos, executada em Cloudflare Pages.

## Stack

- Build e automações: Node.js.
- Interface: HTML/CSS/JavaScript modular em `erp/`.
- Backend: Cloudflare Pages Functions em `functions/api/erp/`.
- Banco operacional principal: MySQL via Cloudflare Hyperdrive, binding `ERP_MYSQL`.
- Compatibilidade alternativa: Cloudflare D1, binding `ERP_DB`.
- Identidade: autenticação Politapp existente, validada novamente no servidor.
- RBAC: `admin`, `gestao` e `operacoes`, com autorização por módulo no backend.

## Módulos

Visão geral, demandas e protocolos, cidadãos e lideranças, agenda institucional, projetos e entregas, comunicação, territórios, relatórios e administração/RBAC.

## Ativação com MySQL

1. Executar `sql/mysql-erp.sql` no banco MySQL.
2. Criar uma configuração Hyperdrive apontando para o MySQL.
3. Vincular o Hyperdrive às Pages Functions com o nome `ERP_MYSQL`.
4. Publicar novamente o projeto.

O arquivo `sql/cloudflare-d1-erp.sql` permanece disponível somente para instalações que escolherem D1/SQLite. Não o execute no MySQL.

Sem um dos bindings, a interface abre em modo inicial e informa indicadores zerados; operações persistentes retornam uma mensagem de configuração pendente.

## Segurança

O backend valida a sessão em cada solicitação, aplica a matriz de papéis antes de acessar dados e sempre filtra registros pelo `office_id` da unidade do usuário. Segredos e tokens não são gravados no frontend.
