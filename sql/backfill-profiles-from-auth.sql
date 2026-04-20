-- Criar linhas em public.profiles para cada utilizador em auth.users que ainda não tem perfil.
-- Isto corrige o caso: "utilizador existe em auth mas não aparece para aprovação no painel".
--
-- Causas comuns: trigger on_auth_user_created não estava instalado; erro na primeira tentativa;
-- utilizadores importados ou criados antes do script base.
--
-- Execute no SQL Editor do Supabase (Database), com permissões sobre auth e public.

-- 1) (Opcional) Recriar o trigger — só se a função handle_new_user já existir no projeto.
--    Se ainda não aplicou sql/supabase-org-tarefas.sql, faça isso primeiro.
-- DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
-- CREATE TRIGGER on_auth_user_created
--   AFTER INSERT ON auth.users
--   FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 2) Inserir perfis em falta (mesma lógica de unidade que handle_new_user)
INSERT INTO public.profiles (id, grupo, unidade_id, conta_status, email, updated_at)
SELECT
  u.id,
  'operacoes',
  (
    SELECT COALESCE(
      (SELECT id FROM public.unidades WHERE id = '0b96b56e-076c-44a4-b83f-1f73a4a7e46a'::uuid),
      (SELECT id FROM public.unidades WHERE slug = 'gestao-central'),
      (SELECT u2.id FROM public.unidades u2 ORDER BY u2.nome ASC LIMIT 1)
    )
  ),
  CASE
    WHEN NOT EXISTS (SELECT 1 FROM public.profiles LIMIT 1)
      AND ROW_NUMBER() OVER (ORDER BY u.created_at ASC NULLS LAST, u.id) = 1
    THEN 'aprovado'
    ELSE 'pendente'
  END,
  COALESCE(u.email, ''),
  now()
FROM auth.users u
WHERE NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = u.id);

-- 3) Verificar: todos os auth.users devem ter profiles
-- SELECT u.id, u.email, p.conta_status
-- FROM auth.users u
-- LEFT JOIN public.profiles p ON p.id = u.id
-- WHERE p.id IS NULL;
