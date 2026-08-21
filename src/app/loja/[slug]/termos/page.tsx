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
  return { title: empresa ? `Termos e condições — ${empresa.nome}` : "Termos e condições" };
}

export default async function TermosPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const empresa = await getEmpresaPorSlug(slug);
  if (!empresa) notFound();

  const contato = empresa.whatsapp_catalogo
    ? `pelo WhatsApp (${empresa.whatsapp_catalogo})`
    : "pelos canais de atendimento da loja";

  return (
    <article className="mx-auto flex max-w-2xl flex-col gap-6 py-10 text-sm leading-relaxed text-black/80 dark:text-white/80">
      <div>
        <h1 className="text-2xl font-semibold text-black dark:text-white">Termos e condições</h1>
        <p className="mt-1 text-black/50 dark:text-white/50">{empresa.nome}</p>
      </div>

      <section className="flex flex-col gap-3">
        <h2 className="text-base font-semibold text-black dark:text-white">Coleta de dados e uso das informações</h2>
        <p>
          A {empresa.nome} coleta as informações necessárias pra viabilizar seu cadastro, processar seus pedidos e
          melhorar sua experiência de compra — nome, telefone, email, CPF ou CNPJ, endereço de entrega e histórico
          de pedidos. Alguns dados são obrigatórios pra concluir o cadastro (identificação e contato); outros, como
          gênero e data de nascimento, são opcionais e você decide se quer informar.
        </p>
        <p>
          Ao se cadastrar, você concorda em receber comunicações operacionais sobre seus pedidos (confirmação,
          status, entrega) pelos canais informados no cadastro. O envio de mensagens promocionais ou lembretes
          (como aviso de reposição de produtos) depende de um aceite específico e separado, que pode ser desativado
          a qualquer momento.
        </p>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-base font-semibold text-black dark:text-white">Cookies</h2>
        <p>
          Usamos cookies pra manter sua sessão ativa, lembrar itens do carrinho e melhorar a navegação no site. Você
          pode gerenciar ou desativar cookies diretamente nas configurações do seu navegador — desativá-los pode
          limitar algumas funcionalidades, como manter o carrinho entre visitas.
        </p>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-base font-semibold text-black dark:text-white">Segurança da informação</h2>
        <p>
          Toda comunicação entre seu navegador e nossos servidores é criptografada (HTTPS). Sua senha nunca é
          armazenada em texto simples — é protegida por criptografia de mão única, e nem a própria {empresa.nome}
          tem acesso a ela. CPF, CNPJ e dados de pagamento são tratados com o mesmo cuidado, seguindo as práticas de
          segurança da infraestrutura que hospeda o site.
        </p>
        <p>
          Recomendamos usar uma senha exclusiva para sua conta e nunca compartilhá-la com terceiros. Se desconfiar
          de acesso indevido à sua conta, entre em contato com a loja {contato} o quanto antes.
        </p>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-base font-semibold text-black dark:text-white">Compartilhamento de informações</h2>
        <p>
          Não vendemos nem compartilhamos seus dados pessoais com terceiros para fins de marketing. Compartilhamos
          apenas o estritamente necessário com prestadores de serviço que viabilizam a operação — como entregadores,
          processadores de pagamento e provedores de envio de SMS/WhatsApp — sempre limitado à finalidade de
          concluir seu pedido.
        </p>
        <p>Podemos divulgar informações quando exigido por lei ou ordem judicial.</p>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-base font-semibold text-black dark:text-white">Sua conta</h2>
        <p>
          Você pode entrar na sua conta por telefone (código enviado por SMS) ou por email e senha — as duas formas
          levam à mesma conta quando configuradas na sua conta. Cada forma de entrar exige sua própria confirmação
          antes de ficar ativa (o telefone, por SMS; o email, por um link de confirmação), justamente para impedir
          que outra pessoa consiga acessar sua conta usando um dado seu sem realmente ter acesso àquele telefone ou
          email.
        </p>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-base font-semibold text-black dark:text-white">Alterações</h2>
        <p>
          Estes termos podem ser atualizados periodicamente. A versão vigente é sempre a publicada nesta página.
          Dúvidas podem ser esclarecidas {contato}.
        </p>
      </section>
    </article>
  );
}
