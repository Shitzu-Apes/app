export function getXCallbackParams(url: URL): {
  status: "success" | "error";
  message: string;
} | null {
  const params = new URLSearchParams(url.search);

  const status = params.get("status") as "success" | "error";
  if (!status || (status !== "success" && status !== "error")) {
    return null;
  }
  const message = decodeURIComponent(params.get("message") || "Unknown error");

  return { status, message };
}
