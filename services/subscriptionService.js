import * as subscriptionRepository from '../repositories/subscriptionRepository.js';
import {
  hojeUTC,
  calcularProximaCobranca,
  diferencaEmDias,
  formatarDataISO,
} from '../backend/src/util/dateUtils.js';

const DIAS_ALERTA_PADRAO = 3;

function paraIndiceDeMes(data) {
  const d = data instanceof Date ? data : new Date(data);
  return d.getUTCFullYear() * 12 + d.getUTCMonth();
}

function gerarUltimos12Meses(referencia) {
  const meses = [];
  const anoRef = referencia.getFullYear();
  const mesRef = referencia.getMonth();

  for (let deslocamento = 11; deslocamento >= 0; deslocamento--) {
    const data = new Date(anoRef, mesRef - deslocamento, 1);
    const ano = data.getFullYear();
    const mes = data.getMonth();
    const chave = `${ano}-${String(mes + 1).padStart(2, '0')}`;
    meses.push({ ano, mes, chave, indice: ano * 12 + mes, total: 0 });
  }

  return meses;
}

function estavaAtivaNoMes(assinatura, indiceDoMes) {
  const indiceInicio = paraIndiceDeMes(assinatura.data_inicio ?? assinatura.criado_em);

  if (indiceInicio > indiceDoMes) {
    return false;
  }

  if (assinatura.status === subscriptionRepository.STATUS_ATIVO) {
    return true;
  }

  if (assinatura.cancelado_em) {
    const indiceCancelamento = paraIndiceDeMes(assinatura.cancelado_em);
    return indiceCancelamento >= indiceDoMes;
  }

  return false;
}

function lerDiasAlertaConfigurados() {
  const bruto = process.env.NOTIFY_DAYS_BEFORE;
  const valor = Number(bruto);

  if (bruto === undefined || bruto === '' || Number.isNaN(valor) || valor < 0) {
    return DIAS_ALERTA_PADRAO;
  }

  return valor;
}

export async function buscarAssinaturaPorId(id) {
  return subscriptionRepository.findById(id);
}

export async function listarAssinaturas(filtro = {}) {
  return subscriptionRepository.findAll(filtro);
}

export async function criarAssinatura(dados) {
  return subscriptionRepository.create(dados);
}

export async function atualizarAssinatura(id, dados) {
  return subscriptionRepository.update(id, dados);
}

export async function removerAssinatura(id) {
  return subscriptionRepository.remove(id);
}

export async function buscarResumoAssinaturas() {
  const resumo = await subscriptionRepository.getResumoAssinaturasAtivas();
  return {
    somaValor: Number(resumo.somaValor || 0),
    quantidade: resumo.quantidade || 0,
  };
}

export async function buscarTotaisPorCategoria() {
  const resultado = await subscriptionRepository.getTotaisPorCategoriaAtivas();
  return resultado.map((item) => ({
    categoria: item.categoria,
    total: Number(item._sum.valor || 0),
  }));
}

export async function buscarEvolucaoMensal(referencia = new Date()) {
  const assinaturas = await subscriptionRepository.getAssinaturasParaHistorico();
  const meses = gerarUltimos12Meses(referencia);

  for (const mes of meses) {
    for (const assinatura of assinaturas) {
      if (estavaAtivaNoMes(assinatura, mes.indice)) {
        mes.total += Number(assinatura.valor || 0);
      }
    }
  }

  return meses.map(({ chave, total }) => ({
    mes: chave,
    total: Number(total.toFixed(2)),
  }));
}

export async function buscarProximasCobrancas({
  diasAlerta = lerDiasAlertaConfigurados(),
  referencia = hojeUTC(),
} = {}) {
  const assinaturas = await subscriptionRepository.getAssinaturasAtivasParaAlerta();

  return assinaturas
    .map((assinatura) => {
      const dataCobranca = new Date(assinatura.data_cobranca);
      const proximaCobranca = calcularProximaCobranca(dataCobranca, referencia);
      const diasRestantes = diferencaEmDias(proximaCobranca, referencia);

      return {
        ...assinatura,
        proximaCobranca: formatarDataISO(proximaCobranca),
        diasRestantes,
      };
    })
    .filter((assinatura) => assinatura.diasRestantes <= diasAlerta)
    .sort((a, b) => a.diasRestantes - b.diasRestantes);
}
