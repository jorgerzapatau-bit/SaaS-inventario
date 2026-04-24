import { NextRequest } from 'next/server';
import prisma from '@/lib/prisma';
import { getAuthUser, unauthorized } from '@/lib/auth';

async function getDefaultAlmacen(empresaId: string): Promise<string | null> {
    const a = await prisma.almacen.findFirst({ where: { empresaId }, orderBy: { nombre: 'asc' }, select: { id: true } });
    return a?.id ?? null;
}

function serializeGasto(g: any) {
    const toDateStr = (v: any): string | null => {
        if (!v) return null;
        if (typeof v === 'string') return v.slice(0, 10);
        if (v instanceof Date) return v.toISOString().slice(0, 10);
        return null;
    };
    return {
        ...g,
        fechaInicio:    toDateStr(g.fechaInicio),
        fechaFin:       toDateStr(g.fechaFin),
        cantidad:       Number(g.cantidad),
        precioUnitario: Number(g.precioUnitario),
        total:          g.total ? Number(g.total) : Number(g.cantidad) * Number(g.precioUnitario),
        tipoCambio:     g.tipoCambio ? Number(g.tipoCambio) : null,
        distribuciones: (g.distribuciones ?? []).map((d: any) => ({
            ...d,
            porcentaje:    Number(d.porcentaje),
            montoAsignado: Number(d.montoAsignado),
        })),
    };
}

function getISOWeek(date: Date): number {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
    const ys = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil((((d.getTime() - ys.getTime()) / 86400000) + 1) / 7);
}

const includeGasto = {
    equipo:        { select: { nombre: true, numeroEconomico: true } },
    obra:          { select: { nombre: true } },
    plantilla:     { select: { numero: true, fechaInicio: true, fechaFin: true } },
    productoRef:   { select: { nombre: true, unidad: true, stockActual: true } },
    distribuciones: { include: { plantilla: { select: { numero: true, obraId: true } } } },
} as const;

// GET /api/gastos-operativos
export async function GET(req: NextRequest) {
    const user = getAuthUser(req);
    if (!user) return unauthorized();
    try {
        const { searchParams } = new URL(req.url);
        const equipoId    = searchParams.get('equipoId')    || undefined;
        const obraId      = searchParams.get('obraId')      || undefined;
        const plantillaId = searchParams.get('plantillaId') || undefined;
        const semanaNum   = searchParams.get('semanaNum')   ? parseInt(searchParams.get('semanaNum')!)  : undefined;
        const anoNum      = searchParams.get('anoNum')      ? parseInt(searchParams.get('anoNum')!)     : undefined;
        const categoria   = searchParams.get('categoria')   || undefined;
        const tipoGasto   = searchParams.get('tipoGasto')   || undefined;
        const nivelGasto  = searchParams.get('nivelGasto')  || undefined;
        const distribStr  = searchParams.get('distribuible');

        const gastos = await prisma.gastoOperativo.findMany({
            where: {
                empresaId: user.empresaId,
                ...(equipoId    && { equipoId }),
                ...(obraId      && { obraId }),
                ...(plantillaId && { plantillaId }),
                ...(semanaNum   && { semanaNum }),
                ...(anoNum      && { anoNum }),
                ...(categoria   && { categoria: categoria as any }),
                ...(tipoGasto   && { tipoGasto: tipoGasto as any }),
                ...(nivelGasto  && { nivelGasto: nivelGasto as any }),
                ...(distribStr !== null && distribStr !== undefined && { distribuible: distribStr === 'true' }),
            },
            orderBy: [{ anoNum: 'desc' }, { semanaNum: 'desc' }, { createdAt: 'desc' }],
            include: includeGasto,
        });

        return Response.json(gastos.map(serializeGasto));
    } catch (error) {
        console.error(error);
        return Response.json({ error: 'Error al obtener gastos operativos' }, { status: 500 });
    }
}

