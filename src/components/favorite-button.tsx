import { Heart } from "lucide-react";
import { toggleFavoriteAction } from "@/app/actions";
import { ProfileShareButton } from "@/components/profile-share-button";

export function FavoriteButton({ profileId, initialSaved = false, showShare = true }: { profileId: string; initialSaved?: boolean; showShare?: boolean }) {
  return <div className="favorite-actions">
    <form action={toggleFavoriteAction.bind(null, profileId)}>
      <button className={`button button-ghost button-block favorite-button${initialSaved ? " is-saved" : ""}`} type="submit" aria-pressed={initialSaved}>
        <Heart size={16} fill={initialSaved ? "currentColor" : "none"} /> {initialSaved ? "Perfil salvo" : "Salvar perfil"}
      </button>
    </form>
    {showShare && <ProfileShareButton profileId={profileId} />}
  </div>;
}
