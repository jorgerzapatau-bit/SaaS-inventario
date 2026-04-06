import { NextRequest } from 'next/server';
import prisma from '../lib/prisma';
import { getAuthUser, unauthorized } from '../lib/auth';

// ─── GET /api/registros-diarios ───────────────────────────────────────────────
// Acepta query params: equipoId, fechaInicio, fechaFin, semanaNum, anoNum
export async function GET(req: NextRequest) {
    const user = getAuthUser(req);
    if (!user) return unauthorized();
    try {
        const { searchParams } = new URL(req.url);
        const equipoId    = searchParams.get('equipoId')    || undefined;
        const semanaNum   = searchParams.get('semanaNum')   ? parseInt(searchParams.get('semanaNum')!)   : undefined;
        const anoNum      = searchParams.get('anoNum')      ? parseInt(searchParams.get('anoNum')!)      : undefined;
        const fechaInicio = searchParams.get('fechaInicio') ? new Date(searchParams.get('fechaInicio')!) : undefined;
        const fechaFin    = searchParams.get('fechaFin')    ? new Date(searchParams.get('fechaFin')!)    : undefined;
        const limit       = searchParams.get('limit')       ? parseInt(searchParams.get('limit')!)       : undefined;

        const registros = await prisma.registroDiario.findMany({
            where: {
                empresaId: user.empresaId,
                ...(equipoId  && { equipoId }),
                ...(semanaNum && { semanaNum }),
                ...(anoNum    && { anoNum }),
                ...(fechaInicio || fechaFin ? {
                    fecha: {
                        ...(fechaInicio && { gte: fechaInicio }),
                        ...(fechaFin    && { lte: fechaFin }),
                    },
                } : {}),
            },
            orderBy: { fecha: 'desc' },
            ...(limit ? { take: limit } : {}),
            include: {
                equipo:  { select: { nombre: true, numeroEconomico: true } },
                usuario: { select: { nombre: true } },
                cliente: { select: { nombre: true } },
            },
        });

        return Response.json(registros.map(r => serializeRegistro(r)));
    } catch (error) {
        console.error(error);
        return Response.json({ error: 'Error fetching registros diarios' }, { status: 500 });
    }
}

