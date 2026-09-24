import { describe, expect, it } from "vitest";
import { HttpError, type HttpErrorStatus } from "./HttpError";

describe("HttpError", () => {
  it("is an Error with the given status, message and name", () => {
    const err = new HttpError(404, "User not found");

    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(HttpError);
    expect(err.status).toBe(404);
    expect(err.message).toBe("User not found");
    expect(err.name).toBe("HttpError");
    expect(String(err)).toBe("HttpError: User not found");
  });

  it.each<HttpErrorStatus>([400, 401, 403, 404, 409, 422, 429])("keeps status %i", (status) => {
    expect(new HttpError(status, "x").status).toBe(status);
  });

  it("is rejected by promise matchers with its message", async () => {
    await expect(Promise.reject(new HttpError(401, "Invalid credentials"))).rejects.toMatchObject({
      status: 401,
      message: "Invalid credentials",
    });
  });
});
