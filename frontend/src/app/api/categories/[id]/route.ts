import { NextRequest } from 'next/server';
import prisma from '@/lib/prisma';
import { getAuthUser, unauthorized } from '@/lib/auth';

type Params = { params: Promise<{ id: string }> };

export async function PUT(req: NextRequest, { params }: Params) {
    const user = getAuthUser(req);
    if (!user) return unauthorized();
    try {
        const { id } = await params;
        const { nombre, descripcion } = await req.json();
        const categoria = await prisma.categoria.update({
            where: { id },
            data: { nombre: nombre.trim(), descripcion: descripcion !== undefined ? (descripcion?.trim() || null) : undefined }
        });
        return Response.json(categoria);
    } catch { return Response.json({ error: 'Error al actualizar categoría' }, { status: 500 }); }
}

export async function DELETE(req: NextRequest, { params }: Params) {
    const user = getAuthUser(req);
    if (!user) return unauthorized();
    try {
        const { id } = await params;
        await prisma.categoria.delete({ where: { id } });
        return Response.json({ message: 'Categoría eliminada' });
    } catch (error: unknown) {
        if ((error as { code?: string }).code === 'P2003') return Response.json({ error: 'No se puede eliminar: tiene productos asociados.' }, { status: 400 });
        return Response.json({ error: 'Error al eliminar categoría' }, { status: 500 });
    }
}

