# Politapp ERP

Nova camada do sistema para gestão de gabinetes políticos, executada em Cloudflare Pages.

## Stack

- Build e automações: Node.js.
- Interface: HTML/CSS/JavaScript modular em `erp/`.
- Backend: Cloudflare Pages Functions em `functions/api/erp/`.
- Banco operacional: Cloudflare D1, binding `ERP_DB`.
- Identidade: autenticação Politapp existente, validada novamente no servidor.
- RBAC: `admin`, `gestao` e `operacoes`, com autorização por módulo no backend.

## Módulos

Visão geral, demandas e protocolos, cidadãos e lideranças, agenda institucional, projetos e entregas, comunicação, territórios, relatórios e administração/RBAC.

## Ativação do banco

1. Criar um banco D1 no projeto Cloudflare.
2. Vincular o banco às Pages Functions com o nome `ERP_DB`.
3. Executar a migração `sql/cloudflare-d1-erp.sql`.
4. Publicar novamente o projeto.

Sem o binding, a interface abre em modo inicial e informa indicadores zerados; operações persistentes retornam uma mensagem de configuração pendente.

## Segurança

O backend valida a sessão em cada solicitação, aplica a matriz de papéis antes de acessar dados e sempre filtra registros pelo `office_id` da unidade do usuário. Segredos e tokens não são gravados no frontend.
