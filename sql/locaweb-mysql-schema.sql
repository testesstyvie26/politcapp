-- ============================================================================
-- Politapp — Clone do schema Supabase (PostgreSQL) para MySQL (Locaweb)
-- ----------------------------------------------------------------------------
-- Alvo: MySQL 8.0+ (DBaaS Locaweb). Veja "NOTAS DE COMPATIBILIDADE" no fim.
-- Este arquivo cria APENAS a estrutura (sem dados).
--
-- Diferenças principais vs. Supabase/Postgres:
--   * uuid                -> CHAR(36) (UUID textual). Geração automática via TRIGGER.
--   * gen_random_uuid()   -> UUID() (preenchido por trigger BEFORE INSERT).
--   * timestamptz         -> TIMESTAMP (armazenado em UTC; ver SET time_zone).
--   * text + CHECK IN(...) -> ENUM(...) (valida e é mais eficiente no MySQL).
--   * auth.users          -> tabela `usuarios` (o Supabase Auth NÃO migra junto;
--                            você precisa de um mecanismo de auth na nova stack).
--   * RLS (Row Level Security) NÃO existe no MySQL: a autorização por grupo/
--     unidade passa a ser responsabilidade da APLICAÇÃO (backend). Veja nota 5.
-- ============================================================================

SET NAMES utf8mb4;
SET time_zone = '+00:00';            -- guarde tudo em UTC, como o timestamptz fazia
SET FOREIGN_KEY_CHECKS = 0;          -- permite criar na ordem que for

