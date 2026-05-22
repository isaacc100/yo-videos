import {
  ArrowDown,
  ArrowUp,
  Edit3,
  ExternalLink,
  Eye,
  EyeOff,
  GripVertical,
  LogOut,
  Play,
  Plus,
  Save,
  SkipForward,
  Trash2,
  X,
} from "lucide-react";
import { FormEvent, useEffect, useMemo, useState } from "react";
import type { Video, VideoPayload } from "./types";

const selectedVideoKey = "yo:selected-video";

type RequestOptions = RequestInit & {
  body?: BodyInit | null;
};

type AdminForm = {
  id: string | null;
  title: string;
  description: string;
  videoUrl: string;
  thumbnailUrl: string;
  sortOrder: string;
  published: boolean;
};

const emptyForm: AdminForm = {
  id: null,
  title: "",
  description: "",
  videoUrl: "",
  thumbnailUrl: "",
  sortOrder: "",
  published: true,
};

async function apiRequest<T>(url: string, options: RequestOptions = {}): Promise<T> {
  const response = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options.headers ?? {}),
    },
  });

  if (!response.ok) {
    let message = "Something went wrong.";
    try {
      const error = (await response.json()) as { error?: string };
      message = error.error ?? message;
    } catch {
      message = response.statusText || message;
    }
    throw new Error(message);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
}

function App() {
  const path = window.location.pathname;

  if (path === "/admin" || path === "/admin/") {
    return <AdminPage />;
  }

  return <PublicPage />;
}

