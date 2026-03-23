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
    // URL-decode the state first (OAuth portal may URL-encode it)
    let normalizedState = state;
    try {
      normalizedState = decodeURIComponent(state);
    } catch {
      // Already decoded, use as-is
    }

    // Convert URL-safe base64 to standard base64
    const standardBase64 = normalizedState.replace(/-/g, '+').replace(/_/g, '/');
    // Add padding if needed
    const padded = standardBase64 + '='.repeat((4 - (standardBase64.length % 4)) % 4);
    const decoded = atob(padded);
    
    console.log('[OAuth] Decoded state JSON:', decoded);
    const parsed = JSON.parse(decoded);
    
    if (parsed && typeof parsed.returnPath === "string") {
      const path = parsed.returnPath.trim();
      console.log('[OAuth] Extracted returnPath:', path);
      
      // Strict validation: must start with /, must not contain protocol indicators
      if (
        path.startsWith("/") &&
        !path.startsWith("//") &&
        !path.includes("://") &&
        !path.includes("%2F%2F") &&
        !path.includes("%3A%2F%2F")
      ) {
        return path;
      }
      console.warn('[OAuth] returnPath failed validation, using default:', path);
    }
  } catch (err) {
    console.error('[OAuth] Failed to parse state:', err instanceof Error ? err.message : err);
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
      // Use HTML redirect instead of 302 for Safari ITP compatibility.
      // Safari blocks cross-site 302 redirects after OAuth flows, causing a 404.
      // A same-origin HTML page with JS redirect works correctly on all browsers.
      res.status(200).set('Content-Type', 'text/html').send(
        `<!DOCTYPE html><html><head><meta charset="utf-8">
        <meta http-equiv="refresh" content="0;url=${returnPath}">
        <script>window.location.replace(${JSON.stringify(returnPath)});</script>
        </head><body>Redirecting...</body></html>`
      );
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
          res.status(200).set('Content-Type', 'text/html').send(
            `<!DOCTYPE html><html><head><meta charset="utf-8">
            <meta http-equiv="refresh" content="0;url=${returnPath}">
            <script>window.location.replace(${JSON.stringify(returnPath)});</script>
            </head><body>Redirecting...</body></html>`
          );
          return;
        } catch (retryError) {
          console.error("[OAuth] Retry also failed:", retryError);
        }
      }

      // Redirect to /auth with error instead of showing JSON/404
      // Using HTML redirect for Safari ITP compatibility
      res.status(200).set('Content-Type', 'text/html').send(
        `<!DOCTYPE html><html><head><meta charset="utf-8">
        <meta http-equiv="refresh" content="0;url=/auth?loginError=true">
        <script>window.location.replace('/auth?loginError=true');</script>
        </head><body>Redirecting...</body></html>`
      );
    }
  });
}
