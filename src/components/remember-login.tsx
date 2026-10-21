"use client";

import { useEffect, useRef, useState } from "react";
import { CheckBox } from "@/components/check-box";

const EMAIL_KEY = "insidely:login-email";

/** Remembers only the email; passwords remain managed by the browser. Render it inside the login form. */
export function RememberLogin() {
  const ref = useRef<HTMLInputElement>(null);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    const form = ref.current?.form;
    const email = form?.querySelector<HTMLInputElement>('input[name="email"]');
    if (!form || !email) return;
    try {
      const savedEmail = window.localStorage.getItem(EMAIL_KEY);
      if (savedEmail) {
        if (!email.value) email.value = savedEmail;
        // eslint-disable-next-line react-hooks/set-state-in-effect -- localStorage is only readable after hydration
        setChecked(true);
      }
    } catch {
      // Private browsing and storage policies must not block login.
    }
    const rememberEmail = () => {
      try {
        if (ref.current?.checked && email.value.trim()) window.localStorage.setItem(EMAIL_KEY, email.value.trim());
        else window.localStorage.removeItem(EMAIL_KEY);
      } catch {
        // Login must continue even when storage is unavailable.
      }
    };
    form.addEventListener("submit", rememberEmail);
    return () => form.removeEventListener("submit", rememberEmail);
  }, []);

  return <CheckBox ref={ref} name="remember" checked={checked} onChange={(event) => setChecked(event.target.checked)}>Lembrar de mim neste dispositivo</CheckBox>;
}
