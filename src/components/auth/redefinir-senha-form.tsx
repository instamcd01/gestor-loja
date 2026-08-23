"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createClient } from "@/lib/supabase/client";

/** Formulário de nova senha, aberto a partir do link de "Esqueci minha
 * senha" (`login-form.tsx`). Não checa a sessão de recuperação antes de
 * mostrar o formulário — `detectSessionInUrl` do Supabase client processa o
 * token do link de forma assíncrona ao carregar a página, e esperar por
 * isso com certeza (evento `PASSWORD_RECOVERY` vs. sessão já pronta) é uma
 * corrida frágil. Mais simples e igualmente correto: tentar
 * `updateUser` direto — se o link for inválido/expirado, a chamada falha e
 * mostra o erro, sem nunca deixar a pessoa preencher um formulário que
 * claramente não vai funcionar. */
export function RedefinirSenhaForm({ slug }: { slug: string }) {
  const router = useRouter();
  const [senha, setSenha] = useState("");
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [sucesso, setSucesso] = useState(false);

  const supabase = createClient();

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);

    if (senha.length < 8) {
      setErro("A senha precisa ter pelo menos 8 caracteres.");
      return;
    }

    setCarregando(true);
    const { error } = await supabase.auth.updateUser({ password: senha });
    setCarregando(false);

    if (error) {
      setErro(
        error.message.toLowerCase().includes("session")
          ? "Esse link expirou ou já foi usado. Peça um novo em \"Esqueci minha senha\"."
          : error.message,
      );
      return;
    }

    setSucesso(true);
    setTimeout(() => {
      router.push(`/loja/${slug}/conta`);
      router.refresh();
    }, 1500);
  }

  if (sucesso) {
    return (
      <div className="flex flex-col gap-3 text-center">
        <p className="text-2xl">✅</p>
        <p className="text-sm text-black/70 dark:text-white/70">Senha atualizada! Redirecionando...</p>
      </div>
    );
  }

  return (
    <form onSubmit={salvar} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <label htmlFor="nova-senha" className="text-sm font-medium">
          Nova senha
        </label>
        <Input
          id="nova-senha"
          type="password"
          autoComplete="new-password"
          value={senha}
          onChange={(e) => setSenha(e.target.value)}
          placeholder="Mínimo 8 caracteres"
        />
      </div>

      {erro && <p className="text-sm text-[var(--color-danger)]">{erro}</p>}

      <Button type="submit" disabled={carregando} className="py-3 text-base">
        {carregando ? "Salvando..." : "Salvar nova senha"}
      </Button>
    </form>
  );
}
