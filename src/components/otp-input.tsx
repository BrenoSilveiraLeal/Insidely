"use client";

import { useRef, type ClipboardEvent, type KeyboardEvent } from "react";

// Six boxes, one digit each: typing moves to the next box, Backspace goes back, and pasting the
// whole code fills every box. The parent keeps the value as a plain 6-character string.
export function OtpInput({ id, value, onChange, autoFocus }: { id: string; value: string; onChange: (value: string) => void; autoFocus?: boolean }) {
  const boxes = useRef<(HTMLInputElement | null)[]>([]);
  const digits = Array.from({ length: 6 }, (_, index) => value[index] ?? "");
  const focus = (index: number) => boxes.current[Math.max(0, Math.min(5, index))]?.focus();
  const setDigit = (index: number, digit: string) => {
    const next = digits.slice();
    next[index] = digit;
    onChange(next.join("").slice(0, 6));
  };
  const handleKey = (index: number, event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Backspace" && !digits[index] && index > 0) { event.preventDefault(); setDigit(index - 1, ""); focus(index - 1); }
    if (event.key === "ArrowLeft") { event.preventDefault(); focus(index - 1); }
    if (event.key === "ArrowRight") { event.preventDefault(); focus(index + 1); }
  };
  const handlePaste = (event: ClipboardEvent<HTMLInputElement>) => {
    const pasted = event.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (!pasted) return;
    event.preventDefault();
    onChange(pasted);
    focus(pasted.length);
  };
  return <div className="otp-input" role="group" aria-labelledby={`${id}-label`}>
    {digits.map((digit, index) => <input key={index} ref={(element) => { boxes.current[index] = element; }} id={index === 0 ? id : undefined} className="otp-box" inputMode="numeric" autoComplete={index === 0 ? "one-time-code" : "off"} maxLength={1} pattern="[0-9]" aria-label={`Dígito ${index + 1} de 6`} autoFocus={autoFocus && index === 0} value={digit}
      onChange={(event) => { const typed = event.target.value.replace(/\D/g, ""); if (typed.length > 1) { onChange(typed.slice(0, 6)); focus(typed.length); return; } setDigit(index, typed); if (typed) focus(index + 1); }}
      onKeyDown={(event) => handleKey(index, event)} onPaste={handlePaste} onFocus={(event) => event.target.select()}/>)}
  </div>;
}
