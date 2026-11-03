import { 
  getResumoAssinaturasAtivas,
  getTotaisPorCategoriaAtivas,
  getAssinaturasParaHistorico,
  getAssinaturasAtivasParaAlerta,
 } from '../repositories/subscriptionRepository.js';

import {
  hojeUTC,
  calcularProximaCobranca,
  diferencaEmDias,
  formatarDataISO,
} from '../util/dateUtils.js';

const DIAS_ALERTA_PADRAO = 3;

import db from '../db/index.js';

export const CATEGORIAS_VALIDAS = [
  'streaming',
  'produtividade',
  'jogos',
  'academia',
  'outros',
];

// A edição usa exatamente as mesmas regras do cadastro.
export function validarAssinatura(dados = {}) {
  const erros = [];

  if (!dados.nome || typeof dados.nome !== 'string' || !dados.nome.trim()) {
    erros.push("O campo 'nome' é obrigatório");
  }

  if (
    typeof dados.valor !== 'number' ||
    !Number.isFinite(dados.valor) ||
    dados.valor <= 0
  ) {
    erros.push("O campo 'valor' deve ser maior que zero");
  }

  if (!dados.data_cobranca || !/^\d{4}-\d{2}-\d{2}$/.test(dados.data_cobranca)) {
    erros.push("O campo 'data_cobranca' deve estar no formato AAAA-MM-DD");
  }

  if (!dados.data_inicio || !/^\d{4}-\d{2}-\d{2}$/.test(dados.data_inicio)) {
    erros.push("O campo 'data_inicio' deve estar no formato AAAA-MM-DD");
  }

  if (!CATEGORIAS_VALIDAS.includes(dados.categoria)) {
    erros.push(`Categoria inválida. Use: ${CATEGORIAS_VALIDAS.join(', ')}`);
  }

  return erros;
}

// Mantém o nome usado pela implementação original da US1-BE.
export const validarNovaAssinatura = validarAssinatura;

export function buscarAssinaturaPorId(id) {
  return db.prepare('SELECT * FROM subscriptions WHERE id = ? AND desativado_em IS NULL').get(id);
}

export function buscarAssinaturaPorIdGeral(id) {
  return db.prepare('SELECT * FROM subscriptions WHERE id = ?').get(id);
}

export function buscarAssinaturas(status = 'ativo') {
  return db
    .prepare('SELECT * FROM subscriptions WHERE status = ? AND desativado_em IS NULL ORDER BY data_cobranca')
    .all(status);
}

export function criarAssinatura({ nome, valor, data_cobranca, data_inicio, categoria }) {
  const resultado = db
    .prepare(`
      INSERT INTO subscriptions (nome, valor, data_cobranca, data_inicio, categoria)
      VALUES (?, ?, ?, ?, ?)
    `)
    .run(nome.trim(), valor, data_cobranca, data_inicio, categoria);

  return buscarAssinaturaPorId(resultado.lastInsertRowid);
}

export function atualizarAssinatura(
  id,
  { nome, valor, data_cobranca, data_inicio, categoria },
) {
  const existente = buscarAssinaturaPorId(id);

  if (!existente) {
    return null;
  }

  db.prepare(`
    UPDATE subscriptions
    SET nome = ?, valor = ?, data_cobranca = ?, data_inicio = ?, categoria = ?
    WHERE id = ? AND desativado_em IS NULL
  `).run(nome.trim(), valor, data_cobranca, data_inicio, categoria, id);

  return buscarAssinaturaPorId(id);
}

export function cancelarAssinatura(id) {
  const existente = db
    .prepare('SELECT * FROM subscriptions WHERE id = ? AND status = ? AND desativado_em IS NULL')
    .get(id, 'ativo');

  if (!existente) {
    return null;
  }

  db.prepare(`
    UPDATE subscriptions
    SET status = 'cancelado', cancelado_em = datetime('now')
    WHERE id = ?
  `).run(id);

  return buscarAssinaturaPorId(id);
}

export function desativarAssinatura(id) {
  const existente = db
    .prepare('SELECT * FROM subscriptions WHERE id = ? AND desativado_em IS NULL')
    .get(id);

  if (!existente) {
    return null;
  }

  db.prepare(`
    UPDATE subscriptions
    SET desativado_em = datetime('now')
    WHERE id = ?
  `).run(id);

  return { ...existente, desativado_em: new Date().toISOString() };
}

