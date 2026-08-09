"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { CapturarEndereco } from "@/components/endereco/capturar-endereco";
import { FreteGratisProgresso } from "@/components/carrinho/frete-gratis-progresso";
import { ResumoTotais } from "@/components/carrinho/resumo-totais";
import { SeletorAgendamento } from "@/components/carrinho/seletor-agendamento";
import { SeletorMetodoEntrega } from "@/components/carrinho/seletor-metodo-entrega";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { calcularDataUtilFutura, formatarDataPrevista, type JanelaHorarioAgendamento } from "@/lib/agendamento";
import { calcularFretePorEndereco } from "@/lib/checkout";
import { salvarCheckoutEstimado, type CheckoutEstimado } from "@/lib/checkout-estimado";
import { salvarEndereco } from "@/lib/cliente";
import {
  assinarEnderecoEstimado,
  obterSnapshotEnderecoEstimado,
  obterSnapshotServidorEnderecoEstimado,
  salvarEnderecoEstimado,
  type EnderecoEstimado,
} from "@/lib/endereco-estimado";
import type { EmpresaCatalogo, EnderecoCliente, ItemCarrinho } from "@/lib/types";
import { formatarEnderecoCompleto, formatarPreco } from "@/lib/utils";

type TipoEntrega = "retirada" | "entrega";

/**
 * Primeira etapa do checkout (retirada/entrega, endereço, agendamento) —
 * a segunda etapa (forma de pagamento, parcelamento, cupom, confirmação)
 * fica em `PagamentoForm`, numa rota separada
 * (`/loja/[slug]/carrinho/pagamento`), pra não empilhar tudo numa tela só.
 * O botão "Ir para pagamento" grava o resultado da entrega (zona, valor,
 * prazo) em `checkout-estimado.ts` — a etapa de pagamento lê de lá em vez
 * de recalcular o frete de novo.
 */
