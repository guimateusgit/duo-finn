import { useState } from 'react';
import { ContaModal } from '../components/ContaModal';
import { CartoesMetasPessoa, ListaGastosPessoa, ResumoPessoa } from '../components/GastosPessoa';
import { Header } from '../components/Header';
import { Icon } from '../icons';
import { useApp } from '../ui';

export function MeusGastos() {
  const { perfil, estado, verPessoa } = useApp();
  const outro = estado.pessoas.find((p) => p.id !== perfil.id)!;
  const [novo, setNovo] = useState(false);

  return (
    <main className="main">
      <Header
        titulo="Meus gastos"
        sub={`Gastos, cartões e metas só de ${perfil.nome}. Nada disso entra na divisão da casa.`}
        acoes={<>
          <button className="btn sec" type="button" onClick={() => verPessoa(outro.id)}>Ver gastos de {outro.nome}</button>
          <button className="btn" type="button" onClick={() => setNovo(true)}><Icon.mais /> Novo gasto</button>
        </>}
      />
      <section className="glass card">
        <ResumoPessoa pessoaId={perfil.id} />
      </section>
      <section className="glass card">
        <div className="card-head">
          <div>
            <h2 className="card-title">Lançamentos do mês</h2>
            <p className="card-sub">Clique num gasto para editar. Errou e era da casa? Edite e troque o "De quem é?".</p>
          </div>
        </div>
        <ListaGastosPessoa pessoaId={perfil.id} onNovo={() => setNovo(true)} />
      </section>
      <section className="glass card">
        <div className="card-head">
          <div>
            <h2 className="card-title">Meus cartões e metas</h2>
            <p className="card-sub">Só de {perfil.nome}. Os da casa ficam em Cartões e em Reserva e obra.</p>
          </div>
        </div>
        <CartoesMetasPessoa pessoaId={perfil.id} comBotoes />
      </section>
      {novo && <ContaModal conta={null} donoPadrao={perfil.id} onClose={() => setNovo(false)} />}
    </main>
  );
}
