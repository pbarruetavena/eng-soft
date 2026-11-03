import { useCallback, useEffect, useState } from 'react';
import Nav from '../components/Nav.jsx';
import MonthlyEvolutionChart from '../components/MonthlyEvolutionChart.jsx';
import SummarySubscription from '../components/SummarySubscription.jsx';
import SubscriptionForm from '../components/SubscriptionForm.jsx';
import SubscriptionListItem from '../components/SubscriptionListItem.jsx';
import { useMonthlyEvolution } from '../hooks/useMonthlyEvolution.js';
import { useSubscriptionSummary } from '../hooks/useSummary.js';
import { listSubscriptions, createSubscription, updateSubscription, deleteSubscription, excluirSubscription } from '../services/api.js';
import './Painel.css';

const formatoMoeda = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

export default function Painel() {
  const [assinaturas, setAssinaturas] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [erroLista, setErroLista] = useState(null);
  const [assinaturaEditando, setAssinaturaEditando] = useState(null);

  const { resumo, carregando: carregandoResumo, erro: erroResumo, recarregarResumo } =
  useSubscriptionSummary();
  const {
    historico,
    carregando: carregandoHistorico,
    erro: erroHistorico,
    recarregarHistorico,
  } = useMonthlyEvolution();

  const carregarAssinaturas = useCallback(() => {
    setCarregando(true);
    setErroLista(null);
    listSubscriptions('ativo')
      .then(setAssinaturas)
      .catch((err) => setErroLista(err.message))
      .finally(() => setCarregando(false));
  }, []);

  useEffect(() => {
    carregarAssinaturas();
  }, [carregarAssinaturas]);

  const atualizarListaResumoEHistorico = useCallback(() => {
    return Promise.all([carregarAssinaturas(), recarregarResumo(), recarregarHistorico()]);
  }, [carregarAssinaturas, recarregarResumo, recarregarHistorico]);

  async function handleCriar(dados) {
    await createSubscription(dados);
    await atualizarListaResumoEHistorico();
  }

  async function handleSalvarEdicao(dados) {
    if (!assinaturaEditando) {
      return;
    }

    await updateSubscription(assinaturaEditando.id, dados);
    setAssinaturaEditando(null);
    await atualizarListaResumoEHistorico();
  }

  async function handleRemover(id) {
    try {
      await deleteSubscription(id);
      await atualizarListaResumoEHistorico();
    } catch (err) {
      setErroLista(err.message);
    }
  }

  async function handleExcluir(id) {
    try {
      await excluirSubscription(id);
      await atualizarListaResumoEHistorico();
    } catch (err) {
      setErroLista(err.message);
    }
  }

  return (
    <div className="sf-painel">
      <Nav tone="on-light" showCta={false} />

      <main className="sf-painel__content">
        <SummarySubscription
          resumo={resumo}
          carregando={carregandoResumo}
          erro={erroResumo}
          formatoMoeda={formatoMoeda}
        />
 
        <section className="sf-painel__card">
          <h1>{assinaturaEditando ? 'Editar assinatura' : 'Nova assinatura'}</h1>
          <SubscriptionForm
            key={assinaturaEditando ? `editar-${assinaturaEditando.id}` : 'criar'}
            onSubmit={assinaturaEditando ? handleSalvarEdicao : handleCriar}
            initialValues={assinaturaEditando}
            submitLabel={assinaturaEditando ? 'Salvar alterações' : 'Cadastrar assinatura'}
            onCancel={assinaturaEditando ? () => setAssinaturaEditando(null) : null}
          />
        </section>

        <section className="sf-painel__card">
          <h2>Assinaturas ativas</h2>

          {carregando && <p className="sf-painel__aviso">Carregando…</p>}
          {erroLista && <p className="sf-painel__erro">{erroLista}</p>}
          {!carregando && !erroLista && assinaturas.length === 0 && (
            <p className="sf-painel__aviso">Nenhuma assinatura cadastrada ainda.</p>
          )}

          <ul className="sf-painel__lista">
            {assinaturas.map((assinatura) => (
              <SubscriptionListItem
                key={assinatura.id}
                assinatura={assinatura}
                formatoMoeda={formatoMoeda}
                onRemover={handleRemover}
                onEditar={(assinaturaSelecionada) => setAssinaturaEditando(assinaturaSelecionada)}
                onExcluir={handleExcluir}
              />
            ))}
          </ul>
        </section>

        <section className="sf-painel__card sf-painel__card--grafico">
          <h2>Evolução mensal</h2>
          <MonthlyEvolutionChart
            dados={historico}
            carregando={carregandoHistorico}
            erro={erroHistorico}
          />
        </section>
      </main>
    </div>
  );
}
