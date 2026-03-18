import { Response } from 'express';
import { AuthRequest } from '../middlewares/auth';
import prisma from '../utils/prisma';

export const registrarCompra = async (req: AuthRequest, res: Response) => {
    try {
        const empresaId = req.user!.empresaId;
        const usuarioId = req.user!.id;
        const { proveedorId, detalles, total, almacenId } = req.body;

        let targetAlmacenId = almacenId;
        if (!targetAlmacenId) {
            const firstAlmacen = await prisma.almacen.findFirst({ where: { empresaId } });
            if (!firstAlmacen) return res.status(400).json({ error: 'No warehouse found for company' });
            targetAlmacenId = firstAlmacen.id;
        }

        const result = await prisma.$transaction(async (tx) => {
            // 1. Crear documento de compra
            const compra = await tx.compra.create({
                data: {
                    empresaId,
                    proveedorId,
                    total,
                    status: 'COMPLETADA',
                    detalles: {
                        create: detalles.map((d: any) => ({
                            productoId: d.productoId,
                            cantidad: d.cantidad,
                            precioUnitario: d.precioUnitario
                        }))
                    }
                }
            });

            // 2. Crear movimientos de entrada en el Kardex
            const movimientos = detalles.map((d: any) => ({
                empresaId,
                productoId: d.productoId,
                almacenId: targetAlmacenId,
                tipoMovimiento: 'ENTRADA',
                cantidad: d.cantidad,
                costoUnitario: d.precioUnitario,
                referencia: `Compra #${compra.id}`,
                usuarioId
            }));

            await tx.movimientoInventario.createMany({ data: movimientos });

            return compra;
        });

        res.status(201).json(result);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error registering purchase' });
    }
};

export const getCompras = async (req: AuthRequest, res: Response) => {
    try {
        const empresaId = req.user!.empresaId;
        const compras = await prisma.compra.findMany({
            where: { empresaId },
            include: { proveedor: true, detalles: true }
        });
        res.json(compras);
    } catch (error) {
        res.status(500).json({ error: 'Error fetching purchases' });
    }
};
