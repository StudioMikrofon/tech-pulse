"use client";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div style={{ padding: 32, fontFamily: "monospace", background: "#070c14", color: "#00cfff", minHeight: "50vh" }}>
      <h2 style={{ color: "#f87171" }}>CLIENT ERROR</h2>
      <pre style={{ whiteSpace: "pre-wrap", color: "#fbbf24", fontSize: 13 }}>
        {error?.message}
      </pre>
      <pre style={{ whiteSpace: "pre-wrap", color: "#d6f2ff", fontSize: 11, opacity: 0.7 }}>
        {error?.stack}
      </pre>
      {error?.digest && <p>Digest: {error.digest}</p>}
      <button onClick={reset} style={{ marginTop: 16, padding: "8px 16px", background: "#00cfff22", border: "1px solid #00cfff", color: "#00cfff", cursor: "pointer" }}>
        Retry
      </button>
    </div>
  );
}
