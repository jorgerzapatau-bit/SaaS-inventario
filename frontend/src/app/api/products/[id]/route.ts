import { NextRequest } from 'next/server';
import prisma from '../../lib/prisma';
import { getAuthUser, unauthorized } from '../../lib/auth';

type Params = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, { params }: Params) {
    const user = getAuthUser(req);
    if (!user) return unauthorized();
    try {
        const { id } = await params;
        const product = await prisma.producto.findFirst({ where: { id, empresaId: user.empresaId }, include: { categoria: true } });
        if (!product) return Response.json({ error: 'Product not found' }, { status: 404 });
        return Response.json(product);
    } catch {
        return Response.json({ error: 'Error fetching product' }, { status: 500 });
    }
}

export async function PUT(req: NextRequest, { params }: Params) {
    const user = getAuthUser(req);
    if (!user) return unauthorized();
    try {
        const { id } = await params;
        const { nombre, categoriaId, unidad, stockMinimo, imagen, activo } = await req.json();
        const product = await prisma.producto.update({
            where: { id, empresaId: user.empresaId },
            data: {
                nombre,
                ...(categoriaId !== undefined && { categoriaId }),
                ...(unidad      !== undefined && { unidad }),
                ...(stockMinimo !== undefined && { stockMinimo: Number(stockMinimo) }),
                ...(imagen      !== undefined && { imagen }),
                ...(activo      !== undefined && { activo }),
            }
        });
        return Response.json(product);
    } catch (error: unknown) {
        if ((error as { code?: string }).code === 'P2002') return Response.json({ error: 'El SKU ya existe para esta empresa' }, { status: 400 });
        return Response.json({ error: 'Error al actualizar el producto' }, { status: 500 });
    }
}

export async function DELETE(req: NextRequest, { params }: Params) {
    const user = getAuthUser(req);
    if (!user) return unauthorized();
    try {
        const { id } = await params;
        await prisma.producto.delete({ where: { id, empresaId: user.empresaId } });
        return Response.json({ message: 'Producto eliminado correctamente' });
    } catch (error: unknown) {
        if ((error as { code?: string }).code === 'P2003') return Response.json({ error: 'No se puede eliminar: tiene movimientos asociados.' }, { status: 400 });
        return Response.json({ error: 'Error al eliminar el producto' }, { status: 500 });
    }
}
