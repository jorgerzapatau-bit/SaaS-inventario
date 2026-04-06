import { NextRequest } from 'next/server';
import prisma from '../../../lib/prisma';
import { getAuthUser, unauthorized } from '../../../lib/auth';

type Params = { params: Promise<{ id: string }> };

// ─── GET /api/obras/[id]/cortes ───────────────────────────────────────────────
export async function GET(req: NextRequest, { params }: Params) {
    const user = getAuthUser(req);
    if (!user) return unauthorized();
    try {
        const { id: obraId } = await params;

        // Verificar que la obra pertenece a la empresa
        const obra = await prisma.obra.findFirst({
            where: { id: obraId, empresaId: user.empresaId },
        });
        if (!obra) return Response.json({ error: 'Obra no encontrada' }, { status: 404 });

        const cortes = await prisma.corteFacturacion.findMany({
            where: { obraId },
            orderBy: { numero: 'asc' },
        });

        return Response.json(cortes.map(serializeCorte));
    } catch (error) {
        console.error(error);
        return Response.json({ error: 'Error al obtener cortes' }, { status: 500 });
    }
}

// ─── POST /api/obras/[id]/cortes ─────────────────────────────────────────────
// Crea un nuevo corte de facturación. Calcula volúmenes automáticamente
// si se proporcionan bordo, espesor y metrosLineales (replica hoja Plantilla).
export async function POST(req: NextRequest, { params }: Params) {
    const user = getAuthUser(req);
    if (!user) return unauthorized();
    try {
        const { id: obraId } = await params;

        // Verificar que la obra pertenece a la empresa
        const obra = await prisma.obra.findFirst({
            where: { id: obraId, empresaId: user.empresaId },
        });
        if (!obra) return Response.json({ error: 'Obra no encontrada' }, { status: 404 });

        const {
            fechaInicio, fechaFin,
            barrenos, metrosLineales,
            bordo, espesor,
            porcentajePerdida,
            precioUnitario, moneda, tipoCambio,
            notas, status,
        } = await req.json();

        if (!fechaInicio || !fechaFin)
            return Response.json({ error: 'fechaInicio y fechaFin son requeridos' }, { status: 400 });

        // Calcular número de corte (siguiente disponible)
        const ultimo = await prisma.corteFacturacion.findFirst({
            where: { obraId },
            orderBy: { numero: 'desc' },
            select: { numero: true },
        });
        const numero = (ultimo?.numero ?? 0) + 1;

        // Calcular volúmenes (replica fórmulas de la hoja Plantilla)
        const bordoNum   = bordo    != null ? Number(bordo)    : (obra.bordo    ? Number(obra.bordo)    : null);
        const espesorNum = espesor  != null ? Number(espesor)  : (obra.espesor  ? Number(obra.espesor)  : null);
        const metrosNum  = metrosLineales != null ? Number(metrosLineales) : 0;
        const pctPerdida = porcentajePerdida != null ? Number(porcentajePerdida) : 0;
        const puNum      = precioUnitario != null ? Number(precioUnitario)
                         : (obra.precioUnitario ? Number(obra.precioUnitario) : null);

        // Vol. bruto = bordo × espesor × metros lineales
        const volumenBruto = bordoNum && espesorNum
            ? +(bordoNum * espesorNum * metrosNum).toFixed(4)
            : null;

        // Vol. neto = Vol. bruto × (1 - %pérdida / 100)
        const volumenNeto = volumenBruto != null
            ? +(volumenBruto * (1 - pctPerdida / 100)).toFixed(4)
            : null;

        // Monto = Vol. neto × P.U.
        const montoFacturado = volumenNeto != null && puNum != null
            ? +(volumenNeto * puNum).toFixed(2)
            : null;

        const corte = await prisma.corteFacturacion.create({
            data: {
                obraId,
                numero,
                fechaInicio:       new Date(fechaInicio),
                fechaFin:          new Date(fechaFin),
                barrenos:          Number(barrenos ?? 0),
                metrosLineales:    metrosNum,
                bordo:             bordoNum,
                espesor:           espesorNum,
                volumenBruto,
                porcentajePerdida: pctPerdida,
                volumenNeto,
                precioUnitario:    puNum,
                moneda:            moneda === 'USD' ? 'USD' : 'MXN',
                tipoCambio:        tipoCambio != null ? Number(tipoCambio) : null,
                montoFacturado,
                status:            status || 'BORRADOR',
                notas:             notas || null,
            },
        });

        return Response.json(serializeCorte(corte), { status: 201 });
    } catch (error) {
        console.error(error);
        return Response.json({ error: 'Error al crear el corte' }, { status: 500 });
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
        porcentajePerdida: c.porcentajePerdida != null ? Number(c.porcentajePerdida) : null,
        volumenNeto:       c.volumenNeto       != null ? Number(c.volumenNeto)       : null,
        precioUnitario:    c.precioUnitario    != null ? Number(c.precioUnitario)    : null,
        tipoCambio:        c.tipoCambio        != null ? Number(c.tipoCambio)        : null,
        montoFacturado:    c.montoFacturado    != null ? Number(c.montoFacturado)    : null,
    };
}
