// Answer input with ä ö ü ß buttons that insert at the cursor (mobile friendly).
import { forwardRef, useImperativeHandle, useRef } from 'react';

interface Props {
  value: string;
  onChange: (v: string) => void;
  onSubmit: () => void;
  disabled?: boolean;
  state?: 'idle' | 'correct' | 'wrong';
  placeholder?: string;
}

const CHARS = ['ä', 'ö', 'ü', 'ß', 'Ä', 'Ö', 'Ü'];

export const UmlautInput = forwardRef<HTMLInputElement, Props>(function UmlautInput({ value, onChange, onSubmit, disabled, state = 'idle', placeholder }, ref) {
  const inner = useRef<HTMLInputElement>(null);
  useImperativeHandle(ref, () => inner.current!);

  const insert = (ch: string) => {
    const el = inner.current;
    if (!el || disabled) return;
    const start = el.selectionStart ?? value.length;
    const end = el.selectionEnd ?? value.length;
    const next = value.slice(0, start) + ch + value.slice(end);
    onChange(next);
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(start + ch.length, start + ch.length);
    });
  };

  const ring =
    state === 'correct' ? 'border-emerald-400 bg-emerald-400/10' : state === 'wrong' ? 'border-red-400 bg-red-400/10 animate-shake' : 'border-[var(--line)] focus:border-emerald-400/70';

  return (
    <div>
      <input
        ref={inner}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            onSubmit();
          }
        }}
        placeholder={placeholder}
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="off"
        spellCheck={false}
        enterKeyHint="go"
        lang="de"
        className={`w-full rounded-2xl border-2 bg-[var(--surface-2)] px-4 py-4 text-center text-2xl font-semibold tracking-wide outline-none transition sm:text-3xl ${ring}`}
      />
      <div className="mt-3 flex justify-center gap-1.5">
        {CHARS.map((ch) => (
          <button
            key={ch}
            type="button"
            tabIndex={-1}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => insert(ch)}
            disabled={disabled}
            className="h-10 w-10 rounded-lg border border-[var(--line)] bg-[var(--surface-2)] text-lg font-semibold text-[var(--ink)] hover:border-emerald-400/60 active:scale-95 disabled:opacity-40"
          >
            {ch}
          </button>
        ))}
      </div>
    </div>
  );
});