-- ----------------------------------------------------------------------------
-- 0) usuarios  — substitui o auth.users do Supabase
--    Migre os ids (uuid) dos usuários do Supabase para cá para preservar as FKs.
--    O hash de senha / provedor de login depende da auth que você adotar.
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS usuarios (
  id          CHAR(36)     NOT NULL,
  email       VARCHAR(320) NULL,
  senha_hash  VARCHAR(255) NULL,        -- defina conforme o novo mecanismo de auth
  criado_em   TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_usuarios_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- 1) unidades
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS unidades (
  id          CHAR(36)     NOT NULL,
  nome        VARCHAR(255) NOT NULL,
  slug        VARCHAR(255) NOT NULL,
  created_at  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_unidades_slug (slug)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- 2) profiles  (1:1 com usuarios)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS profiles (
  id            CHAR(36) NOT NULL,
  grupo         ENUM('admin','gestao','operacoes') NOT NULL DEFAULT 'operacoes',
  unidade_id    CHAR(36) NULL,
  updated_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  conta_status  ENUM('pendente','aprovado','rejeitado') NOT NULL DEFAULT 'pendente',
  email         VARCHAR(320) NULL,
  PRIMARY KEY (id),
  KEY idx_profiles_unidade (unidade_id),
  CONSTRAINT fk_profiles_id       FOREIGN KEY (id)         REFERENCES usuarios(id) ON DELETE CASCADE,
  CONSTRAINT fk_profiles_unidade  FOREIGN KEY (unidade_id) REFERENCES unidades(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- 3) tarefas
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS tarefas (
  id          CHAR(36)   NOT NULL,
  unidade_id  CHAR(36)   NOT NULL,
  data_dia    DATE       NOT NULL,
  texto       TEXT       NOT NULL,
  concluida   TINYINT(1) NOT NULL DEFAULT 0,
  ordem       INT        NOT NULL DEFAULT 0,
  created_by  CHAR(36)   NULL,
  created_at  TIMESTAMP  NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  TIMESTAMP  NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_tarefas_unidade_dia (unidade_id, data_dia),
  CONSTRAINT fk_tarefas_unidade    FOREIGN KEY (unidade_id) REFERENCES unidades(id) ON DELETE CASCADE,
  CONSTRAINT fk_tarefas_created_by FOREIGN KEY (created_by) REFERENCES usuarios(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- 4) notas_unidade_dia  (PK composta unidade_id + data_dia)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS notas_unidade_dia (
  unidade_id  CHAR(36)  NOT NULL,
  data_dia    DATE      NOT NULL,
  corpo       TEXT      NOT NULL,        -- Supabase tinha DEFAULT ''; ver trigger abaixo
  updated_by  CHAR(36)  NULL,
  updated_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (unidade_id, data_dia),
  CONSTRAINT fk_notas_unidade    FOREIGN KEY (unidade_id) REFERENCES unidades(id) ON DELETE CASCADE,
  CONSTRAINT fk_notas_updated_by FOREIGN KEY (updated_by) REFERENCES usuarios(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- 5) anuncio_tarefas  (linha única: id sempre = 1)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS anuncio_tarefas (
  id             TINYINT   NOT NULL DEFAULT 1,
  mensagem       TEXT      NOT NULL,     -- Supabase tinha DEFAULT ''; ver trigger abaixo
  atualizado_em  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  atualizado_por CHAR(36)  NULL,
  PRIMARY KEY (id),
  CONSTRAINT chk_anuncio_singleton CHECK (id = 1),
  CONSTRAINT fk_anuncio_por FOREIGN KEY (atualizado_por) REFERENCES usuarios(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- 6) liderancas_rj  (contatos / lideranças — fonte dos telefones p/ WhatsApp)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS liderancas_rj (
  id             CHAR(36)     NOT NULL,
  unidade_id     CHAR(36)     NOT NULL,
  municipio_ibge VARCHAR(20)  NOT NULL,
  nome           VARCHAR(255) NOT NULL,
  telefone       VARCHAR(32)  NOT NULL DEFAULT '',
  partido        VARCHAR(60)  NOT NULL DEFAULT '',
  observacoes    TEXT         NOT NULL,        -- Supabase tinha DEFAULT ''; ver trigger
  created_by     CHAR(36)     NULL,
  created_at     TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at     TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_lider_unidade   (unidade_id),
  KEY idx_lider_municipio (municipio_ibge),
  CONSTRAINT fk_lider_unidade    FOREIGN KEY (unidade_id) REFERENCES unidades(id) ON DELETE CASCADE,
  CONSTRAINT fk_lider_created_by FOREIGN KEY (created_by) REFERENCES usuarios(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SET FOREIGN_KEY_CHECKS = 1;

-- ============================================================================
-- TRIGGERS — reproduzem os DEFAULTs do Postgres que o MySQL não faz inline:
--   (a) gen_random_uuid()  -> preenche o id com UUID() quando vier NULL/''
--   (b) DEFAULT ''::text em colunas TEXT  -> preenche '' quando vier NULL
-- ============================================================================
DELIMITER //

DROP TRIGGER IF EXISTS trg_unidades_bi//
CREATE TRIGGER trg_unidades_bi BEFORE INSERT ON unidades FOR EACH ROW
BEGIN
  IF NEW.id IS NULL OR NEW.id = '' THEN SET NEW.id = UUID(); END IF;
END//

DROP TRIGGER IF EXISTS trg_tarefas_bi//
CREATE TRIGGER trg_tarefas_bi BEFORE INSERT ON tarefas FOR EACH ROW
BEGIN
  IF NEW.id IS NULL OR NEW.id = '' THEN SET NEW.id = UUID(); END IF;
END//

DROP TRIGGER IF EXISTS trg_liderancas_bi//
CREATE TRIGGER trg_liderancas_bi BEFORE INSERT ON liderancas_rj FOR EACH ROW
BEGIN
  IF NEW.id IS NULL OR NEW.id = '' THEN SET NEW.id = UUID(); END IF;
  IF NEW.observacoes IS NULL THEN SET NEW.observacoes = ''; END IF;
END//

DROP TRIGGER IF EXISTS trg_notas_bi//
CREATE TRIGGER trg_notas_bi BEFORE INSERT ON notas_unidade_dia FOR EACH ROW
BEGIN
  IF NEW.corpo IS NULL THEN SET NEW.corpo = ''; END IF;
END//

DROP TRIGGER IF EXISTS trg_anuncio_bi//
CREATE TRIGGER trg_anuncio_bi BEFORE INSERT ON anuncio_tarefas FOR EACH ROW
BEGIN
  IF NEW.mensagem IS NULL THEN SET NEW.mensagem = ''; END IF;
END//

DELIMITER ;

-- ============================================================================
-- NOTAS DE COMPATIBILIDADE
-- ----------------------------------------------------------------------------
-- 1) Versão do MySQL: confirme com  SELECT VERSION();
--    - MySQL 8.0+  : tudo acima funciona (ENUM, CHECK, triggers).
--    - MySQL 5.7   : ENUM e triggers funcionam; a CHECK de anuncio_tarefas é
--                    ACEITA mas IGNORADA (não valida). Os DEFAULT CURRENT_TIMESTAMP
--                    em mais de uma coluna TIMESTAMP exigem 5.7 (ok) — se der erro
--                    "Invalid default value", troque a 2ª coluna por
--                    DATETIME DEFAULT CURRENT_TIMESTAMP.
-- 2) Fuso horário: o timestamptz do Postgres guardava UTC. Aqui usamos
--    SET time_zone='+00:00' e TIMESTAMP (que normaliza p/ UTC). Converta na app.
-- 3) UUID: o MySQL UUID() gera v1 (baseado em tempo+MAC). Funciona como PK, mas
--    se preferir UUID v4 aleatório, gere na aplicação e passe no INSERT.
-- 4) Charset utf8mb4: preserva acentos pt-BR e emojis. Garanta a conexão também
--    em utf8mb4 (ex.: PDO charset=utf8mb4).
-- 5) SEGURANÇA (importante): o Supabase aplicava Row Level Security por grupo/
--    unidade. O MySQL NÃO tem RLS — toda a autorização (quem vê/edita o quê)
--    deve ser implementada no BACKEND (ex.: PHP na Locaweb) checando
--    profiles.grupo e profiles.unidade_id em cada query. Não exponha o banco
--    diretamente ao cliente.
-- ============================================================================
