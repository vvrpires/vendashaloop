# Haloop Vendas: instalação do zero (rev.39)

Passo a passo para colocar o sistema num servidor novo, por exemplo para um cliente novo.
Cada cliente tem o próprio servidor (ou pasta) e o próprio banco no Supabase.

> Servidor que **já roda** o Haloop Vendas: não use este guia. Use o pacote de atualização
> (`haloop-vendas-rev38.zip` + `bash atualizar.sh`).

O que você vai precisar:
- um servidor Ubuntu 22.04 ou 24.04 (ex.: Oracle Cloud), com acesso SSH (PuTTY/WinSCP);
- uma conta no Supabase;
- um domínio ou subdomínio (ex.: `vendas.cliente.com.br`) apontando para o IP do servidor;
- este pacote: `haloop-vendas-completo-rev38.zip`.

---

## Instalação automática (recomendada)

O script `instalar.sh` faz quase tudo sozinho: memória swap, firewall, Node.js 22, cópia para
`/opt/haloop-vendas`, `.env`, compilação (se necessário), tabelas do banco, serviço e acesso (Caddy).
Funciona em **Ubuntu 22.04/24.04** e **Debian 12/13**, com o zip completo ou com o download do GitHub.

### Domínio ou IP?
O script pergunta como o sistema será acessado:

| Opção | Endereço | Quando usar |
|---|---|---|
| **1. Domínio (HTTPS)** | `https://vendas.cliente.com.br` | Acesso pela internet. Precisa de um domínio apontando para o servidor e das portas 80 e 443 livres |
| **2. Só pelo IP (sem HTTPS)** | `http://192.168.0.10` | Rede interna ou VPN. Não precisa de domínio. Se a porta 80 já estiver em uso (Apache/Nginx), o sistema fica em `http://IP:3000` |

No modo IP não há cadeado: o tráfego não é criptografado. Use só dentro da rede da empresa ou pela VPN.

### Passos
**Antes, pelo navegador:** faça a Parte 1 (Supabase). No modo domínio, faça também os passos 6 e 7
(portas na Oracle Cloud e registro A do domínio).

**No servidor:**
1. Envie a pasta do sistema para o servidor (WinSCP), por exemplo para `/home/ubuntu`.
   Pode ser a pasta `haloop-vendas` do zip ou a `vendashaloop-main` baixada do GitHub.
2. No PuTTY (usuário normal, não root):
   ```sh
   cd /home/ubuntu/vendashaloop-main      # ou haloop-vendas
   bash instalar.sh
   ```
3. Responda:
   - **Acesso**: `1` (domínio) ou `2` (só IP);
   - **DATABASE_URL**: o endereço do banco do passo 5 (cole com o botão direito do mouse);
   - **Domínio** (opção 1) ou **IP** (opção 2, o script sugere o IP do servidor).
4. Aguarde a mensagem **"Haloop Vendas pronto!"** (de 10 a 20 minutos) e siga para a **Parte 8**.
5. Apague a cópia temporária da pasta enviada.

### Rodar de novo
Se o servidor já tem o Haloop Vendas, o script pergunta se deve **atualizar e refazer o acesso**.
Ele mantém o banco, a chave secreta e a senha do certificado, guarda a versão anterior em
`revisoes/` e permite trocar de IP para domínio (ou o contrário).

### Se a porta estiver ocupada
- **Modo domínio:** o script para e mostra qual programa usa a porta 80/443 (ex.: `apache2`).
  Se ele não serve outros sites: `sudo systemctl disable --now apache2` e rode de novo.
  Se serve, use o modo IP.
- **Modo IP:** o sistema fica direto na porta 3000, sem Caddy.

O restante deste guia é a instalação **manual**, passo a passo, caso prefira ou precise conferir algo.

---

## Parte 1: Banco de dados (Supabase)

1. Em supabase.com, clique em **New project**.
2. Dê um nome (ex.: `db-cliente`), crie uma **senha forte para o banco**, anote-a e escolha a região.
3. Espere o projeto ficar pronto (cerca de 2 minutos).
4. Clique em **Connect** → **Session pooler** e copie o endereço (URI), que começa com
   `postgresql://postgres.` e usa a porta **5432**.
5. No endereço copiado, troque `[YOUR-PASSWORD]` pela senha do passo 2. Guarde esse endereço para a Parte 4.

## Parte 2: Servidor

6. **Liberar as portas 80 e 443 na nuvem** (Oracle Cloud): em **Networking → Virtual Cloud Networks →
   sua VCN → Security Lists → Default**, adicione regras de entrada (Ingress) TCP para as portas **80** e **443**,
   origem `0.0.0.0/0`.
7. **No domínio**: crie um registro **A** do subdomínio (ex.: `vendas`) apontando para o IP público do servidor.
8. Entre no servidor pelo PuTTY e atualize o sistema:
   ```sh
   sudo apt update && sudo apt upgrade -y
   ```