// ─── POST /api/registros-diarios ──────────────────────────────────────────────
// Crea el registro diario de operación (equivalente a una fila de la hoja Rpte).
// Si se envía litrosDiesel > 0, registra automáticamente el consumo en el kardex.
export async function POST(req: NextRequest) {
    const user = getAuthUser(req);
    if (!user) return unauthorized();
    try {
        const {
            equipoId,
            fecha,
            horometroInicio,
            horometroFin,
            barrenos,
            metrosLineales,
            litrosDiesel,
            precioDiesel,
            tanqueInicio,
            litrosTanqueInicio,
            tanqueFin,
            litrosTanqueFin,
            operadores,
            peones,
            clienteId,
            obraNombre,
            notas,
            // Para el movimiento de diésel en kardex
            almacenId,
            registrarDieselEnKardex,
            obraId,
        } = await req.json();

        // ── Validaciones ──
        if (!equipoId || !fecha || horometroInicio == null || horometroFin == null)
            return Response.json(
                { error: 'equipoId, fecha, horometroInicio y horometroFin son requeridos' },
                { status: 400 }
            );

        if (Number(horometroFin) < Number(horometroInicio))
            return Response.json(
                { error: 'El horómetro final no puede ser menor al inicial' },
                { status: 400 }
            );

        // Verificar que el equipo pertenece a la empresa
        const equipo = await prisma.equipo.findFirst({
            where: { id: equipoId, empresaId: user.empresaId },
        });
        if (!equipo)
            return Response.json({ error: 'Equipo no encontrado' }, { status: 404 });

        const fechaDate      = new Date(fecha);
        const horasNum       = Number(horometroFin) - Number(horometroInicio);
        const litrosDieselNum = Number(litrosDiesel ?? 0);
        const precioDieselNum = Number(precioDiesel ?? 0);

        // Calcular semana ISO y año
        const semanaNum = getISOWeek(fechaDate);
        const anoNum    = fechaDate.getFullYear();

        const result = await prisma.$transaction(async (tx) => {
            // 1. Crear el registro diario
            const registro = await tx.registroDiario.create({
                data: {
                    empresaId:         user.empresaId,
                    equipoId,
                    fecha:             fechaDate,
                    horometroInicio:   Number(horometroInicio),
                    horometroFin:      Number(horometroFin),
                    horasTrabajadas:   horasNum,
                    barrenos:          Number(barrenos   ?? 0),
                    metrosLineales:    Number(metrosLineales ?? 0),
                    litrosDiesel:      litrosDieselNum,
                    precioDiesel:      precioDieselNum,
                    tanqueInicio:      tanqueInicio      != null ? Number(tanqueInicio)      : null,
                    litrosTanqueInicio: litrosTanqueInicio != null ? Number(litrosTanqueInicio) : null,
                    tanqueFin:         tanqueFin         != null ? Number(tanqueFin)         : null,
                    litrosTanqueFin:   litrosTanqueFin   != null ? Number(litrosTanqueFin)   : null,
                    operadores:        Number(operadores ?? 1),
                    peones:            Number(peones     ?? 0),
                    clienteId:         clienteId || null,
                    obraNombre:        obraNombre || null,
                    semanaNum,
                    anoNum,
                    obraId:            obraId || null,
                    notas:             notas || null,
                    usuarioId:         user.id,
                },
                include: {
                    equipo:  { select: { nombre: true, numeroEconomico: true } },
                    usuario: { select: { nombre: true } },
                    cliente: { select: { nombre: true } },
                },
            });

            // 2. Actualizar el horómetro actual del equipo al valor final del registro
            await tx.equipo.update({
                where: { id: equipoId, empresaId: user.empresaId },
                data:  { hodometroInicial: Number(horometroFin) },
            });

            // 3. Si hay consumo de diésel y se pidió registrarlo en kardex,
            //    crear un movimiento de SALIDA automáticamente
            if (registrarDieselEnKardex && litrosDieselNum > 0 && almacenId) {
                // Buscar el producto Diésel de esta empresa
                const productoDiesel = await tx.producto.findFirst({
                    where: { empresaId: user.empresaId, sku: 'COMB-DSL-001' },
                });

                if (productoDiesel) {
                    // Verificar stock suficiente
                    const stockActual = Number(productoDiesel.stockActual);
                    if (stockActual >= litrosDieselNum) {
                        await tx.movimientoInventario.create({
                            data: {
                                empresaId:        user.empresaId,
                                productoId:       productoDiesel.id,
                                almacenId,
                                tipoMovimiento:   'SALIDA',
                                cantidad:         litrosDieselNum,
                                costoUnitario:    precioDieselNum,
                                moneda:           'MXN',
                                registroDiarioId: registro.id,
                                referencia:       `Consumo diésel ${fechaDate.toISOString().slice(0, 10)} — ${equipo.nombre}`,
                                notas:            `Horómetro: ${horometroInicio} → ${horometroFin} hrs`,
                                fecha:            fechaDate,
                                usuarioId:        user.id,
                            },
                        });

                        // Actualizar stockActual del diésel
                        await tx.producto.update({
                            where: { id: productoDiesel.id, empresaId: user.empresaId },
                            data:  { stockActual: { decrement: litrosDieselNum } },
                        });
                    }
                    // Si no hay stock suficiente, el registro diario se guarda igual
                    // pero no se descuenta del kardex (el operador deberá hacer una entrada primero)
                }
            }

            return registro;
        });

        return Response.json(serializeRegistro(result), { status: 201 });
    } catch (error: unknown) {
        if ((error as { code?: string }).code === 'P2002')
            return Response.json(
                { error: 'Ya existe un registro para este equipo en esa fecha' },
                { status: 400 }
            );
        console.error(error);
        return Response.json({ error: 'Error al crear el registro diario' }, { status: 500 });
    }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

// Serializa Decimal → number y calcula KPIs al vuelo
function serializeRegistro(r: any) {
    const horas   = Number(r.horasTrabajadas);
    const metros  = Number(r.metrosLineales);
    const litros  = Number(r.litrosDiesel);
    const barrenos = Number(r.barrenos);

    return {
        ...r,
        horometroInicio:    Number(r.horometroInicio),
        horometroFin:       Number(r.horometroFin),
        horasTrabajadas:    horas,
        barrenos,
        metrosLineales:     metros,
        litrosDiesel:       litros,
        precioDiesel:       Number(r.precioDiesel),
        costoDiesel:        litros * Number(r.precioDiesel),
        tanqueInicio:       r.tanqueInicio       != null ? Number(r.tanqueInicio)       : null,
        litrosTanqueInicio: r.litrosTanqueInicio != null ? Number(r.litrosTanqueInicio) : null,
        tanqueFin:          r.tanqueFin          != null ? Number(r.tanqueFin)          : null,
        litrosTanqueFin:    r.litrosTanqueFin    != null ? Number(r.litrosTanqueFin)    : null,
        // KPIs (equivalentes a las columnas LT/HR, LT/MT, MT/HR del Excel)
        kpi: {
            litrosPorHora:   horas   > 0 ? +(litros / horas).toFixed(2)   : null,
            litrosPorMetro:  metros  > 0 ? +(litros / metros).toFixed(2)  : null,
            metrosPorHora:   horas   > 0 ? +(metros / horas).toFixed(2)   : null,
        },
    };
}

// Calcula el número de semana ISO 8601
function getISOWeek(date: Date): number {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
}
