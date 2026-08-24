import { Router } from 'express';
import fetch from 'node-fetch';
import { getBillById, getBills, getStats } from '../db.js';

const router = Router();

const MLX_URL   = () => process.env.MLX_URL   || 'http://100.73.128.40:8080';
const MLX_MODEL = () => process.env.MLX_MODEL  || 'mlx-community/Llama-3.3-70B-Instruct-4bit';

const STAGE_LABELS = {
  introduced: 'Introduced', in_committee: 'In Committee', reported: 'Reported from Committee',
  floor_vote: 'Scheduled for Floor Vote', passed_chamber: 'Passed One Chamber',
  conference: 'In Conference', signed: 'Signed into Law', vetoed: 'Vetoed', failed: 'Failed',
};

// ─── Shared system prompt ───────────────────────────────────────────────────
const BASE_SYSTEM = `You are a senior legislative analyst with expertise spanning American constitutional law, political science, behavioral economics, political psychology, and legislative history. You combine deep factual knowledge with honest, nonpartisan analysis.

When answering questions, draw on any and all of the following as relevant — never limit yourself to just one lens:

CONSTITUTIONAL & LEGAL HISTORY
- Relevant constitutional provisions, amendments, and their original intent
- Landmark Supreme Court decisions that bear on this policy area
- Prior legislation in this space and what happened to it
- Federalism considerations: what belongs at federal vs. state level
- Enumerated powers arguments for and against

POLITICAL INCENTIVES & DYNAMICS
- Which interest groups, industries, or constituencies stand to gain or lose
- Campaign finance and donor dynamics around this type of legislation
- Electoral calculus for the sponsor and co-sponsors
- Committee jurisdiction and which chairs control the bill's fate
- Procedural paths: reconciliation, appropriations riders, unanimous consent
- Filibuster math in the Senate; rule mechanics in the House

PSYCHOLOGICAL & BEHAVIORAL FACTORS
- Cognitive biases shaping public and legislative perception (loss aversion, status quo bias, availability heuristic, in-group/out-group dynamics)
- Framing effects: how the bill's name and messaging shape support
- Elite vs. mass opinion gaps and how they affect passage
- Anchoring and logrolling dynamics in negotiations

ECONOMIC & INCENTIVE ANALYSIS
- Who actually bears the cost vs. who gets the stated benefit
- Concentrated benefits vs. diffuse costs (or vice versa) — this predicts lobbying intensity
- Second-order effects and unintended consequences
- CBO score considerations and budget window gimmicks
- Regulatory capture risks

HISTORICAL ANALOGIES
- The last time Congress tried something similar — what passed, what failed, and why
- Policy cycles: which ideas are on an up-swing vs. fading
- Realignment patterns and how they affect which coalitions form

CURRENT POLITICAL CONTEXT
- Party dynamics in the 119th Congress
- Relationship to the President's stated agenda
- Any must-pass vehicles this could attach to
- Public opinion trends and media framing

Be concrete and specific. Acknowledge genuine uncertainty. When a topic is legitimately contested, represent multiple serious perspectives without false equivalence. You do not need to include caveats on every response — give your honest assessment.`;

// ─── Bill-level context builder ─────────────────────────────────────────────
function buildBillContext(bill) {
  const sectors   = tryParse(bill.ai_sectors,   []);
  const carveouts = tryParse(bill.ai_carveouts,  []);
  const lines = [
    '─── BILL UNDER DISCUSSION ───',
    `ID: ${bill.bill_type?.toUpperCase()} ${bill.bill_number} — 119th Congress (${bill.chamber})`,
    `Title: ${bill.title}`,
    `Sponsor: ${bill.sponsor_name || 'Unknown'} (${bill.sponsor_party || '?'}, ${bill.sponsor_state || '?'})`,
    `Co-sponsors: ${bill.cosponsor_count || 0}`,
    `Stage: ${STAGE_LABELS[bill.stage] || bill.stage}`,
    `Passage likelihood (heuristic score): ${bill.passage_score}%`,
    `Introduced: ${bill.introduced_date || '?'}`,
    `Last action: ${bill.latest_action || 'None'} (${bill.last_action_date || '?'})`,
  ];
  if (sectors.length)   lines.push(`Impact sectors: ${sectors.join(', ')}`);
  if (bill.ai_timeline) lines.push(`Timeline estimate: ${bill.ai_timeline}`);
  if (carveouts.length) {
    lines.push('Key carve-outs / exemptions:');
    carveouts.forEach(c => lines.push(`  • ${c}`));
  }
  if (bill.ai_summary) {
    lines.push('', 'AI plain-English summary:', bill.ai_summary);
  }
  if (bill.crs_summary) {
    lines.push('', 'Official CRS summary (excerpt):', bill.crs_summary.slice(0, 1500));
  }
  lines.push('─────────────────────────────');
  return lines.join('\n');
}

