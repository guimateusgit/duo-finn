import type { Mes } from './types';

const brlFmt = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const pctFmt = new Intl.NumberFormat('pt-BR', { style: 'percent', maximumFractionDigits: 1 });
const compactFmt = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', notation: 'compact', maximumFractionDigits: 1 });

export const brl = (v: number) => brlFmt.format(v || 0);
export const pct = (v: number) => pctFmt.format(isFinite(v) ? v : 0);
export const brlCompact = (v: number) => compactFmt.format(v || 0);

/** Lê "1.234,56", "1234.56", "R$ 1.234" etc. */
export function parseBRL(texto: string): number {
  const limpo = String(texto).replace(/[^\d,.-]/g, '');
  if (!limpo) return 0;
  let normal: string;
  if (limpo.includes(',')) normal = limpo.replace(/\./g, '').replace(',', '.');      // 1.234,56
  else if (/^-?\d{1,3}(\.\d{3})+$/.test(limpo)) normal = limpo.replace(/\./g, '');    // 3.200 / 10.700
  else normal = limpo;                                                                // 1234.5
  const n = Number(normal);
  return isFinite(n) ? Math.round(n * 100) / 100 : 0;
}

export const editBRL = (v: number) =>
  v ? new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v) : '';

export function mesHoje(): Mes {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export function somaMes(mes: Mes, n: number): Mes {
  const [a, m] = mes.split('-').map(Number);
  const d = new Date(a, m - 1 + n, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

const dataDoMes = (mes: Mes) => {
  const [a, m] = mes.split('-').map(Number);
  return new Date(a, m - 1, 1);
};

export const nomeMes = (mes: Mes) => new Intl.DateTimeFormat('pt-BR', { month: 'long' }).format(dataDoMes(mes));
export const nomeMesAno = (mes: Mes) => {
  const t = new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' }).format(dataDoMes(mes));
  return t.charAt(0).toUpperCase() + t.slice(1); // "Novembro de 2026"
};
export function mesCurto(mes: Mes, comAno = false) {
  const m = new Intl.DateTimeFormat('pt-BR', { month: 'short' }).format(dataDoMes(mes)).replace('.', '');
  const cap = m.charAt(0).toUpperCase() + m.slice(1);
  return comAno ? `${cap} ${mes.slice(2, 4)}` : cap;
}

export const dia2 = (d: number) => String(d).padStart(2, '0');

export const iniciais = (nome: string) =>
  nome.trim().split(/\s+/).slice(0, 2).map((p) => p[0]?.toUpperCase() ?? '').join('') || '?';