// POST /api/gastos-operativos
export async function POST(req: NextRequest) {
    const user = getAuthUser(req);
    if (!user) return unauthorized();
    try {
        const body = await req.json();
        const {
            obraId, equipoId, plantillaId,
            semanaNum, anoNum, fechaInicio, fechaFin,
            nivelGasto   = 'GENERAL',
            distribuible = false,
            tipoGasto    = 'EXTERNO',
            categoria, producto, productoId, almacenId,
            unidad, cantidad, precioUnitario, moneda, tipoCambio, notas,
            distribuciones = [],
        } = body;

        // Validaciones comunes
        if (!obraId)
            return Response.json({ error: 'obraId es requerido' }, { status: 400 });
        if (!cantidad || Number(cantidad) <= 0)
            return Response.json({ error: 'La cantidad debe ser mayor a 0' }, { status: 400 });

        // Validaciones por nivel
        if (nivelGasto === 'POR_EQUIPO' && !equipoId)
            return Response.json({ error: 'equipoId es requerido cuando el nivel es POR_EQUIPO' }, { status: 400 });
        if (nivelGasto === 'POR_PLANTILLA' && !plantillaId)
            return Response.json({ error: 'plantillaId es requerido cuando el nivel es POR_PLANTILLA' }, { status: 400 });
        if (nivelGasto === 'DISTRIBUIBLE' && (!distribuciones || distribuciones.length === 0))
            return Response.json({ error: 'Debe incluir al menos una distribución de plantilla' }, { status: 400 });

        // Validar porcentajes
        if (nivelGasto === 'DISTRIBUIBLE' && distribuciones.length > 0) {
            const totalPct = distribuciones.reduce((acc: number, d: any) => acc + Number(d.porcentaje), 0);
            if (Math.abs(totalPct - 100) > 0.01)
                return Response.json({ error: `Los porcentajes deben sumar 100%. Suma actual: ${totalPct.toFixed(2)}%` }, { status: 400 });
        }

        const cantidadNum   = Number(cantidad);
        const fechaDate     = fechaInicio ? new Date(fechaInicio) : new Date();
        const fechaFinDate  = fechaFin ? new Date(fechaFin) : null;
        const semanaFinal   = semanaNum ?? getISOWeek(fechaDate);
        const anoFinal      = anoNum    ?? fechaDate.getFullYear();
        const monedaVal     = moneda === 'USD' ? 'USD' : 'MXN';
        const tipoCambioN   = tipoCambio != null ? Number(tipoCambio) : null;
        const esDistribuible = nivelGasto === 'DISTRIBUIBLE' || distribuible === true;

        // ── INSUMO ────────────────────────────────────────────────────────────
        if (tipoGasto === 'INSUMO') {
            if (!productoId)
                return Response.json({ error: 'productoId es requerido cuando tipoGasto es INSUMO' }, { status: 400 });

            const prod = await prisma.producto.findFirst({
                where: { id: productoId },
                select: { nombre: true, unidad: true, precioCompra: true, stockActual: true },
            });
            if (!prod)
                return Response.json({ error: 'Producto no encontrado en el catálogo' }, { status: 404 });
            if (Number(prod.stockActual) < cantidadNum)
                return Response.json({ error: `Stock insuficiente. Disponible: ${prod.stockActual} ${prod.unidad}` }, { status: 400 });

            const precioFinal  = precioUnitario != null ? Number(precioUnitario) : Number(prod.precioCompra);
            const importeTotal = cantidadNum * precioFinal;
            const almacenFinal = almacenId || await getDefaultAlmacen(user.empresaId);
            if (!almacenFinal)
                return Response.json({ error: 'No hay almacenes configurados en la empresa' }, { status: 400 });

            const gasto = await prisma.$transaction(async (tx) => {
                const g = await tx.gastoOperativo.create({
                    data: {
                        empresaId: user.empresaId, obraId,
                        equipoId: equipoId || null, plantillaId: plantillaId || null,
                        semanaNum: semanaFinal, anoNum: anoFinal,
                        fechaInicio: fechaDate, fechaFin: fechaFinDate,
                        nivelGasto: nivelGasto as any, origen: 'GENERAL_MANUAL', distribuible: esDistribuible,
                        tipoGasto: 'INSUMO', categoria: categoria || 'OTRO',
                        producto: prod.nombre, productoId, unidad: prod.unidad,
                        cantidad: cantidadNum, precioUnitario: precioFinal,
                        moneda: monedaVal, tipoCambio: tipoCambioN, notas: notas || null,
                    },
                    include: includeGasto,
                });

                await tx.movimientoInventario.create({
                    data: {
                        empresaId: user.empresaId, productoId, almacenId: almacenFinal,
                        tipoMovimiento: 'SALIDA', cantidad: cantidadNum, costoUnitario: precioFinal,
                        moneda: monedaVal, tipoCambio: tipoCambioN, obraId: obraId || null,
                        referencia: `GASTO-OBRA:${obraId}${equipoId ? `|EQ:${equipoId}` : ''}`,
                        notas: `Gasto Operativo. Obra: ${obraId}`, fecha: fechaDate, usuarioId: user.id,
                    },
                });

                await tx.producto.update({ where: { id: productoId }, data: { stockActual: { decrement: cantidadNum } } });

                if (esDistribuible && distribuciones.length > 0) {
                    for (const d of distribuciones) {
                        await tx.gastoOperativoDistribucion.create({
                            data: {
                                gastoOperativoId: g.id, plantillaId: d.plantillaId,
                                porcentaje: Number(d.porcentaje),
                                montoAsignado: (importeTotal * Number(d.porcentaje)) / 100,
                                metodoAsignacion: d.metodoAsignacion || 'MANUAL', notas: d.notas || null,
                            },
                        });
                    }
                }
                return g;
            });

            return Response.json(serializeGasto(gasto), { status: 201 });
        }

        // ── EXTERNO ───────────────────────────────────────────────────────────
        if (!producto?.trim())
            return Response.json({ error: 'El concepto / producto es requerido' }, { status: 400 });
        if (precioUnitario == null)
            return Response.json({ error: 'El precio unitario es requerido' }, { status: 400 });

        const precioNum    = Number(precioUnitario);
        const importeTotal = cantidadNum * precioNum;

        const gasto = await prisma.$transaction(async (tx) => {
            const g = await tx.gastoOperativo.create({
                data: {
                    empresaId: user.empresaId, obraId,
                    equipoId: equipoId || null, plantillaId: plantillaId || null,
                    semanaNum: semanaFinal, anoNum: anoFinal,
                    fechaInicio: fechaDate, fechaFin: fechaFinDate,
                    nivelGasto: nivelGasto as any, origen: 'GENERAL_MANUAL', distribuible: esDistribuible,
                    tipoGasto: 'EXTERNO', categoria: categoria || 'OTRO',
                    producto: producto.trim(), productoId: null,
                    unidad: unidad || 'pza', cantidad: cantidadNum, precioUnitario: precioNum,
                    moneda: monedaVal, tipoCambio: tipoCambioN, notas: notas || null,
                },
                include: includeGasto,
            });

            if (esDistribuible && distribuciones.length > 0) {
                for (const d of distribuciones) {
                    await tx.gastoOperativoDistribucion.create({
                        data: {
                            gastoOperativoId: g.id, plantillaId: d.plantillaId,
                            porcentaje: Number(d.porcentaje),
                            montoAsignado: (importeTotal * Number(d.porcentaje)) / 100,
                            metodoAsignacion: d.metodoAsignacion || 'MANUAL', notas: d.notas || null,
                        },
                    });
                }
            }
            return g;
        });

        return Response.json(serializeGasto(gasto), { status: 201 });

    } catch (error: unknown) {
        console.error(error);
        return Response.json({ error: (error as Error)?.message || 'Error al crear el gasto operativo' }, { status: 500 });
    }
}

