-- Tabela de anúncio exibido em tarefas.html (admin publica no painel).
-- Execute no SQL Editor se o projeto já existia sem esta tabela.

CREATE TABLE IF NOT EXISTS public.anuncio_tarefas (
  id smallint PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  mensagem text NOT NULL DEFAULT '',
  atualizado_em timestamptz NOT NULL DEFAULT now(),
  atualizado_por uuid REFERENCES auth.users (id) ON DELETE SET NULL
);

INSERT INTO public.anuncio_tarefas (id, mensagem) VALUES (1, '')
  ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.anuncio_tarefas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anuncio_tarefas_select" ON public.anuncio_tarefas;
CREATE POLICY "anuncio_tarefas_select" ON public.anuncio_tarefas
  FOR SELECT TO authenticated
  USING (public.current_user_can_use_app());

DROP POLICY IF EXISTS "anuncio_tarefas_insert" ON public.anuncio_tarefas;
CREATE POLICY "anuncio_tarefas_insert" ON public.anuncio_tarefas
  FOR INSERT TO authenticated
  WITH CHECK (public.current_user_is_admin());

DROP POLICY IF EXISTS "anuncio_tarefas_update" ON public.anuncio_tarefas;
CREATE POLICY "anuncio_tarefas_update" ON public.anuncio_tarefas
  FOR UPDATE TO authenticated
  USING (public.current_user_is_admin())
  WITH CHECK (public.current_user_is_admin());
