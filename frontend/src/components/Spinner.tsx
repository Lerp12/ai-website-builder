import { useEffect, useState } from "react";

// Accent-blue caret: braille frames cycling every 80ms.
const FRAMES = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];

interface Props {
  size?: number;
}

export default function Spinner({ size = 18 }: Props) {
  const [i, setI] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setI((v) => (v + 1) % FRAMES.length), 80);
    return () => clearInterval(id);
  }, []);
  return (
    <span
      aria-hidden="true"
      className="text-accent"
      style={{
        fontSize: size,
        lineHeight: 1,
        fontFamily: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
      }}
    >
      {FRAMES[i]}
    </span>
  );
}
