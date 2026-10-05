import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Play, X } from 'lucide-react';
import { videoSource } from '@/lib/showcase';

/** Plays an owner testimonial (uploaded file, YouTube or Google Drive). */
export function VideoPlayer({ url, autoPlay, className = '' }: { url: string; autoPlay?: boolean; className?: string }) {
  const v = videoSource(url);
  if (!v) return null;
  if (v.kind === 'embed') {
    return (
      <iframe
        src={autoPlay ? v.src : v.src.replace('autoplay=1', 'autoplay=0')}
        title="Owner testimonial"
        allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
        allowFullScreen
        className={`h-full w-full border-0 ${className}`}
      />
    );
  }
  return <video src={v.src} controls autoPlay={autoPlay} playsInline className={`h-full w-full bg-black object-contain ${className}`} />;
}

/** Full-screen video over everything; tap outside or ✕ to close. */
export function VideoModal({ url, caption, onClose }: { url: string; caption?: string; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return createPortal(
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/90 p-3 animate-fade-in sm:p-8" onClick={onClose}>
      <div className="relative w-full max-w-5xl" onClick={(e) => e.stopPropagation()}>
        <div className="aspect-video w-full overflow-hidden rounded-2xl bg-black shadow-2xl">
          <VideoPlayer url={url} autoPlay />
        </div>
        {caption && <p className="mt-3 text-center font-lux text-xl italic text-white/80">{caption}</p>}
        <button onClick={onClose} aria-label="Close video" className="absolute -top-3 right-0 -translate-y-full rounded-full bg-white/10 p-2.5 text-white hover:bg-white/20">
          <X className="h-5 w-5" />
        </button>
      </div>
    </div>,
    document.body,
  );
}

/** "Hear from our owners" button. */
export function TestimonialButton({ onClick, dark = true, className = '' }: { onClick: () => void; dark?: boolean; className?: string }) {
  return (
    <button
      onClick={onClick}
      className={`group flex items-center gap-3 rounded-full py-2 pl-2 pr-5 text-left shadow-lg backdrop-blur transition ${dark ? 'bg-black/45 text-white ring-1 ring-white/20 hover:bg-black/60' : 'bg-white text-gray-900 ring-1 ring-black/5 hover:bg-gray-50'} ${className}`}
    >
      <span className={`grid h-10 w-10 place-items-center rounded-full ${dark ? 'bg-white text-[#13261c]' : 'bg-[#13261c] text-white'} transition group-hover:scale-105`}>
        <Play className="ml-0.5 h-4 w-4 fill-current" />
      </span>
      <span>
        <span className="block text-[11px] uppercase tracking-[0.18em] opacity-70">Owner stories</span>
        <span className="block font-lux text-lg leading-tight">Hear from our owners</span>
      </span>
    </button>
  );
}
