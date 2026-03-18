import { NextRequest } from 'next/server';
import prisma from '../lib/prisma';
import { getAuthUser, unauthorized } from '../lib/auth';

function validateRFC(rfc: string): boolean {
    return /^([A-ZÑ&]{3,4})\d{6}([A-Z\d]{3})$/i.test(rfc.trim().toUpperCase());
}

export async function GET(req: NextRequest) {
    const user = getAuthUser(req);
    if (!user) return unauthorized();
    try {
        const empresaId = user.empresaId;
        const proveedores = await prisma.proveedor.findMany({ where: { empresaId }, orderBy: { nombre: 'asc' } });
        const statsRaw = await prisma.movimientoInventario.groupBy({
            by: ['proveedorId'],
            where: { empresaId, proveedorId: { not: null }, tipoMovimiento: { in: ['ENTRADA', 'AJUSTE_POSITIVO'] } },
            _count: { id: true }, _max: { fecha: true },
        });
        const montos = await prisma.movimientoInventario.findMany({
            where: { empresaId, proveedorId: { not: null }, tipoMovimiento: { in: ['ENTRADA', 'AJUSTE_POSITIVO'] } },
            select: { proveedorId: true, cantidad: true, costoUnitario: true },
        });
        const montosPorProveedor: Record<string, number> = {};
        for (const m of montos) {
            const pid = m.proveedorId!;
            montosPorProveedor[pid] = (montosPorProveedor[pid] || 0) + Number(m.cantidad) * Number(m.costoUnitario);
        }
        const statsMap: Record<string, { totalCompras: number; ultimaCompra: Date | null; montoTotal: number }> = {};
        for (const s of statsRaw) {
            const pid = s.proveedorId!;
            statsMap[pid] = { totalCompras: s._count.id, ultimaCompra: s._max.fecha, montoTotal: montosPorProveedor[pid] || 0 };
        }
        return Response.json(proveedores.map(p => ({ ...p, totalCompras: statsMap[p.id]?.totalCompras || 0, ultimaCompra: statsMap[p.id]?.ultimaCompra || null, montoTotal: statsMap[p.id]?.montoTotal || 0 })));
    } catch (error) { console.error(error); return Response.json({ error: 'Error fetching suppliers' }, { status: 500 }); }
}

export async function POST(req: NextRequest) {
    const user = getAuthUser(req);
    if (!user) return unauthorized();
    try {
        const { nombre, contacto, telefono, email, direccion, rfc, razonSocial, codigoPostal, regimenFiscal, usoCFDI } = await req.json();
        if (!nombre) return Response.json({ error: 'El nombre es obligatorio' }, { status: 400 });
        if (rfc && !validateRFC(rfc)) return Response.json({ error: 'Formato de RFC inválido' }, { status: 400 });
        const proveedor = await prisma.proveedor.create({
            data: { empresaId: user.empresaId, nombre, contacto, telefono, email, direccion, rfc: rfc?.toUpperCase() || null, razonSocial, codigoPostal, regimenFiscal, usoCFDI },
        });
        return Response.json({ ...proveedor, totalCompras: 0, ultimaCompra: null, montoTotal: 0 }, { status: 201 });
    } catch { return Response.json({ error: 'Error creating supplier' }, { status: 500 }); }
}
