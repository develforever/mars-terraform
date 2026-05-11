import { useState, useEffect } from "react";
import { useSearchParams } from "react-router";
import { useModalStore } from "../../../ui/ModalManager/store";
import { authClient } from "../../../application/service/authService";

export default function VerifyEmailModal() {
  const { open } = useModalStore();
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token") ?? "";
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!token) {
      setStatus("error");
      setMessage("Invalid or missing verification token.");
      return;
    }

    authClient
      .verifyEmail({ token })
      .then(() => {
        setStatus("success");
        setMessage("Email verified successfully! You can now log in.");
      })
      .catch((err: Error) => {
        setStatus("error");
        setMessage(err.message || "Verification failed.");
      });
  }, [token]);

  return (
    <div className="bg-gray-900 text-white p-6 rounded-lg w-full max-w-md">
      <h2 className="text-xl font-bold mb-4">Email Verification</h2>
      {status === "loading" && <p className="text-gray-300 text-sm">Verifying your email...</p>}
      {status === "success" && (
        <div>
          <p className="text-green-400 text-sm mb-3">{message}</p>
          <button
            onClick={() => open("login")}
            className="w-full py-2 bg-blue-600 hover:bg-blue-500 rounded font-medium"
          >
            Log In
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
            Back to Login
          </button>
        </div>
      )}
    </div>
  );
}
