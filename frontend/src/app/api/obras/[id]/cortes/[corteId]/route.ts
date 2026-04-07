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
            include: { obra: { select: { nombre: true, clienteNombre: true, empresaId: true } } },
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
// Actualiza el corte. Recibe perdidaM3 (m³ absolutos, igual que el Excel).
// Recalcula: volumenNeto = volumenBruto − perdidaM3
//            porcentajePerdida = (perdidaM3 / volumenBruto) × 100  (solo referencia)
//            montoFacturado = volumenNeto × precioUnitario
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
                        empresaId: true,
                        bordo: true,
                        espesor: true,
                        precioUnitario: true,
                    },
                },
            },
        });
        if (!corteExistente || corteExistente.obra.empresaId !== user.empresaId)
            return Response.json({ error: 'Corte no encontrado' }, { status: 404 });

        const {
            fechaInicio, fechaFin, barrenos, metrosLineales,
            bordo, espesor, perdidaM3,
            precioUnitario, moneda, tipoCambio,
            status, notas,
        } = await req.json();

        // Valores finales — usa los nuevos si se enviaron, o los existentes
        const bordoNum   = bordo   != null ? Number(bordo)
                         : (corteExistente.bordo   ? Number(corteExistente.bordo)   : null);
        const espesorNum = espesor != null ? Number(espesor)
                         : (corteExistente.espesor ? Number(corteExistente.espesor) : null);
        const metrosNum  = metrosLineales != null ? Number(metrosLineales)
                         : Number(corteExistente.metrosLineales);
        const perdidaNum = perdidaM3 != null ? Number(perdidaM3)
                         : Number(corteExistente.perdidaM3 ?? 0);
        const puNum      = precioUnitario != null ? Number(precioUnitario)
                         : (corteExistente.precioUnitario ? Number(corteExistente.precioUnitario) : null);

        // Recalcular volúmenes
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
                ...(fechaInicio !== undefined && { fechaInicio: new Date(fechaInicio) }),
                ...(fechaFin    !== undefined && { fechaFin:    new Date(fechaFin) }),
                ...(barrenos    !== undefined && { barrenos:    Number(barrenos) }),
                ...(status      !== undefined && { status }),
                ...(notas       !== undefined && { notas: notas || null }),
                ...(moneda      !== undefined && { moneda: moneda === 'USD' ? 'USD' : 'MXN' }),
                ...(tipoCambio  !== undefined && { tipoCambio: tipoCambio != null ? Number(tipoCambio) : null }),
                metrosLineales:    metrosNum,
                bordo:             bordoNum,
                espesor:           espesorNum,
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

        await prisma.corteFacturacion.delete({ where: { id: corteId } });
        return Response.json({ message: 'Corte eliminado correctamente' });
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
        bordo:             c.bordo             != null ? Number(c.bordo)             : null,
        espesor:           c.espesor           != null ? Number(c.espesor)           : null,
        volumenBruto:      c.volumenBruto      != null ? Number(c.volumenBruto)      : null,
        perdidaM3:         c.perdidaM3         != null ? Number(c.perdidaM3)         : null,
        porcentajePerdida: c.porcentajePerdida != null ? Number(c.porcentajePerdida) : null,
        volumenNeto:       c.volumenNeto       != null ? Number(c.volumenNeto)       : null,
        precioUnitario:    c.precioUnitario    != null ? Number(c.precioUnitario)    : null,
        tipoCambio:        c.tipoCambio        != null ? Number(c.tipoCambio)        : null,
        montoFacturado:    c.montoFacturado    != null ? Number(c.montoFacturado)    : null,
    };
}
