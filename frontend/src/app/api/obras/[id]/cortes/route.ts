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

// ─── POST /api/obras/[id]/cortes ──────────────────────────────────────────────
// Crea un nuevo corte. Recibe perdidaM3 (m³ absolutos, igual que el Excel).
// Fórmulas:
//   volumenBruto = bordo × espesor × metrosLineales
//   volumenNeto  = volumenBruto − perdidaM3
//   porcentajePerdida = (perdidaM3 / volumenBruto) × 100  ← calculado, no ingresado
//   montoFacturado = volumenNeto × precioUnitario
export async function POST(req: NextRequest, { params }: Params) {
    const user = getAuthUser(req);
    if (!user) return unauthorized();
    try {
        const { id: obraId } = await params;

        const obra = await prisma.obra.findFirst({
            where: { id: obraId, empresaId: user.empresaId },
        });
        if (!obra) return Response.json({ error: 'Obra no encontrada' }, { status: 404 });

        const {
            fechaInicio, fechaFin,
            barrenos, metrosLineales,
            bordo, espesor,
            perdidaM3,
            precioUnitario, moneda, tipoCambio,
            notas, status,
        } = await req.json();

        if (!fechaInicio || !fechaFin)
            return Response.json({ error: 'fechaInicio y fechaFin son requeridos' }, { status: 400 });

        // Número de corte siguiente
        const ultimo = await prisma.corteFacturacion.findFirst({
            where: { obraId },
            orderBy: { numero: 'desc' },
            select: { numero: true },
        });
        const numero = (ultimo?.numero ?? 0) + 1;

        // Valores numéricos — usa los de la obra como fallback
        const bordoNum   = bordo  != null ? Number(bordo)  : (obra.bordo   ? Number(obra.bordo)   : null);
        const espesorNum = espesor != null ? Number(espesor): (obra.espesor ? Number(obra.espesor) : null);
        const metrosNum  = metrosLineales != null ? Number(metrosLineales) : 0;
        const perdidaNum = perdidaM3 != null ? Number(perdidaM3) : 0;
        const puNum      = precioUnitario != null ? Number(precioUnitario)
                         : (obra.precioUnitario ? Number(obra.precioUnitario) : null);

        // Cálculos (replica hoja Plantilla del Excel)
        const volumenBruto = bordoNum && espesorNum
            ? +(bordoNum * espesorNum * metrosNum).toFixed(4)
            : null;

        // volumenNeto = volumenBruto − perdidaM3  (resta directa, igual que el Excel)
        const volumenNeto = volumenBruto != null
            ? +(volumenBruto - perdidaNum).toFixed(4)
            : null;

        // porcentajePerdida = calculado automáticamente para referencia
        const porcentajePerdida = volumenBruto != null && volumenBruto > 0
            ? +((perdidaNum / volumenBruto) * 100).toFixed(6)
            : 0;

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
                perdidaM3:         perdidaNum,
                porcentajePerdida,
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
        perdidaM3:         c.perdidaM3         != null ? Number(c.perdidaM3)         : null,
        porcentajePerdida: c.porcentajePerdida != null ? Number(c.porcentajePerdida) : null,
        volumenNeto:       c.volumenNeto       != null ? Number(c.volumenNeto)       : null,
        precioUnitario:    c.precioUnitario    != null ? Number(c.precioUnitario)    : null,
        tipoCambio:        c.tipoCambio        != null ? Number(c.tipoCambio)        : null,
        montoFacturado:    c.montoFacturado    != null ? Number(c.montoFacturado)    : null,
    };
}
