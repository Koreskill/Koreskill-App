import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { UserMenu } from "@/components/user-menu";
import styles from "../login/auth.module.css";

export default async function PendingPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("status")
    .eq("id", user.id)
    .maybeSingle();

  if (profile?.status === "approved") {
    redirect("/");
  }

  return (
    <main className={styles.shell}>
      <section className={styles.card}>
        <span className={styles.eyebrow}>
          CUENTA VERIFICADA
        </span>

        <h1>Acceso pendiente</h1>

        <p>
          Tu correo ya fue verificado. Un administrador
          debe aprobar tu cuenta antes de que puedas usar
          el portal.
        </p>

        <div className={styles.pendingEmail}>
          {user.email}
        </div>

        <UserMenu
          email={user.email || ""}
          compact
        />
      </section>
    </main>
  );
}