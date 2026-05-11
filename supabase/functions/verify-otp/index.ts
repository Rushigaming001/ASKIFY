// using Deno.serve
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { checkDDoS } from "../_shared/ddos.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Strict limit: prevents OTP brute-force
  const ddos = checkDDoS(req, corsHeaders, { key: 'verify-otp', limit: 10 });
  if (ddos) return ddos;

  try {
    const { email, code, purpose } = await req.json();

    if (!email || !code) {
      return new Response(JSON.stringify({ error: 'Email and code are required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const otpPurpose = purpose || 'login';

    // Find matching OTP
    const { data: otpRecord, error: fetchError } = await supabase
      .from('otp_codes')
      .select('*')
      .eq('email', email.toLowerCase().trim())
      .eq('purpose', otpPurpose)
      .eq('verified', false)
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (fetchError || !otpRecord) {
      return new Response(JSON.stringify({ error: 'Invalid or expired verification code. Please request a new one.' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Check attempts (max 5)
    if (otpRecord.attempts >= 5) {
      await supabase.from('otp_codes').delete().eq('id', otpRecord.id);
      return new Response(JSON.stringify({ error: 'Too many failed attempts. Please request a new code.' }), {
        status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Verify code
    if (otpRecord.code !== code.trim()) {
      // Increment attempts
      await supabase
        .from('otp_codes')
        .update({ attempts: otpRecord.attempts + 1 })
        .eq('id', otpRecord.id);

      const remaining = 4 - otpRecord.attempts;
      return new Response(JSON.stringify({ 
        error: `Incorrect code. ${remaining > 0 ? `${remaining} attempts remaining.` : 'Please request a new code.'}` 
      }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Mark as verified and clean up
    await supabase.from('otp_codes').delete().eq('id', otpRecord.id);

    return new Response(JSON.stringify({ 
      success: true, 
      verified: true,
      message: 'Verification successful'
    }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Verify OTP error:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
