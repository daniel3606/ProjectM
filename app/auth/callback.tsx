import { useAuth } from "@/contexts/AuthContext";
import { useRouter } from "expo-router";
import { useEffect } from "react";

/** Landing route for `marshmallow://auth/callback` after email confirmation. */
export default function AuthCallbackScreen() {
  const { session, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (isLoading) return;
    if (session) {
      router.replace("/");
      return;
    }

    const timeout = setTimeout(() => {
      router.replace("/");
    }, 2500);
    return () => clearTimeout(timeout);
  }, [isLoading, session, router]);

  return null;
}
