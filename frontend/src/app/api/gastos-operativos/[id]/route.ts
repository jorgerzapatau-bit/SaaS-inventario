import { NextRequest } from 'next/server';
import prisma from '../../lib/prisma';
import { getAuthUser, unauthorized } from '../../lib/auth';

type Params = { params: Promise<{ id: string }> };

function parseDateOnly(value?: string | null): Date | null {
  if (!value) return null;
  const v = String(value).trim();

  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) {
    return new Date(`${v}T12:00:00`);
  }

  throw new Error(`Fecha inválida: "${value}". Usa el formato YYYY-MM-DD.`);
}

function serializeGasto(g: any) {
  return {
    ...g,
    cantidad: Number(g.cantidad),
    precioUnitario: Number(g.precioUnitario),
    total: g.total ? Number(g.total) : Number(g.cantidad) * Number(g.precioUnitario),
    tipoCambio: g.tipoCambio ? Number(g.tipoCambio) : null,
    distribuciones: (g.distribuciones || []).map((d: any) => ({
      ...d,
      porcentaje: Number(d.porcentaje),
      montoAsignado: Number(d.montoAsignado),
    })),
  };
}

function normalizeDistribuciones(distribuciones: any[] | undefined, total: number) {
  const rows = Array.isArray(distribuciones) ? distribuciones.filter(Boolean) : [];
  const normalized = rows.map((d) => ({
    plantillaId: d.plantillaId,
    porcentaje: Number(d.porcentaje || 0),
    montoAsignado: Number(d.montoAsignado || 0),
    metodoAsignacion: d.metodoAsignacion || 'MANUAL',
  })).filter((d) => d.plantillaId && (d.porcentaje > 0 || d.montoAsignado > 0));

  if (!normalized.length) return [];

  const pct = normalized.reduce((a, d) => a + d.porcentaje, 0);
  const amount = normalized.reduce((a, d) => a + d.montoAsignado, 0);
  const pctOk = Math.abs(pct - 100) < 0.01;
  const amountOk = Math.abs(amount - total) < 0.01;

  if (!pctOk && !amountOk) throw new Error('La distribución debe sumar 100% o coincidir con el total del gasto.');
  return normalized;
}

function validateNivel({ nivelGasto, obraId, equipoId, plantillaId }: any) {
  if (!obraId) throw new Error('La obra es obligatoria en Gastos Operativos.');
  if (nivelGasto === 'POR_EQUIPO' && !equipoId) {
    throw new Error('Debes seleccionar un equipo para un gasto por equipo.');
  }
  if (nivelGasto === 'POR_PLANTILLA' && !plantillaId) {
    throw new Error('Debes seleccionar una plantilla para un gasto por plantilla.');
  }
}

export async function DELETE(req: NextRequest, { params }: Params) {
  const user = getAuthUser(req);
  if (!user) return unauthorized();

  try {
    const { id } = await params;

    const gasto = await prisma.gastoOperativo.findFirst({
      where: { id, empresaId: user.empresaId },
      select: { tipoGasto: true, productoId: true, cantidad: true, equipoId: true, obraId: true },
    });

    if (!gasto) return Response.json({ error: 'Gasto no encontrado' }, { status: 404 });

    if (gasto.tipoGasto === 'INSUMO' && gasto.productoId) {
      const productoId = gasto.productoId;
      const referencia = gasto.equipoId ? `GASTO-EQUIPO:${gasto.equipoId}` : `GASTO-OBRA:${gasto.obraId}`;

      await prisma.$transaction(async (tx) => {
        const movimiento = await tx.movimientoInventario.findFirst({
          where: {
            empresaId: user.empresaId,
            productoId,
            tipoMovimiento: 'SALIDA',
            referencia,
          },
          orderBy: { createdAt: 'desc' },
          select: { id: true, cantidad: true },
        });

        if (movimiento) {
          await tx.movimientoInventario.delete({ where: { id: movimiento.id } });
          await tx.producto.update({
            where: { id: productoId },
            data: { stockActual: { increment: Number(movimiento.cantidad) } },
          });
        }

        await tx.gastoOperativo.delete({ where: { id } });
      });
    } else {
      await prisma.gastoOperativo.delete({ where: { id } });
    }

    return Response.json({ message: 'Gasto eliminado correctamente' });
  } catch (error: unknown) {
    if ((error as { code?: string }).code === 'P2025') {
      return Response.json({ error: 'Gasto no encontrado' }, { status: 404 });
    }
    console.error(error);
    return Response.json({ error: 'Error al eliminar el gasto' }, { status: 500 });
  }
}