export function EntregaForm({
  slug,
  empresaId,
  aceitaRetirada,
  retiradaPrazoMin,
  enderecoEmpresa,
  horarioFuncionamento,
  subtotal,
  itens,
  enderecoSalvo,
  aoConfirmarAntes,
}: {
  slug: string;
  empresaId: string;
  aceitaRetirada: boolean;
  /** Prazo em minutos pra retirada ficar pronta — null = não mostra prazo nenhum. */
  retiradaPrazoMin: number | null;
  enderecoEmpresa: { endereco: string | null; cidade: string | null; estado: string | null; cep: string | null };
  horarioFuncionamento: EmpresaCatalogo["horario_funcionamento"];
  subtotal: number;
  itens: ItemCarrinho[];
  enderecoSalvo: EnderecoCliente | null;
  /** Garante que qualquer alteração de quantidade ainda pendente (dentro da janela de debounce) chegue no banco antes de avançar — senão a etapa de pagamento podia ler uma quantidade desatualizada. */
  aoConfirmarAntes: () => Promise<void>;
}) {
  const router = useRouter();

  // Se o cliente já resolveu o endereço na estimativa pré-carrinho (ver
  // EstimarFreteGratis), reaproveita em vez de pedir de novo — só usada
  // quando a conta ainda não tem um endereço salvo.
  const enderecoEstimado = useSyncExternalStore(
    assinarEnderecoEstimado,
    () => obterSnapshotEnderecoEstimado(empresaId),
    obterSnapshotServidorEnderecoEstimado,
  );

  // Cliente que já tem endereço salvo (ou loja que não aceita retirada)
  // provavelmente quer entrega — só cai pra retirada por padrão quando
  // não há indício nenhum de endereço ainda.
  const [tipoEntrega, setTipoEntrega] = useState<TipoEntrega>(() =>
    !aceitaRetirada || enderecoSalvo ? "entrega" : "retirada",
  );
  // true assim que o cliente escolhe manualmente — depois disso o efeito
  // abaixo (endereço resolvido tarde, ex: estimativa pré-carrinho só
  // chega depois da hidratação) para de tentar mudar a seleção sozinho.
  const escolhaManual = useRef(false);
  // Endereço ativo pra esse carrinho: SEMPRE o cache compartilhado
  // (enderecoEstimado, ver endereco-estimado.ts) — mesmo lugar que a
  // barra "frete grátis" acima lê e escreve, então os dois nunca
  // divergem. `enderecoSalvo` (vindo do servidor) só entra como
  // fallback pra não piscar vazio no primeiro instante, antes do cache
  // existir — nunca tem prioridade sobre ele. Derivado a cada render
  // (não useState) pra reagir sozinho quando o useSyncExternalStore
  // acima atualiza (troca feita aqui ou na barra).
  const endereco = enderecoEstimado?.endereco ?? enderecoSalvo ?? null;

  useEffect(() => {
    if (!escolhaManual.current && endereco && tipoEntrega === "retirada") {
      setTipoEntrega("entrega");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [endereco]);
  const [frete, setFrete] = useState<Awaited<ReturnType<typeof calcularFretePorEndereco>> | null>(null);
  const [calculando, setCalculando] = useState(false);
  const [avancando, setAvancando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  // Controla só a exibição (form de digitação vs. linha compacta de
  // leitura) — independente do cache. Precisa ser um estado próprio: o
  // endereço "ativo" pode vir do fallback `enderecoSalvo` (conta) mesmo
  // com o cache local vazio, então só limpar o cache no clique de "Trocar
  // endereço" não bastava pra sumir com a leitura (o fallback reaparecia
  // na hora, e o clique parecia não fazer nada).
  const [editandoEndereco, setEditandoEndereco] = useState(false);
  const [janelaAgendamento, setJanelaAgendamento] = useState<JanelaHorarioAgendamento | null>(null);
  // Cobre "modalidade" (expressa/econômica) E "quando" (agendada) numa
  // escolha só — eram dois controles separados antes (relatado como
  // ambíguo: dava pra escolher "Econômica" e "Quero agora" ao mesmo
  // tempo, por exemplo). Agendada usa o mesmo preço da expressa —
  // agendar não é um desconto, só escolhe a hora de chegada.
  const [metodoEntrega, setMetodoEntrega] = useState<"expressa" | "economica" | "agendada">("expressa");
  const modalidadeEntrega: "expressa" | "economica" = metodoEntrega === "economica" ? "economica" : "expressa";

  function mudarTipoEntrega(novo: TipoEntrega) {
    escolhaManual.current = true;
    setTipoEntrega(novo);
    setFrete(null);
    setErro(null);
  }

  // Guarda o endereço já usado no último cálculo — evita recalcular em
  // loop quando a própria confirmação (manual ou automática) já deixa
  // `endereco` apontando pro mesmo objeto de novo.
  const ultimoEnderecoCalculado = useRef<EnderecoCliente | null>(null);

  async function confirmarEnderecoECalcularFrete(novoEndereco: EnderecoCliente) {
    ultimoEnderecoCalculado.current = novoEndereco;
    setCalculando(true);
    setErro(null);

    const salvo = await salvarEndereco(empresaId, novoEndereco);
    if (!salvo.ok) {
      setCalculando(false);
      setErro(salvo.erro);
      return;
    }

    const resultado = await calcularFretePorEndereco(empresaId, enderecoEmpresa, novoEndereco, subtotal);
    setCalculando(false);
    setFrete(resultado);

    // Escreve no MESMO cache compartilhado que a barra "frete grátis" lê
    // (ver endereco-estimado.ts) — é a única fonte de verdade, então
    // confirmar o endereço aqui já atualiza a barra sozinha, sem precisar
    // de nenhuma lógica de conciliação entre os dois.
    if (resultado.disponivel) {
      setEditandoEndereco(false);
      const novoEstimado: EnderecoEstimado = {
        endereco: novoEndereco,
        zonaId: resultado.opcao.zona_id,
        zonaNome: resultado.opcao.zona_nome,
        valor: resultado.opcao.valor,
        valorCheio: resultado.opcao.valor_cheio,
        freteGratis: resultado.opcao.frete_gratis,
        valorMinimoFreteGratis: resultado.opcao.valor_minimo_frete_gratis,
        estimativaMinMin: resultado.opcao.estimativa_min_min,
        estimativaMinMax: resultado.opcao.estimativa_min_max,
      };
      salvarEnderecoEstimado(empresaId, novoEstimado);
    }
  }

  // O cliente pode já ter confirmado o endereço antes de chegar aqui (na
  // gaveta, via EstimarFreteGratis, ou porque a conta já tem endereço
  // salvo) — nesse caso o frete calcula sozinho, sem esperar ele clicar
  // "Confirmar endereço" de novo dentro do CapturarEndereco. Recalcula de
  // novo sempre que `endereco` mudar pra um valor DIFERENTE do último já
  // calculado — não só na primeira vez — porque o cliente pode trocar o
  // endereço na barra "frete grátis" enquanto já está nesta tela (ela
  // reage e atualiza `endereco` sozinha via EstimarFreteGratis), e sem
  // isso o frete cobrado (e o endereço salvo no Supabase) ficava travado
  // no endereço antigo mesmo com o campo abaixo já mostrando o novo.
  //
  // `calculando` também entra nas dependências de propósito: sem isso, se
  // o endereço mudasse DE NOVO enquanto uma chamada anterior ainda estava
  // em andamento, esse efeito não reavaliava depois que ela terminasse
  // (só reage a mudança de `endereco`, e `endereco` não mudou de novo
  // nesse meio-tempo) — a troca mais recente ficava perdida, nunca
  // chegava a ser calculada nem salva. Incluindo `calculando`, o efeito
  // reavalia assim que a chamada anterior termina e pega a versão mais
  // atual de `endereco` nesse momento.
  useEffect(() => {
    if (!endereco || calculando || endereco === ultimoEnderecoCalculado.current) return;
    confirmarEnderecoECalcularFrete(endereco);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [endereco, calculando]);

  const freteResolvido = tipoEntrega === "entrega" && frete?.disponivel ? frete.opcao : null;
  // frete_gratis veio do subtotal de quando o endereço foi confirmado —
  // se o cliente mudou quantidade depois (item-carrinho-row, acima nesta
  // mesma página), reavalia contra o subtotal atual em vez de confiar no
  // flag congelado (mesma regra do CarrinhoProvider.valorEntregaCalculado
  // no app: grátis quando subtotal >= mínimo da zona).
  const entregaGratisAgora =
    !!freteResolvido &&
    (freteResolvido.valor_minimo_frete_gratis != null
      ? subtotal >= freteResolvido.valor_minimo_frete_gratis
      : freteResolvido.frete_gratis);
  // Econômica é config única da loja (não por zona) — usa o valor fixo da
  // empresa em vez do valor da zona, mas continua sob o mesmo limite de
  // frete grátis da zona (entregaGratisAgora acima vale pras duas).
  // Usa `valor_cheio` (nunca zerado pela RPC), não `valor` (que já vem 0
  // quando o subtotal DESTE cálculo bateu o mínimo) — sem isso, depois
  // que o frete grátis era desbloqueado uma vez, o valor "cheio" ficava
  // preso em 0 pra sempre nesse endereço, mesmo que o carrinho depois
  // caísse abaixo do mínimo de novo (mostrava "grátis" errado) ou
  // que o resumo não conseguisse mostrar quanto a entrega "economizou".
  const valorBaseEntrega =
    modalidadeEntrega === "economica" && freteResolvido?.economico_valor != null
      ? freteResolvido.economico_valor
      : (freteResolvido?.valor_cheio ?? 0);
  const valorEntrega = freteResolvido ? (entregaGratisAgora ? 0 : valorBaseEntrega) : 0;
  const faltaParaFreteGratis =
    freteResolvido && !entregaGratisAgora && freteResolvido.valor_minimo_frete_gratis != null
      ? freteResolvido.valor_minimo_frete_gratis - subtotal
      : null;
  const quantidadeItens = itens.reduce((soma, item) => soma + item.quantidade, 0);
  // Soma de (preço de catálogo atual − preço promocional) × quantidade —
  // só dos itens em promoção agora, pra alimentar a linha "Você
  // economizou" do resumo (ver ResumoTotais). Mesmo cálculo usado na
  // etapa de pagamento (pagamento-form.tsx).
  const descontoProdutos = itens.reduce((soma, item) => {
    const produto = item.produto;
    if (!produto || produto.preco_promocional == null || produto.preco_promocional >= produto.preco) return soma;
    return soma + (produto.preco - produto.preco_promocional) * item.quantidade;
  }, 0);
  const totalParcial = subtotal + valorEntrega;

  function calcularPrazoLabel(): string | null {
    if (janelaAgendamento) return `Agendado para ${janelaAgendamento.label}`;
    if (tipoEntrega === "retirada") {
      return retiradaPrazoMin != null ? `Pronto em até ${retiradaPrazoMin} min` : null;
    }
    if (!freteResolvido) return null;
    if (modalidadeEntrega === "economica" && freteResolvido.economico_prazo_dias != null) {
      return `Chega até ${formatarDataPrevista(calcularDataUtilFutura(freteResolvido.economico_prazo_dias))}`;
    }
    if (freteResolvido.estimativa_min_min != null && freteResolvido.estimativa_min_max != null) {
      return `Chega em ${freteResolvido.estimativa_min_min}–${freteResolvido.estimativa_min_max} min`;
    }
    return null;
  }

  const podeAvancar = tipoEntrega === "retirada" || (frete?.disponivel ?? false);

  async function irParaPagamento() {
    setAvancando(true);
    // Garante que qualquer mudança de quantidade feita nos últimos
    // instantes (ainda dentro da janela de debounce) já esteja salva no
    // banco antes da etapa de pagamento ler o carrinho — senão o resumo
    // final podia mostrar uma quantidade desatualizada.
    await aoConfirmarAntes();

    const estimado: CheckoutEstimado = {
      tipoEntrega,
      modalidadeEntrega,
      zonaId: freteResolvido?.zona_id ?? null,
      entregaLabel: tipoEntrega === "entrega" ? "Entrega" : "Retirada na loja",
      valorEntrega,
      valorEntregaOriginal: freteResolvido ? valorBaseEntrega : null,
      prazoLabel: calcularPrazoLabel(),
      janelaAgendamento: janelaAgendamento
        ? { inicio: janelaAgendamento.inicio, fim: janelaAgendamento.fim }
        : null,
    };
    salvarCheckoutEstimado(empresaId, estimado);
    router.push(`/loja/${slug}/carrinho/pagamento`);
  }

  return (
    <div className="flex flex-col gap-4 border-t border-black/10 pt-6 dark:border-white/10">
      {aceitaRetirada && (
        <div>
          <p className="mb-2 text-sm font-semibold">Retirada ou entrega</p>
          <div className="flex gap-2">
            {(["entrega", "retirada"] as const).map((opcao) => (
              <button
                key={opcao}
                type="button"
                onClick={() => mudarTipoEntrega(opcao)}
                className={`rounded-full border px-4 py-2 text-sm font-medium transition-colors ${
                  tipoEntrega === opcao
                    ? "border-[var(--brand-primary)] bg-[var(--brand-primary)]/10 text-[var(--brand-primary)]"
                    : "border-black/10 dark:border-white/10"
                }`}
              >
                {opcao === "retirada" ? "Retirar na loja" : "Entrega"}
              </button>
            ))}
          </div>
          {tipoEntrega === "retirada" && retiradaPrazoMin != null && (
            <p className="mt-2 text-xs text-black/50 dark:text-white/50">
              <span className="font-medium text-[var(--color-success)]">Grátis</span> — pronto pra retirar em até{" "}
              {retiradaPrazoMin} min
            </p>
          )}
        </div>
      )}

      {tipoEntrega === "entrega" && (
        <Card className="flex flex-col gap-3 p-4">
          {endereco && !editandoEndereco ? (
            <div className="flex items-start justify-between gap-2">
              <span className="text-sm">📍 {formatarEnderecoCompleto(endereco)}</span>
              <button
                type="button"
                onClick={() => setEditandoEndereco(true)}
                className="shrink-0 text-xs text-black/40 hover:underline dark:text-white/40"
              >
                Trocar endereço
              </button>
            </div>
          ) : (
            <CapturarEndereco valorInicial={endereco} onResolvido={confirmarEnderecoECalcularFrete} />
          )}

          {calculando && (
            <p className="text-sm text-black/50 dark:text-white/50">Calculando frete...</p>
          )}

          {/* Sem confirmação de valor aqui de propósito — vira redundante
              com as opções de entrega logo abaixo (SeletorMetodoEntrega),
              que já mostram "Grátis"/preço por opção assim que o frete
              resolve. */}
          {frete && !frete.disponivel && (
            <p className="text-sm text-[var(--color-danger)]">
              {frete.motivo === "fora_de_area"
                ? "Esse endereço está fora da nossa área de entrega."
                : "Não foi possível calcular o frete para esse endereço."}
            </p>
          )}
        </Card>
      )}

      {tipoEntrega === "entrega" && freteResolvido && (
        <SeletorMetodoEntrega
          metodo={metodoEntrega}
          onMudarMetodo={setMetodoEntrega}
          valorExpressa={freteResolvido.valor_cheio}
          estimativaExpressa={
            freteResolvido.estimativa_min_min != null && freteResolvido.estimativa_min_max != null
              ? { min: freteResolvido.estimativa_min_min, max: freteResolvido.estimativa_min_max }
              : null
          }
          economicoValor={freteResolvido.economico_valor}
          economicoPrazoDias={freteResolvido.economico_prazo_dias}
          gratis={entregaGratisAgora}
          horarioFuncionamento={horarioFuncionamento}
          janela={janelaAgendamento}
          onMudarJanela={setJanelaAgendamento}
        />
      )}

      {/* Retirada não tem modalidade (só um jeito de buscar) — mantém o
          seletor simples "quero agora vs agendar", sem ambiguidade
          nenhuma com outro controle (essa é a única escolha de tempo). */}
      {tipoEntrega === "retirada" && (
        <SeletorAgendamento
          horarioFuncionamento={horarioFuncionamento}
          janela={janelaAgendamento}
          onMudarJanela={setJanelaAgendamento}
          estimativa={null}
        />
      )}

      <Card className="p-4">
        <ResumoTotais
          subtotal={subtotal}
          quantidadeItens={quantidadeItens}
          enderecoLabel={tipoEntrega === "entrega" && endereco ? formatarEnderecoCompleto(endereco) : null}
          prazoEntregaLabel={calcularPrazoLabel()}
          entregaLabel={tipoEntrega === "entrega" ? "Entrega" : "Retirada na loja"}
          entregaValor={tipoEntrega === "entrega" ? (freteResolvido ? valorEntrega : null) : null}
          entregaValorOriginal={freteResolvido ? valorBaseEntrega : undefined}
          faltaParaFreteGratis={faltaParaFreteGratis}
          descontoProdutos={descontoProdutos}
          total={totalParcial}
        />
      </Card>

      {erro && <p className="text-sm text-[var(--color-danger)]">{erro}</p>}

      {/* Barra fixa: total parcial + "Ir para pagamento" sempre visíveis
          rolando a tela — mesmo padrão da barra da etapa de pagamento
          (ver pagamento-form.tsx), com o indicador de progresso de frete
          grátis empilhado por cima. z-30 fica acima do botão do WhatsApp
          (z-20, que sobe mais alto nesta página — ver
          whatsapp-suporte-button.tsx). Altura varia com o indicador: se
          mudar padding/conteúdo aqui, ajustar o `pb-*` reservado em
          carrinho-logado.tsx e o `bottom-*` do WhatsApp nesta página. */}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-black/10 bg-[var(--surface)] px-4 py-3 shadow-[0_-4px_16px_rgba(0,0,0,0.08)] dark:border-white/10">
        <div className="mx-auto flex max-w-2xl flex-col gap-3">
          {tipoEntrega === "entrega" && freteResolvido?.valor_minimo_frete_gratis != null && (
            <FreteGratisProgresso subtotal={subtotal} minimo={freteResolvido.valor_minimo_frete_gratis} />
          )}
          <div className="flex items-center gap-3">
            <div className="min-w-0">
              <p className="text-xs text-black/50 dark:text-white/50">Total</p>
              <p className="truncate text-lg font-bold">{formatarPreco(totalParcial)}</p>
            </div>
            <Button onClick={irParaPagamento} disabled={!podeAvancar || avancando} className="flex-1 py-3 text-base">
              {avancando ? "Continuando..." : "Ir para pagamento"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
