# Redesign Visual — Fase 1 (Tokens + Header/Nav + Home) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ligar um segundo modelo visual ("Bold Trusted Marketplace") no site `gestor-loja`, selecionável por tenant via `empresas.catalogo_modelo = 'moderno'` (campo e opção de UI já existem no Gestor — só o site nunca lia), cobrindo header/navegação e a home (hero + benefícios + marcas parceiras), sem alterar em nada a aparência de quem continua em `'classico'`.

**Architecture:** Sistema híbrido de dois mecanismos, cada um usado onde faz mais sentido:
1. **Tokens via CSS custom properties**, escopados pelo atributo `data-modelo="moderno"` no wrapper do tenant (`loja/[slug]/layout.tsx`) — cobre cor de fundo, tipografia (Inter em vez de Geist) e o tratamento do ícone placeholder. Cascade automático, zero prop drilling.
2. **Prop booleana explícita `moderno`**, passada dos poucos pontos que já têm `empresa` em escopo (`page.tsx`, `layout.tsx`) pros componentes cuja estrutura (não só cor) muda entre os dois modelos — hero com 2 CTAs, cards de benefício em bloco pastel grande em vez de linha fina. Mais simples e legível que forçar toda diferença estrutural a virar truque de CSS.

**Tech Stack:** Next.js 16 (App Router, Server Components), Tailwind CSS v4 (`@theme inline`), TypeScript, Supabase (view `catalogo_empresas_publico` já expõe `catalogo_modelo`, confirmado no código, sem migração necessária).

## Global Constraints

- **Sem framework de teste unitário neste projeto** (confirmado: `package.json` não tem jest/vitest/testing-library) — a disciplina de verificação já estabelecida aqui é `npm run build` + `npm run lint` limpos **e** captura de screenshot real via Playwright (`next build && next start`, nunca `next dev` — bug de middleware documentado neste repo faz `next dev` mentir sobre certas mudanças). Cada task usa esse fluxo no lugar de "rodar o teste".
- **`'classico'` não pode mudar visualmente nem um pixel** — é o modelo em produção hoje (tenant real "Delivery Pet" ativo). Toda mudança de token é escopada a `[data-modelo="moderno"]`; toda mudança estrutural é condicionada à prop `moderno === true`.
- **Nenhum dado inventado**: badges/cards só mostram o que vem de campos reais já existentes (`freteGratisMinimo`, `metodosPagamento`, `marca`, `preco_promocional`). Sem estrelas, sem "3x sem juros", sem "+2000 pets felizes" fabricado.
- **Não editar o app Gestor (Flutter) nesta fase** — a opção `'moderno'` já existe no dropdown (`catalogo_online_screen.dart:225`), não precisa de nenhuma mudança lá.
- Node/`npm` já configurados no repo; `sharp` já é dependência real. Instalar Playwright com `--no-save` (mesmo padrão já usado antes neste repo, ver README/histórico) — não persistir em `package.json`.
- Testar `catalogo_modelo = 'moderno'` durante o desenvolvimento numa empresa de teste (não a Delivery Pet em produção) — criar/reaproveitar um tenant de teste via SQL direto (mesmo padrão de dado sintético já usado neste projeto, sempre limpo ao final de cada task que o criar).
- **Escala de raio não muda nesta fase, de propósito**: `--radius-lg`/`--radius-md`/`--radius-sm` já valem 16px/12px/8px em `globals.css`, os mesmos defaults do sistema de tema do app Gestor interno (`ModeloVisual.radiusCard`/`radiusBotao`/`radiusChip`) — coincidência boa, não precisa de token novo pra isso.

---

## File Structure

**Novos arquivos:**
- `scripts/screenshot.mjs` — script Playwright reutilizável (recebe URL + nome, salva screenshot desktop 1280px e mobile 375px em `.superpowers/screenshots/`)
- `src/components/loja/marcas-parceiras.tsx` — faixa "As melhores marcas", dado real via `getMarcasComContagem`

**Modificados:**
- `src/app/globals.css` — bloco `[data-modelo="moderno"]` com os novos tokens
- `src/app/layout.tsx` — carrega `Inter` via `next/font/google` ao lado de `Geist`
- `src/app/loja/[slug]/layout.tsx` — adiciona `data-modelo={empresa.catalogo_modelo}` no wrapper
- `src/app/loja/[slug]/page.tsx` — passa `moderno` pros componentes que precisam, renderiza `MarcasParceiras`
- `src/components/produto-placeholder.tsx` — troca gradiente/raio hardcoded por CSS vars escopáveis
- `src/components/loja/hero-banner.tsx` — recebe prop `moderno`, estrutura bold quando true
- `src/components/selos-confianca.tsx` — recebe prop `moderno`, cards pastel grandes quando true
- `src/components/loja/clube-em-breve.tsx` — recebe prop `moderno`, reskin leve
- `src/components/loja/nav-categorias.tsx` — recebe prop `moderno`, pills maiores/bold
- `src/components/produto-card.tsx` — recebe prop `moderno`, tipografia de preço mais bold

---

### Task 1: Harness de verificação visual (Playwright ad-hoc)

**Files:**
- Create: `scripts/screenshot.mjs`
- Modify: nenhum

**Interfaces:**
- Produces: `node scripts/screenshot.mjs <url> <nome>` — salva `.superpowers/screenshots/<nome>-desktop.png` (1280×900) e `.superpowers/screenshots/<nome>-mobile.png` (375×812)

- [ ] **Step 1: Instalar Playwright sem persistir no package.json**

