/** The fused T+M monogram. Exact SVG from the live site: stroke based,
 *  amber #e9a83a on ink #16130e. Do not redraw as a filled shape. */
export default function Logo({
  size = 34,
  className,
}: {
  size?: number;
  className?: string;
}) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 64 64"
      role="img"
      aria-label="Tohu Movies logo"
    >
      <rect width="64" height="64" rx="14" fill="#16130e" />
      <g fill="none" stroke="#e9a83a" strokeWidth="10">
        <path d="M9 16h46" />
        <path d="M14 16v36M50 16v36M32 16v36" />
        <path d="M14 25l18 18 18-18" />
      </g>
    </svg>
  );
}
