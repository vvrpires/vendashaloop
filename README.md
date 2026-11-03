# Haloop Vendas

Sistema web de orçamentos e vendas com emissão de NF-e e NFS-e, feito para revenda:
cada cliente tem a própria instalação (servidor e banco Supabase).

**Versão atual:** rev.46

## Tecnologia
- TanStack Start (React 19 + Vite + Nitro), Tailwind CSS 4
- Better Auth (login por usuário e senha)
- PostgreSQL no Supabase (conexão direta)
- NF-e/NFS-e com `@adatechnology/fiscal-provider` e certificado A1

## Estrutura
| Pasta | Conteúdo |
|---|---|
| `src/routes/_app/` | Telas: painel, orçamentos, clientes, catálogo, relatórios, usuários, tema, configuração |
| `src/components/` | Componentes (menu, login, campos, gráficos) |
| `src/lib/*.functions.ts` | Funções do servidor (vendas, notas, banco, certificado, configuração) |
| `migrations/` | Estrutura do banco (`0001` a `0022`) |
| `scripts/` | Migração, imagens padrão e utilitários |
| `instalar.sh` | Instalação automática do zero |
| `iniciar.sh` | Script usado pelo serviço para subir o sistema |

## Perfis
- **Superadmin** (`admin`): tudo, inclusive Configuração (Temas, Minha empresa, Grupos).
- **Administrador** (grupo Administrador): aplica tema, vê relatórios e cria usuários.
- **Grupos** Vendedor, Gerente, Financeiro e Técnico: permissões definidas pelo grupo.

## Instalação
Veja [`COMO-SUBIR.md`](COMO-SUBIR.md). Resumo para servidor novo (Ubuntu ou Debian):
```sh
bash instalar.sh
```
O instalador pergunta se o acesso será pelo **domínio (HTTPS)** ou **só pelo IP (rede interna)**.

## Desenvolvimento
```sh
npm install
cp .env.example .env   # preencha DATABASE_URL, BETTER_AUTH_URL e BETTER_AUTH_SECRET
npm run dev            # http://localhost:8080
NITRO_PRESET=node-server npm run build   # gera .output e aplica migrações
```

Cada mudança é registrada como uma revisão (`rev.NN`). Mudanças no banco entram como nova
migração numerada em `migrations/`.
