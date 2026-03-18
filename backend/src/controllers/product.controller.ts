import { Response } from 'express';
import { AuthRequest } from '../middlewares/auth';
import prisma from '../utils/prisma';

export const getProducts = async (req: AuthRequest, res: Response) => {
    try {
        const empresaId = req.user!.empresaId;

        const products = await prisma.producto.findMany({
            where: { empresaId },
            include: { categoria: true }
        });

        // Stock por producto
        const stockAggregations = await prisma.movimientoInventario.groupBy({
            by: ['productoId', 'tipoMovimiento'],
            where: { empresaId },
            _sum: { cantidad: true }
        });

        // Último costoUnitario de ENTRADA por producto (para valor almacén)
        const lastEntradas = await prisma.movimientoInventario.findMany({
            where: { empresaId, tipoMovimiento: { in: ['ENTRADA', 'AJUSTE_POSITIVO'] } },
            orderBy: { fecha: 'desc' },
            select: { productoId: true, costoUnitario: true, fecha: true }
        });

        // Último precioVenta de SALIDA por producto
        const lastSalidas = await prisma.movimientoInventario.findMany({
            where: { empresaId, tipoMovimiento: { in: ['SALIDA', 'AJUSTE_NEGATIVO'] }, precioVenta: { not: null } },
            orderBy: { fecha: 'desc' },
            select: { productoId: true, precioVenta: true, fecha: true }
        });

        // Deduplicate: first hit per productoId = most recent
        const lastCostoMap: Record<string, number> = {};
        for (const m of lastEntradas) {
            if (!(m.productoId in lastCostoMap)) {
                lastCostoMap[m.productoId] = Number(m.costoUnitario);
            }
        }
        const lastVentaMap: Record<string, number> = {};
        for (const m of lastSalidas) {
            if (!(m.productoId in lastVentaMap) && m.precioVenta) {
                lastVentaMap[m.productoId] = Number(m.precioVenta);
            }
        }

        const productsWithStock = products.map(product => {
            const aggs = stockAggregations.filter(a => a.productoId === product.id);
            const sumEntradas = aggs.filter(a => ['ENTRADA','AJUSTE_POSITIVO'].includes(a.tipoMovimiento)).reduce((acc, c) => acc + (c._sum.cantidad || 0), 0);
            const sumSalidas  = aggs.filter(a => ['SALIDA','AJUSTE_NEGATIVO'].includes(a.tipoMovimiento)).reduce((acc, c) => acc + (c._sum.cantidad || 0), 0);
            return {
                ...product,
                stock: sumEntradas - sumSalidas,
                ultimoPrecioCompra: lastCostoMap[product.id] ?? null,
                ultimoPrecioVenta:  lastVentaMap[product.id]  ?? null,
            };
        });

        res.json(productsWithStock);
    } catch (error) {
        console.error('getProducts ERROR:', error);
        res.status(500).json({ error: 'Error fetching products', detail: String(error) });
    }
};

export const getProductById = async (req: AuthRequest, res: Response) => {
    try {
        const empresaId = req.user!.empresaId;
        const id = req.params.id as string;

        const product = await prisma.producto.findFirst({
            where: { id, empresaId },
            include: { categoria: true }
        });
        if (!product) return res.status(404).json({ error: 'Product not found' });
        res.json(product);
    } catch (error) {
        res.status(500).json({ error: 'Error fetching product' });
    }
};

export const createProduct = async (req: AuthRequest, res: Response) => {
    try {
        const empresaId = req.user!.empresaId;
        const { nombre, sku, categoriaId, unidad, stockMinimo, imagen, activo } = req.body;

        const product = await prisma.producto.create({
            data: {
                empresaId, nombre, sku,
                categoriaId,
                unidad: unidad || 'pieza',
                stockMinimo: stockMinimo ?? 5,
                imagen: imagen || null,
                activo: activo ?? true,
            }
        });
        res.status(201).json(product);
    } catch (error: any) {
        if (error.code === 'P2002') return res.status(400).json({ error: 'El SKU ya existe para esta empresa' });
        res.status(500).json({ error: 'Error al crear el producto' });
    }
};

export const updateProduct = async (req: AuthRequest, res: Response) => {
    try {
        const empresaId = req.user!.empresaId;
        const id = req.params.id as string;
        const { nombre, categoriaId, unidad, stockMinimo, imagen, activo } = req.body;

        const product = await prisma.producto.update({
            where: { id, empresaId },
            data: {
                nombre,
                ...(categoriaId !== undefined && { categoriaId }),
                ...(unidad      !== undefined && { unidad }),
                ...(stockMinimo !== undefined && { stockMinimo: Number(stockMinimo) }),
                ...(imagen      !== undefined && { imagen }),
                ...(activo      !== undefined && { activo }),
            }
        });
        res.json(product);
    } catch (error: any) {
        if (error.code === 'P2002') return res.status(400).json({ error: 'El SKU ya existe para esta empresa' });
        res.status(500).json({ error: 'Error al actualizar el producto' });
    }
};

export const deleteProduct = async (req: AuthRequest, res: Response) => {
    try {
        const empresaId = req.user!.empresaId;
        const id = req.params.id as string;
        await prisma.producto.delete({ where: { id, empresaId } });
        res.json({ message: 'Producto eliminado correctamente' });
    } catch (error: any) {
        if (error.code === 'P2003') return res.status(400).json({ error: 'No se puede eliminar: tiene movimientos asociados.' });
        res.status(500).json({ error: 'Error al eliminar el producto' });
    }
};