9. **Liberar as portas no firewall do Ubuntu** (as imagens da Oracle vêm com iptables fechado):
   ```sh
   sudo iptables -I INPUT -p tcp --dport 80 -j ACCEPT
   sudo iptables -I INPUT -p tcp --dport 443 -j ACCEPT
   sudo apt install -y iptables-persistent
   sudo netfilter-persistent save
   ```
10. **Instalar o Node.js 22**:
    ```sh
    curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
    sudo apt install -y nodejs
    node -v
    ```
    Deve mostrar `v22...`.

## Parte 3: Copiar o sistema

11. No seu computador, extraia o `haloop-vendas-completo-rev38.zip`. Vai aparecer a pasta `haloop-vendas`.
12. No **WinSCP**, envie a pasta `haloop-vendas` para `/home/ubuntu`.
13. No PuTTY, mova para o lugar definitivo:
    ```sh
    sudo mkdir -p /opt/haloop-vendas
    sudo cp -r /home/ubuntu/haloop-vendas/. /opt/haloop-vendas/
    sudo chown -R ubuntu:ubuntu /opt/haloop-vendas
    cd /opt/haloop-vendas
    ```

## Parte 4: Configuração (.env)

14. Gere a chave secreta e copie o resultado:
    ```sh
    openssl rand -hex 32
    ```
15. Crie o arquivo de configuração:
    ```sh
    cp .env.example .env
    nano .env
    ```
16. Preencha, **sempre entre aspas simples**:
    - `DATABASE_URL='...'`: o endereço do passo 5;
    - `BETTER_AUTH_URL='https://vendas.cliente.com.br'`: o endereço do passo 7, com `https` e sem barra no final;
    - `BETTER_AUTH_SECRET='...'`: a chave do passo 14.

    Salve com **Ctrl+O**, Enter e **Ctrl+X**.
17. Proteja o arquivo:
    ```sh
    chmod 600 .env
    ```

## Parte 5: Criar as tabelas do banco

18. Instale as dependências (1 a 3 minutos):
    ```sh
    cd /opt/haloop-vendas
    npm install --no-audit --no-fund
    ```
19. Crie as tabelas:
    ```sh
    set +u; set -a; . ./.env; set +a
    node scripts/migrate.mjs
    ```
    Deve terminar com `[migrate] done — 22 migration(s) applied.`

## Parte 6: Deixar o sistema rodando sozinho

20. Crie o serviço:
    ```sh
    chmod +x /opt/haloop-vendas/iniciar.sh
    sudo nano /etc/systemd/system/haloop-vendas.service
    ```
    Cole:
    ```ini
    [Unit]
    Description=Haloop Vendas
    After=network.target

    [Service]
    User=ubuntu
    WorkingDirectory=/opt/haloop-vendas
    ExecStart=/opt/haloop-vendas/iniciar.sh
    Restart=always

    [Install]
    WantedBy=multi-user.target
    ```
21. Ative e teste:
    ```sh
    sudo systemctl daemon-reload
    sudo systemctl enable --now haloop-vendas
    systemctl status haloop-vendas --no-pager
    curl -s -o /dev/null -w '%{http_code}\n' http://127.0.0.1:3000/
    ```
    Deve aparecer **active (running)** e **200**.

## Parte 7: HTTPS (Caddy)

22. Instale o Caddy:
    ```sh
    sudo apt install -y caddy
    sudo nano /etc/caddy/Caddyfile
    ```
23. Apague o conteúdo e deixe só (com o seu domínio):
    ```
    vendas.cliente.com.br {
      reverse_proxy 127.0.0.1:3000
    }
    ```
24. Aplique:
    ```sh
    sudo systemctl restart caddy
    ```
    O certificado HTTPS é emitido sozinho em alguns segundos. Isso exige o domínio já apontado (passo 7) e as portas liberadas (passos 6 e 9).

## Parte 8: Primeiro acesso e configuração

25. Abra `https://vendas.cliente.com.br` e entre com o usuário **`admin`** e a senha **`admin`**.
    Esse é o **superadmin**.
26. Em **Minha conta**, troque a senha do `admin` na hora.
27. Em **Configuração → Minha empresa**, preencha os dados da empresa e, se o cliente for emitir nota,
    envie o **certificado A1** (veja a seção *Certificado digital A1* abaixo) e escolha o ambiente
    (comece em **Homologação**), a série e o regime.
28. Em **Configuração → Temas**, coloque as logos, o fundo, o favicon, o título da aba e as cores.
    Campos vazios usam as imagens padrão do sistema.
29. Em **Usuários → Novo usuário**, crie os usuários do cliente e escolha o grupo:
    - **Administrador**: o responsável do cliente (aplica tema, cria usuários e vê relatórios);
    - **Vendedor**, **Gerente**, **Financeiro** ou **Técnico**: a equipe.
