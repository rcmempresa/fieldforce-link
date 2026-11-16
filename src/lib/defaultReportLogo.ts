import logoAsset from "@/assets/nr-techsolucion-logo.png.asset.json";

let cached: Promise<string | null> | null = null;

/** NR Techsolucion logo as a data URL, for PDFs that need it by default. */
export function getDefaultReportLogo(): Promise<string | null> {
  if (!cached) {
    const load = (u: string) => fetch(u).then((r) => (r.ok ? r.blob() : Promise.reject())).then((b) => (b.type.startsWith("image/") ? b : Promise.reject()));
    cached = load(logoAsset.url)
      .catch(() => load(`https://nrtechsolucion.pt${logoAsset.url}`))
      .then((blob) => new Promise<string>((resolve, reject) => {
        const fr = new FileReader();
        fr.onload = () => resolve(fr.result as string);
        fr.onerror = reject;
        fr.readAsDataURL(blob);
      }))
      .catch(() => { cached = null; return null; });
  }
  return cached;
}
