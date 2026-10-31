"use client";

import { useOptimistic, useTransition } from "react";
import { toggleAvailabilityWatchAction } from "@/app/actions";

// "Avise-me quando abrir horário": the button flips at once; the server saves in the background.
export function AvailabilityWatchButton({ profileId, watching }: { profileId: string; watching: boolean }) {
  const [shown, setShown] = useOptimistic(watching);
  const [, startTransition] = useTransition();
  return <form action={() => startTransition(async () => { setShown(!shown); await toggleAvailabilityWatchAction(profileId); })}>
    <button className={`button ${shown ? "button-ghost" : "button-dark"} button-sm`}>{shown ? "✓ Você será avisado · cancelar" : "Avise-me quando abrir horário"}</button>
  </form>;
}
