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
- **Login do cliente final por telefone/OTP** (`/loja/[slug]/entrar` →
  `/loja/[slug]/conta`), ver seção própria abaixo.
- **Carrinho e checkout** (`/loja/[slug]/carrinho`, `/loja/[slug]/pedido/[id]`),
  ver seção própria abaixo.

## Login do cliente (telefone/OTP)

Fluxo: telefone → SMS com código de 6 dígitos → confirma → função
`entrar_ou_criar_cliente(empresa_id, nome)` no Supabase (SECURITY DEFINER)
vincula ou cria a linha em `clientes` daquela empresa e devolve o id.

- `clientes.auth_user_id` (novo, migração `auth_cliente_final`) é o
  vínculo com `auth.users`. Índice único em `(empresa_id, auth_user_id)`.
- O cliente só tem policy de **SELECT** na própria linha
  (`auth_user_id = auth.uid()`) — de propósito, sem policy de INSERT/UPDATE
  direta. Toda escrita passa pela função acima, que só toca telefone
  (já verificado pelo GoTrue, não vem do client) e nome — assim o cliente
  nunca consegue mexer em `saldo`/`segmento`/`score_fidelidade` etc via um
  UPDATE cru, mesmo tendo a mesma role Postgres (`authenticated`) que o
  lojista usa no Gestor.
- **Não tenta casar telefone com CRM legado por heurística.** Os
  `telefone` já cadastrados no banco estão em formatos inconsistentes
  (`(21) 98855-5444`, `2144557788456`, números mascarados 0800 do iFood,
  etc — dado real, checado antes de escrever essa função). A função só
  reaproveita uma linha existente se o telefone bater **exatamente** com
  o que o GoTrue verificou (E.164, ex: `5521987654321`); senão cria uma
  linha nova. Vai gerar clientes "duplicados" (um do CRM antigo, um novo
  do site) até os dados antigos serem normalizados — problema conhecido,
  não resolvido aqui.
- Header (`AccountLink`) resolve o estado de login **no browser**, não no
  server — o layout de `/loja/[slug]` é ISR (cacheado entre visitantes);
  ler cookie/sessão ali forçaria a rota inteira a virar dinâmica e
  perderia esse cache. `/entrar` e `/conta` são `force-dynamic` (correto,
  são páginas com dado pessoal, não podem ser cacheadas/compartilhadas).

### Entrega do código: WhatsApp via Send SMS Hook (não Twilio)

Usuário não quis Twilio. O canal WhatsApp nativo do Supabase só existe via
Twilio/Twilio Verify, então em vez disso usamos o **Send SMS Hook**
(Authentication > Hooks no dashboard do Supabase) — um endpoint HTTPS
próprio assume o envio, o Supabase continua cuidando de gerar/validar o
OTP e a sessão. O endpoint é um workflow n8n:

- Workflow `Site - Enviar OTP Login via WhatsApp` (n8n, id `vvSbhI6JWIqxUvhp`).
  A URL completa do webhook **não fica registrada aqui de propósito** — o
  path é um token aleatório que funciona como a única proteção desse
  endpoint (ver abaixo), então colar a URL num arquivo versionado
  anularia essa proteção. Pegar a URL direto no editor do workflow no n8n
  quando for configurar o hook no Supabase.
  Valida o payload, manda template `AUTHENTICATION` via WhatsApp Cloud API
  (Meta Graph API, `POST /{phone-number-id}/messages`, botão `copy_code`),
  loga em `eventos_sistema` (`tipo_evento` `site_login_otp_enviado`/`_falha`),
  responde no formato que o Supabase espera (`{}`/200 ou
  `{"error":{"http_code":...}}`/erro).
- **Sem verificação de assinatura HMAC real** — confirmado ao vivo que o
  node Crypto nativo do n8n não sabe decodificar uma chave em base64 (o
  que o padrão Standard Webhooks do Supabase exige) e que Code node com
  `require('crypto')` está bloqueado nessa instância. A proteção real hoje
  é só o path do webhook ser um token aleatório de 48 hex chars — trade-off
  deliberado, não é criptograficamente equivalente a uma assinatura
  verificada. Dá pra corrigir depois configurando
  `NODE_FUNCTION_ALLOW_BUILTIN=crypto` no servidor do n8n.

### ⚠️ Pendência do usuário, fora do código: verificação de negócio na Meta

