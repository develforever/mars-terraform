import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useModalStore } from "../../../ui/ModalManager/store";
import { authClient } from "../../../application/service/authService";

export default function ForgotPasswordModal() {
  const { t } = useTranslation();
  const { open, close } = useModalStore();
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    setIsSubmitting(true);
    try {
      await authClient.forgotPassword({ email });
      setSuccess(t("auth.forgot.success"));
    } catch (err) {
      setError(err instanceof Error ? err.message : t("auth.forgot.failed"));
    } finally {
      setIsSubmitting(false);
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
      <h2 className="text-xl font-bold mb-4">{t("auth.forgot.title")}</h2>
      {error && <p className="text-red-400 mb-3 text-sm">{error}</p>}
      {success && <p className="text-green-400 mb-3 text-sm">{success}</p>}
      <form onSubmit={handleSubmit} className="space-y-3">
        <div>
          <label className="block text-sm mb-1">{t("auth.forgot.email")}</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full px-3 py-2 rounded bg-gray-800 border border-gray-700 focus:border-blue-500 outline-none"
            required
          />
        </div>
        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full py-2 bg-blue-600 hover:bg-blue-500 rounded font-medium disabled:opacity-50"
        >
          {isSubmitting ? t("auth.forgot.submitting") : t("auth.forgot.submit")}
        </button>
      </form>
      <div className="mt-4 text-sm text-center">
        <button onClick={() => open("login")} className="text-blue-400 hover:underline">
          {t("auth.forgot.backToLogin")}
        </button>
      </div>
    </div>
  );
}
