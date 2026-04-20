-- Atualiza o trigger handle_new_user: novos utilizadores ficam na unidade Gestão central
-- (UUID do projeto em produção), com fallback por slug e por ordem alfabética.
-- Execute no SQL Editor após os scripts base, se já tiver a função antiga.

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid_unidade uuid;
  n_perfis int;
BEGIN
  SELECT COUNT(*) INTO n_perfis FROM public.profiles;
  SELECT COALESCE(
    (SELECT id FROM public.unidades WHERE id = '0b96b56e-076c-44a4-b83f-1f73a4a7e46a'::uuid),
    (SELECT id FROM public.unidades WHERE slug = 'gestao-central'),
    (SELECT u.id FROM public.unidades u ORDER BY u.nome ASC LIMIT 1)
  ) INTO uid_unidade;
  INSERT INTO public.profiles (id, grupo, unidade_id, conta_status, email)
  VALUES (
    NEW.id,
    'operacoes',
    uid_unidade,
    CASE WHEN n_perfis = 0 THEN 'aprovado' ELSE 'pendente' END,
    COALESCE(NEW.email, '')
  );
  RETURN NEW;
END;
$$;
