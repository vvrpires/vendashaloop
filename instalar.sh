#!/usr/bin/env bash
# =====================================================================
#  Haloop Vendas - instalação automática (rev.39)
#
#  Uso (no servidor, como usuário normal, ex.: ubuntu):
#     cd ~/vendashaloop-main          (ou a pasta haloop-vendas do zip)
#     bash instalar.sh
#
#  Perguntas:
#   1) Como o sistema será acessado:
#        1 = pelo DOMÍNIO, com HTTPS (ex.: https://vendas.cliente.com.br)
#        2 = só pelo IP, sem HTTPS (ex.: http://192.168.0.10) - rede interna
#   2) O endereço do banco (Supabase > Connect > Session pooler)
#   3) O domínio ou o IP
#
#  Sem perguntas:
#     MODO=dominio DOMINIO=vendas.cliente.com.br DATABASE_URL='postgresql://...' bash instalar.sh
#     MODO=ip IP=192.168.0.10 DATABASE_URL='postgresql://...' bash instalar.sh
#
#  Pode rodar de novo num servidor já instalado: ele atualiza o sistema e
#  refaz o acesso, mantendo o banco, a chave secreta e o certificado.
#
#  Funciona em Ubuntu 22.04/24.04 e Debian 12/13, com o zip completo ou
#  com o download do GitHub (vendashaloop-main).
#
#  Antes, pelo navegador: criar o projeto no Supabase. No modo domínio,
#  apontar o registro A do domínio para o IP do servidor e liberar as
#  portas 80/443 na nuvem (Oracle: Security List).
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
valor_env() { # lê um valor do .env existente sem interpretar $ (tira aspas)
  [ -f "$APP/.env" ] || return 0
  { sed -n "s/^$1=//p" "$APP/.env" | tail -1 | sed -E "s/^'(.*)'$/\1/; s/^\"(.*)\"$/\1/" | sed -e "s/'\\\\''/'/g"; } || true
}
porta_ocupada() { # mostra o programa que usa a porta (vazio se livre ou se é o caddy)
  { sudo ss -tlnpH "( sport = :$1 )" 2>/dev/null | grep -v '"caddy"' | sed -nE 's/.*users:\(\("([^"]+)".*/\1/p' | head -1; } || true
}

[ "$EU" = "root" ] && erro "Rode como usuário normal (ex.: ubuntu), não como root. O script pede o sudo quando precisa."
{ [ -f "$ORIGEM/package.json" ] && [ -d "$ORIGEM/src" ]; } || erro "Rode este script de dentro da pasta do sistema (onde estão o package.json e a pasta src)."
sudo -v || erro "Não consegui usar o sudo."

REINSTALAR=nao
if [ -f "$APP/.env" ]; then
  echo "Já existe uma instalação em $APP."
  read -rp "Atualizar o sistema e refazer a configuração de acesso? O banco, a chave e o certificado são mantidos. [s/N] " r
  [[ "$r" =~ ^[sS] ]] || { echo "Nada foi alterado."; exit 0; }
  REINSTALAR=sim
fi

# ---------------------------------------------------------------- perguntas
passo "Dados da instalação"
if [ -z "${MODO:-}" ]; then
  echo "Como o sistema será acessado?"
  echo "  1) Pelo domínio, com HTTPS   (ex.: https://vendas.cliente.com.br)  - recomendado na internet"
  echo "  2) Só pelo IP, sem HTTPS      (ex.: http://192.168.0.10)            - para rede interna"
  read -rp "Escolha [1/2]: " r
  case "$r" in 1) MODO=dominio ;; 2) MODO=ip ;; *) erro "Escolha 1 ou 2." ;; esac
fi
[[ "$MODO" == "dominio" || "$MODO" == "ip" ]] || erro "MODO deve ser dominio ou ip."

