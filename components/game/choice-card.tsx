"use client";

import Image from "next/image";

export function ChoiceCard({
  label,
  description,
  badge,
  imageUrl,
  disabled = false,
  onClick,
}: {
  label: string;
  description: string;
  badge?: string;
  imageUrl?: string;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`storybook-card choice-card-hero group flex min-h-[216px] w-full flex-col overflow-hidden rounded-[30px] border-2 text-left transition ${
        disabled
          ? "cursor-not-allowed opacity-60"
          : "hover:-translate-y-1 hover:border-accent hover:shadow-[0_24px_50px_rgba(31,102,89,0.16)]"
      }`}
    >
      <div className="choice-card-art relative flex min-h-[92px] items-center justify-center overflow-hidden px-4 pb-3 pt-4">
        {imageUrl ? (
          <Image
            src={imageUrl}
            alt={label}
            width={160}
            height={80}
            className="max-h-20 w-auto object-contain"
          />
        ) : (
          <>
            {badge ? (
              <div className="inline-flex rounded-full bg-white/82 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-accent shadow-sm">
                {badge}
              </div>
            ) : null}
            <div className="choice-card-orb absolute right-4 top-4 h-12 w-12 rounded-full" />
            <div className="choice-card-path absolute bottom-0 left-4 right-4 h-7 rounded-t-[20px]" />
          </>
        )}
      </div>

      <div className="flex flex-1 flex-col px-4 pb-4 pt-3">
        <div className="text-xl font-semibold tracking-tight text-foreground">{label}</div>
        <div className="mt-2 text-sm leading-6 text-ink-soft">{description}</div>
        <div className="mt-auto pt-5 text-base font-semibold text-accent">就走这条路</div>
      </div>
    </button>
  );
}
