"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import useEmblaCarousel from "embla-carousel-react";
import type { BannerCatalogo } from "@/lib/types";
import { cn } from "@/lib/utils";

const DELAY_IMAGEM_MS = 5000;

/**
 * Carrossel de banners da home — imagem ou vídeo, rotação automática + setas/
 * dots manuais + swipe (embla cuida do gesto de toque nativamente).
 *
 * Autoplay é implementado aqui na mão (sem o plugin embla-carousel-autoplay)
 * de propósito: numa primeira versão, o plugin tinha timer próprio que corria
 * em paralelo com o `stop()`/`play()` chamado a cada troca de slide pra
 * pausar em vídeo — mesmo tentando desligá-lo em slide de vídeo, o vídeo
 * ainda era cortado no meio (o timer interno do plugin reagendava sozinho
 * antes/depois da minha chamada, uma corrida que não dava pra garantir
 * vencer de fora). Um `setTimeout` só meu, criado e limpo dentro do próprio
 * `onSelect`, elimina essa corrida: nunca existe timer nenhum agendado
 * enquanto o slide ativo é vídeo — só quem decide avançar nesse caso é o
 * evento `onEnded` do próprio elemento de vídeo.
 */
export function BannerCarousel({ banners }: { banners: BannerCatalogo[] }) {
  const [emblaRef, emblaApi] = useEmblaCarousel({ loop: banners.length > 1 });
  const [selecionado, setSelecionado] = useState(0);
  // Todo navegador bloqueia autoplay de vídeo COM som — só é permitido
  // mudo. Por isso todo carrossel/feed com vídeo autoplay (Instagram,
  // TikTok, YouTube) nasce mudo com um botão pra ativar o som; replicado
  // aqui do mesmo jeito. Preferência vale pra qualquer vídeo do carrossel,
  // não só o atual — ativou uma vez, continua ativado ao trocar de slide.
  const [mudo, setMudo] = useState(true);
  const videoRefs = useRef<(HTMLVideoElement | null)[]>([]);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const onSelect = useCallback(() => {
    if (!emblaApi) return;
    const indice = emblaApi.selectedScrollSnap();
    setSelecionado(indice);

    videoRefs.current.forEach((video, i) => {
      if (!video) return;
      if (i === indice) {
        video.muted = mudo;
        video.currentTime = 0;
        video.play().catch(() => {});
      } else {
        video.pause();
      }
    });

    // Reagenda do zero a cada troca de slide (automática ou manual) — só
    // existe timer pendente quando o slide ativo é imagem. Slide de vídeo
    // nunca tem timer nenhum: quem avança é o onEnded do <video>.
    if (timerRef.current) clearTimeout(timerRef.current);
    if (banners.length > 1 && banners[indice]?.tipo !== "video") {
      timerRef.current = setTimeout(
        () => emblaApi.scrollNext(),
        DELAY_IMAGEM_MS,
      );
    }
  }, [emblaApi, mudo, banners]);

  useEffect(() => {
    videoRefs.current.forEach((video) => {
      if (video) video.muted = mudo;
    });
  }, [mudo]);

  useEffect(() => {
    if (!emblaApi) return;
    // Roda a sincronização inicial fora do corpo síncrono do efeito
    // (regra react-hooks/set-state-in-effect deste projeto) — mesmo
    // resultado do padrão do embla, só adiado um tick.
    const timer = setTimeout(onSelect, 0);
    emblaApi.on("select", onSelect);
    return () => {
      clearTimeout(timer);
      if (timerRef.current) clearTimeout(timerRef.current);
      emblaApi.off("select", onSelect);
    };
  }, [emblaApi, onSelect]);

  if (banners.length === 0) return null;

  return (
    <div className="flex flex-col gap-3">
      <div className="group relative overflow-hidden rounded-[var(--radius-xl)] bg-black/5 dark:bg-white/5">
        <div ref={emblaRef} className="overflow-hidden">
          <div className="flex">
            {banners.map((banner, i) => (
              <div key={banner.id} className="relative min-w-0 flex-[0_0_100%]">
                <BannerSlide
                  banner={banner}
                  videoRef={(el) => {
                    videoRefs.current[i] = el;
                  }}
                  onVideoEnded={() => {
                    // Único banner: não tem pra onde avançar (loop desligado
                    // com 1 slide só) — melhor repetir o vídeo do que travar
                    // no último frame.
                    if (banners.length <= 1) {
                      videoRefs.current[i]?.play().catch(() => {});
                    } else {
                      emblaApi?.scrollNext();
                    }
                  }}
                />
              </div>
            ))}
          </div>
        </div>

        {banners.length > 1 && (
          <>
            <button
              type="button"
              aria-label="Anterior"
              onClick={() => emblaApi?.scrollPrev()}
              className="absolute top-1/2 left-3 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-white/80 text-black opacity-0 shadow transition-opacity group-hover:opacity-100 focus-visible:opacity-100 sm:flex"
            >
              ‹
            </button>
            <button
              type="button"
              aria-label="Próximo"
              onClick={() => emblaApi?.scrollNext()}
              className="absolute top-1/2 right-3 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-white/80 text-black opacity-0 shadow transition-opacity group-hover:opacity-100 focus-visible:opacity-100 sm:flex"
            >
              ›
            </button>
          </>
        )}

        {banners[selecionado]?.tipo === "video" && (
          <button
            type="button"
            aria-label={mudo ? "Ativar som" : "Silenciar"}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setMudo((m) => !m);
            }}
            className="absolute top-3 right-3 flex h-9 w-9 items-center justify-center rounded-full bg-black/50 text-white backdrop-blur transition-colors hover:bg-black/70"
          >
            <IconeSom mudo={mudo} />
          </button>
        )}
      </div>

      {/* Fora do banner (não mais sobreposta na imagem) — a pedido do
        lojista. Precisa de cor própria agora: dentro da imagem o
        branco/translúcido contrastava com qualquer foto de fundo; aqui
        embaixo, sobre o fundo da página, usa a cor de marca pra continuar
        visível nos dois temas. */}
      {banners.length > 1 && (
        <div className="flex items-center justify-center gap-1.5">
          {banners.map((banner, i) => (
            <button
              key={banner.id}
              type="button"
              aria-label={`Ir pro banner ${i + 1}`}
              onClick={() => emblaApi?.scrollTo(i)}
              className={cn(
                "h-1.5 rounded-full transition-all",
                i === selecionado
                  ? "w-6 bg-[var(--brand-primary)]"
                  : "w-1.5 bg-black/15 dark:bg-white/20",
              )}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function IconeSom({ mudo }: { mudo: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-4.5 w-4.5"
    >
      <path d="M4 9v6h4l5 4V5L8 9H4Z" />
      {mudo ? (
        <path d="m19 9-5 5m0-5 5 5" />
      ) : (
        <path d="M17 8a5 5 0 0 1 0 8M19.5 5.5a9 9 0 0 1 0 13" />
      )}
    </svg>
  );
}

function BannerSlide({
  banner,
  videoRef,
  onVideoEnded,
}: {
  banner: BannerCatalogo;
  videoRef: (el: HTMLVideoElement | null) => void;
  onVideoEnded: () => void;
}) {
  const videoLocalRef = useRef<HTMLVideoElement | null>(null);
  // Encaminha o elemento pro ref do pai (que só precisa dele pra chamar
  // .play()/.pause()/.currentTime na troca de slide) e guarda uma cópia
  // local só pra alimentar o FundoDesfocado abaixo.
  const videoRefCombinado = (el: HTMLVideoElement | null) => {
    videoLocalRef.current = el;
    videoRef(el);
  };

  const conteudo = (
    <div className="relative aspect-[16/9] w-full sm:aspect-[21/9]">
      {banner.tipo === "video" ? (
        // object-contain (não object-cover) de propósito: diferente da
        // foto, o vídeo não passa por recorte no app antes de subir (sem
        // ferramenta de edição de vídeo), então cortar pra preencher o
        // quadro cortaria partes imprevisíveis do conteúdo. Mostra o vídeo
        // inteiro sempre — e em vez de deixar barra preta na sobra, um
        // espelho borrado/ampliado do MESMO elemento de vídeo (via canvas,
        // não um 2º <video src=...>) preenche o fundo. Achado 22/08/2026:
        // dois <video> com o mesmo src baixavam o arquivo duas vezes —
        // com o banner de vídeo tendo ~22MB, isso sozinho estourou a cota
        // de egress do Supabase em poucos dias.
        <div className="relative h-full w-full overflow-hidden bg-black">
          <FundoDesfocado videoRef={videoLocalRef} />
          <video
            ref={videoRefCombinado}
            src={banner.url}
            poster={banner.url_thumbnail ?? undefined}
            muted
            playsInline
            onEnded={onVideoEnded}
            className="relative z-10 h-full w-full object-contain"
          />
        </div>
      ) : (
        // <picture>+<source media> nativo em vez de duas <Image> alternadas
        // por CSS — as duas versões (desktop/mobile) ficavam no DOM ao
        // mesmo tempo com `priority` (carregamento antecipado forçado nas
        // DUAS), baixando o dobro do necessário em toda visita. Com
        // <picture>, o navegador escolhe e baixa só UMA versão, nativamente,
        // sem depender de CSS pra "esconder" a outra.
        <picture>
          {banner.url_mobile && <source media="(max-width: 639px)" srcSet={banner.url_mobile} />}
          <img
            src={banner.url}
            alt={banner.titulo ?? "Banner promocional"}
            fetchPriority="high"
            className="absolute inset-0 h-full w-full object-cover"
          />
        </picture>
      )}
      {banner.titulo && (
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent p-4 pt-10 sm:p-6 sm:pt-16">
          <p className="text-sm font-bold text-white sm:text-lg">
            {banner.titulo}
          </p>
        </div>
      )}
    </div>
  );

  if (banner.link_destino) {
    return (
      <Link href={banner.link_destino} className="block">
        {conteudo}
      </Link>
    );
  }
  return conteudo;
}

/**
 * Desenha o frame atual do vídeo (via `videoRef`, o MESMO elemento já
 * baixado pelo `<video>` principal) num canvas borrado/ampliado por trás —
 * mesmo efeito visual do antigo 2º `<video src=...>`, sem baixar o arquivo
 * de novo. Só roda o loop de desenho enquanto o vídeo de origem está
 * tocando de verdade (eventos play/pause do próprio elemento), pra não
 * gastar CPU à toa nos slides fora de tela.
 */
function FundoDesfocado({ videoRef }: { videoRef: React.RefObject<HTMLVideoElement | null> }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    let rafId: number | null = null;

    const desenhar = () => {
      const canvas = canvasRef.current;
      if (canvas && video.readyState >= 2 && video.videoWidth > 0) {
        if (canvas.width !== video.videoWidth) canvas.width = video.videoWidth;
        if (canvas.height !== video.videoHeight) canvas.height = video.videoHeight;
        canvas.getContext("2d")?.drawImage(video, 0, 0, canvas.width, canvas.height);
      }
      rafId = requestAnimationFrame(desenhar);
    };

    const iniciar = () => {
      if (rafId === null) rafId = requestAnimationFrame(desenhar);
    };
    const parar = () => {
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
        rafId = null;
      }
    };

    video.addEventListener("play", iniciar);
    video.addEventListener("pause", parar);
    video.addEventListener("ended", parar);
    if (!video.paused) iniciar();

    return () => {
      parar();
      video.removeEventListener("play", iniciar);
      video.removeEventListener("pause", parar);
      video.removeEventListener("ended", parar);
    };
  }, [videoRef]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      className="pointer-events-none absolute inset-0 h-full w-full scale-125 object-cover object-center blur-2xl brightness-[0.55] saturate-125"
    />
  );
}