// ─── Site-level context builder ──────────────────────────────────────────────
function buildSiteContext() {
  const stats = getStats();
  const floorBills  = getBills({ stage: 'floor_vote',  sort: 'score', limit: 8 }).bills;
  const reportedBills = getBills({ stage: 'reported',  sort: 'score', limit: 6 }).bills;
  const highBills   = getBills({ min_score: 60,        sort: 'score', limit: 6 }).bills;

  const lines = [
    '─── CURRENT LEGISLATIVE LANDSCAPE — 119th Congress ───',
    `Total bills tracked: ${stats.total}`,
    `Scheduled for floor vote (imminent): ${stats.floorVote}`,
    `High likelihood of passage (60%+): ${stats.highScore}`,
    '',
  ];

  if (floorBills.length) {
    lines.push('BILLS ON THE FLOOR RIGHT NOW:');
    for (const b of floorBills) {
      const summ = b.ai_summary || b.crs_summary || '';
      lines.push(`  • ${b.bill_type?.toUpperCase()} ${b.bill_number}: ${b.title}`);
      lines.push(`    Score: ${b.passage_score}% | Sponsor: ${b.sponsor_name} (${b.sponsor_party})`);
      if (summ) lines.push(`    Summary: ${summ.slice(0, 180)}`);
    }
    lines.push('');
  }

  if (reportedBills.length) {
    lines.push('RECENTLY REPORTED FROM COMMITTEE (next in pipeline):');
    for (const b of reportedBills) {
      lines.push(`  • ${b.bill_type?.toUpperCase()} ${b.bill_number}: ${b.title} (score: ${b.passage_score}%)`);
    }
    lines.push('');
  }

  if (highBills.length) {
    lines.push('HIGHEST LIKELIHOOD BILLS:');
    for (const b of highBills) {
      lines.push(`  • ${b.bill_type?.toUpperCase()} ${b.bill_number}: ${b.title} (${b.passage_score}%, ${STAGE_LABELS[b.stage] || b.stage})`);
    }
  }

  lines.push('─────────────────────────────');
  return lines.join('\n');
}

// ─── SSE streaming helper ────────────────────────────────────────────────────
async function streamChat(res, systemPrompt, messages) {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  const send = (obj) => res.write(`data: ${JSON.stringify(obj)}\n\n`);

  try {
    const r = await fetch(`${MLX_URL()}/v1/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: MLX_MODEL(),
        messages: [{ role: 'system', content: systemPrompt }, ...messages],
        stream: true,
        temperature: 0.7,
      }),
      signal: AbortSignal.timeout(180000),
    });

    if (!r.ok) {
      send({ error: `Model error ${r.status}: ${await r.text()}` });
      return res.end();
    }

    let buf = '', done = false;
    for await (const chunk of r.body) {
      buf += chunk.toString();
      const lines = buf.split('\n');
      buf = lines.pop();
      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        const payload = line.slice(6).trim();
        if (payload === '[DONE]') { done = true; break; }
        try {
          const token = JSON.parse(payload).choices?.[0]?.delta?.content || '';
          if (token) send({ token });
        } catch { /* skip malformed */ }
      }
      if (done) break;
    }
    res.write('data: [DONE]\n\n');
    res.end();
  } catch (e) {
    console.error('[chat] error:', e.message);
    send({ error: e.message });
    res.end();
  }
}

// ─── Routes ──────────────────────────────────────────────────────────────────

// Bill-level chat
router.post('/chat/bill/:id', async (req, res) => {
  const { messages } = req.body;
  if (!messages?.length) return res.status(400).json({ error: 'messages required' });

  const bill = getBillById(req.params.id);
  if (!bill) return res.status(404).json({ error: 'Bill not found' });

  const context = buildBillContext(bill);
  const system = `${BASE_SYSTEM}\n\n${context}\n\nThe user wants to discuss this specific bill. Use all available context above, but also draw on any broader knowledge relevant to understanding this legislation.`;

  await streamChat(res, system, messages);
});

// Site-wide chat
router.post('/chat/site', async (req, res) => {
  const { messages } = req.body;
  if (!messages?.length) return res.status(400).json({ error: 'messages required' });

  const context = buildSiteContext();
  const system = `${BASE_SYSTEM}\n\n${context}\n\nThe user wants to discuss the current legislative landscape broadly. Answer questions about any bills, trends, political dynamics, historical context, or anything else related to what Congress is doing right now.`;

  await streamChat(res, system, messages);
});

function tryParse(str, fallback) {
  try { return JSON.parse(str); } catch { return fallback; }
}

export default router;
