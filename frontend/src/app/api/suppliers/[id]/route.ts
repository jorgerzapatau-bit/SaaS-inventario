import { NextRequest } from 'next/server';
import prisma from '@/lib/prisma';
import { getAuthUser, unauthorized } from '@/lib/auth';

type Params = { params: Promise<{ id: string }> };

function validateRFC(rfc: string): boolean {
    return /^([A-ZÑ&]{3,4})\d{6}([A-Z\d]{3})$/i.test(rfc.trim().toUpperCase());
}

export async function PUT(req: NextRequest, { params }: Params) {
    const user = getAuthUser(req);
    if (!user) return unauthorized();
    try {
        const { id } = await params;
        const { nombre, contacto, telefono, email, direccion, rfc, razonSocial, codigoPostal, regimenFiscal, usoCFDI } = await req.json();
        if (rfc && !validateRFC(rfc)) return Response.json({ error: 'Formato de RFC inválido' }, { status: 400 });
        const exists = await prisma.proveedor.findFirst({ where: { id } });
        if (!exists) return Response.json({ error: 'Proveedor no encontrado' }, { status: 404 });
        const updated = await prisma.proveedor.update({ where: { id }, data: { nombre, contacto, telefono, email, direccion, rfc: rfc?.toUpperCase() || null, razonSocial, codigoPostal, regimenFiscal, usoCFDI } });
        return Response.json(updated);
    } catch { return Response.json({ error: 'Error updating supplier' }, { status: 500 }); }
}

export async function DELETE(req: NextRequest, { params }: Params) {
    const user = getAuthUser(req);
    if (!user) return unauthorized();
    try {
        const { id } = await params;
        const exists = await prisma.proveedor.findFirst({ where: { id } });
        if (!exists) return Response.json({ error: 'Proveedor no encontrado' }, { status: 404 });
        const movCount = await prisma.movimientoInventario.count({ where: { proveedorId: id } });
        if (movCount > 0) return Response.json({ error: `No se puede eliminar: tiene ${movCount} movimiento(s) asociado(s).` }, { status: 409 });
        await prisma.proveedor.delete({ where: { id } });
        return Response.json({ ok: true });
    } catch { return Response.json({ error: 'Error deleting supplier' }, { status: 500 }); }
}

