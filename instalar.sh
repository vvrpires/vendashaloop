#!/usr/bin/env bash
# =====================================================================
#  Haloop Vendas - instalação automática do zero (rev.38)
#
#  Uso (no servidor novo, como usuário normal, ex.: ubuntu):
#     cd ~/haloop-vendas
#     bash instalar.sh
#
#  Pergunta só duas coisas: o endereço do banco (Supabase) e o domínio.
#  Também aceita sem perguntas:
#     DATABASE_URL='postgresql://...' DOMINIO='vendas.cliente.com.br' bash instalar.sh
#
#  O que ele faz: memória swap, firewall (iptables 80/443), Node.js 22,
#  copia o sistema para /opt/haloop-vendas, cria o .env, instala as
#  dependências, cria as tabelas, cria o serviço e configura o HTTPS (Caddy).
#
#  O que NÃO dá para fazer daqui (faça antes, pelo navegador):
#   - criar o projeto no Supabase;
#   - apontar o domínio (registro A) para o IP do servidor;
#   - Oracle Cloud: liberar TCP 80 e 443 na Security List da VCN.
# =====================================================================
set -euo pipefail

ORIGEM="$(cd "$(dirname "$0")" && pwd)"
APP=/opt/haloop-vendas
SERVICO=haloop-vendas
EU="$(id -un)"
export DEBIAN_FRONTEND=noninteractive

passo() { printf '\n\033[1;36m== %s\033[0m\n' "$1"; }
ok()    { printf '\033[1;32m   ok:\033[0m %s\n' "$1"; }
aviso() { printf '\033[1;33m   atenção:\033[0m %s\n' "$1"; }
erro()  { printf '\n\033[1;31mERRO:\033[0m %s\n' "$1"; exit 1; }

[ "$EU" = "root" ] && erro "Rode como usuário normal (ex.: ubuntu), não como root. O script pede o sudo quando precisa."
[ -f "$ORIGEM/pronto/server/index.mjs" ] || erro "Rode este script de dentro da pasta haloop-vendas (não achei pronto/server/index.mjs)."
[ -f "$APP/.env" ] && erro "Já existe uma instalação em $APP. Para atualizar, use o pacote de atualização (atualizar.sh)."

# ---------------------------------------------------------------- perguntas
passo "Dados da instalação"
if [ -z "${DATABASE_URL:-}" ]; then
  echo "Cole o endereço do banco (Supabase > Connect > Session pooler, porta 5432, já com a senha)."
  echo "Para colar no PuTTY use o botão direito do mouse."
  read -rp "DATABASE_URL: " DATABASE_URL
