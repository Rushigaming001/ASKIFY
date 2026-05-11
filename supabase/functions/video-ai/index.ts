// using Deno.serve
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'
import { checkDDoS } from "../_shared/ddos.ts";
import { errorResponse, installGlobalErrorHandlers } from "../_shared/errors.ts";
installGlobalErrorHandlers("video-ai");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const ddos = checkDDoS(req, corsHeaders, { key: 'video-ai', limit: 10 });
  if (ddos) return ddos;

  try {
    // Authentication check
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { data: { user } } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''));
    
    if (!user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check for video generation restriction
    const { data: isRestricted } = await supabase.rpc('user_has_restriction', {
      _user_id: user.id,
      _restriction_type: 'video_generation_disabled'
    });

    if (isRestricted) {
      return new Response(JSON.stringify({ error: "Video generation is disabled for your account" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();

    if (!body.prompt) {
      return new Response(
        JSON.stringify({ 
          error: "Missing required field: prompt is required" 
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400,
        }
      )
    }

    const { prompt, videoModel } = body;
    
    console.log("Generating video for user:", user.id, "prompt:", prompt, "model:", videoModel);
    
    // Use Lovable AI Gateway with video generation model
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    
    if (LOVABLE_API_KEY) {
      try {
        console.log("Using Lovable AI Gateway for video generation...");
        
        // Use Lovable AI to generate a video description/storyboard first
        const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${LOVABLE_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "google/gemini-3-pro-image-preview",
            messages: [
              { 
                role: "system", 
                content: "You are a video generation assistant. Create a detailed video storyboard and scene description based on the user's prompt. Be specific about visuals, transitions, and timing."
              },
              { role: "user", content: `Create a video based on: ${prompt}` }
            ],
          }),
        });

        if (!response.ok) {
          console.log("Lovable AI response not ok, trying fallback...");
          throw new Error("Lovable AI failed");
        }

        const aiData = await response.json();
        const storyboard = aiData.choices?.[0]?.message?.content || '';
        console.log("Generated storyboard:", storyboard.substring(0, 200));

        // Now generate video with Replicate if available
        const REPLICATE_API_KEY = Deno.env.get('REPLICATE_API_KEY');
        
        if (REPLICATE_API_KEY) {
          console.log("Trying Replicate with Luma Ray...");
          const { default: Replicate } = await import("https://esm.sh/replicate@0.30.2");
          const replicate = new Replicate({
            auth: REPLICATE_API_KEY,
          });
          
          const output = await replicate.run("luma/ray", {
            input: {
              prompt: prompt,
              aspect_ratio: "16:9",
              loop: false
            }
          });

          console.log("Replicate video generation completed:", output);
          
          let videoUrl: string;
          if (typeof output === 'string') {
            videoUrl = output;
          } else if (output && typeof output.url === 'function') {
            videoUrl = output.url();
          } else if (Array.isArray(output) && output.length > 0) {
            videoUrl = output[0];
          } else {
            videoUrl = String(output);
          }

          // Log usage
          await supabase.from('usage_logs').insert({
            user_id: user.id,
            model_id: 'luma-ray',
            mode: 'video-generation'
          });
          
          return new Response(JSON.stringify({ 
            output: videoUrl,
            status: 'succeeded',
            storyboard: storyboard
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200,
          });
        }
      } catch (error) {
        console.log("Lovable AI/Replicate failed, using Pollinations fallback:", error);
      }
    }

    // Fallback: Use Pollinations.ai for video generation
    console.log("Using Pollinations.ai for video generation...");
    
    // Create a proper video URL with better parameters
    const encodedPrompt = encodeURIComponent(prompt);
    
    // Use a more reliable video generation approach
    // Pollinations text-to-video endpoint
    const videoUrl = `https://video.pollinations.ai/prompt/${encodedPrompt}?width=1280&height=720&fps=24&duration=5&seed=${Date.now()}`;
    
    console.log("Pollinations video URL:", videoUrl);
    
    // Log usage
    await supabase.from('usage_logs').insert({
      user_id: user.id,
      model_id: 'pollinations-video',
      mode: 'video-generation'
    });
    
    return new Response(JSON.stringify({ 
      output: videoUrl,
      status: 'succeeded',
      note: 'Video is generated on-demand. Please wait a few seconds for it to load.'
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });
  } catch (error) {
    return errorResponse(error, { fn: "video-ai", corsHeaders });
  }
})