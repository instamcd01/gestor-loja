"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { mesclarCarrinhoConvidado } from "@/lib/carrinho";
import { lerCarrinhoConvidado, limparCarrinhoConvidado } from "@/lib/carrinho-convidado";
import { createClient } from "@/lib/supabase/client";
import { formatarTelefoneBr, paraE164, telefoneValido } from "@/lib/telefone";

type Etapa = "telefone" | "codigo";

export function LoginForm({
  empresaId,
  slug,
  rotaPosLogin = "conta",
}: {
  empresaId: string;
  slug: string;
  rotaPosLogin?: string;
}) {
  const router = useRouter();
  const [etapa, setEtapa] = useState<Etapa>("telefone");
  const [telefone, setTelefone] = useState("");
  const [codigo, setCodigo] = useState("");
  const [nome, setNome] = useState("");
  // Opt-in explícito — nunca marcado por padrão, precisa de ação real do
  // cliente (ver aceita_lembrete_whatsapp, coluna separada da antiga
  // aceita_marketing, que tinha default true sem nunca perguntar de verdade).
  const [aceitaLembrete, setAceitaLembrete] = useState(false);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const supabase = createClient();

  async function enviarCodigo(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);

    if (!telefoneValido(telefone)) {
      setErro("Digite um telefone válido com DDD.");
      return;
    }

    setCarregando(true);
    const { error } = await supabase.auth.signInWithOtp({ phone: paraE164(telefone) });
    setCarregando(false);

    if (error) {
      setErro(error.message);
      return;
    }
    setEtapa("codigo");
  }

  async function confirmarCodigo(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);

    if (codigo.trim().length < 6) {
      setErro("Digite o código de 6 dígitos recebido por SMS.");
      return;
    }

    setCarregando(true);
    const { error: verifyError } = await supabase.auth.verifyOtp({
      phone: paraE164(telefone),
      token: codigo.trim(),
      type: "sms",
    });

    if (verifyError) {
      setCarregando(false);
      setErro(verifyError.message);
      return;
    }

    const { error: rpcError } = await supabase.rpc("entrar_ou_criar_cliente", {
      p_empresa_id: empresaId,
      p_nome: nome.trim() || null,
      p_aceita_lembrete_whatsapp: aceitaLembrete,
    });

    if (rpcError) {
      setCarregando(false);
      setErro(rpcError.message);
      return;
    }

    // Leva pro carrinho de verdade o que foi montado sem login — preço
    // é sempre recalculado a partir do catálogo, nunca do que estava
    // guardado no navegador.
    const itensConvidado = lerCarrinhoConvidado(empresaId);
    if (itensConvidado.length > 0) {
      await mesclarCarrinhoConvidado(
        slug,
        empresaId,
        itensConvidado.map((item) => ({ produtoId: item.produtoId, quantidade: item.quantidade })),
      );
      limparCarrinhoConvidado(empresaId);
    }

    setCarregando(false);
    router.push(`/loja/${slug}/${rotaPosLogin}`);
    router.refresh();
  }

  if (etapa === "codigo") {
    return (
      <form onSubmit={confirmarCodigo} className="flex flex-col gap-4">
        <p className="text-sm text-black/60 dark:text-white/60">
          Enviamos um código por SMS para {formatarTelefoneBr(telefone)}.
        </p>

        <div className="flex flex-col gap-1">
          <label htmlFor="nome" className="text-sm font-medium">
            Seu nome (só na primeira vez)
          </label>
          <Input
            id="nome"
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            placeholder="Como podemos te chamar?"
          />
        </div>

        {/* Opt-in específico, separado de qualquer termo de uso geral —
            quando os termos de cadastro forem adicionados, este checkbox
            deve continuar como um item próprio dentro deles, não
            substituído por uma aceitação genérica. */}
        <label className="flex cursor-pointer items-start gap-2.5 text-sm">
          <input
            type="checkbox"
            checked={aceitaLembrete}
            onChange={(e) => setAceitaLembrete(e.target.checked)}
            className="mt-0.5 h-4 w-4 shrink-0 accent-[var(--brand-primary)]"
          />
          <span className="text-black/70 dark:text-white/70">
            Quero receber um aviso no WhatsApp quando for hora de repor meus produtos
          </span>
        </label>

        <div className="flex flex-col gap-1">
          <label htmlFor="codigo" className="text-sm font-medium">
            Código de verificação
          </label>
          <Input
            id="codigo"
            inputMode="numeric"
            autoComplete="one-time-code"
            value={codigo}
            onChange={(e) => setCodigo(e.target.value)}
            placeholder="000000"
            className="text-center text-lg tracking-[0.5em]"
          />
        </div>

        {erro && <p className="text-sm text-[var(--color-danger)]">{erro}</p>}

        <Button type="submit" disabled={carregando} className="py-3 text-base">
          {carregando ? "Confirmando..." : "Confirmar"}
        </Button>
        <button
          type="button"
          onClick={() => setEtapa("telefone")}
          className="text-xs text-black/40 hover:underline dark:text-white/40"
        >
          Trocar número
        </button>
      </form>
    );
  }

  return (
    <form onSubmit={enviarCodigo} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <label htmlFor="telefone" className="text-sm font-medium">
          Seu telefone
        </label>
        <Input
          id="telefone"
          inputMode="tel"
          autoComplete="tel"
          value={telefone}
          onChange={(e) => setTelefone(formatarTelefoneBr(e.target.value))}
          placeholder="(00) 00000-0000"
        />
      </div>

      {erro && <p className="text-sm text-[var(--color-danger)]">{erro}</p>}

      <Button type="submit" disabled={carregando} className="py-3 text-base">
        {carregando ? "Enviando..." : "Enviar código por SMS"}
      </Button>
    </form>
  );
}
