import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';
import { supabase, supabaseConfigured } from './supabase';

const BUCKET = 'hexagons';
const REGULAR_HEX_RATIO = Math.sqrt(3) / 2;

function useHashPage() {
  const getPage = () => (window.location.hash === '#/archives' ? 'archives' : 'home');
  const [page, setPage] = useState(getPage);

  useEffect(() => {
    const onHash = () => setPage(getPage());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  const go = (next) => {
    window.location.hash = next === 'archives' ? '#/archives' : '#/';
  };

  return [page, go];
}

function HexLogo() {
  return (
    <div className="hex-logo" aria-label="Logo du Meilleurgone">
      <span>6</span>
    </div>
  );
}

function Header({ page, go }) {
  return (
    <header className="site-header">
      <button className="brand" type="button" onClick={() => go('home')}>
        <HexLogo />
        <span className="brand-copy">
          <strong>LE MEILLEURGONE</strong>
          <small>Archives de la forme supérieure</small>
        </span>
      </button>
      <nav className="hex-nav" aria-label="Navigation principale">
        <button className={page === 'home' ? 'active' : ''} type="button" onClick={() => go('home')}>
          Accueil
        </button>
        <button className={page === 'archives' ? 'active' : ''} type="button" onClick={() => go('archives')}>
          Archives
        </button>
      </nav>
    </header>
  );
}

function Home({ go, count }) {
  return (
    <main className="home-page">
      <section className="hero">
        <div className="hero-kicker">SIX CÔTÉS. AUCUNE FAIBLESSE.</div>
        <h1>Tout est<br /><span>HEXAGONE.</span></h1>
        <p>
          Un musée vivant consacré aux manifestations du Meilleurgone. Chaque découverte rejoint la ruche,
          chaque création agrandit le canon.
        </p>
        <div className="hero-actions">
          <button className="hex-button primary" type="button" onClick={() => go('archives')}>
            Entrer dans les Archives
          </button>
          <div className="hex-counter" aria-label={`${count} hexagone${count > 1 ? 's' : ''} archivé${count > 1 ? 's' : ''}`}>
            <strong>{String(count).padStart(2, '0')}</strong>
            <span>archivé{count > 1 ? 's' : ''}</span>
          </div>
        </div>
      </section>

      <section className="manifesto" aria-label="Principes du site">
        <article className="mini-hex"><span>01</span><strong>Collecter</strong><p>Les hexagones croisés dans le monde.</p></article>
        <article className="mini-hex"><span>02</span><strong>Créer</strong><p>Les œuvres dédiées au Bestagone.</p></article>
        <article className="mini-hex"><span>03</span><strong>Canoniser</strong><p>Une archive commune qui grandit avec la blague.</p></article>
      </section>
    </main>
  );
}

function HexCard({ item, index, editMode, onDelete, position, size }) {
  return (
    <article
      className="archive-hex"
      role="listitem"
      style={{
        '--delay': `${Math.min(index * 45, 360)}ms`,
        width: `${size.width}px`,
        height: `${size.height}px`,
        transform: `translate3d(${position.x}px, ${position.y}px, 0)`,
      }}
    >
      <div className="archive-hex__border" aria-hidden="true" />
      <div className="archive-hex__inner">
        {editMode && (
          <button
            className="delete-hex"
            type="button"
            title="Supprimer cet hexagone"
            aria-label={`Supprimer ${item.title}`}
            onClick={() => onDelete(item)}
          >
            ×
          </button>
        )}
        <h2>{item.title}</h2>
        <div className="image-bevel">
          <img src={item.image_url} alt="" loading="lazy" />
        </div>
        <p>{item.description}</p>
      </div>
    </article>
  );
}

function AddHexCard({ onClick, position, size }) {
  return (
    <button
      className="archive-hex archive-hex--add"
      type="button"
      onClick={onClick}
      style={{
        width: `${size.width}px`,
        height: `${size.height}px`,
        transform: `translate3d(${position.x}px, ${position.y}px, 0)`,
      }}
    >
      <span className="archive-hex__border" aria-hidden="true" />
      <span className="archive-hex__inner add-inner">
        <span className="plus">+</span>
        <strong>Nouvel Hexagone</strong>
        <small>Image, titre, description</small>
      </span>
    </button>
  );
}

function useHoneycombLayout(count) {
  const shellRef = useRef(null);
  const [layout, setLayout] = useState({
    width: 360,
    height: 360 * REGULAR_HEX_RATIO,
    columns: 1,
    canvasWidth: 360,
    canvasHeight: 360 * REGULAR_HEX_RATIO,
    positions: [],
  });

  const recalculate = useCallback(() => {
    const shell = shellRef.current;
    if (!shell) return;

    const available = Math.max(280, shell.clientWidth - 24);
    let cardWidth = available < 520 ? Math.min(310, available) : available < 900 ? 320 : 360;
    cardWidth = Math.max(260, cardWidth);
    const cardHeight = cardWidth * REGULAR_HEX_RATIO;
    const xStep = cardWidth * 0.75;

    const columns = Math.max(1, Math.floor((available - cardWidth) / xStep) + 1);
    const positions = Array.from({ length: count }, (_, index) => {
      const col = index % columns;
      const row = Math.floor(index / columns);
      return {
        x: col * xStep,
        y: row * cardHeight + (col % 2 ? cardHeight / 2 : 0),
      };
    });

    const usedColumns = Math.min(columns, Math.max(1, count));
    const canvasWidth = cardWidth + Math.max(0, usedColumns - 1) * xStep;
    const canvasHeight = positions.length
      ? Math.max(...positions.map((position) => position.y)) + cardHeight
      : cardHeight;

    setLayout({ width: cardWidth, height: cardHeight, columns, canvasWidth, canvasHeight, positions });
  }, [count]);

  useEffect(() => {
    recalculate();
    const observer = new ResizeObserver(recalculate);
    if (shellRef.current) observer.observe(shellRef.current);
    return () => observer.disconnect();
  }, [recalculate]);

  return { shellRef, layout };
}

function Honeycomb({ items, editMode, onDelete, onAdd }) {
  const displayCount = items.length + (editMode ? 1 : 0);
  const { shellRef, layout } = useHoneycombLayout(displayCount);

  return (
    <div className="honeycomb-shell" ref={shellRef}>
      <div
        className="honeycomb"
        role="list"
        aria-label="Archives hexagonales"
        style={{ width: `${layout.canvasWidth}px`, height: `${layout.canvasHeight}px` }}
      >
        {items.map((item, index) => (
          <HexCard
            key={item.id}
            item={item}
            index={index}
            editMode={editMode}
            onDelete={onDelete}
            position={layout.positions[index] ?? { x: 0, y: 0 }}
            size={{ width: layout.width, height: layout.height }}
          />
        ))}
        {editMode && (
          <AddHexCard
            onClick={onAdd}
            position={layout.positions[items.length] ?? { x: 0, y: 0 }}
            size={{ width: layout.width, height: layout.height }}
          />
        )}
      </div>
    </div>
  );
}

function imageToBlob(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = reject;
    reader.onload = () => {
      const img = new Image();
      img.onerror = reject;
      img.onload = () => {
        const maxSize = 1600;
        const scale = Math.min(1, maxSize / Math.max(img.width, img.height));
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(img.width * scale));
        canvas.height = Math.max(1, Math.round(img.height * scale));
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        canvas.toBlob(
          (blob) => (blob ? resolve(blob) : reject(new Error('Impossible de préparer cette image.'))),
          'image/webp',
          0.84,
        );
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

function AddHexModal({ open, onClose, onCreate }) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const fileRef = useRef(null);

  useEffect(() => {
    if (!open) {
      setTitle('');
      setDescription('');
      setFile(null);
      setPreview('');
      setBusy(false);
      setError('');
    }
  }, [open]);

  useEffect(() => () => {
    if (preview.startsWith('blob:')) URL.revokeObjectURL(preview);
  }, [preview]);

  if (!open) return null;

  const onFile = (event) => {
    const nextFile = event.target.files?.[0];
    if (!nextFile) return;
    if (preview.startsWith('blob:')) URL.revokeObjectURL(preview);
    setFile(nextFile);
    setPreview(URL.createObjectURL(nextFile));
    setError('');
  };

  const submit = async (event) => {
    event.preventDefault();
    if (!title.trim() || !description.trim() || !file || busy) return;
    setBusy(true);
    setError('');
    try {
      await onCreate({ title: title.trim(), description: description.trim(), file });
      onClose();
    } catch (err) {
      setError(err.message || 'Impossible d’ajouter cet hexagone.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(e) => e.target === e.currentTarget && !busy && onClose()}>
      <section className="hex-modal" role="dialog" aria-modal="true" aria-labelledby="new-hex-title">
        <div className="hex-modal__border" aria-hidden="true" />
        <form className="hex-modal__content" onSubmit={submit}>
          <button className="modal-close" type="button" onClick={onClose} aria-label="Fermer" disabled={busy}>×</button>
          <p className="eyebrow">CANONISATION</p>
          <h2 id="new-hex-title">Créer un Hexagone</h2>

          <button className={`upload-zone ${preview ? 'has-image' : ''}`} type="button" onClick={() => fileRef.current?.click()} disabled={busy}>
            {preview ? <img src={preview} alt="Aperçu du nouvel hexagone" /> : <><span>+</span><strong>Importer l’image</strong></>}
          </button>
          <input ref={fileRef} className="sr-only" type="file" accept="image/jpeg,image/png,image/webp,image/gif" onChange={onFile} />

          <label className="bevel-field">
            <span>Titre</span>
            <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={48} placeholder="Le Saint Regard" disabled={busy} />
          </label>

          <label className="bevel-field">
            <span>Description</span>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} maxLength={180} rows="3" placeholder="Pourquoi cet hexagone mérite d’entrer dans les Archives…" disabled={busy} />
          </label>

          {error && <p className="form-error" role="alert">{error}</p>}
          <button className="hex-button primary modal-submit" type="submit" disabled={busy || !title.trim() || !description.trim() || !file}>
            {busy ? 'Envoi vers la ruche…' : 'Ajouter aux Archives'}
          </button>
        </form>
      </section>
    </div>
  );
}

function AuthModal({ open, onClose, onAuthenticated }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) {
      setPassword('');
      setError('');
      setBusy(false);
    }
  }, [open]);

  if (!open) return null;

  const submit = async (event) => {
    event.preventDefault();
    if (!supabase) return;
    setBusy(true);
    setError('');
    try {
      const { data, error: signInError } = await supabase.auth.signInWithPassword({ email, password });
      if (signInError) throw signInError;

      const { data: adminRow, error: adminError } = await supabase
        .from('bestagone_admins')
        .select('user_id')
        .eq('user_id', data.user.id)
        .maybeSingle();

      if (adminError) throw adminError;
      if (!adminRow) {
        await supabase.auth.signOut();
        throw new Error('Ce compte n’est pas autorisé à modifier les Archives.');
      }

      onAuthenticated(data.user);
      onClose();
    } catch (err) {
      setError(err.message || 'Connexion impossible.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(e) => e.target === e.currentTarget && !busy && onClose()}>
      <section className="auth-panel" role="dialog" aria-modal="true" aria-labelledby="auth-title">
        <button className="modal-close auth-close" type="button" onClick={onClose} aria-label="Fermer" disabled={busy}>×</button>
        <p className="eyebrow">ACCÈS AUX ARCHIVES</p>
        <h2 id="auth-title">Mode édition</h2>
        <form onSubmit={submit}>
          <label className="bevel-field">
            <span>E-mail</span>
            <input type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required disabled={busy} />
          </label>
          <label className="bevel-field">
            <span>Mot de passe</span>
            <input type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required disabled={busy} />
          </label>
          {error && <p className="form-error" role="alert">{error}</p>}
          <button className="hex-button primary modal-submit" type="submit" disabled={busy || !email || !password}>
            {busy ? 'Vérification…' : 'Entrer en édition'}
          </button>
        </form>
      </section>
    </div>
  );
}

function Archives({ items, loading, reload, user, isAdmin, setUser, setIsAdmin }) {
  const [editMode, setEditMode] = useState(false);
  const [adding, setAdding] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);
  const [notice, setNotice] = useState('');

  useEffect(() => {
    if (!isAdmin) setEditMode(false);
  }, [isAdmin]);

  const toggleEdit = () => {
    if (!supabaseConfigured) {
      setNotice('Supabase n’est pas configuré. Ajoute les variables VITE_SUPABASE_URL et VITE_SUPABASE_PUBLISHABLE_KEY.');
      return;
    }
    if (!isAdmin) {
      setAuthOpen(true);
      return;
    }
    setEditMode((value) => !value);
  };

  const onDelete = async (item) => {
    if (!supabase || !isAdmin) return;
    if (!window.confirm(`Supprimer « ${item.title} » des Archives ?`)) return;

    const { error } = await supabase.from('hexagons').delete().eq('id', item.id);
    if (error) {
      setNotice(error.message);
      return;
    }

    if (item.image_path) {
      const { error: storageError } = await supabase.storage.from(BUCKET).remove([item.image_path]);
      if (storageError) console.warn('Image non supprimée du stockage :', storageError.message);
    }

    await reload();
  };

  const onCreate = async ({ title, description, file }) => {
    if (!supabase || !isAdmin) throw new Error('Mode édition non autorisé.');

    const blob = await imageToBlob(file);
    const path = `${user.id}/${crypto.randomUUID()}.webp`;
    const { error: uploadError } = await supabase.storage.from(BUCKET).upload(path, blob, {
      contentType: 'image/webp',
      cacheControl: '31536000',
      upsert: false,
    });
    if (uploadError) throw uploadError;

    const { data: publicData } = supabase.storage.from(BUCKET).getPublicUrl(path);
    const imageUrl = publicData.publicUrl;

    const { error: insertError } = await supabase.from('hexagons').insert({
      title,
      description,
      image_url: imageUrl,
      image_path: path,
      created_by: user.id,
    });

    if (insertError) {
      await supabase.storage.from(BUCKET).remove([path]);
      throw insertError;
    }

    await reload();
  };

  const signOut = async () => {
    if (supabase) await supabase.auth.signOut();
    setEditMode(false);
    setIsAdmin(false);
    setUser(null);
  };

  return (
    <main className="archives-page">
      <div className="archive-controls">
        {notice && <button className="notice-chip" type="button" onClick={() => setNotice('')} title="Fermer">{notice}</button>}
        {isAdmin && user && <button className="session-chip" type="button" onClick={signOut}>Déconnexion</button>}
        <button className={`edit-toggle ${editMode ? 'on' : ''}`} type="button" onClick={toggleEdit}>
          <span className="switch-hex"><i /></span>
          <span><strong>Mode édition</strong><small>{editMode ? 'Activé' : isAdmin ? 'Désactivé' : 'Connexion requise'}</small></span>
        </button>
      </div>

      {loading ? (
        <div className="archive-loading">CHARGEMENT DE LA RUCHE…</div>
      ) : (
        <Honeycomb items={items} editMode={editMode} onDelete={onDelete} onAdd={() => setAdding(true)} />
      )}

      <AddHexModal open={adding} onClose={() => setAdding(false)} onCreate={onCreate} />
      <AuthModal
        open={authOpen}
        onClose={() => setAuthOpen(false)}
        onAuthenticated={(nextUser) => {
          setUser(nextUser);
          setIsAdmin(true);
          setEditMode(true);
        }}
      />
    </main>
  );
}

function App() {
  const [page, go] = useHashPage();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);

  const loadHexagons = useCallback(async () => {
    if (!supabase) {
      setItems([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const { data, error } = await supabase.from('hexagons').select('*').order('created_at', { ascending: true });
    if (error) {
      console.error(error);
      setItems([]);
    } else {
      setItems(data ?? []);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    loadHexagons();
  }, [loadHexagons]);

  useEffect(() => {
    if (!supabase) return undefined;

    const checkSession = async () => {
      const { data } = await supabase.auth.getSession();
      const sessionUser = data.session?.user ?? null;
      setUser(sessionUser);
      if (!sessionUser) {
        setIsAdmin(false);
        return;
      }
      const { data: adminRow } = await supabase
        .from('bestagone_admins')
        .select('user_id')
        .eq('user_id', sessionUser.id)
        .maybeSingle();
      setIsAdmin(Boolean(adminRow));
    };

    checkSession();
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (!session?.user) setIsAdmin(false);
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  const count = useMemo(() => items.length, [items]);

  return (
    <div className="app-shell">
      <div className="background-grid" aria-hidden="true" />
      <Header page={page} go={go} />
      {page === 'archives' ? (
        <Archives
          items={items}
          loading={loading}
          reload={loadHexagons}
          user={user}
          isAdmin={isAdmin}
          setUser={setUser}
          setIsAdmin={setIsAdmin}
        />
      ) : (
        <Home go={go} count={count} />
      )}
      <footer>
        <span>LES ARCHIVES DU MEILLEURGONE</span>
        <span>6 CÔTÉS · 1 VÉRITÉ</span>
      </footer>
    </div>
  );
}

createRoot(document.getElementById('root')).render(<App />);
