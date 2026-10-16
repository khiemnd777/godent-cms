import { afterEach, expect, spyOn, test } from "bun:test";
import { createAttempt, requestChallenge, sendAttempt, IntakeFailure, type ConsultationValues } from "./consultation";

const values: ConsultationValues = { name: "", phone: "090 123 4567", email: "", preferredLanguage: "vi", preferredChannel: "phone", message: "", consent: true };
const publicationId = "a4c7c2f9-f38f-4bbb-9252-2567873d620a";
const originalFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = originalFetch; });

test("normalizes phone presentation without country coercion and requires the selected contact", () => {
  expect(createAttempt(values, publicationId).phone).toBe("0901234567");
  expect(createAttempt({ ...values, phone: "+84 (90) 123-4567" }, publicationId).phone).toBe("84901234567");
  expect(() => createAttempt({ ...values, preferredChannel: "email" }, publicationId)).toThrow();
  expect(() => createAttempt({ ...values, email: "invalid" }, publicationId)).toThrow();
  expect(() => createAttempt({ ...values, consent: false }, publicationId)).toThrow();
});
test("accepts email-only contact and checks every provided field", () => {
  expect(createAttempt({ ...values, phone: "", email: "guest@example.invalid", preferredChannel: "email" }, publicationId).email).toBe("guest@example.invalid");
  expect(() => createAttempt({ ...values, phone: "123", email: "guest@example.invalid", preferredChannel: "email" }, publicationId)).toThrow();
});
test("counts 500 Unicode code points after NFC and rejects 501", () => {
  expect([...createAttempt({ ...values, message: "e\u0301".repeat(500) }, publicationId).message!]).toHaveLength(500);
  expect([...createAttempt({ ...values, message: "🦷".repeat(500) }, publicationId).message!]).toHaveLength(500);
  expect(() => createAttempt({ ...values, message: "🦷".repeat(501) }, publicationId)).toThrow();
});
test("freezes one request key and payload across ambiguous response loss and retry", async () => {
  const attempt = createAttempt(values, publicationId);
  values.name = "Changed after submission";
  const calls: string[] = [];
  const intercepted: typeof fetch = Object.assign(async (...[, options]: Parameters<typeof fetch>) => {
    calls.push(String(options?.body));
    if (calls.length === 1) throw new TypeError("network unavailable");
    return Response.json({ status: "accepted" });
  }, { preconnect: originalFetch.preconnect });
  spyOn(globalThis, "fetch").mockImplementation(intercepted);
  try { await sendAttempt("synthetic", "service", attempt); throw new Error("Expected unknown result"); }
  catch (error) { expect(error).toBeInstanceOf(IntakeFailure); expect((error as IntakeFailure).uncertain).toBe(true); }
  expect(await sendAttempt("synthetic", "service", attempt)).toEqual({ status: "accepted" });
  expect(calls[0]).toBe(calls[1]);
  expect(attempt.name).toBeUndefined();
  values.name = "";
});
test("uses the dedicated anonymous API without credentials or URL contact data", async () => {
  let destination = ""; let request: RequestInit | undefined;
  const intercepted: typeof fetch = Object.assign(async (...[url, options]: Parameters<typeof fetch>) => { destination = String(url); request = options; return Response.json({ status: "accepted" }); }, { preconnect: originalFetch.preconnect });
  spyOn(globalThis, "fetch").mockImplementation(intercepted);
  await sendAttempt("synthetic", "service", createAttempt(values, publicationId));
  expect(destination).toBe("http://127.0.0.1:5890/api/public/intake/sites/synthetic/services/service");
  expect(request?.credentials).toBe("omit");
  expect(request?.redirect).toBe("error");
  expect(new Headers(request?.headers).get("Content-Type")).toBe("application/json");
});
test("keeps server errors redacted and treats invalid success as an unknown result", async () => {
  spyOn(globalThis, "fetch").mockResolvedValueOnce(Response.json({ statusCode: 428, error: "private diagnostic", code: "CAPTCHA_REQUIRED" }, { status: 428 })).mockResolvedValueOnce(Response.json({ contact: "private" }));
  const attempt = createAttempt(values, publicationId);
  try { await sendAttempt("synthetic", "service", attempt); } catch (error) { expect((error as IntakeFailure).code).toBe("CAPTCHA_REQUIRED"); expect((error as Error).message).not.toContain("private diagnostic"); }
  try { await sendAttempt("synthetic", "service", attempt); } catch (error) { expect((error as IntakeFailure).uncertain).toBe(true); }
});
test("keeps the frozen key after conflicts and fails closed when challenge loading fails", async () => {
  const attempt = createAttempt(values, publicationId);
  expect(attempt.requestKey).toMatch(/^[a-f0-9-]{36}$/);
  expect(Object.isFrozen(attempt)).toBe(true);
  spyOn(globalThis, "fetch").mockResolvedValueOnce(Response.json({ code: "REQUEST_CONFLICT" }, { status: 409 })).mockRejectedValueOnce(new TypeError("network unavailable"));
  await expect(sendAttempt("synthetic", "service", attempt)).rejects.toMatchObject({ status: 409, code: "REQUEST_CONFLICT", uncertain: false });
  await expect(requestChallenge("synthetic", "service", attempt.requestKey)).rejects.toMatchObject({ status: 503, code: "CAPTCHA_UNAVAILABLE", uncertain: false });
});
