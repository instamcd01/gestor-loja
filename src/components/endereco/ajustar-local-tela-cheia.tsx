"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { buscarEnderecoPorLocalizacao } from "@/lib/checkout";
import type { CandidatoEndereco } from "@/lib/types";
import { MapaAjustarPino } from "./mapa-ajustar-pino";

/** Acima disso o pino é tratado como "longe do endereço digitado" e pede confirmação explícita. */
const LIMITE_AVISO_METROS = 300;

function distanciaMetros(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const rad = (g: number) => (g * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * 6_371_000 * Math.asin(Math.sqrt(h));
}

function formatarDistancia(m: number): string {
  return m >= 1000 ? `${(m / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} km` : `${Math.round(m)} m`;
}

/**
 * Tela cheia pra ajustar o ponto de entrega — o ÚNICO lugar onde o mapa é
 * interativo (a prévia no formulário fica travada, ver MapaAjustarPino).
 * Sem página pra rolar atrás, não tem como mexer no pino sem querer.
 *
 * Mostra em texto onde o pino está (geocodificação reversa) e, se o ponto
 * ficar longe do endereço digitado, pede confirmação dizendo que a entrega
 * passa a ser NESSE ponto — o endereço do pedido vira o do pino (ver
 * `EnderecoCliente.modoPonto`), então não existe "texto certo, pino longe".
 */
export function AjustarLocalTelaCheia({
  inicial,
  referenciaTexto,
  onConfirmar,
  onCancelar,
}: {
  inicial: { lat: number; lng: number };
  /** Ponto achado pela busca do endereço digitado (se houver) — base do aviso de distância. */
  referenciaTexto: { lat: number; lng: number; rotulo: string } | null;
  onConfirmar: (candidato: CandidatoEndereco) => void;
  onCancelar: () => void;
}) {
  const [ponto, setPonto] = useState(inicial);
  const [enderecoPino, setEnderecoPino] = useState<CandidatoEndereco | null>(null);
  const [identificando, setIdentificando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [confirmandoDistancia, setConfirmandoDistancia] = useState<number | null>(null);
  const [localizando, setLocalizando] = useState(false);
  const requisicaoRef = useRef(0);

  // Trava a rolagem da página por trás enquanto a tela cheia está aberta.
  useEffect(() => {
    const anterior = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const aoTeclar = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancelar();
    };
    window.addEventListener("keydown", aoTeclar);
    return () => {
      document.body.style.overflow = anterior;
      window.removeEventListener("keydown", aoTeclar);
    };
  }, [onCancelar]);

  // Endereço do pino, com espera curta depois que o mapa para — evita uma
  // chamada paga ao Google por cada pixel arrastado.
  useEffect(() => {
    const id = ++requisicaoRef.current;
    const t = setTimeout(async () => {
      try {
        const r = await buscarEnderecoPorLocalizacao(ponto.lat, ponto.lng);
        if (id !== requisicaoRef.current) return;
        setEnderecoPino(r);
        setErro(r?.endereco ? null : "Não identificamos uma rua aqui — coloque o pino em cima da sua rua.");
      } catch {
        if (id === requisicaoRef.current) setErro("Não foi possível identificar o endereço agora. Tente de novo.");
      } finally {
        if (id === requisicaoRef.current) setIdentificando(false);
      }
    }, 700);
    return () => clearTimeout(t);
  }, [ponto]);

  function mover(lat: number, lng: number) {
    setConfirmandoDistancia(null);
    setIdentificando(true);
    setPonto({ lat, lng });
  }

  // Leva o mapa até onde o aparelho está — quem ajusta o pino quase sempre
  // está em casa (pedido do usuário 26/09: "centralizar deveria ir até a
  // localização da pessoa e não do bairro").
  function irParaMinhaLocalizacao() {
    if (!("geolocation" in navigator)) {
      setErro("Seu navegador não permite compartilhar localização — arraste o mapa até sua casa.");
      return;
    }
    setLocalizando(true);
    setErro(null);
    navigator.geolocation.getCurrentPosition(
      (posicao) => {
        setLocalizando(false);
        mover(posicao.coords.latitude, posicao.coords.longitude);
      },
      () => {
        setLocalizando(false);
        setErro("Não foi possível acessar sua localização — arraste o mapa até sua casa.");
      },
      { enableHighAccuracy: true, timeout: 10_000 },
    );
  }

  function confirmar() {
    if (identificando || !enderecoPino?.endereco) return;
    const candidato: CandidatoEndereco = { ...enderecoPino, lat: ponto.lat, lng: ponto.lng };
    if (referenciaTexto && confirmandoDistancia == null) {
      const d = distanciaMetros(referenciaTexto, ponto);
      if (d > LIMITE_AVISO_METROS) {
        setConfirmandoDistancia(d);
        return;
      }
    }
    onConfirmar(candidato);
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Ajustar local de entrega no mapa"
      className="fixed inset-0 z-[1000] flex flex-col bg-[var(--surface,#fff)] dark:bg-neutral-900"
    >
      <div className="flex items-center justify-between gap-2 border-b border-black/10 px-4 py-3 dark:border-white/10">
        <p className="text-sm font-semibold">Arraste o mapa até o pino ficar na sua casa</p>
        <button type="button" onClick={onCancelar} className="text-sm text-black/60 hover:underline dark:text-white/60">
          Cancelar
        </button>
      </div>

      <div className="relative min-h-0 flex-1">
        <MapaAjustarPino
          lat={ponto.lat}
          lng={ponto.lng}
          onMover={mover}
          interativo
          className="h-full rounded-none border-0"
        />
      </div>

      <div className="flex flex-col gap-2 border-t border-black/10 p-4 pb-[max(1rem,env(safe-area-inset-bottom))] dark:border-white/10">
        <p className="text-xs text-black/60 dark:text-white/60">Pino em:</p>
        <p className="min-h-5 text-sm font-medium">
          {identificando ? "Identificando endereço..." : (enderecoPino?.formattedAddress ?? "—")}
        </p>
        {erro && <p className="text-xs text-[var(--color-danger)]">{erro}</p>}

        {confirmandoDistancia != null && referenciaTexto ? (
          <div className="flex flex-col gap-2 rounded-[var(--radius-md)] border border-[var(--color-danger)]/40 bg-[var(--color-danger)]/5 p-3">
            <p className="text-sm">
              Esse ponto está a <strong>{formatarDistancia(confirmandoDistancia)}</strong> do endereço que você digitou (
              {referenciaTexto.rotulo}). A entrega e o frete passam a ser <strong>nesse ponto do mapa</strong>.
            </p>
            <Button type="button" onClick={() => onConfirmar({ ...enderecoPino!, lat: ponto.lat, lng: ponto.lng })}>
              Sim, entregar nesse ponto
            </Button>
            <Button type="button" variant="secondary" onClick={() => setConfirmandoDistancia(null)}>
              Voltar e ajustar o pino
            </Button>
          </div>
        ) : (
          <>
            <Button type="button" onClick={confirmar} disabled={identificando || !enderecoPino?.endereco}>
              Confirmar este ponto
            </Button>
            <button
              type="button"
              onClick={irParaMinhaLocalizacao}
              disabled={localizando}
              className="self-center text-xs text-[var(--brand-primary)] underline underline-offset-2 disabled:opacity-50"
            >
              {localizando ? "Localizando..." : "📍 Ir para minha localização"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
