-- Corrige: "infinite recursion detected in policy for relation profiles"
-- Causa: políticas com subconsulta a public.profiles reentram no RLS de profiles.
-- Solução: funções STABLE SECURITY DEFINER (lêem profiles sem política recursiva).
-- Execute no SQL Editor do Supabase (Database).

CREATE OR REPLACE FUNCTION public.current_user_is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT p.grupo = 'admin' FROM public.profiles p WHERE p.id = auth.uid()),
    false
  );
$$;

CREATE OR REPLACE FUNCTION public.current_user_unidade_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.unidade_id FROM public.profiles p WHERE p.id = auth.uid() LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.current_user_can_access_unidade(target uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    public.current_user_is_admin()
    OR public.current_user_unidade_id() IS NOT DISTINCT FROM target;
$$;

DROP POLICY IF EXISTS "unidades_insert_admin" ON public.unidades;
CREATE POLICY "unidades_insert_admin" ON public.unidades
  FOR INSERT TO authenticated
  WITH CHECK (
    public.current_user_can_use_app()
    AND public.current_user_is_admin()
  );

DROP POLICY IF EXISTS "unidades_update_admin" ON public.unidades;
CREATE POLICY "unidades_update_admin" ON public.unidades
  FOR UPDATE TO authenticated
  USING (
    public.current_user_can_use_app()
    AND public.current_user_is_admin()
  )
  WITH CHECK (
    public.current_user_can_use_app()
    AND public.current_user_is_admin()
  );

DROP POLICY IF EXISTS "profiles_select" ON public.profiles;
CREATE POLICY "profiles_select" ON public.profiles
  FOR SELECT TO authenticated
  USING (
    id = auth.uid()
    OR public.current_user_is_admin()
  );

DROP POLICY IF EXISTS "profiles_update_admin" ON public.profiles;
CREATE POLICY "profiles_update_admin" ON public.profiles
  FOR UPDATE TO authenticated
  USING (public.current_user_is_admin())
  WITH CHECK (public.current_user_is_admin());

DROP POLICY IF EXISTS "tarefas_select" ON public.tarefas;
CREATE POLICY "tarefas_select" ON public.tarefas
  FOR SELECT TO authenticated
  USING (
    public.current_user_can_use_app()
    AND public.current_user_can_access_unidade(tarefas.unidade_id)
  );

DROP POLICY IF EXISTS "tarefas_insert" ON public.tarefas;
CREATE POLICY "tarefas_insert" ON public.tarefas
  FOR INSERT TO authenticated
  WITH CHECK (
    public.current_user_can_use_app()
    AND public.current_user_can_access_unidade(tarefas.unidade_id)
  );

DROP POLICY IF EXISTS "tarefas_update" ON public.tarefas;
CREATE POLICY "tarefas_update" ON public.tarefas
  FOR UPDATE TO authenticated
  USING (
    public.current_user_can_use_app()
    AND public.current_user_can_access_unidade(tarefas.unidade_id)
  )
  WITH CHECK (
    public.current_user_can_use_app()
    AND public.current_user_can_access_unidade(tarefas.unidade_id)
  );

DROP POLICY IF EXISTS "tarefas_delete" ON public.tarefas;
CREATE POLICY "tarefas_delete" ON public.tarefas
  FOR DELETE TO authenticated
  USING (
    public.current_user_can_use_app()
    AND public.current_user_can_access_unidade(tarefas.unidade_id)
  );

DROP POLICY IF EXISTS "notas_select" ON public.notas_unidade_dia;
CREATE POLICY "notas_select" ON public.notas_unidade_dia
  FOR SELECT TO authenticated
  USING (
    public.current_user_can_use_app()
    AND public.current_user_can_access_unidade(notas_unidade_dia.unidade_id)
  );

DROP POLICY IF EXISTS "notas_insert" ON public.notas_unidade_dia;
CREATE POLICY "notas_insert" ON public.notas_unidade_dia
  FOR INSERT TO authenticated
  WITH CHECK (
    public.current_user_can_use_app()
    AND public.current_user_can_access_unidade(notas_unidade_dia.unidade_id)
  );

DROP POLICY IF EXISTS "notas_update" ON public.notas_unidade_dia;
CREATE POLICY "notas_update" ON public.notas_unidade_dia
  FOR UPDATE TO authenticated
  USING (
    public.current_user_can_use_app()
    AND public.current_user_can_access_unidade(notas_unidade_dia.unidade_id)
  )
  WITH CHECK (
    public.current_user_can_use_app()
    AND public.current_user_can_access_unidade(notas_unidade_dia.unidade_id)
  );
