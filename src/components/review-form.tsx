"use client";

import { Star } from "lucide-react";
import { useActionState, useState } from "react";
import { submitReviewAction } from "@/app/actions";

// Rating goes from 0 to 5: tapping the currently selected star again lowers it by one, down to zero.
export function ReviewForm({ bookingId, professionalName, date }: { bookingId: string; professionalName: string; date: string }) {
  const [rating, setRating] = useState(5); const [state, action, pending] = useActionState(submitReviewAction, undefined);
  if (state?.status === "success") return <article className="panel review-form"><span className="eyebrow">Conversa concluída · {date}</span><h2>Obrigado por avaliar {professionalName}.</h2><p className="form-feedback" role="status">{state.message}</p></article>;
  return <article className="panel review-form"><span className="eyebrow">Conversa concluída · {date}</span><h2>Como foi conversar com {professionalName}?</h2><form action={action} className="form-stack"><input type="hidden" name="bookingId" value={bookingId}/><input type="hidden" name="rating" value={rating}/><div className="rating-row"><div className="rating-picker" role="radiogroup" aria-label="Sua nota de 0 a 5">{[1,2,3,4,5].map((value) => <button key={value} type="button" role="radio" aria-checked={value === rating} aria-label={`${value} ${value === 1 ? "estrela" : "estrelas"}`} className={value <= rating ? "rating-active" : ""} onClick={() => setRating(value === rating ? value - 1 : value)}><Star size={22} fill="currentColor"/></button>)}</div><p className="muted rating-note">{rating} de 5{rating > 0 && <> · <button type="button" className="rating-reset" onClick={() => setRating(0)}>zerar</button></>}</p></div><div className="field"><label htmlFor={`review-${bookingId}`}>Comentário (opcional)</label><textarea className="textarea" id={`review-${bookingId}`} name="comment" rows={3} maxLength={800} placeholder="O que você diria para ajudar outra pessoa a decidir?"/></div>{state && <p className={state.status === "error" ? "form-error" : "form-feedback"}>{state.message}</p>}<button className="button button-dark" disabled={pending}>{pending ? "Publicando…" : "Publicar avaliação"}</button></form></article>;
}
