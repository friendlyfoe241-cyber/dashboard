// Drives imaginary papers through every path of the editorial pipeline against
// the in-memory store and asserts the transitions. Run: npm run test:workflow
import * as store from '../src/store.js';
import * as seed from '../src/seed.js';

let pass = 0, fail = 0;
const ok = (c, m) => (c ? (pass++, console.log(`  ✓ ${m}`)) : (fail++, console.error(`  ✗ ${m}`)));

const ed = (role, cat) => seed.editors.find((e) => e.role === role && (cat ? e.category === cat : true));
const sam = seed.researchers[0];
const rina = ed('reviews', 'Biology');
const marco = seed.editors.filter((e) => e.role === 'reviews' && e.category === 'Biology')[1];
const senior = ed('senior', 'Biology');
const assoc = ed('associate', 'Biology');
const chief = ed('chief');
const director = ed('director');

// Stage of a paper, read via the store's raw view through papersForEditor/director.
const stageOf = (pid) => {
  for (const role of ['reviews', 'senior', 'associate', 'chief']) {
    const e = seed.editors.find((x) => x.role === role && (role === 'chief' ? true : x.category === 'Biology'));
    const { inbox, archive } = store.papersForEditor(e.id);
    const hit = [...inbox, ...(archive || [])].find((p) => p.id === pid);
    if (hit) return hit.stage;
  }
  const dv = store.directorView();
  if (dv.toPublish.find((p) => p.id === pid)) return 'published';
  return 'rejected/unknown';
};

const newPaper = (title) =>
  store.submitToJournal({ userId: sam.id, title, category: 'Biology', abstract: 'Test abstract.', pdfUrl: 'https://drive.google.com/file/d/X/view' }).id;

await store.reset();

console.log('Path A — full acceptance to publication');
{
  const pid = store.papersForEditor(rina.id).inbox[0].id;
  store.submitReviewDecision({ paperId: pid, editorId: rina.id, decision: 'approve', comments: 'ok', recommendation: 'advance' });
  const mid = store.submitReviewDecision({ paperId: pid, editorId: marco.id, decision: 'approve', comments: 'ok', recommendation: 'advance' });
  ok(mid.stage === 'senior_screen', 'both reviewers approve -> senior_screen');
  store.seniorDecision({ paperId: pid, editorId: senior.id, decision: 'approve', comments: 'ok' });
  ok(stageOf(pid) === 'associate', 'senior screen approve -> associate');
  store.associateRound({ paperId: pid, editorId: assoc.id });
  const r2 = store.associateRound({ paperId: pid, editorId: assoc.id });
  ok(r2.stage === 'senior_final', '2 associate rounds -> senior_final');
  store.seniorDecision({ paperId: pid, editorId: senior.id, decision: 'approve', comments: 'ok' });
  ok(stageOf(pid) === 'chief', 'senior final approve -> chief');
  store.chiefDecision({ paperId: pid, decision: 'approve' });
  ok(store.directorView().toPublish.some((p) => p.id === pid), 'chief approve -> director publish queue');
  const pubCount = store.listPublications().length;
  store.publishToJournal({ paperId: pid });
  ok(store.listPublications().length === pubCount + 1, 'director publish -> +1 publication');
}

console.log('Path B — split review (one reject) -> declined');
{
  const pid = store.papersForEditor(rina.id).inbox[0].id;
  store.submitReviewDecision({ paperId: pid, editorId: rina.id, decision: 'approve', comments: 'ok', recommendation: 'advance' });
  const res = store.submitReviewDecision({ paperId: pid, editorId: marco.id, decision: 'reject', comments: 'insufficient controls' });
  ok(res.stage === 'rejected', 'reviewers disagree -> rejected');
  ok(store.directorView().toEmail.some((e) => e.decision === 'declined'), 'decline reaches director email queue');
}

console.log('Path C — passes review, senior screen rejects');
{
  const pid = newPaper('Senior-rejected paper');
  store.submitReviewDecision({ paperId: pid, editorId: rina.id, decision: 'approve', comments: 'ok', recommendation: 'go' });
  store.submitReviewDecision({ paperId: pid, editorId: marco.id, decision: 'approve', comments: 'ok', recommendation: 'go' });
  const res = store.seniorDecision({ paperId: pid, editorId: senior.id, decision: 'reject', comments: 'out of scope' });
  ok(res.stage === 'rejected', 'senior screen reject -> rejected');
}

console.log('Path D — revision loop');
{
  const pid = newPaper('Revision paper');
  store.requestRevision({ paperId: pid, editorId: rina.id, note: 'add controls' });
  ok(stageOf(pid) === 'review', 'revision request keeps it in review');
  const revised = store.addRevision({ paperId: pid, userId: sam.id, url: 'https://drive.google.com/file/d/V2/view', note: 'added controls' });
  ok(revised.revisions.length === 2 && revised.revisionRequested === false, 'author revision -> v2, flag cleared');
}

console.log('Path E — chief rejects at the end');
{
  const pid = newPaper('Chief-rejected paper');
  store.submitReviewDecision({ paperId: pid, editorId: rina.id, decision: 'approve', comments: 'ok', recommendation: 'go' });
  store.submitReviewDecision({ paperId: pid, editorId: marco.id, decision: 'approve', comments: 'ok', recommendation: 'go' });
  store.seniorDecision({ paperId: pid, editorId: senior.id, decision: 'approve', comments: 'ok' });
  store.associateRound({ paperId: pid, editorId: assoc.id });
  store.associateRound({ paperId: pid, editorId: assoc.id });
  store.seniorDecision({ paperId: pid, editorId: senior.id, decision: 'approve', comments: 'ok' });
  const res = store.chiefDecision({ paperId: pid, decision: 'reject' });
  ok(res.stage === 'rejected', 'chief reject at the end -> rejected');
}

console.log(`\nWORKFLOW TEST: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
