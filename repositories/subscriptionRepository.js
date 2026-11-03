import { prisma } from '../lib/prisma.js';

export const STATUS_ATIVO = 'ativo';

export async function findById(id) {
  const numericId = Number(id);
  return prisma.subscription.findFirst({
    where: {
      id: numericId,
      desativado_em: null,
    },
  });
}

export async function findAll(where = {}) {
  return prisma.subscription.findMany({
    where: {
      ...where,
      desativado_em: null,
    },
    orderBy: { criado_em: 'desc' },
  });
}

export async function create(dados) {
  return prisma.subscription.create({
    data: {
      ...dados,
      valor: dados.valor !== undefined ? Number(dados.valor) : undefined,
      data_cobranca: dados.data_cobranca ? new Date(dados.data_cobranca) : undefined,
      data_inicio: dados.data_inicio ? new Date(dados.data_inicio) : undefined,
      cancelado_em: dados.cancelado_em ? new Date(dados.cancelado_em) : undefined,
      desativado_em: dados.desativado_em ? new Date(dados.desativado_em) : undefined,
    },
  });
}

export async function update(id, dados) {
  const numericId = Number(id);
  const data = { ...dados };

  if (data.valor !== undefined) data.valor = Number(data.valor);
  if (data.data_cobranca !== undefined) {
    data.data_cobranca = data.data_cobranca ? new Date(data.data_cobranca) : null;
  }
  if (data.data_inicio !== undefined) {
    data.data_inicio = data.data_inicio ? new Date(data.data_inicio) : null;
  }
  if (data.cancelado_em !== undefined) {
    data.cancelado_em = data.cancelado_em ? new Date(data.cancelado_em) : null;
  }
  if (data.desativado_em !== undefined) {
    data.desativado_em = data.desativado_em ? new Date(data.desativado_em) : null;
  }

  return prisma.subscription.update({
    where: { id: numericId },
    data,
  });
}

export async function desativar(id) {
  const numericId = Number(id);
  return prisma.subscription.update({
    where: { id: numericId },
    data: { desativado_em: new Date() },
  });
}

export async function remove(id) {
  const numericId = Number(id);
  return prisma.subscription.delete({
    where: { id: numericId },
  });
}

export async function getResumoAssinaturasAtivas() {
  const resultado = await prisma.subscription.aggregate({
    where: {
      status: STATUS_ATIVO,
      desativado_em: null,
    },
    _sum: { valor: true },
    _count: { _all: true },
  });

  return {
    somaValor: resultado._sum.valor,
    quantidade: resultado._count._all,
  };
}

export async function getTotaisPorCategoriaAtivas() {
  return prisma.subscription.groupBy({
    by: ['categoria'],
    where: {
      status: STATUS_ATIVO,
      desativado_em: null,
    },
    _sum: { valor: true },
  });
}

export async function getAssinaturasParaHistorico() {
  return prisma.subscription.findMany({
    where: {
      desativado_em: null,
    },
    select: {
      valor: true,
      criado_em: true,
      data_inicio: true,
      cancelado_em: true,
      desativado_em: true,
      status: true,
    },
  });
}

export async function getAssinaturasAtivasParaAlerta() {
  return prisma.subscription.findMany({
    where: {
      status: STATUS_ATIVO,
      desativado_em: null,
    },
    select: {
      id: true,
      nome: true,
      valor: true,
      data_cobranca: true,
    },
  });
}
