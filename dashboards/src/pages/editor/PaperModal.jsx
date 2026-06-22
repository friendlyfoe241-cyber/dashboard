import { useState } from 'react';
import { api } from '../../api.js';
import { Modal, Button, Field, Badge } from '../../components/ui.jsx';
import { Embed, embedSrc } from '../../components/embed.jsx';
import Icon from '../../components/Icon.jsx';

// Human-readable label for the role that left a decision, so the feedback chain
// reads clearly (Reviews Editor / Senior Editor / Editor-in-Chief).
const ROLE_LABEL = {
  reviews: 'Reviews Editor',
  senior: 'Senior Editor',
  associate: 'Associate Editor',
  chief: 'Editor-in-Chief',
};

const decisionTone = (d) => (d === 'approve' || d === 'approved' ? 'green' : 'red');
const decisionWord = (d) => (d === 'approve' || d === 'approved' ? 'approved' : 'declined');

// The "See more" detail view. Renders the paper's extracted info plus the
// decision controls appropriate to the editor's role.
export default function PaperModal({ paper, role, onClose, onActed }) {
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const run = async (fn) => {
    setError('');
    setBusy(true);
    try {
      await fn();
      onActed();
    } catch (e) {
      setError(e.message);
    } finally {
      // Always re-enable controls; if onActed() closed the modal this is a
      // harmless no-op, but it stops the buttons sticking when it doesn't.
      setBusy(false);
    }
  };

  // Author identity is hidden from reviews editors (single-blind, §9.1) and
  // revealed from the Associate stage onward — the backend already strips it
  // for reviews, this also hides the UI block so nothing renders "null".
  const showAuthor = role !== 'reviews';

  return (
    <Modal title={paper.title} onClose={onClose} wide>
      {error && <div className="login-error">{error}</div>}

      <div className="row" style={{ marginBottom: '0.75rem' }}>
        <Badge>{paper.category}</Badge>
        <span className="muted">#{paper.id.replace('paper_', '')}</span>
        <span className="muted">Submitted {new Date(paper.submittedAt).toLocaleDateString()}</span>
        {paper.revisions?.length > 1 && <Badge tone="blue">v{paper.revisions.length}</Badge>}
        {paper.revisionRequested && <Badge tone="gold">revision requested</Badge>}
      </div>

      <PaperInfo paper={paper} showAuthor={showAuthor} />

      <RequestRevision paper={paper} busy={busy} run={run} />

      <div className="divider" />

      {role === 'reviews' && <ReviewsForm paper={paper} busy={busy} run={run} />}
      {role === 'senior' && <SeniorForm paper={paper} busy={busy} run={run} />}
      {role === 'associate' && <AssociateForm paper={paper} busy={busy} run={run} />}
      {role === 'chief' && <ChiefForm paper={paper} busy={busy} run={run} />}

      <div className="divider" />
      <CommentThread paper={paper} />
    </Modal>
  );
}

// Ask the author for a revision (emails them + flags the paper).
function RequestRevision({ paper, busy, run }) {
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState('');
  return (
    <div style={{ marginTop: '0.75rem' }}>
      {paper.revisions?.length > 1 && (
        <details style={{ marginBottom: '0.5rem' }}>
          <summary className="muted" style={{ cursor: 'pointer' }}>Version history ({paper.revisions.length})</summary>
          <div className="stack" style={{ marginTop: '0.4rem' }}>
            {paper.revisions.map((r) => (
              <div key={r.version} className="muted" style={{ fontSize: '0.8rem' }}>
                v{r.version} · <a href={r.url} target="_blank" rel="noreferrer">file</a> · {new Date(r.at).toLocaleDateString()}{r.note ? ` — ${r.note}` : ''}
              </div>
            ))}
          </div>
        </details>
      )}
      {!open ? (
        <Button variant="ghost" className="btn-sm" onClick={() => setOpen(true)}>Request revision from author</Button>
      ) : (
        <div className="info-block">
          <Field label="What should the author revise?">
            <textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. add controls, clarify methods…" />
          </Field>
          <div className="row">
            <Button className="btn-sm" disabled={busy || !note.trim()} onClick={() => run(() => api.requestRevision(paper.id, note))}>
              Send request
            </Button>
            <Button variant="ghost" className="btn-sm" onClick={() => setOpen(false)}>Cancel</Button>
          </div>
        </div>
      )}
    </div>
  );
}

