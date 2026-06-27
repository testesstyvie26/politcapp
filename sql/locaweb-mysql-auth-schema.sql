-- ============================================================================
-- Politapp — Clone MySQL do schema de AUTENTICAÇÃO do Supabase (GoTrue)
-- ----------------------------------------------------------------------------
-- Alvo: MySQL 8.0+ (DBaaS Locaweb). Cria APENAS estrutura (sem dados).
--
-- ⚠️ LEIA ANTES DE USAR
--   Estas tabelas são INTERNAS do serviço GoTrue (Supabase Auth). Sem o GoTrue
--   rodando, elas NÃO autenticam ninguém — são só estrutura vazia. Ao migrar
--   para a Locaweb você precisará de um NOVO mecanismo de login (auth próprio
--   em PHP, Firebase, Auth0, etc.).
--
--   O que realmente importa preservar para não perder as contas:
--     • auth_users      (usuários: id, email, telefone, metadados)
--     • auth_identities (vínculo com provedores OAuth, ex.: Google)
--   As demais tabelas (sessions, refresh_tokens, mfa_*, sso_*, saml_*, oauth_*,
--   flow_state, webauthn_*, one_time_tokens) são regeneradas pelo runtime de
--   auth e normalmente NÃO precisam ser migradas.
--
-- Convenções desta tradução (MySQL não tem "schema" separado como o Postgres):
--   • schema "auth"           -> prefixo de tabela "auth_" no mesmo database
--   • uuid                    -> CHAR(36)
--   • timestamptz / timestamp -> DATETIME (guarde em UTC; ver SET time_zone)
--   • character varying (s/ tam) -> VARCHAR(255)
--   • text                    -> TEXT (ou LONGTEXT onde grande)
--   • jsonb / json            -> JSON
--   • bytea                   -> BLOB
--   • inet                    -> VARCHAR(45)  (cabe IPv6)
--   • USER-DEFINED (enums)    -> VARCHAR(50)  (valores esperados em comentário)
--   • ARRAY (text[])          -> JSON         (guardar como array JSON)
--   • bigint nextval(seq)     -> BIGINT AUTO_INCREMENT
--   • DEFAULTs por expressão (LEAST, lower(), now()+interval, regex CHECK):
--       removidos — eram calculados pelo GoTrue. Veja "NOTAS" no fim.
--
--   ↳ auth_users SUBSTITUI a tabela `usuarios` do arquivo
--     locaweb-mysql-schema.sql. Se adotar este arquivo, aponte as FKs do
--     schema público (profiles, tarefas, etc.) para auth_users(id) e descarte
--     `usuarios`, OU mantenha `usuarios` como espelho simplificado da app.
-- ============================================================================

SET NAMES utf8mb4;
SET time_zone = '+00:00';
SET FOREIGN_KEY_CHECKS = 0;

