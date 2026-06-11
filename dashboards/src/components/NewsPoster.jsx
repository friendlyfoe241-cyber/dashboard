import { useState } from 'react';
import { api } from '../api.js';
import { Card, Button, Field } from './ui.jsx';
import { useToast } from './toast.jsx';

// Compose a global announcement. Render only for senior editors and up.
export default function NewsPoster({ onPosted }) {
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ title: '', body: '' });
  const [busy, setBusy] = useState(false);

  const post = async () => {
    setBusy(true);
    try {
      await api.postNews(form);
      setForm({ title: '', body: '' });
      setOpen(false);
      toast.success('Announcement posted');
      onPosted?.();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  };

  if (!open) {
    return (
      <Button variant="ghost" className="btn-sm" style={{ marginBottom: '1.5rem' }} onClick={() => setOpen(true)}>
        + Post announcement
      </Button>
    );
  }
  return (
    <Card style={{ marginBottom: '1.5rem' }}>
      <h3>Post an announcement</h3>
      <Field label="Title"><input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></Field>
      <Field label="Message"><textarea value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} /></Field>
      <div className="row">
        <Button className="btn-sm" disabled={busy || !form.title.trim() || !form.body.trim()} onClick={post}>Post</Button>
        <Button variant="ghost" className="btn-sm" onClick={() => setOpen(false)}>Cancel</Button>
      </div>
    </Card>
  );
}
