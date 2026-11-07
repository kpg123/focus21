import { Link } from "react-router-dom";

export function LandingPage() {
  return (
    <>
      <section className="hero">
        <div className="hero-media" aria-hidden />
        <div className="hero-content">
          <p className="hero-brand">
            Focus<span>21</span>
          </p>
          <h1>Get paid for the attention you already give.</h1>
          <p>
            Track watch time across YouTube, Twitch, and Kick. When creators
            need honest feedback, you earn for answering.
          </p>
          <div className="cta-row">
            <Link to="/signup" className="btn btn-primary">
              Join as a viewer
            </Link>
            <Link to="/signup?role=channel_owner" className="btn btn-ghost">
              Launch creator portal
            </Link>
          </div>
        </div>
      </section>

      <section className="section" id="how">
        <h2>Three pieces. One loop.</h2>
        <p className="lead">
          A browser extension captures watch signals. Creators target real
          audiences. Viewers get paid surveys that actually fit them.
        </p>
        <div className="feature-grid">
          <article className="feature">
            <div className="index">01 — EXTENSION</div>
            <h3>Silent watch tracking</h3>
            <p>
              Detects the channel and platform you are on, accumulates watch
              time, and pops up only when a paid survey matches your profile.
            </p>
          </article>
          <article className="feature">
            <div className="index">02 — TARGETING</div>
            <h3>Demographic precision</h3>
            <p>
              Creators filter by daily watch hours, age, gender, platform, and
              channel affinity before spending a cent on responses.
            </p>
          </article>
          <article className="feature">
            <div className="index">03 — PAYOUTS</div>
            <h3>Earn while you watch</h3>
            <p>
              Complete short surveys for cash credit. Your balance updates
              instantly when a response is accepted.
            </p>
          </article>
        </div>
      </section>

      <section className="section" id="creators">
        <div className="split">
          <div>
            <h2>Built for channel owners who need signal, not spam.</h2>
            <p className="lead">
              Submit surveys to people who already spend time with your content
              — one hour a day, specific age bands, gender splits, platform
              mix — then read the responses in your portal.
            </p>
            <Link to="/portal" className="btn btn-accent-soft">
              Open channel portal
            </Link>
          </div>
          <div className="panel">
            <h3>Example targeting</h3>
            <div className="stat-line">
              <span>Min daily watch</span>
              <strong>60 minutes</strong>
            </div>
            <div className="stat-line">
              <span>Gender</span>
              <strong>Any</strong>
            </div>
            <div className="stat-line">
              <span>Age range</span>
              <strong>18–45</strong>
            </div>
            <div className="stat-line">
              <span>Platforms</span>
              <strong>YouTube · Twitch</strong>
            </div>
            <div className="stat-line">
              <span>Reward</span>
              <strong>$2.50 / response</strong>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
