"use client";

import {
  FormEvent,
  useEffect,
  useState,
} from "react";

import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import styles from "../login/auth.module.css";

const OTP_LENGTH = 8;

export default function VerifyPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [token, setToken] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [hasError, setHasError] = useState(false);

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
    setMessage("");
    setHasError(false);

    const cleanToken = token.replace(/\D/g, "");

    if (cleanToken.length !== OTP_LENGTH) {
      setMessage(
        `Ingresá los ${OTP_LENGTH} dígitos del código.`,
      );
      setHasError(true);
      setLoading(false);
      return;
    }

    const supabase = createClient();

    const { data, error: verifyError } =
      await supabase.auth.verifyOtp({
        email: email.trim(),
        token: cleanToken,
        type: "email",
      });

    if (verifyError || !data.user) {
      console.error("Error verificando OTP:", verifyError);

      setMessage(
        "El código es incorrecto o venció. Solicitá uno nuevo y utilizá el último correo recibido.",
      );
      setHasError(true);
      setLoading(false);
      return;
    }

    await supabase
      .from("portal_access_logs")
      .insert({
        user_id: data.user.id,
        event: "email_verified",
        user_agent: navigator.userAgent,
      });

    router.replace("/pendiente");
    router.refresh();
  }

  async function resendCode() {
    if (!email.trim()) {
      setMessage("Ingresá primero tu correo electrónico.");
      setHasError(true);
      return;
    }

    setLoading(true);
    setMessage("");
    setHasError(false);

    const supabase = createClient();

    const { error: resendError } =
      await supabase.auth.resend({
        type: "signup",
        email: email.trim(),
      });

    if (resendError) {
      console.error(
        "Error reenviando código:",
        resendError,
      );

      setMessage(
        "No pudimos reenviar el código. Esperá unos segundos e intentá nuevamente.",
      );
      setHasError(true);
      setLoading(false);
      return;
    }

    setMessage(
      "Código reenviado. Utilizá el código del correo más reciente.",
    );
    setHasError(false);
    setLoading(false);
  }

  return (
    <main className={styles.shell}>
      <section className={styles.card}>
        <span className={styles.eyebrow}>
          VERIFICACIÓN
        </span>

        <h1>Revisá tu correo</h1>

        <p>
          Ingresá el código de {OTP_LENGTH} dígitos que
          enviamos a tu email.
        </p>

        <form
          onSubmit={handleSubmit}
          className={styles.form}
        >
          <label>
            Correo electrónico

            <input
              type="email"
              value={email}
              onChange={(event) =>
                setEmail(event.target.value)
              }
              autoComplete="email"
              required
            />
          </label>

          <label>
            Código de verificación

            <input
              className={styles.codeInput}
              value={token}
              onChange={(event) => {
                const value = event.target.value
                  .replace(/\D/g, "")
                  .slice(0, OTP_LENGTH);

                setToken(value);
              }}
              inputMode="numeric"
              autoComplete="one-time-code"
              placeholder="00000000"
              minLength={OTP_LENGTH}
              maxLength={OTP_LENGTH}
              required
            />
          </label>

          {message && (
            <div
              className={
                hasError
                  ? styles.error
                  : styles.message
              }
            >
              {message}
            </div>
          )}

          <button
            type="submit"
            disabled={
              loading ||
              token.length !== OTP_LENGTH
            }
          >
            {loading
              ? "Verificando…"
              : "Verificar correo"}
          </button>

          <button
            type="button"
            className={styles.secondaryButton}
            onClick={() => void resendCode()}
            disabled={loading}
          >
            Reenviar código
          </button>
        </form>
      </section>
    </main>
  );
}