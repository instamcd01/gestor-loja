# Gestor Loja

Catálogo online público (e, no futuro, checkout) para as lojas cadastradas
no [Gestor](../gestor). Projeto separado de propósito — o Gestor é a
ferramenta interna do lojista; este é o site voltado ao cliente final.

## Como roda

```bash
npm install
cp .env.example .env.local   # preencher NEXT_PUBLIC_SUPABASE_ANON_KEY
npm run dev
```

Não existe "a loja" na raiz — o site é multi-tenant, uma URL por empresa:

```
/loja/[slug]              catálogo da empresa
/loja/[slug]/produto/[id] página de um produto
```

O `slug` vem de `empresas.catalogo_slug`, configurado pelo lojista no
Gestor em **Configurações > Catálogo Online** (`catalogo_online_screen.dart`).
Só aparece aqui empresa com `catalogo_ativo = true`. Para testar em dev,
a empresa "Delivery Pet" já está com `catalogo_slug = 'delivery-pet'`.

## Arquitetura

Mesmo banco Supabase do Gestor, mas o site **nunca** lê as tabelas
(`produtos`, `empresas`, etc.) diretamente — a chave pública (anon) não
tem policy de RLS nelas, só o app do lojista (`authenticated`) tem. Em vez
disso, existem três views somente-leitura (migração `catalogo_publico_views`
no Supabase), cada uma já filtrando por `catalogo_ativo`/`exibir_no_catalogo`
e expondo só colunas seguras — nada de custo, margem, CNPJ, chave Pix etc:

- `catalogo_empresas_publico`
- `catalogo_produtos_publico`
- `catalogo_categorias_publico`

`src/lib/catalogo.ts` é a única camada que fala com essas views. Os tipos em
`src/lib/types.ts` espelham exatamente as colunas de cada view — se um campo
novo for exposto, precisa entrar nos dois lugares (migração + tipo).

Cores de marca (`cor_primaria`/`cor_secundaria`, já usadas no Gestor para
personalização visual) são aplicadas por tenant via CSS vars no layout de
`/loja/[slug]` — ver `src/app/loja/[slug]/layout.tsx`.

## O que existe

- Catálogo público (listagem + página de produto), SSR com revalidação
  (ISR) de 60s — rápido, sempre razoavelmente atualizado, sem precisar de
  rebuild a cada mudança de preço/estoque.
- Tema por empresa (cor, logo, nome).

## O que falta (nessa ordem provável)

1. **Identidade do cliente final** — ainda não decidido. Candidato mais
   natural dado o schema existente (`clientes.telefone` é `NOT NULL`,
   sempre foi a chave de upsert nas integrações de marketplace): login por
   telefone/OTP via Supabase Auth, não email/senha.
2. **Carrinho** — as tabelas `carrinho`/`carrinho_itens` já existem no
   banco mas hoje só têm policy para `authenticated` (lojista). Precisa de
   policy nova escopada ao cliente dono do carrinho, dependente da decisão
   do item 1.
3. **Checkout / criação de pedido** — inserir em `pedidos`/`itens_pedido`
   com `origem`/`canal_venda` = algo como `'site_proprio'` (mesmo padrão
   já usado pra `'ifood'` — os triggers de baixa de estoque, cálculo de
   margem etc. já funcionam pra qualquer origem, não precisam mudar).
4. **Pagamento** — hoje não existe gateway integrado. Pix é o mínimo
   viável; `empresas.chave_pix` já existe mas nunca foi usado pra gerar
   cobrança.
5. Antes de produção: restringir `next.config.ts`'s `images.remotePatterns`
   (hoje aberto pra qualquer host http/https porque as fotos de produto
   vêm de fontes variadas) a hosts conhecidos.
