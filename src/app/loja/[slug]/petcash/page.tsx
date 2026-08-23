import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Card } from "@/components/ui/card";
import { getEmpresaPorSlug } from "@/lib/catalogo";
import { getExtratoPetCash } from "@/lib/cliente";
import { createClient } from "@/lib/supabase/server";
import { formatarData, formatarPreco } from "@/lib/utils";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const empresa = await getEmpresaPorSlug(slug);
  return { title: empresa ? `PetCash — ${empresa.nome}` : "PetCash" };
}

const STATUS_LABEL: Record<string, string> = {
  disponivel: "Disponível",
  esgotado: "Todo usado",
  expirado: "Expirado",
};

export default async function PetCashPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const empresa = await getEmpresaPorSlug(slug);
  if (!empresa) notFound();

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/loja/${slug}/entrar`);

  // Autenticado sem linha em `clientes` = cadastro pendente (ver
  // conta/page.tsx pro caso real que motivou essa checagem) — sem isso,
  // mostraria "nenhum crédito ainda" pra quem na verdade nunca completou o
  // cadastro.
  const { data: cliente } = await supabase
    .from("clientes")
    .select("id")
    .eq("empresa_id", empresa.id)
    .eq("auth_user_id", user.id)
    .maybeSingle();
  if (!cliente) redirect(`/loja/${slug}/pos-login`);

  const creditos = await getExtratoPetCash(empresa.id);
  const saldoTotal = creditos.reduce((soma, c) => soma + (c.status === "disponivel" ? c.valorDisponivel : 0), 0);

  return (
    <div className="mx-auto flex max-w-lg flex-col gap-6 py-8">
      <div>
        <h1 className="text-xl font-semibold">🐾 Meu PetCash</h1>
        <p className="mt-1 text-sm text-black/50 dark:text-white/50">
          Saldo disponível: <span className="font-semibold text-[var(--brand-primary)]">{formatarPreco(saldoTotal)}</span>
        </p>
      </div>

      {creditos.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-16 text-center">
          <p className="text-black/50 dark:text-white/50">
            Você ainda não tem nenhum crédito de PetCash. Ele é gerado automaticamente quando um pedido do site é
            entregue.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {creditos.map((credito) => {
            // Cada linha explica sozinha o que aconteceu com aquele
            // crédito — pedido explícito do usuário: saldo sumindo sem
            // motivo visível parece erro do sistema, não deve deixar o
            // cliente sem entender se foi usado numa compra ou expirou.
            let detalhe: string;
            if (credito.status === "expirado") {
              detalhe =
                credito.valorUsado > 0
                  ? `Expirou em ${formatarData(credito.expiradoEm ?? credito.expiraEm)} — ${formatarPreco(credito.valorTotal - credito.valorUsado)} não utilizado (${formatarPreco(credito.valorUsado)} chegou a ser usado antes)`
                  : `Expirou em ${formatarData(credito.expiradoEm ?? credito.expiraEm)} sem ser usado`;
            } else if (credito.status === "esgotado") {
              detalhe = `Todo usado em compras — ${formatarPreco(credito.valorUsado)}`;
            } else {
              detalhe =
                credito.valorUsado > 0
                  ? `${formatarPreco(credito.valorDisponivel)} disponível (${formatarPreco(credito.valorUsado)} já usado) — válido até ${formatarData(credito.expiraEm)}`
                  : `${formatarPreco(credito.valorDisponivel)} disponível — válido até ${formatarData(credito.expiraEm)}`;
            }

            return (
              <Card key={credito.id} className="flex flex-col gap-1 p-4">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-semibold">
                    +{formatarPreco(credito.valorTotal)} ganho em {formatarData(credito.criadoEm)}
                  </span>
                  <span
                    className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ${
                      credito.status === "disponivel"
                        ? "bg-[var(--color-success)]/10 text-[var(--color-success)]"
                        : credito.status === "expirado"
                          ? "bg-[var(--color-danger)]/10 text-[var(--color-danger)]"
                          : "bg-black/5 text-black/50 dark:bg-white/10 dark:text-white/50"
                    }`}
                  >
                    {STATUS_LABEL[credito.status]}
                  </span>
                </div>
                {credito.pedidoOrigemNumero && (
                  <p className="text-xs text-black/50 dark:text-white/50">Pedido #{credito.pedidoOrigemNumero}</p>
                )}
                <p className="text-xs text-black/60 dark:text-white/60">{detalhe}</p>
              </Card>
            );
          })}
        </div>
      )}

      <Link
        href={`/loja/${slug}/conta`}
        className="mx-auto w-fit text-sm text-black/50 hover:underline dark:text-white/50"
      >
        Voltar pra minha conta
      </Link>
    </div>
  );
}
