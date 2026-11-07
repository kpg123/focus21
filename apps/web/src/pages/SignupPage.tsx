import { FormEvent, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { ApiError } from "../api";
import { useAuth } from "../auth";

export function SignupPage() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const initialRole =
    params.get("role") === "channel_owner" ? "channel_owner" : "viewer";

  const [form, setForm] = useState({
    email: "",
    password: "",
    displayName: "",
    role: initialRole as "viewer" | "channel_owner",
    age: "",
    gender: "",
    country: "US",
  });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const title = useMemo(
    () =>
      form.role === "channel_owner"
        ? "Create a creator account"
        : "Create a viewer account",
    [form.role],
  );

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await register({
        email: form.email,
        password: form.password,
        displayName: form.displayName,
        role: form.role,
        age: form.age ? Number(form.age) : undefined,
        gender: form.gender || undefined,
        country: form.country || undefined,
      });
      navigate(form.role === "channel_owner" ? "/portal" : "/dashboard");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Signup failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="section" style={{ maxWidth: 640 }}>
      <h1 className="page-title">{title}</h1>
      <p className="muted">
        Viewers earn from surveys. Creators publish them to matched audiences.
      </p>
      <form className="form panel" onSubmit={onSubmit} style={{ marginTop: "1.25rem" }}>
        <label>
          I am joining as
          <select
            value={form.role}
            onChange={(e) =>
              setForm((f) => ({
                ...f,
                role: e.target.value as "viewer" | "channel_owner",
              }))
            }
          >
            <option value="viewer">Viewer</option>
            <option value="channel_owner">Channel owner</option>
          </select>
        </label>
        <label>
          Display name
          <input
            value={form.displayName}
            onChange={(e) => setForm((f) => ({ ...f, displayName: e.target.value }))}
            required
          />
        </label>
        <label>
          Email
          <input
            type="email"
            value={form.email}
            onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
            required
          />
        </label>
        <label>
          Password
          <input
            type="password"
            minLength={8}
            value={form.password}
            onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
            required
          />
        </label>
        <div className="row-2">
          <label>
            Age
            <input
              type="number"
              min={13}
              max={120}
              value={form.age}
              onChange={(e) => setForm((f) => ({ ...f, age: e.target.value }))}
            />
          </label>
          <label>
            Gender
            <select
              value={form.gender}
              onChange={(e) => setForm((f) => ({ ...f, gender: e.target.value }))}
            >
              <option value="">Prefer not to say later</option>
              <option value="female">Female</option>
              <option value="male">Male</option>
              <option value="non_binary">Non-binary</option>
              <option value="prefer_not_to_say">Prefer not to say</option>
            </select>
          </label>
        </div>
        <label>
          Country
          <input
            value={form.country}
            onChange={(e) => setForm((f) => ({ ...f, country: e.target.value }))}
          />
        </label>
        {error && <p className="error">{error}</p>}
        <button className="btn btn-primary" type="submit" disabled={busy}>
          {busy ? "Creating…" : "Create account"}
        </button>
        <p className="muted">
          Already have an account? <Link to="/login">Sign in</Link>
        </p>
      </form>
    </section>
  );
}
