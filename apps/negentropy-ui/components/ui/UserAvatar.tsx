"use client";

import Image from "next/image";
import { useState } from "react";

import { buildAvatarProxyUrl } from "@/lib/avatar";
import { cn } from "@/lib/utils";

type UserAvatarProps = {
  picture?: string;
  name?: string;
  email?: string;
  className?: string;
  fallbackClassName?: string;
  alt?: string;
};

function getInitial(name?: string, email?: string): string {
  return (name || email || "?").slice(0, 1).toUpperCase();
}

export function UserAvatar({
  picture,
  name,
  email,
  className,
  fallbackClassName,
  alt,
}: UserAvatarProps) {
  const [failedPicture, setFailedPicture] = useState<string | null>(null);

  const avatarSrc =
    picture && picture !== failedPicture ? buildAvatarProxyUrl(picture) : null;
  const avatarAlt = alt || name || email || "User";

  if (avatarSrc) {
    return (
      <div className={cn("relative overflow-hidden rounded-full", className)}>
        <Image
          src={avatarSrc}
          alt={avatarAlt}
          fill
          sizes="32px"
          className="object-cover"
          referrerPolicy="no-referrer"
          onError={() => setFailedPicture(picture ?? null)}
        />
      </div>
    );
  }

  return (
    <div
      aria-label={avatarAlt}
      className={cn(
        "flex items-center justify-center rounded-full bg-primary/10 text-[10px] font-bold text-primary",
        className,
        fallbackClassName,
      )}
    >
      {getInitial(name, email)}
    </div>
  );
}
