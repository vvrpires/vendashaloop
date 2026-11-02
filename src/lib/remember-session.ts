const BEARER_KEY = "grok-auth.bearer-token";

/** Keep the preview session when email sign-in returns a bearer token. */
export function rememberSessionToken(token: string | null | undefined) {
  if (typeof window === "undefined" || !token) return;
  try {
    window.sessionStorage.setItem(BEARER_KEY, token);
  } catch {
    /* ignore */
  }
}
