import { describe, expect, test } from "bun:test";
import { compareDecimal, decimalPriceError, decimalPriceLabel } from "./decimal-price";

describe("exact decimal price input", () => {
  test("preserves amounts beyond JS safe integer precision", () => {
    expect(compareDecimal("9007199254740992.01", "9007199254740992.02")).toBe(-1);
    expect(compareDecimal("1000000000000000000", "999999999999999999.99")).toBe(1);
    expect(decimalPriceLabel("9007199254740992.010001")).toBe("9.007.199.254.740.992,010001");
  });
  test("accepts equal range boundaries and explicit zero", () => {
    expect(compareDecimal("0001.20", "1.2000")).toBe(0);
    expect(decimalPriceError("range", "0", "0.00", "VND", "lần")).toBe("");
  });
  test("rejects missing, negative, exponent and reversed amounts", () => {
    for (const amount of ["", "-1", "1e3", "1,000", ".5"]) expect(decimalPriceError("exact", amount, "", "VND", "răng")).not.toBe("");
    expect(decimalPriceError("range", "12.1", "12.09", "VND", "răng")).not.toBe("");
    expect(decimalPriceError("range", "1", "", "VND", "răng")).not.toBe("");
  });
  test("requires currency and unit for every price type", () => {
    expect(decimalPriceError("from", "1.01", "", "VND", "răng")).toBe("");
    expect(decimalPriceError("from", "1", "", "", "răng")).not.toBe("");
    expect(decimalPriceError("exact", "1", "", "VND", " ")).not.toBe("");
  });
});
