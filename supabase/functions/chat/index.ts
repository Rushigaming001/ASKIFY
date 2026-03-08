import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Get user from auth header first
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Parse and validate input
    let requestBody;
    try {
      requestBody = await req.json();
    } catch {
      return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { messages, model, mode, image } = requestBody;

    // Validate messages array
    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return new Response(JSON.stringify({ error: "Messages array is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (messages.length > 100) {
      return new Response(JSON.stringify({ error: "Too many messages (max 100)" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Validate each message
    const validRoles = ['user', 'assistant', 'system'];
    for (const msg of messages) {
      if (!msg.role || !validRoles.includes(msg.role)) {
        return new Response(JSON.stringify({ error: "Invalid message role" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (typeof msg.content !== 'string') {
        return new Response(JSON.stringify({ error: "Message content must be a string" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (msg.content.length > 10000) {
        return new Response(JSON.stringify({ error: "Message content too long (max 10000 chars)" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // Require either message content or image
    const lastMessage = messages[messages.length - 1];
    if (lastMessage.content.length === 0 && !image) {
      return new Response(JSON.stringify({ error: "Message content or image is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // If image is attached, use vision model
    const hasImage = !!image;

    // Validate optional mode
    const validModes = ['normal', 'deepthink', 'search', 'reasoning'];
    if (mode && !validModes.includes(mode)) {
      return new Response(JSON.stringify({ error: "Invalid mode" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // API Keys - User's own Gemini API Key (primary)
    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
    const GROQ_API_KEY = Deno.env.get('GROQ_API_KEY');
    const COHERE_API_KEY = Deno.env.get('COHERE_API_KEY');
    const DEEPSEEK_API_KEY = Deno.env.get('DEEPSEEK_API_KEY');
    
    // Initialize Supabase client
    const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2.39.3');
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
    
    // System prompt with staff information
    let systemPrompt = `You are ASKIFY, a helpful AI assistant. 

STAFF INFORMATION (only share when asked about owner, founder, CEO, staff, creator, or who made you):
- Owner/Founder: Mr. Rudra (also known as Rushi)
- CEO: Mr. Naitik
- Admin: Mr. Devanshu

When asked who made you, created you, or who is behind Askify, mention Mr. Rudra as the founder/owner.`;

    if (mode === 'deepthink') {
      systemPrompt += `

DEEP THINKING MODE ACTIVATED:
You must think deeply and thoroughly about every question. Follow this structure:
1. **Understanding**: First, fully understand what the user is asking
2. **Analysis**: Break down the problem into components
3. **Exploration**: Explore multiple angles and perspectives
4. **Reasoning**: Provide detailed logical reasoning for each point
5. **Conclusion**: Give a comprehensive, well-structured answer

Take your time. Be thorough. Explain your thought process step by step. Consider edge cases and alternative viewpoints. Provide examples where helpful.`;
    } else if (mode === 'search') {
      systemPrompt += `

SEARCH/INFORMATION MODE ACTIVATED:
Act as if you have access to the latest information. Provide:
1. **Key Facts**: Start with the most important information
2. **Sources**: Mention where such information typically comes from (e.g., "According to official documentation...", "Based on industry standards...")
3. **Context**: Provide relevant background information
4. **Related Topics**: Suggest related areas the user might want to explore
5. **Actionable Links**: When relevant, suggest what to search for more information

Be informative, comprehensive, and cite your reasoning. Structure information clearly with headers and bullet points.`;
    } else if (mode === 'reasoning') {
      systemPrompt += `

REASONING/LOGIC MODE ACTIVATED:
Use rigorous step-by-step logical reasoning:
1. **Premise**: State the initial premises clearly
2. **Logic Chain**: Show each logical step with "Therefore..." or "It follows that..."
3. **Evidence**: Support each step with evidence or logical justification
4. **Counterarguments**: Consider and address potential counterarguments
5. **Conclusion**: Draw a clear, logical conclusion

Format: Use numbered steps. Be precise. Avoid logical fallacies. Show your work like solving a math problem.`;
    } else {
      systemPrompt += ' Respond clearly and concisely.';
    }

    // Helper function to call Google Gemini API directly
    async function callGeminiAPI(messages: any[], systemPrompt: string, geminiModel: string): Promise<string> {
      if (!GEMINI_API_KEY) {
        throw new Error("Gemini API key not configured");
      }
      
      console.log(`Calling Gemini API with model: ${geminiModel}`);
      
      // Convert messages to Gemini format
      const geminiContents = [];
      
      // Add system instruction
      geminiContents.push({
        role: 'user',
        parts: [{ text: `System: ${systemPrompt}` }]
      });
      geminiContents.push({
        role: 'model',
        parts: [{ text: 'Understood. I will follow these instructions.' }]
      });
      
      // Add conversation messages
      for (const msg of messages) {
        geminiContents.push({
          role: msg.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: msg.content }]
        });
      }
      
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${geminiModel}:generateContent?key=${GEMINI_API_KEY}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            contents: geminiContents,
            generationConfig: {
              maxOutputTokens: 2048,
              temperature: 0.7,
            },
          }),
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`Gemini API error: ${response.status} - ${errorText}`);
        throw new Error(`Gemini API failed: ${response.status}`);
      }

      const data = await response.json();
      return data.candidates?.[0]?.content?.parts?.[0]?.text || "No response generated";
    }
    
    // Model mapping - ALL Gemini models use user's API key
    let aiModel = '';
    let useGeminiAPI = false;
    let geminiModelName = '';
    let useExternalApi = false;
    let externalApiUrl = '';
    let externalApiKey = '';
    
    // Text Models (Gemini - using user's API key)
    if (model === 'gemini-2.5-flash-lite' || model === 'gemini-lite') {
      useGeminiAPI = true;
      geminiModelName = 'gemini-2.5-flash-lite';
    } else if (model === 'gemini-2.5-flash' || model === 'gemini') {
      useGeminiAPI = true;
      geminiModelName = 'gemini-2.5-flash';
    } else if (model === 'gemini-3-flash' || model === 'gemini-3-flash-preview') {
      useGeminiAPI = true;
      geminiModelName = 'gemini-2.0-flash'; // Using available model
    } else if (model === 'gemini-robotics-er-1.5-preview') {
      useGeminiAPI = true;
      geminiModelName = 'gemini-1.5-pro'; // Fallback to available model
    } else if (model === 'gemma-3-12b') {
      useGeminiAPI = true;
      geminiModelName = 'gemma-3-12b-it';
    } else if (model === 'gemma-3-1b') {
      useGeminiAPI = true;
      geminiModelName = 'gemma-3-1b-it';
    } else if (model === 'gemma-3-27b') {
      useGeminiAPI = true;
      geminiModelName = 'gemma-3-27b-it';
    } else if (model === 'gemma-3-2b') {
      useGeminiAPI = true;
      geminiModelName = 'gemma-3-4b-it'; // 2b not available, use 4b
    } else if (model === 'gemma-3-4b') {
      useGeminiAPI = true;
      geminiModelName = 'gemma-3-4b-it';
    } else if (model === 'gemini-embedding-1.0') {
      // Embedding model - not for chat
      return new Response(JSON.stringify({ error: "Embedding model is not for chat. Use a text model instead." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    } else if (model === 'gemini-2.5-flash-native-audio-dialog' || model === 'gemini-voice') {
      // Voice/TTS model - for voice chat
      useGeminiAPI = true;
      geminiModelName = 'gemini-2.5-flash'; // Use flash for voice as native audio not available via REST
    } else if (model === 'gemini-2.5-flash-tts') {
      // TTS model
      useGeminiAPI = true;
      geminiModelName = 'gemini-2.5-flash'; // TTS uses different endpoint, use flash for text
    } else if (model === 'askify') {
      // ASKIFY PRO uses best Gemini model
      useGeminiAPI = true;
      geminiModelName = 'gemini-2.5-pro-preview-06-05';
    } else if (model === 'gemini-3') {
      useGeminiAPI = true;
      geminiModelName = 'gemini-2.5-pro-preview-06-05';
    } else if (model === 'nano-banana') {
      useGeminiAPI = true;
      geminiModelName = 'gemini-2.5-flash';
    }
    // External API models (Groq, Cohere, DeepSeek)
    else if (model === 'grok' || !model) {
      useExternalApi = true;
      externalApiUrl = 'https://api.groq.com/openai/v1/chat/completions';
      externalApiKey = GROQ_API_KEY || '';
      aiModel = 'llama-3.3-70b-versatile';
    } else if (model === 'cohere') {
      useExternalApi = true;
      externalApiUrl = 'https://api.cohere.ai/v2/chat';
      externalApiKey = COHERE_API_KEY || '';
      aiModel = 'command-r-08-2024';
    } else if (model === 'deepseek' || model === 'lite') {
      // Lite model now handled by Groq
      useExternalApi = true;
      externalApiUrl = 'https://api.groq.com/openai/v1/chat/completions';
      externalApiKey = GROQ_API_KEY || '';
      aiModel = 'llama-3.1-8b-instant';
    } else if (model === 'deepseek-v3') {
      useExternalApi = true;
      externalApiUrl = 'https://api.deepseek.com/chat/completions';
      externalApiKey = DEEPSEEK_API_KEY || '';
      aiModel = 'deepseek-chat';
    }
    // Models routed through Lovable AI Gateway (Claude, GPT, Perplexity, xAI, etc.)
    else if (['gpt', 'gpt-mini', 'gpt-nano', 'gpt-5.2', 'gpt-4o-audio',
              'claude-haiku', 'claude-sonnet', 'claude-opus',
              'qwen-coder', 'mistral-small', 'grok-4-fast',
              'perplexity-sonar', 'perplexity-reasoning',
              'kimi-k2', 'nova-micro', 'chicky-tutor', 'midijourney'].includes(model)) {
      // Map to Lovable AI models
      const lovableModelMap: Record<string, string> = {
        'gpt': 'openai/gpt-5',
        'gpt-mini': 'openai/gpt-5-mini',
        'gpt-nano': 'openai/gpt-5-nano',
        'gpt-5.2': 'openai/gpt-5.2',
        'gpt-4o-audio': 'openai/gpt-5-mini',
        'claude-haiku': 'google/gemini-2.5-flash-lite',
        'claude-sonnet': 'google/gemini-2.5-flash',
        'claude-opus': 'google/gemini-2.5-pro',
        'qwen-coder': 'google/gemini-2.5-flash',
        'mistral-small': 'google/gemini-2.5-flash-lite',
        'grok-4-fast': 'google/gemini-3-flash-preview',
        'perplexity-sonar': 'google/gemini-2.5-flash',
        'perplexity-reasoning': 'google/gemini-2.5-pro',
        'kimi-k2': 'google/gemini-2.5-flash',
        'nova-micro': 'google/gemini-2.5-flash-lite',
        'chicky-tutor': 'google/gemini-2.5-flash-lite',
        'midijourney': 'google/gemini-2.5-flash',
      };
      const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
      if (!LOVABLE_API_KEY) {
        // Fallback to Gemini
        useGeminiAPI = true;
        geminiModelName = 'gemini-2.5-flash';
      } else {
        useExternalApi = true;
        externalApiUrl = 'https://ai.gateway.lovable.dev/v1/chat/completions';
        externalApiKey = LOVABLE_API_KEY;
        aiModel = lovableModelMap[model] || 'google/gemini-2.5-flash';
      }
    }
    // Default to Gemini Flash for unknown models
    else {
      useGeminiAPI = true;
      geminiModelName = 'gemini-2.5-flash';
    }
    
    // If an image is attached, force Gemini vision model
    if (hasImage) {
      console.log("Image provided; forcing Gemini vision model");
      useGeminiAPI = true;
      geminiModelName = 'gemini-2.5-flash';
      useExternalApi = false;
    }

    let reply = '';

    // Handle Gemini API calls (user's API key - NO fallback)
    if (useGeminiAPI) {
      try {
        if (hasImage && image) {
          // Handle image with Gemini Vision
          const geminiContents = [];
          
          // Add system instruction
          geminiContents.push({
            role: 'user',
            parts: [{ text: `System: ${systemPrompt}` }]
          });
          geminiContents.push({
            role: 'model',
            parts: [{ text: 'Understood. I will follow these instructions.' }]
          });
          
          // Add previous messages
          for (let i = 0; i < messages.length - 1; i++) {
            const msg = messages[i];
            geminiContents.push({
              role: msg.role === 'assistant' ? 'model' : 'user',
              parts: [{ text: msg.content }]
            });
          }
          
          // Add last message with image
          const lastMsg = messages[messages.length - 1];
          const imageParts: any[] = [{ text: lastMsg.content || "What's in this image? Please analyze it." }];
          
          // Handle base64 image
          if (image.startsWith('data:')) {
            const [header, base64Data] = image.split(',');
            const mimeType = header.match(/data:(.*?);/)?.[1] || 'image/jpeg';
            imageParts.push({
              inline_data: {
                mime_type: mimeType,
                data: base64Data
              }
            });
          } else {
            // URL image
            imageParts.push({
              file_data: {
                file_uri: image,
                mime_type: 'image/jpeg'
              }
            });
          }
          
          geminiContents.push({
            role: 'user',
            parts: imageParts
          });
          
          const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/${geminiModelName}:generateContent?key=${GEMINI_API_KEY}`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                contents: geminiContents,
                generationConfig: { maxOutputTokens: 2048, temperature: 0.7 },
              }),
            }
          );

          if (!response.ok) {
            const errorText = await response.text();
            console.error(`Gemini Vision API error: ${response.status} - ${errorText}`);
            throw new Error(`Gemini API failed: ${response.status}`);
          }

          const data = await response.json();
          reply = data.candidates?.[0]?.content?.parts?.[0]?.text || "No response generated";
        } else {
          // Text-only call
          reply = await callGeminiAPI(messages, systemPrompt, geminiModelName);
        }
      } catch (error) {
        console.error("Gemini API error:", error);
        return new Response(JSON.stringify({ error: "Gemini API is currently unavailable. Please check your API key or try again later." }), {
          status: 503,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }
    // Handle external API calls (Groq, Cohere, DeepSeek)
    else if (useExternalApi) {
      if (!externalApiKey) {
        return new Response(JSON.stringify({ error: `API key not configured for ${model}. Please add the required API key.` }), {
          status: 503,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      try {
        let response;
        
        if (model === 'cohere') {
          // Cohere v2 API format
          const cohereMessages = [
            { role: 'system', content: systemPrompt },
            ...messages.map((m: { role: string; content: string }) => ({
              role: m.role === 'assistant' ? 'assistant' : 'user',
              content: m.content
            }))
          ];
          
          response = await fetch(externalApiUrl, {
            method: "POST",
            headers: {
              Authorization: `Bearer ${externalApiKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              model: aiModel,
              messages: cohereMessages
            }),
          });

          if (!response.ok) {
            const errorText = await response.text();
            console.error(`Cohere API error: ${response.status} - ${errorText}`);
            return new Response(JSON.stringify({ error: "Cohere API is currently unavailable. Please try again later." }), {
              status: 503,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
          }

          const data = await response.json();
          reply = data.message?.content?.[0]?.text || "No response generated";
        } else {
          // Groq, DeepSeek, and Lovable AI Gateway use OpenAI-compatible format
          // GPT-5.x models require max_completion_tokens instead of max_tokens
          const isGptModel = aiModel?.startsWith('openai/gpt-5') || aiModel?.startsWith('openai/o');
          const tokenParam = isGptModel
            ? { max_completion_tokens: 2048 }
            : { max_tokens: 2048 };

          response = await fetch(externalApiUrl, {
            method: "POST",
            headers: {
              Authorization: `Bearer ${externalApiKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              model: aiModel,
              messages: [
                { role: "system", content: systemPrompt },
                ...messages,
              ],
              ...tokenParam,
            }),
          });

          if (!response.ok) {
            const errorText = await response.text();
            console.error(`${model} API error: ${response.status} - ${errorText}`);
            return new Response(JSON.stringify({ error: `${model} API is currently unavailable. Please try again later.` }), {
              status: 503,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
          }

          const data = await response.json();
          reply = data.choices?.[0]?.message?.content || "No response generated";
        }
      } catch (error) {
        console.error(`External API (${model}) failed:`, error);
        return new Response(JSON.stringify({ error: `${model} is currently unavailable. Please try again later.` }), {
          status: 503,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // Log usage
    await supabase.from('usage_logs').insert({
      user_id: user.id,
      model_id: useGeminiAPI ? `gemini/${geminiModelName}` : aiModel || model,
      mode: mode || 'normal'
    });

    return new Response(JSON.stringify({ reply }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Chat error:", error);
    return new Response(
      JSON.stringify({ error: "An error occurred processing your request. Please try again." }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
