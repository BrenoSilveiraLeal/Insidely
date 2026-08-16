"use client";
import { Heart } from "lucide-react";
import { useState } from "react";
import { toggleFavoriteAction } from "@/app/actions";
export function FavoriteButton({ profileId }: { profileId: string }) { const [saved,setSaved]=useState(false); return <button className={`button button-ghost button-block favorite-button${saved?" is-saved":""}`} type="submit" onClick={()=>setSaved(v=>!v)} formAction={toggleFavoriteAction.bind(null,profileId)}><Heart size={16} fill={saved?"currentColor":"none"}/> {saved?"Perfil salvo":"Salvar perfil"}</button>; }
