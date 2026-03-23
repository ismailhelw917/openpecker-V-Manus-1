import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);
const FROM_EMAIL = "support@openpecker.com";
const APP_NAME = "OpenPecker";

export async function sendPasswordResetEmail(
  toEmail: string,
  resetUrl: string
): Promise<boolean> {
  try {
    const { error } = await resend.emails.send({
      from: `${APP_NAME} <${FROM_EMAIL}>`,
      to: toEmail,
      subject: "Reset your OpenPecker password",
      html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Reset your password</title>
</head>
<body style="margin:0;padding:0;background:#0a0a0a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0a0a0a;padding:40px 20px;">
    <tr>
      <td align="center">
        <table width="480" cellpadding="0" cellspacing="0" style="background:#111;border:1px solid #222;border-radius:12px;overflow:hidden;">
          <!-- Header -->
          <tr>
            <td style="padding:32px 40px 24px;border-bottom:1px solid #222;">
              <table cellpadding="0" cellspacing="0">
                <tr>
                  <td style="background:#f97316;width:36px;height:36px;border-radius:8px;text-align:center;vertical-align:middle;">
                    <span style="color:#000;font-size:18px;font-weight:900;line-height:36px;">P</span>
                  </td>
                  <td style="padding-left:12px;">
                    <span style="color:#fff;font-size:20px;font-weight:700;letter-spacing:-0.5px;">OpenPecker</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding:32px 40px;">
              <h1 style="margin:0 0 12px;color:#fff;font-size:22px;font-weight:700;">Reset your password</h1>
              <p style="margin:0 0 24px;color:#999;font-size:15px;line-height:1.6;">
                We received a request to reset the password for your OpenPecker account. Click the button below to choose a new password.
              </p>
              <table cellpadding="0" cellspacing="0">
                <tr>
                  <td style="border-radius:8px;background:#f97316;">
                    <a href="${resetUrl}" style="display:inline-block;padding:14px 28px;color:#000;font-size:15px;font-weight:700;text-decoration:none;border-radius:8px;">
                      Reset Password
                    </a>
                  </td>
                </tr>
              </table>
              <p style="margin:24px 0 0;color:#666;font-size:13px;line-height:1.6;">
                This link expires in <strong style="color:#999;">1 hour</strong>. If you didn't request a password reset, you can safely ignore this email.
              </p>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding:20px 40px;border-top:1px solid #222;">
              <p style="margin:0;color:#555;font-size:12px;">
                If the button doesn't work, copy and paste this link:<br>
                <a href="${resetUrl}" style="color:#f97316;word-break:break-all;">${resetUrl}</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
      `.trim(),
    });

    if (error) {
      console.error("[Email] Failed to send password reset email:", error);
      return false;
    }
    return true;
  } catch (err) {
    console.error("[Email] Error sending password reset email:", err);
    return false;
  }
}

export async function sendWelcomeEmail(
  toEmail: string,
  name: string
): Promise<boolean> {
  try {
    const { error } = await resend.emails.send({
      from: `${APP_NAME} <${FROM_EMAIL}>`,
      to: toEmail,
      subject: "Welcome to OpenPecker!",
      html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0;padding:0;background:#0a0a0a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0a0a0a;padding:40px 20px;">
    <tr>
      <td align="center">
        <table width="480" cellpadding="0" cellspacing="0" style="background:#111;border:1px solid #222;border-radius:12px;overflow:hidden;">
          <tr>
            <td style="padding:32px 40px 24px;border-bottom:1px solid #222;">
              <table cellpadding="0" cellspacing="0">
                <tr>
                  <td style="background:#f97316;width:36px;height:36px;border-radius:8px;text-align:center;vertical-align:middle;">
                    <span style="color:#000;font-size:18px;font-weight:900;line-height:36px;">P</span>
                  </td>
                  <td style="padding-left:12px;">
                    <span style="color:#fff;font-size:20px;font-weight:700;letter-spacing:-0.5px;">OpenPecker</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:32px 40px;">
              <h1 style="margin:0 0 12px;color:#fff;font-size:22px;font-weight:700;">Welcome, ${name}! ♟️</h1>
              <p style="margin:0 0 16px;color:#999;font-size:15px;line-height:1.6;">
                Your OpenPecker account is ready. Start solving chess puzzles and climb the global leaderboard.
              </p>
              <table cellpadding="0" cellspacing="0">
                <tr>
                  <td style="border-radius:8px;background:#f97316;">
                    <a href="https://openpecker.com/train" style="display:inline-block;padding:14px 28px;color:#000;font-size:15px;font-weight:700;text-decoration:none;border-radius:8px;">
                      Start Training
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:20px 40px;border-top:1px solid #222;">
              <p style="margin:0;color:#555;font-size:12px;">OpenPecker — Chess Puzzle Training</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
      `.trim(),
    });

    if (error) {
      console.error("[Email] Failed to send welcome email:", error);
      return false;
    }
    return true;
  } catch (err) {
    console.error("[Email] Error sending welcome email:", err);
    return false;
  }
}
