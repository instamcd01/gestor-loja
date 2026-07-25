import type { NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";
import { resolverSlugPorDominio } from "@/lib/dominio-tenant";

export async function middleware(request: NextRequest) {
  const host = request.headers.get("host")?.split(":")[0];
  const slug = host ? await resolverSlugPorDominio(host) : null;

  // Sem domínio-tenant reconhecido: comportamento de sempre (rota
  // explícita /loja/[slug], usada em dev e por quem acessa o host de
  // hospedagem direto em vez de um domínio próprio de empresa).
  if (!slug) {
    return updateSession(request);
  }

  const url = request.nextUrl.clone();
  const jaNoEscopoDaLoja = url.pathname === `/loja/${slug}` || url.pathname.startsWith(`/loja/${slug}/`);
  if (jaNoEscopoDaLoja) {
    return updateSession(request);
  }

  // Domínio próprio reconhecido: reescreve transparentemente pra dentro
  // de /loja/[slug] — a URL que o visitante vê continua limpa
  // (meudominio.com/carrinho), só o roteamento interno do Next.js muda.
  url.pathname = `/loja/${slug}${url.pathname === "/" ? "" : url.pathname}`;
  return updateSession(request, url);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
