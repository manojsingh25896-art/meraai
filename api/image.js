export const config = { runtime: 'edge' };

export default async function handler(req) {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json'
  };

  if (req.method === 'OPTIONS') return new Response(null, { status: 200, headers });

  try {
    const { prompt } = await req.json();
    if (!prompt) return new Response(JSON.stringify({ error: 'Prompt required' }), { status: 400, headers });

    // FLUX model — best quality, free!
    const encodedPrompt = encodeURIComponent(prompt + ', highly detailed, professional, 4k quality');
    const imageUrl = `https://image.pollinations.ai/prompt/${encodedPrompt}?model=flux&width=768&height=768&nologo=true&enhance=true`;

    const resp = await fetch(imageUrl);
    if (!resp.ok) return new Response(JSON.stringify({ error: 'Image nahi bani, dobara try karo' }), { status: 500, headers });

    const buf = await resp.arrayBuffer();
    const base64 = btoa(String.fromCharCode(...new Uint8Array(buf)));
    return new Response(JSON.stringify({ image: `data:image/jpeg;base64,${base64}` }), { status: 200, headers });

  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers });
  }
}
