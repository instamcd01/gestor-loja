"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { CompletarCadastroForm } from "@/components/auth/completar-cadastro-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { concluirLoginEIrPara } from "@/lib/pos-login";
import { createClient } from "@/lib/supabase/client";
import { formatarTelefoneBr, paraE164, telefoneValido } from "@/lib/telefone";

// Login com Google está funcional (Supabase Auth Provider habilitado,
// OAuth Client no Google Cloud, página de retorno em pos-login/) mas
// escondido do site por decisão do usuário (2026-08-23): a tela de
// permissão do Google mostra "Prosseguir para dwswpwxnzjgoohucngbb.
// supabase.co" em vez do domínio da loja — o Google sempre mostra o
// domínio real do `redirect_uri` (Supabase, não a loja), só troca com um
// domínio customizado no Auth (add-on pago do plano Pro). Reativar: trocar
// pra `true` assim que decidir sobre o domínio customizado — nenhuma outra
// mudança de código é necessária.
const GOOGLE_LOGIN_HABILITADO = false;

// Janela mínima entre reenvios do código — evita gerar vários códigos em
// sequência clicando repetido (o código anterior continua válido até
// expirar ou até um novo ser confirmado, então reenviar rápido demais só
// teria efeito de gastar a cota de SMS/WhatsApp da conta à toa).
const REENVIO_COOLDOWN_SEGUNDOS = 60;

type Etapa =
  | "escolha"
  | "telefone"
  | "codigo"
  | "email"
  | "confirmeEmail"
  | "perfil"
  | "recuperarSenha"
  | "recuperarSenhaEnviada";
type ModoEmail = "entrar" | "cadastrar";

/** Do "+5521998877477" (E.164, vem da URL de retomada) pra "21998877477"
 * (formato BR local que o resto do componente espera — mesma coisa que o
 * campo de telefone produz enquanto o cliente digita). */
function e164ParaLocal(e164: string): string {
  const digitos = e164.replace(/\D/g, "");
  return digitos.startsWith("55") && digitos.length >= 12 ? digitos.slice(2) : digitos;
}

