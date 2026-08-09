import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";
import { resolverSlugPorDominio } from "@/lib/dominio-tenant";
import { ipDaRequisicao, permitido } from "@/lib/rate-limit";

// Toda mutação do site (finalizar pedido, aplicar cupom, adicionar ao
// carrinho, buscar endereço na API paga do Google, etc.) é uma Server
// Action — sempre um POST pra própria rota da página. Sem isso, nada
// impedia um script de chamar essas ações direto em loop (achado numa
// revisão de segurança: Server Actions são chamáveis fora do clique no
// botão). Login por OTP não passa por aqui — é uma chamada direta à API
// do Supabase Auth, que já tem seu próprio rate limit, fora do alcance
// deste middleware.
const JANELA_MS = 60_000;
const LIMITE_POST_POR_IP = 40;

export async function middleware(request: NextRequest) {
  // Checagem por método apenas, sem exigir prefixo /loja/ no path: numa
  // loja acessada por domínio próprio, o path original (ex. "/carrinho")
  // só ganha o prefixo /loja/[slug] depois da reescrita mais abaixo — uma
  // checagem `pathname.startsWith("/loja/")` aqui nunca bateria pra esse
  // caso, deixando o rate limit inteiro sem efeito no domínio do cliente.
  // O matcher abaixo já exclui assets estáticos. A única rota POST fora
  // do namespace da loja é o webhook do Mercado Pago — o limite aqui é
  // generoso o bastante (40/min) pra não incomodar as notificações dele.
  if (request.method === "POST") {
    const ip = ipDaRequisicao(request.headers);
    if (!permitido(`post:${ip}`, LIMITE_POST_POR_IP, JANELA_MS)) {
      return new NextResponse("Muitas requisições — espera um instante e tenta de novo.", { status: 429 });
    }
  }

  // Rotas globais do Mercado Pago (callback OAuth e webhook) não pertencem
  // a nenhuma loja — não podem ser reescritas pro namespace /loja/[slug]
  // quando acessadas por um domínio próprio, senão 404 (não existem lá).
  const rotaGlobal = request.nextUrl.pathname === "/mp/callback" || request.nextUrl.pathname.startsWith("/api/");
  if (rotaGlobal) {
    return updateSession(request);
  }

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
  // Qualquer path com extensão de arquivo (robots.txt, sitemap.xml,
  // arquivo de verificação do Search Console, etc.) é um asset estático
  // de `public/` — nunca deve ser reescrito pro namespace do tenant.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)"],
};
