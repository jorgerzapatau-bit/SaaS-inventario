// src/app/api/obras/[id]/cortes/[corteId]/route.ts
import { NextRequest } from 'next/server';
import prisma from '../../../../lib/prisma';
import { getAuthUser, unauthorized } from '../../../../lib/auth';

type Params = { params: Promise<{ id: string; corteId: string }> };

// ─── GET /api/obras/[id]/cortes/[corteId] ─────────────────────────────────────
export async function GET(req: NextRequest, { params }: Params) {
    const user = getAuthUser(req);
    if (!user) return unauthorized();
    try {
        const { id: obraId, corteId } = await params;

        const corte = await prisma.corteFacturacion.findFirst({
            where: { id: corteId, obraId },
            include: {
                obra: { select: { nombre: true, clienteNombre: true, empresaId: true } },
                corteRegistros: {
                    include: {
                        registro: {
                            select: { id: true, fecha: true, barrenos: true, metrosLineales: true,
                                      equipo: { select: { nombre: true } } },
                        },
                    },
                },
            },
        });

        if (!corte || corte.obra.empresaId !== user.empresaId)
            return Response.json({ error: 'Corte no encontrado' }, { status: 404 });

        return Response.json(serializeCorte(corte));
    } catch (error) {
        console.error(error);
        return Response.json({ error: 'Error al obtener el corte' }, { status: 500 });
    }
}

// ─── PUT /api/obras/[id]/cortes/[corteId] ─────────────────────────────────────
// Actualiza dimensiones, pérdida, precio, status, notas.
// NO reasigna registros — para cambiar registros hay que eliminar y recrear el corte.
//
// Lógica de perdidaM3:
//   Si profundidadCollar tiene valor → perdidaM3 = barrenos × collar × bordo × espesor
//   Si no → usa perdidaM3 del body
export async function PUT(req: NextRequest, { params }: Params) {
    const user = getAuthUser(req);
    if (!user) return unauthorized();
    try {
        const { id: obraId, corteId } = await params;

        const corteExistente = await prisma.corteFacturacion.findFirst({
            where: { id: corteId, obraId },
            include: {
                obra: {
                    select: {
                        empresaId:         true,
                        bordo:             true,
                        espesor:           true,
                        profundidadCollar: true,
                        precioUnitario:    true,
                    },
                },
            },
        });
        if (!corteExistente || corteExistente.obra.empresaId !== user.empresaId)
            return Response.json({ error: 'Corte no encontrado' }, { status: 404 });

        const {
            bordo, espesor, profundidadCollar,
            perdidaM3,
            precioUnitario, moneda, tipoCambio,
            status, notas,
        } = await req.json();

        // ── Resolver valores (body → corte → obra) ────────────────────────────
        const bordoNum   = bordo   != null ? Number(bordo)
                         : (corteExistente.bordo    ? Number(corteExistente.bordo)
                         : (corteExistente.obra.bordo ? Number(corteExistente.obra.bordo) : null));

        const espesorNum = espesor != null ? Number(espesor)
                         : (corteExistente.espesor  ? Number(corteExistente.espesor)
                         : (corteExistente.obra.espesor ? Number(corteExistente.obra.espesor) : null));

        const collarNum  = profundidadCollar !== undefined
            ? (profundidadCollar != null ? Number(profundidadCollar) : null)
            : (corteExistente.profundidadCollar
                ? Number(corteExistente.profundidadCollar)
                : (corteExistente.obra.profundidadCollar
                    ? Number(corteExistente.obra.profundidadCollar) : null));

        // Barrenos y metros vienen del corte (ya están fijados por los registros)
        const barrenosNum = Number(corteExistente.barrenos);
        const metrosNum   = Number(corteExistente.metrosLineales);

        const puNum      = precioUnitario != null ? Number(precioUnitario)
                         : (corteExistente.precioUnitario ? Number(corteExistente.precioUnitario) : null);

        // ── Pérdida ───────────────────────────────────────────────────────────
        const perdidaNum = (collarNum && bordoNum && espesorNum)
            ? +(barrenosNum * collarNum * bordoNum * espesorNum).toFixed(4)
            : (perdidaM3 != null ? Number(perdidaM3)
                : Number(corteExistente.perdidaM3 ?? 0));

        // ── Volúmenes ─────────────────────────────────────────────────────────
        const volumenBruto = bordoNum && espesorNum
            ? +(bordoNum * espesorNum * metrosNum).toFixed(4)
            : null;

        const volumenNeto = volumenBruto != null
            ? +(volumenBruto - perdidaNum).toFixed(4)
            : null;

        const porcentajePerdida = volumenBruto != null && volumenBruto > 0
            ? +((perdidaNum / volumenBruto) * 100).toFixed(6)
            : 0;

        const montoFacturado = volumenNeto != null && puNum != null
            ? +(volumenNeto * puNum).toFixed(2)
            : null;

        const corte = await prisma.corteFacturacion.update({
            where: { id: corteId },
            data: {
                ...(status     !== undefined && { status }),
                ...(notas      !== undefined && { notas: notas || null }),
                ...(moneda     !== undefined && { moneda: moneda === 'USD' ? 'USD' : 'MXN' }),
                ...(tipoCambio !== undefined && { tipoCambio: tipoCambio != null ? Number(tipoCambio) : null }),
                bordo:             bordoNum,
                espesor:           espesorNum,
                profundidadCollar: collarNum,
                perdidaM3:         perdidaNum,
                porcentajePerdida,
                volumenBruto,
                volumenNeto,
                precioUnitario:    puNum,
                montoFacturado,
            },
        });

        return Response.json(serializeCorte(corte));
    } catch (error) {
        console.error(error);
        return Response.json({ error: 'Error al actualizar el corte' }, { status: 500 });
    }
}

