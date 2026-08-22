import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useAuthStore } from "../../../application/store/useAuthStore";
import { authClient, type AuthProviders } from "../../../application/service/authService";
import { useModalStore } from "../../../ui/ModalManager/store";

export default function LoginModal() {
  const { t } = useTranslation();
  const { login, isLoading } = useAuthStore();
  const { open, close } = useModalStore();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [providers, setProviders] = useState<AuthProviders>({ google: false, github: false });

  useEffect(() => {
    let mounted = true;

    authClient
      .getAuthProviders()
      .then((result) => {
        if (mounted) {
          setProviders(result);
        }
      })
      .catch(() => {
        if (mounted) {
          setProviders({ google: false, github: false });
        }
      });

    return () => {
      mounted = false;
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    try {
      await login(email, password);
      close();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("auth.login.loginFailed"));
    }
  };

  const handleGoogle = async () => {
    try {
      const url = await authClient.getGoogleAuthUrl();
      window.location.href = url;
    } catch {
      setError(t("auth.login.googleFailed"));
    }
  };

  const handleGithub = async () => {
    try {
      const url = await authClient.getGithubAuthUrl();
      window.location.href = url;
    } catch {
      setError(t("auth.login.githubFailed"));
    }
  };

  return (
    <div className="bg-gray-900 text-white p-6 rounded-lg w-full max-w-md relative">
      <button
        type="button"
        onClick={close}
        className="absolute top-4 right-4 text-gray-400 hover:text-white transition-colors text-lg p-1 rounded hover:bg-gray-800"
        aria-label="Zamknij"
      >
        ✕
      </button>
      <h2 className="text-xl font-bold mb-4">{t("auth.login.title")}</h2>
      {error && <p className="text-red-400 mb-3 text-sm">{error}</p>}
      <form onSubmit={handleSubmit} className="space-y-3">
        <div>
          <label className="block text-sm mb-1">{t("auth.login.email")}</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full px-3 py-2 rounded bg-gray-800 border border-gray-700 focus:border-blue-500 outline-none"
            required
          />
        </div>
        <div>
          <label className="block text-sm mb-1">{t("auth.login.password")}</label>
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
          {isLoading ? t("auth.login.submitting") : t("auth.login.submit")}
        </button>
      </form>
      {(providers.google || providers.github) && (
        <div className="mt-4 flex gap-2">
          {providers.google && (
            <button
              type="button"
              onClick={handleGoogle}
              className="flex-1 py-2 bg-red-600 hover:bg-red-500 rounded text-sm font-medium"
            >
              Google
            </button>
          )}
          {providers.github && (
            <button
              type="button"
              onClick={handleGithub}
              className="flex-1 py-2 bg-gray-700 hover:bg-gray-600 rounded text-sm font-medium"
            >
              GitHub
            </button>
          )}
        </div>
      )}
      <div className="mt-4 text-sm text-center space-y-2">
        <button onClick={() => open("forgot-password")} className="text-blue-400 hover:underline block w-full">
          {t("auth.login.forgotPassword")}
        </button>
        <button onClick={() => open("register")} className="text-blue-400 hover:underline block w-full">
          {t("auth.login.noAccount")}
        </button>
      </div>
    </div>
  );
}
