import { Link } from 'react-router-dom';

export interface BrandLogoProps {
  className?: string;
}

export default function BrandLogo({ className = '' }: BrandLogoProps) {
  return (
    <Link
      to="/record"
      aria-label="DuelTools ホーム"
      className={`inline-flex items-center gap-2 rounded-md text-brand-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-action focus-visible:ring-offset-2 focus-visible:ring-offset-brand-surface ${className}`}
    >
      <img
        src={`${import.meta.env.BASE_URL}favicon.svg`}
        alt=""
        width={32}
        height={32}
        className="h-8 w-8 shrink-0"
      />
      <span className="text-xl font-semibold tracking-tight">DuelTools</span>
    </Link>
  );
}
