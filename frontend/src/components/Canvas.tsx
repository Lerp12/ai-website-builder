import { memo, useCallback, useEffect, useRef, useState } from "react";

type Device = "desktop" | "tablet" | "mobile";

const DEVICE_WIDTH: Record<Device, number | null> = {
  desktop: null,
  tablet: 768,
  mobile: 390,
};

interface Props {
  html: string;
  streaming: boolean;
  device: Device;
  onDeviceChange: (d: Device) => void;
  canExport: boolean;
  onExport: () => void;
  onHtmlChange: (h: string) => void;
  isEmpty: boolean;
}

export default memo(function Canvas({
  html,
  streaming,
  device,
  onDeviceChange,
  canExport,
  onExport,
  onHtmlChange,
  isEmpty,
}: Props) {
  const frameRef = useRef<HTMLDivElement>(null);
  const scopeRef = useRef<HTMLDivElement>(null);
  const codeRef = useRef<HTMLTextAreaElement>(null);
  const [codeActive, setCodeActive] = useState(false);
  const [code, setCode] = useState("");
  const editingIdRef = useRef<string | null>(null);
  const selectedIdRef = useRef<string | null>(null);

  // Highlight selected element — driven by ref, no React re-render needed
  const highlightSelected = (id: string | null) => {
    const root = scopeRef.current;
    if (!root) return;
    root.querySelectorAll(".b-selected").forEach((el) => el.classList.remove("b-selected"));
    if (id) {
      const el = root.querySelector(`[data-id="${CSS.escape(id)}"]`);
      el?.classList.add("b-selected");
    }
    selectedIdRef.current = id;
  };

  // Keep code view in sync unless the editor is focused
  useEffect(() => {
    if (!codeActive) return;
    if (typeof document !== "undefined" && document.activeElement === codeRef.current) return;
    setCode(html);
  }, [html, codeActive]);

  const handleClick = useCallback((e: React.MouseEvent) => {
    if (isEmpty || streaming) return;
    const target = e.target as HTMLElement;
    const el = target.closest("[data-id]") as HTMLElement | null;
    if (!el) return;

    e.stopPropagation();
    e.preventDefault();

    const newId = el.getAttribute("data-id")!;

    // Already editing this element — place cursor at click point
    if (editingIdRef.current === newId) {
      placeCaretAtPoint(e.clientX, e.clientY, el);
      return;
    }

    // Exit any previous editing
    if (editingIdRef.current && scopeRef.current) {
      const prevEl = scopeRef.current.querySelector(`[data-id="${CSS.escape(editingIdRef.current)}"]`) as HTMLElement | null;
      if (prevEl) {
        // Cancel any pending save RAF from blur
        if ((prevEl as any).__saveRaf) cancelAnimationFrame((prevEl as any).__saveRaf);
        prevEl.removeEventListener("blur", (prevEl as any).__blurHandler);
        prevEl.removeEventListener("keydown", (prevEl as any).__keydownHandler);
        prevEl.contentEditable = "false";
        prevEl.classList.remove("b-editing");
      }
      editingIdRef.current = null;
    }

    // Update selection via direct DOM (NO React state update, NO re-render)
    highlightSelected(newId);

    // Set up editing state IMMEDIATELY
    editingIdRef.current = newId;
    el.contentEditable = "true";
    el.classList.add("b-editing");
    el.focus();
    placeCaretAtPoint(e.clientX, e.clientY, el);

    // Handle blur to save (deferred — allows click on new element to cancel)
    const onBlur = () => {
      el.removeEventListener("blur", onBlur);
      el.removeEventListener("keydown", onKeydown);
      // Defer save so a click on a new element can cancel it
      const raf = requestAnimationFrame(() => {
        if (editingIdRef.current === null && el.classList.contains("b-editing")) {
          saveEditing(el);
        }
      });
      // Store for cleanup if new click cancels
      (el as any).__saveRaf = raf;
    };

    // Handle keyboard shortcuts
    const onKeydown = (ev: KeyboardEvent) => {
      if (ev.key === "Escape") {
        ev.preventDefault();
        el.removeEventListener("blur", onBlur);
        el.removeEventListener("keydown", onKeydown);
        cancelEditing(el);
      } else if (ev.key === "Enter" && !ev.shiftKey) {
        const tag = el.tagName.toLowerCase();
        if (!["div", "section", "article", "main", "header", "footer", "nav", "aside", "form"].includes(tag)) {
          ev.preventDefault();
          el.removeEventListener("blur", onBlur);
          el.removeEventListener("keydown", onKeydown);
          saveEditing(el);
        }
      }
    };

    el.addEventListener("blur", onBlur);
    el.addEventListener("keydown", onKeydown);
  }, [isEmpty, streaming]);

  function placeCaretAtPoint(x: number, y: number, el: HTMLElement) {
    // Use caretRangeFromPoint to place cursor at exact click position
    const range = (document as any).caretRangeFromPoint?.(x, y);
    if (range) {
      const sel = window.getSelection();
      if (sel) {
        sel.removeAllRanges();
        // Constrain range to the editable element
        if (el.contains(range.startContainer)) {
          sel.addRange(range);
        } else {
          // Fallback: place cursor at end
          const fallback = document.createRange();
          fallback.selectNodeContents(el);
          fallback.collapse(false);
          sel.addRange(fallback);
        }
      }
    } else {
      // Fallback for browsers without caretRangeFromPoint
      const sel = window.getSelection();
      if (sel) {
        const range = document.createRange();
        range.selectNodeContents(el);
        range.collapse(false);
        sel.removeAllRanges();
        sel.addRange(range);
      }
    }
  }

  function saveEditing(el: HTMLElement) {
    const id = editingIdRef.current;
    if (!id) return;
    el.contentEditable = "false";
    el.classList.remove("b-editing");
    editingIdRef.current = null;

    // Extract the updated HTML from the canvas DOM
    if (scopeRef.current) {
      const updatedHtml = scopeRef.current.innerHTML;
      onHtmlChange(updatedHtml);
    }
  }

  function cancelEditing(el: HTMLElement) {
    // Revert by re-rendering the original html
    editingIdRef.current = null;
    el.contentEditable = "false";
    el.classList.remove("b-editing");
    // Force re-render to restore original content
    onHtmlChange(html);
  }

  const toggleCode = () => {
    setCodeActive((v) => {
      const next = !v;
      if (next) setCode(html);
      return next;
    });
  };

  const onCodeChange = (v: string) => {
    setCode(v);
    onHtmlChange(v);
  };

  const width = DEVICE_WIDTH[device];

  return (
    <div className="flex h-full flex-col bg-obsidian">
      <CanvasToolbar
        device={device}
        onDeviceChange={onDeviceChange}
        canExport={canExport}
        onExport={onExport}
        codeActive={codeActive}
        onToggleCode={toggleCode}
      />
      <div className="flex flex-1 overflow-hidden">
        {codeActive && (
          <div className="flex w-1/2 min-w-0 flex-col border-r border-charcoal bg-ink">
            <div className="flex items-center justify-between border-b border-charcoal px-4 py-2">
              <span className="font-mono text-[11px] uppercase tracking-[0.12em] text-smoke">code · html</span>
              <span className="font-mono text-[10px] text-graphite">edits sync to preview &amp; save</span>
            </div>
            <textarea
              ref={codeRef}
              value={code}
              onChange={(e) => onCodeChange(e.target.value)}
              spellCheck={false}
              autoCapitalize="off"
              autoCorrect="off"
              placeholder="<div>edit the html…</div>"
              aria-label="HTML code editor"
              className="scroll-thin flex-1 resize-none bg-transparent p-4 font-mono text-xs leading-relaxed text-snow outline-none placeholder:text-graphite"
            />
          </div>
        )}
        <div className="min-w-0 flex-1 overflow-hidden">
          <div ref={frameRef} className="scroll-thin bg-editor-grid h-full overflow-auto p-6">
            <div
              className="builder-canvas mx-auto overflow-hidden rounded-2xl border border-charcoal bg-white transition-all"
              style={{ width: width ? `${width}px` : "100%", maxWidth: "100%", minHeight: isEmpty ? "100%" : undefined }}
            >
              {isEmpty ? (
                <div className="flex min-h-[60vh] w-full items-center justify-center p-10">
                  {streaming ? (
                    <div className="flex flex-col items-center gap-3 text-center">
                      <span className="relative flex h-3 w-3" aria-hidden>
                        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent opacity-75" />
                        <span className="relative inline-flex h-3 w-3 rounded-full bg-accent" />
                      </span>
                      <p className="text-sm text-smoke">Drawing your page…</p>
                    </div>
                  ) : (
                    <div className="flex max-w-xs flex-col items-center gap-3 text-center">
                      <div className="text-accent">
                        <CanvasIcon />
                      </div>
                      <p className="text-sm text-snow" style={{ fontWeight: 500 }}>
                        Your canvas is empty
                      </p>
                      <p className="text-xs leading-relaxed text-smoke">
                        Describe a website in the chat on the right — it will appear here as you talk.
                      </p>
                    </div>
                  )}
                </div>
              ) : (
                <div
                  ref={scopeRef}
                  className="canvas-scope"
                  onClick={handleClick}
                  style={{ transform: "translateZ(0)", position: "relative", overflow: "hidden" }}
                  dangerouslySetInnerHTML={{ __html: scopeHtml(html) }}
                />
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
});

const SCOPE_CLASS = "canvas-scope";

/** Scope all <style> tag contents so selectors are prefixed with .canvas-scope. */
function scopeHtml(html: string): string {
  return html.replace(
    /<style([^>]*)>([\s\S]*?)<\/style>/gi,
    (_match, attrs, css) => {
      const scoped = css.replace(
        /(^|[}]\s*)([^{}]+?)(\s*\{)/g,
        (_s: string, before: string, selector: string, brace: string) => {
          // Skip @-rules (media queries, keyframes, etc.)
          if (selector.trim().startsWith("@")) return `${before}${selector}${brace}`;
          // Scope each comma-separated selector
          const scopedSelectors = selector
            .split(",")
            .map((s: string) => {
              const trimmed = s.trim();
              if (!trimmed || trimmed.startsWith("@")) return trimmed;
              // Don't scope if already scoped
              if (trimmed.startsWith(`.${SCOPE_CLASS}`)) return trimmed;
              // Scope element and pseudo selectors
              if (/^[a-zA-Z]|^::|^:/.test(trimmed)) {
                return `.${SCOPE_CLASS} ${trimmed}`;
              }
              return `.${SCOPE_CLASS} ${trimmed}`;
            })
            .join(", ");
          return `${before}${scopedSelectors}${brace}`;
        },
      );
      return `<style${attrs}>${scoped}</style>`;
    },
  );
}

function CanvasToolbar({
  device,
  onDeviceChange,
  canExport,
  onExport,
  codeActive,
  onToggleCode,
}: {
  device: Device;
  onDeviceChange: (d: Device) => void;
  canExport: boolean;
  onExport: () => void;
  codeActive: boolean;
  onToggleCode: () => void;
}) {
  const btns: { id: Device; label: string; icon: React.ReactNode }[] = [
    { id: "desktop", label: "Desktop", icon: <DesktopIcon /> },
    { id: "tablet", label: "Tablet", icon: <TabletIcon /> },
    { id: "mobile", label: "Mobile", icon: <MobileIcon /> },
  ];
  return (
    <div className="flex items-center justify-between gap-3 border-b border-charcoal bg-obsidian px-3 py-2">
      <div className="flex items-center gap-0.5 rounded-full border border-charcoal bg-ash p-0.5">
        {btns.map((b) => {
          const active = device === b.id;
          return (
            <button
              key={b.id}
              onClick={() => onDeviceChange(b.id)}
              aria-pressed={active}
              title={b.label}
              className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs transition ${
                active ? "bg-obsidian text-snow" : "text-smoke hover:text-silver"
              }`}
            >
              {b.icon}
              <span className="hidden sm:inline">{b.label}</span>
            </button>
          );
        })}
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={onToggleCode}
          aria-pressed={codeActive}
          className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs transition ${
            codeActive
              ? "border-accent/50 bg-accent/10 text-accent"
              : "border-line text-silver hover:border-graphite hover:bg-white/[0.04] hover:text-snow"
          }`}
        >
          <CodeIcon />
          Code
        </button>

        <button
          onClick={onExport}
          disabled={!canExport}
          className="inline-flex items-center gap-1.5 rounded-full border border-line px-3 py-1.5 text-xs text-silver transition hover:border-graphite hover:bg-white/[0.04] hover:text-snow disabled:cursor-not-allowed disabled:opacity-40"
        >
          <DownloadIcon />
          Export
        </button>
      </div>
    </div>
  );
}

/* ---------- icons ---------- */
function CanvasIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <path d="M3 9h18" />
    </svg>
  );
}
function DesktopIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="2" y="3" width="20" height="14" rx="2" />
      <path d="M8 21h8M12 17v4" />
    </svg>
  );
}
function TabletIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="5" y="2" width="14" height="20" rx="2" />
      <path d="M12 18h.01" />
    </svg>
  );
}
function MobileIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="7" y="2" width="10" height="20" rx="2" />
      <path d="M12 18h.01" />
    </svg>
  );
}
function CodeIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="m16 18 6-6-6-6M8 6l-6 6 6 6" />
    </svg>
  );
}
function DownloadIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" />
    </svg>
  );
}
