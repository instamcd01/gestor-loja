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
- **Placeholder por categoria pra produto sem foto** — hoje é a maioria
  (937 de 939). `ProdutoPlaceholder` mapeia a categoria pra um ícone
  (cruz médica, tigela, gota, cama...) sobre gradiente com as cores da
  marca; `ProdutoImagem` (client component) cai nesse placeholder tanto
  quando `imagem_url` é vazio quanto quando a URL existe mas a imagem
  falha de verdade ao carregar (achado real testando: um produto tinha
  link pra um CDN fora do ar e mostrava ícone de imagem quebrada do
  navegador — pior que não ter foto nenhuma). Fotos reais dependem de
  pedido feito aos fornecedores das marcas (Whiskas, Pedigree etc.) —
  decisão deliberada de não fazer scraping de varejista (Petz e
  similares) pra "resolver" isso: foto de produto é material com
  direito autoral do fotógrafo/varejista, não fica livre só por o
  produto em si ser genérico.

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
tipo_entrega, zona_id, observacoes)` (SECURITY DEFINER, migração
`checkout_site_proprio`, estendida em `entrega_site_proprio`):
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
- Suporta **retirada ou entrega**, ver seção própria abaixo.
- Validado via `SET ROLE authenticated` real simulando um cliente de
  verdade fazendo um pedido de 2 produtos com estoque real, depois
  desfeito (estoque restaurado, pedido de teste apagado).

Cliente só lê os próprios pedidos (`pedidos_cliente_le_proprio`/
`itens_pedido_cliente_le_proprio`, SELECT-only, mesmo padrão de
`clientes`) — necessário pra página de confirmação `/loja/[slug]/pedido/[id]`.

## Entrega e cálculo de frete

Reaproveita `zonas_entrega` (faixas de distância com preço, já existia,
usada até agora só pelo Gestor) e a mesma técnica do app Flutter
(`DistanciaService`): distância real de rota via Google Distance Matrix
API, não linha reta — mesma chave já usada lá, agora como
`GOOGLE_MAPS_API_KEY` **sem** prefixo `NEXT_PUBLIC_` (só roda no
servidor, nunca chega no bundle do browser — diferente do Flutter, onde
a chave inevitavelmente vai no APK).

- `atualizar_endereco_cliente` (SECURITY DEFINER, mesmo padrão de
  `entrar_ou_criar_cliente`) grava o endereço do cliente em `clientes`
  (colunas que já existiam, usadas até agora só pelo cadastro do Gestor).
- `calcular_frete_site(empresa_id, distancia_km, subtotal)` (SECURITY
  DEFINER, `stable`, liberado pra `anon` também) acha a zona que cobre a
  distância e já aplica frete grátis quando `subtotal >= valor_minimo_frete_gratis`
  — mesma lógica exata de `ZonaEntrega.cobreDistancia`/
  `opcao_entrega_screen.dart` no Gestor, replicada aqui.
- `src/lib/frete.ts` (marcado `import "server-only"`) monta os endereços
  no mesmo formato do `DistanciaService._montarEndereco`, chama a
  Distance Matrix API, e então `calcular_frete_site`.
- `finalizar_pedido_site` ganhou `p_tipo_entrega`/`p_zona_id`: **nunca
  aceita o valor do frete como número cru** — só um `zona_id`, que a
  função relê do banco (`zonas_entrega.valor`/`valor_minimo_frete_gratis`)
  e recalcula contra o `valor_produtos` real que ela mesma acabou de
  montar. Fecha o mesmo tipo de risco já tratado pro preço de produto:
  um cliente chamando a função direto (fora da UI) não consegue forçar
  frete grátis nem um valor arbitrário, só uma das faixas que o próprio
  lojista já configurou. **Gap conhecido e aceito**: nada impede tecnicamente
  esse mesmo cliente de escolher uma faixa mais barata que sua distância
  real — a distância só é verificada no Next.js (Google API), não dá pra
  reverificar dentro do Postgres sem uma chamada HTTP síncrona. Risco
  baixo (só desconta um pouco o frete, nunca zera preço de produto).
- Grava `pedidos.metadata->>'entregaSelecionada'` com o nome da zona só
  quando é entrega — é a chave que `Venda.temEntrega`
  (`valorEntrega > 0 || entregaSelecionada.isNotEmpty`) já lê no Gestor,
  necessária pra um pedido de entrega com frete grátis (`valorEntrega=0`)
  ainda ser reconhecido como entrega pelo app do lojista.
- Endereço da loja (`empresas.endereco/cidade/estado/cep`) agora também
  sai em `catalogo_empresas_publico` — seguro de expor (é o endereço de
  retirada, faz sentido o cliente ver de qualquer forma) e necessário
  como origem do cálculo de rota.
- **Achado, não corrigido aqui**: `CarrinhoProvider.entregaSelecionadaId`
  no Gestor tem fallback `'Retirada na Loja'` (string não-vazia) mesmo
  pra pedidos sem entrega — o que faz `temEntrega` avaliar `true` também
  pra retirada nesse fluxo específico (bug pré-existente, não deste
  site). Aqui não escrevo `entregaSelecionada` pra retirada, seguindo a
  convenção correta (a mesma que a ingestão do iFood já usa).
- Testado ao vivo, ponta a ponta, via `SET ROLE authenticated`: endereço
  salvo, frete calculado e cobrado certo (`R$4,99` pra 2km/subtotal
  R$2,99, frete grátis pra subtotal ≥ R$30), pedido sem endereço rejeitado
  corretamente. Chamada real à Distance Matrix API confirmada funcionando
  fora do fluxo do site também (curl direto).
- **Sem CEP-autocomplete** (ViaCEP, que o Gestor já usa) — formulário de
  endereço é só campos de texto simples por enquanto.

## Pagamento (Pix)

Sem gateway/API de pagamento nenhuma — Pix BR Code é um **padrão público
do Banco Central** (EMV/TLV), dá pra gerar o QR/copia-e-cola sozinho, sem
integrar com ninguém. `src/lib/pix.ts` monta o payload (`gerarPixCopiaECola`)
e `qrcode` (npm) renderiza a imagem. Mostrado em `/loja/[slug]/pedido/[id]`
quando `tipo_pagamento === 'Pix'` e o pedido ainda não está pago.

- **Bem mais completo que o que já existe no Gestor hoje** — a tela de
  Pix do app (`pagamento_pix_screen.dart`) só mostra a chave crua com
  botão de copiar (o próprio código comenta "aqui você pode gerar QR
  code Pix ou lógica real de pagamento"), nunca chegou a gerar um BR
  Code de verdade. Aqui gera.
- **Confirmação continua manual** — não existe webhook/gateway avisando
  quando o Pix realmente caiu; o lojista confirma o pagamento no Gestor
  do jeito que já faz hoje pra venda presencial em Pix. O QR só carrega
  os dados de recebimento (chave, nome, cidade, valor, um txid com o
  número do pedido pra facilitar conferência manual).
- **CRC16 validado contra o vetor de teste padrão** (CRC-16/CCITT-FALSE
  de `"123456789"` = `29B1`, conhecido/publicado) antes de confiar na
  implementação — a estrutura de campos (TLV, GUI `BR.GOV.BCB.PIX`,
  método de iniciação estático) foi conferida contra duas fontes
  independentes e o payload final foi verificado campo a campo à mão
  (cada tamanho declarado bate com o valor real) com a chave Pix real
  da empresa.
- `chave_pix` agora também sai em `catalogo_empresas_publico` — não é
  segredo, é exatamente o dado que a loja quer que quem for pagar veja
  (mesmo raciocínio do WhatsApp/endereço já expostos).
- Nome/cidade da loja são normalizados (maiúsculo, sem acento, cortado
  no tamanho máximo do campo EMV) antes de entrar no payload — exigência
  do padrão, não é escolha de formatação.

## O que falta (nessa ordem provável)

1. ~~Identidade do cliente final~~ — **feito**, ver acima (pendente só a
   configuração do provedor de mensagem, que é do usuário).
2. ~~Carrinho~~ — **feito**, ver acima.
3. ~~Checkout / criação de pedido~~ — **feito**, ver acima.
4. ~~Entrega com cálculo de frete~~ — **feito**, ver acima.
5. ~~Pagamento (Pix)~~ — **feito**, ver acima. Falta só uma confirmação
   automática de recebimento (exigiria gateway/webhook — Mercado Pago,
   Asaas etc — não construído, decisão deliberada de não adicionar mais
   uma conta/API externa por ora).
6. ~~Restringir `images.remotePatterns`~~ — **feito**. Checado contra os
   dados reais (939 produtos, 2026-07-24): só 2 aparecem com
   `imagem_url` preenchida, hospedadas em exatamente 2 domínios —
   Supabase Storage (hostname resolvido de `NEXT_PUBLIC_SUPABASE_URL`,
   restrito a `/storage/v1/object/public/**`) e `imagens.lukz.com.br`
   (CDN próprio). Qualquer host novo precisa ser adicionado aqui
   explicitamente — testado ao vivo: host desconhecido → `400`
   (rejeitado pelo Next), os dois hosts reais → aceitos pela regra.
   **Achado à parte, não é bug daqui**: a imagem em `imagens.lukz.com.br`
   está com certificado SSL inválido (curl recusa por padrão) *e*
   retorna `404` mesmo ignorando o certificado — arquivo realmente
   quebrado no CDN do usuário, fora do meu alcance corrigir.
