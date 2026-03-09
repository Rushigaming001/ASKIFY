import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

interface PushPayload {
  userId: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
}

// Base64url encode
function base64UrlEncode(data: Uint8Array): string {
  const base64 = btoa(String.fromCharCode(...data));
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

// Base64url decode
function base64UrlDecode(str: string): Uint8Array {
  const padding = '='.repeat((4 - str.length % 4) % 4);
  const base64 = (str + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

// Import raw key bytes for ECDSA P-256
async function importVapidPrivateKey(base64Key: string): Promise<CryptoKey> {
  const pubKey = Deno.env.get('VAPID_PUBLIC_KEY')!;
  const pubPadding = '='.repeat((4 - pubKey.length % 4) % 4);
  const pubBase64 = (pubKey + pubPadding).replace(/-/g, '+').replace(/_/g, '/');
  const pubRaw = Uint8Array.from(atob(pubBase64), c => c.charCodeAt(0));

  if (pubRaw.length !== 65 || pubRaw[0] !== 0x04) {
    throw new Error('Invalid VAPID public key format');
  }

  const jwk = {
    kty: 'EC',
    crv: 'P-256',
    d: base64Key,
    x: base64UrlEncode(pubRaw.slice(1, 33)),
    y: base64UrlEncode(pubRaw.slice(33, 65)),
  };

  return crypto.subtle.importKey(
    'jwk',
    jwk,
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['sign']
  );
}

async function createVapidJwt(endpoint: string, privateKey: CryptoKey): Promise<string> {
  const origin = new URL(endpoint).origin;
  const now = Math.floor(Date.now() / 1000);

  const header = { typ: 'JWT', alg: 'ES256' };
  const payload = {
    aud: origin,
    exp: now + 86400,
    sub: 'mailto:support@askify.app',
  };

  const headerB64 = base64UrlEncode(new TextEncoder().encode(JSON.stringify(header)));
  const payloadB64 = base64UrlEncode(new TextEncoder().encode(JSON.stringify(payload)));
  const unsigned = `${headerB64}.${payloadB64}`;

  const signature = await crypto.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' },
    privateKey,
    new TextEncoder().encode(unsigned)
  );

  const sigArray = new Uint8Array(signature);
  let r: Uint8Array, s: Uint8Array;

  if (sigArray.length === 64) {
    r = sigArray.slice(0, 32);
    s = sigArray.slice(32, 64);
  } else {
    let offset = 2;
    offset++;
    const rLen = sigArray[offset++];
    r = sigArray.slice(offset, offset + rLen);
    offset += rLen;
    offset++;
    const sLen = sigArray[offset++];
    s = sigArray.slice(offset, offset + sLen);

    if (r.length > 32) r = r.slice(r.length - 32);
    if (s.length > 32) s = s.slice(s.length - 32);
    if (r.length < 32) { const padded = new Uint8Array(32); padded.set(r, 32 - r.length); r = padded; }
    if (s.length < 32) { const padded = new Uint8Array(32); padded.set(s, 32 - s.length); s = padded; }
  }

  const rawSig = new Uint8Array(64);
  rawSig.set(r, 0);
  rawSig.set(s, 32);

  return `${unsigned}.${base64UrlEncode(rawSig)}`;
}

// RFC 8291 Web Push encryption
async function encryptPayload(
  payload: Uint8Array,
  p256dhKey: Uint8Array,
  authSecret: Uint8Array
): Promise<{ ciphertext: Uint8Array; salt: Uint8Array; localPublicKey: Uint8Array }> {
  // Generate ephemeral ECDH key pair
  const localKeyPair = await crypto.subtle.generateKey(
    { name: 'ECDH', namedCurve: 'P-256' },
    true,
    ['deriveBits']
  );

  // Export local public key
  const localPublicKeyRaw = await crypto.subtle.exportKey('raw', localKeyPair.publicKey);
  const localPublicKey = new Uint8Array(localPublicKeyRaw);

  // Import subscriber public key
  const subscriberPublicKey = await crypto.subtle.importKey(
    'raw',
    p256dhKey,
    { name: 'ECDH', namedCurve: 'P-256' },
    false,
    []
  );

  // Derive shared secret using ECDH
  const sharedSecretBits = await crypto.subtle.deriveBits(
    { name: 'ECDH', public: subscriberPublicKey },
    localKeyPair.privateKey,
    256
  );
  const sharedSecret = new Uint8Array(sharedSecretBits);

  // Generate random salt
  const salt = crypto.getRandomValues(new Uint8Array(16));

  // Build info for HKDF: "WebPush: info\0" + subscriber key + local key
  const infoPrefix = new TextEncoder().encode('WebPush: info\0');
  const info = new Uint8Array(infoPrefix.length + p256dhKey.length + localPublicKey.length);
  info.set(infoPrefix, 0);
  info.set(p256dhKey, infoPrefix.length);
  info.set(localPublicKey, infoPrefix.length + p256dhKey.length);

  // HKDF extract: use auth secret as salt, shared secret as IKM
  const prkKey = await crypto.subtle.importKey(
    'raw',
    authSecret,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const prk = new Uint8Array(await crypto.subtle.sign('HMAC', prkKey, sharedSecret));

  // HKDF expand to get IKM for content encryption
  const ikmInfoPrefix = new TextEncoder().encode('Content-Encoding: auth\0');
  const prkKeyForIkm = await crypto.subtle.importKey(
    'raw',
    prk,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const ikmInput = new Uint8Array(ikmInfoPrefix.length + 1);
  ikmInput.set(ikmInfoPrefix, 0);
  ikmInput[ikmInfoPrefix.length] = 1;
  const ikm = new Uint8Array(await crypto.subtle.sign('HMAC', prkKeyForIkm, ikmInput)).slice(0, 32);

  // Derive CEK and nonce using HKDF with salt
  const saltKey = await crypto.subtle.importKey(
    'raw',
    salt,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const prk2 = new Uint8Array(await crypto.subtle.sign('HMAC', saltKey, ikm));

  // CEK info: "Content-Encoding: aes128gcm\0"
  const cekInfo = new TextEncoder().encode('Content-Encoding: aes128gcm\0');
  const prk2Key = await crypto.subtle.importKey(
    'raw',
    prk2,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const cekInput = new Uint8Array(cekInfo.length + 1);
  cekInput.set(cekInfo, 0);
  cekInput[cekInfo.length] = 1;
  const cek = new Uint8Array(await crypto.subtle.sign('HMAC', prk2Key, cekInput)).slice(0, 16);

  // Nonce info: "Content-Encoding: nonce\0"
  const nonceInfo = new TextEncoder().encode('Content-Encoding: nonce\0');
  const nonceInput = new Uint8Array(nonceInfo.length + 1);
  nonceInput.set(nonceInfo, 0);
  nonceInput[nonceInfo.length] = 1;
  const nonce = new Uint8Array(await crypto.subtle.sign('HMAC', prk2Key, nonceInput)).slice(0, 12);

  // Add padding delimiter (0x02 for final record)
  const paddedPayload = new Uint8Array(payload.length + 1);
  paddedPayload.set(payload, 0);
  paddedPayload[payload.length] = 0x02; // Record delimiter

  // Encrypt with AES-GCM
  const cekCryptoKey = await crypto.subtle.importKey(
    'raw',
    cek,
    { name: 'AES-GCM' },
    false,
    ['encrypt']
  );
  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: nonce },
    cekCryptoKey,
    paddedPayload
  );

  // Build aes128gcm header: salt (16) + rs (4) + idlen (1) + keyid (65)
  const rs = 4096;
  const header = new Uint8Array(16 + 4 + 1 + 65);
  header.set(salt, 0);
  header[16] = (rs >> 24) & 0xff;
  header[17] = (rs >> 16) & 0xff;
  header[18] = (rs >> 8) & 0xff;
  header[19] = rs & 0xff;
  header[20] = 65; // keyid length
  header.set(localPublicKey, 21);

  const ciphertext = new Uint8Array(header.length + encrypted.byteLength);
  ciphertext.set(header, 0);
  ciphertext.set(new Uint8Array(encrypted), header.length);

  return { ciphertext, salt, localPublicKey };
}

async function sendWebPush(
  subscription: { endpoint: string; p256dh: string; auth: string },
  notificationPayload: { title: string; body: string; data?: Record<string, unknown> }
) {
  const vapidPublicKey = Deno.env.get('VAPID_PUBLIC_KEY');
  const vapidPrivateKey = Deno.env.get('VAPID_PRIVATE_KEY');

  if (!vapidPublicKey || !vapidPrivateKey) {
    throw new Error('VAPID keys not configured');
  }

  console.log('Sending push to endpoint:', subscription.endpoint.substring(0, 50) + '...');

  const privateKey = await importVapidPrivateKey(vapidPrivateKey);
  const jwt = await createVapidJwt(subscription.endpoint, privateKey);

  // Decode subscription keys
  const p256dhKey = base64UrlDecode(subscription.p256dh);
  const authSecret = base64UrlDecode(subscription.auth);

  // Prepare and encrypt payload
  const payloadJson = JSON.stringify({
    title: notificationPayload.title,
    body: notificationPayload.body,
    icon: '/favicon.ico',
    badge: '/favicon.ico',
    data: notificationPayload.data || {},
  });

  const payloadBytes = new TextEncoder().encode(payloadJson);
  const { ciphertext } = await encryptPayload(payloadBytes, p256dhKey, authSecret);

  const headers: Record<string, string> = {
    'Content-Type': 'application/octet-stream',
    'Content-Encoding': 'aes128gcm',
    'Content-Length': ciphertext.length.toString(),
    'TTL': '86400',
    'Urgency': 'high',
    'Authorization': `vapid t=${jwt}, k=${vapidPublicKey}`,
  };

  console.log('Sending encrypted push, payload size:', ciphertext.length);

  const response = await fetch(subscription.endpoint, {
    method: 'POST',
    headers,
    body: ciphertext,
  });

  const responseText = await response.text();
  console.log('Push response:', response.status, responseText);

  if (!response.ok) {
    throw new Error(`Push failed: ${response.status} - ${responseText}`);
  }

  return response;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      console.log('No authorization header');
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );

    if (authError || !user) {
      console.log('Auth error:', authError?.message);
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { userId, title, body, data }: PushPayload = await req.json();
    console.log('Push request for user:', userId, 'title:', title);

    if (!userId || !title || !body) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: userId, title, body' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: subscriptions, error: fetchError } = await supabase
      .from('push_subscriptions')
      .select('*')
      .eq('user_id', userId);

    if (fetchError) {
      console.log('Fetch subscriptions error:', fetchError.message);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch subscriptions' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Found subscriptions:', subscriptions?.length || 0);

    if (!subscriptions || subscriptions.length === 0) {
      return new Response(
        JSON.stringify({ message: 'No subscriptions found', sent: 0 }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let successCount = 0;
    let failCount = 0;

    for (const sub of subscriptions) {
      try {
        await sendWebPush(
          { endpoint: sub.endpoint, p256dh: sub.p256dh, auth: sub.auth },
          { title, body, data }
        );
        successCount++;
        console.log('Push sent successfully to:', sub.id);
      } catch (err) {
        const error = err as Error;
        console.error(`Push failed for ${sub.id}:`, error.message);
        failCount++;

        // Auto-cleanup expired/gone subscriptions
        if (error.message?.includes('410') || error.message?.includes('404')) {
          console.log('Removing expired subscription:', sub.id);
          await supabase.from('push_subscriptions').delete().eq('id', sub.id);
        }
      }
    }

    console.log('Push complete. Success:', successCount, 'Failed:', failCount);

    return new Response(
      JSON.stringify({ message: 'Push notifications processed', sent: successCount, failed: failCount }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (err) {
    const error = err as Error;
    console.error('Error:', error.message, error.stack);
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
