import { useEffect, useState } from 'react';
import { api } from '../api';
import { brl, pct } from '../format';
import { CATEGORIAS } from '../icons';
import type { Conta, Divisao } from '../types';
import { Field, Modal, MoneyInput, useAcao, useApp } from '../ui';

export function ContaModal({ conta, onClose }: { conta: Conta | null; onClose: () => void }) {
  const { estado, mes } = useApp();
  const acao = useAcao();
  const [p1, p2] = estado.pessoas;

  const [nome, setNome] = useState(conta?.nome ?? '');
  const [categoria, setCategoria] = useState(conta?.categoria ?? 'casa');
  const [valor, setValor] = useState(conta?.valor ?? 0);
  const [dia, setDia] = useState<string>(conta?.dia_vencimento ? String(conta.dia_vencimento) : '');
  const [recorrente, setRecorrente] = useState(conta?.recorrente ?? true);
  const [pago, setPago] = useState(conta?.pago ?? false);
  const [padrao, setPadrao] = useState<Divisao[] | null>(null);
  const pctAtual = conta?.divisoes.find((d) => d.pessoa_id === p1.id)?.percentual;
  const [modo, setModo] = useState<'padrao' | 'custom'>('padrao');
  const [pct1, setPct1] = useState<number>(pctAtual ?? 0.5);
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    api.percentuaisPadrao().then((d) => {
      setPadrao(d);
      const pp = d.find((x) => x.pessoa_id === p1.id)?.percentual ?? 0.5;
      if (pctAtual == null) setPct1(pp);
      else if (Math.abs(pctAtual - pp) > 0.0005) setModo('custom');
    }).catch(() => {});
  }, [p1.id, pctAtual]);

  const pctUsado = modo === 'padrao' ? (padrao?.find((x) => x.pessoa_id === p1.id)?.percentual ?? 0.5) : pct1;

  async function salvar() {
    setSalvando(true);
    const r = await acao(() => api.salvarConta({
      id: conta?.id,
      mes_referencia: conta?.mes_referencia ?? mes,
      nome, categoria, valor,
      dia_vencimento: dia ? Number(dia) : null,
      recorrente, pago,
      divisoes: modo === 'custom'
        ? [{ pessoa_id: p1.id, percentual: Math.round(pct1 * 10000) / 10000 },
           { pessoa_id: p2.id, percentual: Math.round((1 - pct1) * 10000) / 10000 }]
        : undefined
    }), conta ? 'Conta atualizada' : 'Conta adicionada');
    setSalvando(false);
    if (r) onClose();
  }

  async function remover() {
    if (!conta || !window.confirm(`Remover "${conta.nome}" deste mês?`)) return;
    const r = await acao(() => api.removerConta(conta.id), 'Conta removida');
    if (r) onClose();
  }

  return (
    <Modal
      titulo={conta ? 'Editar conta' : 'Nova conta da casa'}
      sub="Gastos da casa divididos entre vocês dois."
      onClose={onClose}
      rodape={<>
        {conta && <button type="button" className="btn danger" onClick={remover}>Remover</button>}
        <div className="dir">
          <button type="button" className="btn ghost" onClick={onClose}>Cancelar</button>
          <button type="button" className="btn" onClick={salvar} disabled={salvando || !nome.trim()}>Salvar</button>
        </div>
      </>}
    >
      <form className="form-grid" onSubmit={(e) => { e.preventDefault(); salvar(); }}>
        <Field label="Nome" full>
          <input className="input" autoFocus value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex.: Aluguel" />
        </Field>
        <Field label="Valor (R$)">
          <MoneyInput value={valor} onChange={setValor} />
        </Field>
        <Field label="Dia de vencimento">
          <input className="input" type="number" min={1} max={31} value={dia} onChange={(e) => setDia(e.target.value)} placeholder="1 a 31" />
        </Field>
        <Field label="Categoria" full>
          <select className="input" value={categoria} onChange={(e) => setCategoria(e.target.value)}>
            {CATEGORIAS.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
          </select>
        </Field>

        <div className="field full">
          <span>Divisão</span>
          <div className="seg-ctl" role="group" aria-label="Tipo de divisão">
            <button type="button" aria-pressed={modo === 'padrao'} onClick={() => setModo('padrao')}>
              Padrão ({estado.config.modo_divisao === 'igual' ? 'meio a meio' : 'pela renda'})
            </button>
            <button type="button" aria-pressed={modo === 'custom'} onClick={() => setModo('custom')}>Personalizada</button>
          </div>
          {modo === 'custom' && (
            <input type="range" min={0} max={1} step={0.005} value={pct1}
              onChange={(e) => setPct1(Number(e.target.value))} aria-label={`Percentual de ${p1.nome}`} />
          )}
          <div className="split" style={{ margin: '6px 0 4px' }}>
            <span style={{ width: `${pctUsado * 100}%`, background: 'var(--accent)' }} />
            <span style={{ width: `${(1 - pctUsado) * 100}%`, background: 'var(--pink)' }} />
          </div>
          <div className="legend">
            <span><i className="dot p1" />{p1.nome} {pct(pctUsado)}<b>{brl(valor * pctUsado)}</b></span>
            <span><i className="dot p2" />{p2.nome} {pct(1 - pctUsado)}<b>{brl(valor * (1 - pctUsado))}</b></span>
          </div>
        </div>

        <label className="check-line full">
          <input type="checkbox" checked={recorrente} onChange={(e) => setRecorrente(e.target.checked)} />
          Repetir todo mês (copiada automaticamente ao abrir o próximo mês)
        </label>
        <label className="check-line full">
          <input type="checkbox" checked={pago} onChange={(e) => setPago(e.target.checked)} />
          Já está paga
        </label>
        <button type="submit" hidden />
      </form>
    </Modal>
  );
}
