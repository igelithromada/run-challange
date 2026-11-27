"use client";

import { useId, useState } from "react";
import { HexColorPicker } from "react-colorful";
import { Check, ChevronDown, Clock3, CloudSun, Moon, Palette, Sparkles, Sun } from "lucide-react";
import type { Appearance, Theme } from "../lib/appearance";

type Props = {
  appearance: Appearance;
  disabled?: boolean;
  onSave: (appearance: Appearance) => Promise<boolean>;
};

const schemes = [
  { theme: "light", label: "Světlý", Icon: Sun },
  { theme: "dark", label: "Tmavý", Icon: Moon },
  { theme: "default", label: "Výchozí", Icon: Palette },
  { theme: "auto", label: "Podle času", Icon: Clock3 },
  { theme: "weather", label: "Podle počasí", Icon: CloudSun },
] as const;

export default function AppearanceSettings({ appearance, disabled, onSave }: Props) {
  const [draft, setDraft] = useState<string | null>(null);
  const id = useId();
  const validDraft = draft !== null && /^#[0-9a-f]{6}$/i.test(draft);
  const previewColor = validDraft ? draft : appearance.customColor;
  const canBlend = appearance.theme !== "light" && appearance.theme !== "dark";

  async function saveCustom() {
    if (draft && await onSave({ ...appearance, theme: "custom", customColor: draft })) setDraft(null);
  }

  function select(theme: Theme) {
    setDraft(null);
    if (theme !== appearance.theme) void onSave({ ...appearance, theme });
  }

  return (
    <section className="tile appearance-settings" aria-labelledby={id}>
      <div className="settings-section-heading">
        <Sparkles size={21} aria-hidden="true" />
        <h2 id={id}>Vzhled</h2>
      </div>

      <div className="appearance-presets" role="group" aria-label="Barevné schéma">
        {schemes.map(({ theme, label, Icon }) => (
          <button key={theme} type="button" className="appearance-preset" data-preview={theme}
            aria-pressed={appearance.theme === theme} disabled={disabled} onClick={() => select(theme)}>
            <span className="appearance-preview" aria-hidden="true"><Icon size={19} /></span>
            <span>{label}</span>
            {appearance.theme === theme && <Check className="appearance-check" size={15} aria-hidden="true" />}
          </button>
        ))}
      </div>

      <div className="appearance-custom" data-active={appearance.theme === "custom"}>
        <button type="button" className="appearance-custom-trigger" aria-expanded={draft !== null}
          aria-controls={id + "-color"} disabled={disabled}
          onClick={() => setDraft(draft === null ? appearance.customColor : null)}>
          <span className="appearance-swatch" aria-hidden="true" style={{ backgroundColor: previewColor }} />
          <span className="appearance-custom-copy">
            <strong>Vlastní barva</strong>
            {appearance.theme === "custom" && <small>Aktivní · {appearance.customColor.toUpperCase()}</small>}
          </span>
          <ChevronDown size={18} aria-hidden="true" />
        </button>
        <div id={id + "-color"} hidden={draft === null} className="appearance-editor">
          {draft !== null && (
            <>
              <div className="appearance-editor-controls" inert={disabled}>
                <HexColorPicker color={previewColor} onChange={setDraft} aria-label="Výběr vlastní barvy" />
                <label>
                  <span>Kód barvy</span>
                  <input type="text" inputMode="text" autoComplete="off" spellCheck={false}
                    pattern="#[0-9a-fA-F]{6}" maxLength={7} value={draft.toUpperCase()}
                    onChange={event => setDraft(event.target.value)} />
                </label>
              </div>
              <div className="appearance-editor-actions">
                <button className="run-secondary-button" type="button" disabled={disabled} onClick={() => setDraft(null)}>Zrušit</button>
                <button className="run-primary-button" type="button" disabled={disabled || !validDraft}
                  onClick={() => void saveCustom()}>Použít barvu</button>
              </div>
            </>
          )}
        </div>
      </div>

      <label className="appearance-background">
        <span>
          <strong>Barevný přechod</strong>
          <small>{canBlend ? "Plynulý přechod mezi barvami pozadí." : "Tento režim má jednobarevné pozadí."}</small>
        </span>
        <input type="checkbox" role="switch" aria-label="Barevný přechod" checked={canBlend && appearance.gradientEnabled}
          disabled={disabled || !canBlend} onChange={event => void onSave({ ...appearance, gradientEnabled: event.target.checked })} />
      </label>
    </section>
  );
}
