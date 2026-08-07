"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import useEmblaCarousel from "embla-carousel-react";
import Autoplay from "embla-carousel-autoplay";
import type { BannerCatalogo } from "@/lib/types";
import { cn } from "@/lib/utils";

/**
 * Carrossel de banners da home — imagem ou vídeo, rotação automática (pausa
 * ao interagir, retoma depois) + setas/dots manuais + swipe (embla cuida do
 * gesto de toque nativamente). Só o vídeo do slide ativo toca de verdade
 * (os outros ficam pausados) pra não gastar banda/bateria à toa com vários
 * vídeos escondidos rodando ao mesmo tempo.
 */
export function BannerCarousel({ banners }: { banners: BannerCatalogo[] }) {
  // stopOnMouseEnter fica de fora de propósito: o plugin retomaria o
  // cronômetro fixo sozinho ao tirar o mouse de cima, mesmo em cima de um
  // slide de vídeo — atropelando o controle manual (stop/play por tipo de
  // slide) feito em onSelect, que é quem garante que vídeo só passa pro
  // próximo quando termina de tocar, não num tempo fixo.
  const [emblaRef, emblaApi] = useEmblaCarousel({ loop: banners.length > 1 }, [
    Autoplay({ delay: 5000, stopOnInteraction: false }),
  ]);
  const [selecionado, setSelecionado] = useState(0);
  // Todo navegador bloqueia autoplay de vídeo COM som — só é permitido
  // mudo. Por isso todo carrossel/feed com vídeo autoplay (Instagram,
  // TikTok, YouTube) nasce mudo com um botão pra ativar o som; replicado
  // aqui do mesmo jeito. Preferência vale pra qualquer vídeo do carrossel,
  // não só o atual — ativou uma vez, continua ativado ao trocar de slide.
  const [mudo, setMudo] = useState(true);
  const videoRefs = useRef<(HTMLVideoElement | null)[]>([]);

  const onSelect = useCallback(() => {
    if (!emblaApi) return;
    const indice = emblaApi.selectedScrollSnap();
    setSelecionado(indice);
    const autoplay = emblaApi.plugins().autoplay;

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

    // Slide de vídeo: pausa a troca automática por tempo fixo — quem
    // decide quando passar pro próximo é o fim do vídeo (`onEnded` do
    // elemento), não um cronômetro genérico de 5s que cortaria o vídeo no
    // meio. Slide de imagem: volta a rodar no tempo normal.
    if (banners[indice]?.tipo === "video") {
      autoplay?.stop();
    } else {
      autoplay?.play();
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
      emblaApi.off("select", onSelect);
    };
  }, [emblaApi, onSelect]);

  if (banners.length === 0) return null;

  return (
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

          <div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 gap-1.5">
            {banners.map((banner, i) => (
              <button
                key={banner.id}
                type="button"
                aria-label={`Ir pro banner ${i + 1}`}
                onClick={() => emblaApi?.scrollTo(i)}
                className={cn(
                  "h-1.5 rounded-full transition-all",
                  i === selecionado ? "w-6 bg-white" : "w-1.5 bg-white/50",
                )}
              />
            ))}
          </div>
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
  );
}

function IconeSom({ mudo }: { mudo: boolean }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="h-4.5 w-4.5">
      <path d="M4 9v6h4l5 4V5L8 9H4Z" />
      {mudo ? <path d="m19 9-5 5m0-5 5 5" /> : <path d="M17 8a5 5 0 0 1 0 8M19.5 5.5a9 9 0 0 1 0 13" />}
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
  const conteudo = (
    <div className="relative aspect-[16/9] w-full sm:aspect-[21/9]">
      {banner.tipo === "video" ? (
        // object-contain (não object-cover) de propósito: diferente da
        // foto, o vídeo não passa por recorte no app antes de subir (sem
        // ferramenta de edição de vídeo), então cortar pra preencher o
        // quadro cortaria partes imprevisíveis do conteúdo. Mostra o vídeo
        // inteiro sempre, com barras pretas nas bordas quando a proporção
        // não bate exatamente com a do carrossel.
        <div className="h-full w-full bg-black">
          <video
            ref={videoRef}
            src={banner.url}
            poster={banner.url_thumbnail ?? undefined}
            muted
            playsInline
            onEnded={onVideoEnded}
            className="h-full w-full object-contain"
          />
        </div>
      ) : (
        <Image
          src={banner.url}
          alt={banner.titulo ?? "Banner promocional"}
          fill
          sizes="100vw"
          priority
          className="object-cover"
        />
      )}
      {banner.titulo && (
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent p-4 pt-10 sm:p-6 sm:pt-16">
          <p className="text-sm font-bold text-white sm:text-lg">{banner.titulo}</p>
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
