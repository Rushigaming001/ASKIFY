// using Deno.serve
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { checkDDoS } from "../_shared/ddos.ts";
import { errorResponse, installGlobalErrorHandlers } from "../_shared/errors.ts";
installGlobalErrorHandlers("send-feedback");

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const ddos = checkDDoS(req, corsHeaders, { key: 'send-feedback', limit: 5 });
  if (ddos) return ddos;

  try {
    const { email, message, userId } = await req.json();

    // Save feedback to database
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    await supabase.from('feedback').insert({
      user_id: userId || null,
      email: email || null,
      message: message,
    });

    // Also try to send email via Resend
    const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
    if (RESEND_API_KEY) {
      try {
        await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${RESEND_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from: 'Askify Feedback <onboarding@resend.dev>',
            to: ['opgamer012321@gmail.com'],
            subject: `Askify Feedback from ${email || 'Anonymous'}`,
            html: `
              <h2>New Feedback from Askify</h2>
              <p><strong>From:</strong> ${email || 'Anonymous'}</p>
              <p><strong>User ID:</strong> ${userId || 'Not logged in'}</p>
              <hr/>
              <p>${message.replace(/\n/g, '<br/>')}</p>
            `,
          }),
        });
      } catch (emailErr) {
        console.error('Email sending failed:', emailErr);
      }
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return errorResponse(error, { fn: "send-feedback", corsHeaders });
  }
});
