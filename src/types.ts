export type Mes = string; // 'YYYY-MM'

export interface Pessoa { id: number; casal_id: number; ordem: 1 | 2; nome: string; renda_mensal: number; tem_pin: boolean }
export interface Config { casal_id: number; mes_referencia: Mes; modo_divisao: 'proporcional' | 'igual'; meta_moradia: number }
export interface Casal { id: number; nome: string }

export type Estado =
  | { pronto: false }
  | { pronto: true; casal: Casal; pessoas: [Pessoa, Pessoa]; config: Config };

export interface Divisao { pessoa_id: number; percentual: number }

export interface Conta {
  id: number;
  mes_referencia: Mes;
  nome: string;
  categoria: string;
  valor: number;
  dia_vencimento: number | null;
  pago: boolean;
  recorrente: boolean;
  pessoa_id: number | null; // null = conta da casa
  divisoes: Divisao[];
  parte1: number;
  parte2: number;
}

export interface ContaInput {
  id?: number;
  mes_referencia: Mes;
  nome: string;
  categoria: string;
  valor: number;
  dia_vencimento: number | null;
  pago?: boolean;
  recorrente?: boolean;
  pessoa_id?: number | null;
  divisoes?: Divisao[];
}

export interface Fatura { id: number | null; mes_referencia: Mes; valor: number; paga: boolean }
export interface Cartao { id: number; pessoa_id: number | null; nome: string; final: string | null; limite: number; dia_vencimento: number | null; faturas: Fatura[]; disponivel: number }

export interface Meta { id: number; pessoa_id: number | null; nome: string; tipo: 'reserva' | 'obra' | 'outro'; valor_alvo: number; valor_atual: number }

export interface ResumoPessoa {
  id: number; ordem: 1 | 2; nome: string; renda: number;
  parte_casa: number; gastos_pessoais: number; pessoais_pendente: number; qtd_pessoais: number; sobra: number; pct_casa: number;
}

export interface Resumo {
  mes: Mes;
  total_casa: number;
  paga_pessoa1: number;
  paga_pessoa2: number;
  total_pago: number;
  total_pendente: number;
  qtd_contas: number;
  renda_total: number;
  sobra_total: number;
  pessoas: [ResumoPessoa, ResumoPessoa];
  moradia: { valor: number; pct_renda: number; meta: number };
}

export interface LinhaHistorico {
  casal_id: number; mes_referencia: Mes;
  total_casa: number; paga_pessoa1: number; paga_pessoa2: number; total_pago: number;
}
