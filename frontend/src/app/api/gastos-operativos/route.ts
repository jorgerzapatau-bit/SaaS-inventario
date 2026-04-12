import { NextRequest } from 'next/server';
import prisma from '../lib/prisma';
import { getAuthUser, unauthorized } from '../lib/auth';

// ─── Helper: obtener primer almacén de la empresa ─────────────────────────────
// Se usa cuando el gasto es de tipo INSUMO y no se especifica almacén.
async function getDefaultAlmacen(empresaId: string): Promise<string | null> {
    const almacen = await prisma.almacen.findFirst({
        where: { empresaId },
        orderBy: { nombre: 'asc' },
        select: { id: true },
    });
    return almacen?.id ?? null;
}

// ─── Helper: serializar decimal fields ───────────────────────────────────────
function serializeGasto(g: any) {
    return {
        ...g,
        cantidad:       Number(g.cantidad),
        precioUnitario: Number(g.precioUnitario),
        total:          g.total ? Number(g.total) : Number(g.cantidad) * Number(g.precioUnitario),
        tipoCambio:     g.tipoCambio ? Number(g.tipoCambio) : null,
    };
}

// ─── GET /api/gastos-operativos ───────────────────────────────────────────────
// Query params: equipoId, obraId, plantillaId, semanaNum, anoNum, categoria, tipoGasto
export async function GET(req: NextRequest) {
    const user = getAuthUser(req);
    if (!user) return unauthorized();
    try {
        const { searchParams } = new URL(req.url);
        const equipoId   = searchParams.get('equipoId')   || undefined;
        const obraId     = searchParams.get('obraId')     || undefined;
        const plantillaId = searchParams.get('plantillaId') || undefined;
        const semanaNum  = searchParams.get('semanaNum')  ? parseInt(searchParams.get('semanaNum')!)  : undefined;
        const anoNum     = searchParams.get('anoNum')     ? parseInt(searchParams.get('anoNum')!)     : undefined;
        const categoria  = searchParams.get('categoria')  || undefined;
        const tipoGasto  = searchParams.get('tipoGasto')  || undefined;

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
            },
            orderBy: [{ anoNum: 'desc' }, { semanaNum: 'desc' }, { createdAt: 'desc' }],
            include: {
                equipo:      { select: { nombre: true, numeroEconomico: true } },
                obra:        { select: { nombre: true } },
                plantilla:   { select: { numero: true, fechaInicio: true, fechaFin: true } },
                productoRef: { select: { nombre: true, unidad: true, stockActual: true } },
            },
        });

        return Response.json(gastos.map(serializeGasto));
    } catch (error) {
        console.error(error);
        return Response.json({ error: 'Error al obtener gastos operativos' }, { status: 500 });
    }
}

