"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { adicionarAoCarrinho } from "@/lib/carrinho";

export function AdicionarCarrinhoButton({
  slug,
  empresaId,
  produtoId,
}: {
  slug: string;
  empresaId: string;
  produtoId: string;
}) {
  const router = useRouter();
  const [quantidade, setQuantidade] = useState(1);
  const [carregando, setCarregando] = useState(false);
  const [status, setStatus] = useState<"idle" | "adicionado" | "erro">("idle");

  async function adicionar() {
    setCarregando(true);
    setStatus("idle");
    const resultado = await adicionarAoCarrinho(slug, empresaId, produtoId, quantidade);
    setCarregando(false);

    if (!resultado.ok) {
      if (resultado.erro === "login_necessario") {
        router.push(`/loja/${slug}/entrar`);
        return;
      }
      setStatus("erro");
      return;
    }
    setStatus("adicionado");
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-3">
        <div className="flex items-center rounded-full border border-black/10 dark:border-white/10">
          <button
            type="button"
            onClick={() => setQuantidade((q) => Math.max(1, q - 1))}
            className="px-3 py-2 text-lg leading-none"
            aria-label="Diminuir quantidade"
          >
            −
          </button>
          <span className="w-8 text-center text-sm">{quantidade}</span>
          <button
            type="button"
            onClick={() => setQuantidade((q) => q + 1)}
            className="px-3 py-2 text-lg leading-none"
            aria-label="Aumentar quantidade"
          >
            +
          </button>
        </div>

        <Button onClick={adicionar} disabled={carregando} className="flex-1">
          {carregando ? "Adicionando..." : "Adicionar ao carrinho"}
        </Button>
      </div>

      {status === "adicionado" && (
        <p className="text-sm text-green-600 dark:text-green-400">Adicionado ao carrinho.</p>
      )}
      {status === "erro" && (
        <p className="text-sm text-red-600 dark:text-red-400">Não foi possível adicionar. Tente de novo.</p>
      )}
    </div>
  );
}
