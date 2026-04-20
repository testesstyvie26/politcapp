-- Políticas RLS: admins podem INSERT/UPDATE em public.unidades.
-- Execute no SQL Editor se o projeto já tinha o schema antigo (só SELECT em unidades).

DROP POLICY IF EXISTS "unidades_insert_admin" ON public.unidades;
CREATE POLICY "unidades_insert_admin" ON public.unidades
  FOR INSERT TO authenticated
  WITH CHECK (
    public.current_user_can_use_app()
    AND EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.grupo = 'admin')
  );

DROP POLICY IF EXISTS "unidades_update_admin" ON public.unidades;
CREATE POLICY "unidades_update_admin" ON public.unidades
  FOR UPDATE TO authenticated
  USING (
    public.current_user_can_use_app()
    AND EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.grupo = 'admin')
  )
  WITH CHECK (
    public.current_user_can_use_app()
    AND EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.grupo = 'admin')
  );