fi
DATABASE_URL="$(printf '%s' "$DATABASE_URL" | tr -d '[:space:]')"
[[ "$DATABASE_URL" =~ ^postgres(ql)?:// ]] || erro "O endereço do banco precisa começar com postgresql://"
[[ "$DATABASE_URL" == *"[YOUR-PASSWORD]"* ]] && erro "Troque [YOUR-PASSWORD] pela senha do banco no endereço."
[[ "$DATABASE_URL" == *"'"* ]] && erro "A senha do banco não pode ter aspas simples ('). Troque a senha no Supabase."

if [ -z "${DOMINIO:-}" ]; then
  read -rp "Domínio do sistema (ex.: vendas.cliente.com.br): " DOMINIO
fi
DOMINIO="$(printf '%s' "$DOMINIO" | tr -d '[:space:]' | sed -E 's#^https?://##; s#/.*$##')"
[[ "$DOMINIO" =~ ^[A-Za-z0-9.-]+\.[A-Za-z]{2,}$ ]] || erro "Domínio inválido: $DOMINIO"
ok "domínio https://$DOMINIO"

sudo -v || erro "Não consegui usar o sudo."

# ---------------------------------------------------------------- 1. swap
passo "1/9 Memória (swap)"
if [ "$(swapon --show --noheadings | wc -l)" -eq 0 ]; then
  sudo fallocate -l 4G /swapfile || sudo dd if=/dev/zero of=/swapfile bs=1M count=4096 status=none
  sudo chmod 600 /swapfile
  sudo mkswap /swapfile >/dev/null
  sudo swapon /swapfile
  grep -q '^/swapfile ' /etc/fstab || echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab >/dev/null
  ok "swap de 4 GB criado"
else
  ok "swap já existe"
fi

# ---------------------------------------------------------------- 2. pacotes
passo "2/9 Atualizando o sistema e instalando ferramentas"
echo "iptables-persistent iptables-persistent/autosave_v4 boolean true" | sudo debconf-set-selections
echo "iptables-persistent iptables-persistent/autosave_v6 boolean true" | sudo debconf-set-selections
sudo apt-get update -y -qq
sudo apt-get install -y -qq curl ca-certificates gnupg openssl iptables-persistent dnsutils >/dev/null
ok "ferramentas instaladas"

# ---------------------------------------------------------------- 3. firewall
passo "3/9 Firewall (iptables: portas 80 e 443)"
for porta in 80 443; do
  if sudo iptables -C INPUT -p tcp --dport "$porta" -j ACCEPT 2>/dev/null; then
    ok "porta $porta já liberada"
  else
    sudo iptables -I INPUT -p tcp --dport "$porta" -j ACCEPT
    ok "porta $porta liberada"
  fi
done
sudo netfilter-persistent save >/dev/null 2>&1 || true

# ---------------------------------------------------------------- 4. node
passo "4/9 Node.js 22"
if command -v node >/dev/null && [ "$(node -p 'process.versions.node.split(".")[0]')" -ge 22 ]; then
  ok "Node $(node -v) já instalado"
else
  curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash - >/dev/null
  sudo apt-get install -y -qq nodejs >/dev/null
  ok "Node $(node -v) instalado"
fi

# ---------------------------------------------------------------- 5. arquivos
passo "5/9 Copiando o sistema para $APP"
sudo mkdir -p "$APP"
if [ "$ORIGEM" != "$APP" ]; then
  sudo cp -a "$ORIGEM"/. "$APP"/
fi
sudo chown -R "$EU":"$EU" "$APP"
chmod +x "$APP/iniciar.sh"
mkdir -p "$APP/revisoes"
ok "arquivos em $APP"

# ---------------------------------------------------------------- 6. .env
passo "6/9 Criando a configuração (.env)"
SEGREDO="$(openssl rand -hex 32)"
cat > "$APP/.env" <<EOF
# Haloop Vendas - gerado pelo instalar.sh em $(date '+%d/%m/%Y %H:%M')
DATABASE_URL='$DATABASE_URL'
BETTER_AUTH_URL='https://$DOMINIO'
BETTER_AUTH_SECRET='$SEGREDO'
VITE_AUTH_ENABLED=true
NFE_CERT_PATH='$APP/certificado.pfx'
EOF
chmod 600 "$APP/.env"
ok ".env criado (somente o usuário $EU lê)"

# ---------------------------------------------------------------- 7. banco
passo "7/9 Dependências e tabelas do banco (pode levar alguns minutos)"
cd "$APP"
npm install --no-audit --no-fund --loglevel=error
set +u; set -a; . ./.env; set +a; set -u
node scripts/migrate.mjs || erro "Não consegui criar as tabelas. Confira o endereço e a senha do banco no $APP/.env e rode: cd $APP && set -a && . ./.env && set +a && node scripts/migrate.mjs"
ok "banco pronto"

# ---------------------------------------------------------------- 8. serviço
passo "8/9 Serviço do sistema ($SERVICO)"
sudo tee /etc/systemd/system/$SERVICO.service >/dev/null <<EOF
[Unit]
Description=Haloop Vendas
After=network.target

[Service]
User=$EU
WorkingDirectory=$APP
ExecStart=$APP/iniciar.sh
Restart=always

[Install]
WantedBy=multi-user.target
EOF
sudo systemctl daemon-reload
sudo systemctl enable --now $SERVICO >/dev/null 2>&1
CODIGO=000
for _ in $(seq 1 20); do
  CODIGO="$(curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:3000/ || true)"
  [ "$CODIGO" = "200" ] && break
  sleep 2
done
[ "$CODIGO" = "200" ] || erro "O sistema não respondeu na porta 3000. Veja: journalctl -u $SERVICO -n 50 --no-pager"
ok "sistema rodando (porta 3000 -> 200)"

# ---------------------------------------------------------------- 9. https
passo "9/9 HTTPS com Caddy"
if ! command -v caddy >/dev/null; then
  if ! sudo apt-get install -y -qq caddy >/dev/null 2>&1; then
    curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | sudo gpg --dearmor --yes -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
    curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | sudo tee /etc/apt/sources.list.d/caddy-stable.list >/dev/null
    sudo apt-get update -y -qq
    sudo apt-get install -y -qq caddy >/dev/null
  fi
fi
[ -f /etc/caddy/Caddyfile ] && sudo cp /etc/caddy/Caddyfile "/etc/caddy/Caddyfile.antes-haloop.$(date +%s)"
sudo tee /etc/caddy/Caddyfile >/dev/null <<EOF
$DOMINIO {
  reverse_proxy 127.0.0.1:3000
}
EOF
sudo systemctl enable caddy >/dev/null 2>&1
sudo systemctl restart caddy
ok "Caddy configurado para $DOMINIO"

IP_PUBLICO="$(curl -s -4 --max-time 5 https://ifconfig.me || true)"
IP_DOMINIO="$(dig +short "$DOMINIO" A | tail -1 || true)"
if [ -n "$IP_PUBLICO" ] && [ "$IP_DOMINIO" != "$IP_PUBLICO" ]; then
  aviso "o domínio $DOMINIO aponta para '${IP_DOMINIO:-nada}', mas este servidor é $IP_PUBLICO."
  aviso "Corrija o registro A do domínio. O HTTPS é ativado sozinho quando o domínio apontar certo."
fi

# ---------------------------------------------------------------- fim
tar -C "$APP/pronto" -czf "$APP/revisoes/rev.38.tgz" .
printf '\n\033[1;32m========================================================\033[0m\n'
echo " Haloop Vendas instalado!"
echo
echo " Acesse:   https://$DOMINIO"
echo " Usuário:  admin"
echo " Senha:    admin   (troque em Minha conta no primeiro acesso)"
echo
echo " Depois, em Configuração: Minha empresa (dados e certificado A1),"
echo " Temas (logos e cores) e Usuários (o responsável no grupo Administrador)."
echo
echo " Se a página não abrir pelo domínio: confira o registro A do domínio e,"
echo " na Oracle Cloud, as portas 80 e 443 liberadas na Security List."
printf '\033[1;32m========================================================\033[0m\n'
