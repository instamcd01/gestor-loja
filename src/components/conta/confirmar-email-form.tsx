"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createClient } from "@/lib/supabase/client";

/** Mostrado na conta quando o cliente ainda não tem email confirmado —
 * cobre tanto "nunca informou" quanto "informou mas nunca confirmou o
 * link" (chamar updateUser de novo, mesmo com o mesmo email, reenvia a
 * confirmação — usa a MESMA sessão por telefone já ativa aqui, diferente
 * da tela de login, onde não tem sessão nenhuma pra fazer isso). */
export function ConfirmarEmailForm() {
  const [email, setEmail] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [enviado, setEnviado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);

    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      setErro("Digite um email válido.");
      return;
    }

    setEnviando(true);
    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({ email });
    setEnviando(false);

    if (error) {
      setErro(error.message);
      return;
    }
    setEnviado(true);
  }

  if (enviado) {
    return (
      <p className="text-sm text-black/60 dark:text-white/60">
        Enviamos um link de confirmação para <strong>{email}</strong>. Abra seu email e clique no link.
      </p>
    );
  }

  return (
    <form onSubmit={enviar} className="flex flex-col gap-2">
      <p className="text-sm text-black/60 dark:text-white/60">
        Você ainda não confirmou um email — sem isso, só entra por telefone.
      </p>
      <div className="flex gap-2">
        <Input
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          type="email"
          placeholder="voce@exemplo.com"
          className="flex-1"
        />
        <Button type="submit" disabled={enviando}>
          {enviando ? "Enviando..." : "Confirmar"}
        </Button>
      </div>
      {erro && <p className="text-sm text-[var(--color-danger)]">{erro}</p>}
    </form>
  );
}