if [ "$REINSTALAR" = "sim" ] && [ -z "${DATABASE_URL:-}" ]; then
  DATABASE_URL="$(valor_env DATABASE_URL)"
fi
if [ -z "${DATABASE_URL:-}" ]; then
  echo "Cole o endereço do banco (Supabase > Connect > Session pooler, porta 5432, já com a senha)."
  echo "Para colar no PuTTY use o botão direito do mouse."
  read -rp "DATABASE_URL: " DATABASE_URL
fi
DATABASE_URL="$(printf '%s' "$DATABASE_URL" | tr -d '[:space:]')"
[[ "$DATABASE_URL" =~ ^postgres(ql)?:// ]] || erro "O endereço do banco precisa começar com postgresql://"
[[ "$DATABASE_URL" == *"[YOUR-PASSWORD]"* ]] && erro "Troque [YOUR-PASSWORD] pela senha do banco no endereço."
[[ "$DATABASE_URL" == *"'"* ]] && erro "A senha do banco não pode ter aspas simples ('). Troque a senha no Supabase."

if [ "$MODO" = "dominio" ]; then
  [ -n "${DOMINIO:-}" ] || read -rp "Domínio do sistema (ex.: vendas.cliente.com.br): " DOMINIO
  DOMINIO="$(printf '%s' "$DOMINIO" | tr -d '[:space:]' | sed -E 's#^https?://##; s#/.*$##')"
  [[ "$DOMINIO" =~ ^[A-Za-z0-9.-]+\.[A-Za-z]{2,}$ ]] || erro "Domínio inválido: $DOMINIO"
  for p in 80 443; do
    prog="$(porta_ocupada "$p")"
    [ -z "$prog" ] || erro "A porta $p já é usada por '$prog'. O HTTPS do domínio precisa das portas 80 e 443.
   Se '$prog' não serve outros sites:  sudo systemctl disable --now $prog   e rode o script de novo.
   Se serve outros sites, rode de novo escolhendo a opção 2 (só pelo IP)."
  done
  URL="https://$DOMINIO"
  PORTA_WEB=443
else
  SUGESTAO="$(hostname -I 2>/dev/null | awk '{print $1}')"
  [ -n "${IP:-}" ] || read -rp "IP de acesso ao sistema [$SUGESTAO]: " IP
  IP="${IP:-$SUGESTAO}"
  IP="$(printf '%s' "$IP" | tr -d '[:space:]')"
  [[ "$IP" =~ ^[0-9]{1,3}(\.[0-9]{1,3}){3}$ ]] || erro "IP inválido: $IP"
  prog="$(porta_ocupada 80)"
  if [ -n "$prog" ]; then
    aviso "a porta 80 já é usada por '$prog'. O sistema vai ficar na porta 3000."
    URL="http://$IP:3000"
    PORTA_WEB=3000
  else
    URL="http://$IP"
    PORTA_WEB=80
  fi
fi
ok "o sistema vai abrir em: $URL"

# ---------------------------------------------------------------- 1. swap
passo "1/9 Memória (swap)"
# /proc/swaps funciona sem sudo no Ubuntu e no Debian (lá o swapon não fica no PATH do usuário)
if [ "$(tail -n +2 /proc/swaps | wc -l)" -gt 0 ]; then
  ok "swap já existe ($(tail -n +2 /proc/swaps | awk '{print $1}' | paste -sd ' '))"
elif [ -f /swapfile ]; then
  sudo chmod 600 /swapfile
  sudo /sbin/swapon /swapfile 2>/dev/null || { sudo /sbin/mkswap /swapfile >/dev/null && sudo /sbin/swapon /swapfile; }
  grep -q '^/swapfile ' /etc/fstab || echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab >/dev/null
  ok "swap /swapfile ativado"
else
  sudo fallocate -l 4G /swapfile || sudo dd if=/dev/zero of=/swapfile bs=1M count=4096 status=none
  sudo chmod 600 /swapfile
  sudo /sbin/mkswap /swapfile >/dev/null
  sudo /sbin/swapon /swapfile
  grep -q '^/swapfile ' /etc/fstab || echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab >/dev/null
  ok "swap de 4 GB criado"
fi

# ---------------------------------------------------------------- 2. pacotes
passo "2/9 Atualizando o sistema e instalando ferramentas"
echo "iptables-persistent iptables-persistent/autosave_v4 boolean true" | sudo debconf-set-selections
echo "iptables-persistent iptables-persistent/autosave_v6 boolean true" | sudo debconf-set-selections
sudo apt-get update -y -qq
sudo apt-get install -y -qq curl ca-certificates gnupg openssl iptables iptables-persistent >/dev/null
sudo apt-get install -y -qq dnsutils >/dev/null 2>&1 || sudo apt-get install -y -qq bind9-dnsutils >/dev/null 2>&1 || true
ok "ferramentas instaladas"

# ---------------------------------------------------------------- 3. firewall
passo "3/9 Firewall (iptables)"
if [ "$MODO" = "dominio" ]; then PORTAS="80 443"; else PORTAS="$PORTA_WEB"; fi
for porta in $PORTAS; do
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
if [ "$REINSTALAR" = "sim" ]; then
  sudo mkdir -p "$APP/revisoes"
  [ -d "$APP/pronto" ] && sudo tar -C "$APP/pronto" -czf "$APP/revisoes/antes-$(date +%F-%H%M).tgz" . && ok "cópia de segurança da versão anterior em revisoes/"
  sudo rm -rf "$APP/src" "$APP/pronto" "$APP/.output"
fi
if [ "$ORIGEM" != "$APP" ]; then
  sudo tar -C "$ORIGEM" --exclude=./.env --exclude='./certificado.*' --exclude=./node_modules --exclude=./.git -cf - . | sudo tar -C "$APP" -xf -
fi
sudo chown -R "$EU":"$EU" "$APP"
chmod +x "$APP/iniciar.sh"
mkdir -p "$APP/revisoes"
ok "arquivos em $APP"

# ---------------------------------------------------------------- 6. .env
passo "6/9 Configuração (.env)"
SEGREDO="$(valor_env BETTER_AUTH_SECRET)"
[ -n "$SEGREDO" ] || SEGREDO="$(openssl rand -hex 32)"
CERT_SENHA="$(valor_env NFE_CERT_PASSWORD)"
[ -f "$APP/.env" ] && cp "$APP/.env" "$APP/.env.anterior"
{
  echo "# Haloop Vendas - gerado pelo instalar.sh em $(date '+%d/%m/%Y %H:%M') (acesso: $MODO)"
  echo "DATABASE_URL='$DATABASE_URL'"
  echo "BETTER_AUTH_URL='$URL'"
  echo "BETTER_AUTH_SECRET='$SEGREDO'"
  echo "VITE_AUTH_ENABLED=true"
  echo "NFE_CERT_PATH='$APP/certificado.pfx'"
  if [ -n "$CERT_SENHA" ]; then printf "NFE_CERT_PASSWORD='%s'\n" "${CERT_SENHA//\'/\'\\\'\'}"; fi
} > "$APP/.env"
chmod 600 "$APP/.env" "$APP/.env.anterior" 2>/dev/null || true
ok ".env pronto (somente o usuário $EU lê)"

# ---------------------------------------------------------------- 7. banco
passo "7/9 Dependências, compilação e tabelas do banco (pode levar vários minutos)"
cd "$APP"
npm install --no-audit --no-fund --loglevel=error
set +u; set -a; . ./.env; set +a; set -u
if [ ! -f "$APP/pronto/server/index.mjs" ]; then
  echo "   compilando o sistema..."
  node scripts/exportar-imagens-padrao.mjs >/dev/null 2>&1 || true
  PATH="$APP/node_modules/.bin:$PATH" NITRO_PRESET=node-server node scripts/with-app-env.mjs vite build --logLevel error
  [ -f .output/server/index.mjs ] || erro "A compilação não gerou .output/server/index.mjs"
  rm -rf pronto && cp -a .output pronto
  ok "sistema compilado"
fi
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
sudo systemctl enable $SERVICO >/dev/null 2>&1
sudo systemctl restart $SERVICO
CODIGO=000
for _ in $(seq 1 20); do
  CODIGO="$(curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:3000/ || true)"
  [ "$CODIGO" = "200" ] && break
  sleep 2
done
[ "$CODIGO" = "200" ] || erro "O sistema não respondeu na porta 3000. Veja: journalctl -u $SERVICO -n 50 --no-pager"
ok "sistema rodando (porta 3000 -> 200)"

# ---------------------------------------------------------------- 9. acesso
passo "9/9 Acesso (Caddy)"
if [ "$PORTA_WEB" = "3000" ]; then
  ok "acesso direto na porta 3000 (Caddy não usado)"
else
  if ! command -v caddy >/dev/null; then
    if ! sudo apt-get install -y -qq caddy >/dev/null 2>&1; then
      curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | sudo gpg --dearmor --yes -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
      curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | sudo tee /etc/apt/sources.list.d/caddy-stable.list >/dev/null
      sudo apt-get update -y -qq
      sudo apt-get install -y -qq caddy >/dev/null
    fi
  fi
  sudo mkdir -p /etc/caddy
  [ -f /etc/caddy/Caddyfile ] && sudo cp /etc/caddy/Caddyfile "/etc/caddy/Caddyfile.antes-haloop.$(date +%s)"
  if [ "$MODO" = "dominio" ]; then
    printf '%s {\n  reverse_proxy 127.0.0.1:3000\n}\n' "$DOMINIO" | sudo tee /etc/caddy/Caddyfile >/dev/null
  else
    printf ':80 {\n  reverse_proxy 127.0.0.1:3000\n}\n' | sudo tee /etc/caddy/Caddyfile >/dev/null
  fi
  sudo systemctl enable caddy >/dev/null 2>&1 || true
  if sudo systemctl restart caddy; then
    ok "Caddy configurado"
  else
    aviso "o Caddy não iniciou. Últimas mensagens:"
    sudo journalctl -u caddy --no-pager -n 15 || true
    aviso "o sistema continua acessível em http://<IP-do-servidor>:3000 (libere a porta: sudo iptables -I INPUT -p tcp --dport 3000 -j ACCEPT)"
  fi
fi

if [ "$MODO" = "dominio" ]; then
  IP_PUBLICO="$(curl -s -4 --max-time 5 https://ifconfig.me || true)"
  IP_DOMINIO="$(dig +short "$DOMINIO" A 2>/dev/null | tail -1 || true)"
  if [ -n "$IP_PUBLICO" ] && [ -n "$IP_DOMINIO" ] && [ "$IP_DOMINIO" != "$IP_PUBLICO" ]; then
    aviso "o domínio $DOMINIO aponta para '$IP_DOMINIO', mas este servidor é $IP_PUBLICO. Corrija o registro A."
  fi
fi

# ---------------------------------------------------------------- fim
tar -C "$APP/pronto" -czf "$APP/revisoes/instalado-$(date +%F-%H%M).tgz" . 2>/dev/null || true
printf '\n\033[1;32m========================================================\033[0m\n'
echo " Haloop Vendas pronto!"
echo
echo " Acesse:   $URL"
if [ "$REINSTALAR" = "nao" ]; then
  echo " Usuário:  admin"
  echo " Senha:    admin   (troque em Minha conta no primeiro acesso)"
fi
[ "$MODO" = "ip" ] && echo " Sem HTTPS: use só na rede interna (ou pela VPN)."
printf '\033[1;32m========================================================\033[0m\n'
