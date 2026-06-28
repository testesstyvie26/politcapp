-- ============================================================================
-- Corrige as FKs de usuário: apontar para auth_users (auth real) em vez de
-- `usuarios` (tabela placeholder do primeiro schema).
-- Rode UMA vez no banco politicapp_bd (phpMyAdmin → SQL).
-- Pré-requisito: a tabela auth_users já existe (locaweb-auth-php.sql).
-- ============================================================================

-- profiles.id  → auth_users(id)
ALTER TABLE profiles DROP FOREIGN KEY fk_profiles_id;
ALTER TABLE profiles
  ADD CONSTRAINT fk_profiles_id FOREIGN KEY (id) REFERENCES auth_users(id) ON DELETE CASCADE;

-- tarefas.created_by → auth_users(id)
ALTER TABLE tarefas DROP FOREIGN KEY fk_tarefas_created_by;
ALTER TABLE tarefas
  ADD CONSTRAINT fk_tarefas_created_by FOREIGN KEY (created_by) REFERENCES auth_users(id) ON DELETE SET NULL;

-- notas_unidade_dia.updated_by → auth_users(id)
ALTER TABLE notas_unidade_dia DROP FOREIGN KEY fk_notas_updated_by;
ALTER TABLE notas_unidade_dia
  ADD CONSTRAINT fk_notas_updated_by FOREIGN KEY (updated_by) REFERENCES auth_users(id) ON DELETE SET NULL;

-- anuncio_tarefas.atualizado_por → auth_users(id)
ALTER TABLE anuncio_tarefas DROP FOREIGN KEY fk_anuncio_por;
ALTER TABLE anuncio_tarefas
  ADD CONSTRAINT fk_anuncio_por FOREIGN KEY (atualizado_por) REFERENCES auth_users(id) ON DELETE SET NULL;

-- liderancas_rj.created_by → auth_users(id)
ALTER TABLE liderancas_rj DROP FOREIGN KEY fk_lider_created_by;
ALTER TABLE liderancas_rj
  ADD CONSTRAINT fk_lider_created_by FOREIGN KEY (created_by) REFERENCES auth_users(id) ON DELETE SET NULL;

-- (opcional) a tabela placeholder `usuarios` não é mais usada; pode remover
-- depois de confirmar que tudo funciona:
-- DROP TABLE IF EXISTS usuarios;
