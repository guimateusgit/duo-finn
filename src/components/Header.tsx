import type { ReactNode } from 'react';
import { Icon } from '../icons';
import { nomeMesAno, somaMes } from '../format';
import { useApp } from '../ui';

export function Header({ titulo, sub, acoes }: { titulo: string; sub?: string; acoes?: ReactNode }) {
  const { mes, trocarMes } = useApp();
  return (
    <header className="header">
      <div>
        <div className="eyebrow">
          <button type="button" onClick={() => trocarMes(somaMes(mes, -1))} aria-label="Mês anterior"><Icon.esq /></button>
          <span>{nomeMesAno(mes)}</span>
          <button type="button" onClick={() => trocarMes(somaMes(mes, 1))} aria-label="Próximo mês"><Icon.dir /></button>
        </div>
        <h1 className="page-title">{titulo}</h1>
        {sub && <p className="page-sub">{sub}</p>}
      </div>
      {acoes && <div className="actions">{acoes}</div>}
    </header>
  );
}