// ─── POST /api/gastos-operativos ──────────────────────────────────────────────
// Si tipoGasto === 'INSUMO':
//   - productoId es requerido
//   - Se crea un MovimientoInventario tipo SALIDA que descuenta el stock
//   - El precioUnitario se toma del catálogo si no se envía
// Si tipoGasto === 'EXTERNO':
//   - Comportamiento original: texto libre, sin impacto al inventario
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
            tipoGasto = 'EXTERNO',
            categoria,
            producto,
            productoId,   // solo para INSUMO
            almacenId,    // opcional para INSUMO
            unidad,
            cantidad,
            precioUnitario,
            moneda,
            tipoCambio,
            notas,
        } = body;

        // ── Validaciones comunes ──────────────────────────────────────────────
        if (!equipoId)
            return Response.json({ error: 'equipoId es requerido' }, { status: 400 });
        if (!cantidad || Number(cantidad) <= 0)
            return Response.json({ error: 'La cantidad debe ser mayor a 0' }, { status: 400 });

        const cantidadNum  = Number(cantidad);
        const fechaDate    = fechaInicio ? new Date(fechaInicio) : new Date();
        const semanaFinal  = semanaNum  ?? getISOWeek(fechaDate);
        const anoFinal     = anoNum     ?? fechaDate.getFullYear();
        const monedaVal    = moneda === 'USD' ? 'USD' : 'MXN';
        const tipoCambioN  = tipoCambio != null ? Number(tipoCambio) : null;

        // ── FLUJO INSUMO: consume del almacén y descuenta stock ───────────────
        if (tipoGasto === 'INSUMO') {
            if (!productoId)
                return Response.json({ error: 'productoId es requerido cuando tipoGasto es INSUMO' }, { status: 400 });

            // Buscar el producto en el catálogo de la empresa
            const productoCatalogo = await prisma.producto.findFirst({
                where: { id: productoId },
                select: { nombre: true, unidad: true, precioCompra: true, stockActual: true },
            });
            if (!productoCatalogo)
                return Response.json({ error: 'Producto no encontrado en el catálogo' }, { status: 404 });

            // Verificar stock suficiente
            const stockActual = Number(productoCatalogo.stockActual);
            if (stockActual < cantidadNum)
                return Response.json(
                    { error: `Stock insuficiente. Stock actual: ${stockActual} ${productoCatalogo.unidad}` },
                    { status: 400 }
                );

            // Precio: usa el del catálogo si no se envía manualmente
            const precioFinal = precioUnitario != null
                ? Number(precioUnitario)
                : Number(productoCatalogo.precioCompra);

            // Obtener almacén (el enviado o el primero de la empresa)
            const almacenFinal = almacenId || await getDefaultAlmacen(user.empresaId);
            if (!almacenFinal)
                return Response.json({ error: 'No hay almacenes configurados en la empresa' }, { status: 400 });

            // Ejecutar en transacción: crear gasto + movimiento de salida + actualizar stock
            const gasto = await prisma.$transaction(async (tx) => {
                // 1. Crear el GastoOperativo
                const g = await tx.gastoOperativo.create({
                    data: {
                        empresaId:      user.empresaId,
                        equipoId,
                        obraId:         obraId      || null,
                        plantillaId:    plantillaId || null,
                        semanaNum:      semanaFinal,
                        anoNum:         anoFinal,
                        fechaInicio:    fechaDate,
                        tipoGasto:      'INSUMO',
                        categoria:      categoria || 'OTRO',
                        producto:       productoCatalogo.nombre,
                        productoId:     productoId,
                        unidad:         productoCatalogo.unidad,
                        cantidad:       cantidadNum,
                        precioUnitario: precioFinal,
                        moneda:         monedaVal,
                        tipoCambio:     tipoCambioN,
                        notas:          notas || null,
                    },
                    include: {
                        equipo:      { select: { nombre: true, numeroEconomico: true } },
                        obra:        { select: { nombre: true } },
                        plantilla:   { select: { numero: true, fechaInicio: true, fechaFin: true } },
                        productoRef: { select: { nombre: true, unidad: true, stockActual: true } },
                    },
                });

                // 2. Registrar MovimientoInventario tipo SALIDA (descuenta Kardex)
                await tx.movimientoInventario.create({
                    data: {
                        empresaId:     user.empresaId,
                        productoId,
                        almacenId:     almacenFinal,
                        tipoMovimiento: 'SALIDA',
                        cantidad:       cantidadNum,
                        costoUnitario:  precioFinal,
                        moneda:         monedaVal,
                        tipoCambio:     tipoCambioN,
                        obraId:         obraId || null,
                        referencia:     `GASTO-EQUIPO:${equipoId}`,
                        notas:          `Consumo registrado como Gasto Operativo. Equipo: ${equipoId}${obraId ? ` | Obra: ${obraId}` : ''}`,
                        fecha:          fechaDate,
                        usuarioId:      user.id,
                    },
                });

                // 3. Actualizar stockActual en el producto
                await tx.producto.update({
                    where: { id: productoId },
                    data:  { stockActual: { decrement: cantidadNum } },
                });

                return g;
            });

            return Response.json(serializeGasto(gasto), { status: 201 });
        }

        // ── FLUJO EXTERNO: gasto libre sin impacto al inventario ──────────────
        if (!producto?.trim())
            return Response.json({ error: 'El concepto / producto es requerido' }, { status: 400 });
        if (precioUnitario == null)
            return Response.json({ error: 'El precio unitario es requerido' }, { status: 400 });

        const gasto = await prisma.gastoOperativo.create({
            data: {
                empresaId:      user.empresaId,
                equipoId,
                obraId:         obraId      || null,
                plantillaId:    plantillaId || null,
                semanaNum:      semanaFinal,
                anoNum:         anoFinal,
                fechaInicio:    fechaDate,
                tipoGasto:      'EXTERNO',
                categoria:      categoria || 'OTRO',
                producto:       producto.trim(),
                productoId:     null,
                unidad:         unidad || 'pza',
                cantidad:       cantidadNum,
                precioUnitario: Number(precioUnitario),
                moneda:         monedaVal,
                tipoCambio:     tipoCambioN,
                notas:          notas || null,
            },
            include: {
                equipo:      { select: { nombre: true, numeroEconomico: true } },
                obra:        { select: { nombre: true } },
                plantilla:   { select: { numero: true, fechaInicio: true, fechaFin: true } },
                productoRef: { select: { nombre: true, unidad: true, stockActual: true } },
            },
        });

        return Response.json(serializeGasto(gasto), { status: 201 });

    } catch (error: unknown) {
        console.error(error);
        return Response.json({ error: (error as Error)?.message || 'Error al crear el gasto operativo' }, { status: 500 });
    }
}

// ─── Helper: número de semana ISO ────────────────────────────────────────────
function getISOWeek(date: Date): number {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
}
