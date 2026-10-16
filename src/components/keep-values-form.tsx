"use client";
import { startTransition, type FormHTMLAttributes } from "react";

type Props = Omit<FormHTMLAttributes<HTMLFormElement>, "action" | "onSubmit"> & { action: (formData: FormData) => void };

// React 19 resets uncontrolled fields after a form action finishes, which wiped everything the person
// typed whenever the server answered with a validation error. Dispatch the action ourselves instead.
export function KeepValuesForm({ action, ...props }: Props) {
  return <form {...props} onSubmit={(event) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget, (event.nativeEvent as SubmitEvent).submitter);
    startTransition(() => action(formData));
  }} />;
}
