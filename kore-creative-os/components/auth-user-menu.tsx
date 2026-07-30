import { createClient } from "@/lib/supabase/server";
import { UserMenu } from "@/components/user-menu";

export async function AuthUserMenu() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return null;
  }

  return (
    <div
      style={{
        position: "fixed",
        right: 18,
        bottom: 18,
        zIndex: 80,
        padding: 8,
        border: "1px solid #e1e4e9",
        borderRadius: 12,
        background: "rgba(255,255,255,.92)",
        boxShadow:
          "0 12px 35px rgba(26,31,41,.12)",
        backdropFilter: "blur(12px)",
      }}
    >
      <UserMenu email={user.email || ""} />
    </div>
  );
}