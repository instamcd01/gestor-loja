/**
 * Linha fina e discreta logo abaixo do header, só na home (substituiu o
 * antigo card `PetcashBanner`, removido — chamativo demais e mostrava o
 * percentual). Só um lembrete neutro da mecânica — ganha no pedido do
 * site, usa como desconto depois — sem número. Texto curto de propósito +
 * `truncate` como rede de segurança: precisa caber numa linha só mesmo no
 * mobile mais estreito.
 */
export function PetcashFaixaInfo({ petcashAtivo }: { petcashAtivo: boolean }) {
  if (!petcashAtivo) return null;

  return (
    <div className="truncate border-b border-black/5 bg-black/[0.02] px-4 py-1.5 text-center text-[11px] text-black/50 dark:border-white/10 dark:bg-white/[0.03] dark:text-white/50">
      🪙 Ganhe PetCash em pedidos feitos pelo site
    </div>
  );
}
