import { useState } from 'react';
import { api } from '../api';
import { Header } from '../components/Header';
import { DonoBadge, DonoFiltro, DonoSelect, type Escopo } from '../components/Dono';
import { brl, pct } from '../format';
import { CatIcon, Icon } from '../icons';
import type { Meta } from '../types';
import { Field, Modal, MoneyInput, useAcao, useDados } from '../ui';

export function MetaModal({ meta, donoPadrao = null, onClose }: { meta: Meta | null; donoPadrao?: number | null; onClose: () => void }) {
  const acao = useAcao();
  const [m, setM] = useState({
    pessoa_id: meta ? meta.pessoa_id : donoPadrao,
    nome: meta?.nome ?? '', tipo: meta?.tipo ?? 'reserva' as Meta['tipo'],
    valor_alvo: meta?.valor_alvo ?? 0, valor_atual: meta?.valor_atual ?? 0
  });
  async function salvar() {
    if (await acao(() => api.salvarMeta({ ...m, id: meta?.id }), meta ? 'Meta atualizada' : 'Meta criada')) onClose();
  }
  async function remover() {
    if (!meta || !window.confirm(`Remover a meta "${meta.nome}"?`)) return;
    if (await acao(() => api.removerMeta(meta.id), 'Meta removida')) onClose();
  }
  return (
    <Modal titulo={meta ? 'Editar meta' : 'Nova meta'} sub="Reserva de emergência, obra, viagem…" onClose={onClose} rodape={<>
      {meta && <button className="btn danger" type="button" onClick={remover}>Remover</button>}
      <div className="dir">
        <button className="btn ghost" type="button" onClick={onClose}>Cancelar</button>
        <button className="btn" type="button" onClick={salvar} disabled={!m.nome.trim()}>Salvar</button>
      </div>
    </>}>
      <form className="form-grid" onSubmit={(e) => { e.preventDefault(); salvar(); }}>
        <div className="field full"><span>De quem é?</span><DonoSelect value={m.pessoa_id} onChange={(v) => setM({ ...m, pessoa_id: v })} rotuloCasa="Do casal" ariaLabel="De quem é a meta" /></div>
        <Field label="Nome" full><input className="input" autoFocus value={m.nome} onChange={(e) => setM({ ...m, nome: e.target.value })} placeholder="Ex.: Reserva de emergência" /></Field>
        <Field label="Tipo" full>
          <select className="input" value={m.tipo} onChange={(e) => setM({ ...m, tipo: e.target.value as Meta['tipo'] })}>
            <option value="reserva">Reserva</option>
            <option value="obra">Obra / imóvel</option>
            <option value="outro">Outro objetivo</option>
          </select>
        </Field>
        <Field label="Quanto querem juntar (R$)"><MoneyInput value={m.valor_alvo} onChange={(v) => setM({ ...m, valor_alvo: v })} /></Field>
        <Field label="Quanto já têm (R$)"><MoneyInput value={m.valor_atual} onChange={(v) => setM({ ...m, valor_atual: v })} /></Field>
        <button type="submit" hidden />
      </form>
    </Modal>
  );
}

export function Aporte({ meta }: { meta: Meta }) {
  const acao = useAcao();
  const [v, setV] = useState(0);
  const mover = (sinal: 1 | -1) => acao(
    () => api.salvarMeta({ ...meta, valor_atual: Math.max(0, meta.valor_atual + sinal * v) }),
    sinal > 0 ? `${brl(v)} guardados em ${meta.nome}` : `${brl(v)} retirados de ${meta.nome}`
  ).then(() => setV(0));
  return (
    <div className="row" style={{ gap: 8, marginTop: 10 }}>
      <div style={{ flex: 1 }}><MoneyInput inline value={v} onChange={setV} ariaLabel={`Valor para ${meta.nome}`} /></div>
      <button className="btn sm" type="button" disabled={!v} onClick={() => mover(1)}>Guardar</button>
      <button className="btn sm sec" type="button" disabled={!v} onClick={() => mover(-1)}>Retirar</button>
    </div>
  );
}

export function Metas() {
  const [escopo, setEscopo] = useState<Escopo>('todas');
  const { dados: metas } = useDados(() => api.listarMetas(escopo), [escopo]);
  const [editando, setEditando] = useState<Meta | null | 'nova'>(null);
  return (
    <main className="main">
      <Header titulo="Reserva e obra" sub="Objetivos do casal e de cada um, e quanto já foi guardado."
        acoes={<button className="btn" type="button" onClick={() => setEditando('nova')}><Icon.mais /> Nova meta</button>} />
      <div className="filtros"><DonoFiltro value={escopo} onChange={setEscopo} rotuloCasa="Do casal" /></div>
      {metas && metas.length === 0 && (
        <section className="glass card"><div className="empty">
          {escopo === 'todas' ? 'Nenhuma meta ainda.' : 'Nenhuma meta neste filtro.'}
          <button className="btn" type="button" onClick={() => setEditando('nova')}><Icon.mais /> Criar meta</button>
        </div></section>
      )}
      <div className="grid-cartoes">
        {(metas ?? []).map((m) => {
          const p = m.valor_alvo ? m.valor_atual / m.valor_alvo : 0;
          return (
            <section className="glass card" key={m.id}>
              <div className="card-head">
                <div className="row-left">
                  <CatIcon cat={m.tipo === 'obra' ? 'obra' : 'reserva'} />
                  <div>
                    <h2 className="card-title">{m.nome}</h2>
                    <p className="card-sub">{m.tipo === 'obra' ? 'Obra / imóvel' : m.tipo === 'reserva' ? 'Reserva' : 'Objetivo'}</p>
                  </div>
                </div>
                <span className="row-left" style={{ gap: 4 }}>
                  <DonoBadge pessoaId={m.pessoa_id} rotuloCasa="Do casal" />
                  <button className="icon-btn" type="button" aria-label={`Editar ${m.nome}`} onClick={() => setEditando(m)}><Icon.editar /></button>
                </span>
              </div>
              <div className="big sm">{brl(m.valor_atual)}</div>
              <div className="progress"><span style={{ width: `${Math.min(100, p * 100)}%` }} /></div>
              <div className="label" style={{ marginTop: 4 }}>
                {m.valor_alvo ? <>{pct(p)} de {brl(m.valor_alvo)} · faltam {brl(Math.max(0, m.valor_alvo - m.valor_atual))}</> : 'Sem valor-alvo'}
              </div>
              <Aporte meta={m} />
            </section>
          );
        })}
      </div>
      {editando && <MetaModal meta={editando === 'nova' ? null : editando} donoPadrao={typeof escopo === 'number' ? escopo : null} onClose={() => setEditando(null)} />}
    </main>
  );
}
