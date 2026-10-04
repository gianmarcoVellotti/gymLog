import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { describeError } from '../lib/errors';

export interface FormField {
  key: string;
  label: string;
  initial?: string;
  placeholder?: string;
  type?: 'text' | 'time' | 'textarea';
  inputMode?: 'text' | 'numeric' | 'decimal';
  maxLength?: number;
  required?: boolean;
}

interface ConfirmOpts {
  title: string;
  message?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
}

interface FormOpts {
  title: string;
  message?: ReactNode;
  fields: FormField[];
  confirmLabel?: string;
}

export interface DialogApi {
  confirm(o: ConfirmOpts): Promise<boolean>;
  info(title: string, message?: ReactNode): Promise<void>;
  form(o: FormOpts): Promise<Record<string, string> | null>;
  toast(text: string): void;
  /** Esegue un'azione: se lancia, mostra l'errore in italiano e restituisce undefined. */
  run<T>(fn: () => Promise<T>): Promise<T | undefined>;
}

type DialogState =
  | { kind: 'confirm'; opts: ConfirmOpts; done: (v: boolean) => void }
  | { kind: 'info'; title: string; message?: ReactNode; done: () => void }
  | { kind: 'form'; opts: FormOpts; done: (v: Record<string, string> | null) => void };

const Ctx = createContext<DialogApi | null>(null);

export function useDialogs(): DialogApi {
  const api = useContext(Ctx);
  if (!api) throw new Error('DialogProvider mancante');
  return api;
}

export function DialogProvider({ children }: { children: ReactNode }) {
  const [queue, setQueue] = useState<DialogState[]>([]);
  const [toastText, setToastText] = useState<string | null>(null);
  const toastTimer = useRef<number | undefined>(undefined);

  const push = useCallback((d: DialogState) => setQueue((q) => [...q, d]), []);
  const pop = useCallback(() => setQueue((q) => q.slice(1)), []);

  const api = useMemo<DialogApi>(
    () => ({
      confirm: (opts) => new Promise((resolve) => push({ kind: 'confirm', opts, done: resolve })),
      info: (title, message) => new Promise((resolve) => push({ kind: 'info', title, message, done: resolve })),
      form: (opts) => new Promise((resolve) => push({ kind: 'form', opts, done: resolve })),
      toast: (text) => {
        setToastText(text);
        window.clearTimeout(toastTimer.current);
        toastTimer.current = window.setTimeout(() => setToastText(null), 4000);
      },
      async run(fn) {
        try {
          return await fn();
        } catch (e) {
          await new Promise<void>((resolve) =>
            push({ kind: 'info', title: 'Operazione non riuscita', message: describeError(e), done: resolve }),
          );
          return undefined;
        }
      },
    }),
    [push],
  );

  const current = queue[0];
  return (
    <Ctx.Provider value={api}>
      {children}
      {current && <DialogView key={queue.length + current.kind} dialog={current} close={pop} />}
      {toastText && (
        <div className="toast glass" role="status">
          {toastText}
        </div>
      )}
    </Ctx.Provider>
  );
}

function DialogView({ dialog, close }: { dialog: DialogState; close: () => void }) {
  const [values, setValues] = useState<Record<string, string>>(() =>
    dialog.kind === 'form' ? Object.fromEntries(dialog.opts.fields.map((f) => [f.key, f.initial ?? ''])) : {},
  );
  const firstRef = useRef<HTMLInputElement & HTMLTextAreaElement>(null);
  useEffect(() => {
    firstRef.current?.focus();
  }, []);

  const finish = (fn: () => void) => {
    fn();
    close();
  };

  if (dialog.kind === 'info') {
    return (
      <div className="overlay" role="presentation">
        <div className="dialog glass" role="alertdialog" aria-modal="true">
          <h3>{dialog.title}</h3>
          {dialog.message && <div className="dialog-body">{dialog.message}</div>}
          <div className="dialog-actions">
            <button className="btn primary" onClick={() => finish(dialog.done)}>
              OK
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (dialog.kind === 'confirm') {
    const { opts } = dialog;
    return (
      <div className="overlay" role="presentation">
        <div className="dialog glass" role="alertdialog" aria-modal="true">
          <h3>{opts.title}</h3>
          {opts.message && <div className="dialog-body">{opts.message}</div>}
          <div className="dialog-actions">
            <button className="btn" onClick={() => finish(() => dialog.done(false))}>
              {opts.cancelLabel ?? 'Annulla'}
            </button>
            <button className={`btn ${opts.danger ? 'danger' : 'primary'}`} onClick={() => finish(() => dialog.done(true))}>
              {opts.confirmLabel ?? 'Conferma'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  const { opts } = dialog;
  const valid = opts.fields.every((f) => !f.required || (values[f.key] ?? '').trim() !== '');
  const submit = () => {
    if (valid) finish(() => dialog.done(values));
  };
  return (
    <div className="overlay" role="presentation">
      <form
        className="dialog glass"
        role="dialog"
        aria-modal="true"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <h3>{opts.title}</h3>
        {opts.message && <div className="dialog-body">{opts.message}</div>}
        {opts.fields.map((f, i) => (
          <label key={f.key} className="field-block">
            <span className="lab">{f.label}</span>
            {f.type === 'textarea' ? (
              <textarea
                ref={i === 0 ? firstRef : undefined}
                className="input"
                rows={3}
                value={values[f.key] ?? ''}
                maxLength={f.maxLength}
                placeholder={f.placeholder}
                onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))}
              />
            ) : (
              <input
                ref={i === 0 ? firstRef : undefined}
                className="input"
                type={f.type === 'time' ? 'time' : 'text'}
                inputMode={f.inputMode}
                value={values[f.key] ?? ''}
                maxLength={f.maxLength}
                placeholder={f.placeholder}
                onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))}
              />
            )}
          </label>
        ))}
        <div className="dialog-actions">
          <button type="button" className="btn" onClick={() => finish(() => dialog.done(null))}>
            Annulla
          </button>
          <button type="submit" className="btn primary" disabled={!valid}>
            {opts.confirmLabel ?? 'Salva'}
          </button>
        </div>
      </form>
    </div>
  );
}
