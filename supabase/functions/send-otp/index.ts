import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { email, purpose } = await req.json();

    if (!email || typeof email !== 'string') {
      return new Response(JSON.stringify({ error: 'Email is required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const normalizedEmail = email.toLowerCase().trim();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(normalizedEmail)) {
      return new Response(JSON.stringify({ error: 'Invalid email format' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const validPurposes = ['login', 'register'];
    const otpPurpose = validPurposes.includes(purpose) ? purpose : 'login';

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Rate limit: max 5 OTP requests per email per 10 minutes
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    const { count } = await supabase
      .from('otp_codes')
      .select('*', { count: 'exact', head: true })
      .eq('email', normalizedEmail)
      .gte('created_at', tenMinutesAgo);

    if ((count || 0) >= 5) {
      return new Response(JSON.stringify({ error: 'Too many OTP requests. Please wait a few minutes.' }), {
        status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Generate 6-digit code
    const code = String(Math.floor(100000 + Math.random() * 900000));

    // Invalidate any existing codes for this email+purpose
    await supabase
      .from('otp_codes')
      .delete()
      .eq('email', normalizedEmail)
      .eq('purpose', otpPurpose);

    // Insert new code
    const { error: insertError } = await supabase
      .from('otp_codes')
      .insert({
        email: normalizedEmail,
        code,
        purpose: otpPurpose,
        expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
      });

    if (insertError) {
      console.error('Insert error:', insertError);
      return new Response(JSON.stringify({ error: 'Failed to generate verification code' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const emailHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="color-scheme" content="light">
  <title>Askify — Verification Code</title>
  <style>
    @keyframes shimmer { 0% { background-position: -200% 0; } 100% { background-position: 200% 0; } }
    @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.7; } }
  </style>
</head>
<body style="margin: 0; padding: 0; background-color: #0b0f1a; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', sans-serif; -webkit-font-smoothing: antialiased;">
  <table role="presentation" cellspacing="0" cellpadding="0" border="0" align="center" width="100%" style="max-width: 620px; margin: 0 auto;">
    <tr>
      <td style="padding: 48px 20px 32px;">
        
        <!-- Main Card -->
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background: #111827; border-radius: 20px; overflow: hidden; border: 1px solid rgba(59,130,246,0.15); box-shadow: 0 0 80px rgba(59,130,246,0.08), 0 25px 50px -12px rgba(0,0,0,0.5);">
          
          <!-- Animated Header Bar -->
          <tr>
            <td style="height: 4px; background: linear-gradient(90deg, #3b82f6, #06b6d4, #8b5cf6, #3b82f6); background-size: 200% 100%; animation: shimmer 3s ease-in-out infinite;"></td>
          </tr>

          <!-- Logo Section -->
          <tr>
            <td style="padding: 36px 40px 20px; text-align: center;">
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" align="center">
                <tr>
                  <td style="background: linear-gradient(135deg, rgba(59,130,246,0.15), rgba(6,182,212,0.1)); border: 1px solid rgba(59,130,246,0.2); border-radius: 16px; padding: 14px 18px;">
                    <img src="https://wexmklgizitrjitkalry.supabase.co/storage/v1/object/public/profiles/askify-logo.png" alt="Askify" width="44" height="44" style="display: block; border-radius: 10px;" onerror="this.style.display='none'">
                  </td>
                </tr>
              </table>
              <h1 style="color: #ffffff; font-size: 26px; font-weight: 700; margin: 16px 0 0; letter-spacing: -0.3px;">ASKIFY</h1>
              <p style="color: #64748b; font-size: 12px; font-weight: 500; text-transform: uppercase; letter-spacing: 3px; margin: 6px 0 0;">Intelligent AI Platform</p>
            </td>
          </tr>

          <!-- Divider -->
          <tr>
            <td style="padding: 0 40px;">
              <div style="height: 1px; background: linear-gradient(90deg, transparent, rgba(59,130,246,0.3), transparent);"></div>
            </td>
          </tr>

          <!-- Content -->
          <tr>
            <td style="padding: 32px 40px 16px;">
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                <tr>
                  <td style="background: rgba(59,130,246,0.08); border-radius: 10px; padding: 3px 14px; display: inline-block; margin-bottom: 16px;">
                    <p style="color: #60a5fa; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 1.5px; margin: 6px 0;">${otpPurpose === 'register' ? '🚀 Account Setup' : '🔐 Security Verification'}</p>
                  </td>
                </tr>
              </table>
              <h2 style="color: #f1f5f9; font-size: 22px; font-weight: 700; margin: 8px 0 12px; line-height: 1.3;">
                ${otpPurpose === 'register' ? 'Welcome aboard, future explorer.' : 'Authentication required.'}
              </h2>
              <p style="color: #94a3b8; font-size: 15px; line-height: 1.7; margin: 0 0 28px;">
                ${otpPurpose === 'register'
                  ? 'Your Askify account is almost ready. Enter the verification code below to activate your account and unlock full access.'
                  : 'A sign-in attempt was detected on your account. Use the one-time code below to authenticate securely.'}
              </p>
            </td>
          </tr>

          <!-- OTP Code Box -->
          <tr>
            <td style="padding: 0 40px 28px;">
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background: linear-gradient(135deg, rgba(59,130,246,0.08), rgba(139,92,246,0.06)); border: 1px solid rgba(59,130,246,0.2); border-radius: 16px;">
                <tr>
                  <td style="padding: 28px 24px; text-align: center;">
                    <p style="color: #64748b; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 2.5px; margin: 0 0 14px;">One-Time Passcode</p>
                    <table role="presentation" cellspacing="0" cellpadding="0" border="0" align="center">
                      <tr>
                        ${code.split('').map((digit: string) => `
                        <td style="padding: 0 4px;">
                          <div style="width: 48px; height: 58px; background: rgba(15,23,42,0.8); border: 1px solid rgba(59,130,246,0.3); border-radius: 12px; line-height: 58px; text-align: center; color: #60a5fa; font-size: 28px; font-weight: 800; font-family: 'SF Mono', 'Fira Code', 'Courier New', monospace;">${digit}</div>
                        </td>
                        `).join('')}
                      </tr>
                    </table>
                    <p style="color: #475569; font-size: 12px; margin: 16px 0 0; animation: pulse 2s ease-in-out infinite;">
                      ⏳ Expires in <strong style="color: #60a5fa;">10 minutes</strong>
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Security Notice -->
          <tr>
            <td style="padding: 0 40px 32px;">
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background: rgba(234,179,8,0.05); border: 1px solid rgba(234,179,8,0.12); border-radius: 12px;">
                <tr>
                  <td style="padding: 16px 20px;">
                    <p style="color: #a3a3a3; font-size: 13px; line-height: 1.6; margin: 0;">
                      🛡️ <strong style="color: #d4d4d8;">Security Notice:</strong> Askify will never ask for your password via email. If you did not initiate this request, you can safely disregard this message.
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Divider -->
          <tr>
            <td style="padding: 0 40px;">
              <div style="height: 1px; background: linear-gradient(90deg, transparent, rgba(59,130,246,0.2), transparent);"></div>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 24px 40px 28px; text-align: center;">
              <p style="color: #475569; font-size: 12px; line-height: 1.6; margin: 0 0 8px;">
                © ${new Date().getFullYear()} <strong style="color: #64748b;">Askify</strong> — Built by <strong style="color: #64748b;">Mr. Rudra</strong>
              </p>
              <p style="color: #374151; font-size: 11px; margin: 0;">
                Secured with end-to-end encryption • Never share your verification code
              </p>
            </td>
          </tr>

          <!-- Bottom Gradient Bar -->
          <tr>
            <td style="height: 4px; background: linear-gradient(90deg, #8b5cf6, #3b82f6, #06b6d4, #8b5cf6); background-size: 200% 100%; animation: shimmer 3s ease-in-out infinite;"></td>
          </tr>

        </table>

      </td>
    </tr>
  </table>
</body>
</html>`;

    // Send via Resend
    const resendKey = Deno.env.get('RESEND_API_KEY');
    if (!resendKey) {
      return new Response(JSON.stringify({
        error: 'Email service is not configured. Please contact support.'
      }), {
        status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    try {
      const emailResponse = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${resendKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: 'Askify <noreply@minequest.fun>',
          to: [normalizedEmail],
          subject: `${code} — Your Askify Verification Code`,
          html: emailHtml,
        }),
        signal: AbortSignal.timeout(12000),
      });

      if (!emailResponse.ok) {
        const errText = await emailResponse.text();
        console.error('Resend error:', emailResponse.status, errText);
        return new Response(JSON.stringify({
          error: 'Could not send verification code email. Please try again in a moment.'
        }), {
          status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      console.log('Email sent via Resend successfully');
    } catch (e) {
      console.error('Resend fetch error:', e);
      return new Response(JSON.stringify({
        error: 'Email delivery timed out. Please try again.'
      }), {
        status: 504, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({
      success: true,
      message: 'Verification code sent to your email',
    }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('OTP error:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
