export function locationErrorMessage(code: number) {
  if (code === 1) return "Přístup k poloze je zakázaný. Povol polohu pro tuto aplikaci v nastavení prohlížeče a zapni polohu telefonu.";
  if (code === 2) return "Poloha není dostupná. Zapni polohu telefonu a zkontroluj signál nebo připojení k Wi‑Fi či mobilním datům.";
  if (code === 3) return "Zjištění polohy trvá příliš dlouho. Zkontroluj zapnutí polohy a signál; zkus to znovu.";
  return "Polohu se nepodařilo zjistit. Zkus to znovu nebo vyber Dolní Lhotu.";
}
export function coordinatesLabel(lat: number, lon: number) { return `${Math.abs(lat).toFixed(2)}° ${lat < 0 ? "j. š." : "s. š."}, ${Math.abs(lon).toFixed(2)}° ${lon < 0 ? "z. d." : "v. d."}`; }
