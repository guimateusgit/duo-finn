import { useApp } from '../ui';

/** 'todas' | 'casa' | id da pessoa */
export type Escopo = 'todas' | 'casa' | number;

/** Botões "Casa / Só fulano / Só ciclana". value: null = casa. */
export function DonoSelect({ value, onChange, rotuloCasa = 'Casa (dividir)', ariaLabel = 'De quem é' }: {
  value: number | null; onChange: (v: number | null) => void; rotuloCasa?: string; ariaLabel?: string;
}) {
  const { estado } = useApp();
  return (
    <div className="seg-ctl dono" role="group" aria-label={ariaLabel}>
      <button type="button" aria-pressed={value == null} onClick={() => onChange(null)}>{rotuloCasa}</button>
      {estado.pessoas.map((p) => (
        <button key={p.id} type="button" aria-pressed={value === p.id} onClick={() => onChange(p.id)}>
          <i className={`dot ${p.ordem === 1 ? 'p1' : 'p2'}`} />Só {p.nome}
        </button>
      ))}
    </div>
  );
}

/** Selo com o dono: "Casa" ou o nome da pessoa. */
export function DonoBadge({ pessoaId, rotuloCasa = 'Casa' }: { pessoaId: number | null; rotuloCasa?: string }) {
  const { estado } = useApp();
  const p = estado.pessoas.find((x) => x.id === pessoaId);
  if (!p) return <span className="badge blue">{rotuloCasa}</span>;
  return <span className={`badge dono-${p.ordem}`}><i className={`dot ${p.ordem === 1 ? 'p1' : 'p2'}`} />{p.nome}</span>;
}

/** Filtro "Tudo / Casa / fulano / ciclana". */
export function DonoFiltro({ value, onChange, rotuloCasa = 'Casa' }: {
  value: Escopo; onChange: (v: Escopo) => void; rotuloCasa?: string;
}) {
  const { estado } = useApp();
  const opcoes: { v: Escopo; r: string }[] = [
    { v: 'todas', r: 'Tudo' }, { v: 'casa', r: rotuloCasa },
    ...estado.pessoas.map((p) => ({ v: p.id as Escopo, r: p.nome }))
  ];
  return (
    <div className="seg-ctl" role="group" aria-label="Filtrar por dono">
      {opcoes.map((o) => (
        <button key={String(o.v)} type="button" aria-pressed={value === o.v} onClick={() => onChange(o.v)}>{o.r}</button>
      ))}
    </div>
  );
}

/** Select compacto para trocar o dono direto numa linha de tabela. */
export function DonoInline({ value, onChange, rotulo }: { value: number | null; onChange: (v: number | null) => void; rotulo: string }) {
  const { estado } = useApp();
  return (
    <select className={`input inline dono-sel ${value == null ? '' : `dono-${estado.pessoas.find((p) => p.id === value)?.ordem}`}`}
      value={value ?? ''} aria-label={rotulo}
      onChange={(e) => onChange(e.target.value ? Number(e.target.value) : null)}>
      <option value="">Casa (dividir)</option>
      {estado.pessoas.map((p) => <option key={p.id} value={p.id}>Só {p.nome}</option>)}
    </select>
  );
}
