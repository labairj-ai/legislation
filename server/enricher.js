import fetch from 'node-fetch';

const MLX_URL = process.env.MLX_URL || 'http://100.73.128.40:8080';
const MODEL   = process.env.MLX_MODEL || 'mlx-community/Llama-3.3-70B-Instruct-4bit';

const SECTORS = [
  'healthcare','technology','defense','energy','finance','housing',
  'education','immigration','environment','taxation','agriculture',
  'labor','transportation','judiciary','foreign_policy',
];

const SYSTEM = `You are a nonpartisan legislative analyst. Given bill information, return ONLY valid JSON with no extra text.

Schema:
{
  "plain_summary": "2-3 sentences in plain English: what this bill would actually do, who it affects",
  "sectors": [],   // from: ${SECTORS.join(', ')}
  "carveouts": [], // key exemptions, exclusions, or special provisions (max 5, be specific)
  "timeline": ""   // realistic estimate e.g. "Likely before NDAA deadline Q4 2025" or "Unclear — no floor activity"
}

Rules:
- plain_summary must describe WHAT the bill does, not its name or status
- sectors must only contain values from the list above
- carveouts must be specific provisions, not generic statements
- timeline must be honest; most bills never pass`;

export async function enrichBill(bill) {
  const userText = [
    `Title: ${bill.title}`,
    `Chamber: ${bill.chamber === 'house' ? 'House' : 'Senate'}`,
    `Sponsor: ${bill.sponsor_name || 'Unknown'} (${bill.sponsor_party || '?'}, ${bill.sponsor_state || '?'})`,
    `Stage: ${bill.stage}`,
    `Latest action: ${bill.latest_action || 'None'}`,
    bill.crs_summary ? `Official summary: ${bill.crs_summary.slice(0, 1200)}` : '',
  ].filter(Boolean).join('\n');

  const r = await fetch(`${MLX_URL}/v1/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: MODEL,
      messages: [
        { role: 'system', content: SYSTEM },
        { role: 'user',   content: userText },
      ],
      stream: false,
      temperature: 0.1,
    }),
    signal: AbortSignal.timeout(120000),
  });

  if (!r.ok) throw new Error(`MLX ${r.status}: ${await r.text()}`);
  const data = await r.json();
  const raw = data.choices?.[0]?.message?.content || '';

  let parsed;
  try {
    const match = raw.match(/\{[\s\S]*\}/);
    parsed = JSON.parse(match ? match[0] : raw);
  } catch {
    return null;
  }

  return {
    summary:   (parsed.plain_summary || '').trim(),
    sectors:   (parsed.sectors || []).filter(s => SECTORS.includes(s)),
    carveouts: (parsed.carveouts || []).slice(0, 5),
    timeline:  (parsed.timeline || '').trim(),
  };
}
