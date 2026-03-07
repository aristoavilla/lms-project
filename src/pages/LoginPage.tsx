import { useState, type FormEvent } from "react";
import {
  getDefaultSeededPassword,
  loginWithEmail,
  loginWithOAuth,
  registerAccount,
} from "../services/lmsService";

interface Props {
  onLogin: (userId: string) => void;
}

export function LoginPage({ onLogin }: Props) {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState(getDefaultSeededPassword());
  const [name, setName] = useState("");
  const [classId, setClassId] = useState("class-1A");
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleLogin(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    setStatus(null);
    try {
      const user = await loginWithEmail(email, password);
      onLogin(user._id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to log in.");
    } finally {
      setLoading(false);
    }
  }

  async function handleOAuth() {
    setLoading(true);
    setError(null);
    setStatus(null);
    try {
      const user = await loginWithOAuth(email);
      onLogin(user._id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "OAuth sign-in failed.");
    } finally {
      setLoading(false);
    }
  }

  async function handleRegister(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    setStatus(null);
    try {
      await registerAccount({
        name,
        email,
        password,
        provider: "email",
        classId,
      });
      setStatus("Registration submitted. Your account is waiting for administrator approval.");
      setMode("login");
      setName("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to register.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="gate-screen">
      <h1>Saint Lucia School LMS</h1>
      <p>Sign in with email/password or register an account for administrator approval.</p>
      <div className="card">
        <div className="pill-nav secondary">
          <button
            type="button"
            className={mode === "login" ? "active" : ""}
            onClick={() => {
              setMode("login");
              setError(null);
            }}
          >
            Login
          </button>
          <button
            type="button"
            className={mode === "register" ? "active" : ""}
            onClick={() => {
              setMode("register");
              setError(null);
            }}
          >
            Register
          </button>
        </div>

        {mode === "login" ? (
          <form className="stack-list" onSubmit={handleLogin}>
            <label>
              Email
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
              />
            </label>
            <label>
              Password
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
              />
            </label>
            <div className="row-between">
              <button type="submit" disabled={loading}>
                {loading ? "Signing in..." : "Login"}
              </button>
              <button type="button" onClick={handleOAuth} disabled={loading || !email.trim()}>
                OAuth Login
              </button>
            </div>
          </form>
        ) : (
          <form className="stack-list" onSubmit={handleRegister}>
            <label>
              Full Name
              <input value={name} onChange={(event) => setName(event.target.value)} required />
            </label>
            <label>
              Email
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
              />
            </label>
            <label>
              Password
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
              />
            </label>
            <label>
              Class
              <input value={classId} onChange={(event) => setClassId(event.target.value)} required />
            </label>
            <button type="submit" disabled={loading}>
              {loading ? "Submitting..." : "Create Account"}
            </button>
          </form>
        )}

        {error ? <p className="error-text">{error}</p> : null}
        {status ? <p className="badge success">{status}</p> : null}
      </div>
    </div>
  );
}
