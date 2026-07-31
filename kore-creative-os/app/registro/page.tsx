"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import styles from "../login/auth.module.css";

export default function RegisterPage() {
  const router = useRouter();

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    setLoading(true);
    setError("");

    const supabase = createClient();

    const { error: signUpError } =
      await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName,
          },
        },
      });

    if (signUpError) {
      setError(signUpError.message);
      setLoading(false);
      return;
    }

    router.push(
      `/verificar?email=${encodeURIComponent(email)}`,
    );
  }

  return (
    <main className={styles.shell}>
      <section className={styles.card}>
        <span className={styles.eyebrow}>
          SOLICITUD DE ACCESO
        </span>

        <h1>Crear una cuenta</h1>

        <p>
          Después verificaremos tu correo con un código
          de ocho dígitos.
        </p>

        <form onSubmit={handleSubmit} className={styles.form}>
          <label>
            Nombre y apellido

            <input
              value={fullName}
              onChange={(event) =>
                setFullName(event.target.value)
              }
              autoComplete="name"
              required
            />
          </label>

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
            Contraseña

            <input
              type="password"
              value={password}
              onChange={(event) =>
                setPassword(event.target.value)
              }
              autoComplete="new-password"
              minLength={8}
              required
            />

            <small>Usá como mínimo 8 caracteres.</small>
          </label>

          {error && (
            <div className={styles.error}>
              {error}
            </div>
          )}

          <button type="submit" disabled={loading}>
            {loading
              ? "Creando cuenta…"
              : "Crear cuenta"}
          </button>
        </form>

        <footer>
          ¿Ya tenés cuenta?{" "}
          <Link href="/login">Ingresar</Link>
        </footer>
      </section>
    </main>
  );
}