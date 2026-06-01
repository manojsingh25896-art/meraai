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
    const hfKey = process.env.HF_API_KEY;
    if (!hfKey) return new Response(JSON.stringify({ error: 'HF key missing' }), { status: 500, headers });

    const resp = await fetch(
      'https://api-inference.huggingface.co/models/stabilityai/stable-diffusion-xl-base-1.0',
      {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${hfKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ inputs: prompt, parameters: { width: 512, height: 512, num_inference_steps: 20 } })
      }
    );

    if (resp.status === 503) return new Response(JSON.stringify({ error: 'Model load ho raha hai — 30 sec baad try karo!' }), { status: 503, headers });
    if (!resp.ok) return new Response(JSON.stringify({ error: 'Image nahi bani, dobara try karo' }), { status: 500, headers });

    const buf = await resp.arrayBuffer();
    const base64 = btoa(String.fromCharCode(...new Uint8Array(buf)));
    return new Response(JSON.stringify({ image: `data:image/jpeg;base64,${base64}` }), { status: 200, headers });

  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers });
  }
}
