import { afterEach, expect, spyOn, test } from "bun:test";
import { createBuilderAttempt, requestBuilderChallenge, sendBuilderAttempt } from "./builder-consultation";
import { ids, landingContext } from "../test-support/builder";
const originalFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = originalFetch; });
const values = { name: "Test visitor", phone: "0900 123 456", email: "", preferredLanguage: "vi" as const, preferredChannel: "phone" as const, message: "Please contact me", consent: true, interestServiceSlug: "" };
test("landing attempts keep source, consent locale and contact language independent with optional interest absent", () => {
  const attempt = createBuilderAttempt(values, landingContext("en"), { source: "search" });
  expect(attempt.formLocale).toBe("en"); expect(attempt.preferredLanguage).toBe("vi"); expect(attempt.sourcePublicationId).toBe(ids.publication); expect(attempt.sourceConfigPublicationId).toBe(ids.config);
  expect(attempt).not.toHaveProperty("interestServiceSlug"); expect(Object.isFrozen(attempt)).toBe(true); expect(Object.isFrozen(attempt.tracking)).toBe(true);
  expect(() => createBuilderAttempt({ ...values, interestServiceSlug: "fake-service" }, landingContext())).toThrow();
});
test("ambiguous timeout and retry send the same frozen request to the exact anonymous landing route", async () => {
  const bodies: string[] = [], attempt = createBuilderAttempt(values, landingContext()), context = landingContext(); let count = 0;
  spyOn(globalThis, "fetch").mockImplementation(Object.assign(async (...[url, options]: Parameters<typeof fetch>) => { expect(String(url)).toBe("http://127.0.0.1:5890/api/public/intake/builder/clinic-a/en/landing/campaign-a"); expect(options?.credentials).toBe("omit"); expect(options?.redirect).toBe("error"); expect(options?.cache).toBe("no-store"); bodies.push(String(options?.body)); if (++count === 1) throw new Error("timeout"); return Response.json({ status: "accepted" }); }, { preconnect: originalFetch.preconnect }));
  await expect(sendBuilderAttempt("clinic-a", "campaign-a", context, attempt)).rejects.toMatchObject({ uncertain: true });
  expect(await sendBuilderAttempt("clinic-a", "campaign-a", context, attempt)).toEqual({ status: "accepted" }); expect(bodies[0]).toBe(bodies[1]);
});
test("M4 CAPTCHA stays bound to the source route and refuses unavailable or expired challenges", async () => {
  const fetcher = spyOn(globalThis, "fetch").mockResolvedValue(Response.json({ token: ids.publication, prompt: "1 + 2 = ?", expiresAt: "2000-01-01T00:00:00.000Z", kind: "local-arithmetic" }));
  await expect(requestBuilderChallenge("clinic-a", "campaign-a", landingContext(), ids.resource)).rejects.toMatchObject({ code: "CAPTCHA_UNAVAILABLE", uncertain: false });
  expect(String(fetcher.mock.calls[0][0])).toEndWith("/en/landing/campaign-a/challenge");
});
