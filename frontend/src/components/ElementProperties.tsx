import { useCallback, useEffect, useRef, useState } from "react";

interface Props {
  selectedId: string | null;
  html: string;
  onStyleChange: (dataId: string, styles: Record<string, string>) => void;
  onHtmlChange: (html: string) => void;
}

/** Parse inline style string into key-value object */
function parseStyles(styleStr: string): Record<string, string> {
  const styles: Record<string, string> = {};
  if (!styleStr) return styles;
  styleStr.split(";").forEach((decl) => {
    const colon = decl.indexOf(":");
    if (colon === -1) return;
    const prop = decl.slice(0, colon).trim();
    const val = decl.slice(colon + 1).trim();
    if (prop && val) styles[prop] = val;
  });
  return styles;
}

/** Serialize styles back to inline style string */
function serializeStyles(styles: Record<string, string>): string {
  return Object.entries(styles)
    .filter(([, v]) => v !== "")
    .map(([k, v]) => `${k}: ${v}`)
    .join("; ");
}

/** Extract numeric value and unit from a CSS value */
function splitUnit(val: string): { num: string; unit: string } {
  const m = val.match(/^(-?[\d.]+)(.*)$/);
  if (!m) return { num: "", unit: "px" };
  return { num: m[1], unit: m[2] || "px" };
}

