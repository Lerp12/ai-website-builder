import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { createSession, getMe, listSessions } from "../lib/api";
import { BrandMark } from "./BrandMark";
import type { User } from "../lib/types";

const AUTH_ENABLED = !import.meta.env.DEV;

interface SessionLite {
  id: string;
  title: string;
  updated_at?: string;
}

export default function Landing() {
  const navigate = useNavigate();
  const [sessions, setSessions] = useState<SessionLite[]>([]);
  const [starting, setStarting] = useState(false);
  const [authUser, setAuthUser] = useState<User | null>(null);
  const [authChecked, setAuthChecked] = useState(!AUTH_ENABLED);

  useEffect(() => {
    if (!AUTH_ENABLED) {
      listSessions()
        .then((s) => setSessions(s.slice(0, 6)))
        .catch(() => {});
      return;
    }
    getMe().then((u) => {
      setAuthUser(u);
      setAuthChecked(true);
      // Show sessions for everyone (viewable without login)
      listSessions()
        .then((s) => setSessions(s.slice(0, 6)))
        .catch(() => {});
    });
  }, []);

  const startBuilding = async () => {
    if (starting) return;
    if (AUTH_ENABLED && !authUser) {
      window.location.href = "/api/auth/github/login";
      return;
    }
    setStarting(true);
    try {
      const s = await createSession();
      if (s?.id) {
        navigate(`/app/session/${s.id}`);
      } else {
        navigate(`/app`);
      }
    } catch {
      navigate(`/app`);
    } finally {
      setStarting(false);
    }
  };

  if (AUTH_ENABLED && !authChecked) return null;

  const showLogin = AUTH_ENABLED && !authUser;

  return (
    <div className="min-h-full bg-obsidian text-snow">
      {/* Top nav */}
      <header className="mx-auto flex h-16 w-full max-w-[1200px] items-center justify-between px-6">
        <Link to="/" className="flex items-center gap-2">
          <BrandMark />
          <span className="text-[15px] tracking-tight text-snow">ai-web</span>
        </Link>
        <nav className="flex items-center gap-2">
          <Link
            to="/app"
            className="rounded-full px-3 py-2 text-sm text-silver transition hover:text-snow"
          >
            Open builder
          </Link>
          {showLogin ? (
            <a
              href="/api/auth/github/login"
              className="rounded-full border border-accent bg-accent px-4 py-2 text-sm text-obsidian transition hover:border-accent-deep hover:bg-[#2563eb]"
            >
              Sign in with GitHub
            </a>
          ) : (
            <button
              onClick={startBuilding}
              disabled={starting}
              className="rounded-full border border-accent bg-accent px-4 py-2 text-sm text-obsidian transition hover:border-accent-deep hover:bg-[#2563eb] disabled:opacity-50"
            >
              {starting ? "Starting…" : "Start building"}
            </button>
          )}
          {AUTH_ENABLED && authUser && (
            <span className="ml-2 flex items-center gap-2 text-xs text-silver">
              {authUser.avatar_url && (
                <img src={authUser.avatar_url} alt="" className="h-5 w-5 rounded-full" />
              )}
              {authUser.login}
            </span>
          )}
        </nav>
      </header>

      {/* Hero */}
      <section className="mx-auto w-full max-w-[1200px] px-6 pb-24 pt-16 text-center sm:pt-20">
        <p className="mb-7 text-xs uppercase tracking-[0.16em] text-smoke">
          AI Website Builder
        </p>

        <h1
          className="mx-auto text-snow"
          style={{
            fontWeight: 400,
            fontSize: "clamp(2.75rem, 7vw, 4.5rem)",
            lineHeight: 1.02,
            letterSpacing: "-0.03em",
            maxWidth: "16ch",
          }}
        >
          Describe a website.
          <br />
          <span className="text-accent">Watch it build itself.</span>
        </h1>

        <p className="mx-auto mt-6 max-w-xl text-base leading-relaxed text-silver">
          Type what you want in plain English. ai-web designs it live on a canvas —
          then you refine it block by block, in conversation.
        </p>

        {/* Stat pair */}
        <div className="mt-8 flex items-center justify-center gap-8">
          <Stat label="Build" value="~60s" />
          <span className="h-6 w-px bg-charcoal" aria-hidden />
          <Stat label="Export" value="Clean HTML" />
        </div>

        <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
          <button
            onClick={startBuilding}
            disabled={starting}
            className="rounded-full border border-accent bg-accent px-5 py-2.5 text-sm text-obsidian transition hover:border-accent-deep hover:bg-[#2563eb] disabled:opacity-50"
          >
            {showLogin ? "Sign in to start building" : starting ? "Starting…" : "Start building"}
          </button>
          <Link
            to="/app"
            className="rounded-full border border-line bg-transparent px-5 py-2.5 text-sm text-snow transition hover:border-graphite hover:bg-white/[0.04]"
          >
            or browse projects →
          </Link>
        </div>
      </section>

      {/* Painting panel */}
      <section className="relative w-full" style={{ minHeight: "70vh" }}>
        <img
          src="/paintings/landscape.jpg"
          alt="Hunters in the Snow, Pieter Bruegel the Elder (1565)"
          className="absolute inset-0 h-full w-full object-cover"
          loading="lazy"
        />
        <div
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(to bottom, rgba(18,18,18,0.92) 0%, rgba(18,18,18,0.35) 32%, rgba(18,18,18,0.35) 68%, rgba(18,18,18,0.92) 100%)",
          }}
          aria-hidden
        />
        <div className="absolute inset-0 flex items-center justify-center px-6">
          <div className="flex w-full max-w-[400px] flex-col gap-5 rounded-2xl border border-charcoal bg-ash/80 p-8 text-center backdrop-blur-md">
            <p className="text-[10px] uppercase tracking-[0.16em] text-smoke">
              The Canvas
            </p>
            <p className="text-lg text-snow" style={{ fontWeight: 500 }}>
              Your page, rendered as you type.
            </p>
            <div className="mx-auto flex w-full max-w-[240px] flex-col gap-2">
              <span className="block h-px w-full bg-line" />
              <span className="block h-8 w-3/4 bg-white/[0.10]" />
              <span className="block h-3 w-full bg-white/[0.06]" />
              <span className="block h-3 w-5/6 bg-white/[0.06]" />
              <span className="mt-1 flex gap-2">
                <span className="block h-12 flex-1 bg-white/[0.08]" />
                <span className="block h-12 flex-1 bg-white/[0.08]" />
                <span className="block h-12 flex-1 bg-white/[0.08]" />
              </span>
            </div>
            <span className="absolute bottom-4 left-5 text-[9px] uppercase tracking-[0.14em] text-smoke">
              Scroll
            </span>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="mx-auto w-full max-w-[1200px] px-6 py-28">
        <div className="mb-4 flex items-baseline justify-between">
          <p className="text-xs uppercase tracking-[0.16em] text-smoke">Features</p>
          <p className="text-xs uppercase tracking-[0.16em] text-smoke">01 — 03</p>
        </div>
        <h2
          className="text-snow"
          style={{ fontWeight: 500, fontSize: "clamp(2rem, 5vw, 3rem)", lineHeight: 1.05, letterSpacing: "-0.03em" }}
        >
          How it builds
        </h2>

        <div className="mt-16 grid grid-cols-1 gap-12 sm:grid-cols-3 sm:gap-8">
          {FEATURES.map((f, i) => (
            <div key={f.title} className="flex flex-col items-center text-center">
              <TintedCircle src={f.image} alt="" />
              <p className="mt-6 text-xs uppercase tracking-[0.16em] text-accent">
                0{i + 1}
              </p>
              <h3 className="mt-2 text-lg text-snow" style={{ fontWeight: 500 }}>
                {f.title}
              </h3>
              <p className="mt-2 max-w-[26ch] text-sm leading-relaxed text-silver">
                {f.desc}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Projects — visible to everyone */}
      {sessions.length > 0 && (
        <section className="mx-auto w-full max-w-[1200px] px-6 pb-28">
          <div className="mb-5 flex items-center justify-between">
            <h2 className="text-xs uppercase tracking-[0.16em] text-smoke">Your projects</h2>
            <Link to="/app" className="text-sm text-accent transition hover:text-accent-bright">
              View all →
            </Link>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {sessions.map((s, i) => (
              <Link
                key={s.id}
                to={`/app/session/${s.id}`}
                className="group rounded-2xl border border-charcoal bg-obsidian p-5 transition hover:border-accent/50"
              >
                <TintedCircle
                  src={PROJECT_ART[i % PROJECT_ART.length]}
                  alt=""
                  size={96}
                  className="mx-auto mb-4"
                />
                <p className="truncate text-center text-sm text-snow" style={{ fontWeight: 500 }}>
                  {s.title || "Untitled project"}
                </p>
                {s.updated_at && (
                  <p className="mt-1 text-center text-xs text-smoke">
                    {new Date(s.updated_at).toLocaleDateString(undefined, {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </p>
                )}
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Footer */}
      <footer className="border-t border-charcoal">
        <div className="mx-auto flex w-full max-w-[1200px] items-center justify-between px-6 py-6 text-xs text-smoke">
          <span>ai-web — AI website builder</span>
          <Link to="/app" className="text-accent transition hover:text-accent-bright">
            Open builder →
          </Link>
        </div>
      </footer>
    </div>
  );
}

/* ---------------- sub-components ---------------- */

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col items-center gap-1">
      <span className="text-[11px] uppercase tracking-[0.16em] text-smoke">{label}</span>
      <span className="text-base text-snow" style={{ fontWeight: 500 }}>
        {value}
      </span>
    </div>
  );
}

function TintedCircle({
  src,
  alt,
  size = 200,
  className = "",
}: {
  src: string;
  alt: string;
  size?: number;
  className?: string;
}) {
  return (
    <div
      className={"relative shrink-0 overflow-hidden rounded-full " + className}
      style={{ width: size, height: size }}
    >
      <img
        src={src}
        alt={alt}
        loading="lazy"
        className="absolute inset-0 h-full w-full object-cover"
        style={{ filter: "grayscale(45%) contrast(1.05) brightness(0.82)" }}
      />
      <div
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(140deg, rgba(59,130,246,0.22), rgba(18,18,18,0.50))",
        }}
        aria-hidden
      />
    </div>
  );
}

/* ---------------- data ---------------- */

const FEATURES = [
  {
    title: "Prompt to canvas",
    desc: "Describe the site you want. The AI lays it out live while you watch.",
    image: "/paintings/feature-prompt.jpg",
  },
  {
    title: "Edit by block",
    desc: "Click any element and ask for a change. Surgical edits, no re-rolls.",
    image: "/paintings/feature-edit.jpg",
  },
  {
    title: "Preview & export",
    desc: "Switch desktop / tablet / mobile, then export clean HTML.",
    image: "/paintings/feature-preview.jpg",
  },
];

const PROJECT_ART = [
  "/paintings/niche-botanical.jpg",
  "/paintings/project-canal.jpg",
];
