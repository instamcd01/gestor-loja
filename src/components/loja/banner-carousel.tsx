"use client";

import Image from "next/image";
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
  // Cópia borrada/ampliada do mesmo vídeo, exibida atrás da versão nítida
  // (object-contain) — preenche as bordas com um "brilho" ambiente do
  // próprio conteúdo em vez de barra preta seca (mesmo truque do Spotify/
  // Instagram Stories). Sempre muda, tocada em conjunto com a principal.
  const videoBgRefs = useRef<(HTMLVideoElement | null)[]>([]);
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
    videoBgRefs.current.forEach((video, i) => {
      if (!video) return;
      if (i === indice) {
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
      timerRef.current = setTimeout(() => emblaApi.scrollNext(), DELAY_IMAGEM_MS);
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
                videoBgRef={(el) => {
                  videoBgRefs.current[i] = el;
                }}
                onVideoEnded={() => {
                  // Único banner: não tem pra onde avançar (loop desligado
                  // com 1 slide só) — melhor repetir o vídeo do que travar
                  // no último frame.
                  if (banners.length <= 1) {
                    videoRefs.current[i]?.play().catch(() => {});
                    videoBgRefs.current[i]?.play().catch(() => {});
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
  videoBgRef,
  onVideoEnded,
}: {
  banner: BannerCatalogo;
  videoRef: (el: HTMLVideoElement | null) => void;
  videoBgRef: (el: HTMLVideoElement | null) => void;
  onVideoEnded: () => void;
}) {
  const conteudo = (
    <div className="relative aspect-[16/9] w-full sm:aspect-[21/9]">
      {banner.tipo === "video" ? (
        // object-contain (não object-cover) de propósito: diferente da
        // foto, o vídeo não passa por recorte no app antes de subir (sem
        // ferramenta de edição de vídeo), então cortar pra preencher o
        // quadro cortaria partes imprevisíveis do conteúdo. Mostra o vídeo
        // inteiro sempre — e em vez de deixar barra preta na sobra, uma
        // cópia borrada/ampliada do mesmo vídeo preenche o fundo.
        <div className="relative h-full w-full overflow-hidden bg-black">
          <video
            ref={videoBgRef}
            src={banner.url}
            muted
            playsInline
            aria-hidden
            tabIndex={-1}
            className="absolute inset-0 h-full w-full scale-125 object-cover object-center blur-2xl brightness-[0.55] saturate-125"
          />
          <video
            ref={videoRef}
            src={banner.url}
            poster={banner.url_thumbnail ?? undefined}
            muted
            playsInline
            onEnded={onVideoEnded}
            className="relative z-10 h-full w-full object-contain"
          />
        </div>
      ) : (
        // Duas <Image> alternadas por breakpoint (em vez de uma só) — banner
        // cadastrado com uma versão mobile dedicada (`url_mobile`, recorte
        // 16:9 feito no app) usa ela abaixo de `sm`; sem essa versão, cai pra
        // `url` nas duas (recorte central 21:9 do próprio navegador, igual
        // era antes). Sem isso não tinha como mostrar imagens diferentes por
        // tela com <Image fill> (um único elemento não troca de src via CSS).
        <>
          <Image
            src={banner.url_mobile ?? banner.url}
            alt={banner.titulo ?? "Banner promocional"}
            fill
            sizes="100vw"
            priority
            className="object-cover sm:hidden"
          />
          <Image
            src={banner.url}
            alt={banner.titulo ?? "Banner promocional"}
            fill
            sizes="100vw"
            priority
            className="hidden object-cover sm:block"
          />
        </>
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