Run: `npm install --no-save playwright && npx playwright install chromium`
Expected: instala sem erro, `node_modules/playwright` existe

- [ ] **Step 2: Criar o script de screenshot**

```js
// scripts/screenshot.mjs
import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";

const [, , url, nome] = process.argv;
if (!url || !nome) {
  console.error("Uso: node scripts/screenshot.mjs <url> <nome>");
  process.exit(1);
}

await mkdir(".superpowers/screenshots", { recursive: true });

const browser = await chromium.launch();

const desktop = await browser.newPage({ viewport: { width: 1280, height: 900 } });
await desktop.goto(url, { waitUntil: "networkidle" });
await desktop.screenshot({ path: `.superpowers/screenshots/${nome}-desktop.png`, fullPage: true });
await desktop.close();

const mobile = await browser.newPage({ viewport: { width: 375, height: 812 } });
await mobile.goto(url, { waitUntil: "networkidle" });
await mobile.screenshot({ path: `.superpowers/screenshots/${nome}-mobile.png`, fullPage: true });
await mobile.close();

await browser.close();
console.log(`Salvo: ${nome}-desktop.png e ${nome}-mobile.png`);
```

- [ ] **Step 3: Build de produção e captura da baseline (modelo 'classico', antes de qualquer mudança)**

Run:
```bash
npm run build && npm run start &
sleep 3
node scripts/screenshot.mjs http://localhost:3000/loja/delivery-pet baseline-classico
kill %1
```
Expected: `npm run build` limpo, dois PNGs salvos em `.superpowers/screenshots/baseline-classico-*.png`, sem erro 404/500 no console do Playwright

- [ ] **Step 4: Commit**

```bash
git add scripts/screenshot.mjs
git commit -m "chore: adiciona script de screenshot Playwright pra verificação visual"
```

---

### Task 2: Criar tenant de teste com `catalogo_modelo = 'moderno'`

**Files:** nenhum arquivo de código — só SQL via MCP Supabase, documentado aqui pra rastreabilidade

**Interfaces:**
- Produces: uma empresa real no banco com `catalogo_slug = 'loja-teste-moderno'`, `catalogo_ativo = true`, `catalogo_modelo = 'moderno'`, `cor_primaria`/`cor_secundaria` **diferentes** da Delivery Pet (ex: verde `#16A34A`/roxo `#7C3AED` — combinação deliberadamente distante de azul/laranja, pra estressar o sistema de tokens contra uma marca que não combina por sorte com a paleta "marketplace")
- Produtos: reaproveitar os mesmos produtos da Delivery Pet **não é possível** (produtos são escopados por `empresa_id`) — inserir 6-8 produtos sintéticos mínimos (nome, categoria, preço, sem imagem — testa o placeholder de propósito) só pra ter o que renderizar na grade

- [ ] **Step 1: Criar a empresa de teste**

Executar via `execute_sql` (MCP Supabase):
```sql
insert into empresas (nome, catalogo_slug, catalogo_ativo, catalogo_modelo, cor_primaria, cor_secundaria, aceita_pedidos_online, metodos_pagamento_ativos)
values ('Loja Teste Moderno', 'loja-teste-moderno', true, 'moderno', '#16A34A', '#7C3AED', true, array['Pix'])
returning id;
```
Expected: retorna um `id` — guardar pro próximo step

- [ ] **Step 2: Inserir produtos sintéticos mínimos**

```sql
insert into produtos (empresa_id, nome, categoria, preco, preco_promocional, ativo, exibir_no_catalogo)
values
  ('<id-da-empresa>', 'Ração Teste Cães 15kg', 'Ração', 179.90, 159.90, true, true),
  ('<id-da-empresa>', 'Petisco Teste 500g', 'Petiscos', 24.90, null, true, true),
  ('<id-da-empresa>', 'Sachê Teste 85g', 'Sachês', 5.49, null, true, true),
  ('<id-da-empresa>', 'Suplemento Teste 60 Cáps', 'Farmácia', 89.90, null, true, true),
  ('<id-da-empresa>', 'Areia Teste 4kg', 'Higiene', 32.90, null, true, true),
  ('<id-da-empresa>', 'Shampoo Teste 500ml', 'Higiene', 28.90, null, true, true);
```
Expected: 6 linhas inseridas

- [ ] **Step 3: Confirmar visualmente que a view pública já retorna os dados corretos**

Run via `execute_sql`: `select * from catalogo_empresas_publico where catalogo_slug = 'loja-teste-moderno';`
Expected: retorna a linha, `catalogo_modelo = 'moderno'`

Não commitar nada neste task (é dado, não código) — anotar o `id` da empresa de teste num comentário no topo do Task 3 pra reuso nas próximas tasks.

---

### Task 3: Tokens escopados — fonte Inter + fundo do modelo "moderno"

**Files:**
- Modify: `src/app/layout.tsx`
- Modify: `src/app/globals.css`
- Modify: `src/app/loja/[slug]/layout.tsx:28-37` (adiciona `data-modelo`)

**Interfaces:**
- Consumes: `empresa.catalogo_modelo` (já existe em `EmpresaCatalogo`, `src/lib/types.ts:11`)
- Produces: atributo `data-modelo` no DOM (`"classico"` ou `"moderno"`) + CSS var `--font-inter` disponível globalmente + `--background`/`--surface` sobrescritos dentro do escopo moderno

- [ ] **Step 1: Carregar Inter ao lado de Geist**

Em `src/app/layout.tsx`, editar:

```tsx
import type { Metadata } from "next";
import { Geist, Geist_Mono, Inter } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
});
```

