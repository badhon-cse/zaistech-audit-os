import { approveProposal, rejectProposal } from "../../../../../lib/selfImprove.js";

export async function PATCH(request, { params }) {
  const body = await request.json();
  const { action, reviewedBy, note } = body; // action: "approve" | "reject"

  if (action === "approve") {
    const result = await approveProposal(params.id, reviewedBy);
    if (!result.ok) return Response.json({ error: result.reason }, { status: 400 });
    return Response.json({ ok: true, version: result.version });
  }

  if (action === "reject") {
    const result = await rejectProposal(params.id, reviewedBy, note);
    if (!result.ok) return Response.json({ error: result.reason }, { status: 400 });
    return Response.json({ ok: true });
  }

  return Response.json({ error: "action must be 'approve' or 'reject'" }, { status: 400 });
}
