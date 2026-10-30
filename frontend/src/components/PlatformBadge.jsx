import { platformMark } from "../data.mjs";

function platformSlug(platform) {
  return String(platform || "other")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "") || "other";
}

export default function PlatformBadge({ platform, compact = false, iconOnly = false }) {
  return (
    <span
      className={`platform-badge platform-${platformSlug(platform)}${compact ? " compact" : ""}${iconOnly ? " icon-only" : ""}`}
      title={platform}
      aria-label={platform}
    >
      <span className="platform-logo" aria-hidden="true">
        {platformMark(platform)}
      </span>
      {!iconOnly && <span>{platform}</span>}
    </span>
  );
}
