"use client";

import { useEffect, useState } from "react";

// Result of a form action shown for a few seconds, then faded out. Remount it with a new key
// for each submission so the timer starts over.
export function TimedMessage({ text, error, duration }: { text: string; error: boolean; duration?: number }) {
  const [phase, setPhase] = useState<"shown" | "leaving" | "gone">("shown");
  const wait = duration ?? (error ? 8000 : 4000);
  useEffect(() => {
    const leave = setTimeout(() => setPhase("leaving"), wait);
    const gone = setTimeout(() => setPhase("gone"), wait + 400);
    return () => { clearTimeout(leave); clearTimeout(gone); };
  }, [wait]);
  if (phase === "gone") return null;
  return <p className={`${error ? "form-error" : "form-feedback"} timed-message${phase === "leaving" ? " notice-leaving" : ""}`} role={error ? "alert" : "status"}>{text}</p>;
}
