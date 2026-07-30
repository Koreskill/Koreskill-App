import type { SupabaseClient, User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

type ApprovedProfile = {
  status: "approved";
  role: "user" | "admin";
  email: string;
  full_name: string | null;
};

type ApprovedUserResult =
  | {
      ok: true;
      supabase: SupabaseClient;
      user: User;
      profile: ApprovedProfile;
    }
  | {
      ok: false;
      response: Response;
    };

export async function requireApprovedUser(): Promise<ApprovedUserResult> {
  const supabase = await createClient();

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    return {
      ok: false,
      response: Response.json(
        { error: "Iniciá sesión para continuar." },
        { status: 401 },
      ),
    };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("status, role, email, full_name")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile || profile.status !== "approved") {
    return {
      ok: false,
      response: Response.json(
        { error: "Tu cuenta todavía no fue aprobada." },
        { status: 403 },
      ),
    };
  }

  return {
    ok: true,
    supabase,
    user,
    profile: profile as ApprovedProfile,
  };
}