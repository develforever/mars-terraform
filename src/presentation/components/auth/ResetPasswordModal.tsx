import { useState, useEffect } from "react";
import { useSearchParams } from "react-router";
import { useModalStore } from "../../../ui/ModalManager/store";
import { authClient } from "../../../application/service/authService";

export default function ResetPasswordModal() {
  const { open } = useModalStore();
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token") ?? "";
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!token) {
      setError("Invalid or missing reset token.");
    }
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (newPassword !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    setIsSubmitting(true);
    try {
      await authClient.resetPassword({ token, newPassword });
      setSuccess("Password has been reset successfully. You can now log in.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Reset failed");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="bg-gray-900 text-white p-6 rounded-lg w-full max-w-md">
      <h2 className="text-xl font-bold mb-4">Set New Password</h2>
      {error && <p className="text-red-400 mb-3 text-sm">{error}</p>}
      {success && (
        <div className="mb-3">
          <p className="text-green-400 text-sm">{success}</p>
          <button
            onClick={() => open("login")}
            className="mt-2 text-blue-400 hover:underline text-sm"
          >
            Go to login
          </button>
        </div>
      )}
      {!success && (
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block text-sm mb-1">New Password</label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full px-3 py-2 rounded bg-gray-800 border border-gray-700 focus:border-blue-500 outline-none"
              required
            />
          </div>
          <div>
            <label className="block text-sm mb-1">Confirm Password</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full px-3 py-2 rounded bg-gray-800 border border-gray-700 focus:border-blue-500 outline-none"
              required
            />
          </div>
          <button
            type="submit"
            disabled={isSubmitting || !token}
            className="w-full py-2 bg-blue-600 hover:bg-blue-500 rounded font-medium disabled:opacity-50"
          >
            {isSubmitting ? "Resetting..." : "Reset Password"}
          </button>
        </form>
      )}
    </div>
  );
}
