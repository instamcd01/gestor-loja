"use client";

import { useEffect, useRef } from "react";
import type { Map as LeafletMap } from "leaflet";
import "leaflet/dist/leaflet.css";

/**
 * Mapa pra conferir/ajustar o ponto de entrega — o pino fica fixo no centro
 * e o cliente arrasta o MAPA até a casa dele (mesmo padrão do iFood, mais
 * fácil no celular que arrastar um marcador pequeno). Existe porque o
 * geocoding erra em ruas de nome repetido ("Rua Um", "Rua 2"...) e antes o
 * cliente não tinha como corrigir se não estivesse em casa pra usar a
 * localização do aparelho (achado real 26/09: ponto caiu longe, pedido
 * virou retirada).
 *
 * Tiles do OpenStreetMap (sem chave de API — a chave do Google do projeto
 * é só de servidor). Leaflet é carregado só no navegador (`import()` dentro
 * do efeito), nunca no SSR.
 *
 * `lat`/`lng` de fora só recentralizam o mapa quando mudam por outro
 * motivo (nova busca, "centralizar no bairro") — o próprio arraste chama
 * `onMover` e não "briga" com o usuário.
 */
export function MapaAjustarPino({
  lat,
  lng,
  onMover,
}: {
  lat: number;
  lng: number;
  onMover: (lat: number, lng: number) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapaRef = useRef<LeafletMap | null>(null);
  const ultimoEmitidoRef = useRef<{ lat: number; lng: number } | null>(null);
  // Centro definido por código (criação/recentralização) — o `moveend`
  // que isso dispara não é arraste do cliente, não deve virar "ajuste".
  const alvoProgramaticoRef = useRef<{ lat: number; lng: number }>({ lat, lng });
  const onMoverRef = useRef(onMover);
  useEffect(() => {
    onMoverRef.current = onMover;
  }, [onMover]);

  useEffect(() => {
    let cancelado = false;
    let mapa: LeafletMap | null = null;
    (async () => {
      const L = await import("leaflet");
      if (cancelado || !containerRef.current) return;
      mapa = L.map(containerRef.current, { zoomControl: true, attributionControl: true }).setView(
        [lat, lng],
        17,
      );
      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: "&copy; OpenStreetMap",
      }).addTo(mapa);
      mapa.on("moveend", () => {
        const c = mapa!.getCenter();
        const alvo = alvoProgramaticoRef.current;
        if (Math.abs(alvo.lat - c.lat) < 1e-7 && Math.abs(alvo.lng - c.lng) < 1e-7) return;
        ultimoEmitidoRef.current = { lat: c.lat, lng: c.lng };
        onMoverRef.current(c.lat, c.lng);
      });
      mapaRef.current = mapa;
    })();
    return () => {
      cancelado = true;
      mapa?.remove();
      mapaRef.current = null;
    };
    // Cria o mapa uma vez só — recentralização é tratada no efeito abaixo.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const mapa = mapaRef.current;
    if (!mapa) return;
    const ultimo = ultimoEmitidoRef.current;
    if (ultimo && Math.abs(ultimo.lat - lat) < 1e-9 && Math.abs(ultimo.lng - lng) < 1e-9) return;
    alvoProgramaticoRef.current = { lat, lng };
    mapa.setView([lat, lng], Math.max(mapa.getZoom(), 16));
  }, [lat, lng]);

  return (
    <div className="relative isolate h-56 w-full overflow-hidden rounded-[var(--radius-md)] border border-black/10 dark:border-white/10">
      <div ref={containerRef} className="absolute inset-0 z-0" />
      {/* Pino fixo no centro — a ponta fica exatamente no centro do mapa. */}
      <div className="pointer-events-none absolute left-1/2 top-1/2 z-[500] -translate-x-1/2 -translate-y-full">
        <svg width="32" height="40" viewBox="0 0 32 40" aria-hidden="true">
          <path
            d="M16 0C7.2 0 0 7.1 0 15.9 0 27.8 16 40 16 40s16-12.2 16-24.1C32 7.1 24.8 0 16 0z"
            fill="var(--brand-primary, #1d4ed8)"
          />
          <circle cx="16" cy="16" r="6" fill="#fff" />
        </svg>
      </div>
    </div>
  );
}
