"use client";

import { useEffect, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { useSessao } from "@/components/auth/sessao-provider";

/**
 * Só faz algo dentro do app nativo (Capacitor) — no navegador comum
 * `Capacitor.isNativePlatform()` é false e o componente não faz nada.
 * Import dinâmico: @capacitor/core e @capacitor/push-notifications tocam
 * APIs nativas que só existem quando rodando dentro do WebView do app,
 * então só carregam depois de confirmar a plataforma (evita puxar esse
 * código no bundle da versão web do site à toa).
 */
export function PushNotificationsRegistrador() {
  const logado = useSessao();
  const tokenRegistradoRef = useRef<string | null>(null);
  const logadoAnteriorRef = useRef(logado);

  useEffect(() => {
    if (!logado) return;

    let cancelado = false;
    const listeners: { remove: () => void }[] = [];

    (async () => {
      const { Capacitor } = await import("@capacitor/core");
      if (!Capacitor.isNativePlatform()) return;

      const { PushNotifications } = await import("@capacitor/push-notifications");

      const permissaoAtual = await PushNotifications.checkPermissions();
      let status = permissaoAtual.receive;
      if (status === "prompt" || status === "prompt-with-rationale") {
        status = (await PushNotifications.requestPermissions()).receive;
      }
      if (status !== "granted" || cancelado) return;

      listeners.push(
        await PushNotifications.addListener("registration", async (token) => {
          tokenRegistradoRef.current = token.value;
          const supabase = createClient();
          const plataforma = Capacitor.getPlatform() === "ios" ? "ios" : "android";
          const { error } = await supabase.rpc("registrar_push_token", {
            p_token: token.value,
            p_plataforma: plataforma,
          });
          if (error) console.error("Falha ao registrar push token:", error.message);
        }),
      );

      listeners.push(
        await PushNotifications.addListener("registrationError", (erro) => {
          console.error("Erro ao registrar push notification:", erro);
        }),
      );

      await PushNotifications.register();
    })();

    return () => {
      cancelado = true;
      listeners.forEach((listener) => listener.remove());
    };
  }, [logado]);

  // Ao deslogar, desvincula o token do device pra parar de receber push da
  // conta anterior — um novo login re-registra (upsert por token na RPC).
  useEffect(() => {
    const eraLogado = logadoAnteriorRef.current;
    logadoAnteriorRef.current = logado;
    if (eraLogado && !logado && tokenRegistradoRef.current) {
      const token = tokenRegistradoRef.current;
      tokenRegistradoRef.current = null;
      createClient()
        .rpc("remover_push_token", { p_token: token })
        .then(({ error }) => {
          if (error) console.error("Falha ao remover push token:", error.message);
        });
    }
  }, [logado]);

  return null;
}
