/** Compare non-negative decimal strings without converting money to a JS number. */
export function compareDecimal(left: string, right: string) {
  if (!/^\d+(?:\.\d+)?$/.test(left) || !/^\d+(?:\.\d+)?$/.test(right)) throw new Error("Số tiền cần dùng chữ số và dấu chấm thập phân.");
  const parts = (value: string) => { const [whole, fraction = ""] = value.split("."); return [whole.replace(/^0+(?=\d)/, ""), fraction.replace(/0+$/, "")]; };
  const [a, af] = parts(left); const [b, bf] = parts(right);
  if (a.length !== b.length) return a.length < b.length ? -1 : 1;
  if (a !== b) return a < b ? -1 : 1;
  const width = Math.max(af.length, bf.length); const ap = af.padEnd(width, "0"); const bp = bf.padEnd(width, "0");
  return ap === bp ? 0 : ap < bp ? -1 : 1;
}

export function decimalPriceError(kind: "exact" | "range" | "from", amount: string, maximum: string, currency: string, unit: string) {
  const decimal = /^\d+(?:\.\d+)?$/;
  if (!decimal.test(amount)) return "Nhập số tiền không âm. Dùng dấu chấm cho phần thập phân; không nhập dấu phân cách hàng nghìn.";
  if (kind === "range" && (!decimal.test(maximum) || compareDecimal(amount, maximum) > 0)) return "Nhập đủ hai đầu khoảng giá. Giá cao phải lớn hơn hoặc bằng giá thấp.";
  if (!/^[A-Z]{3}$/.test(currency)) return "Nhập mã tiền tệ ba chữ cái, ví dụ VND.";
  if (!unit.trim()) return "Nhập đơn vị áp dụng của giá.";
  return "";
}
export function decimalPriceLabel(value: string) {
  const [whole, fraction] = value.split("."); return whole.replace(/\B(?=(\d{3})+(?!\d))/g, ".") + (fraction !== undefined ? `,${fraction}` : "");
}
