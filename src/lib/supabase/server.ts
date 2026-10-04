import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { cache } from "react";
import type { Database } from "./database.types";

/**
 * Supabase client for Server Components, Server Actions and Route Handlers.
 * Create a new one per request; don't share it between requests.
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Called from a Server Component, where cookies are read-only.
            // Safe to ignore: the proxy refreshes the session cookies.
          }
        },
      },
    }
  );
}

export type SessionUser = {
  id: string;
  email: string | null;
  /** Display name from the identity provider (e.g. Google), if any. */
  name: string | null;
  avatarUrl: string | null;
};

/** The signed-in user (verified JWT claims), deduplicated per request. */
export const getUser = cache(async (): Promise<SessionUser | null> => {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (!claims?.sub) return null;

  const meta = (claims.user_metadata ?? {}) as Record<string, unknown>;
  const text = (value: unknown) =>
    typeof value === "string" && value.trim() ? value.trim() : null;

  return {
    id: claims.sub,
    email: claims.email ?? null,
    name: text(meta.full_name) ?? text(meta.name),
    avatarUrl: text(meta.avatar_url) ?? text(meta.picture),
  };
});
