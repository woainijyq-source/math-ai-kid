"use client";

type ChoiceVisualKind = "fridge" | "window" | "bag" | "spark";

function getChoiceVisualKind(label: string, description: string): ChoiceVisualKind {
  const text = `${label} ${description}`;
  if (/(冰箱|牛奶|水果|吃的|点心|食物)/.test(text)) return "fridge";
  if (/(窗|树|鸟|外面|天空|花|路)/.test(text)) return "window";
  if (/(书包|包|书|铅笔|文具|作业)/.test(text)) return "bag";
  return "spark";
}

function ChoiceMiniScene({ kind }: { kind: ChoiceVisualKind }) {
  return (
    <span className={`bp-choice-scene bp-choice-scene-${kind}`} aria-hidden="true">
      <span className="bp-choice-sky" />
      {kind === "fridge" && (
        <>
          <span className="bp-choice-fridge" />
          <span className="bp-choice-bottle" />
          <span className="bp-choice-fruit" />
        </>
      )}
      {kind === "window" && (
        <>
          <span className="bp-choice-window-frame" />
          <span className="bp-choice-tree" />
          <span className="bp-choice-bird" />
        </>
      )}
      {kind === "bag" && (
        <>
          <span className="bp-choice-bag" />
          <span className="bp-choice-pencil" />
          <span className="bp-choice-note" />
        </>
      )}
      {kind === "spark" && (
        <>
          <span className="bp-choice-spark-one" />
          <span className="bp-choice-spark-two" />
          <span className="bp-choice-spark-three" />
        </>
      )}
    </span>
  );
}

export function ChoiceCard({
  label,
  description,
  badge,
  imageUrl,
  imageStatus = "idle",
  disabled = false,
  onClick,
}: {
  label: string;
  description: string;
  badge?: string;
  imageUrl?: string;
  imageStatus?: "idle" | "loading" | "ready" | "failed";
  disabled?: boolean;
  onClick: () => void;
}) {
  const visualKind = getChoiceVisualKind(label, description);

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`bp-choice-card bp-choice-card-${visualKind} ${
        imageStatus === "loading"
          ? "bp-choice-card-loading"
          : ""
      } ${
        disabled
          ? "cursor-not-allowed opacity-60"
          : ""
      }`}
    >
      <span className="bp-choice-art">
        {imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={imageUrl}
            alt={label}
            className="bp-choice-image"
          />
        ) : (
          <ChoiceMiniScene kind={visualKind} />
        )}
        {imageStatus === "loading" && (
          <span className="bp-choice-image-state" aria-live="polite">
            配图中
          </span>
        )}
        {imageStatus === "failed" && (
          <span className="bp-choice-image-state bp-choice-image-state-muted">
            小场景
          </span>
        )}
        <span className="bp-choice-zoom" aria-hidden="true">⌕</span>
      </span>

      <span className="bp-choice-body">
        {badge && <span className="bp-choice-badge">{badge}</span>}
        <span className="bp-choice-title">{label}</span>
        {description && <span className="bp-choice-desc">{description}</span>}
        <span className="bp-choice-action">
          <span className="bp-choice-action-hand" aria-hidden="true">☝</span>
          <span>选这个</span>
        </span>
      </span>
    </button>
  );
}
