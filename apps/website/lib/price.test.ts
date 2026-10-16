import { expect, test } from "bun:test";
import { formatDecimalAmount } from "./price";

test("formats large amounts without converting exact decimal strings to floating point", () => {
  expect(formatDecimalAmount("999999999999999999999.25")).toBe("999.999.999.999.999.999.999,25");
  expect(formatDecimalAmount("1000000")).toBe("1.000.000");
  expect(formatDecimalAmount("0.50")).toBe("0,50");
});

test("refuses amounts outside the nonnegative decimal grammar", () => {
  for (const value of ["-1", "NaN", "1e3", "1,00", " 10", "01", "1."]) {
    expect(() => formatDecimalAmount(value)).toThrow("Invalid decimal amount");
  }
});
