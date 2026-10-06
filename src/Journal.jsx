import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase, supabaseConfigured } from './supabase';
import './journal.css';

const TABLE = 'journal_articles';
const DEFAULT_TITLE = 'FRAGMENTS';
const ADMIN_EMAIL = import.meta.env.VITE_JOURNAL_ADMIN_EMAIL || '';

function slugify(value) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64) || 'fragment';
}

function uniqueSlug(title) {
  const suffix = crypto.randomUUID().slice(0, 6);
  return `${slugify(title)}-${suffix}`;
}

function formatDate(value) {
  if (!value) return 'Non publié';
  try {
    return new Intl.DateTimeFormat('fr-FR', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    }).format(new Date(value));
  } catch {
    return value;
  }
}

function readingTime(text = '') {
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 210));
}

function InlineText({ text }) {
  const tokens = String(text).split(/(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/g).filter(Boolean);
  return tokens.map((token, index) => {
    if (token.startsWith('**') && token.endsWith('**')) {
      return <strong key={`${index}-${token}`}>{token.slice(2, -2)}</strong>;
    }
    if (token.startsWith('*') && token.endsWith('*')) {
      return <em key={`${index}-${token}`}>{token.slice(1, -1)}</em>;
    }
    if (token.startsWith('`') && token.endsWith('`')) {
      return <code key={`${index}-${token}`}>{token.slice(1, -1)}</code>;
    }
    return <React.Fragment key={`${index}-${token}`}>{token}</React.Fragment>;
  });
}

function ArticleBody({ body }) {
  const lines = String(body || '').replace(/\r\n/g, '\n').split('\n');
  const blocks = [];
  let paragraph = [];
  let bullets = [];
  let numbered = [];

  const flushParagraph = () => {
    if (!paragraph.length) return;
    const text = paragraph.join(' ').trim();
    if (text) blocks.push(<p key={`p-${blocks.length}`}><InlineText text={text} /></p>);
    paragraph = [];
  };

  const flushBullets = () => {
    if (!bullets.length) return;
    blocks.push(
      <ul key={`ul-${blocks.length}`}>
        {bullets.map((item, index) => <li key={index}><InlineText text={item} /></li>)}
      </ul>
    );
    bullets = [];
  };

  const flushNumbered = () => {
    if (!numbered.length) return;
    blocks.push(
      <ol key={`ol-${blocks.length}`}>
        {numbered.map((item, index) => <li key={index}><InlineText text={item} /></li>)}
      </ol>
    );
    numbered = [];
  };

  const flushLists = () => {
    flushBullets();
    flushNumbered();
  };

  lines.forEach((rawLine) => {
    const line = rawLine.trim();
    if (!line) {
      flushParagraph();
      flushLists();
      return;
    }

    if (/^---+$/.test(line)) {
      flushParagraph();
      flushLists();
      blocks.push(<hr key={`hr-${blocks.length}`} />);
      return;
    }

    if (line.startsWith('### ')) {
      flushParagraph();
      flushLists();
      blocks.push(<h3 key={`h3-${blocks.length}`}><InlineText text={line.slice(4)} /></h3>);
      return;
    }

    if (line.startsWith('## ')) {
      flushParagraph();
      flushLists();
      blocks.push(<h2 key={`h2-${blocks.length}`}><InlineText text={line.slice(3)} /></h2>);
      return;
    }

    if (line.startsWith('> ')) {
      flushParagraph();
      flushLists();
      blocks.push(<blockquote key={`q-${blocks.length}`}><InlineText text={line.slice(2)} /></blockquote>);
      return;
    }

    if (/^[-•]\s+/.test(line)) {
      flushParagraph();
      flushNumbered();
      bullets.push(line.replace(/^[-•]\s+/, ''));
      return;
    }

    if (/^\d+\.\s+/.test(line)) {
      flushParagraph();
      flushBullets();
      numbered.push(line.replace(/^\d+\.\s+/, ''));
      return;
    }

    flushLists();
    paragraph.push(line);
  });

  flushParagraph();
  flushLists();

  return <div className="journal-prose">{blocks}</div>;
}

function PasswordDialog({ open, busy, error, onClose, onSubmit }) {
  const [password, setPassword] = useState('');

  useEffect(() => {
    if (!open) setPassword('');
  }, [open]);

  if (!open) return null;

  return (
    <div className="journal-modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && !busy && onClose()}>
      <form
        className="journal-auth-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="journal-auth-title"
        onSubmit={(event) => {
          event.preventDefault();
          if (password && !busy) onSubmit(password);
        }}
      >
        <button className="journal-modal-close" type="button" onClick={onClose} disabled={busy} aria-label="Fermer">×</button>
        <span className="journal-kicker">ACCÈS PRIVÉ</span>
        <h2 id="journal-auth-title">Mode édition</h2>
        <p>Le mot de passe déverrouille l’écriture et la gestion des fragments.</p>
        <label className="journal-field">
          <span>Mot de passe</span>
          <input
            type="password"
            autoFocus
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            disabled={busy}
          />
        </label>
        {error && <p className="journal-form-error" role="alert">{error}</p>}
        <button className="journal-solid-button" type="submit" disabled={!password || busy}>
          {busy ? 'Ouverture…' : 'Entrer'}
        </button>
      </form>
    </div>
  );
}

const EMPTY_DRAFT = {
  title: '',
  kind: 'Note',
  excerpt: '',
  body: '',
  status: 'published',
};

function EditorDialog({ open, article, busy, error, onClose, onSave, onDelete }) {
  const [draft, setDraft] = useState(EMPTY_DRAFT);

  useEffect(() => {
    if (!open) return;
    setDraft(article ? {
      title: article.title || '',
      kind: article.kind || 'Note',
      excerpt: article.excerpt || '',
      body: article.body || '',
      status: article.status || 'published',
    } : EMPTY_DRAFT);
  }, [open, article]);

  if (!open) return null;

  const update = (key, value) => setDraft((current) => ({ ...current, [key]: value }));
  const valid = draft.title.trim() && draft.body.trim();

  return (
    <div className="journal-modal-backdrop journal-editor-backdrop" role="presentation">
      <form
        className="journal-editor"
        role="dialog"
        aria-modal="true"
        aria-labelledby="journal-editor-title"
        onSubmit={(event) => {
          event.preventDefault();
          if (valid && !busy) onSave(draft);
        }}
      >
        <header className="journal-editor-head">
          <div>
            <span className="journal-kicker">{article ? 'RÉVISION' : 'NOUVEAU FRAGMENT'}</span>
            <h2 id="journal-editor-title">{article ? 'Modifier l’article' : 'Écrire un article'}</h2>
          </div>
          <button className="journal-modal-close journal-modal-close--editor" type="button" onClick={onClose} disabled={busy} aria-label="Fermer">×</button>
        </header>

        <div className="journal-editor-grid">
          <label className="journal-field journal-field--wide">
            <span>Titre</span>
            <input
              value={draft.title}
              onChange={(event) => update('title', event.target.value)}
              maxLength={140}
              placeholder="Un titre qui donne envie d’entrer"
              disabled={busy}
            />
          </label>

          <label className="journal-field">
            <span>Type / rubrique</span>
            <input
              value={draft.kind}
              onChange={(event) => update('kind', event.target.value)}
              maxLength={40}
              placeholder="Trip report, réflexion, question…"
              disabled={busy}
            />
          </label>

          <label className="journal-field">
            <span>État</span>
            <select value={draft.status} onChange={(event) => update('status', event.target.value)} disabled={busy}>
              <option value="published">Publié</option>
              <option value="draft">Brouillon</option>
            </select>
          </label>

          <label className="journal-field journal-field--wide">
            <span>Accroche</span>
            <textarea
              value={draft.excerpt}
              onChange={(event) => update('excerpt', event.target.value)}
              maxLength={320}
              rows={3}
              placeholder="Deux ou trois phrases pour l’index."
              disabled={busy}
            />
          </label>

          <label className="journal-field journal-field--wide">
            <span>Texte</span>
            <textarea
              className="journal-body-input"
              value={draft.body}
              onChange={(event) => update('body', event.target.value)}
              rows={18}
              placeholder={'Écris librement.\n\n## Intertitre\n> Citation\n- Liste\n**gras**, *italique*, `code`'}
              disabled={busy}
            />
            <small>Formatage léger : ## titre, &gt; citation, - liste, **gras**, *italique*, `code`, --- séparation.</small>
          </label>
        </div>

        {error && <p className="journal-form-error" role="alert">{error}</p>}

        <footer className="journal-editor-actions">
          {article && (
            <button className="journal-danger-button" type="button" onClick={() => onDelete(article)} disabled={busy}>
              Supprimer
            </button>
          )}
          <span className="journal-editor-spacer" />
          <button className="journal-ghost-button" type="button" onClick={onClose} disabled={busy}>Annuler</button>
          <button className="journal-solid-button" type="submit" disabled={!valid || busy}>
            {busy ? 'Enregistrement…' : article ? 'Enregistrer' : draft.status === 'draft' ? 'Enregistrer le brouillon' : 'Publier'}
          </button>
        </footer>
      </form>
    </div>
  );
}

function ArticleIndex({ articles, selectedId, isAdmin, search, onSearch, onSelect, onNew }) {
  return (
    <aside className="journal-index" aria-label="Index des articles">
      <div className="journal-index-intro">
        <span className="journal-kicker">INDEX</span>
        <p>Notes, visions, questions, récits. Aucun fil imposé.</p>
      </div>

      <label className="journal-search">
        <span className="sr-only">Rechercher dans les articles</span>
        <input value={search} onChange={(event) => onSearch(event.target.value)} placeholder="Rechercher…" />
        <span aria-hidden="true">⌕</span>
      </label>

      {isAdmin && (
        <button className="journal-new-button" type="button" onClick={onNew}>
          <span>+</span> Nouveau fragment
        </button>
      )}

      <div className="journal-index-list">
        {articles.map((article, index) => (
          <button
            className={`journal-index-card ${article.id === selectedId ? 'is-active' : ''}`}
            type="button"
            key={article.id}
            onClick={() => onSelect(article)}
          >
            <span className="journal-index-no">{String(index + 1).padStart(2, '0')}</span>
            <span className="journal-index-copy">
              <span className="journal-index-meta">
                {article.kind || 'Note'}
                {article.status === 'draft' && <em>Brouillon</em>}
              </span>
              <strong>{article.title}</strong>
              {article.excerpt && <small>{article.excerpt}</small>}
            </span>
          </button>
        ))}

        {!articles.length && (
          <div className="journal-index-empty">
            {search ? 'Aucun fragment ne correspond à cette recherche.' : 'Aucun fragment pour l’instant.'}
          </div>
        )}
      </div>
    </aside>
  );
}

function Reader({ article, isAdmin, onEdit }) {
  if (!article) {
    return (
      <section className="journal-reader journal-reader--empty">
        <div className="journal-empty-mark" aria-hidden="true">∴</div>
        <span className="journal-kicker">ENTRE DEUX IDÉES</span>
        <h1>Choisis un fragment.</h1>
        <p>L’index rassemble les textes sans leur imposer de hiérarchie.</p>
      </section>
    );
  }

  return (
    <article className="journal-reader">
      <header className="journal-article-head">
        <div className="journal-article-meta">
          <span>{article.kind || 'Note'}</span>
          <i />
          <span>{formatDate(article.published_at || article.created_at)}</span>
          <i />
          <span>{readingTime(article.body)} min</span>
          {article.status === 'draft' && <b>BROUILLON</b>}
        </div>
        <h1>{article.title}</h1>
        {article.excerpt && <p className="journal-lead">{article.excerpt}</p>}
        {isAdmin && (
          <button className="journal-edit-article" type="button" onClick={() => onEdit(article)}>
            Modifier ce fragment
          </button>
        )}
      </header>
      <div className="journal-gold-rule" aria-hidden="true"><span /></div>
      <ArticleBody body={article.body} />
      <footer className="journal-article-end" aria-hidden="true">FIN</footer>
    </article>
  );
}

export default function Journal({ path }) {
  const [articles, setArticles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [session, setSession] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);
  const [authBusy, setAuthBusy] = useState(false);
  const [authError, setAuthError] = useState('');
  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [editorBusy, setEditorBusy] = useState(false);
  const [editorError, setEditorError] = useState('');
  const [search, setSearch] = useState('');
  const [psychedelic, setPsychedelic] = useState(false);
  const [selectedSlug, setSelectedSlug] = useState(() => new URLSearchParams(window.location.search).get('a') || '');

  useEffect(() => {
    document.body.classList.add('journal-route');
    const previousTitle = document.title;
    document.title = `${DEFAULT_TITLE} — Carnet`;
    return () => {
      document.body.classList.remove('journal-route');
      document.title = previousTitle;
    };
  }, []);

  const verifyAdmin = useCallback(async (nextSession) => {
    if (!supabase || !nextSession?.user) {
      setIsAdmin(false);
      return false;
    }
    const { data, error } = await supabase.rpc('is_bestagone_admin');
    const allowed = !error && data === true;
    setIsAdmin(allowed);
    return allowed;
  }, []);

  const loadArticles = useCallback(async () => {
    if (!supabase) {
      setArticles([]);
      setLoading(false);
      setLoadError('Supabase n’est pas configuré pour ce déploiement.');
      return;
    }

    setLoading(true);
    setLoadError('');
    const { data, error } = await supabase
      .from(TABLE)
      .select('*')
      .order('published_at', { ascending: false, nullsFirst: false })
      .order('created_at', { ascending: false });

    if (error) {
      setArticles([]);
      setLoadError(error.message.includes('journal_articles')
        ? 'La table du carnet n’existe pas encore. Exécute supabase/journal.sql dans Supabase.'
        : error.message);
    } else {
      setArticles(data || []);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      return undefined;
    }

    let alive = true;
    supabase.auth.getSession().then(async ({ data }) => {
      if (!alive) return;
      const nextSession = data.session || null;
      setSession(nextSession);
      await verifyAdmin(nextSession);
      if (alive) loadArticles();
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setTimeout(async () => {
        await verifyAdmin(nextSession);
        loadArticles();
      }, 0);
    });

    return () => {
      alive = false;
      listener.subscription.unsubscribe();
    };
  }, [loadArticles, verifyAdmin]);

  useEffect(() => {
    const onPopState = () => {
      setSelectedSlug(new URLSearchParams(window.location.search).get('a') || '');
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  useEffect(() => {
    if (!articles.length || selectedSlug) return;
    const firstPublished = articles.find((article) => article.status === 'published') || articles[0];
    if (firstPublished) setSelectedSlug(firstPublished.slug);
  }, [articles, selectedSlug]);

  const visibleArticles = useMemo(() => {
    const needle = search.trim().toLowerCase();
    if (!needle) return articles;
    return articles.filter((article) => [article.title, article.kind, article.excerpt, article.body]
      .filter(Boolean)
      .some((value) => String(value).toLowerCase().includes(needle)));
  }, [articles, search]);

  const selected = useMemo(
    () => articles.find((article) => article.slug === selectedSlug) || null,
    [articles, selectedSlug],
  );

  const selectArticle = (article) => {
    setSelectedSlug(article.slug);
    const url = new URL(window.location.href);
    url.pathname = path;
    url.searchParams.set('a', article.slug);
    window.history.pushState({}, '', `${url.pathname}${url.search}`);
    if (window.matchMedia('(max-width: 840px)').matches) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const login = async (password) => {
    if (!supabaseConfigured || !supabase) {
      setAuthError('Supabase n’est pas configuré.');
      return;
    }
    if (!ADMIN_EMAIL) {
      setAuthError('Ajoute VITE_JOURNAL_ADMIN_EMAIL dans les variables de build Cloudflare.');
      return;
    }

    setAuthBusy(true);
    setAuthError('');
    const { data, error } = await supabase.auth.signInWithPassword({ email: ADMIN_EMAIL, password });
    if (error) {
      setAuthError('Mot de passe incorrect ou compte indisponible.');
      setAuthBusy(false);
      return;
    }

    const allowed = await verifyAdmin(data.session);
    if (!allowed) {
      await supabase.auth.signOut();
      setAuthError('Ce compte n’est pas autorisé à éditer ce carnet.');
      setAuthBusy(false);
      return;
    }

    setSession(data.session);
    setAuthOpen(false);
    setAuthBusy(false);
    await loadArticles();
  };

  const logout = async () => {
    if (supabase) await supabase.auth.signOut();
    setSession(null);
    setIsAdmin(false);
    setEditorOpen(false);
    setEditing(null);
  };

  const openNew = () => {
    setEditing(null);
    setEditorError('');
    setEditorOpen(true);
  };

  const openEdit = (article) => {
    setEditing(article);
    setEditorError('');
    setEditorOpen(true);
  };

  const saveArticle = async (draft) => {
    if (!supabase || !session?.user || !isAdmin) return;
    setEditorBusy(true);
    setEditorError('');

    const now = new Date().toISOString();
    const status = draft.status === 'draft' ? 'draft' : 'published';
    const basePayload = {
      title: draft.title.trim(),
      kind: draft.kind.trim() || 'Note',
      excerpt: draft.excerpt.trim(),
      body: draft.body.trim(),
      status,
      updated_at: now,
    };

    let error;
    let nextSlug = editing?.slug;

    if (editing) {
      const payload = {
        ...basePayload,
        published_at: status === 'published' ? (editing.published_at || now) : null,
      };
      ({ error } = await supabase.from(TABLE).update(payload).eq('id', editing.id));
    } else {
      nextSlug = uniqueSlug(draft.title);
      const payload = {
        ...basePayload,
        slug: nextSlug,
        created_by: session.user.id,
        published_at: status === 'published' ? now : null,
      };
      ({ error } = await supabase.from(TABLE).insert(payload));
    }

    if (error) {
      setEditorError(error.message);
      setEditorBusy(false);
      return;
    }

    setEditorOpen(false);
    setEditing(null);
    setEditorBusy(false);
    if (nextSlug) {
      setSelectedSlug(nextSlug);
      const url = new URL(window.location.href);
      url.pathname = path;
      url.searchParams.set('a', nextSlug);
      window.history.replaceState({}, '', `${url.pathname}${url.search}`);
    }
    await loadArticles();
  };

  const deleteArticle = async (article) => {
    if (!supabase || !isAdmin) return;
    if (!window.confirm(`Supprimer définitivement « ${article.title} » ?`)) return;

    setEditorBusy(true);
    setEditorError('');
    const { error } = await supabase.from(TABLE).delete().eq('id', article.id);
    if (error) {
      setEditorError(error.message);
      setEditorBusy(false);
      return;
    }

    setEditorOpen(false);
    setEditing(null);
    setEditorBusy(false);
    setSelectedSlug('');
    const url = new URL(window.location.href);
    url.searchParams.delete('a');
    window.history.replaceState({}, '', `${url.pathname}${url.search}`);
    await loadArticles();
  };

  return (
    <div className={`journal-shell ${psychedelic ? 'is-psychedelic' : ''}`}>
      <div className="journal-marble" aria-hidden="true" />
      <div className="journal-spectrum" aria-hidden="true" />

      <header className="journal-topbar">
        <div className="journal-brand" aria-label="Fragments">
          <span className="journal-brand-mark">F</span>
          <span>
            <strong>{DEFAULT_TITLE}</strong>
            <small>carnet de réalités variables</small>
          </span>
        </div>

        <div className="journal-top-actions">
          <button
            className={`journal-spectrum-toggle ${psychedelic ? 'is-on' : ''}`}
            type="button"
            onClick={() => setPsychedelic((value) => !value)}
            aria-pressed={psychedelic}
          >
            <span className="journal-spectrum-dot" />
            {psychedelic ? 'Dérive active' : 'Dérive calme'}
          </button>

          {isAdmin ? (
            <button className="journal-admin-button" type="button" onClick={logout}>Verrouiller</button>
          ) : (
            <button className="journal-admin-button" type="button" onClick={() => { setAuthError(''); setAuthOpen(true); }}>Édition</button>
          )}
        </div>
      </header>

      <main className="journal-layout">
        <ArticleIndex
          articles={visibleArticles}
          selectedId={selected?.id}
          isAdmin={isAdmin}
          search={search}
          onSearch={setSearch}
          onSelect={selectArticle}
          onNew={openNew}
        />

        {loading ? (
          <section className="journal-reader journal-reader--empty">
            <span className="journal-kicker">CHARGEMENT</span>
            <h1>Ouverture du carnet…</h1>
          </section>
        ) : loadError ? (
          <section className="journal-reader journal-reader--empty">
            <span className="journal-kicker">CONFIGURATION</span>
            <h1>Le carnet attend sa base.</h1>
            <p>{loadError}</p>
          </section>
        ) : (
          <Reader article={selected} isAdmin={isAdmin} onEdit={openEdit} />
        )}
      </main>

      <div className="journal-footer-line" aria-hidden="true" />
      <footer className="journal-site-footer">
        <span>FRAGMENTS / ARCHIVES PERSONNELLES</span>
        <span>{isAdmin ? 'ÉDITION DÉVERROUILLÉE' : 'LECTURE'}</span>
      </footer>

      <PasswordDialog
        open={authOpen}
        busy={authBusy}
        error={authError}
        onClose={() => !authBusy && setAuthOpen(false)}
        onSubmit={login}
      />

      <EditorDialog
        open={editorOpen}
        article={editing}
        busy={editorBusy}
        error={editorError}
        onClose={() => !editorBusy && setEditorOpen(false)}
        onSave={saveArticle}
        onDelete={deleteArticle}
      />
    </div>
  );
}
