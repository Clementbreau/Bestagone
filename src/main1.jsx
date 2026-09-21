import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';
import { supabase, supabaseConfigured } from './supabase';
import Art from './Art';
import ImageLightbox from './ImageLightbox';

const BUCKET = 'hexagons';
const REGULAR_HEX_RATIO = Math.sqrt(3) / 2;

function useHashPage() {
  const getPage = () => {
    if (window.location.hash === '#/archives') return 'archives';
    if (window.location.hash === '#/art') return 'art';
    return 'home';
  };
  const [page, setPage] = useState(getPage);

  useEffect(() => {
    const onHash = () => setPage(getPage());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  const go = (next) => {
    const routes = {
      home: '#/',
      archives: '#/archives',
      art: '#/art',
    };
    window.location.hash = routes[next] ?? '#/';
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
          <small>le savoir a 6 cotés</small>
        </span>
      </button>
      <nav className="hex-nav" aria-label="Navigation principale">
        <button className={page === 'home' ? 'active' : ''} type="button" onClick={() => go('home')}>
          Accueil
        </button>
        <button className={page === 'archives' ? 'active' : ''} type="button" onClick={() => go('archives')}>
          Archives
        </button>
        <button className={page === 'art' ? 'active' : ''} type="button" onClick={() => go('art')}>
          Art
        </button>
      </nav>
    </header>
  );
}

function Home({ go, count }) {
  return (
    <main className="home-page">
      <section className="hero">
        <h1>Tout est<br /><span>HEXAGONE.</span></h1>
        <p>
          Un musée répertoriant l'apogée de l'hexagone sous toutes ses formes.<br></br>
        <strong>Honorandus et venerandus est.</strong>
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
        <article className="mini-hex"><span>03</span><strong>Canoniser</strong><p>Une archive commune qui grandit.</p></article>
      </section>
    </main>
  );
}

function HexCard({ item, index, editMode, onDelete, onOpen, position, size }) {
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
        <button
          className="image-bevel archive-image-open"
          type="button"
          onClick={() => onOpen(item)}
          aria-label={`Ouvrir ${item.title} en plein écran`}
        >
          <img src={item.image_url} alt="" loading="lazy" />
        </button>
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

function Honeycomb({ items, editMode, onDelete, onAdd, onOpen }) {
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
            onOpen={onOpen}
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


function Archives({ items, loading, reload }) {
  const [editMode, setEditMode] = useState(false);
  const [adding, setAdding] = useState(false);
  const [notice, setNotice] = useState('');
  const [selectedHexagon, setSelectedHexagon] = useState(null);

  const toggleEdit = () => {
    if (!supabaseConfigured) {
      setNotice(
        'Supabase n’est pas configuré. Vérifie VITE_SUPABASE_URL et VITE_SUPABASE_PUBLISHABLE_KEY.'
      );
      return;
    }

    setEditMode((value) => !value);
  };

  const onDelete = async (item) => {
    if (!supabase) return;

    if (!window.confirm(`Supprimer « ${item.title} » des Archives ?`)) {
      return;
    }

    const { error } = await supabase
      .from('hexagons')
      .delete()
      .eq('id', item.id);

    if (error) {
      setNotice(error.message);
      return;
    }

    if (item.image_path) {
      const { error: storageError } = await supabase.storage
        .from(BUCKET)
        .remove([item.image_path]);

      if (storageError) {
        console.warn(
          'Image non supprimée du stockage :',
          storageError.message
        );
      }
    }

    await reload();
  };

  const onCreate = async ({ title, description, file }) => {
    if (!supabase) {
      throw new Error('Supabase n’est pas configuré.');
    }

    const blob = await imageToBlob(file);

    const path = `${crypto.randomUUID()}.webp`;

    const { error: uploadError } = await supabase.storage
      .from(BUCKET)
      .upload(path, blob, {
        contentType: 'image/webp',
        cacheControl: '31536000',
        upsert: false,
      });

    if (uploadError) throw uploadError;

    const { data: publicData } = supabase.storage
      .from(BUCKET)
      .getPublicUrl(path);

    const imageUrl = publicData.publicUrl;

    const { error: insertError } = await supabase
      .from('hexagons')
      .insert({
        title,
        description,
        image_url: imageUrl,
        image_path: path,
      });

    if (insertError) {
      await supabase.storage.from(BUCKET).remove([path]);
      throw insertError;
    }

    await reload();
  };

  return (
    <main className="archives-page">
      <div className="archive-controls">
        {notice && (
          <button
            className="notice-chip"
            type="button"
            onClick={() => setNotice('')}
            title="Fermer"
          >
            {notice}
          </button>
        )}

        <button
          className={`edit-toggle ${editMode ? 'on' : ''}`}
          type="button"
          onClick={toggleEdit}
        >
          <span className="switch-hex">
            <i />
          </span>

          <span>
            <strong>Mode édition</strong>
            <small>{editMode ? 'Activé' : 'Désactivé'}</small>
          </span>
        </button>
      </div>

      {loading ? (
        <div className="archive-loading">
          CHARGEMENT DE LA RUCHE…
        </div>
      ) : (
        <Honeycomb
          items={items}
          editMode={editMode}
          onDelete={onDelete}
          onAdd={() => setAdding(true)}
          onOpen={setSelectedHexagon}
        />
      )}

      <ImageLightbox
        item={selectedHexagon}
        onClose={() => setSelectedHexagon(null)}
      />

      <AddHexModal
        open={adding}
        onClose={() => setAdding(false)}
        onCreate={onCreate}
      />
    </main>
  );
}

function App() {
  const [page, go] = useHashPage();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadHexagons = useCallback(async () => {
    if (!supabase) {
      setItems([]);
      setLoading(false);
      return;
    }

    setLoading(true);

    const { data, error } = await supabase
      .from('hexagons')
      .select('*')
      .order('created_at', { ascending: true });

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
        />
      ) : page === 'art' ? (
        <Art />
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
