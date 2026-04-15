"use client";
/**
 * Avatar — 圆形头像组件，支持图片 URL / base64 / fallback 字符。
 */

import { useState } from "react";

interface AvatarProps {
  src?: string;
  fallback: string;
  size?: number;
  className?: string;
}

export function Avatar({ src, fallback, size = 36, className = "" }: AvatarProps) {
  const [imgError, setImgError] = useState(false);

  const showImage = src && !imgError;

  return (
    <div
      className={`flex-shrink-0 overflow-hidden rounded-full ${className}`}
      style={{ width: size, height: size }}
    >
      {showImage ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt={fallback}
          className="h-full w-full object-cover"
          onError={() => setImgError(true)}
        />
      ) : (
        <div
          className="flex h-full w-full items-center justify-center bg-gradient-to-br from-accent/30 to-warm/30 text-foreground/70"
          style={{ fontSize: size * 0.45 }}
        >
          {fallback}
        </div>
      )}
    </div>
  );
}
