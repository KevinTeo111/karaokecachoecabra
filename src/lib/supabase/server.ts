import { createServerClient } from "@supabase/ssr";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { HttpError } from "@/lib/server/http";

function env(name: string) {
  const v = process.env[name];
  if (!v) throw new Error(`Falta la variable de entorno ${name}`);
  return v;
}

export const SUPABASE_URL = () => env("NEXT_PUBLIC_SUPABASE_URL");
export const SUPABASE_ANON_KEY = () => env("NEXT_PUBLIC_SUPABASE_ANON_KEY");
const SERVICE_ROLE_KEY = () => env("SUPABASE_SERVICE_ROLE_KEY");

let service: SupabaseClient | null = null;

/** Service-role client: bypasses RLS. Server only, never exposed to browsers. */
export function serviceClient(): SupabaseClient {
  service ??= createClient(SUPABASE_URL(), SERVICE_ROLE_KEY(), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return service;
}

/** Anon client bound to the request's auth cookies, for admin identity. */
export async function authClient() {
  const store = await cookies();
  return createServerClient(SUPABASE_URL(), SUPABASE_ANON_KEY(), {
    cookies: {
      getAll: () => store.getAll(),
      setAll: (list) => {
        try {
          for (const { name, value, options } of list) store.set(name, value, options);
        } catch {
          /* read-only context (server component); middleware refreshes tokens */
        }
      },
    },
  });
}

export interface Admin {
  userId: string;
  role: "OWNER" | "HOST";
}

/** Returns the signed-in admin, or null when the request is not from an admin. */
export async function currentAdmin(): Promise<Admin | null> {
  const supabase = await authClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return null;
  const { data: row } = await serviceClient()
    .from("admin_users")
    .select("role")
    .eq("id", data.user.id)
    .maybeSingle();
  return row ? { userId: data.user.id, role: row.role } : null;
}

export async function requireAdmin(): Promise<Admin> {
  const admin = await currentAdmin();
  if (!admin) throw new HttpError(403, "Acceso solo para animadores");
  return admin;
}
