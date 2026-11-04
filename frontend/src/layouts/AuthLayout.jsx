import { Outlet } from 'react-router-dom';
import { APP_NAME } from '../constants/app.constants';

const STEPS = [
  ['Upload', 'PDF, JPG or PNG documents grouped into a case'],
  ['Extract', 'OCR reads the text; AI organises it into fields'],
  ['Check', 'Rules test formats, dates, totals and cross-document consistency'],
  ['Decide', 'A reviewer approves, rejects or asks for corrections'],
];

export default function AuthLayout() {
  return (
    <div className="grid min-h-screen lg:grid-cols-[1.05fr_1fr]">
      <aside className="relative hidden overflow-hidden bg-ink-950 p-12 text-stone-300 lg:flex lg:flex-col">
        <div className="flex items-center gap-2.5">
          <img src="/favicon.svg" alt="" className="h-9 w-9" />
          <span className="text-lg font-semibold text-white">{APP_NAME}</span>
        </div>
        <div className="my-auto max-w-md">
          <h1 className="text-3xl leading-tight font-semibold text-white">
            Read, check and compare documents — then let a person decide.
          </h1>
          <ol className="mt-10 space-y-5">
            {STEPS.map(([title, text], i) => (
              <li key={title} className="flex gap-4">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-brand-500/50 font-mono text-sm text-brand-200">{i + 1}</span>
                <div><div className="font-medium text-white">{title}</div><div className="text-sm text-stone-400">{text}</div></div>
              </li>
            ))}
          </ol>
        </div>
        <p className="text-xs text-stone-500">Automated checks are preliminary and do not establish that a document is genuine.</p>
        <div className="pointer-events-none absolute -right-24 -bottom-24 h-96 w-96 rounded-full bg-brand-700/20 blur-3xl" />
      </aside>
      <main className="flex items-center justify-center px-4 py-12 sm:px-8">
        <div className="w-full max-w-sm"><Outlet /></div>
      </main>
    </div>
  );
}