-- ----------------------------------------------------------------------------
-- auth_users  — contas (núcleo). PRESERVAR na migração.
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS auth_users (
  instance_id                CHAR(36)     NULL,
  id                         CHAR(36)     NOT NULL,
  aud                        VARCHAR(255) NULL,
  role                       VARCHAR(255) NULL,
  email                      VARCHAR(255) NULL,
  encrypted_password         VARCHAR(255) NULL,
  email_confirmed_at         DATETIME     NULL,
  invited_at                 DATETIME     NULL,
  confirmation_token         VARCHAR(255) NULL,
  confirmation_sent_at       DATETIME     NULL,
  recovery_token             VARCHAR(255) NULL,
  recovery_sent_at           DATETIME     NULL,
  email_change_token_new     VARCHAR(255) NULL,
  email_change               VARCHAR(255) NULL,
  email_change_sent_at       DATETIME     NULL,
  last_sign_in_at            DATETIME     NULL,
  raw_app_meta_data          JSON         NULL,
  raw_user_meta_data         JSON         NULL,
  is_super_admin             TINYINT(1)   NULL,
  created_at                 DATETIME     NULL,
  updated_at                 DATETIME     NULL,
  phone                      VARCHAR(32)  NULL,
  phone_confirmed_at         DATETIME     NULL,
  phone_change               VARCHAR(255) NULL DEFAULT '',
  phone_change_token         VARCHAR(255) NULL DEFAULT '',
  phone_change_sent_at       DATETIME     NULL,
  confirmed_at               DATETIME     NULL,                  -- GoTrue: LEAST(email_confirmed_at, phone_confirmed_at)
  email_change_token_current VARCHAR(255) NULL DEFAULT '',
  email_change_confirm_status TINYINT     NULL DEFAULT 0,
  banned_until               DATETIME     NULL,
  reauthentication_token     VARCHAR(255) NULL DEFAULT '',
  reauthentication_sent_at   DATETIME     NULL,
  is_sso_user                TINYINT(1)   NOT NULL DEFAULT 0,
  deleted_at                 DATETIME     NULL,
  is_anonymous               TINYINT(1)   NOT NULL DEFAULT 0,
  PRIMARY KEY (id),
  UNIQUE KEY uq_auth_users_phone (phone),
  CONSTRAINT chk_auth_users_emailchg CHECK (email_change_confirm_status >= 0 AND email_change_confirm_status <= 2)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- auth_identities  — provedores externos (ex.: Google). PRESERVAR.
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS auth_identities (
  provider_id      VARCHAR(255) NOT NULL,
  user_id          CHAR(36)     NOT NULL,
  identity_data    JSON         NOT NULL,
  provider         VARCHAR(255) NOT NULL,
  last_sign_in_at  DATETIME     NULL,
  created_at       DATETIME     NULL,
  updated_at       DATETIME     NULL,
  email            VARCHAR(255) NULL,                            -- GoTrue: lower(identity_data->>'email')
  id               CHAR(36)     NOT NULL,
  PRIMARY KEY (id),
  KEY idx_auth_identities_user (user_id),
  CONSTRAINT fk_auth_identities_user FOREIGN KEY (user_id) REFERENCES auth_users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- Infra GoTrue (geralmente NÃO precisa migrar) -------------------------------
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS auth_instances (
  id             CHAR(36) NOT NULL,
  uuid           CHAR(36) NULL,
  raw_base_config TEXT    NULL,
  created_at     DATETIME NULL,
  updated_at     DATETIME NULL,
  PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS auth_audit_log_entries (
  instance_id CHAR(36)     NULL,
  id          CHAR(36)     NOT NULL,
  payload     JSON         NULL,
  created_at  DATETIME     NULL,
  ip_address  VARCHAR(64)  NOT NULL DEFAULT '',
  PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS auth_schema_migrations (
  version VARCHAR(255) NOT NULL,
  PRIMARY KEY (version)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS auth_sso_providers (
  id          CHAR(36) NOT NULL,
  resource_id TEXT     NULL,
  created_at  DATETIME NULL,
  updated_at  DATETIME NULL,
  disabled    TINYINT(1) NULL,
  PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS auth_sso_domains (
  id              CHAR(36) NOT NULL,
  sso_provider_id CHAR(36) NOT NULL,
  domain          TEXT     NOT NULL,
  created_at      DATETIME NULL,
  updated_at      DATETIME NULL,
  PRIMARY KEY (id),
  KEY idx_sso_domains_provider (sso_provider_id),
  CONSTRAINT fk_sso_domains_provider FOREIGN KEY (sso_provider_id) REFERENCES auth_sso_providers(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS auth_saml_providers (
  id                CHAR(36) NOT NULL,
  sso_provider_id   CHAR(36) NOT NULL,
  entity_id         VARCHAR(512) NOT NULL,
  metadata_xml      LONGTEXT NOT NULL,
  metadata_url      TEXT     NULL,
  attribute_mapping JSON     NULL,
  created_at        DATETIME NULL,
  updated_at        DATETIME NULL,
  name_id_format    TEXT     NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_saml_entity (entity_id),
  KEY idx_saml_provider_sso (sso_provider_id),
  CONSTRAINT fk_saml_provider_sso FOREIGN KEY (sso_provider_id) REFERENCES auth_sso_providers(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS auth_flow_state (
  id                     CHAR(36) NOT NULL,
  user_id                CHAR(36) NULL,
  auth_code              TEXT     NULL,
  code_challenge_method  VARCHAR(50) NULL,                      -- esperado: s256 | plain
  code_challenge         TEXT     NULL,
  provider_type          TEXT     NOT NULL,
  provider_access_token  TEXT     NULL,
  provider_refresh_token TEXT     NULL,
  created_at             DATETIME NULL,
  updated_at             DATETIME NULL,
  authentication_method  TEXT     NOT NULL,
  auth_code_issued_at    DATETIME NULL,
  invite_token           TEXT     NULL,
  referrer               TEXT     NULL,
  oauth_client_state_id  CHAR(36) NULL,
  linking_target_id      CHAR(36) NULL,
  email_optional         TINYINT(1) NOT NULL DEFAULT 0,
  PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS auth_saml_relay_states (
  id              CHAR(36) NOT NULL,
  sso_provider_id CHAR(36) NOT NULL,
  request_id      TEXT     NOT NULL,
  for_email       TEXT     NULL,
  redirect_to     TEXT     NULL,
  created_at      DATETIME NULL,
  updated_at      DATETIME NULL,
  flow_state_id   CHAR(36) NULL,
  PRIMARY KEY (id),
  KEY idx_saml_relay_sso (sso_provider_id),
  CONSTRAINT fk_saml_relay_sso  FOREIGN KEY (sso_provider_id) REFERENCES auth_sso_providers(id) ON DELETE CASCADE,
  CONSTRAINT fk_saml_relay_flow FOREIGN KEY (flow_state_id)   REFERENCES auth_flow_state(id)    ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS auth_oauth_clients (
  id                          CHAR(36) NOT NULL,
  client_secret_hash          TEXT     NULL,
  registration_type           VARCHAR(50) NOT NULL,             -- esperado: dynamic | manual
  redirect_uris               TEXT     NOT NULL,
  grant_types                 TEXT     NOT NULL,
  client_name                 VARCHAR(1024) NULL,
  client_uri                  VARCHAR(2048) NULL,
  logo_uri                    VARCHAR(2048) NULL,
  created_at                  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at                  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at                  DATETIME NULL,
  client_type                 VARCHAR(50) NOT NULL DEFAULT 'confidential',  -- public | confidential
  token_endpoint_auth_method  VARCHAR(50) NOT NULL,             -- client_secret_basic | client_secret_post | none
  PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS auth_sessions (
  id                     CHAR(36) NOT NULL,
  user_id                CHAR(36) NOT NULL,
  created_at             DATETIME NULL,
  updated_at             DATETIME NULL,
  factor_id              CHAR(36) NULL,
  aal                    VARCHAR(50) NULL,                      -- aal1 | aal2 | aal3
  not_after              DATETIME NULL,
  refreshed_at           DATETIME NULL,
  user_agent             TEXT     NULL,
  ip                     VARCHAR(45) NULL,
  tag                    TEXT     NULL,
  oauth_client_id        CHAR(36) NULL,
  refresh_token_hmac_key TEXT     NULL,
  refresh_token_counter  BIGINT   NULL,
  scopes                 TEXT     NULL,
  PRIMARY KEY (id),
  KEY idx_sessions_user (user_id),
  CONSTRAINT fk_sessions_user   FOREIGN KEY (user_id)         REFERENCES auth_users(id)        ON DELETE CASCADE,
  CONSTRAINT fk_sessions_oauth  FOREIGN KEY (oauth_client_id) REFERENCES auth_oauth_clients(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS auth_refresh_tokens (
  instance_id CHAR(36)     NULL,
  id          BIGINT       NOT NULL AUTO_INCREMENT,
  token       VARCHAR(255) NULL,
  user_id     VARCHAR(255) NULL,
  revoked     TINYINT(1)   NULL,
  created_at  DATETIME     NULL,
  updated_at  DATETIME     NULL,
  parent      VARCHAR(255) NULL,
  session_id  CHAR(36)     NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_refresh_token (token),
  KEY idx_refresh_session (session_id),
  CONSTRAINT fk_refresh_session FOREIGN KEY (session_id) REFERENCES auth_sessions(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS auth_mfa_factors (
  id                          CHAR(36) NOT NULL,
  user_id                     CHAR(36) NOT NULL,
  friendly_name               TEXT     NULL,
  factor_type                 VARCHAR(50) NOT NULL,             -- totp | phone | webauthn
  status                      VARCHAR(50) NOT NULL,             -- unverified | verified
  created_at                  DATETIME NOT NULL,
  updated_at                  DATETIME NOT NULL,
  secret                      TEXT     NULL,
  phone                       VARCHAR(32) NULL,
  last_challenged_at          DATETIME NULL,
  web_authn_credential        JSON     NULL,
  web_authn_aaguid            CHAR(36) NULL,
  last_webauthn_challenge_data JSON    NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_mfa_last_challenged (last_challenged_at),
  KEY idx_mfa_user (user_id),
  CONSTRAINT fk_mfa_user FOREIGN KEY (user_id) REFERENCES auth_users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS auth_mfa_challenges (
  id                     CHAR(36) NOT NULL,
  factor_id              CHAR(36) NOT NULL,
  created_at             DATETIME NOT NULL,
  verified_at            DATETIME NULL,
  ip_address             VARCHAR(45) NOT NULL,
  otp_code               TEXT     NULL,
  web_authn_session_data JSON     NULL,
  PRIMARY KEY (id),
  KEY idx_mfa_chal_factor (factor_id),
  CONSTRAINT fk_mfa_chal_factor FOREIGN KEY (factor_id) REFERENCES auth_mfa_factors(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS auth_mfa_amr_claims (
  session_id            CHAR(36) NOT NULL,
  created_at            DATETIME NOT NULL,
  updated_at            DATETIME NOT NULL,
  authentication_method TEXT     NOT NULL,
  id                    CHAR(36) NOT NULL,
  PRIMARY KEY (id),
  KEY idx_amr_session (session_id),
  CONSTRAINT fk_amr_session FOREIGN KEY (session_id) REFERENCES auth_sessions(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS auth_one_time_tokens (
  id         CHAR(36) NOT NULL,
  user_id    CHAR(36) NOT NULL,
  token_type VARCHAR(50) NOT NULL,                              -- confirmation_token | recovery_token | ...
  token_hash TEXT     NOT NULL,
  relates_to TEXT     NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_ott_user (user_id),
  CONSTRAINT fk_ott_user FOREIGN KEY (user_id) REFERENCES auth_users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS auth_oauth_authorizations (
  id                    CHAR(36) NOT NULL,
  authorization_id      VARCHAR(255) NOT NULL,
  client_id             CHAR(36) NOT NULL,
  user_id               CHAR(36) NULL,
  redirect_uri          VARCHAR(2048) NOT NULL,
  scope                 TEXT     NOT NULL,
  state                 TEXT     NULL,
  resource              VARCHAR(2048) NULL,
  code_challenge        VARCHAR(128) NULL,
  code_challenge_method VARCHAR(50)  NULL,                      -- s256 | plain
  response_type         VARCHAR(50)  NOT NULL DEFAULT 'code',
  status                VARCHAR(50)  NOT NULL DEFAULT 'pending',
  authorization_code    VARCHAR(255) NULL,
  created_at            DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expires_at            DATETIME NOT NULL,                      -- GoTrue: now() + 3 min
  approved_at           DATETIME NULL,
  nonce                 VARCHAR(255) NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_oauth_auth_id (authorization_id),
  UNIQUE KEY uq_oauth_auth_code (authorization_code),
  KEY idx_oauth_auth_client (client_id),
  KEY idx_oauth_auth_user (user_id),
  CONSTRAINT fk_oauth_auth_client FOREIGN KEY (client_id) REFERENCES auth_oauth_clients(id) ON DELETE CASCADE,
  CONSTRAINT fk_oauth_auth_user   FOREIGN KEY (user_id)   REFERENCES auth_users(id)         ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS auth_oauth_consents (
  id         CHAR(36) NOT NULL,
  user_id    CHAR(36) NOT NULL,
  client_id  CHAR(36) NOT NULL,
  scopes     TEXT     NOT NULL,
  granted_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  revoked_at DATETIME NULL,
  PRIMARY KEY (id),
  KEY idx_oauth_consent_user (user_id),
  KEY idx_oauth_consent_client (client_id),
  CONSTRAINT fk_oauth_consent_user   FOREIGN KEY (user_id)   REFERENCES auth_users(id)         ON DELETE CASCADE,
  CONSTRAINT fk_oauth_consent_client FOREIGN KEY (client_id) REFERENCES auth_oauth_clients(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS auth_oauth_client_states (
  id            CHAR(36) NOT NULL,
  provider_type TEXT     NOT NULL,
  code_verifier TEXT     NULL,
  created_at    DATETIME NOT NULL,
  PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS auth_custom_oauth_providers (
  id                   CHAR(36) NOT NULL,
  provider_type        VARCHAR(50)  NOT NULL,                   -- oauth2 | oidc
  identifier           VARCHAR(64)  NOT NULL,
  name                 VARCHAR(100) NOT NULL,
  client_id            VARCHAR(512) NOT NULL,
  client_secret        TEXT     NOT NULL,
  acceptable_client_ids JSON    NOT NULL,                       -- era text[]
  scopes               JSON     NOT NULL,                       -- era text[]
  pkce_enabled         TINYINT(1) NOT NULL DEFAULT 1,
  attribute_mapping    JSON     NOT NULL,
  authorization_params JSON     NOT NULL,
  enabled              TINYINT(1) NOT NULL DEFAULT 1,
  email_optional       TINYINT(1) NOT NULL DEFAULT 0,
  issuer               VARCHAR(2048) NULL,
  discovery_url        VARCHAR(2048) NULL,
  skip_nonce_check     TINYINT(1) NOT NULL DEFAULT 0,
  cached_discovery     JSON     NULL,
  discovery_cached_at  DATETIME NULL,
  authorization_url    VARCHAR(2048) NULL,
  token_url            VARCHAR(2048) NULL,
  userinfo_url         VARCHAR(2048) NULL,
  jwks_uri             VARCHAR(2048) NULL,
  created_at           DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at           DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_custom_oauth_identifier (identifier)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS auth_webauthn_credentials (
  id               CHAR(36) NOT NULL,
  user_id          CHAR(36) NOT NULL,
  credential_id    BLOB     NOT NULL,
  public_key       BLOB     NOT NULL,
  attestation_type TEXT     NOT NULL,
  aaguid           CHAR(36) NULL,
  sign_count       BIGINT   NOT NULL DEFAULT 0,
  transports       JSON     NOT NULL,
  backup_eligible  TINYINT(1) NOT NULL DEFAULT 0,
  backed_up        TINYINT(1) NOT NULL DEFAULT 0,
  friendly_name    TEXT     NOT NULL,
  created_at       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  last_used_at     DATETIME NULL,
  PRIMARY KEY (id),
  KEY idx_webauthn_cred_user (user_id),
  CONSTRAINT fk_webauthn_cred_user FOREIGN KEY (user_id) REFERENCES auth_users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS auth_webauthn_challenges (
  id             CHAR(36) NOT NULL,
  user_id        CHAR(36) NULL,
  challenge_type VARCHAR(50) NOT NULL,                          -- signup | registration | authentication
  session_data   JSON     NOT NULL,
  created_at     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expires_at     DATETIME NOT NULL,
  PRIMARY KEY (id),
  KEY idx_webauthn_chal_user (user_id),
  CONSTRAINT fk_webauthn_chal_user FOREIGN KEY (user_id) REFERENCES auth_users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SET FOREIGN_KEY_CHECKS = 1;

-- ============================================================================
-- NOTAS
-- ----------------------------------------------------------------------------
-- 1) DEFAULTs/CHECKs por EXPRESSÃO foram REMOVIDOS (o GoTrue os calculava):
--      • auth_users.confirmed_at  = LEAST(email_confirmed_at, phone_confirmed_at)
--      • auth_identities.email    = lower(identity_data->>'email')
--      • auth_oauth_authorizations.expires_at = now() + 3 min
--      • CHECKs com regex Postgres (operador ~) em identifier/urls/etc.
--    Reimplemente essas regras na sua aplicação de auth, se forem necessárias.
-- 2) USER-DEFINED (enums do Postgres) viraram VARCHAR(50). Os valores esperados
--    estão em comentário ao lado. Se quiser validação no banco, troque por
--    ENUM('valor1','valor2',...) — mas confira os valores reais antes.
-- 3) ARRAY (text[]) virou JSON: guarde como array JSON, ex.: ["a","b"].
-- 4) bytea -> BLOB (credential_id, public_key). Para chaves grandes use MEDIUMBLOB.
-- 5) Migração mínima recomendada: importe só auth_users e auth_identities e
--    construa a autenticação nova em cima de auth_users(id) — as FKs do schema
--    público (locaweb-mysql-schema.sql) podem apontar para auth_users(id)
--    no lugar de `usuarios`.
-- 6) Senhas: encrypted_password do GoTrue é bcrypt. Um login próprio em PHP
--    consegue validar bcrypt com password_verify(). Logins por Google (OAuth)
--    não têm senha local — dependem do provedor e do auth_identities.
-- ============================================================================