E no `className` do `<html>`:
```tsx
      className={`${geistSans.variable} ${geistMono.variable} ${inter.variable} h-full antialiased`}
```

- [ ] **Step 2: Adicionar o bloco de tokens do modelo "moderno" em globals.css**

Adicionar ao final de `src/app/globals.css`:

```css
/* Modelo "moderno" (Bold Trusted Marketplace) — escopado via data-modelo
   no wrapper do tenant em loja/[slug]/layout.tsx. 'classico' (padrão,
   inclusive fora de escopo de tenant) não é afetado por este bloco. */
[data-modelo="moderno"] {
  --background: #f3f5f8;
  --surface: #ffffff;
  font-family: var(--font-inter), Arial, Helvetica, sans-serif;

  --placeholder-bg: color-mix(in srgb, var(--brand-primary) 14%, white);
  --placeholder-radius: 9999px;

  --benefit-blue-bg: #e9f2ff;
  --benefit-blue-fg: #0068c9;
  --benefit-green-bg: #e9f8ea;
  --benefit-green-fg: #1f8a2c;
  --benefit-orange-bg: #fff1e6;
  --benefit-orange-fg: #c9560f;
}

@media (prefers-color-scheme: dark) {
  [data-modelo="moderno"] {
    --background: #16181c;
    --surface: #1f2228;
  }
}
```

- [ ] **Step 3: Aplicar `data-modelo` no wrapper do tenant**

Em `src/app/loja/[slug]/layout.tsx`, linha 28-37, editar o `<div>` raiz:

```tsx
  return (
    <div
      data-modelo={empresa.catalogo_modelo}
      style={
        {
          "--brand-primary": corPrimaria,
          "--brand-secondary": corSecundaria,
        } as React.CSSProperties
      }
      className="flex min-h-screen flex-col"
    >
```

- [ ] **Step 4: Verificar build limpo e captura visual — modelo classico não deve ter mudado**

Run:
```bash
npm run build && npm run lint
```
Expected: ambos limpos, zero warning novo

```bash
npm run start &
sleep 3
node scripts/screenshot.mjs http://localhost:3000/loja/delivery-pet check-classico-inalterado
node scripts/screenshot.mjs http://localhost:3000/loja/loja-teste-moderno check-moderno-tokens
kill %1
```
Expected: `check-classico-inalterado-*.png` visualmente idêntico a `baseline-classico-*.png` do Task 1 (mesma cor de fundo cinza, mesma fonte Geist); `check-moderno-tokens-*.png` já mostra fundo `#f3f5f8` e fonte Inter na loja de teste, mesmo com o resto do layout ainda igual (só tokens aplicados até aqui, componentes ainda não foram reskinados — isso é esperado neste checkpoint)

- [ ] **Step 5: Commit**

```bash
git add src/app/layout.tsx src/app/globals.css src/app/loja/\[slug\]/layout.tsx
git commit -m "feat: liga tokens do modelo 'moderno' (fonte Inter, fundo) escopados por tenant"
```

---

### Task 4: Reskin do ícone placeholder de produto

**Files:**
- Modify: `src/components/produto-placeholder.tsx:96-113`

**Interfaces:**
- Consumes: `--placeholder-bg`/`--placeholder-radius` (definidos no Task 3)
- Produces: nenhuma mudança de assinatura — `ProdutoPlaceholder({ categoria })` continua igual, só o CSS interno muda

- [ ] **Step 1: Trocar o gradiente/raio hardcoded por CSS vars**

Em `src/components/produto-placeholder.tsx`, substituir a função `ProdutoPlaceholder`:

```tsx
export function ProdutoPlaceholder({ categoria }: { categoria: string | null }) {
  const icone = detectarIcone(categoria);

  return (
    <div
      className="flex h-full w-full items-center justify-center rounded-[var(--placeholder-radius,0px)]"
      style={{
        background:
          "var(--placeholder-bg, linear-gradient(135deg, color-mix(in srgb, var(--brand-primary) 12%, transparent), color-mix(in srgb, var(--brand-secondary) 12%, transparent)))",
      }}
    >
      <IconeSvg
        tipo={icone}
        className="h-1/3 w-1/3 text-[var(--brand-primary)] opacity-70"
      />
    </div>
  );
}
```

Nota: os valores-padrão inline (`0px` pro raio, o gradiente original pro fundo) garantem que fora do escopo `[data-modelo="moderno"]` — incluindo o modelo `'classico'` — o comportamento visual continua idêntico ao de hoje, já que essas CSS vars só existem dentro daquele escopo.

- [ ] **Step 2: Verificar visualmente nos dois modelos**

Run (com servidor já rodando do task anterior, ou reiniciar):
```bash
npm run build && npm run start &
sleep 3
node scripts/screenshot.mjs http://localhost:3000/loja/delivery-pet check-classico-placeholder
node scripts/screenshot.mjs http://localhost:3000/loja/loja-teste-moderno check-moderno-placeholder
kill %1
```
Expected: `check-classico-placeholder` idêntico à baseline (ícone ainda em fundo gradiente suave, sem raio extra); `check-moderno-placeholder` mostra os ícones dos 6 produtos sintéticos em círculo cheio (não gradiente diagonal) — confirma visualmente, não só por leitura do CSS

- [ ] **Step 3: Commit**

```bash
git add src/components/produto-placeholder.tsx
git commit -m "feat: placeholder de produto usa raio/fundo tokenizados, cheio no modelo moderno"
```

---

### Task 5: Reskin do HeroBanner (bold, CTA, prop `moderno`)

