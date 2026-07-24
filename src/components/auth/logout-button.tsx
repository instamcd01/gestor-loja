"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";

export function LogoutButton({ slug }: { slug: string }) {
  const router = useRouter();
  const [saindo, setSaindo] = useState(false);
  const supabase = createClient();

  async function sair() {
    setSaindo(true);
    await supabase.auth.signOut();
    router.push(`/loja/${slug}`);
    router.refresh();
  }

  return (
    <Button variant="ghost" onClick={sair} disabled={saindo}>
      {saindo ? "Saindo..." : "Sair"}
    </Button>
  );
}
