import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { LoginForm } from "@/components/auth/login-form";
import { Card } from "@/components/ui/card";
import { getEmpresaPorSlug } from "@/lib/catalogo";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const empresa = await getEmpresaPorSlug(slug);
  return { title: empresa ? `Entrar — ${empresa.nome}` : "Entrar" };
}

// Mesma receita visual de `SelosConfianca` (selos-confianca.tsx) no modelo
// clássico — ícone num círculo na cor da marca + card de superfície, em vez
// do painel com gradiente que estava aqui antes (chamativo mas fora do
// idioma visual do resto do site, que não usa blocos de cor sólida grandes
// assim em lugar nenhum). Conteúdo próprio da tela de entrar (pedido,
// endereço, saldo), por isso não reaproveita o componente compartilhado
// diretamente — só o mesmo estilo de card.
const beneficios: { titulo: string; icone: React.ReactNode }[] = [
  {
    titulo: "Acompanhe seus pedidos do início ao fim",
    icone: (
      <>
        <path d="M3 8l9-4 9 4-9 4-9-4z" />
        <path d="M3 8v9l9 4 9-4V8" />
        <path d="M12 12v9" />
      </>
    ),
  },
  {
    titulo: "Endereço salvo, sem digitar tudo de novo",
    icone: (
      <>
        <path d="M12 21s7-7.5 7-12a7 7 0 1 0-14 0c0 4.5 7 12 7 12z" />
        <circle cx="12" cy="9" r="2.3" />
      </>
    ),
  },
  {
    titulo: "Use seu saldo direto na próxima compra",
    icone: (
      <>
        <rect x="3" y="6" width="18" height="13" rx="2" />
        <path d="M3 10.5h18" />
        <path d="M16 14.5h2.5" />
      </>
    ),
  },
];

export default async function EntrarPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ redirect?: string; retomar?: string; telefone?: string }>;
}) {
  const { slug } = await params;
  const { redirect: destino, retomar, telefone: telefoneRetomada } = await searchParams;
  const rotaPosLogin = destino === "carrinho" ? "carrinho" : "conta";
  // Vem do botão de "voltar ao site" mandado por WhatsApp logo depois do
  // código (ver api/whatsapp/link-retomar) — pula direto pra tela de
  // confirmação com o mesmo telefone, sem reenviar outro código. Sem
  // isso, o único link que o cliente tinha no WhatsApp pra voltar era o
  // do catálogo, que reabre a home e obriga reiniciar o login inteiro.
  const retomarTelefone = retomar === "1" && telefoneRetomada ? telefoneRetomada : undefined;

  const empresa = await getEmpresaPorSlug(slug);
  if (!empresa) notFound();

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) redirect(`/loja/${slug}/${rotaPosLogin}`);

  return (
    <div className="mx-auto flex max-w-md flex-col gap-6 py-10">
      <div>
        <h1 className="text-2xl font-semibold">Entrar</h1>
        <p className="text-sm text-black/50 dark:text-white/50">{empresa.nome}</p>
      </div>

      <Card className="p-6">
        <LoginForm empresaId={empresa.id} slug={slug} rotaPosLogin={rotaPosLogin} retomarTelefone={retomarTelefone} />
      </Card>

      <div className="flex flex-col gap-3">
        <p className="text-sm font-medium text-black/60 dark:text-white/60">Vantagens da sua conta</p>
        <div className="flex flex-col gap-3">
          {beneficios.map((beneficio) => (
            <Card key={beneficio.titulo} className="flex items-center gap-3 px-4 py-3.5">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--brand-primary)]/10">
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={1.5}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="h-4.5 w-4.5 text-[var(--brand-primary)]"
                >
                  {beneficio.icone}
                </svg>
              </div>
              <span className="text-xs font-semibold">{beneficio.titulo}</span>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
