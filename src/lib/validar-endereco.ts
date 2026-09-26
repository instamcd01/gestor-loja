import "server-only";
import { geocodificarEndereco, geocodificarReverso } from "@/lib/geocoding";
import type { EnderecoCliente } from "@/lib/types";

/** Distância em metros entre dois pontos (fórmula de haversine). */
export function distanciaMetros(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const rad = (g: number) => (g * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * 6_371_000 * Math.asin(Math.sqrt(h));
}

/** Tolerância entre o ponto e o endereço digitado, no modo "texto". */
export const TOLERANCIA_TEXTO_METROS = 400;

function montarQueryEndereco(e: EnderecoCliente): string {
  return [
    e.numero ? `${e.endereco ?? ""}, ${e.numero}` : e.endereco,
    e.bairro,
    e.cidade,
    e.estado,
    e.cep,
  ]
    .filter(Boolean)
    .join(", ");
}

export type ResultadoValidacaoEndereco =
  | { ok: true; endereco: EnderecoCliente }
  | { ok: false; motivo: "endereco_nao_confere" | "sem_rua_no_ponto"; erro: string };

/**
 * Garante que texto do endereço e ponto no mapa descrevem o MESMO lugar,
 * decidido no servidor (ver `EnderecoCliente.modoPonto`):
 * - "pino": rua/bairro/cidade/UF/CEP passam a vir da geocodificação reversa
 *   do ponto; só número/complemento continuam do cliente. Quem move o pino
 *   pra perto da loja recebe a entrega lá — sem ganho em trapacear.
 * - "texto" (ou ausente): o texto é geocodificado de novo e o ponto precisa
 *   estar a até 400 m de algum resultado — senão foi mexido à parte.
 */
export async function validarEnderecoEntrega(endereco: EnderecoCliente): Promise<ResultadoValidacaoEndereco> {
  const lat = Number(endereco.lat);
  const lng = Number(endereco.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
    return { ok: false, motivo: "endereco_nao_confere", erro: "Confirme o endereço de novo." };
  }

  if (endereco.modoPonto === "pino") {
    const reverso = await geocodificarReverso(lat, lng);
    if (!reverso?.endereco) {
      return {
        ok: false,
        motivo: "sem_rua_no_ponto",
        erro: "Não identificamos uma rua nesse ponto do mapa. Ajuste o pino em cima da sua rua.",
      };
    }
    return {
      ok: true,
      endereco: {
        ...endereco,
        endereco: reverso.endereco,
        bairro: reverso.bairro ?? endereco.bairro,
        cidade: reverso.cidade ?? endereco.cidade,
        estado: reverso.estado ?? endereco.estado,
        cep: reverso.cep ?? endereco.cep,
        lat,
        lng,
        modoPonto: "pino",
      },
    };
  }

  const candidatos = await geocodificarEndereco(montarQueryEndereco(endereco).slice(0, 300));
  const maisPerto = Math.min(...candidatos.map((c) => distanciaMetros({ lat, lng }, c)), Infinity);
  if (maisPerto > TOLERANCIA_TEXTO_METROS) {
    return {
      ok: false,
      motivo: "endereco_nao_confere",
      erro: "O ponto no mapa não confere com o endereço digitado. Busque o endereço de novo ou ajuste o local no mapa.",
    };
  }
  return { ok: true, endereco: { ...endereco, lat, lng, modoPonto: "texto" } };
}
