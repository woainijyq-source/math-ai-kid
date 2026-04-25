"use client";

export type InputMode = "text" | "voice";

interface InputModeToggleProps {
  mode: InputMode;
  onChange: (mode: InputMode) => void;
  disabled?: boolean;
}

const OPTIONS: Array<{ id: InputMode; label: string; hint: string }> = [
  { id: "text", label: "打字", hint: "慢慢写" },
  { id: "voice", label: "语音", hint: "直接说" },
];

export function InputModeToggle({ mode, onChange, disabled = false }: InputModeToggleProps) {
  return (
    <div className="inline-flex rounded-full border border-white/70 bg-white/72 p-1 shadow-sm backdrop-blur-sm">
      {OPTIONS.map((option) => {
        const active = option.id === mode;
        return (
          <button
            key={option.id}
            type="button"
            onClick={() => onChange(option.id)}
            disabled={disabled}
            className={`min-w-[96px] rounded-full px-3 py-2 text-left transition ${
              active
                ? "bg-accent text-white shadow-sm"
                : "text-ink-soft hover:bg-white/84 hover:text-foreground"
            } disabled:cursor-not-allowed disabled:opacity-50`}
          >
            <span className="block text-sm font-black">{option.label}</span>
            <span className={`block text-[11px] ${active ? "text-white/80" : "text-ink-soft"}`}>
              {option.hint}
            </span>
          </button>
        );
      })}
    </div>
  );
}
