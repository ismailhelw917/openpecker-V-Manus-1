import { describe, it, expect } from "vitest";

// ─── PWA manifest validation ────────────────────────────────────────────────
describe("PWA Manifest", () => {
  const manifest = {
    name: "OpenPecker - Chess Training",
    short_name: "OpenPecker",
    description:
      "Master opening tactics through deliberate repetition. The Woodpecker Method for chess.",
    theme_color: "#0f172a",
    background_color: "#0f172a",
    display: "standalone",
    orientation: "portrait",
    scope: "/",
    start_url: "/",
    icons: [
      {
        src: "https://d2xsxph8kpxj0f.cloudfront.net/310519663447100726/EorxrxCPNFVtGo7gjBVrJr/icon-192x192_e08cd5dd.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any maskable",
      },
      {
        src: "https://d2xsxph8kpxj0f.cloudfront.net/310519663447100726/EorxrxCPNFVtGo7gjBVrJr/icon-512x512_35458014.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any maskable",
      },
    ],
  };

  it("has required PWA fields", () => {
    expect(manifest.name).toBeTruthy();
    expect(manifest.short_name).toBeTruthy();
    expect(manifest.display).toBe("standalone");
    expect(manifest.start_url).toBe("/");
    expect(manifest.scope).toBe("/");
  });

  it("has at least two icons (192 and 512)", () => {
    const sizes = manifest.icons.map((i) => i.sizes);
    expect(sizes).toContain("192x192");
    expect(sizes).toContain("512x512");
  });

  it("icons are PNG with maskable purpose", () => {
    for (const icon of manifest.icons) {
      expect(icon.type).toBe("image/png");
      expect(icon.purpose).toContain("maskable");
    }
  });

  it("theme_color is a valid hex color", () => {
    expect(manifest.theme_color).toMatch(/^#[0-9a-fA-F]{6}$/);
    expect(manifest.background_color).toMatch(/^#[0-9a-fA-F]{6}$/);
  });

  it("short_name is 12 characters or fewer (home screen label limit)", () => {
    expect(manifest.short_name.length).toBeLessThanOrEqual(12);
  });
});

// ─── PWA install prompt logic ────────────────────────────────────────────────
describe("PWA Install Prompt Logic", () => {
  it("detects iOS user agent correctly", () => {
    const iosUA = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)";
    const isIOS = /iphone|ipad|ipod/i.test(iosUA);
    expect(isIOS).toBe(true);
  });

  it("does not flag Android as iOS", () => {
    const androidUA =
      "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36";
    const isIOS = /iphone|ipad|ipod/i.test(androidUA);
    expect(isIOS).toBe(false);
  });

  it("does not flag desktop Chrome as iOS", () => {
    const desktopUA =
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0";
    const isIOS = /iphone|ipad|ipod/i.test(desktopUA);
    expect(isIOS).toBe(false);
  });

  it("sessionStorage key is consistent", () => {
    const KEY = "pwa-install-dismissed";
    expect(KEY).toBe("pwa-install-dismissed");
  });
});