export default function ElementProperties({ selectedId, html, onStyleChange, onHtmlChange }: Props) {
  const [styles, setStyles] = useState<Record<string, string>>({});
  const [computed, setComputed] = useState<Record<string, string>>({});
  const [tag, setTag] = useState("");
  const lastIdRef = useRef<string | null>(null);

  // Read current styles from the canvas DOM when selection changes
  useEffect(() => {
    if (!selectedId) {
      setStyles({});
      setComputed({});
      setTag("");
      lastIdRef.current = null;
      return;
    }
    const el = document.querySelector(`.canvas-scope [data-id="${CSS.escape(selectedId)}"]`);
    if (!el) return;
    setTag(el.tagName.toLowerCase());
    setStyles(parseStyles(el.getAttribute("style") || ""));
    // Computed values seed the number fields when no inline style exists,
    // so steppers step from the element's real value instead of 0.
    const cs = window.getComputedStyle(el);
    setComputed({
      "font-size": cs.fontSize,
      padding: cs.padding,
      margin: cs.margin,
      "border-radius": cs.borderRadius,
      opacity: cs.opacity,
    });
    lastIdRef.current = selectedId;
  }, [selectedId, html]);

  const updateStyle = useCallback(
    (prop: string, value: string) => {
      if (!selectedId) return;
      setStyles((prev) => {
        const next = { ...prev };
        if (value === "") {
          delete next[prop];
        } else {
          next[prop] = value;
        }
        // Apply to canvas DOM immediately
        const el = document.querySelector(`.canvas-scope [data-id="${CSS.escape(selectedId)}"]`);
        if (el) {
          (el as HTMLElement).style.cssText = serializeStyles(next);
        }
        onStyleChange(selectedId, next);
        return next;
      });
    },
    [selectedId, onStyleChange],
  );

  if (!selectedId) {
    return (
      <p className="py-3 text-xs text-smoke">No element selected.</p>
    );
  }

  const fontSize = splitUnit(styles["font-size"] || computed["font-size"] || "");
  const color = styles["color"] || "";
  const bgColor = styles["background-color"] || "";
  const textAlign = styles["text-align"] || "";
  const padding = splitUnit(styles["padding"] || styles["padding-top"] || computed["padding"] || "");
  const margin = splitUnit(styles["margin"] || styles["margin-top"] || computed["margin"] || "");
  const borderRadius = splitUnit(styles["border-radius"] || computed["border-radius"] || "");
  const opacity = styles["opacity"] || computed["opacity"] || "";

  return (
    <div className="space-y-3 pb-4">
      {/* Element info */}
      <div className="flex items-center justify-between rounded-lg border border-accent/30 bg-accent/[0.06] px-3 py-2">
        <span className="font-mono text-sm text-accent">&lt;{tag}&gt;</span>
        <div className="flex items-center gap-1">
          <button
            onClick={() => {
              if (!selectedId) return;
              // Remove element from HTML
              const escapedId = selectedId.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
              // Match opening tag with data-id and everything until its closing tag (or self-closing)
              const regex = new RegExp(
                `<([a-zA-Z][a-zA-Z0-9]*)\\b[^>]*data-id="${escapedId}"[^>]*>[\\s\\S]*?</\\1>`,
                "i",
              );
              const next = html.replace(regex, "");
              if (next !== html) {
                onHtmlChange(next);
                // Clear selection
                const el = document.querySelector(`.canvas-scope [data-id="${CSS.escape(selectedId)}"]`);
                if (el) {
                  el.classList.remove("b-selected", "b-editing");
                }
                setStyles({});
                setTag("");
                lastIdRef.current = null;
              }
            }}
            className="rounded p-0.5 text-danger/60 transition hover:bg-danger/20 hover:text-danger"
            title="Delete element"
          >
            <TrashSmallIcon />
          </button>
          <button
            onClick={() => {
              // Deselect in the canvas DOM so App's selection poller clears selectedId
              document.querySelectorAll(".canvas-scope .b-selected, .canvas-scope .b-editing").forEach((el) => {
                (el as HTMLElement).contentEditable = "false";
                el.classList.remove("b-selected", "b-editing");
              });
              setStyles({});
              setTag("");
              lastIdRef.current = null;
            }}
            className="rounded p-0.5 text-accent/60 transition hover:bg-accent/20 hover:text-accent"
            title="Clear selection"
          >
            <CloseSmallIcon />
          </button>
        </div>
      </div>

      {/* Typography */}
      <Section title="Typography">
        <Field label="Font Size">
          <div className="flex gap-1">
            <NumberInput
              value={fontSize.num}
              onChange={(v) => updateStyle("font-size", v ? `${v}${fontSize.unit}` : "")}
              min={0}
              max={200}
            />
            <UnitSelect
              value={fontSize.unit}
              onChange={(u) => updateStyle("font-size", `${fontSize.num}${u}`)}
              options={["px", "em", "rem", "%", "vw"]}
            />
          </div>
        </Field>
        <Field label="Color">
          <ColorInput value={color} onChange={(v) => updateStyle("color", v)} />
        </Field>
        <Field label="Align">
          <AlignButtons value={textAlign} onChange={(v) => updateStyle("text-align", v)} />
        </Field>
      </Section>

      {/* Appearance */}
      <Section title="Appearance">
        <Field label="Background">
          <ColorInput value={bgColor} onChange={(v) => updateStyle("background-color", v)} />
        </Field>
        <Field label="Border Radius">
          <div className="flex gap-1">
            <NumberInput
              value={borderRadius.num}
              onChange={(v) => updateStyle("border-radius", v ? `${v}${borderRadius.unit}` : "")}
              min={0}
              max={200}
            />
            <UnitSelect
              value={borderRadius.unit}
              onChange={(u) => updateStyle("border-radius", `${borderRadius.num}${u}`)}
              options={["px", "%", "em", "rem"]}
            />
          </div>
        </Field>
        <Field label="Opacity">
          <NumberInput
            value={opacity ? String(Math.round(parseFloat(opacity) * 100)) : ""}
            onChange={(v) => updateStyle("opacity", v ? String(parseInt(v) / 100) : "")}
            min={0}
            max={100}
            suffix="%"
          />
        </Field>
      </Section>

      {/* Spacing */}
      <Section title="Spacing">
        <Field label="Padding">
          <div className="flex gap-1">
            <NumberInput
              value={padding.num}
              onChange={(v) => updateStyle("padding", v ? `${v}${padding.unit}` : "")}
              min={0}
              max={200}
            />
            <UnitSelect
              value={padding.unit}
              onChange={(u) => updateStyle("padding", `${padding.num}${u}`)}
              options={["px", "em", "rem", "%"]}
            />
          </div>
        </Field>
        <Field label="Margin">
          <div className="flex gap-1">
            <NumberInput
              value={margin.num}
              onChange={(v) => updateStyle("margin", v ? `${v}${margin.unit}` : "")}
              min={-100}
              max={200}
            />
            <UnitSelect
              value={margin.unit}
              onChange={(u) => updateStyle("margin", `${margin.num}${u}`)}
              options={["px", "em", "rem", "%"]}
            />
          </div>
        </Field>
      </Section>
    </div>
  );
}

