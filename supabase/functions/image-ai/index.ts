import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// DDoS protection
const ipCounts = new Map<string, { count: number; resetAt: number }>();
function checkDDoS(req: Request): Response | null {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
  const now = Date.now();
  const entry = ipCounts.get(ip);
  if (entry && now < entry.resetAt) {
    entry.count++;
    if (entry.count > 15) {
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
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const ddosBlock = checkDDoS(req);
  if (ddosBlock) return ddosBlock;

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

    // Generate image using Lovable AI Gateway (Nano Banana model)
    async function generateWithLovableAI(imagePrompt: string): Promise<string> {
      if (!LOVABLE_API_KEY) {
        throw new Error("AI image generation is not configured");
      }

      console.log("Generating image with Lovable AI:", imagePrompt.substring(0, 100));

      const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash-image",
          messages: [
            {
              role: "user",
              content: imagePrompt
            }
          ],
          modalities: ["image", "text"]
        }),
      });

      if (!response.ok) {
        if (response.status === 429) {
          throw new Error("Rate limited. Please wait a moment and try again.");
        }
        if (response.status === 402) {
          throw new Error("Usage limit reached. Please try again later.");
        }
        const errText = await response.text();
        console.error("AI Gateway error:", response.status, errText);
        throw new Error("Image generation failed. Please try again.");
      }

      const data = await response.json();
      const imageData = data.choices?.[0]?.message?.images?.[0]?.image_url?.url;

      if (!imageData) {
        console.error("No image in response:", JSON.stringify(data).substring(0, 500));
        throw new Error("No image was generated. Try a different prompt.");
      }

      return imageData;
    }

    // Fallback: Pollinations (verified fetch)
    async function generateWithPollinationsVerified(imagePrompt: string, model: string): Promise<string> {
      let pollinationsModel = model || 'flux';
      const encodedPrompt = encodeURIComponent(imagePrompt);
      const seed = Date.now();
      const url = `https://image.pollinations.ai/prompt/${encodedPrompt}?model=${pollinationsModel}&width=1024&height=1024&nologo=true&seed=${seed}&enhance=true&quality=95`;
      
      // Actually fetch and verify the image
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error("Pollinations image generation failed");
      }
      
      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.startsWith('image/')) {
        throw new Error("Invalid image response from Pollinations");
      }

      // Convert to base64 data URL
      const arrayBuffer = await response.arrayBuffer();
      const bytes = new Uint8Array(arrayBuffer);
      
      // Check if image has actual content (not blank - at least 10KB for a real image)
      if (bytes.length < 10000) {
        throw new Error("Generated image appears to be blank or invalid");
      }

      let binary = '';
      for (let i = 0; i < bytes.length; i++) {
        binary += String.fromCharCode(bytes[i]);
      }
      const base64 = btoa(binary);
      return `data:${contentType};base64,${base64}`;
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
              { type: "text", text: prompt || "Analyze this image in detail." },
              { type: "image_url", image_url: { url: imageUrl } }
            ]
          }],
          max_tokens: 2048,
        }),
      });

      if (!response.ok) throw new Error("Image analysis failed");

      const data = await response.json();
      const analysis = data.choices?.[0]?.message?.content || "No analysis generated";

      await supabase.from('usage_logs').insert({ user_id: user.id, model_id: 'gemini-vision', mode: 'image-analysis' });

      return new Response(JSON.stringify({ analysis }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Image generation
    if (action === 'generate') {
      let fullPrompt = prompt;
      if (style === 'ghibli') fullPrompt = `Studio Ghibli anime style, hand-drawn animation, soft pastel colors, Hayao Miyazaki style: ${prompt}`;
      else if (style === 'realistic') fullPrompt = `Ultra photorealistic, 8K resolution, professional photography: ${prompt}`;
      else if (style === 'artistic') fullPrompt = `Digital art masterpiece, vibrant colors, detailed illustration: ${prompt}`;
      else if (style === 'abstract') fullPrompt = `Abstract art, geometric shapes, bold colors, modern art: ${prompt}`;
      else fullPrompt = `High quality, detailed: ${prompt}`;

      // Add model-specific hints
      if (imageModel === 'flux-anime') fullPrompt = `Anime style, Japanese animation: ${prompt}`;
      else if (imageModel === 'flux-3d') fullPrompt = `3D rendered, high quality 3D art: ${prompt}`;
      else if (imageModel === 'flux-realism') fullPrompt = `Photorealistic, lifelike, ultra detailed photograph: ${prompt}`;

      const selectedModel = imageModel || 'flux';
      let generatedUrl: string;

      try {
        // Primary: Use Lovable AI Gateway
        generatedUrl = await generateWithLovableAI(`Generate this image: ${fullPrompt}`);
        console.log("Image generated via Lovable AI");
      } catch (aiError) {
        console.error("Lovable AI image gen failed:", aiError);
        try {
          // Fallback: Pollinations with verification
          generatedUrl = await generateWithPollinationsVerified(fullPrompt, selectedModel);
          console.log("Image generated via Pollinations fallback");
        } catch (pollError) {
          console.error("Pollinations fallback failed:", pollError);
          throw new Error("Image generation failed. Please try a different prompt or try again later.");
        }
      }

      await supabase.from('usage_logs').insert({ user_id: user.id, model_id: `ai-image-${selectedModel}`, mode: 'image-generation' });

      return new Response(JSON.stringify({ imageUrl: generatedUrl }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Image editing
    if (action === 'edit' && imageUrl) {
      if (!LOVABLE_API_KEY) throw new Error("AI image editing is not configured");

      try {
        const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${LOVABLE_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "google/gemini-2.5-flash-image",
            messages: [
              {
                role: "user",
                content: [
                  { type: "text", text: `Edit this image: ${prompt}` },
                  { type: "image_url", image_url: { url: imageUrl } }
                ]
              }
            ],
            modalities: ["image", "text"]
          }),
        });

        if (!response.ok) {
          if (response.status === 429) throw new Error("Rate limited. Please wait and try again.");
          if (response.status === 402) throw new Error("Usage limit reached.");
          throw new Error("Image editing failed");
        }

        const data = await response.json();
        const editedImageUrl = data.choices?.[0]?.message?.images?.[0]?.image_url?.url;

        if (!editedImageUrl) {
          throw new Error("No edited image was generated. Try different instructions.");
        }

        await supabase.from('usage_logs').insert({ user_id: user.id, model_id: 'ai-image-edit', mode: 'image-edit' });

        return new Response(JSON.stringify({ imageUrl: editedImageUrl }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      } catch (error) {
        console.error("Image edit error:", error);
        throw error;
      }
    }

    return new Response(JSON.stringify({ error: "Invalid action" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("Image AI error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "An error occurred. Please try again." }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
