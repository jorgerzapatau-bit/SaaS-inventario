import { NextRequest } from 'next/server';
import prisma from '../lib/prisma';
import { getAuthUser, unauthorized } from '../lib/auth';

export async function GET(req: NextRequest) {
    const user = getAuthUser(req);
    if (!user) return unauthorized();
    try {
        const empresaId = user.empresaId;
        const products = await prisma.producto.findMany({ where: { empresaId }, include: { categoria: true } });

        const stockAggregations = await prisma.movimientoInventario.groupBy({
            by: ['productoId', 'tipoMovimiento'],
            where: { empresaId },
            _sum: { cantidad: true }
        });
        const lastEntradas = await prisma.movimientoInventario.findMany({
            where: { empresaId, tipoMovimiento: { in: ['ENTRADA', 'AJUSTE_POSITIVO'] } },
            orderBy: { fecha: 'desc' },
            select: { productoId: true, costoUnitario: true, fecha: true }
        });
        const lastSalidas = await prisma.movimientoInventario.findMany({
            where: { empresaId, tipoMovimiento: { in: ['SALIDA', 'AJUSTE_NEGATIVO'] }, precioVenta: { not: null } },
            orderBy: { fecha: 'desc' },
            select: { productoId: true, precioVenta: true, fecha: true }
        });

        const lastCostoMap: Record<string, number> = {};
        for (const m of lastEntradas) {
            if (!(m.productoId in lastCostoMap)) lastCostoMap[m.productoId] = Number(m.costoUnitario);
        }
        const lastVentaMap: Record<string, number> = {};
        for (const m of lastSalidas) {
            if (!(m.productoId in lastVentaMap) && m.precioVenta) lastVentaMap[m.productoId] = Number(m.precioVenta);
        }

        const productsWithStock = products.map(product => {
            const aggs = stockAggregations.filter(a => a.productoId === product.id);
            const sumEntradas = aggs.filter(a => ['ENTRADA', 'AJUSTE_POSITIVO'].includes(a.tipoMovimiento)).reduce((acc, c) => acc + (c._sum.cantidad || 0), 0);
            const sumSalidas  = aggs.filter(a => ['SALIDA', 'AJUSTE_NEGATIVO'].includes(a.tipoMovimiento)).reduce((acc, c) => acc + (c._sum.cantidad || 0), 0);
            return { ...product, stock: sumEntradas - sumSalidas, ultimoPrecioCompra: lastCostoMap[product.id] ?? null, ultimoPrecioVenta: lastVentaMap[product.id] ?? null };
        });

        return Response.json(productsWithStock);
    } catch (error) {
        console.error('getProducts ERROR:', error);
        return Response.json({ error: 'Error fetching products', detail: String(error) }, { status: 500 });
    }
}

export async function POST(req: NextRequest) {
    const user = getAuthUser(req);
    if (!user) return unauthorized();
    try {
        const { nombre, sku, categoriaId, unidad, stockMinimo, imagen, activo } = await req.json();
        const product = await prisma.producto.create({
            data: { empresaId: user.empresaId, nombre, sku, categoriaId, unidad: unidad || 'pieza', stockMinimo: stockMinimo ?? 5, imagen: imagen || null, activo: activo ?? true }
        });
        return Response.json(product, { status: 201 });
    } catch (error: unknown) {
        if ((error as { code?: string }).code === 'P2002') return Response.json({ error: 'El SKU ya existe para esta empresa' }, { status: 400 });
        return Response.json({ error: 'Error al crear el producto' }, { status: 500 });
    }
}
