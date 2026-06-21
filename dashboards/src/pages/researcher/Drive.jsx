import { useEffect, useMemo, useState } from 'react';
import { api } from '../../api.js';
import { EmptyState } from '../../components/ui.jsx';
import { embedSrc, fileMeta } from '../../files.js';
import Icon from '../../components/Icon.jsx';

// Synthica Drive — a real file-browser feel over everything you're working on.
// Folders derive from your projects (shared links) + a "My papers" folder from
// submissions and archived papers. Toolbar: back, path bar, view toggle.
export default function Drive() {
  const [projects, setProjects] = useState([]);
  const [subs, setSubs] = useState([]);
  const [pubs, setPubs] = useState([]);
  const [open, setOpen] = useState(null); // folder id
  const [view, setView] = useState(() => localStorage.getItem('synthica.drive.view') || 'grid');
  const [q, setQ] = useState('');
  const [preview, setPreview] = useState(null);

  useEffect(() => {
    api.myProjects().then(setProjects).catch(() => {});
    api.mySubmissions().then(setSubs).catch(() => {});
    api.myPublications().then(setPubs).catch(() => {});
  }, []);

  const setViewMode = (v) => { setView(v); try { localStorage.setItem('synthica.drive.view', v); } catch { /* ignore */ } };

  // Build the folder tree from live data — nothing to manage by hand.
  const folders = useMemo(() => {
    const f = projects.map((p) => ({
      id: p.id,
      name: p.title,
      sub: p.category,
      files: (p.links || []).map((l) => ({ id: l.id, name: l.label || l.url, url: l.url, at: l.at })),
    }));
    const paperFiles = [
      ...subs.flatMap((s) =>
        (s.revisions || []).map((r) => ({ id: `${s.id}v${r.version}`, name: `${s.title} (v${r.version})`, url: r.url, at: r.at }))),
      ...pubs.filter((p) => p.pdfUrl).map((p) => ({ id: p.id, name: p.title, url: p.pdfUrl, at: p.publishedAt })),
    ];
    if (paperFiles.length) f.push({ id: 'papers', name: 'My papers', sub: 'Submissions & archive', files: paperFiles });
    return f;
  }, [projects, subs, pubs]);

  const folder = folders.find((x) => x.id === open);
  const needle = q.trim().toLowerCase();
  const visibleFiles = folder
    ? folder.files.filter((file) => !needle || file.name.toLowerCase().includes(needle))
    : null;
  const visibleFolders = !folder
    ? folders.filter((fo) => !needle || fo.name.toLowerCase().includes(needle))
    : null;

  const openFile = (file) => {
    if (embedSrc(file.url)) setPreview(file);
    else window.open(file.url, '_blank', 'noopener');
  };

  return (
    <div>
      <h1 className="page-title">Synthica Drive</h1>
      <p className="page-sub">Every link your teams have shared, organized into project folders automatically.</p>

      <div className="fm">
        {/* toolbar */}
        <div className="fm-toolbar">
          <button className="fm-btn" disabled={!folder} onClick={() => { setOpen(null); setQ(''); }} title="Back" aria-label="Back">←</button>
          <div className="fm-path">
            <button className="fm-crumb" onClick={() => { setOpen(null); setQ(''); }}><span className="icon-label"><Icon name="folder-open" size={14} /> Drive</span></button>
            {folder && (
              <>
                <span className="fm-sep">/</span>
                <span className="fm-crumb fm-crumb-here"><span className="icon-label"><Icon name="folder" size={14} /> {folder.name}</span></span>
              </>
            )}
          </div>
          <input className="fm-search" placeholder={folder ? 'Search this folder' : 'Search folders'} value={q} onChange={(e) => setQ(e.target.value)} />
          <div className="seg fm-view">
            <button type="button" className={`seg-btn ${view === 'grid' ? 'on' : ''}`} onClick={() => setViewMode('grid')} title="Grid view"><Icon name="grid" size={16} /></button>
            <button type="button" className={`seg-btn ${view === 'list' ? 'on' : ''}`} onClick={() => setViewMode('list')} title="List view"><Icon name="list" size={16} /></button>
          </div>
        </div>

        {/* body */}
        <div className="fm-body">
          {!folder ? (
            visibleFolders.length === 0 ? (
              <EmptyState>No folders yet — join a project and its shared links will show up here.</EmptyState>
            ) : view === 'grid' ? (
              <div className="drive-grid">
                {visibleFolders.map((fo) => (
                  <button key={fo.id} className="drive-tile drive-folder" onDoubleClick={() => setOpen(fo.id)} onClick={() => setOpen(fo.id)}>
                    <span className="drive-icon"><Icon name="folder" size={32} /></span>
                    <span className="drive-name">{fo.name}</span>
                    <span className="muted drive-sub">{fo.files.length} item{fo.files.length === 1 ? '' : 's'}</span>
                  </button>
                ))}
              </div>
            ) : (
              <div className="fm-list">
                <div className="fm-row fm-row-head"><span>Name</span><span>Kind</span><span>Items</span><span /></div>
                {visibleFolders.map((fo) => (
                  <button key={fo.id} className="fm-row" onClick={() => setOpen(fo.id)}>
                    <span className="fm-name"><span className="icon-label"><Icon name="folder" size={16} /> {fo.name}</span></span>
                    <span className="muted">Folder · {fo.sub}</span>
                    <span className="muted">{fo.files.length}</span>
                    <span className="muted">›</span>
                  </button>
                ))}
              </div>
            )
          ) : visibleFiles.length === 0 ? (
            <EmptyState>{q ? 'No files match your search.' : "Nothing in this folder yet — add links from the project page and they'll appear here."}</EmptyState>
          ) : view === 'grid' ? (
            <div className="drive-grid">
              {visibleFiles.map((file) => {
                const meta = fileMeta(file.url);
                return (
                  <button key={file.id} className="drive-tile" title={file.url} onClick={() => openFile(file)}>
                    <span className="drive-icon"><Icon name={meta.icon} size={32} /></span>
                    <span className="drive-name">{file.name}</span>
                    <span className="muted drive-sub">{meta.kind}{embedSrc(file.url) ? ' · preview' : ''}</span>
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="fm-list">
              <div className="fm-row fm-row-head"><span>Name</span><span>Kind</span><span>Added</span><span /></div>
              {visibleFiles.map((file) => {
                const meta = fileMeta(file.url);
                return (
                  <button key={file.id} className="fm-row" onClick={() => openFile(file)} title={file.url}>
                    <span className="fm-name"><span className="icon-label"><Icon name={meta.icon} size={16} /> {file.name}</span></span>
                    <span className="muted">{meta.kind}</span>
                    <span className="muted">{file.at ? new Date(file.at).toLocaleDateString() : '—'}</span>
                    <span className="muted">{embedSrc(file.url) ? <Icon name="eye" size={14} /> : <Icon name="external-link" size={14} />}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* status bar */}
        <div className="fm-status">
          {folder
            ? `${visibleFiles.length} item${visibleFiles.length === 1 ? '' : 's'}${q ? ` matching “${q}”` : ''} · ${folder.sub}`
            : `${visibleFolders.length} folder${visibleFolders.length === 1 ? '' : 's'} · synced from your projects`}
        </div>
      </div>

      {preview && (
        <div className="drive-overlay" onClick={() => setPreview(null)}>
          <div className="drive-preview" onClick={(e) => e.stopPropagation()}>
            <div className="card-row" style={{ marginBottom: '0.6rem' }}>
              <strong style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                <span className="icon-label"><Icon name={fileMeta(preview.url).icon} size={16} /> {preview.name}</span>
              </strong>
              <span className="row" style={{ flexShrink: 0 }}>
                <a className="btn btn-ghost btn-sm" href={preview.url} target="_blank" rel="noreferrer"><span className="icon-label"><Icon name="external-link" size={14} /> Open</span></a>
                <button className="btn btn-ghost btn-sm" onClick={() => setPreview(null)}><Icon name="x" size={14} /></button>
              </span>
            </div>
            <iframe className="drive-frame" src={embedSrc(preview.url)} title={preview.name} loading="lazy" />
          </div>
        </div>
      )}
    </div>
  );
}
