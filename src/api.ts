import type {
  Cartao, Conta, ContaInput, Divisao, Estado, LinhaHistorico, Mes, Meta, Pessoa, Resumo
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
  configurarCasal: (dados: { nomeCasal: string; mes: Mes; pessoas: { nome: string; renda_mensal: number; pin?: string }[] }) =>
    chamar<Estado>('configurarCasal', dados),
  atualizarPessoa: (p: { id: number; nome: string; renda_mensal: number }) => chamar<Estado>('atualizarPessoa', p),
  entrar: (pessoaId: number, pin?: string) => chamar<Pessoa>('entrar', pessoaId, pin),
  definirPin: (d: { pessoa_id: number; pin_atual?: string; pin_novo: string | null }) => chamar<Estado>('definirPin', d),
  atualizarConfig: (c: { nome_casal?: string; modo_divisao?: 'proporcional' | 'igual'; meta_moradia?: number }) =>
    chamar<Estado>('atualizarConfig', c),
  percentuaisPadrao: () => chamar<Divisao[]>('percentuaisPadrao'),
  definirMes: (mes: Mes) => chamar<{ mes: Mes; criadas: number }>('definirMes', mes),

  /** escopo: 'casa' (padrão), 'todas' ou o id de uma pessoa (gastos só dela) */
  listarContas: (mes: Mes, escopo: 'casa' | 'todas' | number = 'casa') => chamar<Conta[]>('listarContas', mes, escopo),
  salvarConta: (c: ContaInput) => chamar<Conta>('salvarConta', c),
  definirDono: (id: number, pessoaId: number | null) => chamar<Conta>('definirDono', id, pessoaId),
  removerConta: (id: number) => chamar<boolean>('removerConta', id),
  marcarPago: (id: number, pago: boolean) => chamar<boolean>('marcarPago', id, pago),
  redividirMes: (mes: Mes) => chamar<number>('redividirMes', mes),


  listarCartoes: (mes: Mes, escopo: 'todas' | 'casa' | number = 'todas') => chamar<Cartao[]>('listarCartoes', mes, escopo),
  salvarCartao: (c: { id?: number; pessoa_id: number | null; nome: string; final: string | null; limite: number; dia_vencimento: number | null }) =>
    chamar<number>('salvarCartao', c),
  removerCartao: (id: number) => chamar<boolean>('removerCartao', id),
  salvarFatura: (f: { cartao_id: number; mes_referencia: Mes; valor: number; paga: boolean }) =>
    chamar<boolean>('salvarFatura', f),

  listarMetas: (escopo: 'todas' | 'casa' | number = 'todas') => chamar<Meta[]>('listarMetas', escopo),
  salvarMeta: (m: Omit<Meta, 'id'> & { id?: number }) => chamar<number>('salvarMeta', m),
  removerMeta: (id: number) => chamar<boolean>('removerMeta', id),

  resumo: (mes: Mes) => chamar<Resumo>('resumo', mes),
  historico: (limite = 12) => chamar<LinhaHistorico[]>('historico', limite),

  exportarBackup: () => chamar<string>('exportarBackup'),
  restaurarBackup: () => chamar<string>('restaurarBackup'),
  abrirPastaDados: () => chamar<string>('abrirPastaDados')
};
