-- Execute uma vez em bancos criados antes do suporte a Google OAuth.
ALTER TABLE users
  MODIFY COLUMN password_hash VARCHAR(255) NULL;

ALTER TABLE users
  ADD COLUMN google_sub VARCHAR(255) NULL COMMENT 'OpenID sub do Google'
  AFTER email;

ALTER TABLE users
  ADD UNIQUE KEY uq_users_google_sub (google_sub);
