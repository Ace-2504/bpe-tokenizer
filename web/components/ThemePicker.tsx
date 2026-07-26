"use client";

import { useSyncExternalStore } from "react";

import { DEFAULT_THEME, STORAGE_KEY, THEMES } from "@/lib/themes";

/**
 * The active theme lives on <html data-theme>, which the no-flash script in
 * layout.tsx may already have changed before this component hydrates. Reading it
 * as an external store keeps the swatch ring correct without a setState-in-effect,
 * and re-renders if anything else changes the attribute.
 */
function subscribe(onChange: () => void) {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["data-theme"],
  });
  return () => observer.disconnect();
}

const getSnapshot = () =>
  document.documentElement.getAttribute("data-theme") ?? DEFAULT_THEME;

const getServerSnapshot = () => DEFAULT_THEME;

/** Swatch-dot colour theme picker. Sets data-theme on <html> and persists it. */
export default function ThemePicker() {
  const active = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  function choose(id: string) {
    document.documentElement.setAttribute("data-theme", id);
    try {
      localStorage.setItem(STORAGE_KEY, id);
    } catch {
      // Private browsing or storage disabled — the theme still applies.
    }
  }

  return (
    <div className="theme-picker" role="radiogroup" aria-label="Colour theme">
      {THEMES.map((t) => (
        <button
          key={t.id}
          type="button"
          role="radio"
          aria-checked={t.id === active}
          aria-label={t.name}
          title={t.name}
          onClick={() => choose(t.id)}
        >
          <span
            style={{
              background: `conic-gradient(${t.accents[0]} 0 33.3%, ${t.accents[1]} 0 66.6%, ${t.accents[2]} 0)`,
              boxShadow:
                t.id === active
                  ? "0 0 0 2px var(--bg), 0 0 0 3.5px var(--fg)"
                  : "0 0 0 1px rgba(0,0,0,.25)",
            }}
          />
        </button>
      ))}
    </div>
  );
}
