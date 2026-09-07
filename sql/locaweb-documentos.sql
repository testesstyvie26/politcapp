-- Politicapp ERP — documentos compartilhados e controle de versões (MySQL 8+)
-- O conteúdo binário de cada versão é mantido no próprio MySQL, como solicitado.

SET NAMES utf8mb4;
SET time_zone = '+00:00';

CREATE TABLE IF NOT EXISTS erp_documents (
  id              CHAR(36)      NOT NULL,
  unidade_id      CHAR(36)      NOT NULL,
  titulo          VARCHAR(200)  NOT NULL,
  descricao       TEXT          NULL,
  categoria       VARCHAR(80)   NULL,
  status          VARCHAR(24)   NOT NULL DEFAULT 'rascunho',
  visibilidade    VARCHAR(24)   NOT NULL DEFAULT 'gabinete',
  versao_atual    INT UNSIGNED  NOT NULL DEFAULT 0,
  created_by      CHAR(36)      NOT NULL,
  created_at      DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_erp_documents_unidade_status (unidade_id, status),
  KEY idx_erp_documents_criador (created_by),
  CONSTRAINT chk_erp_documents_status CHECK (status IN ('rascunho','revisando','aprovado','arquivado')),
  CONSTRAINT chk_erp_documents_visibilidade CHECK (visibilidade IN ('gabinete','restrito'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS erp_document_versions (
  id              CHAR(36)      NOT NULL,
  document_id     CHAR(36)      NOT NULL,
  numero          INT UNSIGNED  NOT NULL,
  nome_arquivo    VARCHAR(255)  NOT NULL,
  mime            VARCHAR(127)  NOT NULL,
  tamanho         BIGINT UNSIGNED NOT NULL,
  checksum_sha256 CHAR(64)      NOT NULL,
  observacao      VARCHAR(500)  NULL,
  conteudo        LONGBLOB      NOT NULL,
  uploaded_by     CHAR(36)      NOT NULL,
  created_at      DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_erp_document_version (document_id, numero),
  KEY idx_erp_document_versions_documento (document_id, created_at),
  CONSTRAINT fk_erp_document_versions_documento
    FOREIGN KEY (document_id) REFERENCES erp_documents(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS erp_document_events (
  id              CHAR(36)      NOT NULL,
  document_id     CHAR(36)      NOT NULL,
  user_id         CHAR(36)      NOT NULL,
  evento          VARCHAR(40)   NOT NULL,
  detalhes        VARCHAR(500)  NULL,
  created_at      DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_erp_document_events_documento (document_id, created_at),
  CONSTRAINT fk_erp_document_events_documento
    FOREIGN KEY (document_id) REFERENCES erp_documents(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

