import type { ReactNode } from 'react';

const S = ({ children }: { children: ReactNode }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {children}
  </svg>
);

export const Icon = {
  casa: () => <S><path d="M3 11l9-7 9 7" /><path d="M5 10v10h14V10" /></S>,
  cond: () => <S><path d="M4 21V5l8-3 8 3v16" /><path d="M9 9h2M13 9h2M9 13h2M13 13h2M10 21v-4h4v4" /></S>,
  raio: () => <S><path d="M13 2L3 14h8l-1 8 10-12h-8z" /></S>,
  agua: () => <S><path d="M12 3s6 6.5 6 11a6 6 0 01-12 0c0-4.5 6-11 6-11z" /></S>,
  gas: () => <S><path d="M12 3c2 3 5 5 5 9a5 5 0 01-10 0c0-2 1-3.5 2-4.5 0 2 1 3 2 3 0-3 1-5 1-7.5z" /></S>,
  wifi: () => <S><path d="M2 9a15 15 0 0120 0M5 12.5a10 10 0 0114 0M8.5 16a5 5 0 017 0" /><circle cx="12" cy="19" r="1" /></S>,
  cartao: () => <S><rect x="2" y="5" width="20" height="14" rx="2" /><path d="M2 10h20" /></S>,
  reserva: () => <S><circle cx="12" cy="12" r="9" /><path d="M12 7v10M9 10h4.5a1.5 1.5 0 010 3H10.5a1.5 1.5 0 000 3H15" /></S>,
  obra: () => <S><path d="M3 21h18M5 21V8l7-5 7 5v13" /><path d="M9 21v-6h6v6" /></S>,
  mercado: () => <S><path d="M3 4h2l2.4 11h11.2L21 7H6.2" /><circle cx="9" cy="20" r="1.3" /><circle cx="18" cy="20" r="1.3" /></S>,
  saude: () => <S><path d="M12 21s-7-4.5-9-9.5C1.5 7 5 3.5 8.5 5c1.5.6 2.6 2 3.5 3 .9-1 2-2.4 3.5-3C19 3.5 22.5 7 21 11.5 19 16.5 12 21 12 21z" /></S>,
  carro: () => <S><path d="M5 17h14M3 13l2-6h14l2 6v5H3z" /><circle cx="7.5" cy="17" r="1.5" /><circle cx="16.5" cy="17" r="1.5" /></S>,
  streaming: () => <S><rect x="3" y="5" width="18" height="12" rx="2" /><path d="M8 21h8M10 9l4 2-4 2z" /></S>,
  gift: () => <S><rect x="3" y="8" width="18" height="4" rx="1" /><path d="M12 8v13M5 12v9h14v-9" /></S>,
  outro: () => <S><circle cx="12" cy="12" r="9" /><path d="M8 12h8" /></S>,

  // navegação e ações
  grid: () => <S><rect x="3" y="3" width="7" height="7" rx="2" /><rect x="14" y="3" width="7" height="7" rx="2" /><rect x="3" y="14" width="7" height="7" rx="2" /><rect x="14" y="14" width="7" height="7" rx="2" /></S>,
  lista: () => <S><path d="M4 4h16v16H4z" /><path d="M8 8h8M8 12h8M8 16h5" /></S>,
  grafico: () => <S><path d="M3 17l6-6 4 4 8-8" /><path d="M14 7h7v7" /></S>,
  renda: () => <S><circle cx="12" cy="12" r="9" /><path d="M12 7v10M14.5 9.5c0-1-1.1-1.5-2.5-1.5S9.5 8.5 9.5 9.5 10.6 11 12 11s2.5.5 2.5 1.5S13.4 15 12 15s-2.5-.5-2.5-1.5" /></S>,
  engrenagem: () => <S><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 00.3 1.8l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.7 1.7 0 00-1.8-.3 1.7 1.7 0 00-1 1.5V21a2 2 0 11-4 0v-.1a1.7 1.7 0 00-1.1-1.5 1.7 1.7 0 00-1.8.3l-.1.1a2 2 0 11-2.8-2.8l.1-.1a1.7 1.7 0 00.3-1.8 1.7 1.7 0 00-1.5-1H3a2 2 0 110-4h.1a1.7 1.7 0 001.5-1.1 1.7 1.7 0 00-.3-1.8l-.1-.1a2 2 0 112.8-2.8l.1.1a1.7 1.7 0 001.8.3H9a1.7 1.7 0 001-1.5V3a2 2 0 114 0v.1a1.7 1.7 0 001 1.5 1.7 1.7 0 001.8-.3l.1-.1a2 2 0 112.8 2.8l-.1.1a1.7 1.7 0 00-.3 1.8V9a1.7 1.7 0 001.5 1H21a2 2 0 110 4h-.1a1.7 1.7 0 00-1.5 1z" /></S>,
  mais: () => <S><path d="M12 5v14M5 12h14" /></S>,
  editar: () => <S><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 013 3L7 19l-4 1 1-4z" /></S>,
  lixo: () => <S><path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" /></S>,
  check: () => <S><path d="M20 6L9 17l-5-5" /></S>,
  esq: () => <S><path d="M15 18l-6-6 6-6" /></S>,
  dir: () => <S><path d="M9 18l6-6-6-6" /></S>,
  x: () => <S><path d="M18 6L6 18M6 6l12 12" /></S>,
  copiar: () => <S><rect x="9" y="9" width="12" height="12" rx="2" /><path d="M5 15V5a2 2 0 012-2h10" /></S>,
  sol: () => <S><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></S>,
  lua: () => <S><path d="M21 12.8A9 9 0 1111.2 3a7 7 0 009.8 9.8z" /></S>
};

export const CATEGORIAS: { id: keyof typeof Icon; nome: string }[] = [
  { id: 'casa', nome: 'Aluguel / moradia' },
  { id: 'cond', nome: 'Condomínio' },
  { id: 'raio', nome: 'Luz' },
  { id: 'agua', nome: 'Água' },
  { id: 'gas', nome: 'Gás' },
  { id: 'wifi', nome: 'Internet / telefone' },
  { id: 'cartao', nome: 'Cartão' },
  { id: 'mercado', nome: 'Mercado' },
  { id: 'reserva', nome: 'Reserva' },
  { id: 'obra', nome: 'Obra / imóvel' },
  { id: 'saude', nome: 'Saúde' },
  { id: 'carro', nome: 'Transporte' },
  { id: 'streaming', nome: 'Assinaturas' },
  { id: 'gift', nome: 'Presentes' },
  { id: 'outro', nome: 'Outros' }
];

export function CatIcon({ cat }: { cat: string }) {
  const C = (Icon as Record<string, () => JSX.Element>)[cat] ?? Icon.outro;
  return <span className="row-ico"><C /></span>;
}

export const nomeCategoria = (id: string) => CATEGORIAS.find((c) => c.id === id)?.nome ?? 'Outros';
