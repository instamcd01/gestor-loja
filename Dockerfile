# Build multi-stage padrão do Next.js pra self-host (output: "standalone"
# em next.config.ts). Alvo: deploy via Easypanel na mesma VPS do n8n.
FROM node:22-alpine AS base

FROM base AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# NEXT_PUBLIC_* são inlinados no bundle do cliente em build-time — não dá
# pra trocar depois só setando env var em runtime. Precisam chegar aqui
# como build args (no Easypanel: "Build Arguments" do serviço, não a aba
# de variáveis de ambiente normal).
ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY
ENV NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL
ENV NEXT_PUBLIC_SUPABASE_ANON_KEY=$NEXT_PUBLIC_SUPABASE_ANON_KEY

RUN npm run build

FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production

RUN addgroup --system --gid 1001 nodejs \
  && adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Pasta do cache de imagens otimizadas (next/image) já existindo com dono
# nextjs: um volume do Docker montado aqui herda essa permissão na 1ª
# montagem. Sem volume, cada deploy zera o cache e o servidor rebaixa todas
# as fotos originais do Supabase Storage (egress) — ver memória do projeto.
RUN mkdir -p .next/cache && chown -R nextjs:nodejs .next/cache

USER nextjs
EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["node", "server.js"]