export async function PUT(req: NextRequest, { params }: Params) {
  const user = getAuthUser(req);
  if (!user) return unauthorized();

  try {
    const { id } = await params;
    const {
      categoria,
      unidad,
      cantidad,
      precioUnitario,
      moneda,
      tipoCambio,
      obraId,
      equipoId,
      plantillaId,
      fechaInicio,
      fechaFin,
      nivelGasto,
      distribuible,
      notas,
      distribuciones,
    } = await req.json();

    const current = await prisma.gastoOperativo.findFirst({ where: { id, empresaId: user.empresaId } });
    if (!current) return Response.json({ error: 'Gasto no encontrado' }, { status: 404 });

    const nextNivel = nivelGasto ?? current.nivelGasto;
    const nextObraId = obraId !== undefined ? obraId : current.obraId;
    const nextEquipoId = equipoId !== undefined ? equipoId : current.equipoId;
    const nextPlantillaId = plantillaId !== undefined ? plantillaId : current.plantillaId;

    validateNivel({
      nivelGasto: nextNivel,
      obraId: nextObraId,
      equipoId: nextEquipoId,
      plantillaId: nextPlantillaId,
    });

    const newCantidad = cantidad !== undefined ? Number(cantidad) : Number(current.cantidad);
    const newPrecio = precioUnitario !== undefined ? Number(precioUnitario) : Number(current.precioUnitario);
    const total = newCantidad * newPrecio;
    const dist = distribuciones !== undefined ? normalizeDistribuciones(distribuciones, total) : null;

    const gasto = await prisma.$transaction(async (tx) => {
      if (dist) {
        await tx.gastoOperativoDistribucion.deleteMany({ where: { gastoOperativoId: id } });
      }

      const updated = await tx.gastoOperativo.update({
        where: { id },
        data: {
          ...(categoria !== undefined && { categoria }),
          ...(unidad !== undefined && { unidad }),
          ...(cantidad !== undefined && { cantidad: newCantidad }),
          ...(precioUnitario !== undefined && { precioUnitario: newPrecio }),
          ...(moneda !== undefined && { moneda: moneda === 'USD' ? 'USD' : 'MXN' }),
          ...(tipoCambio !== undefined && { tipoCambio: tipoCambio != null ? Number(tipoCambio) : null }),
          ...(obraId !== undefined && { obraId: obraId || null }),
          ...(equipoId !== undefined && { equipoId: equipoId || null }),
          ...(plantillaId !== undefined && { plantillaId: plantillaId || null }),
          ...(fechaInicio !== undefined && { fechaInicio: parseDateOnly(fechaInicio) }),
          ...(fechaFin !== undefined && { fechaFin: parseDateOnly(fechaFin) }),
          ...(nivelGasto !== undefined && { nivelGasto }),
          ...(distribuible !== undefined && { distribuible: Boolean(distribuible) }),
          ...(notas !== undefined && { notas: notas || null }),
          ...(dist ? {
            distribuciones: {
              create: dist.map((d) => ({
                plantillaId: d.plantillaId,
                porcentaje: d.porcentaje,
                montoAsignado: d.montoAsignado,
                metodoAsignacion: d.metodoAsignacion,
              })),
            },
          } : {}),
        },
        include: {
          equipo: { select: { nombre: true, numeroEconomico: true } },
          obra: { select: { nombre: true } },
          plantilla: { select: { id: true, numero: true, fechaInicio: true, fechaFin: true } },
          productoRef: { select: { nombre: true, unidad: true, stockActual: true } },
          distribuciones: { include: { plantilla: { select: { id: true, numero: true } } } },
        },
      });
      return updated;
    });

    return Response.json(serializeGasto(gasto));
  } catch (error: unknown) {
    console.error(error);
    if ((error as { code?: string }).code === 'P2025') {
      return Response.json({ error: 'Gasto no encontrado' }, { status: 404 });
    }
    return Response.json({ error: (error as Error)?.message || 'Error al actualizar el gasto' }, { status: 500 });
  }
}
