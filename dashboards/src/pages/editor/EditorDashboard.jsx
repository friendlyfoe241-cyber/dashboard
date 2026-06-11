import { useEffect, useState, useCallback, useMemo } from 'react';
import { api } from '../../api.js';
import { Card, Badge, Button, EmptyState } from '../../components/ui.jsx';
import { useAuth } from '../../auth.jsx';
import { useToast } from '../../components/toast.jsx';
import NewsFeed from '../../components/NewsFeed.jsx';
import NewsPoster from '../../components/NewsPoster.jsx';
import PaperModal from './PaperModal.jsx';

const CAN_POST_NEWS = ['senior', 'chief', 'director'];

const ROLE_TITLE = {
  reviews: 'Reviews Editor Queue',
  senior: 'Senior Editor Queue',
  associate: 'Associate Editor Queue',
  chief: 'Editor-in-Chief Queue',
  director: 'Director Queue',
};

const ROLE_SUB = {
  reviews: 'Two reviews editors must both approve before a paper advances.',
  senior: 'Screen incoming papers and run the final check before the editor-in-chief.',
  associate: 'Work revision rounds with authors — two rounds per paper.',
  chief: 'Give papers their final sign-off before they reach the Director.',
  director: 'Oversight of every paper in the pipeline.',
};

export default function EditorDashboard() {
  const { user } = useAuth();
  const toast = useToast();
  const [data, setData] = useState({ inbox: [], archive: [] });
  const [active, setActive] = useState(null); // paper open in modal
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState('newest');

  const inbox = useMemo(() => {
    let xs = data.inbox;
    if (query.trim()) {
      const q = query.toLowerCase();
      xs = xs.filter((p) => p.title.toLowerCase().includes(q) || p.authorName.toLowerCase().includes(q) || p.category.toLowerCase().includes(q));
    }
    const by = {
      newest: (a, b) => new Date(b.submittedAt) - new Date(a.submittedAt),
      oldest: (a, b) => new Date(a.submittedAt) - new Date(b.submittedAt),
      title: (a, b) => a.title.localeCompare(b.title),
      category: (a, b) => a.category.localeCompare(b.category),
    };
    return [...xs].sort(by[sort] || by.newest);
  }, [data.inbox, query, sort]);

  const load = useCallback((silent = false) => {
    if (!silent) setLoading(true);
    api
      .editorPapers()
      .then(setData)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  // Initial load + live polling so new papers/decisions appear without a reload.
  useEffect(() => {
    load();
    const t = setInterval(() => load(true), 15000);
    return () => clearInterval(t);
  }, [load]);

  // Refresh after any decision, and close the modal.
  const onActed = () => {
    setActive(null);
    load(true);
    toast.success('Saved');
  };

  if (loading) return <p className="muted">Loading your queue…</p>;

  return (
    <div>
      <h1 className="page-title">{ROLE_TITLE[user.role] || 'My Queue'}</h1>
      <p className="page-sub">{ROLE_SUB[user.role]}</p>
      {error && <div className="login-error">{error}</div>}

      <NewsFeed />
      {CAN_POST_NEWS.includes(user.role) && <NewsPoster />}

      <div className="row" style={{ margin: '0 0 1rem' }}>
        <input
          placeholder="Search title, author, subject…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          style={{ maxWidth: 320 }}
        />
        <select value={sort} onChange={(e) => setSort(e.target.value)} style={{ width: 'auto' }}>
          <option value="newest">Newest</option>
          <option value="oldest">Oldest</option>
          <option value="title">Title A–Z</option>
          <option value="category">Subject</option>
        </select>
      </div>

      <h2 className="section-title" style={{ marginBottom: '0.75rem' }}>
        To review <Badge tone="gray">{inbox.length}</Badge>
      </h2>
      {inbox.length === 0 ? (
        <EmptyState>{query ? 'No papers match your search.' : 'Nothing waiting on you right now. 🎉'}</EmptyState>
      ) : (
        <div className="grid grid-2">
          {inbox.map((p) => (
            <PaperCard key={p.id} paper={p} role={user.role} onOpen={() => setActive(p)} />
          ))}
        </div>
      )}

      {data.archive?.length > 0 && (
        <>
          <h2 className="section-title" style={{ margin: '2rem 0 0.75rem' }}>
            History <Badge tone="gray">{data.archive.length}</Badge>
          </h2>
          <div className="grid grid-2">
            {data.archive.map((p) => (
              <PaperCard key={p.id} paper={p} role={user.role} archived onOpen={() => setActive(p)} />
            ))}
          </div>
        </>
      )}

      {active && <PaperModal paper={active} role={user.role} onClose={() => setActive(null)} onActed={onActed} />}
    </div>
  );
}

function PaperCard({ paper, role, archived, onOpen }) {
  return (
    <Card className="paper-card">
      <div className="card-row">
        <Badge>{paper.category}</Badge>
        <span className="muted">#{paper.id.replace('paper_', '')}</span>
      </div>
      <h3>{paper.title}</h3>
      <p className="paper-meta">
        {paper.authorName} · {new Date(paper.submittedAt).toLocaleDateString()}
      </p>

      {/* Reviews editor: surface the co-reviewer's decision when present. */}
      {role === 'reviews' && !archived && paper.coReviewerDecision && (
        <p className="muted" style={{ marginBottom: '0.6rem' }}>
          Co-reviewer:{' '}
          <Badge tone={paper.coReviewerDecision === 'approve' ? 'green' : 'red'}>
            {paper.coReviewerDecision === 'approve' ? 'approved' : 'declined'}
          </Badge>
        </p>
      )}
      {role === 'associate' && (
        <p className="muted" style={{ marginBottom: '0.6rem' }}>
          Round {paper.associateRounds} of 2
        </p>
      )}

      <Button variant="ghost" className="btn-sm" onClick={onOpen}>
        See more
      </Button>
    </Card>
  );
}
