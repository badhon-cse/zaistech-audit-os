// db/rulebook.md was written for a manual, chat-driven workflow (an
// assistant auditing one site at a time in conversation with the operator).
// Some of its instructions -- §0's "only audit when the user asks", "confirm
// before submitting", "talk to the user in Banglish/Bangla", §2.1's "ask for
// the audit email", §3's browser/request_access steps -- don't apply when
// the same text is embedded in the app's automated Agent SDK prompts
// (lib/findings.js, lib/outreach.js, lib/selfImprove.js). This note is
// prepended to those prompts so the model acts on the data it's given
// instead of trying to follow chat-session etiquette. The rulebook file
// itself is left as-is (it's still valid for the manual workflow).
export const AUTOMATED_MODE_NOTE = `CONTEXT: You are running inside Zaistech Audit OS, an automated app -- not a chat
session with the operator. The rulebook below was originally written for a manual,
conversational workflow. Ignore any of its chat-session-specific instructions: e.g.
only auditing when the user asks, confirming with the user before submitting or
testing anything, asking the user for an audit email or for approval, talking to the
user in Banglish/Bangla, or using browser/javascript tools yourself. The data has
already been collected for you; act on it directly and return exactly the output
format requested. Everything else in the rulebook (services, proof, checklists,
prioritization, writing rules, output format) still applies in full.`;

// Variant for lib/selfImprove.js, where the model EDITS the rulebook rather
// than follows it: the chat-mode sections aren't instructions to it, and
// they shouldn't be "fixed" away either, since the same text still drives
// the manual workflow.
export const AUTOMATED_MODE_NOTE_FOR_EDITING = `CONTEXT: You are running inside Zaistech Audit OS, an automated app -- not a chat
session with the operator. The rulebook text below includes instructions written for
a manual, conversational audit workflow (e.g. only auditing when the user asks,
confirming before submitting, talking to the user in Banglish/Bangla). Those are not
instructions to you: don't follow them, and don't ask for confirmation -- act on the
evidence given directly and return exactly the output format requested. Also don't
remove or rewrite those chat-workflow sections just because they don't fit automated
mode; that text is still used for the manual workflow. Only change what the outcome
evidence supports.`;