export function LoginForm({
  empresaId,
  slug,
  rotaPosLogin = "conta",
  retomarTelefone,
}: {
  empresaId: string;
  slug: string;
  rotaPosLogin?: string;
  /** Telefone (E.164) de quem voltou pelo link de retomada — pula direto
   * pra tela de código, sem reenviar um novo (ver page.tsx e
   * api/whatsapp/link-retomar). */
  retomarTelefone?: string;
}) {
  const router = useRouter();
  const [etapa, setEtapa] = useState<Etapa>(retomarTelefone ? "codigo" : "escolha");
  const [telefone, setTelefone] = useState(() =>
    retomarTelefone ? formatarTelefoneBr(e164ParaLocal(retomarTelefone)) : "",
  );
  const [codigo, setCodigo] = useState("");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [modoEmail, setModoEmail] = useState<ModoEmail>("entrar");
  // Telefone já conhecido/verificado, passado pro perfil pra não pedir de
  // novo — só setado quando a entrada foi por telefone/WhatsApp.
  const [telefoneVerificado, setTelefoneVerificado] = useState<string | null>(null);
  // Opt-in explícito — nunca marcado por padrão, precisa de ação real do
  // cliente (ver aceita_lembrete_whatsapp, coluna separada da antiga
  // aceita_marketing, que tinha default true sem nunca perguntar de verdade).
  const [aceitaLembrete, setAceitaLembrete] = useState(false);
  // Consultado assim que o código é enviado (ver enviarCodigo) — cliente
  // que já aceitou antes não vê a caixinha de novo (só confundia: "se eu
  // não marcar de novo, será que desativa?" — não desativa, mas perguntar
  // toda vez sem mostrar o estado atual é a causa da dúvida).
  const [jaAceitaLembrete, setJaAceitaLembrete] = useState(false);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [mensagemInfo, setMensagemInfo] = useState<string | null>(null);
  const [segundosParaReenviar, setSegundosParaReenviar] = useState(0);

  useEffect(() => {
    if (segundosParaReenviar <= 0) return;
    const id = setTimeout(() => setSegundosParaReenviar((s) => s - 1), 1000);
    return () => clearTimeout(id);
  }, [segundosParaReenviar]);

  // Preenchimento automático do código ao voltar pra aba/site — pedido do
  // usuário pra quem está no navegador embutido do WhatsApp (o código
  // chega como mensagem, não como SMS real, então a WebOTP API nativa do
  // navegador NÃO funciona aqui: ela só lê a caixa de SMS do sistema, por
  // design de privacidade não tem acesso ao conteúdo de outros apps de
  // mensagem, WhatsApp incluso). O melhor substituto real: se o cliente
  // copiar o código lá no WhatsApp e voltar pra aba, a gente tenta ler a
  // área de transferência e preenche sozinho quando achar 6 dígitos —
  // nunca trava o preenchimento manual se a permissão for negada ou a
  // API não existir nesse navegador.
  useEffect(() => {
    if (etapa !== "codigo") return;

    async function tentarPreencherDoClipboard() {
      try {
        const texto = await navigator.clipboard.readText();
        const match = texto.trim().match(/\b\d{6}\b/);
        if (match) setCodigo(match[0]);
      } catch {
        // Sem permissão ou API indisponível nesse contexto — segue
        // funcionando normalmente com preenchimento manual.
      }
    }

    function aoVoltarParaAba() {
      if (document.visibilityState === "visible") tentarPreencherDoClipboard();
    }

    window.addEventListener("focus", tentarPreencherDoClipboard);
    document.addEventListener("visibilitychange", aoVoltarParaAba);
    return () => {
      window.removeEventListener("focus", tentarPreencherDoClipboard);
      document.removeEventListener("visibilitychange", aoVoltarParaAba);
    };
  }, [etapa]);

  // Quem chega pelo link de retomada pula o enviarCodigo normal (que é
  // quem faz essa consulta) -- refaz aqui só pra decidir se mostra a
  // caixinha de opt-in, sem reenviar nenhum código.
  useEffect(() => {
    if (!retomarTelefone) return;
    supabase.rpc("consultar_aceita_lembrete_whatsapp", { p_empresa_id: empresaId, p_telefone: retomarTelefone }).then(
      ({ data }) => setJaAceitaLembrete(!!data),
      () => {},
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const supabase = createClient();

  /** Chamado depois de qualquer entrada bem-sucedida (WhatsApp ou email+senha) —
   * cria/reconecta o cliente, decide se falta completar o perfil (primeira
   * vez) ou já pode seguir pro carrinho/conta. */
  async function finalizarEntrada() {
    const { data: clienteId, error: rpcError } = await supabase.rpc("entrar_ou_criar_cliente", {
      p_empresa_id: empresaId,
      // Nome não é mais coletado neste passo — quem ainda não tem
      // cadastro completo preenche em CompletarCadastroForm logo em
      // seguida. Só é usado aqui pra reconectar um cliente já existente
      // (outro canal) sem nome salvo; um cliente realmente novo nem chega
      // a ser criado por esta RPC (ver comentário abaixo).
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

    // clienteId vem null quando é a primeira vez desse usuário nesta loja
    // (entrar_ou_criar_cliente não materializa nenhuma linha antes do
    // cadastro ser concluído — ver completar_cadastro_cliente, que cria o
    // registro de verdade só quando o formulário é enviado). Sem esse
    // early-return, cair na tela de perfil já sabendo que não há nada pra
    // buscar evita uma query à toa e deixa claro que "sem cliente" também
    // significa "precisa completar o cadastro".
    if (!clienteId) {
      setCarregando(false);
      setEtapa("perfil");
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
   * preencher agora). Extraído pra lib/pos-login.ts, reaproveitado também
   * pelo retorno do login com Google (pos-login/page.tsx) — ver comentário
   * lá sobre por que esse fluxo não pode ficar só aqui dentro do state
   * deste formulário. */
  function concluirEIrPara() {
    return concluirLoginEIrPara(router, { slug, empresaId, rotaPosLogin });
  }

  /** Login com Google é um redirect de página inteira — ao contrário de
   * telefone/email, não tem como continuar rodando `finalizarEntrada` no
   * state deste componente depois. O retorno cai em `pos-login/page.tsx`,
   * que refaz a mesma decisão (completar cadastro ou seguir direto). */
  async function entrarComGoogle() {
    setErro(null);
    setCarregando(true);
    const destino = rotaPosLogin === "carrinho" ? "?redirect=carrinho" : "";
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/loja/${slug}/pos-login${destino}` },
    });
    if (error) {
      setCarregando(false);
      setErro(error.message);
    }
    // Sem tratamento de sucesso aqui: o navegador já foi redirecionado pro
    // Google, este componente nem continua montado.
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

    // Consulta se esse telefone já tem o opt-in ativo pra decidir se mostra
    // a caixinha na tela seguinte — não bloqueia o envio do código se falhar
    // (pior caso, a caixinha aparece de novo pra quem já tinha aceitado).
    const { data: jaAceita } = await supabase.rpc("consultar_aceita_lembrete_whatsapp", {
      p_empresa_id: empresaId,
      p_telefone: paraE164(telefone),
    });
    setJaAceitaLembrete(!!jaAceita);

    setCarregando(false);

    if (error) {
      setErro(error.message);
      return;
    }
    setSegundosParaReenviar(REENVIO_COOLDOWN_SEGUNDOS);
    setEtapa("codigo");

    // Fire-and-forget — manda uma mensagem de WhatsApp com um botão que
    // volta direto pra essa tela de código. Nunca bloqueia nem falha o
    // login se der errado, é só uma conveniência de navegação (ver
    // api/whatsapp/link-retomar pro motivo real disso existir).
    fetch("/api/whatsapp/link-retomar", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ telefone: paraE164(telefone), slug }),
    }).catch(() => {});
  }

  /** Reenvia o código pro mesmo telefone sem sair da tela — pedido do
   * usuário: código expirado obrigava voltar e redigitar o número, fricção
   * desnecessária já que o telefone continua no state. */
  async function reenviarCodigo() {
    if (segundosParaReenviar > 0) return;
    setErro(null);
    setMensagemInfo(null);
    setCodigo("");
    setCarregando(true);
    const { error } = await supabase.auth.signInWithOtp({ phone: paraE164(telefone) });
    setCarregando(false);
    if (error) {
      setErro(error.message);
      return;
    }
    setSegundosParaReenviar(REENVIO_COOLDOWN_SEGUNDOS);
    setMensagemInfo("Código reenviado!");

    fetch("/api/whatsapp/link-retomar", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ telefone: paraE164(telefone), slug }),
    }).catch(() => {});
  }

  async function confirmarCodigo(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);

    if (codigo.trim().length < 6) {
      setErro("Digite o código de 6 dígitos recebido por WhatsApp.");
      return;
    }

    setMensagemInfo(null);
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
    if (senha.length < 8) {
      setErro("A senha precisa ter pelo menos 8 caracteres.");
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

  async function enviarRecuperacaoSenha(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);

    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      setErro("Digite um email válido.");
      return;
    }

    setCarregando(true);
    // O Supabase já não retorna erro quando o email simplesmente não existe
    // (mesmo racional de `solicitar_confirmacao_email` — não dá pra
    // confirmar/negar cadastro por aqui) — só quando algo realmente falhou
    // (rate limit, etc.), daí faz sentido mostrar. Usa o mailer nativo do
    // Supabase Auth (já configurado com SMTP próprio via Resend, ver
    // [[gestor_loja_cadastro_unificado_auth]]) — diferente da confirmação de
    // email, este fluxo funciona sem sessão ativa por padrão, não precisa
    // de RPC/token próprio.
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/loja/${slug}/redefinir-senha`,
    });
    setCarregando(false);
    if (error) {
      setErro(error.message);
      return;
    }
    setEtapa("recuperarSenhaEnviada");
  }

  if (etapa === "recuperarSenhaEnviada") {
    return (
      <div className="flex flex-col gap-3 text-center">
        <p className="text-2xl">📧</p>
        <p className="text-sm text-black/70 dark:text-white/70">
          Se houver uma conta com o email <strong>{email}</strong>, enviamos um link para redefinir a senha. Abra
          seu email e clique no link.
        </p>
        <p className="text-sm font-medium text-[var(--color-warning)]">
          Não achou? Confira também a caixa de spam/lixo eletrônico.
        </p>
        <button
          type="button"
          onClick={() => {
            setErro(null);
            setModoEmail("entrar");
            setEtapa("email");
          }}
          className="text-xs text-black/40 hover:underline dark:text-white/40"
        >
          Voltar
        </button>
      </div>
    );
  }

  if (etapa === "recuperarSenha") {
    return (
      <form onSubmit={enviarRecuperacaoSenha} className="flex flex-col gap-4">
        <p className="text-sm text-black/60 dark:text-white/60">
          Digite seu email e mandamos um link para você criar uma senha nova.
        </p>

        <div className="flex flex-col gap-1">
          <label htmlFor="email-recuperar" className="text-sm font-medium">
            Email
          </label>
          <Input
            id="email-recuperar"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="voce@exemplo.com"
          />
        </div>

        {erro && <p className="text-sm text-[var(--color-danger)]">{erro}</p>}

        <Button type="submit" disabled={carregando} className="py-3 text-base">
          {carregando ? "Enviando..." : "Enviar link"}
        </Button>
        <button
          type="button"
          onClick={() => {
            setErro(null);
            setModoEmail("entrar");
            setEtapa("email");
          }}
          className="text-xs text-black/40 hover:underline dark:text-white/40"
        >
          Voltar
        </button>
      </form>
    );
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
          Enviamos um código por WhatsApp para {formatarTelefoneBr(telefone)}.
        </p>

        {/* Nome não é pedido aqui — quem ainda não completou o cadastro
            preenche no passo seguinte (CompletarCadastroForm); pedir aqui
            também mostrava esse campo pra clientes que JÁ tinham cadastro,
            mesmo prometendo "só na primeira vez" (bug real reportado pelo
            usuário 21/08/2026). Opt-in específico, separado do aceite de
            termos (esse fica no passo de completar cadastro). Só aparece
            pra quem ainda não tinha aceitado antes (ver enviarCodigo) —
            reaparecer sempre, mesmo já aceito, gerava dúvida real do
            usuário se desmarcar de novo desativaria o aviso (não desativa,
            mas simplesmente parar de perguntar de novo é mais claro). */}
        {!jaAceitaLembrete && (
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
        )}

        <div className="flex flex-col gap-1">
          <label htmlFor="codigo" className="text-sm font-medium">
            Código de verificação
          </label>
          <Input
            id="codigo"
            inputMode="numeric"
            autoComplete="one-time-code"
            value={codigo}
            onChange={(e) => setCodigo(e.target.value.replace(/\D/g, "").slice(0, 6))}
            placeholder="000000"
            maxLength={6}
            className="text-center text-lg tracking-[0.5em]"
          />
        </div>

        {erro && <p className="text-sm text-[var(--color-danger)]">{erro}</p>}
        {mensagemInfo && !erro && <p className="text-sm text-black/60 dark:text-white/60">{mensagemInfo}</p>}

        <Button type="submit" disabled={carregando} className="py-3 text-base">
          {carregando ? "Confirmando..." : "Confirmar"}
        </Button>
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={reenviarCodigo}
            disabled={carregando || segundosParaReenviar > 0}
            className="text-xs text-black/40 enabled:hover:underline disabled:opacity-50 dark:text-white/40"
          >
            {segundosParaReenviar > 0 ? `Reenviar código (${segundosParaReenviar}s)` : "Reenviar código"}
          </button>
          <button
            type="button"
            onClick={() => setEtapa("telefone")}
            className="text-xs text-black/40 hover:underline dark:text-white/40"
          >
            Trocar número
          </button>
        </div>
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
          {carregando ? "Enviando..." : "Enviar código por WhatsApp"}
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
          <PasswordInput
            id="senha"
            autoComplete={modoEmail === "entrar" ? "current-password" : "new-password"}
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
            placeholder={modoEmail === "entrar" ? "Sua senha" : "Mínimo 8 caracteres"}
          />
          {modoEmail === "entrar" && (
            <button
              type="button"
              onClick={() => {
                setErro(null);
                setEtapa("recuperarSenha");
              }}
              className="self-end text-xs text-black/40 hover:underline dark:text-white/40"
            >
              Esqueci minha senha
            </button>
          )}
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
      {GOOGLE_LOGIN_HABILITADO && (
        <Button
          type="button"
          variant="secondary"
          onClick={entrarComGoogle}
          disabled={carregando}
          className="flex items-center justify-center gap-2.5 py-3 text-base"
        >
          <svg viewBox="0 0 24 24" className="h-4.5 w-4.5" aria-hidden="true">
            <path
              fill="#4285F4"
              d="M23.52 12.27c0-.85-.08-1.67-.22-2.45H12v4.64h6.47a5.53 5.53 0 0 1-2.4 3.63v3h3.87c2.27-2.09 3.58-5.17 3.58-8.82z"
            />
            <path
              fill="#34A853"
              d="M12 24c3.24 0 5.96-1.07 7.94-2.9l-3.87-3.01c-1.08.72-2.45 1.15-4.07 1.15-3.13 0-5.78-2.11-6.73-4.96H1.27v3.11A12 12 0 0 0 12 24z"
            />
            <path
              fill="#FBBC05"
              d="M5.27 14.28A7.2 7.2 0 0 1 4.89 12c0-.79.14-1.56.38-2.28V6.61H1.27A12 12 0 0 0 0 12c0 1.94.46 3.77 1.27 5.39z"
            />
            <path
              fill="#EA4335"
              d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.44-3.44C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.69 1.27 6.61l4 3.11C6.22 6.86 8.87 4.75 12 4.75z"
            />
          </svg>
          Entrar com Google
        </Button>
      )}
    </div>
  );
}
