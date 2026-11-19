"use client";
import { useEffect, useRef, type ReactNode } from "react";

export default function OverlayDialog({ label, className, children, onDismiss }: {
  label: string; className: string; children: ReactNode; onDismiss: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current!;
    const viewport = window.visualViewport;
    const resize = () => {
      dialog.style.setProperty("--overlay-height", `${viewport?.height ?? window.innerHeight}px`);
      dialog.style.setProperty("--overlay-top", `${viewport?.offsetTop ?? 0}px`);
    };
    resize();
    viewport?.addEventListener("resize", resize);
    viewport?.addEventListener("scroll", resize);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialog.showModal();
    return () => {
      dialog.close();
      document.body.style.overflow = overflow;
      viewport?.removeEventListener("resize", resize);
      viewport?.removeEventListener("scroll", resize);
    };
  }, []);
  return <dialog ref={ref} className={className} aria-label={label}
    onCancel={event => { event.preventDefault(); onDismiss(); }}
    onClick={event => { if (event.target === event.currentTarget) onDismiss(); }}>
    {children}
  </dialog>;
}
