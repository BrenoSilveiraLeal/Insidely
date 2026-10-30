"use client";

import { useEffect } from "react";

// Registers /sw.js so the site can be installed as an app ("Adicionar à tela de início").
export function ServiceWorkerRegister() {
  useEffect(() => {
    if ("serviceWorker" in navigator && process.env.NODE_ENV === "production") void navigator.serviceWorker.register("/sw.js").catch(() => undefined);
  }, []);
  return null;
}