// ─── PATCH /api/obras/[id]/cortes/[corteId] ───────────────────────────────────
// Solo cambia status: BORRADOR → FACTURADO → COBRADO
export async function PATCH(req: NextRequest, { params }: Params) {
    const user = getAuthUser(req);
    if (!user) return unauthorized();
    try {
        const { corteId } = await params;
        const { status } = await req.json();

        if (!['BORRADOR', 'FACTURADO', 'COBRADO'].includes(status))
            return Response.json({ error: 'Status inválido' }, { status: 400 });

        const corte = await prisma.corteFacturacion.update({
            where: { id: corteId },
            data: { status },
        });

        return Response.json(serializeCorte(corte));
    } catch (error) {
        console.error(error);
        return Response.json({ error: 'Error al cambiar status del corte' }, { status: 500 });
    }
}

// ─── DELETE /api/obras/[id]/cortes/[corteId] ──────────────────────────────────
// Elimina el corte y libera automáticamente los registros vinculados
// (el ON DELETE CASCADE en CorteRegistro borra los vínculos).
// Solo se puede eliminar un corte en BORRADOR.
export async function DELETE(req: NextRequest, { params }: Params) {
    const user = getAuthUser(req);
    if (!user) return unauthorized();
    try {
        const { corteId } = await params;

        const corte = await prisma.corteFacturacion.findFirst({
            where: { id: corteId },
            include: { obra: { select: { empresaId: true } } },
        });

        if (!corte || corte.obra.empresaId !== user.empresaId)
            return Response.json({ error: 'Corte no encontrado' }, { status: 404 });

        if (corte.status === 'COBRADO')
            return Response.json(
                { error: 'No se puede eliminar un corte ya cobrado' },
                { status: 400 }
            );

        if (corte.status === 'FACTURADO')
            return Response.json(
                { error: 'Cambia el status a Borrador antes de eliminar el corte facturado' },
                { status: 400 }
            );

        // El CASCADE en CorteRegistro libera los registros automáticamente
        await prisma.corteFacturacion.delete({ where: { id: corteId } });

        return Response.json({ message: 'Corte eliminado. Los registros diarios quedaron disponibles.' });
    } catch (error) {
        console.error(error);
        return Response.json({ error: 'Error al eliminar el corte' }, { status: 500 });
    }
}

// ─── Helper ───────────────────────────────────────────────────────────────────
function serializeCorte(c: any) {
    return {
        ...c,
        metrosLineales:    Number(c.metrosLineales),
        bordo:             c.bordo              != null ? Number(c.bordo)              : null,
        espesor:           c.espesor            != null ? Number(c.espesor)            : null,
        profundidadCollar: c.profundidadCollar  != null ? Number(c.profundidadCollar)  : null,
        volumenBruto:      c.volumenBruto       != null ? Number(c.volumenBruto)       : null,
        perdidaM3:         c.perdidaM3          != null ? Number(c.perdidaM3)          : null,
        porcentajePerdida: c.porcentajePerdida  != null ? Number(c.porcentajePerdida)  : null,
        volumenNeto:       c.volumenNeto        != null ? Number(c.volumenNeto)        : null,
        precioUnitario:    c.precioUnitario     != null ? Number(c.precioUnitario)     : null,
        tipoCambio:        c.tipoCambio         != null ? Number(c.tipoCambio)         : null,
        montoFacturado:    c.montoFacturado     != null ? Number(c.montoFacturado)     : null,
        registros: c.corteRegistros?.map((cr: any) => ({
            id:             cr.registro.id,
            fecha:          cr.registro.fecha?.toISOString?.()?.slice(0, 10) ?? cr.registro.fecha,
            barrenos:       Number(cr.registro.barrenos),
            metrosLineales: Number(cr.registro.metrosLineales),
            equipo:         cr.registro.equipo?.nombre ?? null,
        })) ?? [],
    };
}
