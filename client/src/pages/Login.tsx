import React, { useState } from "react";
import { login } from "../lib/api.ts";
import { saveAuth } from "../lib/auth.ts";
import { Eye, EyeOff } from "lucide-react";

interface LoginProps {
  onLogin: (name: string) => void;
}

export function Login({ onLogin }: LoginProps) {
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !password) return;
    setLoading(true);
    setError("");
    try {
      const data = await login(name.trim(), password);
      saveAuth(data.token, data.name);
      onLogin(data.name);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-bg flex items-center justify-center p-4">
      {/* Background glow */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-primary/10 rounded-full blur-[120px]" />
      </div>

      <div className="relative w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-2xl bg-primary mx-auto flex items-center justify-center mb-4 shadow-lg shadow-primary/30">
            <span className="text-white text-2xl font-bold">M</span>
          </div>
          <h1 className="text-xl font-bold text-text">Melleka Command Center</h1>
          <p className="text-sm text-muted mt-1">Your AI team is ready</p>
        </div>

        {/* Card */}
        <form
          onSubmit={handleSubmit}
          className="bg-surface border border-border rounded-2xl p-6 space-y-4 shadow-xl"
        >
          <div>
            <label className="block text-xs font-medium text-muted mb-1.5">Your name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Sarah"
              autoFocus
              className="w-full bg-surface-2 border border-border text-text text-sm rounded-xl px-3 py-2.5 outline-none focus:border-primary transition-colors placeholder-muted"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-muted mb-1.5">Team password</label>
            <div className="relative">
              <input
                type={showPw ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter team password"
                className="w-full bg-surface-2 border border-border text-text text-sm rounded-xl px-3 py-2.5 pr-10 outline-none focus:border-primary transition-colors placeholder-muted"
              />
              <button
                type="button"
                onClick={() => setShowPw((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-text transition-colors"
              >
                {showPw ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>
          </div>

          {error && (
            <p className="text-xs text-error bg-error/10 border border-error/20 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading || !name.trim() || !password}
            className="w-full bg-primary hover:bg-primary-hover disabled:bg-muted-dark disabled:text-muted text-white font-semibold text-sm py-2.5 rounded-xl transition-colors"
          >
            {loading ? "Entering..." : "Enter Command Center"}
          </button>
        </form>

        <p className="text-center text-[11px] text-muted mt-4">
          Melleka Turbo AI — Internal Team Tool
        </p>
      </div>
    </div>
  );
}
