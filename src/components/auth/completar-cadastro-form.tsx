"use client";

import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { apenasDigitos, cnpjValido, cpfValido, formatarCnpj, formatarCpf } from "@/lib/cpf-cnpj";
import { dataBrParaIso, dataBrValida, formatarDataBr } from "@/lib/data-br";
import { createClient } from "@/lib/supabase/client";
import { formatarTelefoneBr, telefoneValido } from "@/lib/telefone";

type TipoPessoa = "fisica" | "juridica";

/**
 * Perfil completo do cliente — mostrado uma vez, depois de QUALQUER entrada
 * bem-sucedida (telefone+SMS ou email+senha), pra quem ainda não completou
 * (checado pelo chamador via `termos_aceitos_em is null` em `clientes`).
 * `telefoneConhecido` vem preenchido quando a entrada foi por telefone (não
 * pede de novo); ausente quando foi por email (pede como contato — vira
 * login por SMS só depois de uma verificação própria, não construída ainda).
 */
export function CompletarCadastroForm({
  empresaId,
  slug,
  telefoneConhecido,
  pedirEmailSenha = false,
  nomeInicial = "",
  onCompleto,
}: {
  empresaId: string;
  slug: string;
  telefoneConhecido?: string;
  /** true quando a sessão veio de telefone+SMS — mostra os campos de email/senha
   * pra anexar essa credencial extra na mesma conta (ver desenho em
   * [[gestor_loja_lista_melhorias_ondas]]: cada credencial nova exige sua própria
   * verificação, então isso dispara o email de confirmação do Supabase). */
  pedirEmailSenha?: boolean;
  /** Pré-preenche com o nome já digitado no passo anterior (SMS), se houver
   * — evita pedir de novo. */
  nomeInicial?: string;
  onCompleto: () => void;
}) {
  const [nome, setNome] = useState(nomeInicial);
  const [tipoPessoa, setTipoPessoa] = useState<TipoPessoa>("fisica");
  const [cpf, setCpf] = useState("");
  const [cnpj, setCnpj] = useState("");
  const [razaoSocial, setRazaoSocial] = useState("");
  const [telefone, setTelefone] = useState("");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [genero, setGenero] = useState("");
  const [dataNascimento, setDataNascimento] = useState("");
  const [aceitouTermos, setAceitouTermos] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [emailPendenteConfirmacao, setEmailPendenteConfirmacao] = useState<string | null>(null);

  // Feedback ao vivo (assim que termina de digitar, sem esperar o submit) —
  // só acende depois que a quantidade certa de dígitos foi preenchida, pra
  // não mostrar erro enquanto a pessoa ainda está no meio de digitar.
  const cpfCompleto = apenasDigitos(cpf).length === 11;
  const cpfInvalido = cpfCompleto && !cpfValido(cpf);
  const cnpjCompleto = apenasDigitos(cnpj).length === 14;
  const cnpjInvalido = cnpjCompleto && !cnpjValido(cnpj);
  const dataNascimentoCompleta = dataNascimento.length === 10;
  const dataNascimentoInvalida = dataNascimentoCompleta && !dataBrValida(dataNascimento);

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);

    if (!nome.trim()) {
      setErro("Digite seu nome.");
      return;
    }
    if (tipoPessoa === "fisica" && !cpfValido(cpf)) {
      setErro("CPF inválido — confira os números.");
      return;
    }
    if (tipoPessoa === "juridica") {
      if (!cnpjValido(cnpj)) {
        setErro("CNPJ inválido — confira os números.");
        return;
      }
      if (!razaoSocial.trim()) {
        setErro("Digite a razão social.");
        return;
      }
    }
    if (!telefoneConhecido && !telefoneValido(telefone)) {
      setErro("Digite um telefone válido com DDD.");
      return;
    }
    if (!dataBrValida(dataNascimento)) {
      setErro("Data de nascimento inválida.");
      return;
    }
    if (pedirEmailSenha) {
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
        setErro("Digite um email válido.");
        return;
      }
      if (senha.length < 8) {
        setErro("A senha precisa ter pelo menos 8 caracteres.");
        return;
      }
    }
    if (!aceitouTermos) {
      setErro("É necessário aceitar os termos de uso.");
      return;
    }

    setEnviando(true);
    const supabase = createClient();

    if (pedirEmailSenha) {
      const { error: erroCredencial } = await supabase.auth.updateUser({ email, password: senha });
      if (erroCredencial) {
        setEnviando(false);
        setErro(erroCredencial.message);
        return;
      }
    }

    const { error } = await supabase.rpc("completar_cadastro_cliente", {
      p_empresa_id: empresaId,
      p_nome: nome.trim(),
      p_tipo_pessoa: tipoPessoa,
      p_cpf: tipoPessoa === "fisica" ? cpf : null,
      p_cnpj: tipoPessoa === "juridica" ? cnpj : null,
      p_razao_social: tipoPessoa === "juridica" ? razaoSocial.trim() : null,
      p_genero: genero || null,
      p_data_nascimento: dataBrParaIso(dataNascimento),
      p_telefone: telefoneConhecido ?? telefone,
      p_aceitou_termos: aceitouTermos,
    });
    setEnviando(false);

    if (error) {
      // A RPC devolve mensagens específicas (CPF inválido, CNPJ inválido,
      // razão social obrigatória) — se bater um índice único (CPF/CNPJ já
      // cadastrado por outro cliente desta loja), o erro do Postgres vem
      // cru; cobre esse caso com uma mensagem melhor.
      const mensagem = error.message.includes("duplicate key")
        ? `${tipoPessoa === "fisica" ? "Este CPF" : "Este CNPJ"} já está cadastrado.`
        : error.message;
      setErro(mensagem);
      return;
    }

    // O email só passa a valer pra login DEPOIS que o cliente clicar no
    // link de confirmação que o Supabase acabou de mandar (updateUser não
    // ativa o email na hora, por segurança — ver a mesma regra na
    // memória do projeto). Sem avisar isso aqui, o cliente tenta entrar
    // com email+senha, dá "senha inválida" (mensagem genérica, não diz o
    // motivo real) e acha que o cadastro não funcionou.
    if (pedirEmailSenha) {
      setEmailPendenteConfirmacao(email);
      return;
    }

    onCompleto();
  }

  if (emailPendenteConfirmacao) {
    return (
      <div className="flex flex-col gap-4 text-center">
        <p className="text-2xl">📧</p>
        <p className="text-sm text-black/70 dark:text-white/70">
          Cadastro concluído! Enviamos um link de confirmação para <strong>{emailPendenteConfirmacao}</strong>.
          Confirme pra poder entrar também com email e senha da próxima vez — até lá, continue entrando com seu
          telefone normalmente.
        </p>
        <Button type="button" onClick={onCompleto} className="py-3 text-base">
          Continuar
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={enviar} className="flex flex-col gap-4">
      <p className="text-sm text-black/60 dark:text-white/60">Só mais um passo pra terminar seu cadastro.</p>

      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setTipoPessoa("fisica")}
          className={`flex-1 rounded-[var(--radius-md)] border px-3 py-2 text-sm font-medium transition-colors ${
            tipoPessoa === "fisica"
              ? "border-[var(--brand-primary)] bg-[var(--brand-primary)]/10 text-[var(--brand-primary)]"
              : "border-black/10 dark:border-white/10"
          }`}
        >
          Pessoa física
        </button>
        <button
          type="button"
          onClick={() => setTipoPessoa("juridica")}
          className={`flex-1 rounded-[var(--radius-md)] border px-3 py-2 text-sm font-medium transition-colors ${
            tipoPessoa === "juridica"
              ? "border-[var(--brand-primary)] bg-[var(--brand-primary)]/10 text-[var(--brand-primary)]"
              : "border-black/10 dark:border-white/10"
          }`}
        >
          Pessoa jurídica
        </button>
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="nome" className="text-sm font-medium">
          Nome e sobrenome
        </label>
        <Input id="nome" value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Seu nome completo" />
      </div>

      {tipoPessoa === "fisica" ? (
        <div className="flex flex-col gap-1">
          <label htmlFor="cpf" className="text-sm font-medium">
            CPF
          </label>
          <Input
            id="cpf"
            inputMode="numeric"
            value={cpf}
            onChange={(e) => setCpf(formatarCpf(e.target.value))}
            placeholder="000.000.000-00"
            className={cpfInvalido ? "border-[var(--color-danger)]" : undefined}
          />
          {cpfInvalido && <p className="text-xs text-[var(--color-danger)]">CPF inválido — confira os números.</p>}
        </div>
      ) : (
        <>
          <div className="flex flex-col gap-1">
            <label htmlFor="cnpj" className="text-sm font-medium">
              CNPJ
            </label>
            <Input
              id="cnpj"
              inputMode="numeric"
              value={cnpj}
              onChange={(e) => setCnpj(formatarCnpj(e.target.value))}
              placeholder="00.000.000/0000-00"
              className={cnpjInvalido ? "border-[var(--color-danger)]" : undefined}
            />
            {cnpjInvalido && <p className="text-xs text-[var(--color-danger)]">CNPJ inválido — confira os números.</p>}
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="razaoSocial" className="text-sm font-medium">
              Razão social
            </label>
            <Input
              id="razaoSocial"
              value={razaoSocial}
              onChange={(e) => setRazaoSocial(e.target.value)}
              placeholder="Nome da empresa"
            />
          </div>
        </>
      )}

      {!telefoneConhecido && (
        <div className="flex flex-col gap-1">
          <label htmlFor="telefone" className="text-sm font-medium">
            Seu telefone
          </label>
          <Input
            id="telefone"
            inputMode="tel"
            value={telefone}
            onChange={(e) => setTelefone(formatarTelefoneBr(e.target.value))}
            placeholder="(00) 00000-0000"
          />
        </div>
      )}

      {pedirEmailSenha && (
        <>
          <div className="flex flex-col gap-1">
            <label htmlFor="cadastroEmail" className="text-sm font-medium">
              Email
            </label>
            <Input
              id="cadastroEmail"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="voce@exemplo.com"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="cadastroSenha" className="text-sm font-medium">
              Crie uma senha
            </label>
            <Input
              id="cadastroSenha"
              type="password"
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              placeholder="Mínimo 8 caracteres"
            />
            <p className="text-xs text-black/40 dark:text-white/40">
              Pra poder entrar também com email e senha, além do código por SMS.
            </p>
          </div>
        </>
      )}

      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1">
          <label htmlFor="genero" className="text-sm font-medium">
            Gênero <span className="text-black/40 dark:text-white/40">(opcional)</span>
          </label>
          <select
            id="genero"
            value={genero}
            onChange={(e) => setGenero(e.target.value)}
            className="w-full rounded-[var(--radius-md)] border border-black/10 bg-[var(--surface)] px-3.5 py-2.5 text-sm outline-none focus:border-[var(--brand-primary)] dark:border-white/10"
          >
            <option value="">Prefiro não dizer</option>
            <option value="feminino">Feminino</option>
            <option value="masculino">Masculino</option>
            <option value="outro">Outro</option>
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="nascimento" className="text-sm font-medium">
            Nascimento <span className="text-black/40 dark:text-white/40">(opcional)</span>
          </label>
          <Input
            id="nascimento"
            inputMode="numeric"
            value={dataNascimento}
            onChange={(e) => setDataNascimento(formatarDataBr(e.target.value))}
            placeholder="DD/MM/AAAA"
            className={dataNascimentoInvalida ? "border-[var(--color-danger)]" : undefined}
          />
          {dataNascimentoInvalida && <p className="text-xs text-[var(--color-danger)]">Data inválida.</p>}
        </div>
      </div>

      <label className="flex cursor-pointer items-start gap-2.5 text-sm">
        <input
          type="checkbox"
          checked={aceitouTermos}
          onChange={(e) => setAceitouTermos(e.target.checked)}
          className="mt-0.5 h-4 w-4 shrink-0 accent-[var(--brand-primary)]"
        />
        <span className="text-black/70 dark:text-white/70">
          Li e aceito os{" "}
          <Link href={`/loja/${slug}/termos`} target="_blank" className="underline">
            termos e condições
          </Link>
        </span>
      </label>

      {erro && <p className="text-sm text-[var(--color-danger)]">{erro}</p>}

      <Button type="submit" disabled={enviando} className="py-3 text-base">
        {enviando ? "Salvando..." : "Concluir cadastro"}
      </Button>
    </form>
  );
}
