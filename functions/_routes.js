// functions/_routes.js
import googleStart from './api/google-start.js';
import googleCallback from './api/google-callback.js';

// Rotas do Workers - todas as APIs começam com /api/
export default {
  '/api/google-start': googleStart,
  '/api/google-callback': googleCallback,
  // Rotas adicionais
  '/api/auth/login': googleCallback, // Usando o mesmo worker para login
};
