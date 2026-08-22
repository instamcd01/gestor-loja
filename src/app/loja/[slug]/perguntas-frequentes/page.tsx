import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getEmpresaPorSlug } from "@/lib/catalogo";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const empresa = await getEmpresaPorSlug(slug);
  return { title: empresa ? `Perguntas frequentes — ${empresa.nome}` : "Perguntas frequentes" };
}

function Pergunta({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <details className="group rounded-[var(--radius-md)] border border-black/10 p-4 dark:border-white/10">
      <summary className="cursor-pointer list-none text-sm font-semibold text-black dark:text-white marker:content-none">
        <span className="flex items-center justify-between gap-3">
          {titulo}
          <span className="shrink-0 text-black/40 transition-transform group-open:rotate-45 dark:text-white/40">
            +
          </span>
        </span>
      </summary>
      <div className="mt-3 text-sm leading-relaxed text-black/70 dark:text-white/70">{children}</div>
    </details>
  );
}

export default async function PerguntasFrequentesPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const empresa = await getEmpresaPorSlug(slug);
  if (!empresa) notFound();

  const contato = empresa.whatsapp_catalogo
    ? `pelo WhatsApp (${empresa.whatsapp_catalogo})`
    : "pelos canais de atendimento da loja";

  return (
    <article className="mx-auto flex max-w-2xl flex-col gap-6 py-10">
      <div>
        <h1 className="text-2xl font-semibold text-black dark:text-white">Perguntas frequentes</h1>
        <p className="mt-1 text-sm text-black/50 dark:text-white/50">{empresa.nome}</p>
      </div>

      <div className="flex flex-col gap-3">
        <Pergunta titulo="Quanto tempo demora pra chegar?">
          <p>
            Depende da distância até o seu endereço e da modalidade escolhida (Expressa, Econômica ou Agendada) — o
            prazo exato aparece no carrinho antes de fechar o pedido. Detalhes completos na{" "}
            <a href={`/loja/${slug}/entrega`} className="underline">
              Política de entrega
            </a>
            .
          </p>
        </Pergunta>

        <Pergunta titulo="Quais formas de pagamento vocês aceitam?">
          <p>Pix e cartão de crédito/débito, processados pelo Mercado Pago, além do seu saldo e PetCash da loja.</p>
        </Pergunta>

        <Pergunta titulo="O que é o PetCash?">
          <p>
            É o cashback da loja: parte do valor das suas compras volta como saldo pra usar em pedidos futuros. O
            saldo acumulado e a validade de cada crédito aparecem na sua conta.
          </p>
        </Pergunta>

        <Pergunta titulo="Posso trocar ou devolver um produto?">
          <p>
            Pode — você tem até 7 dias após o recebimento pra desistir da compra, sem precisar justificar, e a troca
            é sempre gratuita se o produto vier com defeito. Detalhes em{" "}
            <a href={`/loja/${slug}/trocas-e-devolucoes`} className="underline">
              Trocas e devoluções
            </a>
            .
          </p>
        </Pergunta>

        <Pergunta titulo="Como acompanho meu pedido?">
          <p>
            Na sua conta, em{" "}
            <a href={`/loja/${slug}/pedidos`} className="underline">
              Meus Pedidos
            </a>
            , você vê o status atualizado de cada compra.
          </p>
        </Pergunta>

        <Pergunta titulo="Vocês entregam no meu bairro?">
          <p>
            Digite seu endereço no carrinho — se estiver dentro da nossa área de cobertura, a taxa e o prazo aparecem
            na hora. Se estiver fora, avisamos antes de qualquer cobrança.
          </p>
        </Pergunta>

        <Pergunta titulo="Como entro em contato com vocês?">
          <p>Chame a gente {contato} — é o canal mais rápido pra qualquer dúvida sobre pedido, entrega ou produto.</p>
        </Pergunta>
      </div>
    </article>
  );
}
