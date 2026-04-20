CREATE DATABASE IF NOT EXISTS politapp_auth
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE politapp_auth;

CREATE TABLE IF NOT EXISTS users (
  id            BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  email         VARCHAR(255) NOT NULL,
  google_sub    VARCHAR(255) NULL COMMENT 'OpenID sub (login com Google)',
  password_hash VARCHAR(255) NULL,
  name          VARCHAR(120) NULL,
  created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_users_email (email),
  UNIQUE KEY uq_users_google_sub (google_sub)
) ENGINE=InnoDB;
