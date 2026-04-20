-- Se o anúncio não aparecer em tarefas.html (erro ou linha vazia), execute no SQL Editor.
-- Garante permissões à API para o papel authenticated.

GRANT SELECT ON public.anuncio_tarefas TO authenticated;
GRANT INSERT, UPDATE ON public.anuncio_tarefas TO authenticated;
