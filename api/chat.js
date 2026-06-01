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
    const { messages, userName, language } = await req.json();
    const groqKey = process.env.GROQ_API_KEY;
    if (!groqKey) return new Response(JSON.stringify({ error: 'GROQ key missing' }), { status: 500, headers });

    const langPrompt = {
      hindi: 'Hamesha sirf Hindi mein jawab do.',
      english: 'Always respond in English only.',
      hinglish: 'Hinglish mein baat karo — Hindi aur English mix.',
      bengali: 'সবসময় বাংলায় উত্তর দাও।',
      tamil: 'எப்போதும் தமிழில் பதில் சொல்லுங்கள்।',
      telugu: 'ఎల్లప్పుడూ తెలుగులో సమాధానం చెప్పండి.',
      marathi: 'नेहमी मराठीत उत्तर द्या.',
      gujarati: 'હંમેશા ગુજરાતીમાં જવાબ આપો.',
    };

    const sys = `Tum ek helpful AI assistant ho — "Mera AI". ${userName ? `User: ${userName}.` : ''} ${langPrompt[language] || langPrompt.hinglish} Friendly raho.`;

    const resp = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${groqKey}` },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        max_tokens: 1024,
        messages: [{ role: 'system', content: sys }, ...messages]
      })
    });

    const data = await resp.json();
    if (data.error) return new Response(JSON.stringify({ error: data.error.message }), { status: 500, headers });
    return new Response(JSON.stringify({ reply: data.choices[0].message.content }), { status: 200, headers });

  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers });
  }
}
