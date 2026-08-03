import "server-only";
import type { CandidatoEndereco } from "@/lib/types";

interface AddressComponent {
  long_name: string;
  short_name: string;
  types: string[];
}

interface GeocodeResult {
  formatted_address: string;
  address_components: AddressComponent[];
  geometry: { location: { lat: number; lng: number } };
}

function extrairComponente(
  componentes: AddressComponent[],
  tipos: string[],
  usarNomeCurto = false,
): string | null {
  for (const tipo of tipos) {
    const componente = componentes.find((c) => c.types.includes(tipo));
    if (componente) return usarNomeCurto ? componente.short_name : componente.long_name;
  }
  return null;
}

function paraCandidato(resultado: GeocodeResult): CandidatoEndereco {
  const comp = resultado.address_components;
  return {
    formattedAddress: resultado.formatted_address,
    lat: resultado.geometry.location.lat,
    lng: resultado.geometry.location.lng,
    endereco: extrairComponente(comp, ["route"]),
    bairro: extrairComponente(comp, ["sublocality", "sublocality_level_1", "neighborhood"]),
    cidade: extrairComponente(comp, ["administrative_area_level_2", "locality"]),
    estado: extrairComponente(comp, ["administrative_area_level_1"], true),
    cep: extrairComponente(comp, ["postal_code"]),
  };
}

/**
 * Geocodifica um endereço digitado e devolve TODOS os resultados, não só
 * o primeiro — em ruas numéricas ou nomes repetidos entre bairros (ex:
 * "Rua 7" existir em vários lugares da mesma cidade), o Google retorna
 * mais de um resultado plausível; quem chama decide se pede confirmação
 * ao usuário quando isso acontece.
 */
export async function geocodificarEndereco(query: string): Promise<CandidatoEndereco[]> {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  if (!apiKey || !query.trim()) return [];

  const url = new URL("https://maps.googleapis.com/maps/api/geocode/json");
  url.searchParams.set("address", query);
  url.searchParams.set("region", "br");
  url.searchParams.set("key", apiKey);

  try {
    const resposta = await fetch(url, { signal: AbortSignal.timeout(10_000) });
    const json = await resposta.json();
    if (json.status !== "OK") return [];
    return (json.results as GeocodeResult[]).map(paraCandidato);
  } catch {
    return [];
  }
}

/** Geocodificação reversa — usada quando o cliente compartilha a localização do navegador (igual ao iFood). */
export async function geocodificarReverso(lat: number, lng: number): Promise<CandidatoEndereco | null> {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  if (!apiKey) return null;

  const url = new URL("https://maps.googleapis.com/maps/api/geocode/json");
  url.searchParams.set("latlng", `${lat},${lng}`);
  url.searchParams.set("key", apiKey);

  try {
    const resposta = await fetch(url, { signal: AbortSignal.timeout(10_000) });
    const json = await resposta.json();
    if (json.status !== "OK" || !json.results?.[0]) return null;
    return paraCandidato(json.results[0]);
  } catch {
    return null;
  }
}
