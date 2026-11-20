import React from 'react';

interface MasarLogoProps {
  size?: number;
  className?: string;
}

export const MasarLogo: React.FC<MasarLogoProps> = ({ size = 28, className = '' }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 64 64"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    aria-hidden="true"
  >
    <rect width="64" height="64" rx="16" className="fill-slate-900 dark:fill-[#0B101B]" />
    <rect x="1.5" y="1.5" width="61" height="61" rx="14.5" className="stroke-slate-700/60 dark:stroke-white/10" strokeWidth="1.5" />
    <defs>
      <linearGradient id="masarLogoGrad" x1="12" y1="48" x2="52" y2="16" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stopColor="#06B6D4" />
        <stop offset="60%" stopColor="#3B82F6" />
        <stop offset="100%" stopColor="#8B5CF6" />
      </linearGradient>
    </defs>
    <path
      d="M14 46L22 20L32 34.5L42 20L49.5 46"
      stroke="url(#masarLogoGrad)"
      strokeWidth="4.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M42 20L50.5 15.5"
      stroke="#06B6D4"
      strokeWidth="3.2"
      strokeLinecap="round"
    />
    <circle cx="32" cy="34.5" r="2.6" className="fill-slate-900 dark:fill-[#0B101B]" stroke="#38BDF8" strokeWidth="1.8" />
    <circle cx="50.5" cy="15.5" r="2.2" fill="#06B6D4" />
  </svg>
);
