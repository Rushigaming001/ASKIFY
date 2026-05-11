// Smoke test: pings every edge function with an OPTIONS preflight
// to verify it bundles and responds. No auth/body needed.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const FUNCTIONS = [
  "send-feedback",
  "youtube-api",
  "minecraft-plugin",
  "video-ai",
  "send-push-notification",
  "verify-otp",
  "image-ai",
  "video-editor",
  "askify-chat",
  "chapter-video",
  "chat",
  "test-generator",
  "send-otp",
];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;

  const results = await Promise.all(
    FUNCTIONS.map(async (name) => {
      const started = Date.now();
      try {
        const res = await fetch(`${SUPABASE_URL}/functions/v1/${name}`, {
          method: "OPTIONS",
          headers: {
            apikey: ANON,
            "access-control-request-method": "POST",
            "access-control-request-headers": "content-type, authorization",
            origin: "https://smoke-test.local",
          },
        });
        await res.body?.cancel();
        const ok = res.status >= 200 && res.status < 500;
        return {
          name,
          status: res.status,
          ok,
          ms: Date.now() - started,
        };
      } catch (e) {
        return {
          name,
          status: 0,
          ok: false,
          ms: Date.now() - started,
          error: (e as Error).message,
        };
      }
    }),
  );

  const allOk = results.every((r) => r.ok);

  return new Response(
    JSON.stringify(
      {
        ok: allOk,
        total: results.length,
        passed: results.filter((r) => r.ok).length,
        failed: results.filter((r) => !r.ok),
        results,
      },
      null,
      2,
    ),
    {
      status: allOk ? 200 : 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    },
  );
});
