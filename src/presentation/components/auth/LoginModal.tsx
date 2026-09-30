import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useAuthStore } from "../../../application/store/useAuthStore";
import { TOTP_REQUIRED_MESSAGE } from "../../../application/service/authService";
import { useModalStore } from "../../../ui/ModalManager/store";

/**
 * Logowanie numerem konta (T13). Gdy konto ma włączony authenticator, serwer odpowiada
 * `TOTP code required` i formularz dopytuje o 6-cyfrowy kod.
 */
export default function LoginModal() {
  const { t } = useTranslation();
  const { login, isLoading } = useAuthStore();
  const { open, close } = useModalStore();
  const [accountNumber, setAccountNumber] = useState("");
  const [totpCode, setTotpCode] = useState("");
  const [needsTotp, setNeedsTotp] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    try {
      await login(accountNumber, needsTotp ? totpCode : undefined);
      close();
    } catch (err) {
      const message = err instanceof Error ? err.message : "";
      if (message === TOTP_REQUIRED_MESSAGE) {
        setNeedsTotp(true);
        return;
      }
      setError(message || t("auth.login.loginFailed"));
    }
  };

  return (
    <div className="bg-gray-900 text-white p-6 rounded-lg w-full max-w-md relative">
      <button
        type="button"
        onClick={close}
        className="absolute top-4 right-4 text-gray-400 hover:text-white transition-colors text-lg p-1 rounded hover:bg-gray-800"
        aria-label={t("auth.account.close")}
      >
        ✕
      </button>
      <h2 className="text-xl font-bold mb-4">{t("auth.login.title")}</h2>
      {error && <p className="text-red-400 mb-3 text-sm" role="alert">{error}</p>}
      <form onSubmit={handleSubmit} className="space-y-3">
        <div>
          <label className="block text-sm mb-1" htmlFor="login-account-number">{t("auth.login.accountNumber")}</label>
          <input
            id="login-account-number"
            type="text"
            value={accountNumber}
            onChange={(e) => setAccountNumber(e.target.value)}
            placeholder="XXXX-XXXX-XXXX-XXXX-XXXX"
            autoComplete="username"
            spellCheck={false}
            className="w-full px-3 py-2 rounded bg-gray-800 border border-gray-700 focus:border-blue-500 outline-none font-mono uppercase"
            required
          />
        </div>
        {needsTotp && (
          <div>
            <label className="block text-sm mb-1" htmlFor="login-totp">{t("auth.login.totpCode")}</label>
            <input
              id="login-totp"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              value={totpCode}
              onChange={(e) => setTotpCode(e.target.value)}
              maxLength={6}
              className="w-full px-3 py-2 rounded bg-gray-800 border border-gray-700 focus:border-blue-500 outline-none font-mono tracking-widest"
              required
              autoFocus
            />
            <p className="text-xs text-gray-400 mt-1">{t("auth.login.totpHint")}</p>
          </div>
        )}
        <button
          type="submit"
          disabled={isLoading}
          className="w-full py-2 bg-blue-600 hover:bg-blue-500 rounded font-medium disabled:opacity-50"
        >
          {isLoading ? t("auth.login.submitting") : t("auth.login.submit")}
        </button>
      </form>
      <div className="mt-4 text-sm text-center">
        <button type="button" onClick={() => open("register")} className="text-blue-400 hover:underline">
          {t("auth.login.noAccount")}
        </button>
      </div>
    </div>
  );
}
