"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";

export function SugestaoProduto({
  empresaId,
  termoBuscado,
}: {
  empresaId: string;
  termoBuscado: string;
}) {
  const [aberto, setAberto] = useState(false);
  const [mensagem, setMensagem] = useState("");
  const [contato, setContato] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [enviado, setEnviado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    setEnviando(true);

    const supabase = createClient();
    const { error } = await supabase.rpc("enviar_sugestao_produto_cliente", {
      p_empresa_id: empresaId,
      p_termo_buscado: termoBuscado,
      p_mensagem: mensagem.trim() || null,
      p_contato: contato.trim() || null,
    });

    setEnviando(false);
    if (error) {
      setErro("Não foi possível enviar agora. Tente de novo em instantes.");
      return;
    }
    setEnviado(true);
  }

  if (enviado) {
    return (
      <div className="mx-auto max-w-sm py-4 text-center">
        <p className="text-sm text-black/70 dark:text-white/70">
          Recebemos! Vamos avaliar &ldquo;{termoBuscado}&rdquo; pro catálogo.
        </p>
      </div>
    );
  }

  if (!aberto) {
    return (
      <div className="mx-auto max-w-sm py-4 text-center">
        <button
          type="button"
          onClick={() => setAberto(true)}
          className="text-sm font-medium text-[var(--brand-primary)] hover:underline"
        >
          Não achou &ldquo;{termoBuscado}&rdquo;? Avise a gente
        </button>
      </div>
    );
  }

  return (
    <form
      onSubmit={enviar}
      className="mx-auto flex max-w-sm flex-col gap-3 py-4 text-left"
    >
      <p className="text-sm text-black/60 dark:text-white/60">
        Conta pra gente o que você procurava — a gente avalia incluir no
        catálogo.
      </p>

      <textarea
        value={mensagem}
        onChange={(e) => setMensagem(e.target.value)}
        placeholder={`Ex: "${termoBuscado}" de outra marca, outro tamanho...`}
        rows={3}
        className="w-full resize-none rounded-[var(--radius-md)] border border-black/10 bg-[var(--surface)] px-3.5 py-2.5 text-sm outline-none transition-colors placeholder:text-black/30 focus:border-[var(--brand-primary)] dark:border-white/10 dark:placeholder:text-white/30"
      />

      <input
        value={contato}
        onChange={(e) => setContato(e.target.value)}
        placeholder="Seu WhatsApp (opcional, se quiser que a gente avise)"
        className="w-full rounded-[var(--radius-md)] border border-black/10 bg-[var(--surface)] px-3.5 py-2.5 text-sm outline-none transition-colors placeholder:text-black/30 focus:border-[var(--brand-primary)] dark:border-white/10 dark:placeholder:text-white/30"
      />

      {erro && <p className="text-sm text-[var(--color-danger)]">{erro}</p>}

      <div className="flex justify-center gap-2">
        <Button type="submit" disabled={enviando}>
          {enviando ? "Enviando..." : "Enviar"}
        </Button>
        <button
          type="button"
          onClick={() => setAberto(false)}
          className="px-3 text-sm text-black/40 hover:underline dark:text-white/40"
        >
          Cancelar
        </button>
      </div>
    </form>
  );
}
