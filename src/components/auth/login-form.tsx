"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { CompletarCadastroForm } from "@/components/auth/completar-cadastro-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { mesclarCarrinhoConvidado } from "@/lib/carrinho";
import { lerCarrinhoConvidado, limparCarrinhoConvidado } from "@/lib/carrinho-convidado";
import { createClient } from "@/lib/supabase/client";
import { formatarTelefoneBr, paraE164, telefoneValido } from "@/lib/telefone";

type Etapa = "escolha" | "telefone" | "codigo" | "email" | "confirmeEmail" | "perfil";
type ModoEmail = "entrar" | "cadastrar";

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
  const [etapa, setEtapa] = useState<Etapa>("escolha");
  const [telefone, setTelefone] = useState("");
  const [codigo, setCodigo] = useState("");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [modoEmail, setModoEmail] = useState<ModoEmail>("entrar");
  // Telefone já conhecido/verificado, passado pro perfil pra não pedir de
  // novo — só setado quando a entrada foi por SMS.
  const [telefoneVerificado, setTelefoneVerificado] = useState<string | null>(null);
  // Opt-in explícito — nunca marcado por padrão, precisa de ação real do
  // cliente (ver aceita_lembrete_whatsapp, coluna separada da antiga
  // aceita_marketing, que tinha default true sem nunca perguntar de verdade).
  const [aceitaLembrete, setAceitaLembrete] = useState(false);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const supabase = createClient();

  /** Chamado depois de qualquer entrada bem-sucedida (SMS ou email+senha) —
   * cria/reconecta o cliente, decide se falta completar o perfil (primeira
   * vez) ou já pode seguir pro carrinho/conta. */
  async function finalizarEntrada() {
    const { data: clienteId, error: rpcError } = await supabase.rpc("entrar_ou_criar_cliente", {
      p_empresa_id: empresaId,
      // Nome não é mais coletado neste passo — quem ainda não tem
      // cadastro completo preenche em CompletarCadastroForm logo em
      // seguida (que sobrescreve incondicionalmente); passar null aqui só
      // deixa o fallback "Cliente" temporário pro INSERT de um cliente
      // realmente novo, nunca visível de fato.
      p_nome: null,
      // null (não `false`) quando o cliente não marcou — a RPC faz
      // coalesce(p_aceita_lembrete_whatsapp, valor_atual), então só passar
      // `false` de propósito sobrescreveria um opt-in anterior toda vez
      // que a pessoa loga de novo sem marcar a caixa (ela já começa
      // desmarcada a cada sessão, então "não marcada" não significa "quero
      // desativar").
      p_aceita_lembrete_whatsapp: aceitaLembrete || null,
    });

    if (rpcError) {
      setCarregando(false);
      setErro(rpcError.message);
      return;
    }

    const { data: cliente } = await supabase
      .from("clientes")
      .select("termos_aceitos_em")
      .eq("id", clienteId as string)
      .maybeSingle();

    setCarregando(false);

    if (!cliente?.termos_aceitos_em) {
      setEtapa("perfil");
      return;
    }

    await concluirEIrPara();
  }

  /** Merge do carrinho de visitante + navegação final — só roda quando o
   * cadastro já está completo (perfil já preenchido antes, ou acabou de
   * preencher agora). */
  async function concluirEIrPara() {
    const itensConvidado = lerCarrinhoConvidado(empresaId);
    if (itensConvidado.length > 0) {
      await mesclarCarrinhoConvidado(
        slug,
        empresaId,
        itensConvidado.map((item) => ({ produtoId: item.produtoId, quantidade: item.quantidade })),
      );
      limparCarrinhoConvidado(empresaId);
    }
    router.push(`/loja/${slug}/${rotaPosLogin}`);
    router.refresh();
  }

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

    setTelefoneVerificado(paraE164(telefone).replace("+", ""));
    await finalizarEntrada();
  }

  async function enviarEmail(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);

    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      setErro("Digite um email válido.");
      return;
    }
    if (senha.length < 6) {
      setErro("A senha precisa ter pelo menos 6 caracteres.");
      return;
    }

    setCarregando(true);

    if (modoEmail === "entrar") {
      const { error } = await supabase.auth.signInWithPassword({ email, password: senha });
      if (error) {
        // Login falhou — o motivo mais comum na primeira tentativa é o
        // email ainda não confirmado (anexado via telefone, cliente sem
        // acesso ao celular pra confirmar pela tela de conta). O reenvio
        // nativo do Supabase (`resend({type:'email_change'})`) só funciona
        // com sessão ativa — inútil aqui —, por isso essa RPC própria
        // (token + Resend direto, ver [[gestor_loja_cadastro_unificado_auth]]).
        // A RPC diferencia os 3 casos (email já confirmado = senha errada;
        // email pendente = manda confirmação; nada encontrado = genérico) —
        // decisão consciente de mostrar mensagem precisa em vez de esconder
        // tudo atrás de um texto genérico.
        const { data: status } = await supabase.rpc("solicitar_confirmacao_email", {
          p_empresa_id: empresaId,
          p_email: email,
        });
        setCarregando(false);
        if (status === "senha_incorreta") {
          setErro("Senha incorreta.");
          return;
        }
        if (status === "confirmacao_enviada") {
          setEtapa("confirmeEmail");
          return;
        }
        setErro("Email ou senha incorretos.");
        return;
      }
      await finalizarEntrada();
      return;
    }

    // Cadastro novo por email — o Supabase manda um link de confirmação;
    // sem sessão ativa até confirmar, não dá pra chamar a RPC ainda.
    const { data, error } = await supabase.auth.signUp({ email, password: senha });
    setCarregando(false);
    if (error) {
      setErro(error.message);
      return;
    }
    if (!data.session) {
      setEtapa("confirmeEmail");
      return;
    }
    setCarregando(true);
    await finalizarEntrada();
  }

  if (etapa === "confirmeEmail") {
    return (
      <div className="flex flex-col gap-3 text-center">
        <p className="text-2xl">📧</p>
        <p className="text-sm text-black/70 dark:text-white/70">
          Enviamos um link de confirmação para <strong>{email}</strong>. Abra seu email e clique no link pra
          continuar o cadastro.
        </p>
        <button
          type="button"
          onClick={() => setEtapa("escolha")}
          className="text-xs text-black/40 hover:underline dark:text-white/40"
        >
          Voltar
        </button>
      </div>
    );
  }

  if (etapa === "perfil") {
    return (
      <CompletarCadastroForm
        empresaId={empresaId}
        slug={slug}
        telefoneConhecido={telefoneVerificado ?? undefined}
        pedirEmailSenha={!!telefoneVerificado}
        onCompleto={concluirEIrPara}
      />
    );
  }

  if (etapa === "codigo") {
    return (
      <form onSubmit={confirmarCodigo} className="flex flex-col gap-4">
        <p className="text-sm text-black/60 dark:text-white/60">
          Enviamos um código por SMS para {formatarTelefoneBr(telefone)}.
        </p>

        {/* Nome não é pedido aqui — quem ainda não completou o cadastro
            preenche no passo seguinte (CompletarCadastroForm); pedir aqui
            também mostrava esse campo pra clientes que JÁ tinham cadastro,
            mesmo prometendo "só na primeira vez" (bug real reportado pelo
            usuário 21/08/2026). Opt-in específico, separado do aceite de
            termos (esse fica no passo de completar cadastro). */}
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

  if (etapa === "telefone") {
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
        <button
          type="button"
          onClick={() => {
            setErro(null);
            setEtapa("escolha");
          }}
          className="text-xs text-black/40 hover:underline dark:text-white/40"
        >
          Voltar
        </button>
      </form>
    );
  }

  if (etapa === "email") {
    return (
      <form onSubmit={enviarEmail} className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <label htmlFor="email" className="text-sm font-medium">
            Email
          </label>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="voce@exemplo.com"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="senha" className="text-sm font-medium">
            Senha
          </label>
          <Input
            id="senha"
            type="password"
            autoComplete={modoEmail === "entrar" ? "current-password" : "new-password"}
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
            placeholder={modoEmail === "entrar" ? "Sua senha" : "Mínimo 6 caracteres"}
          />
        </div>

        {erro && <p className="text-sm text-[var(--color-danger)]">{erro}</p>}

        <Button type="submit" disabled={carregando} className="py-3 text-base">
          {carregando ? "Enviando..." : modoEmail === "entrar" ? "Entrar" : "Criar conta"}
        </Button>
        <button
          type="button"
          onClick={() => {
            setErro(null);
            setModoEmail(modoEmail === "entrar" ? "cadastrar" : "entrar");
          }}
          className="text-xs text-black/40 hover:underline dark:text-white/40"
        >
          {modoEmail === "entrar" ? "Não tem conta? Criar uma" : "Já tem conta? Entrar"}
        </button>
        <button
          type="button"
          onClick={() => {
            setErro(null);
            setEtapa("escolha");
          }}
          className="text-xs text-black/40 hover:underline dark:text-white/40"
        >
          Voltar
        </button>
      </form>
    );
  }

  // etapa === "escolha"
  return (
    <div className="flex flex-col gap-3">
      <Button type="button" onClick={() => setEtapa("telefone")} className="py-3 text-base">
        Entrar com telefone
      </Button>
      <Button
        type="button"
        variant="secondary"
        onClick={() => {
          setModoEmail("entrar");
          setEtapa("email");
        }}
        className="py-3 text-base"
      >
        Entrar com email e senha
      </Button>
    </div>
  );
}
