import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const PUBLIC_AUTH_ROUTES = ["/login", "/registro", "/verificar"];

function isPublicAuthRoute(pathname: string) {
  return PUBLIC_AUTH_ROUTES.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`),
  );
}

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },

        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => {
            request.cookies.set(name, value);
          });

          response = NextResponse.next({ request });

          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options);
          });
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const pathname = request.nextUrl.pathname;
  const isApi = pathname.startsWith("/api/");
  const isPublic = isPublicAuthRoute(pathname);
  const isPendingPage = pathname === "/pendiente";

  if (!user) {
    if (isPublic) return response;

    if (isApi) {
      return Response.json(
        { error: "Iniciá sesión para continuar." },
        { status: 401 },
      );
    }

    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    loginUrl.searchParams.set("next", pathname);

    return NextResponse.redirect(loginUrl);
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("status, role")
    .eq("id", user.id)
    .maybeSingle();

  const isApproved = profile?.status === "approved";

  if (!isApproved) {
    if (isPendingPage) return response;

    if (isApi) {
      return Response.json(
        { error: "Tu cuenta todavía no fue aprobada." },
        { status: 403 },
      );
    }

    const pendingUrl = request.nextUrl.clone();
    pendingUrl.pathname = "/pendiente";
    pendingUrl.search = "";

    return NextResponse.redirect(pendingUrl);
  }

  if (isPublic || isPendingPage) {
    const homeUrl = request.nextUrl.clone();
    homeUrl.pathname = "/";
    homeUrl.search = "";

    return NextResponse.redirect(homeUrl);
  }

  return response;
}