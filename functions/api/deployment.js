export async function onRequestGet({ env, request }) {
  const url = new URL(request.url);
  const response = {
    ok: true,
    project: env.CF_PAGES_PROJECT_NAME || 'politcapp',
    branch: env.CF_PAGES_BRANCH || null,
    commit: env.CF_PAGES_COMMIT_SHA || null,
    deployment: env.CF_PAGES_URL || url.origin,
    checkedAt: new Date().toISOString()
  };

  return Response.json(response, {
    headers: {
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff'
    }
  });
}
