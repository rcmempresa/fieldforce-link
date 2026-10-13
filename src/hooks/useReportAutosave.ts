import { useEffect, useRef } from "react";

/**
 * Periodically saves a report draft when its data changed, and also when the
 * tab is hidden or the form is closed. The first snapshot is the baseline, so
 * untouched new reports are never created.
 */
export function useReportAutosave(enabled: boolean, getSnapshot: () => unknown, save: () => Promise<unknown>, intervalMs = 15000) {
  const snapRef = useRef(getSnapshot);
  const saveRef = useRef(save);
  snapRef.current = getSnapshot;
  saveRef.current = save;
  const baseline = useRef<string | null>(null);
  const busy = useRef(false);

  useEffect(() => {
    if (!enabled) return;
    const run = async () => {
      if (busy.current) return;
      let current: string;
      try { current = JSON.stringify(snapRef.current()); } catch { return; }
      if (baseline.current === null) { baseline.current = current; return; }
      if (current === baseline.current) return;
      busy.current = true;
      try { await saveRef.current(); baseline.current = current; } catch (e) { console.error("Autosave failed", e); }
      finally { busy.current = false; }
    };
    const startTimer = setTimeout(run, 1500); // baseline after load
    const timer = setInterval(run, intervalMs);
    const onHide = () => { if (document.visibilityState === "hidden") void run(); };
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("pagehide", run);
    return () => {
      clearTimeout(startTimer);
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("pagehide", run);
      void run();
    };
  }, [enabled, intervalMs]);
}
