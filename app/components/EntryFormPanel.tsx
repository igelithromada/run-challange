import type { ReactNode, Ref } from "react";
import { X } from "lucide-react";

export default function EntryFormPanel({ title, description, eyebrow, busy, onClose, panelRef, children }: {
  title: string;
  description?: string;
  eyebrow?: string;
  busy?: boolean;
  onClose: () => void;
  panelRef?: Ref<HTMLElement>;
  children: ReactNode;
}) {
  return <section ref={panelRef} className="run-form-panel entry-form-panel" aria-label={title}>
    <div className="run-form-heading">
      <div>
        {eyebrow && <span className="run-form-eyebrow">{eyebrow}</span>}
        <h3>{title}</h3>
        {description && <p>{description}</p>}
      </div>
      <button type="button" className="run-form-close" disabled={busy} onClick={onClose} aria-label="Zavřít formulář">
        <X size={19} aria-hidden="true" />
      </button>
    </div>
    <div className="professional-form entry-form-fields">{children}</div>
  </section>;
}
