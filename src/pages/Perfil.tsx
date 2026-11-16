import { useState } from 'react';
import { api } from '../api';
import { iniciais } from '../format';
import type { Pessoa } from '../types';

/** "Quem está usando?" — escolhe o perfil e pede o PIN, se a pessoa tiver um. */
export function Perfil({ pessoas, nomeCasa, onEntrar }: {
  pessoas: Pessoa[]; nomeCasa: string; onEntrar: (p: Pessoa) => void;
}) {
  const [escolhida, setEscolhida] = useState<Pessoa | null>(null);
  const [pin, setPin] = useState('');
  const [erro, setErro] = useState('');

  async function entrar(p: Pessoa, codigo?: string) {
    setErro('');
    try {
      onEntrar(await api.entrar(p.id, codigo));
    } catch (e) {
      setErro((e as Error).message);
      setPin('');
    }
  }

  function escolher(p: Pessoa) {
    if (p.tem_pin) { setEscolhida(p); setPin(''); setErro(''); }
    else entrar(p);
  }

  return (
    <div className="onb">
      <div className="glass perfil-box">
        <div className="brand" style={{ margin: 0, justifyContent: 'center' }}>
          <div className="brand-logo">D</div>
          <div>
            <div className="brand-name" style={{ fontSize: 20 }}>Quem está usando?</div>
            <div className="label">{nomeCasa}</div>
          </div>
        </div>

        <div className="perfis">
          {pessoas.map((p) => (
            <button key={p.id} type="button" className={`perfil${escolhida?.id === p.id ? ' sel' : ''}`} onClick={() => escolher(p)}>
              <span className={`avatar grande ${p.ordem === 1 ? 'p1' : 'p2'}`}>{iniciais(p.nome)}</span>
              <span className="perfil-nome">{p.nome}</span>
              <span className="label">{p.tem_pin ? 'Com PIN' : 'Sem PIN'}</span>
            </button>
          ))}
        </div>

        {escolhida && (
          <form className="pin-form" onSubmit={(e) => { e.preventDefault(); entrar(escolhida, pin); }}>
            <label className="field">
              <span>PIN de {escolhida.nome}</span>
              <input className="input pin" type="password" inputMode="numeric" autoFocus maxLength={6}
                value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))} aria-label="PIN" />
            </label>
            <button className="btn" type="submit" disabled={pin.length < 4}>Entrar</button>
          </form>
        )}
        {erro && <p className="erro" role="alert" style={{ textAlign: 'center' }}>{erro}</p>}
      </div>
    </div>
  );
}
