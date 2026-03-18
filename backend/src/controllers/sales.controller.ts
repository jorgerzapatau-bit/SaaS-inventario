import { Response } from 'express';
import { AuthRequest } from '../middlewares/auth';
import prisma from '../utils/prisma';

export const registrarSalida = async (req: AuthRequest, res: Response) => {
    try {
        const empresaId = req.user!.empresaId;
        const usuarioId = req.user!.id;
        const { tipo, detalles, referencia, almacenId } = req.body; // tipo: VENTA, CONSUMO_INTERNO, etc.

        let targetAlmacenId = almacenId;
        if (!targetAlmacenId) {
            const firstAlmacen = await prisma.almacen.findFirst({ where: { empresaId } });
            if (!firstAlmacen) return res.status(400).json({ error: 'No warehouse found for company' });
            targetAlmacenId = firstAlmacen.id;
        }

        const result = await prisma.$transaction(async (tx) => {
            const salida = await tx.salida.create({
                data: {
                    empresaId,
                    tipo,
                    referencia,
                    usuarioId,
                    detalles: {
                        create: detalles.map((d: any) => ({
                            productoId: d.productoId,
                            cantidad: d.cantidad,
                            precioUnitario: d.precioUnitario || 0
                        }))
                    }
                }
            });

            const movimientos = detalles.map((d: any) => ({
                empresaId,
                productoId: d.productoId,
                almacenId: targetAlmacenId,
                tipoMovimiento: 'SALIDA',
                cantidad: d.cantidad,
                costoUnitario: d.precioUnitario || 0,
                referencia: `Salida #${salida.id} - ${referencia || ''}`,
                usuarioId
            }));

            await tx.movimientoInventario.createMany({ data: movimientos });

            return salida;
        });

        res.status(201).json(result);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error registering sale/exit' });
    }
};

export const getSalidas = async (req: AuthRequest, res: Response) => {
    try {
        const empresaId = req.user!.empresaId;
        const salidas = await prisma.salida.findMany({
            where: { empresaId },
            include: { usuario: true, detalles: true }
        });
        res.json(salidas);
    } catch (error) {
        res.status(500).json({ error: 'Error fetching sales' });
    }
};