// Internal editor discussion thread (visible to every editor on the paper).
function CommentThread({ paper }) {
  const [comments, setComments] = useState(paper.comments || []);
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);

  const post = async () => {
    if (!body.trim()) return;
    setBusy(true);
    try {
      const c = await api.addComment(paper.id, body);
      setComments((cs) => [...cs, c]);
      setBody('');
    } catch {
      /* ignore */
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <h4 style={{ margin: '0 0 0.5rem' }}>Discussion ({comments.length})</h4>
      {comments.length === 0 && <p className="muted">No comments yet — start the discussion.</p>}
      <div className="stack">
        {comments.map((c) => (
          <div key={c.id} className="info-block">
            <div className="row" style={{ gap: '0.4rem' }}>
              {c.role && <Badge tone="gray">{ROLE_LABEL[c.role] || c.role}</Badge>}
              <strong>{c.authorName}</strong>
              <span className="muted" style={{ marginLeft: 'auto', fontSize: '0.75rem' }}>
                {new Date(c.at).toLocaleString()}
              </span>
            </div>
            <div style={{ marginTop: '0.25rem' }}>{c.body}</div>
          </div>
        ))}
      </div>
      <div className="row" style={{ marginTop: '0.6rem' }}>
        <input value={body} onChange={(e) => setBody(e.target.value)} placeholder="Add a comment…" onKeyDown={(e) => e.key === 'Enter' && post()} />
        <Button className="btn-sm" disabled={busy || !body.trim()} onClick={post}>Post</Button>
      </div>
    </div>
  );
}

// Shared read-only paper details extracted from the submission sheet.
function PaperInfo({ paper, showAuthor }) {
  return (
    <>
      <p style={{ color: 'var(--body)', lineHeight: 1.6 }}>{paper.abstract}</p>
      {/* Author identity — email + Discord — shown from the Associate stage
          onward. Hidden from reviews editors to keep the screen single-blind. */}
      {showAuthor ? (
        <div className="info-block">
          <strong>Author:</strong> {paper.authorName}
          {paper.authorEmail && (
            <>
              {' · '}
              <strong>Email:</strong> <a href={`mailto:${paper.authorEmail}`}>{paper.authorEmail}</a>
            </>
          )}
          {paper.authorDiscord && (
            <>
              {' · '}
              <strong>Discord:</strong> {paper.authorDiscord}
            </>
          )}
        </div>
      ) : (
        <div className="info-block muted">
          Author identity is hidden at the reviews stage (single-blind review).
        </div>
      )}
      <p>
        <a href={paper.pdfUrl} target="_blank" rel="noreferrer">
          <span className="icon-label"><Icon name="file-text" size={16} /> Open paper PDF (Google Drive)</span>
        </a>
      </p>
      {embedSrc(paper.pdfUrl) && <Embed url={paper.pdfUrl} height={420} title="Paper preview" />}

      {/* Full prior decision chain — role-tagged so senior/associate/chief can
          read every upstream decision, its feedback and recommendation. */}
      {paper.priorFeedback?.length > 0 && (
        <div className="info-block">
          <strong>Decision history</strong>
          {paper.priorFeedback.map((f, i) => (
            <div key={i} style={{ marginTop: '0.5rem', paddingTop: i ? '0.5rem' : 0, borderTop: i ? '1px solid var(--border)' : 'none' }}>
              <div className="row" style={{ gap: '0.4rem' }}>
                {f.role && <Badge tone="gray">{ROLE_LABEL[f.role] || f.role}</Badge>}
                <Badge tone={decisionTone(f.decision)}>{decisionWord(f.decision)}</Badge>
                <span className="muted">{f.editorName}</span>
              </div>
              {f.comments && <div style={{ marginTop: '0.25rem' }}>{f.comments}</div>}
              {f.recommendation && <div className="muted" style={{ marginTop: '0.2rem' }}>↑ Recommendation: {f.recommendation}</div>}
            </div>
          ))}
        </div>
      )}

      {/* Associate revision rounds + the chief's call (anything not already in
          priorFeedback) — keeps the chronological collaboration trail visible. */}
      {paper.feed?.some((f) => f.kind === 'round') && (
        <div className="info-block">
          <strong>Revision rounds</strong>
          {paper.feed.filter((f) => f.kind === 'round').map((f, i) => (
            <div key={i} className="muted" style={{ marginTop: '0.3rem' }}>
              <Badge tone="blue">round {f.round}</Badge> {f.editorName}{f.comments ? ` — ${f.comments}` : ''}
            </div>
          ))}
        </div>
      )}
    </>
  );
}

// One reviews editor's submitted decision, shown to the peer reviewer (live
// peer visibility, §5/§9.1) and on the senior's screen via priorFeedback.
function PeerReviewBlock({ coReview }) {
  if (!coReview) {
    return <p className="muted">The other reviews editor hasn’t submitted yet — their decision is <Badge tone="gray">pending</Badge>.</p>;
  }
  return (
    <div className="info-block">
      <div className="row" style={{ gap: '0.4rem' }}>
        <strong>Other reviews editor</strong>
        <Badge tone={decisionTone(coReview.decision)}>{decisionWord(coReview.decision)}</Badge>
      </div>
      {coReview.comments && <div style={{ marginTop: '0.3rem' }}>{coReview.comments}</div>}
      {coReview.recommendation && <div className="muted" style={{ marginTop: '0.2rem' }}>↑ Recommendation: {coReview.recommendation}</div>}
    </div>
  );
}

