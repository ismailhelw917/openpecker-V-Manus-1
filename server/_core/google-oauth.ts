import type { Express, Request, Response } from "express";
import * as db from "../db";
import { getSessionCookieOptions } from "./cookies";
import { sdk } from "./sdk";
import { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;

/**
 * Generate Google OAuth authorization URL
 * User is redirected to this URL to login with Google
 */
export function getGoogleAuthUrl(returnPath: string = "/"): string {
  const redirectUri = `${process.env.NODE_ENV === "production" ? "https://openpecker.com" : "http://localhost:3000"}/api/oauth/google/callback`;

  // Encode return path in state for redirect after login
  const state = btoa(JSON.stringify({ returnPath }));

  const params = new URLSearchParams({
    client_id: GOOGLE_CLIENT_ID || "",
    redirect_uri: redirectUri,
    response_type: "code",
    scope: "openid email profile",
    state: state,
    access_type: "offline",
  });

  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

/**
 * Exchange Google authorization code for access token
 */
async function exchangeCodeForToken(code: string, redirectUri: string) {
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: GOOGLE_CLIENT_ID || "",
      client_secret: GOOGLE_CLIENT_SECRET || "",
      code,
      grant_type: "authorization_code",
      redirect_uri: redirectUri,
    }).toString(),
  });

  if (!response.ok) {
    throw new Error(`Google token exchange failed: ${response.statusText}`);
  }

  return response.json();
}

/**
 * Get user info from Google using access token
 */
async function getGoogleUserInfo(accessToken: string) {
  const response = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok) {
    throw new Error(`Failed to get Google user info: ${response.statusText}`);
  }

  return response.json();
}

/**
 * Register Google OAuth routes
 */
export function registerGoogleOAuthRoutes(app: Express) {
  /**
   * Initiate Google login
   * Frontend redirects here to start the OAuth flow
   */
  app.get("/api/oauth/google/login", (req: Request, res: Response) => {
    const returnPath = typeof req.query.returnPath === "string" ? req.query.returnPath : "/";
    const authUrl = getGoogleAuthUrl(returnPath);
    res.redirect(authUrl);
  });

  /**
   * Google OAuth callback
   * Google redirects here after user authorizes
   */
  app.get("/api/oauth/google/callback", async (req: Request, res: Response) => {
    const code = typeof req.query.code === "string" ? req.query.code : null;
    const state = typeof req.query.state === "string" ? req.query.state : null;
    const error = typeof req.query.error === "string" ? req.query.error : null;

    if (error) {
      console.error("[Google OAuth] User denied access:", error);
      return res.redirect("/?error=access_denied");
    }

    if (!code || !state) {
      console.error("[Google OAuth] Missing code or state");
      return res.status(400).json({ error: "code and state are required" });
    }

    try {
      // Parse return path from state
      let returnPath = "/";
      try {
        const stateObj = JSON.parse(atob(state));
        if (stateObj.returnPath && stateObj.returnPath.startsWith("/")) {
          returnPath = stateObj.returnPath;
        }
      } catch {
        // Ignore state parsing errors
      }

      // Exchange code for token
      const redirectUri = `${process.env.NODE_ENV === "production" ? "https://openpecker.com" : "http://localhost:3000"}/api/oauth/google/callback`;
      const tokenResponse = await exchangeCodeForToken(code, redirectUri);

      // Get user info
      const googleUser = await getGoogleUserInfo(tokenResponse.access_token);

      if (!googleUser.id) {
        console.error("[Google OAuth] Missing user ID from Google");
        return res.status(400).json({ error: "Failed to get user info from Google" });
      }

      // Use Google ID as openId (prefixed to avoid conflicts)
      const openId = `google_${googleUser.id}`;

      // Upsert user in database
      await db.upsertUser({
        openId,
        name: googleUser.name || null,
        email: googleUser.email || null,
        loginMethod: "google",
        lastSignedIn: new Date(),
      });

      // Create session token using Manus SDK
      const sessionToken = await sdk.createSessionToken(openId, {
        name: googleUser.name || "",
        expiresInMs: ONE_YEAR_MS,
      });

      // Set session cookie
      const cookieOptions = getSessionCookieOptions(req);
      res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: ONE_YEAR_MS });

      // Redirect to return path
      res.redirect(302, returnPath);
    } catch (error) {
      console.error("[Google OAuth] Callback failed:", error);
      res.redirect("/?error=oauth_failed");
    }
  });
}
