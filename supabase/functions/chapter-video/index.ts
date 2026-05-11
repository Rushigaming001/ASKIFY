import { serve } from "jsr:@std/http/server"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'
import { encodeBase64 as base64Encode } from "jsr:@std/encoding/base64";
import { checkDDoS } from "../_shared/ddos.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const ddos = checkDDoS(req, corsHeaders, { key: 'chapter-video', limit: 5 });
  if (ddos) return ddos;

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);
    const authHeader = req.headers.get("Authorization");
    const token = authHeader?.startsWith('Bearer ') ? authHeader.replace('Bearer ', '') : '';
    const { data: { user } } = token ? await supabase.auth.getUser(token) : { data: { user: null } };

    const body = await req.json();
    const { chapterText, chapterTitle, useLovableAI, language = 'english' } = body;

    if (!chapterText || chapterText.trim().length < 50) {
      return new Response(JSON.stringify({ 
        error: "Please provide chapter text with at least 50 characters" 
      }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check if user wants to use Lovable AI (only for owner)
    if (useLovableAI) {
      if (!user?.id) {
        return new Response(JSON.stringify({ error: "Owner mode requires login. Please use the free AI option." }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: isOwner } = await supabase.rpc('is_owner', { _user_id: user.id });
      
      if (!isOwner) {
        return new Response(JSON.stringify({ 
          error: "Lovable AI is only available for the owner. Please use the free AI option." 
        }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    console.log("Generating chapter video for:", chapterTitle, "Language:", language, "User:", user?.id || 'guest');

    const POLLINATIONS_API_KEY_1 = Deno.env.get('POLLINATIONS_API_KEY_1');
    const POLLINATIONS_API_KEY_2 = Deno.env.get('POLLINATIONS_API_KEY_2');
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    const ELEVENLABS_API_KEY = Deno.env.get('ELEVENLABS_API_KEY');

    // Voice IDs for different languages
    const voiceMap: Record<string, { id: string; name: string }> = {
      english: { id: 'JBFqnCBsd6RMkjVDRZzb', name: 'George' },  // Clear English voice
      hindi: { id: 'onwK4e9ZLuTAKqWW03F9', name: 'Daniel' },    // Can speak Hindi well
    };

    const selectedVoice = voiceMap[language] || voiceMap.english;

    // System prompt to create a narration script (not video script - actual spoken content)
    const systemPrompt = `You are an expert educational narrator. Your task is to convert chapter content into a clear, engaging spoken narration.

IMPORTANT: Write the narration in ${language === 'hindi' ? 'Hindi (Devanagari script)' : 'English'} language.

Create a narration that:
1. **Introduction**: Start with a welcoming hook that captures attention
2. **Main Explanation**: Break down each concept in simple, clear language
3. **Examples**: Include relatable examples to illustrate points
4. **Key Takeaways**: Summarize the most important points
5. **Conclusion**: End with an encouraging closing statement

Guidelines:
- Write as if you're speaking directly to a student
- Use simple, conversational language
- Keep sentences short and clear for easy listening
- Add natural pauses with "..." where appropriate
- The narration should be 3-5 minutes when read aloud (about 400-800 words)
- DO NOT include any stage directions, scene descriptions, or visual notes
- Write ONLY the spoken text that will be converted to audio`;

    let narrationScript = '';
    let usedModel = '';

    // Generate the narration script
    if (useLovableAI && LOVABLE_API_KEY) {
      try {
        console.log("Using Lovable AI Pro for owner...");
        const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${LOVABLE_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "google/gemini-2.5-pro",
            messages: [
              { role: "system", content: systemPrompt },
              { role: "user", content: `Create a spoken narration for this chapter:\n\nTitle: ${chapterTitle || 'Chapter Explanation'}\n\nContent:\n${chapterText.substring(0, 8000)}` }
            ],
            max_tokens: 2000,
          }),
        });

        if (response.ok) {
          const data = await response.json();
          narrationScript = data.choices?.[0]?.message?.content || '';
          usedModel = 'lovable-gemini-pro';
        } else {
          throw new Error("Lovable AI failed");
        }
      } catch (error) {
        console.error("Lovable AI error:", error);
        return new Response(JSON.stringify({ error: "Lovable AI service unavailable" }), {
          status: 503,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    } else {
      // Use Pollinations (free for everyone)
      const callPollinations = async (apiKey: string): Promise<string> => {
        const response = await fetch('https://text.pollinations.ai/openai', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'openai',
            messages: [
              { role: 'system', content: systemPrompt },
              { role: 'user', content: `Create a spoken narration for this chapter:\n\nTitle: ${chapterTitle || 'Chapter Explanation'}\n\nContent:\n${chapterText.substring(0, 6000)}` }
            ],
            max_tokens: 2000,
          }),
        });

        if (!response.ok) {
          throw new Error(`Pollinations error: ${response.status}`);
        }

        const data = await response.json();
        return data.choices?.[0]?.message?.content || '';
      };

      // Try Pollinations Key 1
      if (POLLINATIONS_API_KEY_1) {
        try {
          narrationScript = await callPollinations(POLLINATIONS_API_KEY_1);
          usedModel = 'pollinations-key1';
        } catch (err) {
          console.log("Pollinations Key 1 failed, trying Key 2...", err);
        }
      }

      // Try Pollinations Key 2 if Key 1 failed
      if (!narrationScript && POLLINATIONS_API_KEY_2) {
        try {
          narrationScript = await callPollinations(POLLINATIONS_API_KEY_2);
          usedModel = 'pollinations-key2';
        } catch (err) {
          console.log("Pollinations Key 2 also failed", err);
        }
      }

      // Fallback to Lovable AI if Pollinations fails
      if (!narrationScript && LOVABLE_API_KEY) {
        try {
          console.log("Both Pollinations keys failed, using Lovable AI fallback...");
          const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${LOVABLE_API_KEY}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              model: "google/gemini-2.5-flash-lite",
              messages: [
                { role: "system", content: systemPrompt },
                { role: 'user', content: `Create a spoken narration for this chapter:\n\nTitle: ${chapterTitle || 'Chapter Explanation'}\n\nContent:\n${chapterText.substring(0, 4000)}` }
              ],
              max_tokens: 1500,
            }),
          });

          if (response.ok) {
            const data = await response.json();
            narrationScript = data.choices?.[0]?.message?.content || '';
            usedModel = 'lovable-fallback';
          }
        } catch (error) {
          console.error("Lovable fallback error:", error);
        }
      }
    }

    if (!narrationScript) {
      return new Response(JSON.stringify({ error: "All AI services unavailable. Please try again later." }), {
        status: 503,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log("Generated narration script, length:", narrationScript.length);

    // Now generate audio using ElevenLabs
    let audioBase64 = '';
    if (ELEVENLABS_API_KEY) {
      try {
        console.log(`Generating audio with ElevenLabs, voice: ${selectedVoice.name}, language: ${language}`);
        
        // Truncate if too long (ElevenLabs has a 5000 char limit per request)
        const truncatedScript = narrationScript.substring(0, 4500);
        
        const ttsResponse = await fetch(
          `https://api.elevenlabs.io/v1/text-to-speech/${selectedVoice.id}?output_format=mp3_44100_128`,
          {
            method: "POST",
            headers: {
              "xi-api-key": ELEVENLABS_API_KEY,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              text: truncatedScript,
              model_id: "eleven_multilingual_v2", // Supports multiple languages including Hindi
              voice_settings: {
                stability: 0.6,
                similarity_boost: 0.75,
                style: 0.3,
                use_speaker_boost: true,
                speed: 0.95, // Slightly slower for educational content
              },
            }),
          }
        );

        if (ttsResponse.ok) {
          const audioBuffer = await ttsResponse.arrayBuffer();
          audioBase64 = base64Encode(audioBuffer);
          console.log("Audio generated successfully, size:", audioBuffer.byteLength);
        } else {
          const errorText = await ttsResponse.text();
          console.error("ElevenLabs TTS error:", ttsResponse.status, errorText);
        }
      } catch (ttsError) {
        console.error("ElevenLabs TTS error:", ttsError);
      }
    } else {
      console.log("ElevenLabs API key not configured, returning script only");
    }

    // Log usage
    if (user?.id) {
      await supabase.from('usage_logs').insert({
        user_id: user.id,
        model_id: `chapter-video-${usedModel}`,
        mode: 'chapter-video'
      });
    }

    console.log("Successfully generated chapter video content using:", usedModel);

    return new Response(JSON.stringify({ 
      script: narrationScript,
      audio: audioBase64 || null,
      audioFormat: audioBase64 ? 'mp3' : null,
      voice: selectedVoice.name,
      language: language,
      model: usedModel,
      status: 'succeeded'
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error) {
    console.error("Error in chapter-video function:", error)
    return new Response(JSON.stringify({ error: "An error occurred processing your request. Please try again." }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    })
  }
})
