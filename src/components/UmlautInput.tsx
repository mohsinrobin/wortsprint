// Answer input with ä ö ü ß buttons that insert at the cursor (mobile friendly).
import { forwardRef, useImperativeHandle, useRef } from 'react';

interface Props {
  value: string;
  onChange: (v: string) => void;
  onSubmit: () => void;
  disabled?: boolean;
  state?: 'idle' | 'correct' | 'wrong';
  placeholder?: string;
  onFocusChange?: (focused: boolean) => void;
  /** Phone with the keyboard open: tighter layout, the send button joins the letter row. */
  compact?: boolean;
  submitLabel?: string;
}

const CHARS = ['ä', 'ö', 'ü', 'ß', 'Ä', 'Ö', 'Ü'];
// Answers ignore case, so the compact row drops the capitals to make room.
const COMPACT_CHARS = ['ä', 'ö', 'ü', 'ß'];

export const UmlautInput = forwardRef<HTMLInputElement, Props>(function UmlautInput({ value, onChange, onSubmit, disabled, state = 'idle', placeholder, onFocusChange, compact, submitLabel }, ref) {
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
        onFocus={() => onFocusChange?.(true)}
        onBlur={() => onFocusChange?.(false)}
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
        className={`hand w-full border-0 border-b-2 bg-transparent focus-visible:outline-none px-2 pb-1 text-center leading-tight ${compact ? 'pt-1 text-[28px]' : 'pt-3 text-[32px]'} text-blue outline-none transition-colors placeholder:text-pencil/40 sm:text-4xl ${line}`}
      />
      <div className={`flex gap-1.5 ${compact ? 'mt-3' : 'mt-4 justify-center'}`}>
        {(compact ? COMPACT_CHARS : CHARS).map((ch) => (
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
        {compact && (
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={onSubmit}
            disabled={disabled || !value.trim()}
            className="btn-primary ml-auto h-11 px-5"
          >
            {submitLabel}
          </button>
        )}
      </div>
    </div>
  );
});
