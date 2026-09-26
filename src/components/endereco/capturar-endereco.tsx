"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { buscarEnderecoCandidatos, buscarEnderecoPorLocalizacao } from "@/lib/checkout";
import type { CandidatoEndereco, EnderecoCliente } from "@/lib/types";
import { AjustarLocalTelaCheia } from "./ajustar-local-tela-cheia";
import { MapaAjustarPino } from "./mapa-ajustar-pino";

const ENDERECO_VAZIO: EnderecoCliente = {
  endereco: "",
  numero: "",
  bairro: "",
  cidade: "",
  estado: "",
  cep: "",
  complemento: "",
  lat: null,
  lng: null,
  precisao: null,
  modoPonto: null,
};

function normalizarRua(v: string | null | undefined): string {
  return (v ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\b(rua|r\.|avenida|av\.?|estrada|estr\.?|travessa|tv\.?)\s+/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

// Campos que identificam O LOCAL — editar qualquer um invalida as
// coordenadas confirmadas (força buscar de novo antes de reconfirmar).
// Número/complemento não mudam a rua/bairro, então não invalidam.
const CAMPOS_LOCALIZACAO = ["endereco", "bairro", "cidade", "estado", "cep"] as const;

function montarQuery(c: EnderecoCliente): string {
  const partes = [
    c.numero ? `${c.endereco ?? ""}, ${c.numero}` : c.endereco,
    c.bairro,
    c.cidade,
    c.estado,
    c.cep,
  ].filter(Boolean);
  return partes.join(", ");
}

/**
 * Endereço completo com desambiguação (várias ruas com o mesmo nome, comum
 * em ruas numéricas) e opção de compartilhar localização (igual ao iFood) —
 * substitui o CEP sozinho, que geocodifica mal em ruas longas e pode errar
 * a zona de frete por mais de alguns km. Devolve sempre um endereço com
 * `lat`/`lng` confirmados, nunca só o texto digitado.
 */
export function CapturarEndereco({
  valorInicial,
  onResolvido,
}: {
  valorInicial?: EnderecoCliente | null;
  onResolvido: (endereco: EnderecoCliente) => void;
}) {
  const [campos, setCampos] = useState<EnderecoCliente>(valorInicial ?? ENDERECO_VAZIO);
  // `campos` só nascia de `valorInicial` na primeira montagem — sem isso,
  // trocar o endereço em outro lugar da tela (ex: barra "frete grátis",
  // que reage e recalcula sozinha) nunca refletia aqui, porque o estado
  // interno já tinha "congelado" o valor de quando este componente montou.
  // Ajusta durante o render em vez de um useEffect (padrão recomendado
  // pelo React pra "resetar estado quando uma prop muda", evita o efeito
  // rodar depois do commit e re-render em cascata).
  const [valorInicialAnterior, setValorInicialAnterior] = useState(valorInicial);
  if (valorInicial !== valorInicialAnterior) {
    setValorInicialAnterior(valorInicial);
    if (valorInicial) setCampos(valorInicial);
  }
  const [candidatos, setCandidatos] = useState<CandidatoEndereco[] | null>(null);
  const [buscando, setBuscando] = useState(false);
  const [localizando, setLocalizando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [semResultado, setSemResultado] = useState(false);
  const [abrindoAjuste, setAbrindoAjuste] = useState(false);
  // Ponto inicial da tela cheia de ajuste (null = fechada).
  const [ajuste, setAjuste] = useState<{ lat: number; lng: number } | null>(null);
  // Onde a BUSCA do endereço digitado caiu — base do aviso "o pino está a X
  // km do endereço digitado" na tela de ajuste.
  const [pontoDoTexto, setPontoDoTexto] = useState<{ lat: number; lng: number; rotulo: string } | null>(() =>
    valorInicial?.lat != null && valorInicial.lng != null && valorInicial.modoPonto !== "pino"
      ? { lat: valorInicial.lat, lng: valorInicial.lng, rotulo: montarQuery(valorInicial) }
      : null,
  );

  const resolvido = campos.lat != null && campos.lng != null;

  function atualizarCampo(campo: keyof EnderecoCliente, valor: string) {
    setErro(null);
    setAviso(null);
    setCandidatos(null);
    setSemResultado(false);
    const mudaLocal = CAMPOS_LOCALIZACAO.includes(campo as (typeof CAMPOS_LOCALIZACAO)[number]);
    if (mudaLocal) setPontoDoTexto(null);
    setCampos((atual) => ({
      ...atual,
      [campo]: valor,
      ...(mudaLocal ? { lat: null, lng: null, precisao: null, modoPonto: null } : {}),
    }));
  }

  /**
   * `modo` diz de onde veio o ponto (ver EnderecoCliente.modoPonto): "texto"
   * = busca do endereço digitado; "pino" = localização do aparelho ou tela
   * de ajuste — nesse caso o servidor refaz rua/bairro a partir do ponto.
   */
  function aplicarCandidato(c: CandidatoEndereco, modo: "texto" | "pino") {
    setCandidatos(null);
    setErro(null);
    setAviso(null);
    setSemResultado(false);
    if (modo === "texto") {
      setPontoDoTexto({ lat: c.lat, lng: c.lng, rotulo: c.formattedAddress });
    }
    setCampos((atual) => ({
      ...atual,
      endereco: c.endereco ?? atual.endereco,
      bairro: c.bairro ?? atual.bairro,
      cidade: c.cidade ?? atual.cidade,
      estado: c.estado ?? atual.estado,
      cep: c.cep ?? atual.cep,
      lat: c.lat,
      lng: c.lng,
      precisao: c.precisao,
      modoPonto: modo,
    }));
  }

  // Mensagem específica pra quando a Server Action falha porque a aba
  // ficou aberta desde antes de um deploy novo (ver entrega-form.tsx/
  // pagamento-form.tsx — mesmo achado, 15/09) — só saída real é recarregar,
  // tentar de novo falha do mesmo jeito.
  function mensagemDeErro(e: unknown, generica: string): string {
    return e instanceof Error && /Server Action/i.test(e.message)
      ? "A página ficou aberta desde antes de uma atualização do site — recarregue a página e tente de novo."
      : generica;
  }

  async function buscarEndereco() {
    const query = montarQuery(campos);
    if (!query) {
      setErro("Preencha ao menos rua e cidade pra buscar.");
      return;
    }
    setBuscando(true);
    setErro(null);
    try {
      const resultados = await buscarEnderecoCandidatos(query);
      if (resultados.length === 0) {
        // Rua não encontrada por escrito — oferece marcar no mapa (tela
        // cheia) em vez de travar. É pra esse caso que o mapa existe.
        setSemResultado(true);
        setErro("Não encontramos esse endereço escrito. Confira os dados ou marque sua casa no mapa.");
        return;
      }
      if (resultados.length === 1) {
        aplicarCandidato(resultados[0], "texto");
        return;
      }
      setCandidatos(resultados);
    } catch (e) {
      // Sem isso, uma falha aqui (ex: Server Action desatualizada) deixava
      // o botão preso em "Buscando..." pra sempre, sem nenhuma mensagem.
      setErro(mensagemDeErro(e, "Não foi possível buscar esse endereço agora. Tente de novo em instantes."));
    } finally {
      setBuscando(false);
    }
  }

  /** Ponto aproximado do bairro/cidade digitados — ponto de partida pro cliente ajustar no mapa. */
  async function buscarPontoDoBairro(): Promise<CandidatoEndereco | null> {
    const query = [campos.bairro, campos.cidade, campos.estado].filter(Boolean).join(", ");
    if (!query) return null;
    const resultados = await buscarEnderecoCandidatos(query);
    return resultados[0] ?? null;
  }

  async function abrirAjuste() {
    setErro(null);
    if (campos.lat != null && campos.lng != null) {
      setAjuste({ lat: campos.lat, lng: campos.lng });
      return;
    }
    setAbrindoAjuste(true);
    try {
      const bairro = await buscarPontoDoBairro();
      if (!bairro) {
        setErro("Preencha ao menos bairro e cidade pra abrir o mapa.");
        return;
      }
      setAjuste({ lat: bairro.lat, lng: bairro.lng });
    } catch (e) {
      setErro(mensagemDeErro(e, "Não foi possível abrir o mapa agora. Tente de novo em instantes."));
    } finally {
      setAbrindoAjuste(false);
    }
  }

  function confirmarAjuste(c: CandidatoEndereco) {
    setAjuste(null);
    // O endereço passa a ser o do pino. Se a rua mudou, o número digitado
    // era de outra rua — limpa pra o cliente confirmar o número certo.
    const ruaMudou = normalizarRua(c.endereco) !== normalizarRua(campos.endereco);
    aplicarCandidato({ ...c, precisao: "MANUAL" }, "pino");
    if (ruaMudou) {
      setCampos((atual) => ({ ...atual, numero: "" }));
      setAviso(`A entrega agora é na ${c.endereco}. Confira o número da casa.`);
    }
  }

  function usarLocalizacao() {
    if (!("geolocation" in navigator)) {
      setErro("Seu navegador não permite compartilhar localização.");
      return;
    }
    setLocalizando(true);
    setErro(null);
    setCandidatos(null);
    navigator.geolocation.getCurrentPosition(
      async (posicao) => {
        try {
          const candidato = await buscarEnderecoPorLocalizacao(
            posicao.coords.latitude,
            posicao.coords.longitude,
          );
          if (!candidato) {
            setErro("Não conseguimos identificar seu endereço pela localização. Digite manualmente.");
            return;
          }
          aplicarCandidato(candidato, "pino");
        } catch (e) {
          // Mesmo achado de sempre: sem isso, "Localizando..." ficava preso
          // pra sempre quando a chamada falhava (achado real 15/09 — foi
          // isso que o usuário via como "usar minha localização não
          // funciona", causa era a Server Action desatualizada depois de
          // um redeploy, não a geolocalização em si).
          setErro(mensagemDeErro(e, "Não conseguimos identificar seu endereço pela localização. Digite manualmente."));
        } finally {
          setLocalizando(false);
        }
      },
      () => {
        setLocalizando(false);
        setErro("Não foi possível acessar sua localização. Digite o endereço manualmente.");
      },
      { timeout: 10_000 },
    );
  }

  function confirmar() {
    if (!resolvido) {
      setErro("Busque o endereço ou use sua localização antes de confirmar.");
      return;
    }
    if (!campos.numero?.trim()) {
      setErro("Informe o número.");
      return;
    }
    onResolvido(campos);
  }

  return (
    <div className="flex flex-col gap-3">
      <Button
        type="button"
        variant="secondary"
        onClick={usarLocalizacao}
        disabled={localizando}
        className="w-full text-sm"
      >
        {localizando ? "Localizando..." : "📍 Usar minha localização"}
      </Button>

      <div className="flex items-center gap-2 text-xs text-black/40 dark:text-white/40">
        <div className="h-px flex-1 bg-black/10 dark:bg-white/10" />
        ou digite seu endereço
        <div className="h-px flex-1 bg-black/10 dark:bg-white/10" />
      </div>

      <div className="grid grid-cols-3 gap-2">
        <Input
          placeholder="Rua"
          value={campos.endereco ?? ""}
          onChange={(e) => atualizarCampo("endereco", e.target.value)}
          className="col-span-2"
        />
        <Input
          placeholder="Número"
          value={campos.numero ?? ""}
          onChange={(e) => atualizarCampo("numero", e.target.value)}
        />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Input
          placeholder="Bairro"
          value={campos.bairro ?? ""}
          onChange={(e) => atualizarCampo("bairro", e.target.value)}
        />
        <Input
          placeholder="Complemento (opcional)"
          value={campos.complemento ?? ""}
          onChange={(e) => atualizarCampo("complemento", e.target.value)}
        />
      </div>
      <div className="grid grid-cols-3 gap-2">
        <Input
          placeholder="Cidade"
          value={campos.cidade ?? ""}
          onChange={(e) => atualizarCampo("cidade", e.target.value)}
        />
        <Input
          placeholder="UF"
          maxLength={2}
          value={campos.estado ?? ""}
          onChange={(e) => atualizarCampo("estado", e.target.value.toUpperCase())}
        />
        <Input
          placeholder="CEP"
          value={campos.cep ?? ""}
          onChange={(e) => atualizarCampo("cep", e.target.value)}
        />
      </div>

      {candidatos && (
        <div className="flex flex-col gap-2 rounded-[var(--radius-md)] border border-black/10 p-3 dark:border-white/10">
          <p className="text-xs font-medium">Encontramos mais de um endereço parecido — qual é o seu?</p>
          {candidatos.map((c) => (
            <button
              key={c.formattedAddress}
              type="button"
              onClick={() => aplicarCandidato(c, "texto")}
              className="rounded-[var(--radius-sm)] border border-black/10 px-3 py-2 text-left text-xs hover:border-[var(--brand-primary)] dark:border-white/10"
            >
              {c.formattedAddress}
            </button>
          ))}
        </div>
      )}

      {!resolvido && !candidatos && (
        <Button type="button" variant="secondary" onClick={buscarEndereco} disabled={buscando} className="text-sm">
          {buscando ? "Buscando..." : "Buscar endereço"}
        </Button>
      )}

      {semResultado && !resolvido && (
        <Button type="button" variant="secondary" onClick={abrirAjuste} disabled={abrindoAjuste} className="text-sm">
          {abrindoAjuste ? "Abrindo mapa..." : "📍 Marcar minha casa no mapa"}
        </Button>
      )}

      {resolvido && (
        <div className="flex flex-col gap-2">
          <p className="text-xs font-medium text-[var(--color-success)]">
            Endereço localizado ✓{" "}
            <span className="font-normal text-black/60 dark:text-white/60">
              Confira no mapa. Se o pino não estiver na sua casa, toque em &quot;Ajustar local no mapa&quot;.
            </span>
          </p>
          {/* Prévia travada: rolar a página por cima não mexe no pino. */}
          <MapaAjustarPino lat={campos.lat!} lng={campos.lng!} />
          <Button type="button" variant="secondary" onClick={abrirAjuste} className="text-sm">
            Ajustar local no mapa
          </Button>
        </div>
      )}

      {aviso && <p className="text-xs text-black/70 dark:text-white/70">{aviso}</p>}

      {erro && <p className="text-xs text-[var(--color-danger)]">{erro}</p>}

      <Button type="button" onClick={confirmar} className="text-sm">
        Confirmar endereço
      </Button>

      {ajuste && (
        <AjustarLocalTelaCheia
          inicial={ajuste}
          referenciaTexto={pontoDoTexto}
          onConfirmar={confirmarAjuste}
          onCancelar={() => setAjuste(null)}
        />
      )}
    </div>
  );
}
