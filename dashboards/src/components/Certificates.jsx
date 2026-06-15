import { useEffect, useState } from 'react';
import { api } from '../api.js';
import { Card, Badge, Button, EmptyState } from '../components/ui.jsx';
import { useToast } from '../components/toast.jsx';

// Role certificates — same templates and typography as the official Synthica
// generator repos (AssociateResearcherGen / IndependentResearcherGen /
// LeadResearchGen), drawn on a canvas and downloaded as PNG. Each certificate
// carries a verification code anyone can check via /api/certificates/:code.

const CERT_META = {
  associate: { label: 'Associate Researcher', template: '/assets/certs/associate.jpg' },
  independent: { label: 'Independent Researcher', template: '/assets/certs/independent.jpg' },
  lead: { label: 'Lead Researcher', template: '/assets/certs/lead.jpg' },
};

async function renderCertificate({ type, name, code }) {
  const tmpl = new Image();
  tmpl.src = CERT_META[type].template;
  await new Promise((resolve, reject) => {
    tmpl.onload = resolve;
    tmpl.onerror = () => reject(new Error('Could not load the certificate template'));
  });
  await document.fonts.load('700 100px "Cinzel"').catch(() => {});
  await document.fonts.ready;

  const W = tmpl.naturalWidth;
  const H = tmpl.naturalHeight;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(tmpl, 0, 0, W, H);

  // Recipient name sits between "of recognition" and "This person is
  // recognized as:". Auto-shrinks so long names stay inside the slot.
  let size = Math.floor(W * 0.034);
  ctx.font = `700 ${size}px "Cinzel", serif`;
  while (ctx.measureText(name).width > W * 0.6 && size > 20) {
    size -= 2;
    ctx.font = `700 ${size}px "Cinzel", serif`;
  }
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#c9a84c';
  ctx.fillText(name, W / 2, H * 0.328);

  // Verification code, small, inside the bottom-right of the white card.
  ctx.font = `${Math.floor(W * 0.011)}px "Lato", sans-serif`;
  ctx.textAlign = 'right';
  ctx.fillStyle = '#9aa0a8';
  ctx.fillText(`Verify: ${code} · synthica.org`, W * 0.915, H * 0.885);

  return canvas.toDataURL('image/png');
}

export default function Certificates() {
  const [data, setData] = useState(null);
  const [busyType, setBusyType] = useState('');
  const toast = useToast();

  const [preview, setPreview] = useState(null);
  useEffect(() => { api.myCertificates().then(setData).catch(() => setData({ eligible: [], issued: [] })); }, []);

  // Generate (or re-fetch) the certificate and show a live preview; downloading
  // is a second click off that preview.
  const generate = async (type) => {
    setBusyType(type);
    try {
      const cert = await api.issueCertificate(type); // idempotent: same code every time
      const url = await renderCertificate({ type, name: cert.name, code: cert.code });
      setPreview({ type, code: cert.code, name: cert.name, url });
      toast.success(`Certificate ready — verification code ${cert.code}`);
      setData(await api.myCertificates());
    } catch (e) { toast.error(e.message); } finally { setBusyType(''); }
  };

  if (!data) return <div className="page-loading">Loading…</div>;
  const issuedFor = (type) => data.issued.find((c) => c.type === type);

  return (
    <div>
      <Card>
        <h2 className="section-title" style={{ marginBottom: '0.4rem' }}>Certificates</h2>
        <p className="login-hint" style={{ marginTop: 0 }}>
          Official recognition of your Synthica role — great for college apps and résumés.
          Every certificate has a verification code admissions officers can check.
        </p>
        {data.eligible.length === 0 && (
          <EmptyState>No certificates yet — they unlock when an auditor assigns you a researcher role (Associate, Independent, or Lead).</EmptyState>
        )}
        <div className="grid grid-3">
          {data.eligible.map((type) => {
            const cert = issuedFor(type);
            return (
              <Card key={type}>
                <h3 style={{ margin: '0 0 0.4rem' }}>🏅 {CERT_META[type].label}</h3>
                {cert
                  ? <p className="login-hint" style={{ margin: '0 0 0.6rem' }}>Issued {new Date(cert.issuedAt).toLocaleDateString()} · code <code>{cert.code}</code></p>
                  : <p className="login-hint" style={{ margin: '0 0 0.6rem' }}>Ready to generate.</p>}
                <Button disabled={busyType === type} onClick={() => generate(type)}>
                  {busyType === type ? 'Generating…' : cert ? 'Preview & download' : 'Generate'}
                </Button>
              </Card>
            );
          })}
        </div>

        {preview && (
          <div style={{ marginTop: '1.25rem' }}>
            <h3 style={{ margin: '0 0 0.5rem' }}>{CERT_META[preview.type].label} — preview</h3>
            <img
              src={preview.url}
              alt={`${CERT_META[preview.type].label} certificate for ${preview.name}`}
              style={{ width: '100%', maxWidth: 640, borderRadius: 12, boxShadow: '0 12px 32px rgba(4,30,66,0.18)', display: 'block' }}
            />
            <div className="row" style={{ marginTop: '0.75rem' }}>
              <a className="btn btn-primary btn-sm" href={preview.url} download={`Synthica ${CERT_META[preview.type].label} Certificate - ${preview.name}.png`}>Download PNG</a>
              <span className="login-hint">Verification code <code>{preview.code}</code></span>
            </div>
          </div>
        )}

        {data.issued.length > 0 && (
          <p className="login-hint" style={{ marginTop: '1rem', marginBottom: 0 }}>
            Verification: anyone can confirm a certificate by its code at <code>synthica.org/certificate.html</code>.
          </p>
        )}
      </Card>
    </div>
  );
}