**Files:**
- Modify: `src/components/loja/hero-banner.tsx`
- Modify: `src/app/loja/[slug]/page.tsx:80` (passa a prop)

**Interfaces:**
- Consumes: nenhuma nova dependência externa
- Produces: `HeroBanner({ nome, tagline, moderno }: { nome: string; tagline: string | null; moderno: boolean })` — assinatura muda, precisa atualizar o único call site

- [ ] **Step 1: Reescrever HeroBanner com a variante bold**

```tsx
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";

export function HeroBanner({
  nome,
  tagline,
  moderno,
}: {
  nome: string;
  tagline: string | null;
  moderno: boolean;
}) {
  if (moderno) {
    return (
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[var(--brand-primary)] to-[color-mix(in_srgb,var(--brand-primary)_60%,black)] px-6 py-12 text-white sm:px-10 sm:py-16">
        <div className="pointer-events-none absolute top-6 right-16 h-24 w-24 rounded-full bg-white/8" />
        <div className="pointer-events-none absolute -bottom-10 left-1/3 h-32 w-32 rounded-full bg-white/6" />
        <div className="relative flex max-w-xl flex-col gap-4">
          <h1 className="text-3xl leading-[1.1] font-extrabold sm:text-5xl">
            Tudo para <span className="text-[var(--brand-secondary)]">seu pet</span>, entregue com carinho
          </h1>
          {tagline && <p className="max-w-md text-sm text-white/85 sm:text-base">{tagline}</p>}
          <ButtonLink
            href="#produtos"
            className="mt-2 w-fit bg-[var(--brand-secondary)] px-6 py-3.5 text-[15px] font-bold hover:opacity-90"
          >
            Ver produtos →
          </ButtonLink>
        </div>
      </div>
    );
  }

  return (
    <div className="relative overflow-hidden rounded-[var(--radius-xl)] bg-gradient-to-br from-[var(--brand-primary)] to-[var(--brand-secondary)] px-6 py-10 text-white shadow-sm sm:px-10 sm:py-14">
      <div className="pointer-events-none absolute -top-16 -right-16 h-56 w-56 rounded-full bg-white/10 blur-2xl" />
      <div className="pointer-events-none absolute -bottom-20 -left-10 h-64 w-64 rounded-full bg-black/10 blur-3xl" />
      <div className="relative flex max-w-xl flex-col gap-3">
        <Badge className="w-fit bg-white/15 text-white backdrop-blur">Loja oficial</Badge>
        <h1 className="text-2xl leading-tight font-bold sm:text-4xl">
          Tudo pro seu pet, direto na {nome}
        </h1>
        {tagline && <p className="text-sm text-white/85 sm:text-base">{tagline}</p>}
      </div>
    </div>
  );
}
```

Nota: `nome` fica sem uso na branch `moderno` de propósito (título fixo "Tudo para seu pet" em vez de interpolar o nome da loja) — decisão da spec: título do hero é texto fixo por enquanto, não campo configurável nesta fase. `id="produtos"` é o alvo do CTA — adicionado na grade de produtos no Task 6/9 desta mesma página.

- [ ] **Step 2: Atualizar o call site em page.tsx**

Em `src/app/loja/[slug]/page.tsx`, linha 80:

```tsx
      {!filtroAtivo && (
        <HeroBanner
          nome={empresa.nome}
          tagline={empresa.catalogo_info_extra}
          moderno={empresa.catalogo_modelo === "moderno"}
        />
      )}
```

- [ ] **Step 3: Adicionar o `id="produtos"` na âncora da grade**

Na mesma página, envolver o bloco que renderiza a grade de produtos (a partir da linha `{produtos.length === 0 ? (` até o fechamento) com `<div id="produtos">...</div>` — ou, mais simples, adicionar `id="produtos"` diretamente no `<div className="flex items-center justify-between gap-3">` que já existe logo antes da grade (linha 89), já que ele é o primeiro elemento visível da seção de produtos:

```tsx
      <div id="produtos" className="flex items-center justify-between gap-3">
```

- [ ] **Step 4: Verificar visualmente**

```bash
npm run build && npm run lint && npm run start &
sleep 3
node scripts/screenshot.mjs http://localhost:3000/loja/delivery-pet check-classico-hero
node scripts/screenshot.mjs http://localhost:3000/loja/loja-teste-moderno check-moderno-hero
kill %1
```
Expected: classico idêntico à baseline (badge "Loja oficial", título com nome da loja); moderno mostra título grande "Tudo para seu pet, entregue com carinho" com "seu pet" na cor secundária (roxo, no tenant de teste), botão "Ver produtos" na cor secundária

- [ ] **Step 5: Commit**

```bash
git add src/components/loja/hero-banner.tsx src/app/loja/\[slug\]/page.tsx
git commit -m "feat: hero bold com CTA no modelo moderno, classico inalterado"
```

---

### Task 6: Reskin do SelosConfianca (cards de benefício pastel)

**Files:**
- Modify: `src/components/selos-confianca.tsx`
- Modify: `src/app/loja/[slug]/page.tsx:82-85`

**Interfaces:**
- Produces: `SelosConfianca({ freteGratisMinimo, metodosPagamento, moderno })` — assinatura muda

- [ ] **Step 1: Reescrever com a variante de cards pastel**

