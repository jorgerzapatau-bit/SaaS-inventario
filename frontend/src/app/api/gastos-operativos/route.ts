import { NextRequest } from 'next/server';
import prisma from '../lib/prisma';
import { getAuthUser, unauthorized } from '../lib/auth';

async function getDefaultAlmacen(empresaId: string): Promise<string | null> {
  const almacen = await prisma.almacen.findFirst({
    where: { empresaId },
    orderBy: { nombre: 'asc' },
    select: { id: true },
  });
  return almacen?.id ?? null;
}

function getISOWeek(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
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

  if (!pctOk && !amountOk) {
    throw new Error('La distribución debe sumar 100% o coincidir con el total del gasto.');
  }

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

export async function GET(req: NextRequest) {
  const user = getAuthUser(req);
  if (!user) return unauthorized();

  try {
    const { searchParams } = new URL(req.url);
    const equipoId = searchParams.get('equipoId') || undefined;
    const obraId = searchParams.get('obraId') || undefined;
    const plantillaId = searchParams.get('plantillaId') || undefined;
    const semanaNum = searchParams.get('semanaNum') ? parseInt(searchParams.get('semanaNum')!) : undefined;
    const anoNum = searchParams.get('anoNum') ? parseInt(searchParams.get('anoNum')!) : undefined;
    const categoria = searchParams.get('categoria') || undefined;
    const tipoGasto = searchParams.get('tipoGasto') || undefined;
    const nivelGasto = searchParams.get('nivelGasto') || undefined;

    const gastos = await prisma.gastoOperativo.findMany({
      where: {
        empresaId: user.empresaId,
        ...(equipoId && { equipoId }),
        ...(obraId && { obraId }),
        ...(plantillaId && { plantillaId }),
        ...(semanaNum && { semanaNum }),
        ...(anoNum && { anoNum }),
        ...(categoria && { categoria: categoria as any }),
        ...(tipoGasto && { tipoGasto: tipoGasto as any }),
        ...(nivelGasto && { nivelGasto: nivelGasto as any }),
      },
      orderBy: [{ anoNum: 'desc' }, { semanaNum: 'desc' }, { createdAt: 'desc' }],
      include: {
        equipo: { select: { nombre: true, numeroEconomico: true } },
        obra: { select: { nombre: true } },
        plantilla: { select: { id: true, numero: true, fechaInicio: true, fechaFin: true } },
        productoRef: { select: { nombre: true, unidad: true, stockActual: true } },
        distribuciones: {
          include: { plantilla: { select: { id: true, numero: true } } },
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    return Response.json(gastos.map(serializeGasto));
  } catch (error) {
    console.error(error);
    return Response.json({ error: 'Error al obtener gastos operativos' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const user = getAuthUser(req);
  if (!user) return unauthorized();

  try {
    const body = await req.json();
    const {
      equipoId,
      obraId,
      plantillaId,
      semanaNum,
      anoNum,
      fechaInicio,
      fechaFin,
      tipoGasto = 'EXTERNO',
      nivelGasto = 'GENERAL',
      distribuible = false,
      categoria,
      producto,
      productoId,
      almacenId,
      unidad,
      cantidad,
      precioUnitario,
      moneda,
      tipoCambio,
      notas,
      distribuciones,
    } = body;

    validateNivel({ nivelGasto, obraId, equipoId, plantillaId });

    if (!cantidad || Number(cantidad) <= 0) {
      return Response.json({ error: 'La cantidad debe ser mayor a 0' }, { status: 400 });
    }

    const cantidadNum = Number(cantidad);
    const fechaDate = fechaInicio ? new Date(fechaInicio) : new Date();
    const fechaFinDate = fechaFin ? new Date(fechaFin) : null;
    const semanaFinal = semanaNum ?? getISOWeek(fechaDate);
    const anoFinal = anoNum ?? fechaDate.getFullYear();
    const monedaVal = moneda === 'USD' ? 'USD' : 'MXN';
    const tipoCambioN = tipoCambio != null ? Number(tipoCambio) : null;

    if (tipoGasto === 'INSUMO') {
      if (!productoId) {
        return Response.json({ error: 'productoId es requerido cuando tipoGasto es INSUMO' }, { status: 400 });
      }

      const productoCatalogo = await prisma.producto.findFirst({
        where: { id: productoId },
        select: { nombre: true, unidad: true, precioCompra: true, stockActual: true },
      });
      if (!productoCatalogo) {
        return Response.json({ error: 'Producto no encontrado en el catálogo' }, { status: 404 });
      }

      const stockActual = Number(productoCatalogo.stockActual);
      if (stockActual < cantidadNum) {
        return Response.json({ error: `Stock insuficiente. Stock actual: ${stockActual} ${productoCatalogo.unidad}` }, { status: 400 });
      }

      const precioFinal = precioUnitario != null ? Number(precioUnitario) : Number(productoCatalogo.precioCompra);
      const totalFinal = cantidadNum * precioFinal;
      const dist = normalizeDistribuciones(distribuciones, totalFinal);
      const almacenFinal = almacenId || await getDefaultAlmacen(user.empresaId);
      if (!almacenFinal) {
        return Response.json({ error: 'No hay almacenes configurados en la empresa' }, { status: 400 });
      }

      const gasto = await prisma.$transaction(async (tx) => {
        const g = await tx.gastoOperativo.create({
          data: {
            empresaId: user.empresaId,
            equipoId: equipoId || null,
            obraId: obraId || null,
            plantillaId: plantillaId || null,
            semanaNum: semanaFinal,
            anoNum: anoFinal,
            fechaInicio: fechaDate,
            fechaFin: fechaFinDate,
            tipoGasto: 'INSUMO',
            nivelGasto,
            distribuible: Boolean(distribuible || nivelGasto === 'DISTRIBUIBLE'),
            categoria: categoria || 'OTRO',
            producto: productoCatalogo.nombre,
            productoId,
            unidad: productoCatalogo.unidad,
            cantidad: cantidadNum,
            precioUnitario: precioFinal,
            moneda: monedaVal,
            tipoCambio: tipoCambioN,
            notas: notas || null,
            distribuciones: dist.length ? {
              create: dist.map((d) => ({
                plantillaId: d.plantillaId,
                porcentaje: d.porcentaje,
                montoAsignado: d.montoAsignado,
                metodoAsignacion: d.metodoAsignacion,
              })),
            } : undefined,
          },
          include: {
            equipo: { select: { nombre: true, numeroEconomico: true } },
            obra: { select: { nombre: true } },
            plantilla: { select: { id: true, numero: true, fechaInicio: true, fechaFin: true } },
            productoRef: { select: { nombre: true, unidad: true, stockActual: true } },
            distribuciones: { include: { plantilla: { select: { id: true, numero: true } } } },
          },
        });

        await tx.movimientoInventario.create({
          data: {
            empresaId: user.empresaId,
            productoId,
            almacenId: almacenFinal,
            tipoMovimiento: 'SALIDA',
            cantidad: cantidadNum,
            costoUnitario: precioFinal,
            moneda: monedaVal,
            tipoCambio: tipoCambioN,
            obraId: obraId || null,
            referencia: equipoId ? `GASTO-EQUIPO:${equipoId}` : `GASTO-OBRA:${obraId}`,
            notas: `Consumo registrado como Gasto Operativo${equipoId ? `. Equipo: ${equipoId}` : ''}${obraId ? ` | Obra: ${obraId}` : ''}`,
            fecha: fechaDate,
            usuarioId: user.id,
          },
        });

        await tx.producto.update({ where: { id: productoId }, data: { stockActual: { decrement: cantidadNum } } });
        return g;
      });

      return Response.json(serializeGasto(gasto), { status: 201 });
    }

    if (!producto?.trim()) {
      return Response.json({ error: 'El concepto / producto es requerido' }, { status: 400 });
    }
    if (precioUnitario == null) {
      return Response.json({ error: 'El precio unitario es requerido' }, { status: 400 });
    }

    const totalFinal = cantidadNum * Number(precioUnitario);
    const dist = normalizeDistribuciones(distribuciones, totalFinal);

    const gasto = await prisma.gastoOperativo.create({
      data: {
        empresaId: user.empresaId,
        equipoId: equipoId || null,
        obraId: obraId || null,
        plantillaId: plantillaId || null,
        semanaNum: semanaFinal,
        anoNum: anoFinal,
        fechaInicio: fechaDate,
        fechaFin: fechaFinDate,
        tipoGasto: 'EXTERNO',
        nivelGasto,
        distribuible: Boolean(distribuible || nivelGasto === 'DISTRIBUIBLE'),
        categoria: categoria || 'OTRO',
        producto: producto.trim(),
        productoId: null,
        unidad: unidad || 'pza',
        cantidad: cantidadNum,
        precioUnitario: Number(precioUnitario),
        moneda: monedaVal,
        tipoCambio: tipoCambioN,
        notas: notas || null,
        distribuciones: dist.length ? {
          create: dist.map((d) => ({
            plantillaId: d.plantillaId,
            porcentaje: d.porcentaje,
            montoAsignado: d.montoAsignado,
            metodoAsignacion: d.metodoAsignacion,
          })),
        } : undefined,
      },
      include: {
        equipo: { select: { nombre: true, numeroEconomico: true } },
        obra: { select: { nombre: true } },
        plantilla: { select: { id: true, numero: true, fechaInicio: true, fechaFin: true } },
        productoRef: { select: { nombre: true, unidad: true, stockActual: true } },
        distribuciones: { include: { plantilla: { select: { id: true, numero: true } } } },
      },
    });

    return Response.json(serializeGasto(gasto), { status: 201 });
  } catch (error: unknown) {
    console.error(error);
    return Response.json({ error: (error as Error)?.message || 'Error al crear el gasto operativo' }, { status: 500 });
  }
}
