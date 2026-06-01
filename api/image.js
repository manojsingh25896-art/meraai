export const config = { runtime: 'edge' };

export default async function handler(req) {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json'
  };

  if (req.method === 'OPTIONS') return new Response(null, { status: 200, headers });
  if (req.method !== 'POST') return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers });

  try {
    const { prompt } = await req.json();
    if (!prompt) return new Response(JSON.stringify({ error: 'Prompt required' }), { status: 400, headers });

    const hfKey = process.env.HF_API_KEY;
    if (!hfKey) return new Response(JSON.stringify({ error: 'HF key not configured' }), { status: 500, headers });

    const response = await fetch(
      'https://api-inference.huggingface.co/models/stabilityai/stable-diffusion-xl-base-1.0',
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${hfKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          inputs: prompt,
          parameters: { width: 512, height: 512, num_inference_steps: 20 }
        })
      }
    );

    if (!response.ok) {
      if (response.status === 503) {
        return new Response(JSON.stringify({ error: 'Model load ho raha hai — 30 second baad dobara try karo!' }), { status: 503, headers });
      }
      return new Response(JSON.stringify({ error: 'Image nahi bani, dobara try karo' }), { status: 500, headers });
    }

    const buffer = await response.arrayBuffer();
    const base64 = btoa(String.fromCharCode(...new Uint8Array(buffer)));
    return new Response(JSON.stringify({ image: `data:image/jpeg;base64,${base64}` }), { status: 200, headers });

  } catch (err) {
    return new Response(JSON.stringify({ error: 'Server error: ' + err.message }), { status: 500, headers });
  }
}
