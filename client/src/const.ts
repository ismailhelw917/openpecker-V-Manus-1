export { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";

// Helper to encode state using URL-safe base64 (RFC 4648)
function encodeStateBase64Url(obj: any): string {
  const json = JSON.stringify(obj);
  // Use btoa then convert to URL-safe base64 by replacing +/ with -_ and removing =
  const base64 = btoa(json);
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

// The registered OAuth redirect URI must match exactly what's in the Manus OAuth app config.
// Always use openpecker.com so login works from any domain (preview domains are not registered).
const PRODUCTION_ORIGIN = "https://openpecker.com";

// Generate login URL at runtime.
// returnPath: optional path to redirect to after successful login (e.g., "/train")
export const getLoginUrl = (returnPath?: string) => {
  const oauthPortalUrl = import.meta.env.VITE_OAUTH_PORTAL_URL;
  const appId = import.meta.env.VITE_APP_ID;

  // Always use the production origin for the redirect URI so it matches the registered OAuth app.
  // This ensures login works from preview domains (openpecker-eorxrxcp.manus.space) too.
  const redirectUri = `${PRODUCTION_ORIGIN}/api/oauth/callback`;

  // Encode both redirectUri and returnPath in state using URL-safe base64
  const stateObj = { redirectUri, returnPath: returnPath || "/" };
  const state = encodeStateBase64Url(stateObj);

  const url = new URL(`${oauthPortalUrl}/app-auth`);
  url.searchParams.set("appId", appId);
  url.searchParams.set("redirectUri", redirectUri);
  url.searchParams.set("state", state);
  url.searchParams.set("type", "signIn");

  return url.toString();
};
