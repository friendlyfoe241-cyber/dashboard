// Certificate generator component - generates downloadable PNG certificates
// using Canvas to draw the user's name on the certificate template
import { useState } from 'react';
import { Button } from './ui.jsx';
import Icon from './Icon.jsx';

// Map of role tags to certificate folder paths
const CERT_PATHS = {
  lead_researcher: '/LeadResearchCertGen/certificate-template.jpg',
  associate_researcher: '/AssociateResearcherCertGen/certificate-template.jpg',
  chapter_leader: '/ChapterLeaderCertGen/certificate-template.jpg',
  independent_researcher: '/IndependentResearcherCertGen/certificate-template.jpg',
};

const CERT_TITLES = {
  lead_researcher: 'Lead Researcher',
  associate_researcher: 'Associate Researcher',
  chapter_leader: 'Chapter Leader',
  independent_researcher: 'Independent Researcher',
};

export default function CertificateGenerator({ user }) {
  const [generating, setGenerating] = useState(false);
  const [downloaded, setDownloaded] = useState(false);

  if (!user) return null;

  // Find which certificate(s) this user is eligible for
  const eligibleRoles = user.tags?.filter(tag => CERT_PATHS[tag]) || [];
  
  if (eligibleRoles.length === 0) return null;

  const generateCertificate = async (role) => {
    setGenerating(true);
    setDownloaded(false);
    
    try {
      const templatePath = CERT_PATHS[role];
      const certTitle = CERT_TITLES[role];
      
      // Load the template image
      const tmpl = new Image();
      tmpl.crossOrigin = 'anonymous';
      tmpl.src = templatePath;

      await new Promise((resolve, reject) => {
        tmpl.onload = resolve;
        tmpl.onerror = () => reject(new Error('Failed to load certificate template'));
      });

      // Wait for fonts to be ready
      await document.fonts.load('10px "Cinzel"');
      await document.fonts.ready;

      // Create canvas and draw
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');

      const W = tmpl.naturalWidth || 1920;
      const H = tmpl.naturalHeight || 1080;
      canvas.width = W;
      canvas.height = H;

      // Draw the template
      ctx.drawImage(tmpl, 0, 0, W, H);

      // Calculate font size proportionally
      let baseFontSize = Math.floor(W * 0.052);
      ctx.font = `700 ${baseFontSize}px Cinzel, serif`;
      
      // Auto-fit long names
      const maxTextWidth = W * 0.75;
      const name = user.name || 'User';
      while (ctx.measureText(name).width > maxTextWidth && baseFontSize > 24) {
        baseFontSize -= 4;
        ctx.font = `700 ${baseFontSize}px Cinzel, serif`;
      }

      // Center and draw the name
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = '#c9a84c'; // Gold color
      ctx.fillText(name, W / 2, H * 0.345);

      // Download the certificate
      const link = document.createElement('a');
      link.download = `${certTitle.replace(' ', '_')}_Certificate_${name.replace(/\s+/g, '_')}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();

      setDownloaded(true);
    } catch (err) {
      console.error('Certificate generation failed:', err);
      alert('Failed to generate certificate. Please try again.');
    } finally {
      setGenerating(false);
    }
  };

  return (
    <section style={{ marginBottom: '2rem' }}>
      <div className="section-head">
        <div className="section-badge">Certificates</div>
        <h2 className="section-title">Download your certificate</h2>
      </div>
      
      <div className="card" style={{ marginTop: '0.75rem' }}>
        <p className="muted" style={{ marginBottom: '1rem' }}>
          Download your official {eligibleRoles.length === 1 
            ? CERT_TITLES[eligibleRoles[0]] 
            : 'role'} certificate
        </p>
        
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
          {eligibleRoles.map(role => (
            <Button 
              key={role}
              variant="ghost"
              disabled={generating}
              onClick={() => generateCertificate(role)}
            >
              {generating ? 'Generating…' : downloaded ? <><Icon name="check" size={14} /> Downloaded</> : `Download ${CERT_TITLES[role]} Certificate`}
            </Button>
          ))}
        </div>
      </div>
    </section>
  );
}