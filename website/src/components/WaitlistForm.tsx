"use client";

import { FormEvent, useId, useMemo, useState, useTransition } from "react";
import { useSearchParams } from "next/navigation";
import { sanitizeSource } from "@/lib/source";
import styles from "./WaitlistForm.module.css";

type FormStatus = "idle" | "invalid" | "success" | "exists" | "error";

type WaitlistFormProps = {
  id?: string;
  compact?: boolean;
  autoFocus?: boolean;
};

export default function WaitlistForm({
  id = "waitlist",
  compact = false,
  autoFocus = false,
}: WaitlistFormProps) {
  const inputId = useId();
  const errorId = useId();
  const searchParams = useSearchParams();
  const refParam = searchParams.get("ref");
  const source = useMemo(() => sanitizeSource(refParam), [refParam]);
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<FormStatus>("idle");
  const [isPending, startTransition] = useTransition();

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isPending) return;

    const trimmed = email.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      setStatus("invalid");
      return;
    }

    startTransition(async () => {
      try {
        const response = await fetch("/api/waitlist", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: trimmed, source }),
        });
        const result = (await response.json()) as { status?: FormStatus };
        const next =
          result.status === "success" ||
          result.status === "exists" ||
          result.status === "invalid" ||
          result.status === "error"
            ? result.status
            : "error";
        setStatus(next);
        if (next === "success" || next === "exists") {
          setEmail("");
        }
      } catch {
        setStatus("error");
      }
    });
  };

  if (status === "success" || status === "exists") {
    return (
      <div
        className={[styles.success, compact ? styles.compact : ""].join(" ")}
        role="status"
        aria-live="polite"
      >
        <p className={styles.successTitle}>
          {status === "exists" ? "You're already on the waitlist." : "You're on the list."}
        </p>
        <p className={styles.successBody}>
          We&apos;ll email you when Marshmallow is ready.
        </p>
      </div>
    );
  }

  return (
    <form
      id={id}
      className={[styles.form, compact ? styles.compact : ""].join(" ")}
      onSubmit={onSubmit}
      noValidate
    >
      <div className={styles.row}>
        <label className="sr-only" htmlFor={inputId}>
          Email address
        </label>
        <input
          id={inputId}
          className={styles.input}
          type="email"
          name="email"
          autoComplete="email"
          inputMode="email"
          placeholder="you@email.com"
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            if (status === "invalid" || status === "error") setStatus("idle");
          }}
          aria-invalid={status === "invalid"}
          aria-describedby={status === "invalid" || status === "error" ? errorId : undefined}
          disabled={isPending}
          autoFocus={autoFocus}
        />
        <button className={styles.button} type="submit" disabled={isPending}>
          {isPending ? "Joining…" : "Join the Waitlist"}
        </button>
      </div>
      {status === "invalid" ? (
        <p id={errorId} className={styles.error} role="alert">
          Enter a valid email address.
        </p>
      ) : null}
      {status === "error" ? (
        <p id={errorId} className={styles.error} role="alert">
          Something went wrong. Please try again.
        </p>
      ) : null}
    </form>
  );
}
