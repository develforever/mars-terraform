import { useState } from "react";
import { useAuthStore } from "../../../application/store/useAuthStore";
import { useModalStore } from "../../../ui/ModalManager/store";

export default function LoginModal() {
  const { login, isLoading } = useAuthStore();
  const { open, close } = useModalStore();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    try {
      await login(email, password);
      close();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    }
  };

  const handleGoogle = async () => {
    try {
      const { authClient } = await import("../../../application/service/authService");
      const url = await authClient.getGoogleAuthUrl();
      window.location.href = url;
    } catch {
      setError("Failed to initiate Google login");
    }
  };

  const handleGithub = async () => {
    try {
      const { authClient } = await import("../../../application/service/authService");
      const url = await authClient.getGithubAuthUrl();
      window.location.href = url;
    } catch {
      setError("Failed to initiate GitHub login");
    }
  };

  return (
    <div className="bg-gray-900 text-white p-6 rounded-lg w-full max-w-md">
      <h2 className="text-xl font-bold mb-4">Log In</h2>
      {error && <p className="text-red-400 mb-3 text-sm">{error}</p>}
      <form onSubmit={handleSubmit} className="space-y-3">
        <div>
          <label className="block text-sm mb-1">Email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full px-3 py-2 rounded bg-gray-800 border border-gray-700 focus:border-blue-500 outline-none"
            required
          />
        </div>
        <div>
          <label className="block text-sm mb-1">Password</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full px-3 py-2 rounded bg-gray-800 border border-gray-700 focus:border-blue-500 outline-none"
            required
          />
        </div>
        <button
          type="submit"
          disabled={isLoading}
          className="w-full py-2 bg-blue-600 hover:bg-blue-500 rounded font-medium disabled:opacity-50"
        >
          {isLoading ? "Logging in..." : "Log In"}
        </button>
      </form>
      <div className="mt-4 flex gap-2">
        <button
          onClick={handleGoogle}
          className="flex-1 py-2 bg-red-600 hover:bg-red-500 rounded text-sm font-medium"
        >
          Google
        </button>
        <button
          onClick={handleGithub}
          className="flex-1 py-2 bg-gray-700 hover:bg-gray-600 rounded text-sm font-medium"
        >
          GitHub
        </button>
      </div>
      <div className="mt-4 text-sm text-center space-y-2">
        <button onClick={() => open("forgot-password")} className="text-blue-400 hover:underline block w-full">
          Forgot password?
        </button>
        <button onClick={() => open("register")} className="text-blue-400 hover:underline block w-full">
          Don&apos;t have an account? Register
        </button>
      </div>
    </div>
  );
}
