type Props = {
  size?: number;
  radius?: number;
  tile?: string;
  glyph?: string;
  className?: string;
};

export function HPMark({
  size = 26,
  radius = 7,
  tile = "var(--hp-accent)",
  glyph = "#0a0a0c",
  className,
}: Props) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      className={className}
    >
      <rect width="32" height="32" rx={radius} fill={tile} />
      <path
        d="M9 8 L9 24"
        stroke={glyph}
        strokeWidth="2.6"
        strokeLinecap="square"
      />
      <path
        d="M23 8 L21 24"
        stroke={glyph}
        strokeWidth="2.6"
        strokeLinecap="square"
      />
      <path
        d="M9 17 L22 14"
        stroke={glyph}
        strokeWidth="2.6"
        strokeLinecap="square"
      />
    </svg>
  );
}

export function HPGlyph({
  size = 24,
  color = "var(--hp-accent)",
  className,
}: Omit<Props, "tile" | "radius" | "glyph"> & { color?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      className={className}
    >
      <path
        d="M9 8 L9 24"
        stroke={color}
        strokeWidth="2.6"
        strokeLinecap="square"
      />
      <path
        d="M23 8 L21 24"
        stroke={color}
        strokeWidth="2.6"
        strokeLinecap="square"
      />
      <path
        d="M9 17 L22 14"
        stroke={color}
        strokeWidth="2.6"
        strokeLinecap="square"
      />
    </svg>
  );
}
