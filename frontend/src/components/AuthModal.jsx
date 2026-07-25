import { useState } from "react";
import { useAuth } from "../context/AuthContext";
import "./AuthModal.css";

export default function AuthModal({ message, onClose, onSuccess }) {
  const { login, register } = useAuth();
  const [mode, setMode] = useState("login"); // "login" | "signup"
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const token = mode === "login" ? await login(email, password) : await register(name, email, password);
      onSuccess?.(token);
    } catch (err) {
      setError(err.response?.data?.error || err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose} aria-label="Close">
          ×
        </button>

        <h2>{mode === "login" ? "Login" : "Create an account"}</h2>
        {message && <p className="modal-message">{message}</p>}

        <form onSubmit={handleSubmit} className="auth-form">
          {mode === "signup" && (
            <input
              type="text"
              placeholder="Name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          )}
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />

          {error && <div className="banner banner-error">{error}</div>}

          <button type="submit" className="btn btn-primary" disabled={loading}>
            {loading ? <span className="spinner" /> : mode === "login" ? "Login" : "Sign up"}
          </button>
        </form>

        <p className="modal-switch">
          {mode === "login" ? (
            <>
              Don't have an account?{" "}
              <button onClick={() => setMode("signup")}>Sign up</button>
            </>
          ) : (
            <>
              Already have an account? <button onClick={() => setMode("login")}>Login</button>
            </>
          )}
        </p>
      </div>
    </div>
  );
}
