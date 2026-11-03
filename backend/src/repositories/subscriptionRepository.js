import { prisma } from '../lib/prisma.js';

const STATUS_ATIVO = 'ativo';

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
    somaValor: resultado._sum.valor, // Decimal | null quando não há registros
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
