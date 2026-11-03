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

  const line = state === 'correct' ? 'border-ok text-ok' : state === 'wrong' ? 'border-pen animate-shake' : 'border-blue/40 focus:border-blue';

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
        className={`hand w-full border-0 border-b-2 bg-transparent focus-visible:outline-none px-2 pb-1 pt-3 text-center text-[32px] leading-tight text-blue outline-none transition-colors placeholder:text-pencil/40 sm:text-4xl ${line}`}
      />
      <div className="mt-4 flex justify-center gap-1.5">
        {CHARS.map((ch) => (
          <button
            key={ch}
            type="button"
            tabIndex={-1}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => insert(ch)}
            disabled={disabled}
            className="h-11 w-10 rounded-sheet border border-line bg-sheet text-lg font-semibold text-ink shadow-sheet transition-transform hover:border-blue/50 active:translate-y-px disabled:opacity-40"
          >
            {ch}
          </button>
        ))}
      </div>
    </div>
  );
});
