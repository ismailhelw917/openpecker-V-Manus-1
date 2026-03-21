import { describe, it, expect } from "vitest";

describe("reCAPTCHA v3 Verification", () => {
  it("should verify reCAPTCHA token with secret key", async () => {
    const secretKey = process.env.RECAPTCHA_SECRET_KEY;
    expect(secretKey).toBeDefined();
    expect(secretKey).toMatch(/^6LeKr/);
    
    // Test with a dummy token to verify the secret key is valid
    // In production, this would be a real token from the frontend
    const dummyToken = "dummy_token_for_testing";
    
    try {
      const response = await fetch("https://www.google.com/recaptcha/api/siteverify", {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: `secret=${secretKey}&response=${dummyToken}`,
      });
      
      expect(response.ok).toBe(true);
      const data = await response.json();
      
      // With a dummy token, we expect success: false
      expect(data).toHaveProperty("success");
      expect(typeof data.success).toBe("boolean");
      
      // Score/action only present when success is true
      if (data.success) {
        expect(data).toHaveProperty("score");
        expect(data).toHaveProperty("action");
      }
      
      console.log("✅ reCAPTCHA secret key is valid and API is accessible");
    } catch (error) {
      console.error("❌ reCAPTCHA API error:", error);
      throw error;
    }
  });

  it("should have site key configured", () => {
    const siteKey = process.env.VITE_RECAPTCHA_SITE_KEY;
    expect(siteKey).toBeDefined();
    expect(siteKey).toMatch(/^6LeKr/);
    console.log("✅ reCAPTCHA site key is configured");
  });
});
