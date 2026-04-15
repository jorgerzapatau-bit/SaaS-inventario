import { NextRequest } from 'next/server';
import prisma from '../../lib/prisma';
import { getAuthUser, unauthorized } from '../../lib/auth';

type Params = { params: Promise<{ id: string }> };

// ─── GET /api/products/[id] ───────────────────────────────────────────────────
export async function GET(req: NextRequest, { params }: Params) {
    const user = getAuthUser(req);
    if (!user) return unauthorized();
    try {
        const { id } = await params;
        const product = await prisma.producto.findFirst({
            where: { id },
            include: { categoria: true },
        });
        if (!product) return Response.json({ error: 'Producto no encontrado' }, { status: 404 });

        return Response.json({
            ...product,
            precioCompra: Number(product.precioCompra),
            stockActual:  Number(product.stockActual),
            stockMinimo:  Number(product.stockMinimo),
        });
    } catch {
        return Response.json({ error: 'Error fetching product' }, { status: 500 });
    }
}

// ─── PUT /api/products/[id] ───────────────────────────────────────────────────
// Permite editar datos del producto. stockActual NO se edita aquí —
// se actualiza automáticamente vía movimientos de inventario.
export async function PUT(req: NextRequest, { params }: Params) {
    const user = getAuthUser(req);
    if (!user) return unauthorized();
    try {
        const { id } = await params;
        const {
            nombre, categoriaId, unidad,
            precioCompra, moneda,
            stockMinimo, imagen, activo, notas,
        } = await req.json();

        const monedaVal = moneda === 'USD' ? 'USD' : moneda === 'MXN' ? 'MXN' : undefined;

        const product = await prisma.producto.update({
            where: { id },
            data: {
                ...(nombre       !== undefined && { nombre }),
                ...(categoriaId  !== undefined && { categoriaId }),
                ...(unidad       !== undefined && { unidad }),
                ...(precioCompra !== undefined && { precioCompra: Number(precioCompra) }),
                ...(monedaVal    !== undefined && { moneda: monedaVal }),
                ...(stockMinimo  !== undefined && { stockMinimo: Number(stockMinimo) }),
                ...(imagen       !== undefined && { imagen }),
                ...(activo       !== undefined && { activo }),
                ...(notas        !== undefined && { notas }),
                // stockActual nunca se edita directamente aquí
            },
            include: { categoria: true },
        });

        return Response.json({
            ...product,
            precioCompra: Number(product.precioCompra),
            stockActual:  Number(product.stockActual),
            stockMinimo:  Number(product.stockMinimo),
        });
    } catch (error: unknown) {
        if ((error as { code?: string }).code === 'P2002')
            return Response.json({ error: 'El SKU ya existe para esta empresa' }, { status: 400 });
        return Response.json({ error: 'Error al actualizar el producto' }, { status: 500 });
    }
}

// ─── DELETE /api/products/[id] ────────────────────────────────────────────────
export async function DELETE(req: NextRequest, { params }: Params) {
    const user = getAuthUser(req);
    if (!user) return unauthorized();
    try {
        const { id } = await params;

        // Verificar que no tenga movimientos antes de borrar
        const movimientos = await prisma.movimientoInventario.count({
            where: { productoId: id, empresaId: user.empresaId },
        });
        if (movimientos > 0) {
            return Response.json(
                { error: 'No se puede eliminar: el producto tiene movimientos de inventario asociados.' },
                { status: 400 }
            );
        }

        await prisma.producto.delete({ where: { id } });
        return Response.json({ message: 'Producto eliminado correctamente' });
    } catch (error: unknown) {
        if ((error as { code?: string }).code === 'P2003')
            return Response.json({ error: 'No se puede eliminar: tiene registros asociados.' }, { status: 400 });
        return Response.json({ error: 'Error al eliminar el producto' }, { status: 500 });
    }
}
