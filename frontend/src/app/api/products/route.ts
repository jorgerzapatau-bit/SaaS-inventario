import { NextRequest } from 'next/server';
import prisma from '@/lib/prisma';
import { getAuthUser, unauthorized } from '@/lib/auth';

// ─── GET /api/products ────────────────────────────────────────────────────────
// Devuelve productos con stockActual ya almacenado en la tabla.
// También incluye moneda y precioCompra para mostrar en listados.
export async function GET(req: NextRequest) {
    const user = getAuthUser(req);
    if (!user) return unauthorized();
    try {
        const empresaId = user.empresaId;
        const { searchParams } = new URL(req.url);
        const q     = searchParams.get('q')?.trim() ?? '';
        const limit = parseInt(searchParams.get('limit') ?? '200', 10);

        const products = await prisma.producto.findMany({
            where: {
                empresaId,
                activo: true,
                ...(q ? {
                    OR: [
                        { nombre: { contains: q, mode: 'insensitive' } },
                        { sku:    { contains: q, mode: 'insensitive' } },
                    ],
                } : {}),
            },
            include: { categoria: true },
            orderBy: { nombre: 'asc' },
            take: limit,
        });

        // stockActual ya está almacenado en el campo — no necesitamos calcular con SUM.
        // Devolvemos el campo directo, más los últimos precios del kardex para referencia.
        const lastEntradas = await prisma.movimientoInventario.findMany({
            where: { empresaId, tipoMovimiento: { in: ['ENTRADA', 'AJUSTE_POSITIVO'] } },
            orderBy: { fecha: 'desc' },
            select: { productoId: true, costoUnitario: true, moneda: true, tipoCambio: true, fecha: true },
        });

        const lastCostoMap: Record<string, { costo: number; moneda: string; tipoCambio: number | null }> = {};
        for (const m of lastEntradas) {
            if (!(m.productoId in lastCostoMap)) {
                lastCostoMap[m.productoId] = {
                    costo:      Number(m.costoUnitario),
                    moneda:     m.moneda,
                    tipoCambio: m.tipoCambio ? Number(m.tipoCambio) : null,
                };
            }
        }

        const productsWithStock = products.map(p => ({
            ...p,
            precioCompra:       Number(p.precioCompra),
            stockActual:        Number(p.stockActual),
            stock:              Number(p.stockActual),          // alias que usa la página
            stockMinimo:        Number(p.stockMinimo),
            tipoCambioRef:      p.tipoCambioRef ? Number(p.tipoCambioRef) : null,
            // moneda ya viene del modelo (MXN | USD)
            ultimaEntrada:      lastCostoMap[p.id] ?? (Number(p.precioCompra) > 0 ? { costo: Number(p.precioCompra), moneda: p.moneda, tipoCambio: p.tipoCambioRef ? Number(p.tipoCambioRef) : null } : null),
            // Si no hay entradas en kardex, usar el precioCompra guardado en el producto
            ultimoPrecioCompra: lastCostoMap[p.id]?.costo ?? (Number(p.precioCompra) > 0 ? Number(p.precioCompra) : null),
            // alerta de stock bajo
            stockBajo:          Number(p.stockActual) <= Number(p.stockMinimo),
        }));

        return Response.json(productsWithStock);
    } catch (error) {
        console.error('getProducts ERROR:', error);
        return Response.json({ error: 'Error fetching products', detail: String(error) }, { status: 500 });
    }
}

// ─── POST /api/products ───────────────────────────────────────────────────────
// Crea un producto nuevo. Acepta moneda (MXN | USD) y precioCompra.
export async function POST(req: NextRequest) {
    const user = getAuthUser(req);
    if (!user) return unauthorized();
    try {
        const {
            nombre, sku, categoriaId, unidad,
            precioCompra, moneda,
            stockMinimo, imagen, activo,
        } = await req.json();

        if (!nombre || !sku || !categoriaId) {
            return Response.json({ error: 'nombre, sku y categoriaId son requeridos' }, { status: 400 });
        }

        // Validar moneda
        const monedaVal = moneda === 'USD' ? 'USD' : 'MXN';

        const product = await prisma.producto.create({
            data: {
                empresaId:   user.empresaId,
                nombre,
                sku,
                categoriaId,
                unidad:      unidad      || 'pza',
                precioCompra: precioCompra != null ? Number(precioCompra) : 0,
                moneda:      monedaVal,
                stockActual: 0,           // siempre inicia en 0
                stockMinimo: stockMinimo  != null ? Number(stockMinimo) : 0,
                imagen:      imagen       || null,
                activo:      activo       ?? true,
            },
            include: { categoria: true },
        });

        return Response.json({ ...product, precioCompra: Number(product.precioCompra), stockActual: Number(product.stockActual) }, { status: 201 });
    } catch (error: unknown) {
        if ((error as { code?: string }).code === 'P2002')
            return Response.json({ error: 'El SKU ya existe para esta empresa' }, { status: 400 });
        console.error(error);
        return Response.json({ error: 'Error al crear el producto' }, { status: 500 });
    }
}

