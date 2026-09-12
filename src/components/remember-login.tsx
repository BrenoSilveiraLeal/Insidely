"use client";

import { useEffect } from "react";

const EMAIL_KEY = "insidely:login-email";

/** Remembers only the email; passwords remain managed by the browser. */
export function RememberLogin() {
  useEffect(() => {
    const form = document.querySelector<HTMLFormElement>("form.auth-form");
    const email = form?.querySelector<HTMLInputElement>('input[name="email"]');
    if (!form || !email) return;

    email.autocomplete = "username";
    const password = form.querySelector<HTMLInputElement>('input[name="password"]');
    if (password) password.autocomplete = "current-password";

    let remembered = false;
    try {
      const savedEmail = window.localStorage.getItem(EMAIL_KEY);
      if (savedEmail) {
        email.value = savedEmail;
        email.dispatchEvent(new Event("input", { bubbles: true }));
        remembered = true;
      }
    } catch {
      // Private browsing and storage policies must not block login.
    }

    const label = document.createElement("label");
    label.className = "check-row";
    label.innerHTML = '<input type="checkbox" name="remember" /><span>Lembrar de mim neste dispositivo</span>';
    const checkbox = label.querySelector<HTMLInputElement>('input[name="remember"]');
    if (!checkbox) return;
    checkbox.checked = remembered;
    const submit = form.querySelector("button[type=submit]");
    if (submit) form.insertBefore(label, submit);
    else form.append(label);

    const rememberEmail = () => {
      try {
        if (checkbox.checked && email.value.trim()) window.localStorage.setItem(EMAIL_KEY, email.value.trim());
        else window.localStorage.removeItem(EMAIL_KEY);
      } catch {
        // Login must continue even when storage is unavailable.
      }
    };
    form.addEventListener("submit", rememberEmail);
    return () => {
      form.removeEventListener("submit", rememberEmail);
      label.remove();
    };
  }, []);

  return null;
}