30. Teste: entre com o administrador do cliente e com um vendedor, crie um cliente, um produto e um orçamento.

## Certificado digital A1 (para emitir NF-e e NFS-e)

O certificado fica sempre em **`/opt/haloop-vendas/certificado.pfx`**.
A senha dele fica no **`.env`**, na linha `NFE_CERT_PASSWORD`.

### Jeito 1: pela tela (recomendado)
1. Entre como **admin** (superadmin).
2. Vá em **Configuração → Minha empresa → Certificado digital**.
3. Em **Arquivo .pfx** escolha o certificado, em **Senha do certificado** digite a senha e clique em **Salvar certificado**.
4. O sistema confere a senha e mostra **"Certificado salvo."**. Ele grava sozinho:
   - o arquivo em `/opt/haloop-vendas/certificado.pfx`;
   - a senha no `.env` (`NFE_CERT_PASSWORD='...'`).
5. Não precisa reiniciar. Para trocar o certificado depois, repita o processo.

### Jeito 2: à mão (pelo servidor)
1. Envie o arquivo `.pfx` pelo **WinSCP** para `/home/ubuntu` e renomeie para `certificado.pfx`.
2. No PuTTY, coloque o arquivo no lugar:
   ```sh
   sudo cp /home/ubuntu/certificado.pfx /opt/haloop-vendas/certificado.pfx
   sudo chmod 600 /opt/haloop-vendas/certificado.pfx
   rm /home/ubuntu/certificado.pfx
   ```
3. Grave a senha no `.env`:
   ```sh
   nano /opt/haloop-vendas/.env
   ```
   Acrescente a linha, **com aspas simples** (assim símbolos como `$` e `#` não atrapalham):
   ```
   NFE_CERT_PASSWORD='senha-do-certificado'
   ```
   Salve com **Ctrl+O**, Enter e **Ctrl+X**.
4. Reinicie:
   ```sh
   sudo systemctl restart haloop-vendas
   ```

### E o arquivo `certificado.senha`?
É o jeito antigo (usado pelo Grok): um arquivo `/opt/haloop-vendas/certificado.senha` com só a senha dentro.
Ele continua funcionando, mas **só é usado se o `.env` não tiver `NFE_CERT_PASSWORD`**. Para criar:
```sh
nano /opt/haloop-vendas/certificado.senha     # cole a senha, salve e saia
chmod 600 /opt/haloop-vendas/certificado.senha
sudo systemctl restart haloop-vendas
```
Se você usar a tela (Jeito 1), não precisa deste arquivo.

### Conferir
- Em **Configuração → Minha empresa**, o cartão **Certificado digital** mostra **"Certificado instalado."**.
- Comece emitindo em **Homologação** e só depois mude para **Produção**.

## Parte 9: Limpeza

31. Apague a cópia temporária:
    ```sh
    rm -rf /home/ubuntu/haloop-vendas
    ```

---

## Comandos úteis

| Para | Comando |
|---|---|
| Ver se está rodando | `systemctl status haloop-vendas --no-pager` |
| Reiniciar | `sudo systemctl restart haloop-vendas` |
| Ver os erros do sistema | `journalctl -u haloop-vendas -n 100 --no-pager` |
| Ver os erros do HTTPS | `journalctl -u caddy -n 50 --no-pager` |

## Problemas comuns

- **Página não abre pelo domínio**: confira o registro A do domínio, as portas 80/443 na Security List (passo 6) e no iptables (passo 9).
- **Erro de login ou "Invalid origin"**: o `BETTER_AUTH_URL` precisa ser exatamente o endereço aberto no navegador, com `https` e sem barra no final. Depois de corrigir, rode `sudo systemctl restart haloop-vendas`.
- **Tela pedindo "endereço do banco"**: o `DATABASE_URL` está errado ou a senha do banco mudou. Corrija o `.env` e reinicie.
- **`[migrate]` com erro de senha**: confira a senha dentro do `DATABASE_URL` e se ele está entre aspas simples.

## Recompilar depois de mudar o código (src/)

```sh
cd /opt/haloop-vendas
set +u; set -a; . ./.env; set +a
npm install --no-audit --no-fund
node scripts/exportar-imagens-padrao.mjs     # imagens atuais do Tema viram padrão
NITRO_PRESET=node-server npm run build        # compila e aplica migrações novas
mkdir -p revisoes && tar -C pronto -czf revisoes/antes-$(date +%F-%H%M).tgz .
rm -rf pronto && cp -a .output pronto
sudo systemctl restart haloop-vendas
```

## Voltar uma versão

```sh
cd /opt/haloop-vendas
rm -rf pronto && mkdir pronto
tar -C pronto -xzf revisoes/<arquivo>.tgz
sudo systemctl restart haloop-vendas
```
