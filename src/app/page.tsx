/**
 * Multi-tenant: não existe "a loja", existe uma loja por slug em /loja/[slug].
 * Em produção, o domínio próprio de cada empresa (ou um subdomínio) deve
 * reescrever para essa rota via middleware — ainda não implementado.
 */
export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-2 px-4 text-center">
      <h1 className="text-xl font-semibold">Gestor Loja</h1>
      <p className="max-w-sm text-sm text-black/50 dark:text-white/50">
        Acesse o catálogo de uma loja específica em{" "}
        <code className="rounded bg-black/5 px-1.5 py-0.5 dark:bg-white/10">
          /loja/[slug]
        </code>
        .
      </p>
    </main>
  );
}
