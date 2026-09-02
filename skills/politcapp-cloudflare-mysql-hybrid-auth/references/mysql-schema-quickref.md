# Politcapp MySQL Schema - Quick Reference

Tables created from `sql/locaweb-mysql-schema.sql`:

## usuarios
- id: CHAR(36) PK (UUID via trigger)
- email: VARCHAR(320) UNIQUE
- senha_hash: VARCHAR(255) NULL
- criado_em: TIMESTAMP DEFAULT CURRENT_TIMESTAMP

## profiles
- id: CHAR(36) PK (FK -> usuarios.id)
- grupo: ENUM('admin','gestao','operacoes') DEFAULT 'operacoes'
- unidade_id: CHAR(36) NULL (FK -> unidades.id)
- conta_status: ENUM('pendente','aprovado','rejeitado') DEFAULT 'pendente'
- email: VARCHAR(320) NULL

## triggers (auto-set DEFAULT values)
- trg_unidades_bi: SET NEW.id = UUID() IF NULL
- trg_tarefas_bi: SET NEW.id = UUID() IF NULL
- trg_liderancas_bi: SET NEW.observacoes = '' IF NULL
- trg_notas_bi: SET NEW.corpo = '' IF NULL
- trg_anuncio_bi: SET NEW.mensagem = '' IF NULL

## Compatibility
- MySQL 8.0+: full support (ENUM, CHECK, triggers)
- MySQL 5.7: ENUM/triggers work; CHECK on anuncio_tarefas ignored
- UTF8MB4 required for pt-BR accents/emojis
- No RLS in MySQL - authorization must be in backend

## Connection Test
```bash
mysql -h politicapp_bd.mysql.dbaas.com.br -u root -pa#VhV5g9PbhpaR politicapp_bd
```