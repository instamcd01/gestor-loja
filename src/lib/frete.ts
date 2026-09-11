import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { EnderecoCliente, OpcaoFrete } from "@/lib/types";

function montarEndereco(partes: {
  endereco?: string | null;
  numero?: string | null;
  bairro?: string | null;
  cidade?: string | null;
  estado?: string | null;
  cep?: string | null;
}): string | null {
  const linhas: string[] = [];
  if (partes.endereco) {
    linhas.push(partes.numero ? `${partes.endereco}, ${partes.numero}` : partes.endereco);
  }
  if (partes.bairro) linhas.push(partes.bairro);
  if (partes.cidade) linhas.push(partes.estado ? `${partes.cidade} - ${partes.estado}` : partes.cidade);
  if (partes.cep) linhas.push(partes.cep);
  return linhas.length > 0 ? linhas.join(", ") : null;
}

/**
 * Distância real de rota (carro), não linha reta — mesma API e mesma
 * chave já usadas no app Flutter (`DistanciaService.calcularRota`).
 * Chamada só do servidor: GOOGLE_MAPS_API_KEY não tem prefixo
 * NEXT_PUBLIC_, nunca chega no bundle do browser.
 *
 * Usa a Directions API com alternatives=true e fica com a rota de MENOR
 * distância, não a Distance Matrix (que devolve só uma rota, a que o
 * Google prioriza por critério próprio — nem sempre a mais curta). Achado
 * real 12/09 no app Flutter: Distance Matrix dava 6,1km numa rota que o
 * próprio Google, pedindo alternativas, também oferecia em 4,4km (mesmo
 * tempo) — cobrar pela mais longa penalizava o cliente sem motivo. Mesmo
 * bug existia aqui, idêntico.
 */
async function calcularDistanciaKm(origem: string, destino: string): Promise<number | null> {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  if (!apiKey) return null;

  const url = new URL("https://maps.googleapis.com/maps/api/directions/json");
  url.searchParams.set("origin", origem);
  url.searchParams.set("destination", destino);
  url.searchParams.set("mode", "driving");
  url.searchParams.set("alternatives", "true");
  url.searchParams.set("units", "metric");
  url.searchParams.set("key", apiKey);

  try {
    const resposta = await fetch(url, { signal: AbortSignal.timeout(10_000) });
    const json = await resposta.json();

    if (json.status !== "OK") return null;
    const rotas: Array<{ legs?: Array<{ distance?: { value: number } }> }> = json.routes ?? [];
    const distanciasM = rotas
      .map((rota) => rota.legs?.[0]?.distance?.value)
      .filter((valor): valor is number => typeof valor === "number");
    if (distanciasM.length === 0) return null;

    return Math.min(...distanciasM) / 1000;
  } catch {
    return null;
  }
}

export type ResultadoFrete =
  | { disponivel: true; opcao: OpcaoFrete; distanciaKm: number }
  | { disponivel: false; motivo: "sem_endereco" | "fora_de_area" | "erro_distancia" };

export async function calcularFrete(
  empresaId: string,
  enderecoEmpresa: { endereco: string | null; cidade: string | null; estado: string | null; cep: string | null },
  enderecoCliente: EnderecoCliente,
  subtotal: number,
): Promise<ResultadoFrete> {
  const origem = montarEndereco(enderecoEmpresa);

  // Coordenadas confirmadas (geocodificação com desambiguação, ou
  // geolocalização do navegador) são bem mais precisas que o texto do
  // endereço — importante em ruas longas/numéricas, onde geocodificar só
  // o texto pode acertar a rua errada e mudar vários km na distância real.
  const destino =
    enderecoCliente.lat != null && enderecoCliente.lng != null
      ? `${enderecoCliente.lat},${enderecoCliente.lng}`
      : montarEndereco(enderecoCliente);

  if (!origem || !destino) return { disponivel: false, motivo: "sem_endereco" };

  const distanciaKm = await calcularDistanciaKm(origem, destino);
  if (distanciaKm == null) return { disponivel: false, motivo: "erro_distancia" };

  const supabase = await createClient();
  const { data } = await supabase
    .rpc("calcular_frete_site", {
      p_empresa_id: empresaId,
      p_distancia_km: distanciaKm,
      p_subtotal: subtotal,
    })
    .maybeSingle();

  if (!data) return { disponivel: false, motivo: "fora_de_area" };

  return { disponivel: true, opcao: data as OpcaoFrete, distanciaKm };
}
