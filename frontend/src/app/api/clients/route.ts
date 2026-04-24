import { NextRequest } from 'next/server';
import prisma from '@/lib/prisma';
import { getAuthUser, unauthorized } from '@/lib/auth';

function validateRFC(rfc: string): boolean {
    return /^([A-ZÑ&]{3,4})\d{6}([A-Z\d]{3})$/i.test(rfc.trim().toUpperCase());
}

export async function GET(req: NextRequest) {
    const user = getAuthUser(req);
    if (!user) return unauthorized();
    try {
        const empresaId = user.empresaId;
        const clientes = await prisma.cliente.findMany({ where: { empresaId }, orderBy: { nombre: 'asc' } });
        const statsRaw = await prisma.movimientoInventario.groupBy({
            by: ['clienteId'],
            where: { empresaId, clienteId: { not: null }, tipoMovimiento: { in: ['SALIDA', 'AJUSTE_NEGATIVO'] } },
            _count: { id: true }, _max: { fecha: true },
        });
        const ventas = await prisma.movimientoInventario.findMany({
            where: { empresaId, clienteId: { not: null }, tipoMovimiento: { in: ['SALIDA', 'AJUSTE_NEGATIVO'] } },
            select: { clienteId: true, cantidad: true, precioVenta: true },
        });
        const montosPorCliente: Record<string, number> = {};
        for (const m of ventas) {
            const cid = m.clienteId!;
            montosPorCliente[cid] = (montosPorCliente[cid] || 0) + Number(m.cantidad) * Number(m.precioVenta || 0);
        }
        const statsMap: Record<string, { totalVentas: number; ultimaVenta: Date | null; montoTotal: number }> = {};
        for (const s of statsRaw) {
            const cid = s.clienteId!;
            statsMap[cid] = { totalVentas: s._count.id, ultimaVenta: s._max.fecha, montoTotal: montosPorCliente[cid] || 0 };
        }
        return Response.json(clientes.map(c => ({ ...c, totalVentas: statsMap[c.id]?.totalVentas || 0, ultimaVenta: statsMap[c.id]?.ultimaVenta || null, montoTotal: statsMap[c.id]?.montoTotal || 0 })));
    } catch (error) { console.error(error); return Response.json({ error: 'Error fetching clients' }, { status: 500 }); }
}

export async function POST(req: NextRequest) {
    const user = getAuthUser(req);
    if (!user) return unauthorized();
    try {
        const { nombre, contacto, telefono, email, direccion, rfc, razonSocial, codigoPostal, regimenFiscal, usoCFDI } = await req.json();
        if (!nombre) return Response.json({ error: 'El nombre es obligatorio' }, { status: 400 });
        if (rfc && !validateRFC(rfc)) return Response.json({ error: 'Formato de RFC inválido' }, { status: 400 });
        const cliente = await prisma.cliente.create({
            data: { empresaId: user.empresaId, nombre, contacto, telefono, email, direccion, rfc: rfc?.toUpperCase() || null, razonSocial, codigoPostal, regimenFiscal, usoCFDI },
        });
        return Response.json({ ...cliente, totalVentas: 0, ultimaVenta: null, montoTotal: 0 }, { status: 201 });
    } catch { return Response.json({ error: 'Error creating client' }, { status: 500 }); }
}

