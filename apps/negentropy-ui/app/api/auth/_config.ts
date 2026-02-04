export function getAuthBaseUrl() {
  return (
    process.env.AUTH_BASE_URL ||
    process.env.AGUI_BASE_URL ||
    process.env.NEXT_PUBLIC_AGUI_BASE_URL
  );
}