```tsx
import { formatarPreco } from "@/lib/utils";

const paleta = {
  caminhao: { bg: "var(--benefit-blue-bg)", fg: "var(--benefit-blue-fg)" },
  loja: { bg: "var(--benefit-green-bg)", fg: "var(--benefit-green-fg)" },
  pix: { bg: "var(--benefit-orange-bg)", fg: "var(--benefit-orange-fg)" },
} as const;

export function SelosConfianca({
  freteGratisMinimo,
  metodosPagamento,
  moderno,
}: {
  freteGratisMinimo: number | null;
  metodosPagamento: string[] | null;
  moderno: boolean;
}) {
  const temPix = metodosPagamento?.includes("Pix") ?? false;

  const selos = [
    freteGratisMinimo != null && {
      titulo: `Frete grátis acima de ${formatarPreco(freteGratisMinimo)}`,
      icone: "caminhao" as const,
    },
    { titulo: "Retire na loja sem custo", icone: "loja" as const },
    temPix && { titulo: "Pagamento via Pix", icone: "pix" as const },
  ].filter((selo): selo is { titulo: string; icone: "caminhao" | "loja" | "pix" } => !!selo);

  if (selos.length === 0) return null;

  if (moderno) {
    return (
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {selos.map((selo) => {
          const cor = paleta[selo.icone];
          return (
            <div
              key={selo.titulo}
              className="rounded-2xl p-4"
              style={{ background: cor.bg }}
            >
              <div className="mb-2 flex h-9 w-9 items-center justify-center rounded-full bg-white/60">
                <IconeSelo tipo={selo.icone} className="h-4.5 w-4.5" style={{ color: cor.fg }} />
              </div>
              <p className="text-sm font-bold" style={{ color: cor.fg }}>
                {selo.titulo}
              </p>
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
      {selos.map((selo) => (
        <div
          key={selo.titulo}
          className="flex items-center gap-3 rounded-[var(--radius-lg)] border border-black/5 bg-[var(--surface)] px-4 py-3.5 shadow-[var(--shadow-card)] dark:border-white/10"
        >
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--brand-primary)]/10">
            <IconeSelo tipo={selo.icone} className="h-4.5 w-4.5 text-[var(--brand-primary)]" />
          </div>
          <span className="text-xs font-semibold">{selo.titulo}</span>
        </div>
      ))}
    </div>
  );
}

function IconeSelo({
  tipo,
  className,
  style,
}: {
  tipo: "caminhao" | "loja" | "pix";
  className?: string;
  style?: React.CSSProperties;
}) {
  const props = {
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.5,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    className,
    style,
  };

  switch (tipo) {
    case "caminhao":
      return (
        <svg {...props}>
          <path d="M2 8h11v9H2zM13 11h4l3 3v3h-7z" />
          <circle cx="6" cy="19" r="1.6" />
          <circle cx="16.5" cy="19" r="1.6" />
        </svg>
      );
    case "loja":
      return (
        <svg {...props}>
          <path d="M4 9.5 5 4h14l1 5.5" />
          <path d="M4 9.5a2.5 2.5 0 0 0 5 0 2.5 2.5 0 0 0 5 0 2.5 2.5 0 0 0 5 0" />
          <path d="M5 9.5V20h14V9.5" />
        </svg>
      );
    case "pix":
      return (
        <svg {...props}>
          <rect x="4" y="4" width="7" height="7" rx="1.5" />
          <rect x="13" y="4" width="7" height="7" rx="1.5" />
          <rect x="4" y="13" width="7" height="7" rx="1.5" />
          <rect x="13" y="13" width="7" height="7" rx="1.5" />
        </svg>
      );
  }
}
```

- [ ] **Step 2: Atualizar o call site**

Em `src/app/loja/[slug]/page.tsx`, linha 82-85:

```tsx
      <SelosConfianca
        freteGratisMinimo={freteGratisMinimo}
        metodosPagamento={empresa.metodos_pagamento_ativos}
        moderno={empresa.catalogo_modelo === "moderno"}
      />
```

- [ ] **Step 3: Verificar visualmente**

```bash
npm run build && npm run lint && npm run start &
sleep 3
node scripts/screenshot.mjs http://localhost:3000/loja/delivery-pet check-classico-selos
node scripts/screenshot.mjs http://localhost:3000/loja/loja-teste-moderno check-moderno-selos
kill %1
```
Expected: classico idêntico à baseline (linha fina de cards brancos); moderno mostra 2 cards grandes coloridos (frete e Pix — a loja de teste não tem zona de frete grátis configurada, então só 2 dos 3 selos aparecem, o que já é o comportamento correto e existente do filtro `selos.length === 0`)

- [ ] **Step 4: Commit**

```bash
git add src/components/selos-confianca.tsx src/app/loja/\[slug\]/page.tsx
git commit -m "feat: selos de confianca viram cards pastel grandes no modelo moderno"
```

---

### Task 7: Reskin do ClubeEmBreve

**Files:**
- Modify: `src/components/loja/clube-em-breve.tsx`
- Modify: `src/app/loja/[slug]/page.tsx:87`

**Interfaces:**
- Produces: `ClubeEmBreve({ nome, moderno })` — assinatura muda

- [ ] **Step 1: Reescrever com a variante moderno**

