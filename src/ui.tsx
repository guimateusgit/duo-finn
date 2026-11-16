import {
  createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode
} from 'react';
import { Icon } from './icons';
import { editBRL, parseBRL } from './format';
import type { Estado, Mes, Pessoa } from './types';

// ---------- contexto global do app ----------
type EstadoPronto = Extract<Estado, { pronto: true }>;

interface Ctx {
  estado: EstadoPronto;
  perfil: Pessoa;            // quem está usando o app agora
  trocarPerfil: () => void;
  verPessoa: (id: number) => void; // abre os gastos pessoais de alguém
  mes: Mes;
  versao: number;            // muda a cada gravação: as telas recarregam
  recarregar: () => void;
  trocarMes: (m: Mes) => void;
  toast: (msg: string, tipo?: 'ok' | 'erro') => void;
}
export const AppCtx = createContext<Ctx | null>(null);
export const useApp = () => {
  const c = useContext(AppCtx);
  if (!c) throw new Error('AppCtx ausente');
  return c;
};

/** Carrega dados e refaz quando deps ou a versão global mudam. */
export function useDados<T>(fn: () => Promise<T>, deps: unknown[]): { dados: T | null; erro: string | null } {
  const { versao } = useApp();
  const [dados, setDados] = useState<T | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  useEffect(() => {
    let vivo = true;
    fn().then((d) => { if (vivo) { setDados(d); setErro(null); } })
      .catch((e: Error) => { if (vivo) setErro(e.message); });
    return () => { vivo = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [versao, ...deps]);
  return { dados, erro };
}

/** Executa uma gravação, mostra erro em toast e recarrega as telas. */
export function useAcao() {
  const { recarregar, toast } = useApp();
  return useCallback(async <T,>(fn: () => Promise<T>, okMsg?: string): Promise<T | undefined> => {
    try {
      const r = await fn();
      recarregar();
      if (okMsg) toast(okMsg, 'ok');
      return r;
    } catch (e) {
      toast((e as Error).message, 'erro');
      return undefined;
    }
  }, [recarregar, toast]);
}

// ---------- toasts ----------
export interface ToastItem { id: number; msg: string; tipo?: 'ok' | 'erro' }
export function Toaster({ itens }: { itens: ToastItem[] }) {
  return (
    <div className="toaster" role="status" aria-live="polite">
      {itens.map((t) => <div key={t.id} className={`toast ${t.tipo ?? ''}`}>{t.msg}</div>)}
    </div>
  );
}

// ---------- modal ----------
export function Modal({ titulo, sub, onClose, children, rodape }: {
  titulo: string; sub?: string; onClose: () => void; children: ReactNode; rodape?: ReactNode;
}) {
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [onClose]);
  return (
    <div className="overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal" role="dialog" aria-modal="true" aria-label={titulo}>
        <div className="modal-head">
          <div>
            <h2>{titulo}</h2>
            {sub && <p className="card-sub" style={{ fontSize: 13 }}>{sub}</p>}
          </div>
          <button className="icon-btn" type="button" onClick={onClose} aria-label="Fechar"><Icon.x /></button>
        </div>
        {children}
        {rodape && <div className="modal-foot">{rodape}</div>}
      </div>
    </div>
  );
}

// ---------- campo de dinheiro (pt-BR) ----------
export function MoneyInput({ value, onChange, autoFocus, inline, id, ariaLabel }: {
  value: number; onChange: (v: number) => void; autoFocus?: boolean; inline?: boolean; id?: string; ariaLabel?: string;
}) {
  const [texto, setTexto] = useState(editBRL(value));
  const focado = useRef(false);
  useEffect(() => { if (!focado.current) setTexto(editBRL(value)); }, [value]);
  return (
    <input
      id={id}
      aria-label={ariaLabel}
      className={`input num${inline ? ' inline' : ''}`}
      inputMode="decimal"
      placeholder="0,00"
      autoFocus={autoFocus}
      value={texto}
      onFocus={(e) => { focado.current = true; e.currentTarget.select(); }}
      onChange={(e) => { setTexto(e.target.value); onChange(parseBRL(e.target.value)); }}
      onBlur={() => { focado.current = false; setTexto(editBRL(parseBRL(texto))); }}
    />
  );
}

export function Field({ label, children, hint, full }: { label: string; children: ReactNode; hint?: string; full?: boolean }) {
  return (
    <label className={`field${full ? ' full' : ''}`}>
      <span>{label}</span>
      {children}
      {hint && <small>{hint}</small>}
    </label>
  );
}

export function Check({ on, onToggle, label }: { on: boolean; onToggle: () => void; label: string }) {
  return (
    <button type="button" className="chk" role="checkbox" aria-checked={on} aria-label={label} title={label} onClick={onToggle}>
      {on && <Icon.check />}
    </button>
  );
}

export function Ring({ valor, cor = 'var(--accent)' }: { valor: number; cor?: string }) {
  const C = 2 * Math.PI * 34;
  const v = Math.max(0, Math.min(1, valor || 0));
  return (
    <svg width="84" height="84" viewBox="0 0 84 84" aria-hidden="true" style={{ flexShrink: 0 }}>
      <circle cx="42" cy="42" r="34" fill="none" stroke="var(--track)" strokeWidth="10" />
      <circle cx="42" cy="42" r="34" fill="none" stroke={cor} strokeWidth="10" strokeLinecap="round"
        strokeDasharray={C} strokeDashoffset={C * (1 - v)} transform="rotate(-90 42 42)" style={{ transition: 'stroke-dashoffset .4s' }} />
      <text x="42" y="47" textAnchor="middle" fontSize="15" fontWeight="700" fill="currentColor">
        {Math.round((valor || 0) * 100)}%
      </text>
    </svg>
  );
}
