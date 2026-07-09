import { useCallback, useMemo, useState } from "react";

interface SessionLite {
  id: string;
  title: string;
}

interface TreeNode {
  tag: string;
  dataId: string | null;
  children: TreeNode[];
}

interface Props {
  sessions: SessionLite[];
  currentSessionId: string | null;
  onSelectSession: (id: string) => void;
  onDeleteSession: (id: string) => void;
  onNewSession: () => void;
  html: string;
}

const STRUCTURAL = new Set([
  "header","nav","main","footer","section","article","aside",
  "h1","h2","h3","h4","h5","h6",
  "ul","ol","table","form",
]);

export default function LeftPanel({
  sessions,
  currentSessionId,
  onSelectSession,
  onDeleteSession,
  onNewSession,
  html,
}: Props) {
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({
    sessions: false,
  });
  const toggle = (key: string) => setCollapsed((p) => ({ ...p, [key]: !p[key] }));

  const tree = useMemo(() => buildTree(html), [html]);
  const hasElements = tree.children.length > 0;

  const [expanded, setExpanded] = useState<Set<string>>(() => {
    const s = new Set<string>();
    s.add("root");
    for (const child of tree.children) {
      if (child.dataId) s.add(child.dataId);
      for (const grandchild of child.children) {
        if (grandchild.dataId) s.add(grandchild.dataId);
      }
    }
    return s;
  });

  // Tree click: click the element in the canvas to select + edit it
  const handleTreeSelect = useCallback((id: string | null) => {
    if (!id) return;
    const el = document.querySelector(`.canvas-scope [data-id="${CSS.escape(id)}"]`);
    if (el) {
      const rect = el.getBoundingClientRect();
      el.dispatchEvent(new MouseEvent("click", {
        bubbles: true, cancelable: true, view: window,
        clientX: rect.left + rect.width / 2, clientY: rect.top + rect.height / 2,
      }));
    }
  }, []);

  return (
    <div className="scroll-thin flex h-full flex-col overflow-auto bg-obsidian text-silver">
      <Section
        title="Projects"
        icon={<FolderIcon />}
        collapsed={collapsed.sessions}
        onToggle={() => toggle("sessions")}
        action={
          <button
            onClick={onNewSession}
            className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs text-accent transition hover:bg-accent/10"
            title="New project"
          >
            <PlusIcon />
            New
          </button>
        }
      >
        {sessions.length === 0 && (
          <p className="px-3 py-2 text-xs text-smoke">No projects yet.</p>
        )}
        <ul className="pb-1.5">
          {sessions.map((s) => {
            const active = s.id === currentSessionId;
            return (
              <li key={s.id} className="group flex items-center pr-1.5">
                <button
                  onClick={() => onSelectSession(s.id)}
                  className={`flex-1 truncate rounded-lg px-2.5 py-1.5 text-left text-xs transition ${
                    active ? "bg-accent/10 text-accent" : "text-silver hover:bg-white/[0.04]"
                  }`}
                  style={{ fontWeight: active ? 500 : 400 }}
                >
                  {s.title || "New project"}
                </button>
                <button
                  onClick={() => onDeleteSession(s.id)}
                  className="rounded p-1 text-graphite opacity-0 transition hover:bg-danger/10 hover:text-danger focus-visible:opacity-100 group-hover:opacity-100"
                  title="Delete project"
                  aria-label={`Delete project ${s.title || "New project"}`}
                >
                  <TrashIcon />
                </button>
              </li>
            );
          })}
        </ul>
      </Section>

      {/* Elements section */}
      <div className="border-b border-charcoal">
        <div className="flex items-center justify-between px-3 py-2.5">
          <span className="inline-flex items-center gap-1.5 text-[11px] uppercase tracking-[0.14em] text-smoke">
            <span className="text-graphite"><LayersIcon /></span>
            Elements
          </span>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-auto">
        {!hasElements ? (
          <p className="px-3 py-3 text-xs text-smoke">Nothing on the canvas yet.</p>
        ) : (
          <div className="py-1">
            {tree.children.map((node, i) => (
              <TreeNodeItem
                key={node.dataId || i}
                node={node}
                depth={0}
                expanded={expanded}
                onToggleExpand={(id) =>
                  setExpanded((prev) => {
                    const next = new Set(prev);
                    next.has(id) ? next.delete(id) : next.add(id);
                    return next;
                  })
                }
                onSelect={handleTreeSelect}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- tree node
function TreeNodeItem({
  node,
  depth,
  expanded,
  onToggleExpand,
  onSelect,
}: {
  node: TreeNode;
  depth: number;
  expanded: Set<string>;
  onToggleExpand: (id: string) => void;
  onSelect: (id: string | null) => void;
}) {
  const nodeId = node.dataId || `_${depth}_${node.tag}`;
  const isExpanded = expanded.has(nodeId);
  const hasChildren = node.children.length > 0;
  const indent = depth * 14;

  return (
    <div>
      <button
        onClick={() => {
          if (node.dataId) onSelect(node.dataId);
        }}
        className="flex w-full items-center gap-1 rounded px-2 py-[3px] text-left text-[11px] text-silver transition hover:bg-white/[0.04]"
        style={{ paddingLeft: `${8 + indent}px` }}
      >
        {hasChildren ? (
          <span
            onClick={(e) => {
              e.stopPropagation();
              onToggleExpand(nodeId);
            }}
            className="mr-0.5 shrink-0 cursor-pointer text-graphite hover:text-silver"
          >
            <ChevronIcon open={isExpanded} />
          </span>
        ) : (
          <span className="mr-1.5 w-[9px] shrink-0" />
        )}
        <span className="font-mono text-[11px]">&lt;{node.tag}&gt;</span>
        {node.children.length > 0 && (
          <span className="ml-1 text-graphite">{node.children.length}</span>
        )}
      </button>
      {isExpanded && hasChildren && (
        <div>
          {node.children.map((child, i) => (
            <TreeNodeItem
              key={child.dataId || i}
              node={child}
              depth={depth + 1}
              expanded={expanded}
              onToggleExpand={onToggleExpand}
              onSelect={onSelect}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------- HTML → tree
function buildTree(html: string): TreeNode {
  const root: TreeNode = { tag: "root", dataId: null, children: [] };
  const stack: { node: TreeNode; tag: string }[] = [{ node: root, tag: "root" }];

  const VOID = new Set([
    "area","base","br","col","embed","hr","img","input","link","meta",
    "param","source","track","wbr",
  ]);

  let i = 0;
  while (i < html.length) {
    if (html[i] !== "<") { i++; continue; }

    if (html.startsWith("<!--", i)) {
      const end = html.indexOf("-->", i);
      i = end === -1 ? html.length : end + 3;
      continue;
    }

    if (html[i + 1] === "/") {
      const closeEnd = html.indexOf(">", i);
      if (closeEnd === -1) break;
      const tagName = html.slice(i + 2, closeEnd).trim().toLowerCase().split(/\s/)[0];

      while (stack.length > 1) {
        const top = stack[stack.length - 1];
        stack.pop();
        if (top.tag === tagName) break;
      }
      i = closeEnd + 1;
      continue;
    }

    const tagEnd = html.indexOf(">", i);
    if (tagEnd === -1) break;
    const tagContent = html.slice(i + 1, tagEnd);
    const selfClose = tagContent.endsWith("/");

    const tagMatch = tagContent.match(/^(\w[\w-]*)/);
    if (!tagMatch) { i = tagEnd + 1; continue; }
    const tagName = tagMatch[1].toLowerCase();

    const dataIdMatch = tagContent.match(/data-id="([^"]*)"/);
    const dataId = dataIdMatch ? dataIdMatch[1] : null;

    const node: TreeNode = { tag: tagName, dataId, children: [] };

    if (STRUCTURAL.has(tagName) || dataId) {
      const parent = stack[stack.length - 1].node;
      parent.children.push(node);
    }

    if (!selfClose && !VOID.has(tagName)) {
      stack.push({ node, tag: tagName });
    }

    i = tagEnd + 1;
  }

  return root;
}

// ---------------------------------------------------------------- sections
function Section({
  title,
  icon,
  action,
  collapsed,
  onToggle,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  action?: React.ReactNode;
  collapsed?: boolean;
  onToggle?: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="border-b border-charcoal">
      <div className="flex items-center justify-between px-3 py-2.5">
        <button
          onClick={onToggle}
          className="inline-flex items-center gap-1.5 text-[11px] uppercase tracking-[0.14em] text-smoke transition hover:text-silver"
        >
          <ChevronIcon open={!collapsed} />
          <span className="text-graphite">{icon}</span>
          {title}
        </button>
        {action}
      </div>
      {!collapsed && children}
    </div>
  );
}

/* ---------- icons ---------- */
function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      width="9"
      height="9"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`transition-transform ${open ? "" : "-rotate-90"}`}
      aria-hidden
    >
      <path d="M6 9l6 6 6-6" />
    </svg>
  );
}
function FolderIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Z" />
    </svg>
  );
}
function LayersIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="m12 2 9 5-9 5-9-5 9-5ZM3 12l9 5 9-5M3 17l9 5 9-5" />
    </svg>
  );
}
function PlusIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}
function TrashIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m2 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
    </svg>
  );
}
