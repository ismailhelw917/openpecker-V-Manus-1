export { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";

// Generate Google OAuth login URL
// returnPath: optional path to redirect to after successful login (e.g., "/train")
export const getLoginUrl = (returnPath?: string) => {
  const path = returnPath || "/";
  return `/api/oauth/google/login?returnPath=${encodeURIComponent(path)}`;
};
