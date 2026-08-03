"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { buscarEnderecoCandidatos, buscarEnderecoPorLocalizacao } from "@/lib/checkout";
import type { CandidatoEndereco, EnderecoCliente } from "@/lib/types";

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
};

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
  const [candidatos, setCandidatos] = useState<CandidatoEndereco[] | null>(null);
  const [buscando, setBuscando] = useState(false);
  const [localizando, setLocalizando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const resolvido = campos.lat != null && campos.lng != null;

  function atualizarCampo(campo: keyof EnderecoCliente, valor: string) {
    setErro(null);
    setCandidatos(null);
    setCampos((atual) => ({
      ...atual,
      [campo]: valor,
      ...(CAMPOS_LOCALIZACAO.includes(campo as (typeof CAMPOS_LOCALIZACAO)[number])
        ? { lat: null, lng: null }
        : {}),
    }));
  }

  function aplicarCandidato(c: CandidatoEndereco) {
    setCandidatos(null);
    setErro(null);
    setCampos((atual) => ({
      ...atual,
      endereco: c.endereco ?? atual.endereco,
      bairro: c.bairro ?? atual.bairro,
      cidade: c.cidade ?? atual.cidade,
      estado: c.estado ?? atual.estado,
      cep: c.cep ?? atual.cep,
      lat: c.lat,
      lng: c.lng,
    }));
  }

  async function buscarEndereco() {
    const query = montarQuery(campos);
    if (!query) {
      setErro("Preencha ao menos rua e cidade pra buscar.");
      return;
    }
    setBuscando(true);
    setErro(null);
    const resultados = await buscarEnderecoCandidatos(query);
    setBuscando(false);

    if (resultados.length === 0) {
      setErro("Não encontramos esse endereço. Confira os dados e tente de novo.");
      return;
    }
    if (resultados.length === 1) {
      aplicarCandidato(resultados[0]);
      return;
    }
    setCandidatos(resultados);
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
        const candidato = await buscarEnderecoPorLocalizacao(
          posicao.coords.latitude,
          posicao.coords.longitude,
        );
        setLocalizando(false);
        if (!candidato) {
          setErro("Não conseguimos identificar seu endereço pela localização. Digite manualmente.");
          return;
        }
        aplicarCandidato(candidato);
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
              onClick={() => aplicarCandidato(c)}
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

      {resolvido && (
        <p className="text-xs font-medium text-[var(--color-success)]">Endereço localizado ✓</p>
      )}

      {erro && <p className="text-xs text-[var(--color-danger)]">{erro}</p>}

      <Button type="button" onClick={confirmar} className="text-sm">
        Confirmar endereço
      </Button>
    </div>
  );
}
