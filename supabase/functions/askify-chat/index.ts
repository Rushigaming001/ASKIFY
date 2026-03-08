import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.84.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

// DDoS protection
const ipCounts = new Map<string, { count: number; resetAt: number }>();
function checkDDoS(req: Request): Response | null {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
  const now = Date.now();
  const entry = ipCounts.get(ip);
  if (entry && now < entry.resetAt) {
    entry.count++;
    if (entry.count > 20) {
      return new Response(JSON.stringify({ error: "Too many requests" }), {
        status: 429, headers: { ...corsHeaders, "Content-Type": "application/json", "Retry-After": "60" },
      });
    }
  } else {
    ipCounts.set(ip, { count: 1, resetAt: now + 60000 });
  }
  if (ipCounts.size > 500) {
    for (const [k, v] of ipCounts) { if (now > v.resetAt) ipCounts.delete(k); }
  }
  return null;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const ddosBlock = checkDDoS(req);
  if (ddosBlock) return ddosBlock;

  try {
    // Authentication check
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { data: { user } } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''));
    
    if (!user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check for AI chat restriction
    const { data: isRestricted } = await supabase.rpc('user_has_restriction', {
      _user_id: user.id,
      _restriction_type: 'ai_chat_disabled'
    });

    if (isRestricted) {
      return new Response(JSON.stringify({ error: "AI chat is disabled for your account" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { question, originalMessageId, userId } = await req.json();
    
    const GROQ_API_KEY = Deno.env.get('GROQ_API_KEY');
    
    if (!GROQ_API_KEY) {
      throw new Error('GROQ_API_KEY is not configured');
    }

    console.log('Processing /askify question from user:', user.id, 'question:', question);

    // Call Groq AI
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${GROQ_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: [
          { 
            role: 'system', 
            content: 'You are Askify, a helpful AI assistant in a public chat. Keep your responses concise and friendly. You can answer questions, provide information, and help with various tasks.' 
          },
          { role: 'user', content: question }
        ],
        max_tokens: 500,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('Groq API error:', response.status, error);
      throw new Error(`AI error: ${response.status}`);
    }

    const data = await response.json();
    let aiResponse = data.choices[0].message.content;

    // Sanitize AI output - strip HTML tags to prevent XSS
    aiResponse = aiResponse.replace(/<[^>]*>/g, '');
    // Limit response length
    if (aiResponse.length > 2000) {
      aiResponse = aiResponse.substring(0, 2000) + '...';
    }

    console.log('AI response received, length:', aiResponse.length);

    // Insert AI response as a reply to the original message
    const { error: insertError } = await supabase
      .from('public_messages')
      .insert({
        content: `🤖 **Askify:** ${aiResponse}`,
        user_id: userId, // Use the original user's ID so it shows as their message
        reply_to: originalMessageId // Reply to the original /askify message
      });

    if (insertError) {
      console.error('Error inserting AI response:', insertError);
      // Don't throw - return the response anyway
    }

    // Log usage
    await supabase.from('usage_logs').insert({
      user_id: user.id,
      model_id: 'groq-llama',
      mode: 'askify-chat'
    });

    return new Response(
      JSON.stringify({ success: true, response: aiResponse }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in askify-chat function:', error);
    return new Response(
      JSON.stringify({ error: 'An error occurred processing your request. Please try again.' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});