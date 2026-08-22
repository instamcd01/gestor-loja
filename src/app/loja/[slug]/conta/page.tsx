import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ConfirmarEmailForm } from "@/components/conta/confirmar-email-form";
import { LogoutButton } from "@/components/auth/logout-button";
import { getEmpresaPorSlug } from "@/lib/catalogo";
import { formatarCnpj, formatarCpf } from "@/lib/cpf-cnpj";
import { createClient } from "@/lib/supabase/server";
import { formatarPreco } from "@/lib/utils";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const empresa = await getEmpresaPorSlug(slug);
  return { title: empresa ? `Minha conta — ${empresa.nome}` : "Minha conta" };
}

export default async function ContaPage({
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

  // RLS (clientes_cliente_le_proprio) já garante que só a própria linha volta.
  const { data: cliente } = await supabase
    .from("clientes")
    .select("nome, telefone, email, cpf, cnpj, tipo_pessoa, razao_social, saldo_petcash")
    .eq("empresa_id", empresa.id)
    .eq("auth_user_id", user.id)
    .maybeSingle();

  const pessoaJuridica = cliente?.tipo_pessoa === "juridica";

  return (
    <div className="mx-auto flex max-w-sm flex-col gap-6 py-10">
      <h1 className="text-xl font-semibold">Minha conta</h1>

      <div className="flex flex-col gap-3 rounded-[var(--radius-lg)] border border-black/5 p-4 dark:border-white/10">
        <div>
          <p className="text-sm text-black/50 dark:text-white/50">Nome</p>
          <p className="font-medium">{cliente?.nome ?? "—"}</p>
        </div>
        <div>
          <p className="text-sm text-black/50 dark:text-white/50">Telefone</p>
          <p className="font-medium">{cliente?.telefone ?? user.phone ?? "—"}</p>
        </div>
        <div>
          <p className="text-sm text-black/50 dark:text-white/50">Email</p>
          {cliente?.email ? (
            <p className="font-medium">{cliente.email}</p>
          ) : (
            <ConfirmarEmailForm />
          )}
        </div>
        {pessoaJuridica ? (
          <>
            <div>
              <p className="text-sm text-black/50 dark:text-white/50">CNPJ</p>
              <p className="font-medium">{cliente?.cnpj ? formatarCnpj(cliente.cnpj) : "—"}</p>
            </div>
            <div>
              <p className="text-sm text-black/50 dark:text-white/50">Razão social</p>
              <p className="font-medium">{cliente?.razao_social ?? "—"}</p>
            </div>
          </>
        ) : (
          <div>
            <p className="text-sm text-black/50 dark:text-white/50">CPF</p>
            <p className="font-medium">{cliente?.cpf ? formatarCpf(cliente.cpf) : "—"}</p>
          </div>
        )}
      </div>

      {/* Link sempre visível, mesmo com saldo zerado — é exatamente quando
          o saldo cai pra zero (usado ou expirado) que o cliente mais
          precisa entender o motivo, então esconder o link nesse momento
          seria o pior timing possível. */}
      <Link
        href={`/loja/${slug}/petcash`}
        className="flex items-center justify-between gap-2 rounded-[var(--radius-lg)] border border-dashed border-[var(--brand-primary)]/40 bg-[var(--brand-primary)]/5 p-4"
      >
        <span>
          <span className="block text-sm text-black/50 dark:text-white/50">🐾 Seu PetCash</span>
          <span className="text-2xl font-semibold text-[var(--brand-primary)]">
            {formatarPreco(cliente?.saldo_petcash ?? 0)}
          </span>
        </span>
        <span className="text-xs text-black/50 underline-offset-2 dark:text-white/50">Ver extrato</span>
      </Link>

      <Link
        href={`/loja/${slug}/pedidos`}
        className="rounded-[var(--radius-lg)] border border-black/5 p-4 text-sm font-medium hover:border-[var(--brand-primary)]/40 dark:border-white/10"
      >
        Meus pedidos
      </Link>

      <LogoutButton slug={slug} />
    </div>
  );
}