// --- Sub-components ---

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-charcoal bg-ink/50 p-2.5">
      <h4 className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-smoke">{title}</h4>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <label className="shrink-0 text-[11px] text-smoke">{label}</label>
      <div className="w-40">{children}</div>
    </div>
  );
}

function NumberInput({
  value,
  onChange,
  min,
  max,
  suffix,
}: {
  value: string;
  onChange: (v: string) => void;
  min?: number;
  max?: number;
  suffix?: string;
}) {
  const bump = (dir: 1 | -1) => {
    const n = parseFloat(value);
    const base = Number.isFinite(n) ? n : 0;
    const next = Math.min(max ?? Infinity, Math.max(min ?? -Infinity, base + dir));
    onChange(String(Math.round(next * 100) / 100));
  };
  return (
    <div className="flex flex-1 gap-0.5">
      <button
        type="button"
        onClick={() => bump(-1)}
        aria-label="decrease"
        className="h-7 w-5 shrink-0 rounded border border-charcoal bg-ash text-[12px] leading-none text-silver outline-none transition hover:border-accent/50 hover:text-snow active:bg-accent/20"
      >
        −
      </button>
      <div className="relative min-w-0 flex-1">
        <input
          type="number"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          min={min}
          max={max}
          className="w-full rounded border border-charcoal bg-obsidian px-1 py-1 text-right font-mono text-[11px] text-snow outline-none transition focus:border-accent/50 [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
        />
        {suffix && (
          <span className="pointer-events-none absolute right-1.5 top-1/2 -translate-y-1/2 text-[10px] text-graphite">
            {suffix}
          </span>
        )}
      </div>
      <button
        type="button"
        onClick={() => bump(1)}
        aria-label="increase"
        className="h-7 w-5 shrink-0 rounded border border-charcoal bg-ash text-[12px] leading-none text-silver outline-none transition hover:border-accent/50 hover:text-snow active:bg-accent/20"
      >
        +
      </button>
    </div>
  );
}

function UnitSelect({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  options: string[];
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-16 shrink-0 rounded border border-charcoal bg-obsidian px-1 py-1 text-center font-mono text-[10px] text-silver outline-none transition focus:border-accent/50"
    >
      {options.map((u) => (
        <option key={u} value={u}>
          {u}
        </option>
      ))}
    </select>
  );
}

function ColorInput({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  const [localVal, setLocalVal] = useState(value);

  useEffect(() => {
    setLocalVal(value);
  }, [value]);

  return (
    <div className="flex gap-1">
      <div className="relative flex-1">
        <input
          type="color"
          value={localVal || "#000000"}
          onChange={(e) => {
            setLocalVal(e.target.value);
            onChange(e.target.value);
          }}
          className="h-7 w-7 cursor-pointer rounded border border-charcoal bg-transparent p-0"
        />
      </div>
      <input
        type="text"
        value={localVal}
        onChange={(e) => {
          setLocalVal(e.target.value);
          // Only update if it looks like a valid color
          if (e.target.value.match(/^(#[0-9a-fA-F]{3,8}|rgb|hsl|var)/)) {
            onChange(e.target.value);
          }
        }}
        onBlur={() => {
          // Commit on blur
          if (localVal !== value) onChange(localVal);
        }}
        placeholder="transparent"
        className="flex-1 rounded border border-charcoal bg-obsidian px-2 py-1 font-mono text-[11px] text-snow outline-none transition focus:border-accent/50"
      />
    </div>
  );
}

function AlignButtons({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  const opts = [
    { val: "left", icon: "L" },
    { val: "center", icon: "C" },
    { val: "right", icon: "R" },
    { val: "justify", icon: "J" },
  ];
  return (
    <div className="flex gap-0.5 rounded border border-charcoal bg-obsidian p-0.5">
      {opts.map((o) => (
        <button
          key={o.val}
          onClick={() => onChange(value === o.val ? "" : o.val)}
          className={`flex-1 rounded px-1.5 py-0.5 text-[10px] font-semibold transition ${
            value === o.val ? "bg-accent/20 text-accent" : "text-smoke hover:text-silver"
          }`}
        >
          {o.icon}
        </button>
      ))}
    </div>
  );
}

function CloseSmallIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 6 6 18M6 6l12 12" />
    </svg>
  );
}

function TrashSmallIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
    </svg>
  );
}
