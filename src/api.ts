import type {
  Cartao, Conta, ContaInput, Divisao, Estado, Gasto, LinhaHistorico, Mes, Meta, Resumo
} from './types';

type Resposta<T> = { ok: true; dados: T } | { ok: false; erro: string };

interface Bridge {
  [metodo: string]: (...args: unknown[]) => Promise<Resposta<unknown>>;
}

declare global {
  interface Window { duofinn?: Bridge }
}

async function chamar<T>(metodo: string, ...args: unknown[]): Promise<T> {
  const bridge = window.duofinn;
  if (!bridge) throw new Error('Camada de dados indisponível. Abra o Duo Finn pelo aplicativo.');
  const r = (await bridge[metodo](...args)) as Resposta<T>;
  if (!r.ok) throw new Error(r.erro);
  return r.dados;
}

export const api = {
  estado: () => chamar<Estado>('estado'),
  configurarCasal: (dados: { nomeCasal: string; mes: Mes; pessoas: { nome: string; renda_mensal: number }[] }) =>
    chamar<Estado>('configurarCasal', dados),
  atualizarPessoa: (p: { id: number; nome: string; renda_mensal: number }) => chamar<Estado>('atualizarPessoa', p),
  atualizarConfig: (c: { nome_casal?: string; modo_divisao?: 'proporcional' | 'igual'; meta_moradia?: number }) =>
    chamar<Estado>('atualizarConfig', c),
  percentuaisPadrao: () => chamar<Divisao[]>('percentuaisPadrao'),
  definirMes: (mes: Mes) => chamar<{ mes: Mes; criadas: number }>('definirMes', mes),

  listarContas: (mes: Mes) => chamar<Conta[]>('listarContas', mes),
  salvarConta: (c: ContaInput) => chamar<Conta>('salvarConta', c),
  removerConta: (id: number) => chamar<boolean>('removerConta', id),
  marcarPago: (id: number, pago: boolean) => chamar<boolean>('marcarPago', id, pago),
  redividirMes: (mes: Mes) => chamar<number>('redividirMes', mes),

  listarGastos: (mes: Mes) => chamar<Gasto[]>('listarGastos', mes),
  salvarGasto: (g: Omit<Gasto, 'id'> & { id?: number }) => chamar<number>('salvarGasto', g),
  removerGasto: (id: number) => chamar<boolean>('removerGasto', id),

  listarCartoes: (mes: Mes) => chamar<Cartao[]>('listarCartoes', mes),
  salvarCartao: (c: { id?: number; nome: string; final: string | null; limite: number; dia_vencimento: number | null }) =>
    chamar<number>('salvarCartao', c),
  removerCartao: (id: number) => chamar<boolean>('removerCartao', id),
  salvarFatura: (f: { cartao_id: number; mes_referencia: Mes; valor: number; paga: boolean }) =>
    chamar<boolean>('salvarFatura', f),

  listarMetas: () => chamar<Meta[]>('listarMetas'),
  salvarMeta: (m: Omit<Meta, 'id'> & { id?: number }) => chamar<number>('salvarMeta', m),
  removerMeta: (id: number) => chamar<boolean>('removerMeta', id),

  resumo: (mes: Mes) => chamar<Resumo>('resumo', mes),
  historico: (limite = 12) => chamar<LinhaHistorico[]>('historico', limite),

  exportarBackup: () => chamar<string>('exportarBackup'),
  restaurarBackup: () => chamar<string>('restaurarBackup'),
  abrirPastaDados: () => chamar<string>('abrirPastaDados')
};