// --- Reviews editor: feedback + recommendation (rec only when approving) -----
function ReviewsForm({ paper, busy, run }) {
  const [comments, setComments] = useState('');
  const [recommendation, setRecommendation] = useState('');

  // Already decided → read-only summary + the peer's decision (visible in History).
  if (paper.myReview) {
    return (
      <div>
        <p className="muted">
          You submitted your decision (
          <Badge tone={decisionTone(paper.myReview.decision)}>{decisionWord(paper.myReview.decision)}</Badge>). A paper
          advances only when both reviews editors approve.
        </p>
        <PeerReviewBlock coReview={paper.coReview} />
      </div>
    );
  }

  const submit = (decision) =>
    run(() => api.review(paper.id, { decision, comments, recommendation }));

  return (
    <>
      <h4 style={{ margin: '0 0 0.5rem' }}>Your decision</h4>
      <PeerReviewBlock coReview={paper.coReview} />
      <Field label="Feedback (required)">
        <textarea value={comments} onChange={(e) => setComments(e.target.value)} placeholder="Comments on the paper…" />
      </Field>
      <Field label="Recommendation to advance (required only when approving)">
        <textarea
          value={recommendation}
          onChange={(e) => setRecommendation(e.target.value)}
          placeholder="Why should this advance?"
        />
      </Field>
      <DecisionButtons
        busy={busy}
        canApprove={comments.trim() && recommendation.trim()}
        canReject={comments.trim()}
        onApprove={() => submit('approve')}
        onReject={() => submit('reject')}
      />
    </>
  );
}

// --- Senior editor: screening + final check (feedback only, no recommendation) ---
function SeniorForm({ paper, busy, run }) {
  const [comments, setComments] = useState('');
  const submit = (decision) => run(() => api.senior(paper.id, { decision, comments }));
  return (
    <>
      <h4 style={{ margin: '0 0 0.5rem' }}>Your decision</h4>
      <p className="muted" style={{ marginTop: 0 }}>
        Approving sends the paper forward; rejecting declines it and notifies the Director. The full reviews chain is shown above.
      </p>
      <Field label="Feedback (required)">
        <textarea value={comments} onChange={(e) => setComments(e.target.value)} placeholder="Your assessment…" />
      </Field>
      <DecisionButtons
        busy={busy}
        canApprove={comments.trim()}
        canReject={comments.trim()}
        onApprove={() => submit('approve')}
        onReject={() => submit('reject')}
      />
    </>
  );
}

// --- Associate editor: log revision rounds (2 total) ------------------------
function AssociateForm({ paper, busy, run }) {
  const [note, setNote] = useState('');
  const rounds = paper.associateRounds || 0;
  const done = rounds >= 2;
  const isFinalRound = rounds + 1 >= 2;
  return (
    <>
      <h4 style={{ margin: '0 0 0.5rem' }}>Revision rounds</h4>
      <div className="info-block">
        <strong>{rounds} of 2 rounds completed</strong>
        <div className="progress" style={{ marginTop: '0.5rem' }}>
          <span style={{ width: `${(rounds / 2) * 100}%` }} />
        </div>
      </div>
      <p className="muted">Email the author (shown above) to run each revision round, then log it here. No approve/reject at this stage — it’s a collaboration step.</p>
      {done ? (
        <p className="muted">Both rounds complete — this paper has moved to the senior editor’s final check.</p>
      ) : (
        <>
          <Field label="Round note (optional)">
            <textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="What changed this round?" />
          </Field>
          <Button disabled={busy} onClick={() => run(() => api.associateRound(paper.id, { note }))}>
            {isFinalRound ? 'Complete final round & send to senior editor' : `Complete round ${rounds + 1}`}
          </Button>
        </>
      )}
    </>
  );
}

// --- Editor-in-chief: final sign-off (feedback required) --------------------
function ChiefForm({ paper, busy, run }) {
  const [comments, setComments] = useState('');
  const submit = (decision) => run(() => api.chief(paper.id, { decision, comments }));
  return (
    <>
      <h4 style={{ margin: '0 0 0.5rem' }}>Final sign-off</h4>
      <p className="muted" style={{ marginTop: 0 }}>
        Approving sends the paper to the Director’s publish queue. The full history is shown above.
      </p>
      <Field label="Feedback (required)">
        <textarea value={comments} onChange={(e) => setComments(e.target.value)} placeholder="Your final assessment…" />
      </Field>
      <DecisionButtons
        busy={busy}
        canApprove={comments.trim()}
        canReject={comments.trim()}
        approveLabel="Approve for publication"
        onApprove={() => submit('approve')}
        onReject={() => submit('reject')}
      />
    </>
  );
}

function DecisionButtons({ busy, canApprove, canReject, onApprove, onReject, approveLabel = 'Approve' }) {
  return (
    <div className="row" style={{ marginTop: '0.5rem' }}>
      <Button variant="approve" disabled={busy || !canApprove} onClick={onApprove}>
        {approveLabel}
      </Button>
      <Button variant="reject" disabled={busy || !canReject} onClick={onReject}>
        Reject
      </Button>
    </div>
  );
}
