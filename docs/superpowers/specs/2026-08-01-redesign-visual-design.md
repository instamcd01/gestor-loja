# Redesign visual do gestor-loja — spec de design

**Data**: 2026-08-01
**Status**: aprovado pelo usuário via brainstorming com companion visual, aguardando revisão da spec escrita

## Objetivo

Substituir o visual genérico Tailwind atual (autoavaliação do próprio usuário: "não está no nível Amazon/iFood") por uma identidade visual própria e diferenciada, cobrindo todas as telas do storefront numa única leva.

## Como chegamos aqui (histórico da decisão)

O processo de brainstorming passou por duas direções antes de convergir:

1. **Warm Editorial** (validada primeiro via mockup): paleta creme quente, serif Fraunces nos títulos + Inter no corpo, ícones placeholder em círculo com gradiente suave na cor da marca. O usuário gostou, mas pediu em seguida por algo "mais moderno, que traga uma experiência diferenciada" — foram exploradas 3 variações mais ousadas (Bento Editorial, Dark Boutique, Organic Motion), todas mantendo a base Warm Editorial.
2. **Pivô explícito para "Bold Trusted Marketplace"**: o usuário trouxe duas imagens de referência (geradas por IA) no estilo de marketplace grande — azul/laranja, hero fotográfico grande, cards de benefício coloridos, badges de promoção, mascote ilustrado — e pediu para trocar de direção pra esse estilo, priorizando familiaridade/confiança sobre diferenciação editorial. Essa é a direção final validada.

Isso importa registrar porque **a decisão de tipografia mudou no meio do processo**: a serifada (Fraunces) fazia sentido pra Warm Editorial, mas foi abandonada quando a direção virou "bold marketplace" — a versão final é 100% Inter, sans-serif, pesos bold/black nos títulos.

## Direção visual final: Bold Trusted Marketplace

Validada em 3 rodadas de mockup (home em cards de produto isolados → PLP completa → home full desktop+mobile) via companion visual, com o usuário aprovando explicitamente ("acho que estamos no caminho") na última rodada.

### Elementos do sistema

- **Cor**: `--brand-primary`/`--brand-secondary` já injetadas por tenant (`layout.tsx`) seguem sendo a fonte de verdade — nada de cor fixa hardcoded. O hero usa um gradiente diagonal `brand-primary → tom mais escuro do mesmo matiz`. Fundo neutro geral mais frio (~`#F3F5F8`) que o atual (`#f6f6f8`), levemente mais "marketplace", menos "editorial".
- **Tipografia**: Inter em todos os pesos necessários (400/500/600/700/800/900), carregada via `next/font/google` (troca do atual Geist). Títulos de hero em 800/900, preços em 800, corpo em 400/500.
- **Hero**: full-bleed na cor de marca, título grande (2 linhas, uma palavra-chave destacada em cor de acento/secundária), subtítulo curto, 2 CTAs (ação primária + ação secundária tipo "ver como funciona"), chips de confiança inline (frete/Pix/etc — dados reais, não inventados), badge de prova social flutuante no canto da imagem hero.
- **Imagem/ilustração do hero**: **asset de conteúdo reservado, não construído nesta spec.** A referência do usuário usa fotografia real (pet + caixa de produtos) — não temos esse asset. A implementação inicial usa um painel reservado (mesmo ícone de placeholder do sistema, em escala grande) até a loja fornecer uma foto real ou uma ilustração customizada. Deve ser trivial trocar depois (um componente de imagem, não hardcoded no layout).
- **Cards de benefício**: faixa de 4 cards logo abaixo do hero, cada um com fundo pastel próprio (não necessariamente derivado da cor de marca — paleta fixa neutra: azul-claro, verde-claro, laranja-claro, roxo-claro) + ícone + texto curto. Conteúdo real disponível hoje: frete mínimo, desconto Pix (`empresas` já tem esse dado em outro lugar do fluxo de checkout — confirmar campo exato antes de implementar), "compre e ganhe"/fidelidade **não existem como feature ainda** — se emplacados como card, precisam ou virar features reais ou sair da lista (ver seção "Fora de escopo").
- **Ícones placeholder de produto**: mantém a lógica de mapeamento por categoria já existente em `produto-placeholder.tsx` (7 ícones, ~96% de cobertura) — só o tratamento visual do container muda (círculo/chip tintado na paleta nova, consistente entre home/PLP/PDP). Não é "aviso de foto faltando", é elemento de marca — mesma filosofia já decidida antes desta sessão, só re-skinnado pro novo sistema.
- **Badges de produto**: só `% OFF` derivado de `preco_promocional < preco` (dado real, já existe). **Sem estrelas de avaliação, sem "3x sem juros"** — nenhum dos dois existe no sistema hoje (sem reviews, sem gateway de cartão) e mostrar isso pro cliente seria uma promessa que não se cumpre no checkout. Confirmado explicitamente com o usuário nesta sessão.
- **Navegação**: mantém a estrutura de departamentos já construída (`NavCategorias`, 6 departamentos) — só aplica o novo skin visual, a lógica de agrupamento não muda.
- **Filtros (PLP)**: sidebar de marca + faixa de preço, reaproveitando os componentes já existentes (`filtro-marca.tsx`, `filtro-preco.tsx`) — só reskin.

