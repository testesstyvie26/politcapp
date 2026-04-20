-- Politapp: dar poder de aprovação a alguém e/ou aprovar contas.
-- No site, só quem tem profiles.grupo = 'admin' pode premir "Aprovar" no painel.
-- O primeiro utilizador fica conta_status = 'aprovado' mas grupo = 'operacoes',
-- por isso é preciso promover pelo menos um admin (uma vez) com os comandos abaixo.
--
-- Execute no SQL Editor do Supabase (Database). Descomente o bloco que precisar.

-- Ver estado atual
-- SELECT p.id, p.email, p.grupo, p.conta_status FROM public.profiles p ORDER BY p.updated_at DESC;

-- A) Promover a administrador (substitua o UUID — copie de Authentication → Users)
-- UPDATE public.profiles
-- SET grupo = 'admin', updated_at = now()
-- WHERE id = 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx'::uuid;

-- B) Aprovar todos os pendentes de uma vez (opcional)
-- UPDATE public.profiles
-- SET conta_status = 'aprovado', updated_at = now()
-- WHERE conta_status = 'pendente';

-- C) Aprovar um e-mail específico
-- UPDATE public.profiles p
-- SET conta_status = 'aprovado', updated_at = now()
-- FROM auth.users u
-- WHERE u.id = p.id AND lower(u.email) = lower('email@exemplo.com');
