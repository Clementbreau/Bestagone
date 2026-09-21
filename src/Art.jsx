import React, { useCallback, useEffect, useRef, useState } from 'react';
import { supabase, supabaseConfigured } from './supabase';
import './art.css';

const ART_TABLE = 'artworks';
const BUCKET = 'hexagons';
const REGULAR_HEX_RATIO = Math.sqrt(3) / 2;

function imageToBlob(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = reject;
    reader.onload = () => {
      const img = new Image();
      img.onerror = reject;
      img.onload = () => {
        const maxSize = 2200;
        const scale = Math.min(1, maxSize / Math.max(img.width, img.height));
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(img.width * scale));
        canvas.height = Math.max(1, Math.round(img.height * scale));
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        canvas.toBlob(
          (blob) => (blob ? resolve(blob) : reject(new Error('Impossible de préparer cette image.'))),
          'image/webp',
          0.9,
        );
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

function useArtHoneycombLayout(count) {
  const shellRef = useRef(null);
  const [layout, setLayout] = useState({
    width: 420,
    height: 420 * REGULAR_HEX_RATIO,
    columns: 1,
    canvasWidth: 420,
    canvasHeight: 420 * REGULAR_HEX_RATIO,
    positions: [],
  });

  const recalculate = useCallback(() => {
    const shell = shellRef.current;
    if (!shell) return;

    const available = Math.max(280, shell.clientWidth - 24);
    let cardWidth = available < 560 ? Math.min(330, available) : available < 980 ? 370 : 420;
    cardWidth = Math.max(270, cardWidth);

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

function ArtCard({ item, index, editMode, onDelete, onOpen, position, size }) {
  const openArtwork = () => onOpen(item);

  return (
    <article
      className="art-hex art-hex--openable"
      role="listitem"
      tabIndex={0}
      aria-label={`Ouvrir l’œuvre ${item.title}`}
      onClick={openArtwork}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          openArtwork();
        }
      }}
      style={{
        '--art-delay': `${Math.min(index * 55, 440)}ms`,
        width: `${size.width}px`,
        height: `${size.height}px`,
        transform: `translate3d(${position.x}px, ${position.y}px, 0)`,
      }}
    >
      <div className="art-hex__frame" aria-hidden="true" />
      <div className="art-hex__inner">
        <img className="art-hex__image" src={item.image_url} alt={item.title || 'Œuvre hexagonale'} loading="lazy" />
        <div className="art-hex__shade" aria-hidden="true" />

        {editMode && (
          <button
            className="art-delete"
            type="button"
            title="Supprimer cette œuvre"
            aria-label={`Supprimer ${item.title}`}
            onClick={(event) => {
              event.stopPropagation();
              onDelete(item);
            }}
          >
            ×
          </button>
        )}

        <div className="art-hex__caption">
          <span>ŒUVRE {String(index + 1).padStart(2, '0')}</span>
          <h2>{item.title}</h2>
          <p>{item.description}</p>
        </div>
      </div>
    </article>
  );
}

function AddArtCard({ onClick, position, size }) {
  return (
    <button
      className="art-hex art-hex--add"
      type="button"
      onClick={onClick}
      style={{
        width: `${size.width}px`,
        height: `${size.height}px`,
        transform: `translate3d(${position.x}px, ${position.y}px, 0)`,
      }}
    >
      <span className="art-hex__frame" aria-hidden="true" />
      <span className="art-hex__inner art-add-inner">
        <span className="art-add-plus">+</span>
        <strong>Nouvelle œuvre</strong>
        <small>Image, titre, description</small>
      </span>
    </button>
  );
}

function ArtHoneycomb({ items, editMode, onDelete, onAdd, onOpen }) {
  const displayCount = items.length + (editMode ? 1 : 0);
  const { shellRef, layout } = useArtHoneycombLayout(displayCount);

  return (
    <div className="art-honeycomb-shell" ref={shellRef}>
      <div
        className="art-honeycomb"
        role="list"
        aria-label="Galerie d'art hexagonale"
        style={{ width: `${layout.canvasWidth}px`, height: `${layout.canvasHeight}px` }}
      >
        {items.map((item, index) => (
          <ArtCard
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
          <AddArtCard
            onClick={onAdd}
            position={layout.positions[items.length] ?? { x: 0, y: 0 }}
            size={{ width: layout.width, height: layout.height }}
          />
        )}
      </div>
    </div>
  );
}

function ArtLightbox({ artwork, onClose }) {
  useEffect(() => {
    if (!artwork) return undefined;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const onKeyDown = (event) => {
      if (event.key === 'Escape') onClose();
    };

    window.addEventListener('keydown', onKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [artwork, onClose]);

  if (!artwork) return null;

  return (
    <div
      className="art-lightbox"
      role="dialog"
      aria-modal="true"
      aria-label={artwork.title ? `Œuvre : ${artwork.title}` : 'Œuvre en plein écran'}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <button className="art-lightbox__close" type="button" onClick={onClose} aria-label="Fermer l’œuvre">
        ×
      </button>

      <img
        className="art-lightbox__image"
        src={artwork.image_url}
        alt={artwork.title || 'Œuvre'}
      />
    </div>
  );
}

function AddArtModal({ open, onClose, onCreate }) {
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
      setError(err.message || 'Impossible d’ajouter cette œuvre.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="art-modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && !busy && onClose()}>
      <section className="art-modal" role="dialog" aria-modal="true" aria-labelledby="new-art-title">
        <div className="art-modal__frame" aria-hidden="true" />
        <form className="art-modal__content" onSubmit={submit}>
          <button className="art-modal-close" type="button" onClick={onClose} aria-label="Fermer" disabled={busy}>×</button>
          <p className="art-eyebrow">ATELIER DU BESTAGONE</p>
          <h2 id="new-art-title">Ajouter une œuvre</h2>

          <button className={`art-upload ${preview ? 'has-image' : ''}`} type="button" onClick={() => fileRef.current?.click()} disabled={busy}>
            {preview ? <img src={preview} alt="Aperçu de l’œuvre" /> : <><span>+</span><strong>Importer l’œuvre</strong></>}
          </button>
          <input ref={fileRef} className="sr-only" type="file" accept="image/jpeg,image/png,image/webp,image/gif" onChange={onFile} />

          <label className="art-field">
            <span>Titre</span>
            <input value={title} onChange={(event) => setTitle(event.target.value)} maxLength={64} placeholder="L’Apothéose du Sixième Côté" disabled={busy} />
          </label>

          <label className="art-field">
            <span>Description</span>
            <textarea value={description} onChange={(event) => setDescription(event.target.value)} maxLength={260} rows="4" placeholder="Quelques mots sur cette œuvre…" disabled={busy} />
          </label>

          {error && <p className="art-form-error" role="alert">{error}</p>}

          <button className="art-submit" type="submit" disabled={busy || !title.trim() || !description.trim() || !file}>
            {busy ? 'Installation dans la galerie…' : 'Ajouter à ART'}
          </button>
        </form>
      </section>
    </div>
  );
}

export default function Art() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editMode, setEditMode] = useState(false);
  const [adding, setAdding] = useState(false);
  const [selectedArtwork, setSelectedArtwork] = useState(null);
  const [notice, setNotice] = useState('');

  const loadArtworks = useCallback(async () => {
    if (!supabase) {
      setItems([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const { data, error } = await supabase
      .from(ART_TABLE)
      .select('*')
      .order('created_at', { ascending: true });

    if (error) {
      console.error(error);
      setNotice(error.message);
      setItems([]);
    } else {
      setItems(data ?? []);
    }

    setLoading(false);
  }, []);

  useEffect(() => {
    loadArtworks();
  }, [loadArtworks]);

  const toggleEdit = () => {
    if (!supabaseConfigured) {
      setNotice('Supabase n’est pas configuré. Vérifie les variables VITE_SUPABASE_URL et VITE_SUPABASE_PUBLISHABLE_KEY.');
      return;
    }
    setEditMode((value) => !value);
  };

  const onDelete = async (item) => {
    if (!supabase) return;
    if (!window.confirm(`Supprimer « ${item.title} » de la galerie ART ?`)) return;

    const { error } = await supabase
      .from(ART_TABLE)
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
        console.warn('Image ART non supprimée du stockage :', storageError.message);
      }
    }

    await loadArtworks();
  };

  const onCreate = async ({ title, description, file }) => {
    if (!supabase) throw new Error('Supabase n’est pas configuré.');

    const blob = await imageToBlob(file);
    const path = `art/${crypto.randomUUID()}.webp`;

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

    const { error: insertError } = await supabase
      .from(ART_TABLE)
      .insert({
        title,
        description,
        image_url: publicData.publicUrl,
        image_path: path,
      });

    if (insertError) {
      await supabase.storage.from(BUCKET).remove([path]);
      throw insertError;
    }

    await loadArtworks();
  };

  return (
    <main className="art-page">
      <div className="art-controls">
        {notice && (
          <button className="art-notice" type="button" onClick={() => setNotice('')} title="Fermer">
            {notice}
          </button>
        )}

        <button className={`art-edit-toggle ${editMode ? 'on' : ''}`} type="button" onClick={toggleEdit}>
          <span className="art-switch"><i /></span>
          <span>
            <strong>Mode édition</strong>
            <small>{editMode ? 'Activé' : 'Désactivé'}</small>
          </span>
        </button>
      </div>

      {loading ? (
        <div className="art-loading">OUVERTURE DE LA GALERIE…</div>
      ) : items.length === 0 && !editMode ? (
        <div className="art-empty">
          <div className="art-empty__hex">
            <span>ART</span>
            <strong>La galerie attend sa première œuvre.</strong>
          </div>
        </div>
      ) : (
        <ArtHoneycomb
          items={items}
          editMode={editMode}
          onDelete={onDelete}
          onAdd={() => setAdding(true)}
          onOpen={setSelectedArtwork}
        />
      )}

      <ArtLightbox
        artwork={selectedArtwork}
        onClose={() => setSelectedArtwork(null)}
      />

      <AddArtModal
        open={adding}
        onClose={() => setAdding(false)}
        onCreate={onCreate}
      />
    </main>
  );
}
