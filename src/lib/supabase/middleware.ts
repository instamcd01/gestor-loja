import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function updateSession(request: NextRequest, rewriteUrl?: URL) {
  // Mesma resposta base (next ou rewrite pro domínio-tenant) precisa ser
  // reconstruída aqui dentro quando o Supabase refresca o cookie — senão
  // um rewrite feito antes de chamar updateSession seria descartado.
  const construirResposta = () =>
    rewriteUrl ? NextResponse.rewrite(rewriteUrl, { request }) : NextResponse.next({ request });

  let response = construirResposta();

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = construirResposta();
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // Necessário mesmo sem usar o resultado: refresca o token expirado e
  // reescreve o cookie na resposta antes que Server Components o leiam.
  await supabase.auth.getUser();

  return response;
}
