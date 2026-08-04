"use client";

import { useEffect, useState } from "react";

// Página temporária pra rodar o Cadastro Incorporado do WhatsApp e reconectar
// o número real (146565271871000) à Cloud API. Apagar depois de usar.
export default function WppSignupPage() {
  const [log, setLog] = useState<string[]>([]);

  function addLog(msg: string) {
    setLog((prev) => [...prev, msg]);
  }

  useEffect(() => {
    (window as any).fbAsyncInit = function () {
      (window as any).FB.init({
        appId: "792354710007372",
        cookie: true,
        xfbml: true,
        version: "v21.0",
      });
      addLog("SDK do Facebook carregado.");
    };

    const script = document.createElement("script");
    script.src = "https://connect.facebook.net/pt_BR/sdk.js";
    script.async = true;
    script.defer = true;
    script.crossOrigin = "anonymous";
    document.body.appendChild(script);

    function handleMessage(event: MessageEvent) {
      if (event.origin !== "https://www.facebook.com" && event.origin !== "https://web.facebook.com") return;
      addLog("Mensagem do Embedded Signup: " + JSON.stringify(event.data));
    }
    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, []);

  function launchSignup() {
    (window as any).FB.login(
      function (response: any) {
        addLog("Resposta do login: " + JSON.stringify(response, null, 2));
        const code = response?.authResponse?.code;
        if (code) {
          addLog("Trocando o code pelo token no servidor...");
          const redirectUri = window.location.origin + window.location.pathname;
          addLog("redirect_uri usado: " + redirectUri);
          fetch("/api/wpp-signup-exchange", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ code, redirectUri }),
          })
            .then((r) => r.json())
            .then((data) => addLog("Resposta da troca: " + JSON.stringify(data, null, 2)))
            .catch((err) => addLog("Erro na troca: " + String(err)));
        }
      },
      {
        config_id: "1806146204132974",
        response_type: "code",
        override_default_response_type: true,
        extras: {
          setup: {},
          featureType: "",
          sessionInfoVersion: "3",
        },
      },
    );
  }

  return (
    <div style={{ padding: 24, fontFamily: "sans-serif" }}>
      <h2>Reconectar número existente à Cloud API</h2>
      <p>App: [n8n] WPP Delivery Pet (792354710007372) — Config ID: 1806146204132974</p>
      <button onClick={launchSignup} style={{ padding: "10px 20px", fontSize: 16 }}>
        Reconectar número da Delivery Pet
      </button>
      <pre style={{ background: "#eee", padding: 10, marginTop: 20, whiteSpace: "pre-wrap" }}>
        {log.join("\n")}
      </pre>
    </div>
  );
}
