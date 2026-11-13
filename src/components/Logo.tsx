"use client";

import { useId } from "react";

interface LogoProps {
  /** Pixel size (it's square). */
  size?: number;
  className?: string;
  /** Use the fixed brand blue instead of following the user's accent colour. */
  fixed?: boolean;
  title?: string;
}

/**
 * The Upshift Garage mark: a garage outline with an H-pattern gear gate inside —
 * reverse in the top-left, first gear lit. Same artwork as public/logo.svg
 * (which the installers/favicons are generated from), drawn inline so its blue
 * follows the accent colour the user picked in Settings.
 */
export function Logo({ size = 34, className, fixed = false, title = "Upshift Garage" }: LogoProps) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, "");
  const bg = `bg${uid}`, acc = `acc${uid}`, glow = `glow${uid}`;
  const light = fixed ? "#7cb4ff" : "color-mix(in srgb, hsl(var(--theme)) 55%, white)";
  const dark = fixed ? "#2f6df0" : "hsl(var(--theme))";

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width={size} height={size}
      className={className} role="img" aria-label={title}
    >
      <title>{title}</title>
      <defs>
        <linearGradient id={bg} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#151c2c" /><stop offset="1" stopColor="#090c14" /></linearGradient>
        <linearGradient id={acc} x1="0" y1="0" x2="1" y2="1"><stop offset="0" style={{ stopColor: light }} /><stop offset="1" style={{ stopColor: dark }} /></linearGradient>
        <filter id={glow} x="-80%" y="-80%" width="260%" height="260%"><feGaussianBlur stdDeviation="9" result="b" /><feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
      </defs>
      <rect width="512" height="512" rx="112" fill={`url(#${bg})`} />
      <path d="M102 412V192L256 108L410 192V412Z" fill="none" stroke={`url(#${acc})`} strokeWidth="18" strokeLinejoin="round" />
      <g stroke="#e8ecf4" strokeWidth="12" strokeLinecap="round" fill="none"><path d="M163 232V304M225 232V376M287 232V376M349 232V376M163 304H349" /></g>
      <g fill="#090c14" stroke="#e8ecf4" strokeWidth="6">
        <circle cx="163" cy="232" r="9" /><circle cx="287" cy="232" r="9" /><circle cx="349" cy="232" r="9" />
        <circle cx="225" cy="376" r="9" /><circle cx="287" cy="376" r="9" /><circle cx="349" cy="376" r="9" />
      </g>
      <circle cx="225" cy="232" r="21" fill={`url(#${acc})`} filter={`url(#${glow})`} />
    </svg>
  );
}