### Mobile (padrão obrigatório em toda tela deste redesign)

- Header compacto: logo + hambúrguer + carrinho, busca vira campo de largura total abaixo.
- Categorias/departamentos: chips com scroll horizontal em vez de menu, já que a maioria dos clientes compra pelo celular (instrução explícita do usuário).
- Grid de produto: 2 colunas em vez de 3-4.
- Navegação inferior fixa (bottom tab bar: Início/Buscar/Carrinho/Conta) — padrão nativo de app, facilita alcance com o polegar. É uma mudança estrutural nova (hoje não existe), avaliar se substitui ou convive com o header sticky atual.
- Cards de benefício: scroll horizontal em vez de grid 4 colunas.

## Fora de escopo desta spec (identificado durante o brainstorming, não construir aqui)

- **Botão flutuante de WhatsApp de suporte**: ideia nova que surgiu durante os mockups, reaproveitaria a infra de WhatsApp já existente (ver [[gestor_ifood_integration_architecture]] / memória do site). É uma feature funcional (precisa de link/webhook real), não um token visual — merece task própria.
- **Badge "Mais vendido"**: precisaria expor `produtos.score_vendas` (hoje deliberadamente oculto de `catalogo_produtos_publico` por ser dado sensível/competitivo) via uma view nova e estreita. Decisão de produto separada, não incluir nesta leva.
- **Programa de fidelidade / "compre e ganhe"**: aparece nos cards de benefício de referência, mas não existe como feature no sistema. Se o usuário quiser manter esses cards no design final, precisam virar promessas reais (nova feature) ou o conteúdo do card muda pra algo que já existe hoje.
- **Sistema de avaliações/reviews**: não existe, não fabricar dado na UI.

## Dados: tudo vem das configurações do Gestor (achado real no código, não suposição)

Instrução explícita do usuário: nenhum conteúdo do redesign deve ficar hardcoded no Next.js se ele representa algo que varia por loja — tem que vir de configuração real, editável pelo lojista no app Gestor.

Fui checar o código do Gestor (`lib/screens/catalogo_online_screen.dart`, `lib/models/modelo_visual.dart`, `lib/providers/branding_provider.dart`) antes de assumir o que já existe:

- **`empresas.catalogo_modelo` já existe** — campo de texto simples, hoje só com a opção "Clássico" no dropdown de Configurações > Catálogo Online (comentário no próprio arquivo, desatualizado, ainda diz "o site em si ainda não existe"). **Este é o lugar certo para esta redesign virar uma opção nova selecionável** (ex: adicionar `'moderno'` como segundo valor do dropdown) — não precisa forçar a Delivery Pet nem nenhum tenant existente a migrar, cada loja escolhe. Simples o suficiente pra não precisar de uma tabela nova — é só um switch de qual conjunto de tokens CSS aplicar.
- **Existe um sistema irmão, mas é outra coisa**: `modelos_visuais` (tabela catálogo compartilhado) + `empresas.modelo_visual_id` + `BrandingProvider` controlam o tema do **app Gestor interno** (a UI que o lojista usa pra gerenciar o negócio), não o site do cliente. Não confundir os dois — mas vale reaproveitar os valores padrão de lá como ponto de partida dos tokens do site (ver seção de portabilidade abaixo).
- **Dados já configuráveis hoje e usados de verdade no redesign**: `cor_primaria`/`cor_secundaria`, `logo_url`, `catalogo_slug`, `whatsapp_catalogo`, `instagram`/`facebook`, `catalogo_info_extra`, endereço (retirada), métodos de pagamento ativos, `chave_pix`, `zonas_entrega.valor_minimo_frete_gratis`.
- **Não existe hoje, confirmado por grep no repo do Gestor** (não é suposição): nenhum campo de desconto percentual no Pix em lugar nenhum. O card "5% OFF no Pix" dos mockups era ilustrativo, copiado da referência do usuário, não um dado real. Duas opções pro plano: (a) criar `empresas.desconto_pix_percentual` + campo novo em Configurações, ou (b) tirar esse card específico da versão inicial. Decisão fica pro `writing-plans`, não pra esta spec.
- **Título/subtítulo do hero**: mesma lógica — ou fica um texto fixo por enquanto (aceitável, não é uma "promessa" variável tipo desconto), ou vira um campo novo (`catalogo_hero_titulo`?) se o usuário quiser cada loja escrevendo o próprio. Marcado como decisão em aberto abaixo.