```tsx
import { Badge } from "@/components/ui/badge";

export function ClubeEmBreve({ nome, moderno }: { nome: string; moderno: boolean }) {
  if (moderno) {
    return (
      <div className="flex items-center gap-4 rounded-2xl p-5" style={{ background: "var(--benefit-orange-bg)" }}>
        <div
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white/60"
          style={{ color: "var(--benefit-orange-fg)" }}
        >
          <IconeEstrela className="h-5 w-5" />
        </div>
        <div className="flex-1">
          <p className="text-sm font-bold" style={{ color: "var(--benefit-orange-fg)" }}>
            Um jeito novo de economizar está chegando
          </p>
          <p className="text-xs opacity-70" style={{ color: "var(--benefit-orange-fg)" }}>
            Em breve, mais vantagens pra quem compra sempre na {nome}.
          </p>
        </div>
        <Badge variant="outline" className="shrink-0 border-current" style={{ color: "var(--benefit-orange-fg)" }}>
          Em breve
        </Badge>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-4 rounded-[var(--radius-lg)] border border-dashed border-[var(--brand-primary)]/40 bg-[var(--brand-primary)]/5 p-4 sm:p-5">
      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[var(--brand-primary)]/15 text-[var(--brand-primary)]">
        <IconeEstrela className="h-5 w-5" />
      </div>
      <div className="flex-1">
        <p className="text-sm font-semibold">Um jeito novo de economizar está chegando</p>
        <p className="text-xs text-black/50 dark:text-white/50">
          Em breve, mais vantagens pra quem compra sempre na {nome}.
        </p>
      </div>
      <Badge variant="outline" className="shrink-0">
        Em breve
      </Badge>
    </div>
  );
}

function IconeEstrela({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M12 3.5 14.4 9l6 .6-4.5 4 1.3 5.9L12 16.6 6.8 19.5l1.3-5.9-4.5-4 6-.6Z" />
    </svg>
  );
}
```

- [ ] **Step 2: Atualizar o call site**

Em `src/app/loja/[slug]/page.tsx`, linha 87:

```tsx
      {!filtroAtivo && <ClubeEmBreve nome={empresa.nome} moderno={empresa.catalogo_modelo === "moderno"} />}
```

- [ ] **Step 3: Verificar visualmente**

```bash
npm run build && npm run lint && npm run start &
sleep 3
node scripts/screenshot.mjs http://localhost:3000/loja/delivery-pet check-classico-clube
node scripts/screenshot.mjs http://localhost:3000/loja/loja-teste-moderno check-moderno-clube
kill %1
```
Expected: classico idêntico à baseline (borda tracejada); moderno mostra bloco sólido laranja pastel, mesmo texto "Em breve"

- [ ] **Step 4: Commit**

```bash
git add src/components/loja/clube-em-breve.tsx src/app/loja/\[slug\]/page.tsx
git commit -m "feat: clube em breve ganha reskin pastel no modelo moderno"
```

---

### Task 8: Componente novo — MarcasParceiras (dado real)

**Files:**
- Create: `src/components/loja/marcas-parceiras.tsx`
- Modify: `src/app/loja/[slug]/page.tsx`

**Interfaces:**
- Consumes: `getMarcasComContagem(empresaId)` (já existe, `src/lib/catalogo.ts:271`) — retorna `{ marca: string; total: number }[]`
- Produces: `MarcasParceiras({ marcas }: { marcas: { marca: string; total: number }[] })` — só renderiza quando `moderno` (chamado condicionalmente no call site, não recebe a prop)

- [ ] **Step 1: Criar o componente**

```tsx
// src/components/loja/marcas-parceiras.tsx
export function MarcasParceiras({ marcas }: { marcas: { marca: string; total: number }[] }) {
  const top = [...marcas].sort((a, b) => b.total - a.total).slice(0, 6);
  if (top.length === 0) return null;

  return (
    <div className="rounded-2xl bg-[var(--surface)] px-6 py-8 text-center">
      <h2 className="text-base font-extrabold">As melhores marcas</h2>
      <p className="mt-1 text-xs text-black/50 dark:text-white/50">
        Trabalhamos com marcas que seu pet já conhece e confia
      </p>
      <div className="mt-5 flex flex-wrap justify-center gap-2">
        {top.map((m) => (
          <span
            key={m.marca}
            className="rounded-full border border-black/10 bg-white px-4 py-2 text-xs font-bold dark:border-white/15 dark:bg-transparent"
          >
            {m.marca}
          </span>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Buscar `marcas` e renderizar condicionalmente em page.tsx**

`marcas` já é buscado na linha 65 do `page.tsx` (`getMarcasComContagem(empresa.id)`), reaproveitar a mesma variável — não precisa de nova query. Adicionar a renderização logo depois do bloco `<ClubeEmBreve />` (após linha 87):

```tsx
      {!filtroAtivo && <ClubeEmBreve nome={empresa.nome} moderno={empresa.catalogo_modelo === "moderno"} />}

      {!filtroAtivo && empresa.catalogo_modelo === "moderno" && <MarcasParceiras marcas={marcas} />}
