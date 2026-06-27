-- ============================================================================
-- Politapp — Upload de arquivos (Locaweb/MySQL)
-- ----------------------------------------------------------------------------
-- Substituto enxuto do storage do Supabase: guarda METADADOS no banco e o
-- arquivo físico no disco da Locaweb (pasta protegida). Pensado para fotos de
-- perfil de lideranças, anexos de tarefas, documentos, etc.
--
-- Depende de auth_users (locaweb-auth-php.sql) e unidades (locaweb-mysql-schema.sql).
-- Alvo: MySQL 8.0+.
-- ============================================================================

SET NAMES utf8mb4;
SET time_zone = '+00:00';

CREATE TABLE IF NOT EXISTS arquivos (
  id            CHAR(36)     NOT NULL,
  user_id       CHAR(36)     NULL,                  -- quem enviou (auth_users.id)
  unidade_id    CHAR(36)     NULL,                  -- escopo da unidade (unidades.id)
  entidade      VARCHAR(40)  NULL,                  -- ex.: 'lideranca','tarefa','perfil'
  entidade_id   CHAR(36)     NULL,                  -- id do registro a que se anexa
  nome_original VARCHAR(255) NOT NULL,              -- nome enviado pelo usuário (exibição)
  caminho       VARCHAR(512) NOT NULL,              -- caminho relativo no disco (gerado)
  mime          VARCHAR(127) NOT NULL,
  tamanho       BIGINT       NOT NULL DEFAULT 0,    -- bytes
  created_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_arquivos_user (user_id),
  KEY idx_arquivos_unidade (unidade_id),
  KEY idx_arquivos_entidade (entidade, entidade_id),
  CONSTRAINT fk_arquivos_user    FOREIGN KEY (user_id)    REFERENCES auth_users(id) ON DELETE SET NULL,
  CONSTRAINT fk_arquivos_unidade FOREIGN KEY (unidade_id) REFERENCES unidades(id)   ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

DELIMITER //
DROP TRIGGER IF EXISTS trg_arquivos_bi//
CREATE TRIGGER trg_arquivos_bi BEFORE INSERT ON arquivos FOR EACH ROW
BEGIN
  IF NEW.id IS NULL OR NEW.id = '' THEN SET NEW.id = UUID(); END IF;
END//
DELIMITER ;

-- ============================================================================
-- NOTAS
-- 1) O arquivo físico NÃO fica no banco — só os metadados. O binário vai para
--    a pasta protegida php/storage/uploads/ (ver php/files/upload.php).
-- 2) Para anexar a um registro, grave entidade+entidade_id (ex.:
--    entidade='lideranca', entidade_id = liderancas_rj.id).
-- 3) Ao excluir um arquivo, remova a linha E o arquivo físico (ver serve/delete).
-- ============================================================================
