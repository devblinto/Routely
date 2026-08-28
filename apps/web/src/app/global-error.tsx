"use client";

/**
 * Last-resort boundary for failures in the root layout itself. It replaces the whole
 * document, so it must render its own `<html>` and `<body>` and cannot rely on the app's
 * providers, fonts or shared components.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body
        style={{
          fontFamily: "system-ui, sans-serif",
          display: "grid",
          placeItems: "center",
          minHeight: "100vh",
          margin: 0,
          padding: "1.5rem",
          textAlign: "center",
        }}
      >
        <main>
          <h1 style={{ fontSize: "1.125rem", fontWeight: 600 }}>Routely is unavailable</h1>
          <p style={{ color: "#666", marginTop: "0.5rem", fontSize: "0.875rem" }}>
            An unexpected error stopped the application from loading.
          </p>
          {error.digest ? (
            <p style={{ color: "#888", marginTop: "0.75rem", fontSize: "0.75rem" }}>
              Reference: {error.digest}
            </p>
          ) : null}
          <button
            type="button"
            onClick={reset}
            style={{
              marginTop: "1.25rem",
              padding: "0.5rem 1rem",
              borderRadius: "0.5rem",
              border: "1px solid #d4d4d4",
              background: "#fff",
              cursor: "pointer",
              font: "inherit",
              fontSize: "0.875rem",
            }}
          >
            Try again
          </button>
        </main>
      </body>
    </html>
  );
}
