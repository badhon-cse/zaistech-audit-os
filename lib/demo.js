// Generates a small, self-contained HTML mockup that shows what the FIX for
// one specific finding would look like -- the thing the user asked for:
// "demo ta oi problem fix ba aro better version hobe jeno client dekhe
// response korte baddho hoy" (the demo should fix/improve that exact problem
// so the client feels compelled to respond).
//
// This is deliberately scoped to ONE finding at a time (not a whole-page
// redesign): a tight, focused "here's your Add to Cart area with trust
// badges added" mockup is more convincing and far cheaper to generate than
// trying to rebuild an entire page.
import { query } from "@anthropic-ai/claude-agent-sdk";

function withTimeout(promise, ms, timeoutResult) {
  return Promise.race([
    promise,
    new Promise((resolve) => setTimeout(() => resolve(timeoutResult), ms)),
  ]);
}

export async function generateDemo({ lead, finding }) {
  const prompt = `You are a sharp e-commerce conversion designer working for
Zaistech, an agency that sells website/email/chat fixes to e-commerce stores.
You're building a tiny, convincing "before -> after" visual mockup to attach
to a cold outreach email for one specific finding from a site audit, so the
prospect immediately sees what they're missing and wants to reply.

LEAD: ${lead.company} (${lead.domain}), industry: ${lead.industry || "e-commerce"}

THE FINDING THIS DEMO IS FOR:
- Area: ${finding.area}
- What's wrong: ${finding.what}
- Where: ${finding.where_ || finding.where}
- Why it costs them money: ${finding.why}
- The fix: ${finding.fix}
- Service being pitched: ${finding.service}

Build ONE self-contained HTML document (inline <style> only, no external
assets, no JS required to render) that is a focused, realistic mockup of ONLY
the relevant UI element/area -- not a whole page redesign. Rules:
1. Show a clearly-labeled "Before" (the current broken/missing state,
   described/recreated simply -- you don't have their real screenshot, so
   build a plausible, generic recreation of that element, not a copy of a
   specific real site's design) next to a clearly-labeled "After" (the fixed,
   polished version) -- side by side or stacked, whichever reads better at
   ~420px wide (this will be viewed on both desktop and mobile).
2. Make the "After" genuinely look good -- real spacing, a believable color
   palette, legible type -- something a business owner would look at and
   think "oh that's actually better," not a wireframe.
3. Small caption at the bottom, in muted gray: "Concept mockup for ${lead.company} -- not pulled from your live site." (Always include this exact kind of disclaimer so it's never mistaken for an actual screenshot of their site.)
4. No logos, brand names, or copyrighted material other than the lead's own
   company name (which you may use in the mockup copy).
5. Keep total HTML under ~6KB. No external fonts/images/scripts -- system
   fonts and CSS only.

Respond with ONLY the raw HTML document (starting with <!DOCTYPE html> or
<html>), no markdown fence, no commentary before or after.`;

  console.log("[demo] starting Agent SDK query for finding, prompt length:", prompt.length);
  let lastText = "";
  let messageCount = 0;
  try {
    for await (const message of withTimeoutIterable(
      query({
        prompt,
        options: {
          model: "claude-sonnet-4-5",
          allowedTools: [],
          systemPrompt: "You are a precise, tasteful UI mockup generator. You respond with raw HTML only.",
        },
      })
    )) {
      messageCount++;
      if (message.type === "result" && "result" in message) {
        lastText = message.result;
      }
    }
  } catch (e) {
    console.error("[demo] query() threw after", messageCount, "messages:", e?.message, e?.stack);
    throw e;
  }
  console.log("[demo] query() finished, messages:", messageCount, "lastText length:", lastText.length);

  const htmlMatch = lastText.match(/<!DOCTYPE html>[\s\S]*<\/html>/i) || lastText.match(/<html[\s\S]*<\/html>/i);
  if (!htmlMatch) {
    throw new Error("Agent SDK did not return parseable HTML: " + lastText.slice(0, 300));
  }
  return htmlMatch[0];
}

// Lets us apply an overall wall-clock cap to the async-iterator-based query()
// call without losing partial progress logging -- a straight Promise.race
// around the whole for-await loop would just abandon the generator, which is
// fine here since we only care about the final "result" message anyway.
async function* withTimeoutIterable(asyncIterable) {
  const DEMO_TIMEOUT_MS = 75000;
  const iterator = asyncIterable[Symbol.asyncIterator]();
  const deadline = Date.now() + DEMO_TIMEOUT_MS;
  while (true) {
    const remaining = deadline - Date.now();
    if (remaining <= 0) throw new Error("Demo generation timed out after " + DEMO_TIMEOUT_MS / 1000 + "s");
    const next = await Promise.race([
      iterator.next(),
      new Promise((_, reject) => setTimeout(() => reject(new Error("Demo generation timed out after " + DEMO_TIMEOUT_MS / 1000 + "s")), remaining)),
    ]);
    if (next.done) return;
    yield next.value;
  }
}