Testado ao vivo, ponta a ponta — tudo funciona (validação, formatação,
log, resposta) exceto o envio real: a Meta recusa `(#132001) Template
name does not exist`, porque **o template de Authentication não existe**
e não dá pra criar um (`POST /message_templates` retorna "esta conta não
tem permissão para criar um modelo de mensagem") até a empresa concluir a
**verificação de negócio no Meta Business Suite**. É processo deles
(documentos da empresa), fora do meu alcance. A WABA em uso hoje
(id termina em `...813`) inclusive ainda se chama "Test WhatsApp Business
Account" — nunca saiu do modo de teste padrão do Cloud API.

Assim que a verificação for concluída: recriar o template (JSON já
pronto, testado contra a API — `name: login_codigo_verificacao`,
`language: pt_BR`, categoria `AUTHENTICATION`, botão OTP `copy_code`),
esperar aprovação, e então configurar o Send SMS Hook no dashboard do
Supabase (Authentication > Providers > Phone → habilitar; Authentication
> Hooks > Send SMS Hook → HTTPS → colar a URL do workflow acima).
Nenhuma mudança de código deve ser necessária depois disso.

## Carrinho e checkout

Reaproveita `carrinho`/`carrinho_itens` (já existiam no banco, sem uso até
agora). RLS nova escopada por `clientes.auth_user_id = auth.uid()` — aqui,
diferente de `clientes`, **escrita direta é segura** (sem coluna sensível
de CRM em jogo, só quantidade/preço do próprio carrinho). Exige login;
sem carrinho de visitante por enquanto.

Checkout é a função `finalizar_pedido_site(empresa_id, tipo_pagamento,
observacoes)` (SECURITY DEFINER, migração `checkout_site_proprio`):
- **Preço e custo nunca vêm do carrinho** — são relidos de `produtos` no
  momento do checkout (o snapshot em `carrinho_itens` é só para exibição;
  o cliente não tem como manipular o preço final editando o carrinho).
- **Achado real ao testar**: existe produto na base com
  `preco_promocional` MAIOR que `preco` (dado sujo da planilha
  importada). A função só usa `preco_promocional` quando ele é de fato
  menor — mesma guarda que a `ProdutoCard`/página de produto já usa pra
  decidir se mostra "em promoção", agora também protegendo o valor
  cobrado de verdade.
- Valida estoque total (soma entre depósitos) antes de criar o pedido —
  `trg_baixar_estoque` não bloqueia estoque negativo sozinho.
- Deixa toda a automação existente fazer o resto: `trg_calcular_subtotal_item`
  calcula subtotal/margem por item, `trigger_atualiza_totais` soma em
  `pedidos.valor_produtos`, `trg_baixar_estoque` desconta o estoque,
  `trg_evento_pedido` loga em `eventos_sistema`, `trg_metricas_cliente`
  atualiza o CRM do cliente — só forneço `valor_total` (produtos + entrega
  − desconto) no final, que é o único valor que nenhum trigger calcula
  sozinho.
- `custo_total`/`lucro_bruto` "reais" (descontando taxas de marketplace
  etc) só ficam definitivos quando o pedido é marcado `entregue`/`concluido`
  E `status_pagamento='pago'` no Gestor — comportamento já existente do
  sistema pra qualquer canal, não é específico do site.
- **Só retirada por enquanto** — `valor_entrega=0` sempre, sem cálculo de
  frete/zona de entrega. Maior próximo incremento.
- Validado via `SET ROLE authenticated` real simulando um cliente de
  verdade fazendo um pedido de 2 produtos com estoque real, depois
  desfeito (estoque restaurado, pedido de teste apagado).

Cliente só lê os próprios pedidos (`pedidos_cliente_le_proprio`/
`itens_pedido_cliente_le_proprio`, SELECT-only, mesmo padrão de
`clientes`) — necessário pra página de confirmação `/loja/[slug]/pedido/[id]`.

## O que falta (nessa ordem provável)

1. ~~Identidade do cliente final~~ — **feito**, ver acima (pendente só a
   configuração do provedor de mensagem, que é do usuário).
2. ~~Carrinho~~ — **feito**, ver acima.
3. ~~Checkout / criação de pedido~~ — **feito**, ver acima (só retirada).
4. **Entrega com cálculo de frete** — usar `zonas_entrega` (já existe,
   distância-tiered, usado hoje só no Gestor) pra oferecer entrega no
   site, não só retirada. Precisa de endereço do cliente + geocoding.
5. **Pagamento** — hoje não existe gateway integrado. Pix é o mínimo
   viável; `empresas.chave_pix` já existe mas nunca foi usado pra gerar
   cobrança.
6. Antes de produção: restringir `next.config.ts`'s `images.remotePatterns`
   (hoje aberto pra qualquer host http/https porque as fotos de produto
   vêm de fontes variadas) a hosts conhecidos.
