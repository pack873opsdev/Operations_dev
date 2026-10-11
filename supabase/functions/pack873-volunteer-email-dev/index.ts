import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function respond(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function encodeBase64Url(value: string): string {
  const bytes = new TextEncoder().encode(value);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function escapeHtml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;")
    .replace(/>/g, "&gt;").replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return respond({ error: "Method not allowed" }, 405);
  }
  try {
    const authorization = req.headers.get("Authorization");
    if (!authorization?.startsWith("Bearer ")) {
      return respond({ error: "Authentication required" }, 401);
    }
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authorization } },
      auth: { persistSession: false },
    });
    const jwt = authorization.slice(7);
    const { data: userData, error: authError } = await supabase.auth.getUser(jwt);
    if (authError || !userData.user) {
      return respond({ error: "Invalid session" }, 401);
    }
    if (userData.user.app_metadata?.pack873_role !== "admin") {
      return respond({ error: "Admin access required" }, 403);
    }
    const body = await req.json().catch(() => null);
    const roleId = body?.role_id;
    if (!Number.isSafeInteger(roleId) || roleId <= 0) {
      return respond({ error: "Valid role_id required" }, 400);
    }
    const { data: assignment, error: dbError } = await supabase
      .from("committee_roles")
      .select("id, role_name, volunteer_name, email")
      .eq("id", roleId)
      .single();
    if (dbError || !assignment) {
      return respond({ error: "Assignment not found" }, 404);
    }
    const email = assignment.email?.trim();
    const name = assignment.volunteer_name?.trim();
    const role = assignment.role_name?.trim();
    if (!email || !name || !role ||
        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return respond({ error: "Assignment has invalid details" }, 400);
    }
    const clientId = Deno.env.get("GMAIL_CLIENT_ID");
    const clientSecret = Deno.env.get("GMAIL_CLIENT_SECRET");
    const refreshToken = Deno.env.get("GMAIL_REFRESH_TOKEN");
    const sender = Deno.env.get("GMAIL_SENDER_EMAIL");
    if (!clientId || !clientSecret || !refreshToken || !sender) {
      console.error("Missing Gmail configuration");
      return respond({ error: "Email service not configured" }, 500);
    }
    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: refreshToken,
        grant_type: "refresh_token",
      }),
    });
    if (!tokenResponse.ok) {
      console.error("Gmail token exchange failed", tokenResponse.status);
      return respond({ error: "Gmail authorization failed" }, 502);
    }
    const tokenData = await tokenResponse.json();
    const accessToken = tokenData.access_token;
    if (!accessToken) {
      return respond({ error: "Gmail access token missing" }, 502);
    }

    // Keep role-specific subject values out of raw headers.
    if (/[\r\n]/.test(email) || /[\r\n]/.test(sender) || /[\r\n]/.test(role)) {
      return respond({ error: "Invalid email header" }, 400);
    }
    const subject = `Pack 873 - Volunteer Role Assigned - ${role}`;
    const htmlMessage = [
      `<!doctype html><html><body>`,
      `<p>Hello ${escapeHtml(name)},</p>`,
      `<p>Thank you for volunteering for Scouts!</p>`,
      `<p>You have been assigned the role of <strong>${escapeHtml(role)}</strong> for Pack 873.</p>`,
      `<p>We appreciate your time, dedication, and willingness<br>to support our Scouts.</p>`,
      `<p>Thank you,<br>Pack 873 Leadership Team</p>`,
      `</body></html>`,
    ].join("\r\n");

    // RFC 2047 UTF-8 encoding keeps non-ASCII role names valid in the Subject header.
    const encodedSubject = `=?UTF-8?B?${btoa(String.fromCharCode(...new TextEncoder().encode(subject)))}?=`;
    const mimeMessage = [
      `From: ${sender}`,
      `To: ${email}`,
      `Subject: ${encodedSubject}`,
      "MIME-Version: 1.0",
      "Content-Type: text/html; charset=UTF-8",
      "Content-Transfer-Encoding: 8bit",
      "",
      htmlMessage,
    ].join("\r\n");
    const gmailResponse = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ raw: encodeBase64Url(mimeMessage) }),
    });
    if (!gmailResponse.ok) {
      console.error("Gmail send failed", gmailResponse.status);
      return respond({ error: "Email delivery request failed" }, 502);
    }
    return respond({
      success: true,
      message: "Gmail accepted the assignment email",
      role_id: assignment.id,
    });
  } catch (error) {
    console.error("Volunteer email function error", error);
    return respond({ error: "Unexpected server error" }, 500);
  }
});
