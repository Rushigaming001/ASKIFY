import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const authHeader = req.headers.get("Authorization");
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: "Unauthorized - missing token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = authHeader.replace('Bearer ', '');
    const supabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } }
    });

    const { data: { user }, error: userError } = await supabaseClient.auth.getUser(token);
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized - invalid session" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { data: isRestricted } = await supabase.rpc('user_has_restriction', {
      _user_id: user.id,
      _restriction_type: 'image_generation'
    });

    if (isRestricted) {
      return new Response(JSON.stringify({ error: "Image generation is disabled for your account" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { action, prompt, imageUrl, style, imageModel } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

    // Pollinations image generation - free, unlimited, high quality
    function generateWithPollinations(prompt: string, model: string): string {
      // Best quality models on Pollinations
      let pollinationsModel = model;
      if (model === 'gemini' || !model) pollinationsModel = 'flux';

      const encodedPrompt = encodeURIComponent(prompt);
      const seed = Date.now();
      // Use 1024x1024 for high quality, enhanced=true for better output
      return `https://image.pollinations.ai/prompt/${encodedPrompt}?model=${pollinationsModel}&width=1024&height=1024&nologo=true&seed=${seed}&enhance=true&quality=95`;
    }

    // Image analysis
    if (action === 'analyze' && imageUrl) {
      if (!LOVABLE_API_KEY) throw new Error("API key is not configured");

      const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [{
            role: "user",
            content: [
              { type: "text", text: prompt || "Analyze this image in detail. Describe what you see, identify objects, people, colors, mood, and any notable features." },
              { type: "image_url", image_url: { url: imageUrl } }
            ]
          }],
          max_tokens: 2048,
        }),
      });

      if (!response.ok) throw new Error("Image analysis failed - please try again");

      const data = await response.json();
      const analysis = data.choices?.[0]?.message?.content || "No analysis generated";

      await supabase.from('usage_logs').insert({ user_id: user.id, model_id: 'gemini-vision', mode: 'image-analysis' });

      return new Response(JSON.stringify({ analysis }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Image generation - unlimited via Pollinations
    if (action === 'generate') {
      let fullPrompt = prompt;
      if (style === 'ghibli') fullPrompt = `Studio Ghibli anime style, hand-drawn animation aesthetic, soft pastel colors, dreamy atmosphere, Hayao Miyazaki style: ${prompt}`;
      else if (style === 'realistic') fullPrompt = `Ultra photorealistic, 8K resolution, high detail, professional photography, masterpiece: ${prompt}`;
      else if (style === 'artistic') fullPrompt = `Digital art masterpiece, vibrant colors, artistic style, detailed illustration, trending on artstation: ${prompt}`;
      else if (style === 'abstract') fullPrompt = `Abstract art, geometric shapes, bold colors, modern art style, creative: ${prompt}`;
      else fullPrompt = `High quality, detailed, professional, masterpiece: ${prompt}`;

      const selectedModel = imageModel || 'flux';
      const generatedUrl = generateWithPollinations(fullPrompt, selectedModel);

      await supabase.from('usage_logs').insert({ user_id: user.id, model_id: `pollinations-${selectedModel}`, mode: 'image-generation' });

      return new Response(JSON.stringify({ imageUrl: generatedUrl }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Image editing
    if (action === 'edit' && imageUrl) {
      const editPrompt = `${prompt}, based on this image: ${imageUrl}`;
      const generatedUrl = generateWithPollinations(editPrompt, 'flux');

      await supabase.from('usage_logs').insert({ user_id: user.id, model_id: 'pollinations-edit', mode: 'image-edit' });

      return new Response(JSON.stringify({ imageUrl: generatedUrl }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Invalid action" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("Image AI error:", error);
    return new Response(
      JSON.stringify({ error: "An error occurred processing your request. Please try again." }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