export function alternarStatusAtivacao(id, ativo) {
  const existente = buscarAssinaturaPorIdGeral(id);

  if (!existente) {
    return null;
  }

  if (ativo) {
    db.prepare(`
      UPDATE subscriptions
      SET desativado_em = NULL
      WHERE id = ?
    `).run(id);
  } else {
    db.prepare(`
      UPDATE subscriptions
      SET desativado_em = datetime('now')
      WHERE id = ?
    `).run(id);
  }

  return buscarAssinaturaPorIdGeral(id);
}

export async function calcularResumoMensal() {
  const { somaValor, quantidade } = await getResumoAssinaturasAtivas();
 
  const totalMensal = somaValor ? Number(somaValor.toFixed(2)) : 0;
 
  return {
    totalMensal,
    quantidadeAtivas: quantidade,
  };
}

export async function calcularGastosPorCategoria() {
  const totais = await getTotaisPorCategoriaAtivas();
  const totaisPorCategoria = new Map(
    totais.map(({ categoria, _sum }) => [
      categoria,
      _sum.valor ? Number(_sum.valor.toFixed(2)) : 0,
    ]),
  );

  return CATEGORIAS_VALIDAS.map((categoria) => ({
    categoria,
    total: totaisPorCategoria.get(categoria) ?? 0,
  }));
}

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
    const mes = data.getMonth(); // 0-based

    meses.push({
      indice: ano * 12 + mes,
      chave: `${ano}-${String(mes + 1).padStart(2, '0')}`, // "YYYY-MM"
    });
  }

  return meses;
}

function estavaAtivaNoMes(assinatura, indiceDoMes) {
  if (assinatura.desativado_em) {
    return false;
  }

  const indiceInicio = paraIndiceDeMes(assinatura.data_inicio ?? assinatura.criado_em);

  if (indiceInicio > indiceDoMes) {
    return false;
  }

  if (assinatura.status === 'ativo') {
    return true;
  }

  if (assinatura.status !== 'cancelado' || !assinatura.cancelado_em) {
    return false;
  }

  return indiceDoMes < paraIndiceDeMes(assinatura.cancelado_em);
}

export async function calcularHistoricoMensal(referencia = new Date()) {
  const assinaturas = await getAssinaturasParaHistorico();
  const meses = gerarUltimos12Meses(referencia);

  return meses.map(({ indice, chave }) => {
    const somaDoMes = assinaturas.reduce((acumulado, assinatura) => {
      if (!estavaAtivaNoMes(assinatura, indice)) return acumulado;
      
      const valor = typeof assinatura.valor?.toNumber === 'function' 
        ? assinatura.valor.toNumber() 
        : Number(assinatura.valor) || 0;
    
      return acumulado + valor;
    }, 0);

    return {
      mes: chave,
      total: Number(somaDoMes.toFixed(2)),
    };
  });
}

function lerDiasAlertaConfigurados() {
  const bruto = process.env.NOTIFY_DAYS_BEFORE;
  const valor = Number(bruto);
 
  if (bruto === undefined || bruto === '' || Number.isNaN(valor) || valor < 0) {
    return DIAS_ALERTA_PADRAO;
  }
 
  return valor;
}
 
export async function buscarProximasCobrancas({
  diasAlerta = lerDiasAlertaConfigurados(),
  referencia = hojeUTC(),
} = {}) {
  const assinaturas = await getAssinaturasAtivasParaAlerta();
 
  return assinaturas
    .map((assinatura) => {
      const proximaCobranca = calcularProximaCobranca(assinatura.data_cobranca, referencia);
      const diasRestantes = diferencaEmDias(proximaCobranca, referencia);
 
      return {
        id: assinatura.id,
        nome: assinatura.nome,
        valor: Number(assinatura.valor.toFixed(2)),
        proximaCobranca: formatarDataISO(proximaCobranca),
        diasRestantes,
      };
    })
    .filter((assinatura) => assinatura.diasRestantes <= diasAlerta);
}
