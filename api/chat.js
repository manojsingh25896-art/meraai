export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { messages, userName, language } = req.body;
    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: 'Messages required' });
    }

    const groqKey = process.env.GROQ_API_KEY;
    if (!groqKey) return res.status(500).json({ error: 'API key not configured' });

    const langPrompt = {
      hindi: 'Hamesha sirf Hindi mein jawab do (Devanagari script mein).',
      english: 'Always respond in English only.',
      hinglish: 'Hinglish mein baat karo — Hindi aur English mix.',
      bengali: 'সবসময় বাংলায় উত্তর দাও।',
      tamil: 'எப்போதும் தமிழில் பதில் சொல்லுங்கள்।',
      telugu: 'ఎల్లప్పుడూ తెలుగులో సమాధానం చెప్పండి.',
      marathi: 'नेहमी मराठीत उत्तर द्या.',
      gujarati: 'હંમેશા ગુજરાતીમાં જવાબ આપો.',
    };

    const systemPrompt = `Tum ek helpful AI assistant ho jiska naam "Mera AI" hai. ${userName ? `User ka naam ${userName} hai.` : ''} ${langPrompt[language] || langPrompt['hinglish']} Friendly, helpful aur concise raho. Complex topics ko simple bhasha mein samjhao.`;

    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${groqKey}`
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        max_tokens: 1024,
        messages: [
          { role: 'system', content: systemPrompt },
          ...messages
        ]
      })
    });

    const data = await response.json();
    if (data.error) return res.status(500).json({ error: data.error.message });
    const reply = data.choices?.[0]?.message?.content || 'Kuch galat hua, dobara try karo.';
    return res.status(200).json({ reply });

  } catch (err) {
    return res.status(500).json({ error: 'Server error: ' + err.message });
  }
}
