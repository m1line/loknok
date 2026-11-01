import type { ReactNode } from 'react';

interface PhoneFrameProps {
  children: ReactNode;
}

export default function PhoneFrame({ children }: PhoneFrameProps) {
  return (
    <div className="flex min-h-dvh items-stretch justify-center md:items-center md:bg-gradient-to-br md:from-slate-200 md:to-slate-300 md:py-8">
      <div className="relative flex h-dvh w-full flex-col overflow-hidden bg-white md:h-[844px] md:w-[390px] md:rounded-[48px] md:border-[10px] md:border-slate-900 md:shadow-2xl">
        <div className="hidden h-11 shrink-0 items-center justify-between px-7 text-sm font-semibold text-slate-900 md:flex">
          <span>9:41</span>
          <span className="flex items-center gap-1 text-[11px]">
            <span className="h-2.5 w-4 rounded-sm border border-slate-900" />
          </span>
        </div>
        {children}
      </div>
    </div>
  );
}
