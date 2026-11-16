import { useState } from 'react';
import { api } from '../api';
import { mesHoje } from '../format';
import { CatIcon } from '../icons';
import { Field, MoneyInput } from '../ui';

const SUGESTOES = [
  { nome: 'Aluguel', categoria: 'casa', dia: 5 },
  { nome: 'Condomínio', categoria: 'cond', dia: 10 },
  { nome: 'Luz', categoria: 'raio', dia: 12 },
  { nome: 'Água', categoria: 'agua', dia: 15 },
  { nome: 'Internet', categoria: 'wifi', dia: 20 },
  { nome: 'Mercado', categoria: 'mercado', dia: null }
];

export function Onboarding({ pronto }: { pronto: () => void }) {
  const [nomeCasal, setNomeCasal] = useState('Nossa casa');
  const [ps, setPs] = useState([{ nome: '', renda_mensal: 0, pin: '' }, { nome: '', renda_mensal: 0, pin: '' }]);
  const [valores, setValores] = useState<Record<string, number>>({});
  const [erro, setErro] = useState('');
  const [salvando, setSalvando] = useState(false);

  const setP = (i: number, k: 'nome' | 'renda_mensal' | 'pin', v: string | number) =>
    setPs(ps.map((p, j) => (j === i ? { ...p, [k]: v } : p)));

  async function comecar() {
    setErro('');
    setSalvando(true);
    try {
      const mes = mesHoje();
      await api.configurarCasal({ nomeCasal, mes, pessoas: ps.map((p) => ({ nome: p.nome, renda_mensal: p.renda_mensal, pin: p.pin || undefined })) });
      for (const s of SUGESTOES) {
        if (valores[s.nome] > 0) {
          await api.salvarConta({ mes_referencia: mes, nome: s.nome, categoria: s.categoria, valor: valores[s.nome], dia_vencimento: s.dia });
        }
      }
      pronto();
    } catch (e) {
      setErro((e as Error).message);
      setSalvando(false);
    }
  }

  return (
    <div className="onb">
      <form className="glass" onSubmit={(e) => { e.preventDefault(); comecar(); }}>
        <div className="brand" style={{ margin: 0 }}>
          <div className="brand-logo">D</div>
          <div>
            <div className="brand-name" style={{ fontSize: 20 }}>Bem-vindos ao Duo Finn</div>
            <div className="label">Leva um minuto. Dá para mudar tudo depois.</div>
          </div>
        </div>

        <Field label="Nome da casa"><input className="input" value={nomeCasal} onChange={(e) => setNomeCasal(e.target.value)} /></Field>

        <div className="cols-2" style={{ gap: 14 }}>
          {ps.map((p, i) => (
            <div className="pessoa-box" key={i}>
              <h3><span className={`dot ${i ? 'p2' : 'p1'}`} />Pessoa {i + 1}</h3>
              <Field label="Nome"><input className="input" value={p.nome} onChange={(e) => setP(i, 'nome', e.target.value)} autoFocus={i === 0} required /></Field>
              <Field label="Renda mensal líquida (R$)" hint="Usada para dividir a casa de forma proporcional.">
                <MoneyInput value={p.renda_mensal} onChange={(v) => setP(i, 'renda_mensal', v)} />
              </Field>
              <Field label="PIN (opcional)" hint="4 a 6 números. Pedido ao entrar no perfil.">
                <input className="input" type="password" inputMode="numeric" maxLength={6} value={p.pin}
                  onChange={(e) => setP(i, 'pin', e.target.value.replace(/\D/g, ''))} />
              </Field>
            </div>
          ))}
        </div>

        <div>
          <div className="card-title">Contas da casa (opcional)</div>
          <p className="card-sub" style={{ marginBottom: 8 }}>Contas divididas entre os dois. Preencha as que vocês têm; elas se repetem todo mês. Gastos de cada um são lançados depois, em "Meus gastos".</p>
          {SUGESTOES.map((s) => (
            <div className="row" key={s.nome}>
              <span className="row-left"><CatIcon cat={s.categoria} />{s.nome}</span>
              <div style={{ width: 160 }}>
                <MoneyInput inline value={valores[s.nome] ?? 0} onChange={(v) => setValores({ ...valores, [s.nome]: v })} ariaLabel={`Valor de ${s.nome}`} />
              </div>
            </div>
          ))}
        </div>

        {erro && <p className="erro">{erro}</p>}
        <button className="btn" type="submit" style={{ height: 42 }} disabled={salvando || !ps[0].nome.trim() || !ps[1].nome.trim() || ps.some((p) => p.pin && p.pin.length < 4)}>
          Começar
        </button>
      </form>
    </div>
  );
}
