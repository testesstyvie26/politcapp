-- Politapp: unidades, perfis (admin / gestao / operacoes) e tarefas por unidade.
-- Execute no SQL Editor do Supabase (projeto já criado). Ordem importa.

-- Extensão para UUID (geralmente já habilitada no Supabase)
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1) Unidades
CREATE TABLE IF NOT EXISTS public.unidades (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  slug text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.unidades (nome, slug) VALUES
  ('Matriz', 'matriz'),
  ('Operações — RJ', 'operacoes-rj'),
  ('Gestão central', 'gestao-central')
ON CONFLICT (slug) DO NOTHING;

-- 2) Perfil ligado ao auth.users
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  grupo text NOT NULL DEFAULT 'operacoes'
    CHECK (grupo IN ('admin', 'gestao', 'operacoes')),
  unidade_id uuid REFERENCES public.unidades (id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_profiles_unidade ON public.profiles (unidade_id);

-- 3) Tarefas por unidade e dia (visíveis a todos da mesma unidade)
CREATE TABLE IF NOT EXISTS public.tarefas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  unidade_id uuid NOT NULL REFERENCES public.unidades (id) ON DELETE CASCADE,
  data_dia date NOT NULL,
  texto text NOT NULL,
  concluida boolean NOT NULL DEFAULT false,
  ordem int NOT NULL DEFAULT 0,
  created_by uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tarefas_unidade_dia ON public.tarefas (unidade_id, data_dia);

-- 4) Notas compartilhadas por unidade e dia
CREATE TABLE IF NOT EXISTS public.notas_unidade_dia (
  unidade_id uuid NOT NULL REFERENCES public.unidades (id) ON DELETE CASCADE,
  data_dia date NOT NULL,
  corpo text NOT NULL DEFAULT '',
  updated_by uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (unidade_id, data_dia)
);

-- 5) Novo usuário: perfil padrão (operações + primeira unidade alfabética)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid_unidade uuid;
BEGIN
  SELECT u.id INTO uid_unidade FROM public.unidades u ORDER BY u.nome ASC LIMIT 1;
  INSERT INTO public.profiles (id, grupo, unidade_id)
  VALUES (NEW.id, 'operacoes', uid_unidade);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 6) RLS
ALTER TABLE public.unidades ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tarefas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notas_unidade_dia ENABLE ROW LEVEL SECURITY;

-- Unidades: leitura para autenticados
DROP POLICY IF EXISTS "unidades_select_auth" ON public.unidades;
CREATE POLICY "unidades_select_auth" ON public.unidades
  FOR SELECT TO authenticated USING (true);

-- Perfis: próprio registro ou admin
DROP POLICY IF EXISTS "profiles_select" ON public.profiles;
CREATE POLICY "profiles_select" ON public.profiles
  FOR SELECT TO authenticated
  USING (
    id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.grupo = 'admin')
  );

DROP POLICY IF EXISTS "profiles_update_admin" ON public.profiles;
CREATE POLICY "profiles_update_admin" ON public.profiles
  FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.grupo = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.grupo = 'admin'));

-- Tarefas: mesma unidade do perfil ou admin
DROP POLICY IF EXISTS "tarefas_select" ON public.tarefas;
CREATE POLICY "tarefas_select" ON public.tarefas
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
      AND (p.grupo = 'admin' OR p.unidade_id = tarefas.unidade_id)
    )
  );

DROP POLICY IF EXISTS "tarefas_insert" ON public.tarefas;
CREATE POLICY "tarefas_insert" ON public.tarefas
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
      AND (p.grupo = 'admin' OR p.unidade_id = tarefas.unidade_id)
    )
  );

DROP POLICY IF EXISTS "tarefas_update" ON public.tarefas;
CREATE POLICY "tarefas_update" ON public.tarefas
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
      AND (p.grupo = 'admin' OR p.unidade_id = tarefas.unidade_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
      AND (p.grupo = 'admin' OR p.unidade_id = tarefas.unidade_id)
    )
  );

DROP POLICY IF EXISTS "tarefas_delete" ON public.tarefas;
CREATE POLICY "tarefas_delete" ON public.tarefas
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
      AND (p.grupo = 'admin' OR p.unidade_id = tarefas.unidade_id)
    )
  );

-- Notas por unidade/dia
DROP POLICY IF EXISTS "notas_select" ON public.notas_unidade_dia;
CREATE POLICY "notas_select" ON public.notas_unidade_dia
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
      AND (p.grupo = 'admin' OR p.unidade_id = notas_unidade_dia.unidade_id)
    )
  );

DROP POLICY IF EXISTS "notas_write" ON public.notas_unidade_dia;
DROP POLICY IF EXISTS "notas_insert" ON public.notas_unidade_dia;
DROP POLICY IF EXISTS "notas_update" ON public.notas_unidade_dia;

CREATE POLICY "notas_insert" ON public.notas_unidade_dia
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
      AND (p.grupo = 'admin' OR p.unidade_id = notas_unidade_dia.unidade_id)
    )
  );

CREATE POLICY "notas_update" ON public.notas_unidade_dia
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
      AND (p.grupo = 'admin' OR p.unidade_id = notas_unidade_dia.unidade_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
      AND (p.grupo = 'admin' OR p.unidade_id = notas_unidade_dia.unidade_id)
    )
  );

-- Promover um usuário a admin (substitua o UUID):
-- UPDATE public.profiles SET grupo = 'admin' WHERE id = 'UUID_DO_USUARIO';

-- Utilizadores criados antes deste script (sem linha em profiles):
-- INSERT INTO public.profiles (id, grupo, unidade_id)
-- SELECT u.id, 'operacoes', (SELECT id FROM public.unidades ORDER BY nome LIMIT 1)
-- FROM auth.users u
-- WHERE NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = u.id);

COMMENT ON TABLE public.unidades IS 'Unidades organizacionais; tarefas e notas são filtradas por unidade.';
COMMENT ON TABLE public.profiles IS 'grupo: admin (todas unidades), gestao e operacoes (própria unidade).';
COMMENT ON TABLE public.tarefas IS 'Checklist compartilhada por unidade e data.';
