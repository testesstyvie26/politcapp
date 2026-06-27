-- ============================================================================
-- Politapp — Auth próprio (PHP) no MySQL/Locaweb
-- ----------------------------------------------------------------------------
-- Schema ENXUTO e pronto para LOGIN com 3 métodos:
--    • E-mail + senha   (password_hash / password_verify — bcrypt/argon2)
--    • Google (OAuth2)  (auth_identities: provider='google', provider_uid=sub)
--    • Telefone (OTP)   (auth_otp: código de 6 dígitos por SMS)
--
-- Substitui o clone GoTrue (locaweb-mysql-auth-schema.sql) para uso real.
-- O schema da aplicação (locaweb-mysql-schema.sql) deve referenciar
-- auth_users(id) no lugar da tabela `usuarios`. Veja o bloco "INTEGRAÇÃO" no fim.
--
-- Alvo: MySQL 8.0+ (DBaaS Locaweb).
-- ============================================================================

SET NAMES utf8mb4;
SET time_zone = '+00:00';

-- ----------------------------------------------------------------------------
-- auth_users — identidade central (a conta que faz login)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS auth_users (
  id                CHAR(36)     NOT NULL,
  email             VARCHAR(320) NULL,
  email_verificado  DATETIME     NULL,
  telefone          VARCHAR(20)  NULL,                 -- E.164, ex.: +5521998765432
  telefone_verificado DATETIME   NULL,
  senha_hash        VARCHAR(255) NULL,                 -- só para login por e-mail+senha
  nome              VARCHAR(120) NULL,
  avatar_url        VARCHAR(512) NULL,
  status            ENUM('ativo','pendente','bloqueado') NOT NULL DEFAULT 'ativo',
  ultimo_login      DATETIME     NULL,
  created_at        DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at        DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_auth_users_email (email),
  UNIQUE KEY uq_auth_users_telefone (telefone),
  -- precisa de pelo menos e-mail OU telefone para identificar a conta
  CONSTRAINT chk_auth_users_id CHECK (email IS NOT NULL OR telefone IS NOT NULL)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- auth_identities — provedores externos (Google). 1 usuário pode ter vários.
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS auth_identities (
  id            CHAR(36)     NOT NULL,
  user_id       CHAR(36)     NOT NULL,
  provider      VARCHAR(30)  NOT NULL,                 -- 'google' (futuro: 'facebook', etc.)
  provider_uid  VARCHAR(255) NOT NULL,                 -- 'sub' do Google
  email         VARCHAR(320) NULL,
  created_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_identity_provider (provider, provider_uid),
  KEY idx_identity_user (user_id),
  CONSTRAINT fk_identity_user FOREIGN KEY (user_id) REFERENCES auth_users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- auth_sessions — sessões persistentes (cookie). Guardamos só o HASH do token.
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS auth_sessions (
  id          CHAR(36)     NOT NULL,
  user_id     CHAR(36)     NOT NULL,
  token_hash  CHAR(64)     NOT NULL,                   -- sha256 do token enviado no cookie
  user_agent  VARCHAR(255) NULL,
  ip          VARCHAR(45)  NULL,
  created_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ultimo_uso  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expira_em   DATETIME     NOT NULL,
  revogado_em DATETIME     NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_session_token (token_hash),
  KEY idx_session_user (user_id),
  CONSTRAINT fk_session_user FOREIGN KEY (user_id) REFERENCES auth_users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- auth_otp — códigos OTP (login por telefone, verificação de e-mail, reset)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS auth_otp (
  id           CHAR(36)     NOT NULL,
  user_id      CHAR(36)     NULL,                      -- pode ser NULL no cadastro inicial
  destino      VARCHAR(320) NOT NULL,                  -- telefone E.164 ou e-mail
  canal        ENUM('sms','email') NOT NULL,
  finalidade   ENUM('login','verificacao','reset_senha') NOT NULL,
  codigo_hash  VARCHAR(255) NOT NULL,                  -- hash do código de 6 dígitos
  tentativas   TINYINT      NOT NULL DEFAULT 0,
  expira_em    DATETIME     NOT NULL,
  consumido_em DATETIME     NULL,
  created_at   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_otp_destino (destino, finalidade),
  KEY idx_otp_user (user_id),
  CONSTRAINT fk_otp_user FOREIGN KEY (user_id) REFERENCES auth_users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- auth_tentativas_login — anti força-bruta (rate limit / lockout)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS auth_tentativas_login (
  id            BIGINT       NOT NULL AUTO_INCREMENT,
  identificador VARCHAR(320) NOT NULL,                 -- e-mail/telefone tentado
  ip            VARCHAR(45)  NULL,
  sucesso       TINYINT(1)   NOT NULL DEFAULT 0,
  created_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_tent_identificador (identificador, created_at),
  KEY idx_tent_ip (ip, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- TRIGGERS — UUID automático no id (equivalente ao gen_random_uuid())
-- ----------------------------------------------------------------------------
DELIMITER //
CREATE TRIGGER trg_auth_users_bi      BEFORE INSERT ON auth_users
  FOR EACH ROW BEGIN IF NEW.id IS NULL OR NEW.id = '' THEN SET NEW.id = UUID(); END IF; END//
CREATE TRIGGER trg_auth_identities_bi BEFORE INSERT ON auth_identities
  FOR EACH ROW BEGIN IF NEW.id IS NULL OR NEW.id = '' THEN SET NEW.id = UUID(); END IF; END//
CREATE TRIGGER trg_auth_sessions_bi   BEFORE INSERT ON auth_sessions
  FOR EACH ROW BEGIN IF NEW.id IS NULL OR NEW.id = '' THEN SET NEW.id = UUID(); END IF; END//
CREATE TRIGGER trg_auth_otp_bi        BEFORE INSERT ON auth_otp
  FOR EACH ROW BEGIN IF NEW.id IS NULL OR NEW.id = '' THEN SET NEW.id = UUID(); END IF; END//
DELIMITER ;

-- ============================================================================
-- INTEGRAÇÃO com o schema da aplicação (locaweb-mysql-schema.sql)
-- ----------------------------------------------------------------------------
-- O `profiles` (grupo/unidade/conta_status) continua sendo o perfil de
-- aplicação, 1:1 com a conta. Aponte a FK de profiles para auth_users:
--
--   -- se você criou `usuarios` antes, remova a FK antiga e aponte para auth_users:
--   -- ALTER TABLE profiles DROP FOREIGN KEY fk_profiles_id;
--   -- ALTER TABLE profiles
--   --   ADD CONSTRAINT fk_profiles_id FOREIGN KEY (id) REFERENCES auth_users(id) ON DELETE CASCADE;
--
-- Idem para tarefas.created_by, notas_unidade_dia.updated_by,
-- anuncio_tarefas.atualizado_por, liderancas_rj.created_by → auth_users(id).
--
-- Fluxo de aprovação: ao criar a conta (qualquer método), crie também o
-- profile com conta_status='pendente'; um admin aprova depois (igual hoje).
-- ============================================================================

-- ============================================================================
-- NOTAS
-- 1) Senhas: guardamos só senha_hash (password_hash do PHP, bcrypt/argon2).
--    Contas Google ou só-telefone podem ter senha_hash NULL.
-- 2) Telefone em E.164 (+55...). A verificação é via auth_otp (SMS).
-- 3) Sessão: o cookie leva um token aleatório; no banco fica só o sha256.
--    Limpe sessões expiradas periodicamente (evento ou cron):
--      DELETE FROM auth_sessions WHERE expira_em < NOW() OR revogado_em IS NOT NULL;
-- 4) Limpeza de OTP: DELETE FROM auth_otp WHERE expira_em < NOW();
-- ============================================================================
