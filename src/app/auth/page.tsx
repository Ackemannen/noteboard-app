import { redirect } from "next/navigation";
import { getUser } from "@/lib/supabase/server";
import { safeNextPath } from "@/lib/redirect";
import AuthForm from "./AuthForm";

export const metadata = { title: "Sign in · Collaboard" };

export default async function AuthPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const { next, error } = await searchParams;
  const nextPath = safeNextPath(next);

  if (await getUser()) redirect(nextPath);

  return <AuthForm next={nextPath} initialError={error ?? ""} />;
}
