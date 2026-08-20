/**
 * Linha fina e discreta logo abaixo do header, presente no site inteiro
 * (diferente do `PetcashBanner`, que só aparece na home e é um card
 * chamativo com o percentual). Aqui é só um lembrete neutro de que o
 * PetCash existe — sem casas decimais/percentual, só a mecânica (ganha no
 * pedido do site, usa como desconto depois). Mesma condição de exibição do
 * `PetcashBanner`: some se a loja não tem PetCash ativo.
 */
export function PetcashFaixaInfo({ petcashAtivo }: { petcashAtivo: boolean }) {
  if (!petcashAtivo) return null;

  return (
    <div className="border-b border-black/5 bg-black/[0.02] px-4 py-1.5 text-center text-[11px] text-black/50 dark:border-white/10 dark:bg-white/[0.03] dark:text-white/50">
      Ganhe PetCash em pedidos feitos pelo site e use como desconto nas próximas compras.
    </div>
  );
}
