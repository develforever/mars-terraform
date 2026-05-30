import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useSearchParams } from "react-router";
import { useModalStore } from "../../../ui/ModalManager/store";
import { authClient } from "../../../application/service/authService";

export default function VerifyEmailModal() {
  const { t } = useTranslation();
  const { open, modalData } = useModalStore();
  const [searchParams] = useSearchParams();
  const token = modalData?.token || (searchParams.get("token") ?? "");
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!token) {
      setStatus("error");
      setMessage(t("auth.verify.invalidToken"));
      return;
    }

    authClient
      .verifyEmail({ token })
      .then(() => {
        setStatus("success");
        setMessage(t("auth.verify.success"));
      })
      .catch((err: Error) => {
        setStatus("error");
        setMessage(err.message || t("auth.verify.failed"));
      });
  }, [token]);

  return (
    <div className="bg-gray-900 text-white p-6 rounded-lg w-full max-w-md">
      <h2 className="text-xl font-bold mb-4">{t("auth.verify.title")}</h2>
      {status === "loading" && <p className="text-gray-300 text-sm">{t("auth.verify.verifying")}</p>}
      {status === "success" && (
        <div>
          <p className="text-green-400 text-sm mb-3">{message}</p>
          <button
            onClick={() => open("login")}
            className="w-full py-2 bg-blue-600 hover:bg-blue-500 rounded font-medium"
          >
            {t("auth.verify.loginBtn")}
          </button>
        </div>
      )}
      {status === "error" && (
        <div>
          <p className="text-red-400 text-sm mb-3">{message}</p>
          <button
            onClick={() => open("login")}
            className="w-full py-2 bg-gray-700 hover:bg-gray-600 rounded font-medium"
          >
            {t("auth.verify.backToLogin")}
          </button>
        </div>
      )}
    </div>
  );
}
