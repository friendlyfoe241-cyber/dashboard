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

  useEffect(() => { api.myCertificates().then(setData).catch(() => setData({ eligible: [], issued: [] })); }, []);

  const download = async (type) => {
    setBusyType(type);
    try {
      const cert = await api.issueCertificate(type); // idempotent: same code every time
      const url = await renderCertificate({ type, name: cert.name, code: cert.code });
      const a = document.createElement('a');
      a.href = url;
      a.download = `Synthica ${CERT_META[type].label} Certificate - ${cert.name}.png`;
      a.click();
      toast.success(`Certificate downloaded — verification code ${cert.code}`);
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
                <Button disabled={busyType === type} onClick={() => download(type)}>
                  {busyType === type ? 'Generating…' : cert ? 'Download again' : 'Generate & download'}
                </Button>
              </Card>
            );
          })}
        </div>
        {data.issued.length > 0 && (
          <p className="login-hint" style={{ marginBottom: 0 }}>
            Verification: anyone can confirm a certificate at <code>/api/certificates/&lt;code&gt;</code> on the Synthica API.
          </p>
        )}
      </Card>
    </div>
  );
}
