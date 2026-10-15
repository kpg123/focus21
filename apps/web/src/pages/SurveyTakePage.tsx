import { FormEvent, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api, formatCents } from "../api";
import { useAuth } from "../auth";

interface Question {
  id: string;
  type: "single" | "multi" | "text" | "rating";
  prompt: string;
  options?: string[];
  required?: boolean;
}

interface Survey {
  id: string;
  title: string;
  description: string;
  rewardCents: number;
  estimatedMinutes: number;
  questions: Question[];
  channelName?: string;
}

export function SurveyTakePage() {
  const { id } = useParams();
  const { token, refresh } = useAuth();
  const navigate = useNavigate();
  const [survey, setSurvey] = useState<Survey | null>(null);
  const [answers, setAnswers] = useState<Record<string, string | string[] | number>>(
    {},
  );
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!token || !id) return;
    void api<{ survey: Survey }>(`/surveys/${id}`, { token })
      .then((data) => setSurvey(data.survey))
      .catch((err) =>
        setError(err instanceof Error ? err.message : "Survey unavailable"),
      );
  }, [token, id]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!survey || !token) return;
    setBusy(true);
    setError(null);
    try {
      await api(`/surveys/${survey.id}/respond`, {
        method: "POST",
        token,
        body: JSON.stringify({ answers }),
      });
      await refresh();
      navigate("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not submit");
    } finally {
      setBusy(false);
    }
  }

  if (!survey && !error) {
    return <div className="section muted">Loading survey…</div>;
  }

  if (error && !survey) {
    return (
      <section className="section">
        <p className="error">{error}</p>
        <Link to="/dashboard">Back to dashboard</Link>
      </section>
    );
  }

  if (!survey) return null;

  return (
    <section className="section" style={{ maxWidth: 720 }}>
      <h1 className="page-title">{survey.title}</h1>
      <p className="muted">
        {survey.channelName} · Earn {formatCents(survey.rewardCents)} · ~
        {survey.estimatedMinutes} min
      </p>
      <p>{survey.description}</p>

      <form className="panel form" onSubmit={onSubmit} style={{ marginTop: "1.25rem" }}>
        {survey.questions.map((q) => (
          <div className="question" key={q.id}>
            <strong>{q.prompt}</strong>
            {q.type === "single" &&
              q.options?.map((opt) => (
                <label className="choice" key={opt}>
                  <input
                    type="radio"
                    name={q.id}
                    required={q.required !== false}
                    checked={answers[q.id] === opt}
                    onChange={() =>
                      setAnswers((a) => ({ ...a, [q.id]: opt }))
                    }
                  />
                  {opt}
                </label>
              ))}
            {q.type === "multi" &&
              q.options?.map((opt) => {
                const current = Array.isArray(answers[q.id])
                  ? (answers[q.id] as string[])
                  : [];
                return (
                  <label className="choice" key={opt}>
                    <input
                      type="checkbox"
                      checked={current.includes(opt)}
                      onChange={(e) => {
                        const next = e.target.checked
                          ? [...current, opt]
                          : current.filter((x) => x !== opt);
                        setAnswers((a) => ({ ...a, [q.id]: next }));
                      }}
                    />
                    {opt}
                  </label>
                );
              })}
            {q.type === "text" && (
              <textarea
                rows={3}
                required={q.required === true}
                value={(answers[q.id] as string) ?? ""}
                onChange={(e) =>
                  setAnswers((a) => ({ ...a, [q.id]: e.target.value }))
                }
              />
            )}
            {q.type === "rating" && (
              <select
                required={q.required !== false}
                value={(answers[q.id] as number | string) ?? ""}
                onChange={(e) =>
                  setAnswers((a) => ({ ...a, [q.id]: Number(e.target.value) }))
                }
              >
                <option value="" disabled>
                  Rate 1–10
                </option>
                {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            )}
          </div>
        ))}
        {error && <p className="error">{error}</p>}
        <button className="btn btn-primary" type="submit" disabled={busy}>
          {busy ? "Submitting…" : `Submit & earn ${formatCents(survey.rewardCents)}`}
        </button>
      </form>
    </section>
  );
}
