/** Both website media and private preview access stay on the existing local API gateway. */
export function localMediaUrl(value: string): string {
  const url = new URL(value, "http://127.0.0.1:5890/api/");
  if (url.origin !== "http://127.0.0.1:5890" || !url.pathname.startsWith("/api/") || /[\\\s]/.test(value) || url.pathname.split("/").includes("..")) throw new Error("Invalid media destination");
  return new URL(url.pathname + url.search, "http://127.0.0.1:5890").href;
}
