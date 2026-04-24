import { NextRequest } from 'next/server';
import prisma from '@/lib/prisma';
import { getAuthUser, unauthorized } from '@/lib/auth';

export async function GET(req: NextRequest, { params }: { params: Promise<{ productoId: string }> }) {
    const user = getAuthUser(req);
    if (!user) return unauthorized();
    try {
        const { productoId } = await params;
        const movements = await prisma.movimientoInventario.findMany({
            where: { empresaId: user.empresaId, productoId },
            orderBy: { fecha: 'asc' },
            include: { usuario: { select: { nombre: true } }, almacen: { select: { nombre: true } }, proveedor: { select: { nombre: true, telefono: true, email: true } } }
        });
        return Response.json(movements);
    } catch { return Response.json({ error: 'Error fetching Kardex' }, { status: 500 }); }
}

