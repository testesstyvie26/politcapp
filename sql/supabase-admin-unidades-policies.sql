-- Políticas RLS: admins podem INSERT/UPDATE em public.unidades.
-- Requer função public.current_user_is_admin() (ver sql/supabase-org-tarefas.sql ou supabase-fix-profiles-rls-recursion.sql).
-- Execute no SQL Editor se o projeto já tinha o schema antigo (só SELECT em unidades).

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
