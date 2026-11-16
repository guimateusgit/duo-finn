import { useState } from 'react';
import { api } from '../api';
import { Header } from '../components/Header';
import { brl, iniciais, pct } from '../format';
import type { Pessoa } from '../types';
import { Field, Modal, MoneyInput, useAcao, useApp, useDados } from '../ui';

function PinModal({ pessoa, onClose }: { pessoa: Pessoa; onClose: () => void }) {
  const acao = useAcao();
  const [atual, setAtual] = useState('');
  const [novo, setNovo] = useState('');
  const [conf, setConf] = useState('');
  const so = (v: string) => v.replace(/\D/g, '').slice(0, 6);

  async function salvar(remover = false) {
    if (!remover && novo !== conf) { window.alert('A confirmação não bate com o PIN novo.'); return; }
    const ok = await acao(
      () => api.definirPin({ pessoa_id: pessoa.id, pin_atual: atual || undefined, pin_novo: remover ? null : novo }),
      remover ? 'PIN removido' : 'PIN salvo'
    );
    if (ok) onClose();
  }

  return (
    <Modal titulo={`PIN de ${pessoa.nome}`} sub="Pedido ao entrar no perfil. Use de 4 a 6 números." onClose={onClose} rodape={<>
      {pessoa.tem_pin && <button className="btn danger" type="button" onClick={() => salvar(true)} disabled={atual.length < 4}>Remover PIN</button>}
      <div className="dir">
        <button className="btn ghost" type="button" onClick={onClose}>Cancelar</button>
        <button className="btn" type="button" onClick={() => salvar()} disabled={novo.length < 4 || (pessoa.tem_pin && atual.length < 4)}>Salvar</button>
      </div>
    </>}>
      <form className="form-grid" onSubmit={(e) => { e.preventDefault(); salvar(); }}>
        {pessoa.tem_pin && (
          <Field label="PIN atual" full><input className="input" type="password" inputMode="numeric" autoFocus value={atual} onChange={(e) => setAtual(so(e.target.value))} /></Field>
        )}
        <Field label="PIN novo"><input className="input" type="password" inputMode="numeric" autoFocus={!pessoa.tem_pin} value={novo} onChange={(e) => setNovo(so(e.target.value))} /></Field>
        <Field label="Confirme o PIN novo"><input className="input" type="password" inputMode="numeric" value={conf} onChange={(e) => setConf(so(e.target.value))} /></Field>
        <button type="submit" hidden />
      </form>
    </Modal>
  );
}

function PessoaCard({ pessoa }: { pessoa: Pessoa }) {
  const { mes, estado, perfil, verPessoa } = useApp();
  const acao = useAcao();
  const [nome, setNome] = useState(pessoa.nome);
  const [renda, setRenda] = useState(pessoa.renda_mensal);
  const [pinAberto, setPinAberto] = useState(false);
  const mudou = nome !== pessoa.nome || renda !== pessoa.renda_mensal;
  const total = estado.pessoas.reduce((a, p) => a + p.renda_mensal, 0);

  async function salvarPessoa() {
    const ok = await acao(() => api.atualizarPessoa({ id: pessoa.id, nome, renda_mensal: renda }), 'Dados salvos');
    if (ok && renda !== pessoa.renda_mensal && estado.config.modo_divisao === 'proporcional'
      && window.confirm('A renda mudou. Quer recalcular a divisão das contas da casa deste mês pela nova proporção?')) {
      await acao(() => api.redividirMes(mes), 'Divisão recalculada');
    }
  }

  return (
    <section className="glass card">
      <div className="card-head">
        <div className="row-left">
          <span className={`avatar ${pessoa.ordem === 1 ? 'p1' : 'p2'}`} style={{ marginRight: 10 }}>{iniciais(pessoa.nome)}</span>
          <div>
            <h2 className="card-title">{pessoa.nome}{pessoa.id === perfil.id && <span className="badge blue" style={{ marginLeft: 8 }}>Você</span>}</h2>
            <p className="card-sub">{total ? `${pct(pessoa.renda_mensal / total)} da renda do casal` : 'Informe a renda'}</p>
          </div>
        </div>
        <button className="btn sm sec" type="button" onClick={() => verPessoa(pessoa.id)}>Ver gastos</button>
      </div>
      <div className="form-grid">
        <Field label="Nome"><input className="input" value={nome} onChange={(e) => setNome(e.target.value)} /></Field>
        <Field label="Renda mensal líquida (R$)"><MoneyInput value={renda} onChange={setRenda} /></Field>
      </div>
      {mudou && <div style={{ marginTop: 12 }}><button className="btn" type="button" onClick={salvarPessoa}>Salvar alterações</button></div>}
      <div className="card-foot">
        <span>{pessoa.tem_pin ? 'Perfil protegido por PIN' : 'Perfil sem PIN'}</span>
        <button className="btn sm ghost" type="button" onClick={() => setPinAberto(true)}>{pessoa.tem_pin ? 'Trocar PIN' : 'Criar PIN'}</button>
      </div>
      {pinAberto && <PinModal pessoa={pessoa} onClose={() => setPinAberto(false)} />}
    </section>
  );
}

export function Renda() {
  const { estado, mes } = useApp();
  const acao = useAcao();
  const { dados: resumo } = useDados(() => api.resumo(mes), [mes]);
  const modo = estado.config.modo_divisao;

  async function trocarModo(m: 'proporcional' | 'igual') {
    if (m === modo) return;
    await acao(() => api.atualizarConfig({ modo_divisao: m }));
    if (window.confirm('Aplicar o novo jeito de dividir às contas da casa deste mês também?')) {
      await acao(() => api.redividirMes(mes), 'Divisão recalculada');
    }
  }

  return (
    <main className="main">
      <Header titulo="Nossa renda" sub="Renda de cada um, como as contas da casa são divididas e o PIN de cada perfil." />

      <section className="glass card">
        <div className="card-head">
          <div>
            <h2 className="card-title">Como dividir as contas da casa</h2>
            <p className="card-sub">Vale só para gastos marcados como "Casa". Gastos pessoais ficam 100% com o dono.</p>
          </div>
          <div className="seg-ctl" role="group" aria-label="Modo de divisão">
            <button type="button" aria-pressed={modo === 'proporcional'} onClick={() => trocarModo('proporcional')}>Proporcional à renda</button>
            <button type="button" aria-pressed={modo === 'igual'} onClick={() => trocarModo('igual')}>Meio a meio</button>
          </div>
        </div>
        {resumo && (
          <div className="legend" style={{ fontSize: 13 }}>
            {resumo.pessoas.map((p) => (
              <span key={p.id}><i className={`dot ${p.ordem === 1 ? 'p1' : 'p2'}`} />{p.nome}: renda {brl(p.renda)} · casa {brl(p.parte_casa)} · pessoais {brl(p.gastos_pessoais)} · sobra <b className={p.sobra < 0 ? 'neg' : ''}>{brl(p.sobra)}</b></span>
            ))}
          </div>
        )}
      </section>

      <div className="cols-2">
        {estado.pessoas.map((p) => (
          <PessoaCard key={`${p.id}-${p.nome}-${p.renda_mensal}-${p.tem_pin}`} pessoa={p} />
        ))}
      </div>
    </main>
  );
}
