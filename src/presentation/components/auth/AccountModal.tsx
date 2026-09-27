import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router";
import { useAuthStore } from "../../../application/store/useAuthStore";
import { authClient } from "../../../application/service/authService";
import { useModalStore } from "../../../ui/ModalManager/store";

const EXPORT_FILE_NAME = "mars-terraform-my-data.json";

/** Pobiera plik w przeglądarce z danych w pamięci (bez przekierowania na adres API). */
const downloadBlob = (blob: Blob, fileName: string): void => {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
};

/**
 * Konto użytkownika (T12, RODO): pobranie wszystkich danych (art. 15 i 20) i trwałe usunięcie konta (art. 17).
 * Usunięcie wymaga wpisania własnego adresu e-mail jako potwierdzenia.
 */
export default function AccountModal() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user, deleteAccount, isLoading } = useAuthStore();
  const { close } = useModalStore();
  const [isExporting, setIsExporting] = useState(false);
  const [confirmation, setConfirmation] = useState("");
  const [error, setError] = useState("");
  const [deleted, setDeleted] = useState(false);

  const handleExport = async () => {
    setError("");
    setIsExporting(true);
    try {
      const blob = await authClient.exportMyData();
      downloadBlob(blob, EXPORT_FILE_NAME);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("auth.account.exportFailed"));
    } finally {
      setIsExporting(false);
    }
  };

  const handleDelete = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    try {
      await deleteAccount();
      setDeleted(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("auth.account.deleteFailed"));
    }
  };

  const openPrivacy = () => {
    close();
    navigate("/privacy");
  };

  const canDelete = !!user && confirmation.trim().toLowerCase() === user.email.toLowerCase();

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
      <h2 className="text-xl font-bold mb-2">{t("auth.account.title")}</h2>

      {deleted ? (
        <p className="text-green-400 text-sm" role="status">{t("auth.account.deleted")}</p>
      ) : (
        <>
          {user && (
            <p className="text-sm text-gray-400 mb-4">
              {t("auth.account.signedInAs")} <span className="text-white">{user.email}</span>
            </p>
          )}
          {error && <p className="text-red-400 mb-3 text-sm" role="alert">{error}</p>}

          <section className="mb-5">
            <h3 className="font-semibold mb-1">{t("auth.account.exportTitle")}</h3>
            <p className="text-sm text-gray-400 mb-2">{t("auth.account.exportDesc")}</p>
            <button
              type="button"
              onClick={handleExport}
              disabled={isExporting}
              className="w-full py-2 bg-blue-600 hover:bg-blue-500 rounded font-medium disabled:opacity-50"
            >
              {isExporting ? t("auth.account.exporting") : t("auth.account.exportBtn")}
            </button>
          </section>

          <section className="border-t border-gray-700 pt-4">
            <h3 className="font-semibold text-red-400 mb-1">{t("auth.account.deleteTitle")}</h3>
            <p className="text-sm text-gray-400 mb-2">{t("auth.account.deleteDesc")}</p>
            <form onSubmit={handleDelete} className="space-y-2">
              <label className="block text-sm" htmlFor="account-delete-confirm">
                {t("auth.account.deleteConfirmLabel")}
              </label>
              <input
                id="account-delete-confirm"
                type="email"
                value={confirmation}
                onChange={(e) => setConfirmation(e.target.value)}
                autoComplete="off"
                className="w-full px-3 py-2 rounded bg-gray-800 border border-gray-700 focus:border-red-500 outline-none"
              />
              <button
                type="submit"
                disabled={!canDelete || isLoading}
                className="w-full py-2 bg-red-700 hover:bg-red-600 rounded font-medium disabled:opacity-50"
              >
                {isLoading ? t("auth.account.deleting") : t("auth.account.deleteBtn")}
              </button>
            </form>
          </section>
        </>
      )}

      <div className="mt-4 text-sm text-center">
        <button type="button" onClick={openPrivacy} className="text-blue-400 hover:underline">
          {t("privacy.link")}
        </button>
      </div>
    </div>
  );
}
