const AVATAR_PROXY_PATH = "/api/auth/avatar";

export function buildAvatarProxyUrl(picture?: string): string | null {
  if (!picture) {
    return null;
  }

  const searchParams = new URLSearchParams({ src: picture });
  return `${AVATAR_PROXY_PATH}?${searchParams.toString()}`;
}
