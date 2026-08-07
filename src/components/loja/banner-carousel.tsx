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
  const [emblaRef, emblaApi] = useEmblaCarousel({ loop: banners.length > 1 }, [
    Autoplay({ delay: 5000, stopOnInteraction: false, stopOnMouseEnter: true }),
  ]);
  const [selecionado, setSelecionado] = useState(0);
  const videoRefs = useRef<(HTMLVideoElement | null)[]>([]);

  const onSelect = useCallback(() => {
    if (!emblaApi) return;
    const indice = emblaApi.selectedScrollSnap();
    setSelecionado(indice);
    videoRefs.current.forEach((video, i) => {
      if (!video) return;
      if (i === indice) video.play().catch(() => {});
      else video.pause();
    });
  }, [emblaApi]);

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
    </div>
  );
}

function BannerSlide({
  banner,
  videoRef,
}: {
  banner: BannerCatalogo;
  videoRef: (el: HTMLVideoElement | null) => void;
}) {
  const conteudo = (
    <div className="relative aspect-[16/9] w-full sm:aspect-[21/9]">
      {banner.tipo === "video" ? (
        <video
          ref={videoRef}
          src={banner.url}
          poster={banner.url_thumbnail ?? undefined}
          muted
          loop
          playsInline
          className="h-full w-full object-cover"
        />
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
