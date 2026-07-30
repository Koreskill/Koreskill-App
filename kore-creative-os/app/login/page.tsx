"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import styles from "./auth.module.css";

export default function LoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setLoading(true);
    setError("");

    const supabase = createClient();

    const { data, error: signInError } =
      await supabase.auth.signInWithPassword({
        email,
        password,
      });

    if (signInError || !data.user) {
      setError("El correo o la contraseña no son correctos.");
      setLoading(false);
      return;
    }

    await supabase.from("portal_access_logs").insert({
      user_id: data.user.id,
      event: "login",
      user_agent: navigator.userAgent,
    });

    const { data: profile } = await supabase
      .from("profiles")
      .select("status")
      .eq("id", data.user.id)
      .maybeSingle();

    if (profile?.status !== "approved") {
      router.replace("/pendiente");
    } else {
      router.replace("/");
    }

    router.refresh();
  }

  return (
    <main className={styles.shell}>
      <section className={styles.card}>
        <span className={styles.eyebrow}>
          KORE CREATIVE OS
        </span>

        <h1>Ingresar al portal</h1>

        <p>Accedé con tu correo y contraseña.</p>

        <form onSubmit={handleSubmit} className={styles.form}>
          <label>
            Correo electrónico

            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              autoComplete="email"
              required
            />
          </label>

          <label>
            Contraseña

            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="current-password"
              minLength={8}
              required
            />
          </label>

          {error && (
            <div className={styles.error}>
              {error}
            </div>
          )}

          <button type="submit" disabled={loading}>
            {loading ? "Verificando…" : "Ingresar"}
          </button>
        </form>

        <footer>
          ¿Todavía no tenés una cuenta?{" "}
          <Link href="/registro">
            Solicitar acceso
          </Link>
        </footer>
      </section>
    </main>
  );
}