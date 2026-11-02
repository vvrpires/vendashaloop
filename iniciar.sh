#!/bin/bash
# Sobe o Haloop Vendas (usado pelo serviço systemd haloop-vendas)
set -a
. /opt/haloop-vendas/.env
set +a
# Senha do certificado: vale a do .env (gravada pela tela Minha empresa).
# O arquivo certificado.senha só é usado se o .env não tiver a senha.
if [ -z "${NFE_CERT_PASSWORD:-}" ] && [ -f /opt/haloop-vendas/certificado.senha ]; then
  export NFE_CERT_PASSWORD="$(cat /opt/haloop-vendas/certificado.senha)"
fi
cd /opt/haloop-vendas
if [ -f pronto/server/index.mjs ]; then
  exec /usr/bin/node pronto/server/index.mjs
fi
exec /usr/bin/node .output/server/index.mjs
