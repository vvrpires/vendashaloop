#!/bin/bash
# Sobe o Haloop Vendas (usado pelo serviço systemd haloop-vendas)
set -a
. /opt/haloop-vendas/.env
set +a
# A senha do certificado pode ficar no arquivo certificado.senha (opcional)
if [ -f /opt/haloop-vendas/certificado.senha ]; then
  export NFE_CERT_PASSWORD="$(cat /opt/haloop-vendas/certificado.senha)"
fi
cd /opt/haloop-vendas
if [ -f pronto/server/index.mjs ]; then
  exec /usr/bin/node pronto/server/index.mjs
fi
exec /usr/bin/node .output/server/index.mjs
