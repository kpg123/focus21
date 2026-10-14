import { Link, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "../auth";
import { formatCents } from "../api";

export function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  return (
    <div className="shell">
      <header className="nav">
        <Link to="/" className="brand">
          <span className="brand-mark" aria-hidden />
          Focus21
        </Link>
        <nav className="nav-links">
          <a href="/#how">How it works</a>
          <a href="/#creators">Creators</a>
          {user ? (
            <>
              <Link to="/dashboard">Dashboard</Link>
              <Link to="/portal">Channel portal</Link>
              <span className="muted">{formatCents(user.balanceCents)}</span>
              <button
                className="btn btn-ghost"
                type="button"
                onClick={() => {
                  logout();
                  navigate("/");
                }}
              >
                Sign out
              </button>
            </>
          ) : (
            <>
              <Link to="/login">Sign in</Link>
              <Link to="/signup" className="btn btn-primary">
                Get started
              </Link>
            </>
          )}
        </nav>
      </header>
      <Outlet />
      <footer className="footer">
        <span>Focus21 — attention that pays both ways.</span>
        <span>YouTube · Twitch · Kick</span>
      </footer>
    </div>
  );
}
