import { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";
import type { Express, Request, Response } from "express";
import * as db from "../db";
import { resetDbConnection } from "../db";
import { getSessionCookieOptions } from "./cookies";
import { sdk } from "./sdk";

function getQueryParam(req: Request, key: string): string | undefined {
  const value = req.query[key];
  return typeof value === "string" ? value : undefined;
}

function parseReturnPath(state: string): string {
  try {
    // First try URL-safe base64 (new format)
    const urlSafeBase64 = state.replace(/-/g, '+').replace(/_/g, '/');
    // Add padding if needed
    const padded = urlSafeBase64 + '='.repeat((4 - (urlSafeBase64.length % 4)) % 4);
    const decoded = atob(padded);
    
    // Try JSON format first (new format with returnPath)
    const parsed = JSON.parse(decoded);
    if (parsed && typeof parsed.returnPath === "string") {
      // Only allow relative paths to prevent open redirect
      const path = parsed.returnPath;
      if (path.startsWith("/") && !path.startsWith("//")) {
        return path;
      }
    }
  } catch {
    // Try legacy format: state is just btoa(redirectUri)
    try {
      const decoded = atob(state);
      const parsed = JSON.parse(decoded);
      if (parsed && typeof parsed.returnPath === "string") {
        const path = parsed.returnPath;
        if (path.startsWith("/") && !path.startsWith("//")) {
          return path;
        }
      }
    } catch {
      // Not JSON, return default
    }
  }
  return "/";
}

export function registerOAuthRoutes(app: Express) {
  app.get("/api/oauth/callback", async (req: Request, res: Response) => {
    console.log("[OAuth] Callback route hit!");
    console.log("[OAuth] Query params:", req.query);
    const code = getQueryParam(req, "code");
    const state = getQueryParam(req, "state");
    console.log("[OAuth] Code:", code ? "present" : "missing");
    console.log("[OAuth] State:", state ? "present" : "missing");

    if (!code || !state) {
      res.status(400).json({ error: "code and state are required" });
      return;
    }

    try {
      const tokenResponse = await sdk.exchangeCodeForToken(code, state);
      const userInfo = await sdk.getUserInfo(tokenResponse.accessToken);

      if (!userInfo.openId) {
        res.status(400).json({ error: "openId missing from user info" });
        return;
      }

      const upsertedUser = await db.upsertUser({
        openId: userInfo.openId,
        name: userInfo.name || null,
        email: userInfo.email ?? null,
        loginMethod: userInfo.loginMethod ?? userInfo.platform ?? null,
        lastSignedIn: new Date(),
      });

      const sessionToken = await sdk.createSessionToken(userInfo.openId, {
        name: userInfo.name || "",
        expiresInMs: ONE_YEAR_MS,
      });

      const cookieOptions = getSessionCookieOptions(req);
      console.log("[OAuth] Host header:", req.get('host'));
      console.log("[OAuth] X-Forwarded-Host:", req.headers['x-forwarded-host']);
      console.log("[OAuth] X-Forwarded-Proto:", req.headers['x-forwarded-proto']);
      console.log("[OAuth] Setting cookie with options:", { ...cookieOptions, maxAge: ONE_YEAR_MS });
      console.log("[OAuth] Session token created for user:", userInfo.openId);
      res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: ONE_YEAR_MS });

      let returnPath = parseReturnPath(state);
      if (upsertedUser && upsertedUser.hasRegistered === 0) {
        returnPath = "/stats?showPaywall=true";
      }
      console.log("[OAuth] Redirecting to:", returnPath);
      res.redirect(302, returnPath);
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : String(error);
      console.error("[OAuth] Callback failed:", errMsg);

      // Auto-retry once if the DB connection is stale
      if (errMsg.includes("Connection is closed") || errMsg.includes("ECONNRESET") || errMsg.includes("PROTOCOL_CONNECTION_LOST")) {
        console.log("[OAuth] DB connection stale, resetting and retrying...");
        try {
          await resetDbConnection();
          const tokenResponse = await sdk.exchangeCodeForToken(code, state);
          const userInfo = await sdk.getUserInfo(tokenResponse.accessToken);
          if (!userInfo.openId) {
            res.status(400).json({ error: "openId missing from user info" });
            return;
          }
          const upsertedUser = await db.upsertUser({
            openId: userInfo.openId,
            name: userInfo.name || null,
            email: userInfo.email ?? null,
            loginMethod: userInfo.loginMethod ?? userInfo.platform ?? null,
            lastSignedIn: new Date(),
          });
          const sessionToken = await sdk.createSessionToken(userInfo.openId, {
            name: userInfo.name || "",
            expiresInMs: ONE_YEAR_MS,
          });
          const cookieOptions = getSessionCookieOptions(req);
          res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: ONE_YEAR_MS });
          let returnPath = parseReturnPath(state);
          if (upsertedUser && upsertedUser.hasRegistered === 0) {
            returnPath = "/stats?showPaywall=true";
          }
          console.log("[OAuth] Retry succeeded, redirecting to:", returnPath);
          res.redirect(302, returnPath);
          return;
        } catch (retryError) {
          console.error("[OAuth] Retry also failed:", retryError);
        }
      }

      // Redirect to home with error instead of showing JSON/404
      res.redirect(302, "/?loginError=true");
    }
  });
}