function PublicPage() {
  const [videos, setVideos] = useState<Video[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [videoError, setVideoError] = useState(false);

  useEffect(() => {
    let active = true;

    async function loadVideos() {
      try {
        const data = await apiRequest<{ videos: Video[] }>("/api/videos");
        if (!active) return;
        setVideos(data.videos);
        setError("");
      } catch (err) {
        if (!active) return;
        setError(err instanceof Error ? err.message : "Videos could not be loaded.");
      } finally {
        if (active) setLoading(false);
      }
    }

    loadVideos();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (videos.length === 0) {
      setSelectedId(null);
      return;
    }

    setSelectedId((currentId) => {
      if (currentId && videos.some((video) => video.id === currentId)) {
        return currentId;
      }

      const storedId = window.localStorage.getItem(selectedVideoKey);
      if (storedId && videos.some((video) => video.id === storedId)) {
        return storedId;
      }

      return videos[0].id;
    });
  }, [videos]);

  const selectedVideo = useMemo(
    () => videos.find((video) => video.id === selectedId) ?? videos[0],
    [selectedId, videos],
  );

  const selectedIndex = selectedVideo
    ? videos.findIndex((video) => video.id === selectedVideo.id)
    : -1;
  const nextVideo =
    selectedIndex >= 0 && videos.length > 1
      ? videos[(selectedIndex + 1) % videos.length]
      : null;

  useEffect(() => {
    setVideoError(false);
  }, [selectedVideo?.id]);

  function selectVideo(video: Video) {
    setSelectedId(video.id);
    window.localStorage.setItem(selectedVideoKey, video.id);
  }

  function selectNextVideo() {
    if (nextVideo) {
      selectVideo(nextVideo);
    }
  }

  return (
    <main className="page-shell">
      <Header />

      <section className="intro-section" aria-labelledby="page-title">
        <div className="title-wrap">
          <h1 id="page-title" className="title-block">
            <span className="title-line">Youth Onboarding</span>
            <span className="title-line title-accent">tutorials</span>
          </h1>
        </div>
        <div className="chevron-field" aria-hidden="true" />
      </section>

      <section className="video-layout" aria-label="Tutorial playlist">
        <div className="player-panel">
          {loading ? (
            <div className="empty-state">Loading videos</div>
          ) : error ? (
            <div className="empty-state error-state">{error}</div>
          ) : selectedVideo ? (
            <>
              <div className="video-frame">
                {!videoError ? (
                  <video
                    key={selectedVideo.id}
                    controls
                    preload="metadata"
                    poster={selectedVideo.thumbnailUrl || undefined}
                    src={selectedVideo.videoUrl}
                    onError={() => setVideoError(true)}
                  >
                    <a href={selectedVideo.videoUrl}>Open the video</a>
                  </video>
                ) : (
                  <div className="fallback-panel">
                    <p>This video cannot be played here.</p>
                    <a href={selectedVideo.videoUrl} target="_blank" rel="noreferrer">
                      Open the video in a new tab <ExternalLink size={16} />
                    </a>
                  </div>
                )}
              </div>

              <div className="video-summary">
                <div>
                  <p className="eyebrow">Now playing</p>
                  <h2>{selectedVideo.title}</h2>
                  {selectedVideo.description ? <p>{selectedVideo.description}</p> : null}
                </div>
                <button className="button primary-button" onClick={selectNextVideo} disabled={!nextVideo}>
                  <SkipForward size={18} />
                  Next video
                </button>
              </div>

              <a className="fallback-link" href={selectedVideo.videoUrl} target="_blank" rel="noreferrer">
                Open video link <ExternalLink size={15} />
              </a>
            </>
          ) : (
            <div className="empty-state">No videos are available yet.</div>
          )}
        </div>

        <aside className="playlist-panel" aria-label="Playlist">
          <div className="playlist-heading">
            <h2>Playlist</h2>
            <span>{videos.length} videos</span>
          </div>

          <div className="playlist-items">
            {videos.map((video, index) => {
              const active = video.id === selectedVideo?.id;
              return (
                <button
                  key={video.id}
                  className={`playlist-item ${active ? "is-active" : ""}`}
                  onClick={() => selectVideo(video)}
                  aria-current={active ? "true" : undefined}
                >
                  <span className="playlist-thumb">
                    {video.thumbnailUrl ? (
                      <img src={video.thumbnailUrl} alt="" />
                    ) : (
                      <Play size={22} aria-hidden="true" />
                    )}
                  </span>
                  <span className="playlist-copy">
                    <span className="playlist-index">{String(index + 1).padStart(2, "0")}</span>
                    <strong>{video.title}</strong>
                    {video.description ? <span>{video.description}</span> : null}
                  </span>
                </button>
              );
            })}
          </div>
        </aside>
      </section>
    </main>
  );
}

function AdminPage() {
  const [checkingSession, setCheckingSession] = useState(true);
  const [authenticated, setAuthenticated] = useState(false);
  const [adminCode, setAdminCode] = useState("");
  const [videos, setVideos] = useState<Video[]>([]);
  const [form, setForm] = useState<AdminForm>(emptyForm);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let active = true;

    async function checkSession() {
      try {
        await apiRequest<{ authenticated: boolean }>("/api/admin/me");
        if (!active) return;
        setAuthenticated(true);
        await loadAdminVideos();
      } catch {
        if (active) setAuthenticated(false);
      } finally {
        if (active) setCheckingSession(false);
      }
    }

    checkSession();
    return () => {
      active = false;
    };
  }, []);

  async function loadAdminVideos() {
    const data = await apiRequest<{ videos: Video[] }>("/api/admin/videos");
    setVideos(data.videos);
  }

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setMessage("");

    try {
      await apiRequest<{ ok: boolean }>("/api/admin/login", {
        method: "POST",
        body: JSON.stringify({ code: adminCode }),
      });
      setAdminCode("");
      setAuthenticated(true);
      await loadAdminVideos();
    } catch (err) {
      setError(err instanceof Error ? err.message : "The admin code was not accepted.");
    }
  }

  async function handleLogout() {
    await apiRequest<{ ok: boolean }>("/api/admin/logout", { method: "POST" });
    setAuthenticated(false);
    setVideos([]);
    setForm(emptyForm);
  }

  function editVideo(video: Video) {
    setForm({
      id: video.id,
      title: video.title,
      description: video.description,
      videoUrl: video.videoUrl,
      thumbnailUrl: video.thumbnailUrl,
      sortOrder: String(video.sortOrder),
      published: video.published,
    });
    setError("");
    setMessage("");
  }

  function resetForm() {
    setForm(emptyForm);
    setError("");
    setMessage("");
  }

  function buildPayload(): VideoPayload {
    const sortOrder = form.sortOrder.trim() === "" ? undefined : Number(form.sortOrder);
    return {
      title: form.title,
      description: form.description,
      videoUrl: form.videoUrl,
      thumbnailUrl: form.thumbnailUrl,
      sortOrder,
      published: form.published,
    };
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setMessage("");

    try {
      const payload = buildPayload();
      if (form.id) {
        await apiRequest<{ video: Video }>(`/api/admin/videos/${form.id}`, {
          method: "PUT",
          body: JSON.stringify(payload),
        });
        setMessage("Video updated.");
      } else {
        await apiRequest<{ video: Video }>("/api/admin/videos", {
          method: "POST",
          body: JSON.stringify(payload),
        });
        setMessage("Video added.");
      }
      setForm(emptyForm);
      await loadAdminVideos();
    } catch (err) {
      setError(err instanceof Error ? err.message : "The video could not be saved.");
    } finally {
      setSaving(false);
    }
  }

  async function deleteVideo(video: Video) {
    if (!window.confirm(`Delete "${video.title}"?`)) {
      return;
    }

    setError("");
    setMessage("");

    try {
      await apiRequest<{ ok: boolean }>(`/api/admin/videos/${video.id}`, { method: "DELETE" });
      setMessage("Video deleted.");
      await loadAdminVideos();
    } catch (err) {
      setError(err instanceof Error ? err.message : "The video could not be deleted.");
    }
  }

  async function togglePublished(video: Video) {
    setError("");
    setMessage("");

    try {
      await apiRequest<{ video: Video }>(`/api/admin/videos/${video.id}`, {
        method: "PUT",
        body: JSON.stringify({
          title: video.title,
          description: video.description,
          videoUrl: video.videoUrl,
          thumbnailUrl: video.thumbnailUrl,
          sortOrder: video.sortOrder,
          published: !video.published,
        }),
      });
      await loadAdminVideos();
    } catch (err) {
      setError(err instanceof Error ? err.message : "The publish state could not be changed.");
    }
  }

  async function moveVideo(index: number, direction: -1 | 1) {
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= videos.length) {
      return;
    }

    const nextVideos = [...videos];
    const [removed] = nextVideos.splice(index, 1);
    nextVideos.splice(targetIndex, 0, removed);
    setVideos(nextVideos.map((video, sortOrder) => ({ ...video, sortOrder })));

    try {
      await apiRequest<{ videos: Video[] }>("/api/admin/videos/reorder", {
        method: "POST",
        body: JSON.stringify({ ids: nextVideos.map((video) => video.id) }),
      });
      await loadAdminVideos();
    } catch (err) {
      setError(err instanceof Error ? err.message : "The order could not be saved.");
      await loadAdminVideos();
    }
  }

  if (checkingSession) {
    return (
      <main className="page-shell admin-shell">
        <Header compact />
        <div className="empty-state">Checking admin session</div>
      </main>
    );
  }

  if (!authenticated) {
    return (
      <main className="page-shell admin-shell">
        <Header compact />
        <section className="admin-login" aria-labelledby="admin-login-title">
          <h1 id="admin-login-title" className="title-block">
            <span className="title-line">Manage tutorial</span>
            <span className="title-line title-accent">videos</span>
          </h1>
          <form onSubmit={handleLogin} className="login-form">
            <label htmlFor="admin-code">Admin code</label>
            <input
              id="admin-code"
              type="password"
              autoComplete="current-password"
              value={adminCode}
              onChange={(event) => setAdminCode(event.target.value)}
              minLength={1}
              required
            />
            <button className="button primary-button" type="submit">
              <Save size={18} />
              Sign in
            </button>
          </form>
          {error ? <p className="notice error-notice">{error}</p> : null}
        </section>
      </main>
    );
  }

  return (
    <main className="page-shell admin-shell">
      <Header compact />

      <section className="admin-heading" aria-labelledby="admin-title">
        <div>
          <h1 id="admin-title" className="title-block">
            <span className="title-line">Manage tutorial</span>
            <span className="title-line title-accent">videos</span>
          </h1>
        </div>
        <button className="button ghost-button" onClick={handleLogout}>
          <LogOut size={18} />
          Sign out
        </button>
      </section>

      <section className="admin-grid">
        <form className="video-form" onSubmit={handleSubmit} aria-label="Video details">
          <div className="form-title-row">
            <h2>{form.id ? "Edit video" : "Add video"}</h2>
            {form.id ? (
              <button className="icon-button" type="button" onClick={resetForm} aria-label="Cancel edit">
                <X size={19} />
              </button>
            ) : null}
          </div>

          <label>
            Title
            <input
              value={form.title}
              onChange={(event) => setForm({ ...form, title: event.target.value })}
              maxLength={120}
              required
            />
          </label>

          <label>
            Description
            <textarea
              value={form.description}
              onChange={(event) => setForm({ ...form, description: event.target.value })}
              maxLength={1000}
              rows={4}
            />
          </label>

          <label>
            Video URL
            <input
              type="url"
              value={form.videoUrl}
              onChange={(event) => setForm({ ...form, videoUrl: event.target.value })}
              required
            />
          </label>

          <label>
            Thumbnail URL
            <input
              type="url"
              value={form.thumbnailUrl}
              onChange={(event) => setForm({ ...form, thumbnailUrl: event.target.value })}
            />
          </label>

          <div className="form-row">
            <label>
              Sort order
              <input
                type="number"
                min="0"
                step="1"
                value={form.sortOrder}
                onChange={(event) => setForm({ ...form, sortOrder: event.target.value })}
              />
            </label>
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={form.published}
                onChange={(event) => setForm({ ...form, published: event.target.checked })}
              />
              Published
            </label>
          </div>

          <button className="button primary-button" type="submit" disabled={saving}>
            {form.id ? <Save size={18} /> : <Plus size={18} />}
            {form.id ? "Save changes" : "Add video"}
          </button>

          {message ? <p className="notice success-notice">{message}</p> : null}
          {error ? <p className="notice error-notice">{error}</p> : null}
        </form>

        <div className="admin-list" aria-label="Current videos">
          <div className="admin-list-heading">
            <h2>Current videos</h2>
            <span>{videos.length} total</span>
          </div>

          {videos.length === 0 ? (
            <div className="empty-state">No videos have been added yet.</div>
          ) : (
            <div className="admin-video-list">
              {videos.map((video, index) => (
                <article className="admin-video-row" key={video.id}>
                  <GripVertical className="drag-icon" size={18} aria-hidden="true" />
                  <div className="admin-video-copy">
                    <div className="status-line">
                      <span className={video.published ? "status-pill published" : "status-pill"}>
                        {video.published ? "Published" : "Unpublished"}
                      </span>
                      <span>Order {video.sortOrder}</span>
                    </div>
                    <h3>{video.title}</h3>
                    {video.description ? <p>{video.description}</p> : null}
                    <a className="admin-video-url" href={video.videoUrl} target="_blank" rel="noreferrer">
                      {video.videoUrl}
                    </a>
                    {video.thumbnailUrl ? (
                      <span className="admin-thumbnail-url">Thumbnail: {video.thumbnailUrl}</span>
                    ) : null}
                  </div>
                  <div className="row-actions">
                    <button
                      className="icon-button"
                      type="button"
                      onClick={() => moveVideo(index, -1)}
                      disabled={index === 0}
                      aria-label={`Move ${video.title} up`}
                      title="Move up"
                    >
                      <ArrowUp size={18} />
                    </button>
                    <button
                      className="icon-button"
                      type="button"
                      onClick={() => moveVideo(index, 1)}
                      disabled={index === videos.length - 1}
                      aria-label={`Move ${video.title} down`}
                      title="Move down"
                    >
                      <ArrowDown size={18} />
                    </button>
                    <button
                      className="icon-button"
                      type="button"
                      onClick={() => togglePublished(video)}
                      aria-label={video.published ? `Unpublish ${video.title}` : `Publish ${video.title}`}
                      title={video.published ? "Unpublish" : "Publish"}
                    >
                      {video.published ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                    <button
                      className="icon-button"
                      type="button"
                      onClick={() => editVideo(video)}
                      aria-label={`Edit ${video.title}`}
                      title="Edit"
                    >
                      <Edit3 size={18} />
                    </button>
                    <button
                      className="icon-button danger-button"
                      type="button"
                      onClick={() => deleteVideo(video)}
                      aria-label={`Delete ${video.title}`}
                      title="Delete"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      </section>
    </main>
  );
}

function Header({ compact = false }: { compact?: boolean }) {
  return (
    <header className={`site-header ${compact ? "compact-header" : ""}`}>
      <a className="brand-lockup" href="/" aria-label="Youth Onboarding tutorials home">
        <img className="brand-logo" src="/sja-logo-dark.png" alt="St John Ambulance" />
      </a>
    </header>
  );
}

export default App;