## Portabilidade pro futuro app cliente (Flutter)

O usuário confirmou que vai construir uma versão app do site depois — consistente com o objetivo de longo prazo já registrado neste projeto (site + app cliente + app entregador, próprios, pra reduzir dependência do iFood). Isso muda como as decisões de mobile web devem ser tomadas: não só "o que funciona bem no navegador", mas "o que já nasce fácil de replicar em Flutter depois". Decisões do redesign ajustadas com isso em mente:

- **Inter como tipografia única (não serifada)**: além de combinar com o pivô pra "Bold Trusted Marketplace", Inter já é a fonte padrão do próprio app Gestor (`ModeloVisual.fonte` default `'Inter'`) — mantém uma única identidade tipográfica entre os três front-ends (Gestor interno, site, futuro app cliente) em vez de cada um inventar a própria.
- **Escala de raio alinhada aos valores já usados no app interno** (`radiusCard: 16`, `radiusBotao: 12`, `radiusChip: 8` são os defaults de `ModeloVisual`) como ponto de partida dos tokens do site, em vez de números novos escolhidos a dedo — menos retrabalho de "tradução" quando o app cliente for construído.
- **Bottom tab bar + chips de categoria com scroll horizontal no mobile web**: escolha reforçada por essa notícia, não só uma preferência de UX — é literalmente o padrão de navegação nativo que o futuro app vai usar, então a versão web já acostuma o cliente a esse padrão de interação em vez de ensinar dois paradigmas diferentes.
- **Evitar efeitos puramente web sem equivalente direto em Flutter** (hover-only interactions, cortes CSS elaborados tipo `clip-path`) — reforça a decisão já tomada de descartar a linha "Organic Motion" (blob shapes, corte diagonal) em favor do "Bold Trusted Marketplace", que usa formas retangulares/pill simples, diretamente traduzíveis pra widgets Flutter.
- **Fonte de cor já é literalmente compartilhada**: `--brand-primary`/`--brand-secondary` do site e `cor_primaria`/`cor_secundaria` do app Gestor já são as mesmas colunas de `empresas` — zero trabalho extra de sincronização, já é uma fonte única hoje.

## Abordagem de execução (Approach A, aprovada)

1. **Tokens primeiro**: estender `globals.css`/`@theme` com a nova tipografia (Inter via `next/font`), paleta neutra (`#F3F5F8` etc), tokens dos cards de benefício, mantendo a escala de raio/sombra que já existe onde ainda fizer sentido.
2. **Validar tokens contra pelo menos 2 combinações de cor de marca** diferentes da Delivery Pet (azul/laranja combina por sorte com o estilo "marketplace" — precisa confirmar que uma loja com verde ou roxo como cor primária não quebra visualmente) antes de seguir.
3. **Aplicar tela por tela**, nesta ordem, com checkpoint de build+lint+screenshot (desktop e mobile) a cada uma antes de seguir pra próxima:
   - Header/nav (`layout.tsx`)
   - Home (hero + benefícios + marcas) — tela nova, hoje não existe uma home distinta do catálogo raiz; avaliar em plano se vira rota própria ou é o topo de `/loja/[slug]`
   - Catálogo/PLP (grid + filtros + departamentos)
   - Página de produto (PDP)
   - Carrinho/checkout
   - Confirmação de pedido/Pix
   - Login/conta
4. **Verificação**: mesma disciplina já estabelecida neste projeto — `npm run build`/`lint` limpos não bastam sozinhos (já causaram bugs visuais não pegos antes), sempre confirmar com Playwright screenshot real (`next build && next start`, não `next dev`, dado o histórico de bugs de middleware específicos desse comando neste repo) em pelo menos 2 breakpoints (desktop + 375px mobile) por tela.

## Riscos/decisões em aberto pro plano de implementação

- Definir se a home vira rota nova (`/loja/[slug]` atual já é o catálogo raiz) ou se o hero é injetado como uma seção acima da grade existente.
- **Confirmado por grep no Gestor: não existe campo de "desconto Pix" hoje.** Decidir no plano: criar `empresas.desconto_pix_percentual` + tela em Configurações, ou tirar esse card específico da primeira leva.
- Decidir se o título/subtítulo do hero fica fixo por enquanto ou vira campo configurável novo (`catalogo_hero_titulo`?) — impacto direto em precisar ou não de uma tela nova no Gestor.
- Decidir o valor exato do novo item do dropdown `catalogo_modelo` (ex: `'moderno'`) e confirmar no plano como o Next.js lê esse campo pra decidir qual conjunto de tokens aplicar por tenant.
- Decidir se o bottom tab bar mobile substitui a navegação atual ou convive com ela.
- Asset da imagem hero: decisão do usuário (foto própria vs. ilustração encomendada vs. manter placeholder por enquanto) — não bloqueia o resto do redesign, mas precisa de um dono.
