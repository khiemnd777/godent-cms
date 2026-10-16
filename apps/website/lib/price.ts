/** Preserve all published decimal digits. Formatting never calculates or rounds money. */
export function formatDecimalAmount(value: string): string {
  if (!/^(?:0|[1-9][0-9]*)(?:\.[0-9]+)?$/.test(value)) throw new Error("Invalid decimal amount");
  const [whole, fraction] = value.split(".");
  return whole.replace(/\B(?=(\d{3})+(?!\d))/g, ".") + (fraction === undefined ? "" : `,${fraction}`);
}
