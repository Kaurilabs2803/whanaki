"use client";

import { useAuth as useClerkAuth } from "@clerk/nextjs";
import { useCallback, useRef } from "react";

/**
 * Thin wrapper around Clerk's useAuth that caches the token for 55 seconds
 * to avoid hammering the Clerk API on every keystroke/re-render.
 */
export function useToken() {
  const { getToken } = useClerkAuth();
  const cache = useRef<{ token: string; expires: number } | null>(null);

  const get = useCallback(async (): Promise<string> => {
    if (cache.current && Date.now() < cache.current.expires) {
      return cache.current.token;
    }
    const token = await getToken();
    if (!token) throw new Error("Not authenticated");
    cache.current = { token, expires: Date.now() + 55_000 };
    return token;
  }, [getToken]);

  return { getToken: get };
}
