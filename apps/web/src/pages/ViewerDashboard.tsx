import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, formatCents } from "../api";
import { useAuth } from "../auth";

interface WatchStats {
  totalMinutes: number;
  totalSeconds: number;
  byPlatform: Record<string, number>;
  channels: Array<{
    id: string;
    name: string;
    platform: string;
    minutes: number;
  }>;
}

interface Offer {
  id: string;
  surveyId: string;
  title: string;
  description: string;
  rewardCents: number;
  estimatedMinutes: number;
  channelName: string;
  expiresAt: string;
}

export function ViewerDashboard() {
  const { token, user, refresh } = useAuth();
  const [stats, setStats] = useState<WatchStats | null>(null);
  const [offers, setOffers] = useState<Offer[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    void (async () => {
      try {
        const [watch, matched, pending] = await Promise.all([
          api<WatchStats>("/watch/stats", { token }),
          api<{ offers: Offer[] }>("/surveys/match", {
            method: "POST",
            token,
            body: "{}",
          }),
          api<{ offers: Offer[] }>("/surveys/offers", { token }),
        ]);
        setStats(watch);
        const merged = [...matched.offers, ...pending.offers];
        const byId = new Map(merged.map((o) => [o.id, o]));
        setOffers([...byId.values()]);
        await refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load dashboard");
      }
    })();
  }, [token, refresh]);

  return (
    <section className="section">
      <h1 className="page-title">Hey {user?.displayName}</h1>
      <p className="muted">
        Balance {formatCents(user?.balanceCents ?? 0)} · Install the Focus21
        extension to keep watch time flowing.
      </p>

      {error && <p className="error">{error}</p>}
      {message && <p className="success">{message}</p>}

      <div className="split" style={{ marginTop: "1.5rem" }}>
        <div className="stack">
          <div className="panel">
            <h3>Today&apos;s watch time</h3>
            <div className="stat-line">
              <span>Total</span>
              <strong>{stats?.totalMinutes ?? 0} min</strong>
            </div>
            {Object.entries(stats?.byPlatform ?? {}).map(([platform, seconds]) => (
              <div className="stat-line" key={platform}>
                <span style={{ textTransform: "capitalize" }}>{platform}</span>
                <strong>{Math.floor(seconds / 60)} min</strong>
              </div>
            ))}
            {!stats?.totalMinutes && (
              <p className="muted">
                No sessions yet today. Open YouTube, Twitch, or Kick with the
                extension installed.
              </p>
            )}
          </div>

          <div className="panel">
            <h3>Channels watched</h3>
            {stats?.channels?.length ? (
              <table className="table">
                <thead>
                  <tr>
                    <th>Channel</th>
                    <th>Platform</th>
                    <th>Minutes</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.channels.map((c) => (
                    <tr key={c.id}>
                      <td>{c.name}</td>
                      <td>{c.platform}</td>
                      <td>{c.minutes}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className="muted">Channel breakdown appears after heartbeats.</p>
            )}
          </div>
        </div>

        <div className="panel">
          <h3>Survey offers</h3>
          <div className="stack">
            {offers.length === 0 && (
              <p className="muted">
                No matching surveys right now. Keep watching — offers appear when
                your demographics and daily watch time qualify.
              </p>
            )}
            {offers.map((offer) => (
              <div key={offer.id} className="stack" style={{ gap: "0.35rem" }}>
                <strong>{offer.title}</strong>
                <span className="muted">
                  {offer.channelName} · {formatCents(offer.rewardCents)} · ~
                  {offer.estimatedMinutes} min
                </span>
                <p style={{ margin: 0 }}>{offer.description}</p>
                <div className="cta-row">
                  <Link
                    className="btn btn-primary"
                    to={`/surveys/${offer.surveyId}`}
                    onClick={() => setMessage(null)}
                  >
                    Take survey
                  </Link>
                  <button
                    type="button"
                    className="btn btn-ghost"
                    onClick={async () => {
                      await api(`/surveys/offers/${offer.id}/dismiss`, {
                        method: "POST",
                        token,
                      });
                      setOffers((prev) => prev.filter((o) => o.id !== offer.id));
                      setMessage("Offer dismissed");
                    }}
                  >
                    Dismiss
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