```

E adicionar o import no topo do arquivo:
```tsx
import { MarcasParceiras } from "@/components/loja/marcas-parceiras";
```

- [ ] **Step 3: Verificar visualmente**

```bash
npm run build && npm run lint && npm run start &
sleep 3
node scripts/screenshot.mjs http://localhost:3000/loja/delivery-pet check-classico-marcas
node scripts/screenshot.mjs http://localhost:3000/loja/loja-teste-moderno check-moderno-marcas
kill %1
```
Expected: classico idêntico à baseline (sem faixa de marcas, componente nunca renderiza fora do moderno); moderno mostra a faixa "As melhores marcas" — como os produtos sintéticos do Task 2 não têm `marca` preenchida, o componente deve retornar `null` (não quebrar, não mostrar faixa vazia) — **se aparecer uma faixa vazia ou com erro, é bug, não prosseguir**. Pra testar de verdade com marcas reais, rodar o mesmo screenshot contra `delivery-pet` só que temporariamente com `catalogo_modelo` setado pra `'moderno'` via SQL, depois reverter:
```sql
update empresas set catalogo_modelo = 'moderno' where catalogo_slug = 'delivery-pet';
-- captura o screenshot aqui
update empresas set catalogo_modelo = 'classico' where catalogo_slug = 'delivery-pet';
```
Expected nesse teste extra: faixa de marcas real aparece com nomes reais (Golden, Quatree, etc.)

- [ ] **Step 4: Commit**

```bash
git add src/components/loja/marcas-parceiras.tsx src/app/loja/\[slug\]/page.tsx
git commit -m "feat: adiciona faixa de marcas parceiras (dado real) no modelo moderno"
```

---

### Task 9: Reskin do NavCategorias

**Files:**
- Modify: `src/components/loja/nav-categorias.tsx`
- Modify: `src/app/loja/[slug]/layout.tsx:77`

**Interfaces:**
- Produces: `NavCategorias({ departamentos, slug, moderno })` — assinatura muda

- [ ] **Step 1: Adicionar a prop e as classes condicionais**

Em `src/components/loja/nav-categorias.tsx`, trocar a assinatura da função e a função `linkClasse` (`subLinkClasse`, mostrada mais abaixo, **não muda** — só reproduzida aqui pra deixar claro que continua no arquivo):

```tsx
export function NavCategorias({
  departamentos,
  slug,
  moderno,
}: {
  departamentos: DepartamentoComContagem[];
  slug: string;
  moderno: boolean;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const destino = `/loja/${slug}`;
  const noCatalogo = pathname === destino;
  const departamentoAtivo = noCatalogo ? searchParams.get("departamento") : null;
  const categoriaAtiva = noCatalogo ? searchParams.get("categoria") : null;
  const temBusca = noCatalogo && !!searchParams.get("q");

  if (departamentos.length === 0) return null;

  const deptAtivo = departamentos.find((d) => d.nome === departamentoAtivo);

  return (
    <div className="border-t border-black/5 dark:border-white/10">
      <nav className="mx-auto flex max-w-6xl gap-1 overflow-x-auto px-4">
        <Link href={destino} className={linkClasse(!departamentoAtivo && !temBusca, moderno)}>
          Todos
        </Link>
        {departamentos.map((d) => (
          <Link
            key={d.nome}
            href={`${destino}?departamento=${encodeURIComponent(d.nome)}`}
            className={linkClasse(departamentoAtivo === d.nome, moderno)}
          >
            {d.nome}
          </Link>
        ))}
      </nav>

      {deptAtivo && deptAtivo.categorias.length > 1 && (
        <nav className="mx-auto flex max-w-6xl items-center gap-1.5 overflow-x-auto border-t border-black/5 px-4 py-1.5 dark:border-white/10">
          <Link
            href={`${destino}?departamento=${encodeURIComponent(deptAtivo.nome)}`}
            className={subLinkClasse(!categoriaAtiva)}
          >
            Tudo em {deptAtivo.nome}
          </Link>
          {deptAtivo.categorias.map(({ categoria }) => (
            <Link
              key={categoria}
              href={`${destino}?departamento=${encodeURIComponent(deptAtivo.nome)}&categoria=${encodeURIComponent(categoria)}`}
              className={subLinkClasse(categoriaAtiva === categoria)}
            >
              {categoria}
            </Link>
          ))}
        </nav>
      )}
    </div>
  );
}

function linkClasse(ativo: boolean, moderno: boolean) {
  const pesoFonte = moderno ? "font-bold" : "font-medium";
  return `shrink-0 border-b-2 px-3 py-2.5 text-sm ${pesoFonte} whitespace-nowrap transition-colors ${
    ativo
      ? "border-[var(--brand-primary)] text-[var(--brand-primary)]"
      : "border-transparent text-black/60 hover:text-black/90 dark:text-white/60 dark:hover:text-white/90"
  }`;
}
```

`subLinkClasse` não muda (pills de subcategoria já usam a cor de marca em ambos os modelos, nada estrutural pra diferenciar).

- [ ] **Step 2: Atualizar o call site**

Em `src/app/loja/[slug]/layout.tsx`, linha 77:

```tsx
        {departamentos.length > 0 && (
          <NavCategorias departamentos={departamentos} slug={slug} moderno={empresa.catalogo_modelo === "moderno"} />
        )}
```

- [ ] **Step 3: Verificar visualmente**

```bash
npm run build && npm run lint && npm run start &
sleep 3
node scripts/screenshot.mjs http://localhost:3000/loja/delivery-pet check-classico-nav
node scripts/screenshot.mjs http://localhost:3000/loja/loja-teste-moderno check-moderno-nav
kill %1
```
Expected: classico idêntico à baseline; moderno mostra os labels de departamento em negrito mais forte (fonte Inter 700 vs 500)

- [ ] **Step 4: Commit**

```bash
git add src/components/loja/nav-categorias.tsx src/app/loja/\[slug\]/layout.tsx
git commit -m "feat: nav de departamentos fica bold no modelo moderno"
```

---

### Task 10: Reskin do ProdutoCard (tipografia de preço)

**Files:**
- Modify: `src/components/produto-card.tsx`
- Modify: `src/app/loja/[slug]/page.tsx` (dois call sites: grade filtrada e grade agrupada por categoria)

**Interfaces:**
- Produces: `ProdutoCard({ produto, slug, variantes, moderno })` — assinatura muda

- [ ] **Step 1: Adicionar a prop e condicionar a tipografia do preço**

Em `src/components/produto-card.tsx`, atualizar a assinatura e o bloco de preço (linhas 11-19 e 81-90):

```tsx
export function ProdutoCard({
  produto,
  slug,
  variantes,
  moderno,
}: {
  produto: ProdutoCatalogo;
  slug: string;
  variantes?: VarianteProduto[];
  moderno: boolean;
}) {
```

E o bloco de preço:

```tsx
        <div className="mt-auto flex items-baseline gap-2 pt-1">
          <span className={moderno ? "text-lg font-extrabold" : "text-base font-semibold"}>
            {formatarPreco(temPromocao ? selecionada.preco_promocional! : selecionada.preco)}
          </span>
          {temPromocao && (
            <span className="text-xs text-black/40 line-through dark:text-white/40">
              {formatarPreco(selecionada.preco)}
            </span>
          )}
        </div>
```

- [ ] **Step 2: Atualizar os dois call sites em page.tsx**

Linha ~109 (grade filtrada) e ~124 (grade agrupada por categoria) — em ambas, adicionar `moderno={empresa.catalogo_modelo === "moderno"}` ao `<ProdutoCard>`:

```tsx
            <ProdutoCard
              key={produto.id}
              produto={produto}
              slug={slug}
              variantes={variantesPorPai.get(produto.id)}
              moderno={empresa.catalogo_modelo === "moderno"}
            />
```

- [ ] **Step 3: Verificar visualmente**

```bash
npm run build && npm run lint && npm run start &
sleep 3
node scripts/screenshot.mjs http://localhost:3000/loja/delivery-pet check-classico-cards
node scripts/screenshot.mjs http://localhost:3000/loja/loja-teste-moderno check-moderno-cards
kill %1
```
Expected: classico idêntico à baseline; moderno mostra preços em fonte maior/mais bold nos 6 produtos sintéticos, ícones placeholder em círculo cheio (confirma que o Task 4 continua funcionando junto)

- [ ] **Step 4: Commit**

```bash
git add src/components/produto-card.tsx src/app/loja/\[slug\]/page.tsx
git commit -m "feat: preco do card de produto fica bold no modelo moderno"
```

---

### Task 11: Verificação final — build completo + robustez multi-tenant + limpeza

**Files:** nenhum (só verificação e cleanup de dado sintético)

- [ ] **Step 1: Build e lint finais**

Run: `npm run build && npm run lint`
Expected: ambos limpos

- [ ] **Step 2: Screenshot final de página inteira, 2 combinações de cor de marca**

```bash
npm run start &
sleep 3
node scripts/screenshot.mjs http://localhost:3000/loja/delivery-pet final-classico-delivery-pet
node scripts/screenshot.mjs http://localhost:3000/loja/loja-teste-moderno final-moderno-verde-roxo
kill %1
```
Expected: `final-classico-delivery-pet-*` pixel-idêntico à baseline do Task 1 (nenhuma regressão introduzida em 8 tasks de mudança); `final-moderno-verde-roxo-*` mostra o sistema completo (hero, selos, clube, marcas, nav, cards) funcionando corretamente com uma combinação de marca verde/roxo, não só o azul/laranja "sortudo" da Delivery Pet — **olhar a screenshot de verdade, não só confiar que "deve funcionar porque são CSS vars"** (mesma disciplina já documentada neste projeto de bugs que só apareceram em screenshot real)

- [ ] **Step 3: Testar manualmente o modelo moderno na Delivery Pet real (sem deixar aplicado)**

```sql
update empresas set catalogo_modelo = 'moderno' where catalogo_slug = 'delivery-pet';
```
```bash
node scripts/screenshot.mjs http://localhost:3000/loja/delivery-pet final-moderno-delivery-pet-real
```
```sql
update empresas set catalogo_modelo = 'classico' where catalogo_slug = 'delivery-pet';
```
Expected: screenshot mostra o modelo moderno com dados reais de produção (produtos reais, marcas reais como Golden/Quatree/Premier Pet, fotos reais onde existem) — última verificação antes de considerar a fase 1 pronta pra o usuário escolher ativar de verdade

- [ ] **Step 4: Remover o tenant de teste**

```sql
delete from produtos where empresa_id = '<id-da-empresa-teste>';
delete from empresas where catalogo_slug = 'loja-teste-moderno';
```
Expected: confirmar com `select` que não sobrou nenhuma linha

- [ ] **Step 5: Commit final (se sobrou algo não commitado) e relatório**

```bash
git status
```
Expected: working tree limpa — todos os commits já feitos tasks anteriores. Se houver algo pendente, revisar antes de commitar.

---

## O que NÃO está nesta fase (fica pra planos seguintes)

- Catálogo/PLP (filtros, grade fora da home), Página de Produto (PDP), Carrinho/Checkout, Confirmação de Pedido/Pix, Login/Conta — cada um vira um plano próprio reaproveitando os mesmos tokens (`data-modelo`, `--placeholder-bg`, `--benefit-*`) definidos aqui.
- Bottom tab bar mobile — decisão em aberto na spec (substitui ou convive com o header atual) não foi resolvida ainda; entra num plano futuro junto com o resto do mobile.
- Asset de imagem/ilustração real do hero — o hero desta fase usa só gradiente + tipografia, sem painel de imagem (mais simples que o mockup aprovado, que reservava um slot pra asset ainda inexistente — YAGNI: não construir um componente de imagem vazio antes de ter o que colocar nele).
- Campo de desconto Pix / card "compre e ganhe" real — não existem, não fabricados (ver spec).
