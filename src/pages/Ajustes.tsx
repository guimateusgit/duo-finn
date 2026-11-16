import { useState } from 'react';
import { api } from '../api';
import { Header } from '../components/Header';
import { Field, useAcao, useApp } from '../ui';

export function Ajustes() {
  const { estado, toast, recarregar } = useApp();
  const acao = useAcao();
  const [nome, setNome] = useState(estado.casal.nome);
  const [meta, setMeta] = useState(Math.round(estado.config.meta_moradia * 100));

  async function exportar() {
    try { toast(`Backup salvo em ${await api.exportarBackup()}`, 'ok'); }
    catch (e) { if ((e as Error).message !== 'cancelado') toast((e as Error).message, 'erro'); }
  }
  async function restaurar() {
    if (!window.confirm('Restaurar um backup substitui TODOS os dados atuais. Uma cópia do estado atual será guardada antes. Continuar?')) return;
    try { await api.restaurarBackup(); toast('Backup restaurado', 'ok'); recarregar(); }
    catch (e) { if ((e as Error).message !== 'cancelado') toast((e as Error).message, 'erro'); }
  }

  return (
    <main className="main">
      <Header titulo="Configurações" sub="Dados do casal, metas e cópias de segurança." />

      <section className="glass card">
        <h2 className="card-title" style={{ marginBottom: 14 }}>Casal</h2>
        <form className="form-grid" onSubmit={(e) => {
          e.preventDefault();
          acao(() => api.atualizarConfig({ nome_casal: nome, meta_moradia: meta / 100 }), 'Configurações salvas');
        }}>
          <Field label="Nome da casa"><input className="input" value={nome} onChange={(e) => setNome(e.target.value)} /></Field>
          <Field label="Meta de moradia (% da renda)" hint="Aluguel/moradia + condomínio. Referência comum: até 30%.">
            <input className="input num" type="number" min={1} max={100} value={meta} onChange={(e) => setMeta(Number(e.target.value))} />
          </Field>
          <div className="full"><button className="btn" type="submit">Salvar</button></div>
        </form>
      </section>

      <section className="glass card">
        <h2 className="card-title">Seus dados</h2>
        <p className="card-sub" style={{ marginBottom: 14 }}>
          Tudo fica salvo só neste computador. O app faz uma cópia automática por dia (guarda as últimas 14).
          Para levar para outro PC ou guardar no pendrive/nuvem, exporte um backup.
        </p>
        <div className="actions">
          <button className="btn" type="button" onClick={exportar}>Exportar backup…</button>
          <button className="btn sec" type="button" onClick={restaurar}>Restaurar backup…</button>
          <button className="btn ghost" type="button" onClick={() => api.abrirPastaDados().catch(() => {})}>Abrir pasta dos dados</button>
        </div>
      </section>
    </main>
  );
}
