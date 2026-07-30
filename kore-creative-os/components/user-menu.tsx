"use client";

import { createClient } from "@/lib/supabase/client";

export function UserMenu({
  email,
  compact = false,
}: {
  email: string;
  compact?: boolean;
}) {
  async function logout() {
    const supabase = createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (user) {
      await supabase
        .from("portal_access_logs")
        .insert({
          user_id: user.id,
          event: "logout",
          user_agent: navigator.userAgent,
        });
    }

    await supabase.auth.signOut();

    window.location.assign("/login");
  }

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: compact
          ? "center"
          : "flex-end",
        gap: 10,
      }}
    >
      {!compact && (
        <span
          style={{
            color: "#767b84",
            fontSize: 10,
          }}
        >
          {email}
        </span>
      )}

      <button
        type="button"
        onClick={() => void logout()}
        style={{
          minHeight: 34,
          padding: "0 12px",
          border: "1px solid #dfe2e7",
          borderRadius: 9,
          background: "#fff",
          color: "#4c5159",
          fontSize: 10,
          fontWeight: 750,
          cursor: "pointer",
        }}
      >
        Cerrar sesión
      </button>
    </div>
  );
}