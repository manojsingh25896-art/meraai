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
    const { pdfText, language } = await req.json();
    const groqKey = process.env.GROQ_API_KEY;
    if (!groqKey) return new Response(JSON.stringify({ error: 'API key missing' }), { status: 500, headers });

    const prompt = `Tum ek expert quiz maker ho. Neeche diye gaye PDF content ko carefully padho aur usme se SAARE questions extract karo.

PDF Content:
${pdfText.slice(0, 6000)}

IMPORTANT Rules:
1. PDF mein jitne bhi questions hain SARE nikalo — 10 hon, 30 hon, 75 hon, 180 hon ya 200 — sab
2. Har question ke saath jo bhi options diye hain woh EXACTLY waise hi lo (A,B,C,D ya 1,2,3,4 ya a,b,c,d)
3. Agar PDF mein 2 options hain toh 2, 3 hain toh 3, 4 hain toh 4 — EXACTLY utne hi
4. Agar answer key bhi di hai toh correct answer bhi set karo
5. Agar answer nahi pata toh best guess karo content se
6. Language: ${language === 'english' ? 'English' : language === 'hindi' ? 'Hindi' : 'as is in PDF'}

STRICT JSON format mein do, koi extra text nahi, sirf JSON:
{
  "total": <total questions count>,
  "questions": [
    {
      "id": 1,
      "question": "Question text exactly as in PDF",
      "options": {
        "A": "Option A text",
        "B": "Option B text",
        "C": "Option C text",
        "D": "Option D text"
      },
      "correct": "A",
      "explanation": "Brief explanation"
    }
  ]
}

Agar PDF mein 2 options hain toh options mein sirf A aur B hoga, 3 hain toh A,B,C — FLEXIBLE raho.`;

    const resp = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${groqKey}` },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        max_tokens: 8000,
        messages: [{ role: 'user', content: prompt }]
      })
    });

    const data = await resp.json();
    if (data.error) return new Response(JSON.stringify({ error: data.error.message }), { status: 500, headers });

    let text = data.choices[0].message.content;
    text = text.replace(/```json/g, '').replace(/```/g, '').trim();
    const start = text.indexOf('{');
    const end = text.lastIndexOf('}');
    if (start === -1) return new Response(JSON.stringify({ error: 'Questions extract nahi hue' }), { status: 500, headers });
    text = text.slice(start, end + 1);

    const parsed = JSON.parse(text);
    return new Response(JSON.stringify(parsed), { status: 200, headers });
  } catch (e) {
    return new Response(JSON.stringify({ error: 'Error: ' + e.message }), { status: 500, headers });
  }
}
