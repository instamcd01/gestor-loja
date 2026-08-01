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
- Confirmar de onde vem exatamente o dado de "desconto Pix" mostrado no card de benefício (existe em algum campo de `empresas` hoje? conferir antes de codar).
- Decidir se o bottom tab bar mobile substitui a navegação atual ou convive com ela.
- Asset da imagem hero: decisão do usuário (foto própria vs. ilustração encomendada vs. manter placeholder por enquanto) — não bloqueia o resto do redesign, mas precisa de um dono.
