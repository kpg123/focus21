import { FormEvent, useCallback, useEffect, useState } from "react";
import { api, formatCents } from "../api";
import { useAuth } from "../auth";

interface Channel {
  id: string;
  name: string;
  platform: string;
  externalId: string;
  url?: string | null;
  _count?: { surveys: number };
}

interface Survey {
  id: string;
  title: string;
  status: string;
  rewardCents: number;
  responseCount: number;
  maxResponses?: number | null;
  channelName?: string;
  targeting: {
    minDailyWatchMinutes?: number;
    genders?: string[];
    minAge?: number;
    maxAge?: number;
    platforms?: string[];
  };
}

export function ChannelPortal() {
  const { token, user } = useAuth();
  const [channels, setChannels] = useState<Channel[]>([]);
  const [surveys, setSurveys] = useState<Survey[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  const [channelForm, setChannelForm] = useState({
    name: "",
    platform: "youtube",
    externalId: "",
    url: "",
  });

  const [surveyForm, setSurveyForm] = useState({
    channelId: "",
    title: "",
    description: "",
    rewardCents: "250",
    estimatedMinutes: "5",
    maxResponses: "100",
    minDailyWatchMinutes: "60",
    minAge: "18",
    maxAge: "45",
    genders: "female,male",
    platforms: "youtube,twitch",
    questionPrompt: "How often do you watch this channel?",
    questionOptions: "Daily,Weekly,Rarely",
    status: "active",
  });

  const load = useCallback(async () => {
    if (!token) return;
    const [ch, sv] = await Promise.all([
      api<{ channels: Channel[] }>("/channels/mine", { token }),
      api<{ surveys: Survey[] }>("/surveys/mine", { token }),
    ]);
    setChannels(ch.channels);
    setSurveys(sv.surveys);
    if (ch.channels[0] && !surveyForm.channelId) {
      setSurveyForm((f) => ({ ...f, channelId: ch.channels[0].id }));
    }
  }, [token, surveyForm.channelId]);

  useEffect(() => {
    void load().catch((err) =>
      setError(err instanceof Error ? err.message : "Failed to load portal"),
    );
  }, [load]);

  async function createChannel(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setOk(null);
    try {
      await api("/channels", {
        method: "POST",
        token,
        body: JSON.stringify({
          ...channelForm,
          url: channelForm.url || undefined,
        }),
      });
      setChannelForm({ name: "", platform: "youtube", externalId: "", url: "" });
      setOk("Channel registered");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create channel");
    }
  }

  async function createSurvey(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setOk(null);
    try {
      const options = surveyForm.questionOptions
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      await api("/surveys", {
        method: "POST",
        token,
        body: JSON.stringify({
          channelId: surveyForm.channelId,
          title: surveyForm.title,
          description: surveyForm.description,
          rewardCents: Number(surveyForm.rewardCents),
          estimatedMinutes: Number(surveyForm.estimatedMinutes),
          maxResponses: Number(surveyForm.maxResponses) || undefined,
          status: surveyForm.status,
          questions: [
            {
              id: "q1",
              type: "single",
              prompt: surveyForm.questionPrompt,
              options,
              required: true,
            },
            {
              id: "q2",
              type: "rating",
              prompt: "How likely are you to recommend this channel?",
              required: true,
            },
            {
              id: "q3",
              type: "text",
              prompt: "Anything else we should know?",
              required: false,
            },
          ],
          targeting: {
            minDailyWatchMinutes: Number(surveyForm.minDailyWatchMinutes) || undefined,
            minAge: Number(surveyForm.minAge) || undefined,
            maxAge: Number(surveyForm.maxAge) || undefined,
            genders: surveyForm.genders
              .split(",")
              .map((s) => s.trim())
              .filter(Boolean),
            platforms: surveyForm.platforms
              .split(",")
              .map((s) => s.trim())
              .filter(Boolean),
          },
        }),
      });
      setOk("Survey submitted");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create survey");
    }
  }

  return (
    <section className="section">
      <h1 className="page-title">Channel portal</h1>
      <p className="muted">
        Signed in as {user?.displayName}. Register channels, then publish
        demographic-targeted surveys.
      </p>
      {error && <p className="error">{error}</p>}
      {ok && <p className="success">{ok}</p>}

      <div className="split" style={{ marginTop: "1.5rem" }}>
        <div className="stack">
          <form className="panel form" onSubmit={createChannel}>
            <h3>Register a channel</h3>
            <label>
              Channel name
              <input
                value={channelForm.name}
                onChange={(e) =>
                  setChannelForm((f) => ({ ...f, name: e.target.value }))
                }
                required
              />
            </label>
            <div className="row-2">
              <label>
                Platform
                <select
                  value={channelForm.platform}
                  onChange={(e) =>
                    setChannelForm((f) => ({ ...f, platform: e.target.value }))
                  }
                >
                  <option value="youtube">YouTube</option>
                  <option value="twitch">Twitch</option>
                  <option value="kick">Kick</option>
                  <option value="other">Other</option>
                </select>
              </label>
              <label>
                External ID
                <input
                  value={channelForm.externalId}
                  onChange={(e) =>
                    setChannelForm((f) => ({ ...f, externalId: e.target.value }))
                  }
                  placeholder="UC… / login / slug"
                  required
                />
              </label>
            </div>
            <label>
              URL
              <input
                value={channelForm.url}
                onChange={(e) =>
                  setChannelForm((f) => ({ ...f, url: e.target.value }))
                }
                placeholder="https://"
              />
            </label>
            <button className="btn btn-primary" type="submit">
              Save channel
            </button>
          </form>

          <div className="panel">
            <h3>Your channels</h3>
            {channels.length === 0 ? (
              <p className="muted">No channels yet.</p>
            ) : (
              <table className="table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Platform</th>
                    <th>Surveys</th>
                  </tr>
                </thead>
                <tbody>
                  {channels.map((c) => (
                    <tr key={c.id}>
                      <td>{c.name}</td>
                      <td>{c.platform}</td>
                      <td>{c._count?.surveys ?? 0}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        <form className="panel form" onSubmit={createSurvey}>
          <h3>Create survey</h3>
          <label>
            Channel
            <select
              value={surveyForm.channelId}
              onChange={(e) =>
                setSurveyForm((f) => ({ ...f, channelId: e.target.value }))
              }
              required
            >
              <option value="" disabled>
                Select channel
              </option>
              {channels.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.platform})
                </option>
              ))}
            </select>
          </label>
          <label>
            Title
            <input
              value={surveyForm.title}
              onChange={(e) =>
                setSurveyForm((f) => ({ ...f, title: e.target.value }))
              }
              required
            />
          </label>
          <label>
            Description
            <textarea
              rows={3}
              value={surveyForm.description}
              onChange={(e) =>
                setSurveyForm((f) => ({ ...f, description: e.target.value }))
              }
              required
            />
          </label>
          <div className="row-2">
            <label>
              Reward (cents)
              <input
                type="number"
                min={25}
                value={surveyForm.rewardCents}
                onChange={(e) =>
                  setSurveyForm((f) => ({ ...f, rewardCents: e.target.value }))
                }
              />
            </label>
            <label>
              Est. minutes
              <input
                type="number"
                min={1}
                value={surveyForm.estimatedMinutes}
                onChange={(e) =>
                  setSurveyForm((f) => ({
                    ...f,
                    estimatedMinutes: e.target.value,
                  }))
                }
              />
            </label>
          </div>
          <div className="row-2">
            <label>
              Min daily watch (min)
              <input
                type="number"
                value={surveyForm.minDailyWatchMinutes}
                onChange={(e) =>
                  setSurveyForm((f) => ({
                    ...f,
                    minDailyWatchMinutes: e.target.value,
                  }))
                }
              />
            </label>
            <label>
              Max responses
              <input
                type="number"
                value={surveyForm.maxResponses}
                onChange={(e) =>
                  setSurveyForm((f) => ({ ...f, maxResponses: e.target.value }))
                }
              />
            </label>
          </div>
          <div className="row-2">
            <label>
              Min age
              <input
                type="number"
                value={surveyForm.minAge}
                onChange={(e) =>
                  setSurveyForm((f) => ({ ...f, minAge: e.target.value }))
                }
              />
            </label>
            <label>
              Max age
              <input
                type="number"
                value={surveyForm.maxAge}
                onChange={(e) =>
                  setSurveyForm((f) => ({ ...f, maxAge: e.target.value }))
                }
              />
            </label>
          </div>
          <label>
            Genders (comma-separated)
            <input
              value={surveyForm.genders}
              onChange={(e) =>
                setSurveyForm((f) => ({ ...f, genders: e.target.value }))
              }
            />
          </label>
          <label>
            Platforms (comma-separated)
            <input
              value={surveyForm.platforms}
              onChange={(e) =>
                setSurveyForm((f) => ({ ...f, platforms: e.target.value }))
              }
            />
          </label>
          <label>
            Primary question
            <input
              value={surveyForm.questionPrompt}
              onChange={(e) =>
                setSurveyForm((f) => ({ ...f, questionPrompt: e.target.value }))
              }
            />
          </label>
          <label>
            Options (comma-separated)
            <input
              value={surveyForm.questionOptions}
              onChange={(e) =>
                setSurveyForm((f) => ({ ...f, questionOptions: e.target.value }))
              }
            />
          </label>
          <label>
            Status
            <select
              value={surveyForm.status}
              onChange={(e) =>
                setSurveyForm((f) => ({ ...f, status: e.target.value }))
              }
            >
              <option value="draft">Draft</option>
              <option value="active">Active</option>
            </select>
          </label>
          <button className="btn btn-primary" type="submit" disabled={!channels.length}>
            Publish survey
          </button>
        </form>
      </div>

      <div className="panel" style={{ marginTop: "1.5rem" }}>
        <h3>Your surveys</h3>
        {surveys.length === 0 ? (
          <p className="muted">No surveys yet.</p>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Title</th>
                <th>Status</th>
                <th>Reward</th>
                <th>Responses</th>
                <th>Targeting</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {surveys.map((s) => (
                <tr key={s.id}>
                  <td>
                    <div>{s.title}</div>
                    <div className="muted">{s.channelName}</div>
                  </td>
                  <td>
                    <span className={`tag ${s.status}`}>{s.status}</span>
                  </td>
                  <td>{formatCents(s.rewardCents)}</td>
                  <td>
                    {s.responseCount}
                    {s.maxResponses != null ? ` / ${s.maxResponses}` : ""}
                  </td>
                  <td className="muted">
                    {s.targeting.minDailyWatchMinutes ?? 0}+ min/day
                    {s.targeting.minAge != null
                      ? ` · ${s.targeting.minAge}-${s.targeting.maxAge ?? "∞"}`
                      : ""}
                  </td>
                  <td>
                    {s.status === "active" ? (
                      <button
                        type="button"
                        className="btn btn-ghost"
                        onClick={async () => {
                          await api(`/surveys/${s.id}/status`, {
                            method: "PATCH",
                            token,
                            body: JSON.stringify({ status: "paused" }),
                          });
                          await load();
                        }}
                      >
                        Pause
                      </button>
                    ) : (
                      <button
                        type="button"
                        className="btn btn-ghost"
                        onClick={async () => {
                          await api(`/surveys/${s.id}/status`, {
                            method: "PATCH",
                            token,
                            body: JSON.stringify({ status: "active" }),
                          });
                          await load();
                        }}
                      >
                        Activate
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </section>
  );
}
