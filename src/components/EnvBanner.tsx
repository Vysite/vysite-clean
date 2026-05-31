import { env } from '../lib/env';

// Shown only in development and staging environments.
// Production renders nothing — no performance cost, no UI noise.
export default function EnvBanner() {
  if (env.isProduction) return null;

  const label = env.isStaging ? 'STAGING' : 'DEVELOPMENT';
  const version = env.version;

  return (
    <div
      className={`
        w-full text-center py-1 text-[10px] font-bold tracking-widest uppercase z-[60] shrink-0 select-none
        ${env.isStaging
          ? 'bg-amber-500 text-amber-950'
          : 'bg-blue-600 text-white'
        }
      `}
    >
      {label} — v{version}
      {env.isStaging && (
        <span className="ml-2 font-normal normal-case tracking-normal">
          Not for live use — staging only
        </span>
      )}
    </div>
  );
}
