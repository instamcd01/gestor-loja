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
  return { title: empresa ? `Política de privacidade — ${empresa.nome}` : "Política de privacidade" };
}

export default async function PrivacidadePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const empresa = await getEmpresaPorSlug(slug);
  if (!empresa) notFound();

  const contato = empresa.whatsapp_catalogo
    ? `pelo WhatsApp (${empresa.whatsapp_catalogo})`
    : "pelos canais de atendimento da loja";

  return (
    <article className="mx-auto flex max-w-2xl flex-col gap-6 py-10 text-sm leading-relaxed text-black/80 dark:text-white/80">
      <div>
        <h1 className="text-2xl font-semibold text-black dark:text-white">Política de privacidade</h1>
        <p className="mt-1 text-black/50 dark:text-white/50">{empresa.nome}</p>
      </div>

      <section className="flex flex-col gap-3">
        <p>
          Esta política explica, de acordo com a Lei Geral de Proteção de Dados (LGPD), como a {empresa.nome} coleta,
          usa e protege seus dados pessoais ao usar este site. Ela complementa os{" "}
          <a href={`/loja/${slug}/termos`} className="underline">
            Termos e condições
          </a>
          , que também tratam de cookies e segurança da informação.
        </p>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-base font-semibold text-black dark:text-white">Quem trata seus dados</h2>
        <p>
          A {empresa.nome} é a responsável pelo tratamento dos seus dados pessoais coletados neste site. Dúvidas
          sobre privacidade podem ser esclarecidas {contato}.
        </p>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-base font-semibold text-black dark:text-white">Base legal de cada tratamento</h2>
        <p>Cada dado que coletamos tem uma finalidade específica e uma base legal correspondente:</p>
        <ul className="flex list-disc flex-col gap-1.5 pl-5">
          <li>
            <strong>Execução de contrato</strong>: nome, contato, endereço e dados de pagamento, usados pra processar
            e entregar seu pedido.
          </li>
          <li>
            <strong>Cumprimento de obrigação legal</strong>: CPF ou CNPJ, exigidos para emissão de nota fiscal.
          </li>
          <li>
            <strong>Legítimo interesse</strong>: histórico de pedidos e comportamento de navegação, usados pra
            melhorar sua experiência de compra (ex: lembrar itens do carrinho).
          </li>
          <li>
            <strong>Consentimento</strong>: envio de mensagens promocionais ou lembretes de reposição — sempre
            opcional, com aceite separado que pode ser revogado a qualquer momento.
          </li>
        </ul>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-base font-semibold text-black dark:text-white">Com quem compartilhamos</h2>
        <p>
          Não vendemos seus dados. Compartilhamos apenas o necessário com prestadores que viabilizam a operação:
          processador de pagamento (Mercado Pago), provedor de envio de email e SMS, e a infraestrutura que hospeda o
          site e o banco de dados — essa infraestrutura opera fora do Brasil, o que pode envolver transferência
          internacional dos seus dados, sempre sob os mesmos padrões de proteção exigidos pela LGPD.
        </p>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-base font-semibold text-black dark:text-white">Por quanto tempo guardamos seus dados</h2>
        <p>
          Mantemos seus dados enquanto sua conta estiver ativa e pelo prazo adicional exigido por lei (ex: dados
          fiscais de pedidos). Você pode pedir a exclusão da sua conta a qualquer momento — ver seção de direitos
          abaixo.
        </p>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-base font-semibold text-black dark:text-white">Seus direitos</h2>
        <p>A LGPD garante que você pode, a qualquer momento e mediante solicitação {contato}:</p>
        <ul className="flex list-disc flex-col gap-1.5 pl-5">
          <li>Confirmar se tratamos seus dados e acessar quais dados temos sobre você.</li>
          <li>Corrigir dados incompletos, desatualizados ou incorretos.</li>
          <li>Pedir a anonimização, bloqueio ou eliminação de dados desnecessários ou tratados em desacordo com a lei.</li>
          <li>Solicitar a portabilidade dos seus dados para outro fornecedor.</li>
          <li>Revogar, a qualquer momento, um consentimento dado anteriormente (ex: lembretes promocionais).</li>
          <li>Pedir a exclusão dos dados tratados com base no seu consentimento.</li>
          <li>Se opor a um tratamento feito com base em legítimo interesse.</li>
        </ul>
        <p>Respondemos essas solicitações dentro do prazo previsto em lei.</p>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-base font-semibold text-black dark:text-white">Alterações</h2>
        <p>
          Esta política pode ser atualizada periodicamente. A versão vigente é sempre a publicada nesta página.
          Dúvidas podem ser esclarecidas {contato}.
        </p>
      </section>
    </article>
  );
}
