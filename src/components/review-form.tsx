"use client";

import { Star } from "lucide-react";
import { useActionState, useState } from "react";
import { submitReviewAction } from "@/app/actions";

export function ReviewForm({ bookingId, professionalName, date }: { bookingId: string; professionalName: string; date: string }) {
  const [rating, setRating] = useState(5); const [state, action, pending] = useActionState(submitReviewAction, undefined);
  return <article className="panel review-form"><span className="eyebrow">Conversa concluída · {date}</span><h2>Como foi conversar com {professionalName}?</h2><form action={action} className="form-stack"><input type="hidden" name="bookingId" value={bookingId}/><input type="hidden" name="rating" value={rating}/><div className="rating-picker" role="radiogroup" aria-label="Sua nota">{[1,2,3,4,5].map((value) => <button key={value} type="button" aria-label={`${value} estrelas`} className={value <= rating ? "rating-active" : ""} onClick={() => setRating(value)}><Star size={25} fill="currentColor"/></button>)}</div><div className="field"><label htmlFor={`review-${bookingId}`}>Sua experiência</label><textarea className="textarea" id={`review-${bookingId}`} name="comment" minLength={12} maxLength={800} required placeholder="O que você diria para ajudar outra pessoa a decidir?"/></div>{state && <p className={state.status === "error" ? "form-error" : "form-feedback"}>{state.message}</p>}<button className="button button-dark" disabled={pending}>{pending ? "Publicando…" : "Publicar avaliação"}</button></form></article>;
}
