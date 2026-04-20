-- Aprovação de contas novas (admin aprova no painel web ou via SQL).
-- Execute no SQL Editor do Supabase após supabase-org-tarefas.sql.

-- 0) E-mail no perfil (cópia de auth.users para listar pedidos sem service role)
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS email text;

UPDATE public.profiles p
SET email = u.email
FROM auth.users u
WHERE u.id = p.id AND (p.email IS NULL OR p.email = '');

-- 1) Coluna de estado (utilizadores já existentes ficam aprovados)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS conta_status text DEFAULT 'aprovado';

UPDATE public.profiles SET conta_status = 'aprovado' WHERE conta_status IS NULL;

ALTER TABLE public.profiles
  ALTER COLUMN conta_status SET NOT NULL,
  ALTER COLUMN conta_status SET DEFAULT 'pendente';

ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_conta_status_check;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_conta_status_check
  CHECK (conta_status IN ('pendente', 'aprovado', 'rejeitado'));

-- 2) Novos registos: pendente até aprovação
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
  SELECT u.id INTO uid_unidade FROM public.unidades u ORDER BY u.nome ASC LIMIT 1;
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

-- 3) RLS: só utilizadores com conta aprovada ou grupo admin
CREATE OR REPLACE FUNCTION public.current_user_can_use_app()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (
      SELECT (p.grupo = 'admin' OR p.conta_status = 'aprovado')
      FROM public.profiles p
      WHERE p.id = auth.uid()
    ),
    false
  );
$$;

DROP POLICY IF EXISTS "unidades_select_auth" ON public.unidades;
CREATE POLICY "unidades_select_auth" ON public.unidades
  FOR SELECT TO authenticated
  USING (public.current_user_can_use_app());

DROP POLICY IF EXISTS "tarefas_select" ON public.tarefas;
CREATE POLICY "tarefas_select" ON public.tarefas
  FOR SELECT TO authenticated
  USING (
    public.current_user_can_use_app()
    AND EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
      AND (p.grupo = 'admin' OR p.unidade_id = tarefas.unidade_id)
    )
  );

DROP POLICY IF EXISTS "tarefas_insert" ON public.tarefas;
CREATE POLICY "tarefas_insert" ON public.tarefas
  FOR INSERT TO authenticated
  WITH CHECK (
    public.current_user_can_use_app()
    AND EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
      AND (p.grupo = 'admin' OR p.unidade_id = tarefas.unidade_id)
    )
  );

DROP POLICY IF EXISTS "tarefas_update" ON public.tarefas;
CREATE POLICY "tarefas_update" ON public.tarefas
  FOR UPDATE TO authenticated
  USING (
    public.current_user_can_use_app()
    AND EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
      AND (p.grupo = 'admin' OR p.unidade_id = tarefas.unidade_id)
    )
  )
  WITH CHECK (
    public.current_user_can_use_app()
    AND EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
      AND (p.grupo = 'admin' OR p.unidade_id = tarefas.unidade_id)
    )
  );

DROP POLICY IF EXISTS "tarefas_delete" ON public.tarefas;
CREATE POLICY "tarefas_delete" ON public.tarefas
  FOR DELETE TO authenticated
  USING (
    public.current_user_can_use_app()
    AND EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
      AND (p.grupo = 'admin' OR p.unidade_id = tarefas.unidade_id)
    )
  );

DROP POLICY IF EXISTS "notas_select" ON public.notas_unidade_dia;
CREATE POLICY "notas_select" ON public.notas_unidade_dia
  FOR SELECT TO authenticated
  USING (
    public.current_user_can_use_app()
    AND EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
      AND (p.grupo = 'admin' OR p.unidade_id = notas_unidade_dia.unidade_id)
    )
  );

DROP POLICY IF EXISTS "notas_insert" ON public.notas_unidade_dia;
CREATE POLICY "notas_insert" ON public.notas_unidade_dia
  FOR INSERT TO authenticated
  WITH CHECK (
    public.current_user_can_use_app()
    AND EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
      AND (p.grupo = 'admin' OR p.unidade_id = notas_unidade_dia.unidade_id)
    )
  );

DROP POLICY IF EXISTS "notas_update" ON public.notas_unidade_dia;
CREATE POLICY "notas_update" ON public.notas_unidade_dia
  FOR UPDATE TO authenticated
  USING (
    public.current_user_can_use_app()
    AND EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
      AND (p.grupo = 'admin' OR p.unidade_id = notas_unidade_dia.unidade_id)
    )
  )
  WITH CHECK (
    public.current_user_can_use_app()
    AND EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
      AND (p.grupo = 'admin' OR p.unidade_id = notas_unidade_dia.unidade_id)
    )
  );

COMMENT ON COLUMN public.profiles.conta_status IS 'pendente até admin aprovar; rejeitado bloqueia o acesso ao app.';
