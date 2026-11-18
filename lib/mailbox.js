// Checks a dedicated test-inbox for real welcome / abandoned-cart emails, so
// the "unconfirmed" verdict scanSite() leaves behind (see lib/scan.js --
// detecting an ESP tool on a site doesn't prove the flow is actually live)
// can be confirmed for real instead of guessed at.
//
// Needs three env vars once the dedicated inbox exists (none of this runs
// without them -- every function here no-ops safely until then):
//   AUDIT_INBOX_EMAIL          e.g. zaistech.audits@gmail.com
//   AUDIT_INBOX_APP_PASSWORD   a Gmail "App Password" (NOT the real password --
//                              requires 2FA on the account; generate one at
//                              myaccount.google.com/apppasswords)
//   AUDIT_INBOX_HOST           optional, defaults to imap.gmail.com
//
// Uses Gmail's "+" address tagging so every lead gets its own filterable
// address while all mail lands in one inbox -- signing up on a lead's site
// with zaistech.audits+ab12cd34@gmail.com still delivers to
// zaistech.audits@gmail.com, and the poll step searches for that tag in the
// "To" header to know which lead an email belongs to.
import { ImapFlow } from "imapflow";

export function isMailboxConfigured() {
  return Boolean(process.env.AUDIT_INBOX_EMAIL && process.env.AUDIT_INBOX_APP_PASSWORD);
}

// A short, stable, URL/email-safe tag for a lead -- first 8 chars of its uuid
// is plenty unique for this purpose (one test inbox, a few hundred leads at
// most) and keeps the address short.
export function leadTag(leadId) {
  return String(leadId).replace(/-/g, "").slice(0, 8);
}

export function testEmailForLead(leadId) {
  const base = process.env.AUDIT_INBOX_EMAIL;
  if (!base) return null;
  const [local, domain] = base.split("@");
  return `${local}+${leadTag(leadId)}@${domain}`;
}

async function withClient(fn) {
  const client = new ImapFlow({
    host: process.env.AUDIT_INBOX_HOST || "imap.gmail.com",
    port: 993,
    secure: true,
    auth: { user: process.env.AUDIT_INBOX_EMAIL, pass: process.env.AUDIT_INBOX_APP_PASSWORD },
    logger: false,
  });
  await client.connect();
  try {
    return await fn(client);
  } finally {
    await client.logout().catch(() => client.close());
  }
}

// Returns matching messages' {subject, from, date} sent to this lead's tagged
// address since `sinceDate`, searched across INBOX and Spam (flow emails
// land in spam often enough on a fresh test inbox that skipping it would
// under-report "missing" when the email actually sent).
export async function findEmailsForLead(leadId, sinceDate) {
  if (!isMailboxConfigured()) {
    return { ok: false, reason: "Mailbox not configured yet (AUDIT_INBOX_EMAIL / AUDIT_INBOX_APP_PASSWORD not set)." };
  }
  const tag = leadTag(leadId);
  const messages = [];

  await withClient(async (client) => {
    for (const mailbox of ["INBOX", "[Gmail]/Spam"]) {
      try {
        const lock = await client.getMailboxLock(mailbox);
        try {
          const uids = await client.search({ since: sinceDate }, { uid: true });
          for await (const msg of client.fetch(uids, { envelope: true })) {
            const toHeader = (msg.envelope?.to || []).map((t) => t.address || "").join(" ");
            if (toHeader.toLowerCase().includes(`+${tag}@`)) {
              messages.push({
                subject: msg.envelope?.subject || "(no subject)",
                from: msg.envelope?.from?.[0]?.address || "unknown",
                date: msg.envelope?.date || null,
                mailbox,
              });
            }
          }
        } finally {
          lock.release();
        }
      } catch {
        // mailbox may not exist (e.g. non-Gmail provider has no "[Gmail]/Spam") -- skip it
      }
    }
  });

  return { ok: true, messages };
}
