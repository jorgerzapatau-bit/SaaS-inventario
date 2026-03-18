import { NextRequest } from 'next/server';
import prisma from '../../lib/prisma';
import { getAuthUser, unauthorized } from '../../lib/auth';

type Params = { params: Promise<{ id: string }> };

export async function PUT(req: NextRequest, { params }: Params) {
    const user = getAuthUser(req);
    if (!user) return unauthorized();
    try {
        const { id } = await params;
        const { nombre } = await req.json();
        const almacen = await prisma.almacen.update({ where: { id, empresaId: user.empresaId }, data: { nombre: nombre.trim() } });
        return Response.json(almacen);
    } catch { return Response.json({ error: 'Error al actualizar almacén' }, { status: 500 }); }
}

export async function DELETE(req: NextRequest, { params }: Params) {
    const user = getAuthUser(req);
    if (!user) return unauthorized();
    try {
        const { id } = await params;
        await prisma.almacen.delete({ where: { id, empresaId: user.empresaId } });
        return Response.json({ message: 'Almacén eliminado' });
    } catch (error: unknown) {
        if ((error as { code?: string }).code === 'P2003') return Response.json({ error: 'No se puede eliminar: tiene movimientos asociados.' }, { status: 400 });
        return Response.json({ error: 'Error al eliminar almacén' }, { status: 500 });
    }
}
