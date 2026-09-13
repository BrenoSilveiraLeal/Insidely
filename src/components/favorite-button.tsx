"use client";

import { Heart } from "lucide-react";
import { useState } from "react";
import { toggleFavoriteAction } from "@/app/actions";
import { ProfileShareButton } from "@/components/profile-share-button";

export function FavoriteButton({ profileId, initialSaved = false, showShare = true }: { profileId: string; initialSaved?: boolean; showShare?: boolean }) {
  const [saved, setSaved] = useState(initialSaved);
  return <div className="favorite-actions">
    <button className={`button button-ghost button-block favorite-button${saved ? " is-saved" : ""}`} type="submit" onClick={() => setSaved((value) => !value)} formAction={toggleFavoriteAction.bind(null, profileId)} aria-pressed={saved}>
      <Heart size={16} fill={saved ? "currentColor" : "none"} /> {saved ? "Perfil salvo" : "Salvar perfil"}
    </button>
    {showShare && <ProfileShareButton profileId={profileId} />}
  </div>;
}
