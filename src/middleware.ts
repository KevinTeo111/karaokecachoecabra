import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/** Keeps admin auth cookies fresh and sends anonymous visitors of /panel to the login. */
export async function middleware(req: NextRequest) {
  let res = NextResponse.next({ request: req });
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => req.cookies.getAll(),
        setAll: (list) => {
          for (const { name, value } of list) req.cookies.set(name, value);
          res = NextResponse.next({ request: req });
          for (const { name, value, options } of list) res.cookies.set(name, value, options);
        },
      },
    },
  );
  const { data } = await supabase.auth.getUser();
  const isLogin = req.nextUrl.pathname === "/panel/login";
  if (!data.user && !isLogin) {
    const url = req.nextUrl.clone();
    url.pathname = "/panel/login";
    return NextResponse.redirect(url);
  }
  if (data.user && isLogin) {
    const url = req.nextUrl.clone();
    url.pathname = "/panel/ahora";
    return NextResponse.redirect(url);
  }
  return res;
}

export const config = { matcher: ["/panel/:path*"] };
