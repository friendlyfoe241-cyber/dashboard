import { useEffect, useState } from 'react';
import { api } from '../api.js';
import { useAuth } from '../auth.jsx';
import { EXP_ANCHORS, LEAD_ANCHORS, anchorFor } from '../onboardingScales.js';

const FLAG = 'synthica.onboarded.v1';
const INTEREST_OPTIONS = [
  'Biology', 'Chemistry', 'Physics', 'Mathematics', 'Computer Science', 'Economics', 'Psychology', 'Humanities',
  'Machine Learning', 'Climate', 'Neuroscience', 'Robotics', 'Genetics', 'Astronomy', 'Public Health', 'Data Science',
];
const SUBJECTS = ['Biology', 'Chemistry', 'Physics', 'Mathematics', 'Computer Science', 'Humanities', 'Economics', 'Psychology'];

// One-question-at-a-time, animated onboarding (Duolingo-style). Researchers only,
// shown once until completed. Collects interests + institution and walks any
// chapter onboarding steps.
export default function OnboardingWizard() {
  const { user, refreshUser } = useAuth();
  const [show, setShow] = useState(false);
  const [step, setStep] = useState(0);
  const [anim, setAnim] = useState('in');
  const [interests, setInterests] = useState(user?.interests || []);
  const [institution, setInstitution] = useState(user?.institution || '');
  const [gpa, setGpa] = useState(user?.gpa || '');
  const [experience, setExperience] = useState(user?.researchExperience ?? 5);
  const [leadership, setLeadership] = useState(user?.leadershipExperience ?? 3);
  const [wantsLead, setWantsLead] = useState(user?.wantsChapterLead ?? false);
  const [pastPapers, setPastPapers] = useState([]);
  const [paper, setPaper] = useState({ title: '', category: SUBJECTS[0], pdfUrl: '', doi: '' });
  const [chapter, setChapter] = useState(null);
  const [busy, setBusy] = useState(false);

  const leadRecommended = Number(experience) >= 8;

  useEffect(() => {
    // Onboarding is for new researchers only — staff / admins skip it entirely.
    const staffRole = ['admin', 'director', 'auditor', 'chief', 'senior', 'reviews', 'associate'].includes(user?.role);
    if (user?.kind !== 'researcher' || staffRole) return;
    // Durable: once completed/skipped on the account, never re-show (any device).
    if (user?.onboarded) return;
    try { if (localStorage.getItem(FLAG)) return; } catch { /* ignore */ }
    api.onboarding().then(setChapter).catch(() => setChapter(null));
    setShow(true);
  }, [user]);

  if (!show || !user) return null;

  const chapterSteps = chapter?.steps || [];
  // Most members answer interests/scores during the pending-approval intake, so
  // only ask here for anything still missing — keeps the wizard short post-approval.
  const steps = [
    { key: 'welcome' },
    ...(user?.interests?.length ? [] : [{ key: 'interests' }]),
    ...(user?.institution ? [] : [{ key: 'institution' }]),
    ...(user?.gpa ? [] : [{ key: 'gpa' }]),
    ...(user?.researchExperience != null ? [] : [{ key: 'experience' }]),
    ...(user?.leadershipExperience != null ? [] : [{ key: 'leadership' }]),
    { key: 'papers' },
    ...chapterSteps.map((s) => ({ key: `chapter:${s.key}`, step: s })),
    { key: 'finish' },
  ];
  const total = steps.length;
  const cur = steps[step];

  const go = (dir) => {
    setAnim('out');
    setTimeout(() => {
      setStep((s) => Math.min(Math.max(s + dir, 0), total - 1));
      setAnim('in');
    }, 160);
  };

  const toggleInterest = (i) => setInterests((xs) => (xs.includes(i) ? xs.filter((x) => x !== i) : [...xs, i]));

  const finish = async () => {
    setBusy(true);
    try {
      // researchExperience ≥ 8 flags the user as a Lead Researcher candidate (server-side).
      // onboarded:true persists completion on the account so it never re-shows.
      await api.updateProfile({ interests, institution, gpa, researchExperience: Number(experience), leadershipExperience: Number(leadership), wantsChapterLead: wantsLead, onboarded: true });
      // Self-archive any past papers they listed (auditor verifies them later).
      for (const p of pastPapers) await api.addPastPaper(p).catch(() => {});
      // Mark "profile" onboarding step complete if this user is in a chapter.
      if (chapter) await api.onboardingStep('profile', true).catch(() => {});
      await refreshUser?.().catch(() => {});
    } catch { /* ignore */ }
    try { localStorage.setItem(FLAG, '1'); } catch { /* ignore */ }
    setBusy(false);
    setShow(false);
  };

  const markChapter = async (key) => {
    await api.onboardingStep(key, true).catch(() => {});
    go(1);
  };

  return (
    <div className="ob-overlay">
      <div className="ob-card">
        <div className="ob-progress">
          {steps.map((_, i) => <span key={i} className={i <= step ? 'on' : ''} />)}
        </div>
        <button className="ob-skip" onClick={finish}>Skip</button>

        <div className={`ob-step ob-${anim}`}>
          {cur.key === 'welcome' && (
            <>
              <div className="ob-emoji">👋</div>
              <h2>Welcome to <span className="yellow-text">Synthica</span>, {user.name.split(' ')[0]}!</h2>
              <p>Let's set up your profile in a few quick steps.</p>
              <button className="btn btn-primary ob-next" onClick={() => go(1)}>Let's go</button>
            </>
          )}

          {cur.key === 'interests' && (
            <>
              <h2>What are you into?</h2>
              <p>Pick a few topics — we'll personalize your feed.</p>
              <div className="ob-chips">
                {INTEREST_OPTIONS.map((i) => (
                  <button key={i} className={`ob-chip ${interests.includes(i) ? 'sel' : ''}`} onClick={() => toggleInterest(i)}>{i}</button>
                ))}
              </div>
              <div className="ob-actions">
                <button className="btn btn-ghost" onClick={() => go(-1)}>Back</button>
                <button className="btn btn-primary" disabled={!interests.length} onClick={() => go(1)}>Continue</button>
              </div>
            </>
          )}

          {cur.key === 'institution' && (
            <>
              <h2>Where do you study?</h2>
              <p>Your school or institution (optional).</p>
              <input className="ob-input" value={institution} onChange={(e) => setInstitution(e.target.value)} placeholder="e.g. Lincoln High School" autoFocus />
              <div className="ob-actions">
                <button className="btn btn-ghost" onClick={() => go(-1)}>Back</button>
                <button className="btn btn-primary" onClick={() => go(1)}>Continue</button>
              </div>
            </>
          )}

          {cur.key === 'gpa' && (
            <>
              <h2>What's your GPA?</h2>
              <p>Roughly is fine — it helps us match you to the right opportunities (optional).</p>
              <input className="ob-input" value={gpa} onChange={(e) => setGpa(e.target.value)} placeholder="e.g. 3.8" autoFocus />
              <div className="ob-actions">
                <button className="btn btn-ghost" onClick={() => go(-1)}>Back</button>
                <button className="btn btn-primary" onClick={() => go(1)}>Continue</button>
              </div>
            </>
          )}

          {cur.key === 'experience' && (
            <>
              <h2>How much research experience do you have?</h2>
              <p>Rate yourself 0–10. Here's roughly what the numbers mean:</p>
              <div className="ob-range">
                <input type="range" min="0" max="10" step="1" value={experience} onChange={(e) => setExperience(Number(e.target.value))} autoFocus />
                <div className="ob-range-val">{experience} / 10</div>
              </div>
              <div className="ob-anchor">{anchorFor(EXP_ANCHORS, experience)}</div>
              <div className="ob-legend">
                <span><b>2</b> · school science projects</span>
                <span><b>7</b> · science fair at state level</span>
                <span><b>10</b> · won ISEF / accepted to RSI</span>
              </div>
              {leadRecommended && (
                <p className="ob-rec">🌟 With that experience, we'll recommend you to lead a project!</p>
              )}
              <div className="ob-actions">
                <button className="btn btn-ghost" onClick={() => go(-1)}>Back</button>
                <button className="btn btn-primary" onClick={() => go(1)}>Continue</button>
              </div>
            </>
          )}

          {cur.key === 'leadership' && (
            <>
              <h2>Do you want to lead a chapter?</h2>
              <p>Chapter leads start and run a local Synthica chapter — recruiting members and organizing research where they live.</p>
              <div className="ob-actions" style={{ justifyContent: 'center', marginBottom: '1rem' }}>
                <button className={`btn ${wantsLead ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setWantsLead(true)}>Yes, I'd like to</button>
                <button className={`btn ${!wantsLead ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setWantsLead(false)}>Not right now</button>
              </div>
              <p style={{ marginBottom: '0.3rem' }}>How much leadership experience do you have?</p>
              <div className="ob-range">
                <input type="range" min="0" max="10" step="1" value={leadership} onChange={(e) => setLeadership(Number(e.target.value))} />
                <div className="ob-range-val">{leadership} / 10</div>
              </div>
              <div className="ob-anchor">{anchorFor(LEAD_ANCHORS, leadership)}</div>
              <div className="ob-legend">
                <span><b>2</b> · helped organize a club</span>
                <span><b>6</b> · led a team of 5+</span>
                <span><b>10</b> · founded an organization</span>
              </div>
              {wantsLead && leadership >= 6 && (
                <p className="ob-rec">🚀 We'll flag you to an auditor as a Chapter Leader candidate.</p>
              )}
              <div className="ob-actions">
                <button className="btn btn-ghost" onClick={() => go(-1)}>Back</button>
                <button className="btn btn-primary" onClick={() => go(1)}>Continue</button>
              </div>
            </>
          )}

          {cur.key === 'papers' && (
            <>
              <h2>Published anything already?</h2>
              <p>Add past papers to your profile — you can verify more later in My Journal.</p>
              {pastPapers.length > 0 && (
                <div className="ob-paper-list">
                  {pastPapers.map((p, i) => (
                    <div key={i} className="ob-paper-row">
                      <span>{p.title} <span className="muted">· {p.category}</span></span>
                      <button className="link-btn" onClick={() => setPastPapers((xs) => xs.filter((_, j) => j !== i))} aria-label="Remove">✕</button>
                    </div>
                  ))}
                </div>
              )}
              <input className="ob-input" value={paper.title} onChange={(e) => setPaper({ ...paper, title: e.target.value })} placeholder="Paper title" style={{ marginBottom: '0.5rem' }} />
              <div className="row" style={{ gap: '0.4rem', marginBottom: '0.5rem' }}>
                <select value={paper.category} onChange={(e) => setPaper({ ...paper, category: e.target.value })} style={{ width: 'auto' }}>
                  {SUBJECTS.map((c) => <option key={c}>{c}</option>)}
                </select>
                <input value={paper.doi} onChange={(e) => setPaper({ ...paper, doi: e.target.value })} placeholder="DOI / arXiv (optional)" style={{ flex: 1 }} />
              </div>
              <input className="ob-input" value={paper.pdfUrl} onChange={(e) => setPaper({ ...paper, pdfUrl: e.target.value })} placeholder="Link to paper (optional)" style={{ marginBottom: '0.6rem' }} />
              <button
                className="btn btn-ghost"
                disabled={!paper.title.trim()}
                onClick={() => { setPastPapers((xs) => [...xs, paper]); setPaper({ title: '', category: SUBJECTS[0], pdfUrl: '', doi: '' }); }}
              >+ Add this paper</button>
              <div className="ob-actions" style={{ marginTop: '0.6rem' }}>
                <button className="btn btn-ghost" onClick={() => go(-1)}>Back</button>
                <button className="btn btn-primary" onClick={() => go(1)}>{pastPapers.length ? 'Continue' : 'Skip for now'}</button>
              </div>
            </>
          )}

          {cur.step && (
            <>
              <div className="ob-emoji">✅</div>
              <h2>{cur.step.label}</h2>
              <p>Tick this off once you've done it.</p>
              <div className="ob-actions">
                <button className="btn btn-ghost" onClick={() => go(-1)}>Back</button>
                <button className="btn btn-ghost" onClick={() => go(1)}>Later</button>
                <button className="btn btn-primary" onClick={() => markChapter(cur.step.key)}>Done ✓</button>
              </div>
            </>
          )}

          {cur.key === 'finish' && (
            <>
              <div className="ob-emoji">{leadRecommended ? '🌟' : '🎉'}</div>
              <h2>{leadRecommended ? "You're a Lead candidate!" : "You're all set!"}</h2>
              {leadRecommended ? (
                <p>Based on your experience, we recommend you to lead a project. You'll see a prompt on your dashboard to apply.</p>
              ) : (
                <p>Your feed is personalized. Explore projects, draft your research, and join the community.</p>
              )}
              <button className="btn btn-primary ob-next" disabled={busy} onClick={finish}>{busy ? 'Saving…' : 'Enter Synthica'}</button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
