"use client";

import {
  FormEvent,
  useEffect,
  useState,
} from "react";

import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import styles from "../login/auth.module.css";

export default function VerifyPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [token, setToken] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const emailFromUrl =
      new URLSearchParams(window.location.search).get(
        "email",
      );

    if (emailFromUrl) {
      setEmail(emailFromUrl);
    }
  }, []);

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    setLoading(true);
    setError("");

    const supabase = createClient();

    const { data, error: verifyError } =
      await supabase.auth.verifyOtp({
        email,
        token: token.replace(/\D/g, ""),
        type: "email",
      });

    if (verifyError || !data.user) {
      setError(
        "El código es incorrecto o venció. Solicitá uno nuevo.",
      );
      setLoading(false);
      return;
    }

    await supabase.from("portal_access_logs").insert({
      user_id: data.user.id,
      event: "email_verified",
      user_agent: navigator.userAgent,
    });

    router.replace("/pendiente");
    router.refresh();
  }

  async function resendCode() {
    setError("");

    const supabase = createClient();

    const { error: resendError } =
      await supabase.auth.resend({
        type: "signup",
        email,
      });

    if (resendError) {
      setError(resendError.message);
      return;
    }

    setError(
      "Código reenviado. Revisá también la carpeta de spam.",
    );
  }

  return (
    <main className={styles.shell}>
      <section className={styles.card}>
        <span className={styles.eyebrow}>
          VERIFICACIÓN
        </span>

        <h1>Revisá tu correo</h1>

        <p>
          Ingresá el código de seis dígitos que enviamos
          a tu email.
        </p>

        <form onSubmit={handleSubmit} className={styles.form}>
          <label>
            Correo electrónico

            <input
              type="email"
              value={email}
              onChange={(event) =>
                setEmail(event.target.value)
              }
              required
            />
          </label>

          <label>
            Código de verificación

            <input
              className={styles.codeInput}
              value={token}
              onChange={(event) =>
                setToken(
                  event.target.value
                    .replace(/\D/g, "")
                    .slice(0, 6),
                )
              }
              inputMode="numeric"
              autoComplete="one-time-code"
              placeholder="000000"
              minLength={6}
              maxLength={6}
              required
            />
          </label>

          {error && (
            <div className={styles.message}>
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading || token.length !== 6}
          >
            {loading
              ? "Verificando…"
              : "Verificar correo"}
          </button>

          <button
            type="button"
            className={styles.secondaryButton}
            onClick={() => void resendCode()}
          >
            Reenviar código
          </button>
        </form>
      </section>
    </main>
  );
}