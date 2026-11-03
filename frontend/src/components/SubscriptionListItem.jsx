import { useEffect, useRef, useState } from 'react';
import Badge from './Badge.jsx';
import './SubscriptionListItem.css';

const TEMPO_CONFIRMACAO = 3000; //

/**
 * Um item da lista de assinaturas, com o botão de remover (US6).
 * Confirmação inline: primeiro clique vira "Confirmar?"; segundo clique
 * (dentro de TEMPO_CONFIRMACAO) remove de verdade. Evita usar o
 * window.confirm() nativo do navegador, que quebraria o visual do SubFlow.
 */
export default function SubscriptionListItem({ assinatura, formatoMoeda, onRemover, onEditar, onExcluir }) {
  const [confirmando, setConfirmando] = useState(false);
  const [removendo, setRemovendo] = useState(false);
  const [confirmandoExcluir, setConfirmandoExcluir] = useState(false);
  const [excluindo, setExcluindo] = useState(false);
  const timerRef = useRef(null);

  useEffect(() => () => clearTimeout(timerRef.current), []);

  function handleClick() {
    if (!confirmando) {
      setConfirmando(true);
      timerRef.current = setTimeout(() => setConfirmando(false), TEMPO_CONFIRMACAO);
      return;
    }

    clearTimeout(timerRef.current);
    setRemovendo(true);
    onRemover(assinatura.id).finally(() => {
      setRemovendo(false);
      setConfirmando(false);
    });
  }

  function handleClickExcluir() {
    if (!confirmandoExcluir) {
      setConfirmandoExcluir(true);
      timerRef.current = setTimeout(() => setConfirmandoExcluir(false), TEMPO_CONFIRMACAO);
      return;
    }

    clearTimeout(timerRef.current);
    setExcluindo(true);
    onExcluir(assinatura.id).finally(() => {
      setExcluindo(false);
      setConfirmandoExcluir(false);
    });
  }

  return (
    <li className="sf-painel__item">
      <span className="sf-painel__item-nome">{assinatura.nome}</span>
      <Badge tone="categoria">{assinatura.categoria}</Badge>
      <span className="sf-painel__item-valor">{formatoMoeda.format(assinatura.valor)}</span>
      <div className="sf-painel__item-actions">
        <button type="button" className="sf-edit-btn" onClick={() => onEditar?.(assinatura)}>
          Editar
        </button>
        <button
          type="button"
          className={`sf-remove-btn ${confirmando ? 'sf-remove-btn--confirmando' : ''}`}
          onClick={handleClick}
          disabled={removendo}
        >
          {removendo ? 'Cancelando…' : confirmando ? 'Confirmar?' : 'Cancelar'}
        </button>
        <button
          type="button"
          className={`sf-remove-btn ${confirmandoExcluir ? 'sf-remove-btn--confirmando' : ''}`}
          onClick={handleClickExcluir}
          disabled={excluindo}
        >
          {excluindo ? 'Excluindo...' : confirmandoExcluir ? 'Confirmar?' : 'Excluir'}
        </button>
      </div>
    </li>
  );
}
