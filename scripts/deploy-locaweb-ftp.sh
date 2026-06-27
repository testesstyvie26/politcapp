#!/usr/bin/env bash
# ============================================================================
# Deploy do Politapp para a Locaweb por FTP (lftp mirror).
# Sobe o FRONT (html, css, js, data, favicon) + o backend PHP "achatado"
# para /public_html/politicapp.
#
# Uso:
#   FTP_PASS='suaSenha' bash scripts/deploy-locaweb-ftp.sh
#
# A senha NUNCA fica no arquivo — vem da variável de ambiente FTP_PASS.
# Requer o lftp instalado (sudo apt install lftp  /  brew install lftp).
# ============================================================================
set -euo pipefail

FTP_HOST="${FTP_HOST:-ftp.cmbusinesstoken1.hospedagemdesites.ws}"
FTP_USER="${FTP_USER:-}"          # informe seu usuário FTP
REMOTE_DIR="${REMOTE_DIR:-/public_html/politicapp}"

if [ -z "${FTP_PASS:-}" ]; then echo "Defina FTP_PASS (variável de ambiente)."; exit 1; fi
if [ -z "$FTP_USER" ]; then echo "Defina FTP_USER (variável de ambiente)."; exit 1; fi

cd "$(dirname "$0")/.."

echo "==> Enviando FRONT (html/css/js/data) para $REMOTE_DIR ..."
# Atenção: SEM --delete na raiz (preservar config.php e subpastas do servidor).
# --delete só em css/ e js/ (contêm apenas nossos arquivos → remove .mjs órfãos).
lftp -u "$FTP_USER","$FTP_PASS" "$FTP_HOST" <<EOF
set ssl:verify-certificate no
mirror -R --verbose --include-glob '*.html' \
  --exclude-glob 'node_modules/*' --exclude-glob '.git/*' \
  ./ "$REMOTE_DIR"
mirror -R --verbose --delete ./css "$REMOTE_DIR/css"
mirror -R --verbose --delete ./js  "$REMOTE_DIR/js"
mirror -R --verbose          ./data "$REMOTE_DIR/data"
put -O "$REMOTE_DIR" favicon.svg
# Backend PHP "achatado" na raiz de /politicapp (auth/, lib/, files/, storage/)
mirror -R --verbose --delete ./php/auth    "$REMOTE_DIR/auth"
mirror -R --verbose --delete ./php/lib     "$REMOTE_DIR/lib"
mirror -R --verbose --delete ./php/files   "$REMOTE_DIR/files"
mirror -R --verbose          ./php/storage "$REMOTE_DIR/storage"
put -O "$REMOTE_DIR" php/.htaccess
bye
EOF

echo "==> Concluído."
echo "Lembretes:"
echo "  1) Crie/edite $REMOTE_DIR/config.php (a partir de php/config.example.php)."
echo "  2) Purgue o cache do Cloudflare."
echo "  3) --delete nos js/ remove os .mjs antigos automaticamente."
