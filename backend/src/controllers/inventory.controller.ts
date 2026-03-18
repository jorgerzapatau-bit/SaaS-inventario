import { Response } from 'express';
import { AuthRequest } from '../middlewares/auth';
import prisma from '../utils/prisma';

export const registerMovement = async (req: AuthRequest, res: Response) => {
    try {
        const empresaId = req.user!.empresaId;
        const usuarioId = req.user!.id;
        const {
            productoId, almacenId, tipoMovimiento, cantidad,
            costoUnitario, precioVenta, proveedorId, clienteNombre, referencia
        } = req.body;

        if (!['ENTRADA', 'SALIDA', 'AJUSTE_POSITIVO', 'AJUSTE_NEGATIVO'].includes(tipoMovimiento)) {
            return res.status(400).json({ error: 'Invalid movement type' });
        }

        if (cantidad <= 0) {
            return res.status(400).json({ error: 'Quantity must be positive' });
        }

        if (['SALIDA', 'AJUSTE_NEGATIVO'].includes(tipoMovimiento)) {
            const currentStock = await calculateStock(empresaId, productoId, almacenId);
            if (currentStock < cantidad) {
                return res.status(400).json({ error: `Stock insuficiente. Stock actual: ${currentStock}` });
            }
        }

        const movement = await prisma.movimientoInventario.create({
            data: {
                empresaId,
                productoId,
                almacenId,
                tipoMovimiento,
                cantidad: parseInt(String(cantidad)),
                costoUnitario: parseFloat(String(costoUnitario || 0)),
                precioVenta: precioVenta != null ? parseFloat(String(precioVenta)) : null,
                proveedorId: proveedorId || null,
                clienteNombre: clienteNombre || null,
                referencia: referencia || null,
                ...(req.body.fecha ? { fecha: new Date(req.body.fecha) } : {}),
                usuarioId
            },
            include: {
                proveedor: { select: { nombre: true } },
                almacen: { select: { nombre: true } },
                usuario: { select: { nombre: true } }
            }
        });

        res.status(201).json(movement);
    } catch (error: any) {
        console.error('registerMovement error:', error);
        const msg = error?.message || 'Error registering movement';
        res.status(500).json({ error: msg });
    }
};

export const getAllMovements = async (req: AuthRequest, res: Response) => {
    try {
        const empresaId = req.user!.empresaId;
        // ?limit=N para paginación, sin límite para cálculos de valor total
        const limit = req.query.limit ? parseInt(req.query.limit as string) : undefined;
        const movements = await prisma.movimientoInventario.findMany({
            where: { empresaId },
            orderBy: { fecha: 'desc' },
            ...(limit ? { take: limit } : {}),
            include: {
                producto: { select: { nombre: true } },
                almacen: { select: { nombre: true } },
                usuario: { select: { nombre: true } },
                proveedor: { select: { nombre: true } }
            }
        });

        res.json(movements.map(m => ({
            ...m,
            motivo: m.referencia || (m.tipoMovimiento === 'ENTRADA' ? 'Compra' : 'Salida')
        })));
    } catch (error) {
        res.status(500).json({ error: 'Error fetching movements' });
    }
};

export const getProductoStock = async (req: AuthRequest, res: Response) => {
    try {
        const empresaId = req.user!.empresaId;
        const productoId = req.params.productoId as string;
        const almacenId = req.query.almacenId as string | undefined;

        const stock = await calculateStock(empresaId, productoId, almacenId);
        res.json({ productoId, stock, almacenId: almacenId || 'ALL' });
    } catch (error) {
        res.status(500).json({ error: 'Error calculating stock' });
    }
};

export const getKardex = async (req: AuthRequest, res: Response) => {
    try {
        const empresaId = req.user!.empresaId;
        const productoId = req.params.productoId as string;

        const movements = await prisma.movimientoInventario.findMany({
            where: { empresaId, productoId },
            orderBy: { fecha: 'asc' },
            include: {
                usuario: { select: { nombre: true } },
                almacen: { select: { nombre: true } },
                proveedor: { select: { nombre: true, telefono: true, email: true } }
            }
        });

        res.json(movements);
    } catch (error) {
        res.status(500).json({ error: 'Error fetching Kardex' });
    }
};

const calculateStock = async (empresaId: string, productoId: string, almacenId?: string): Promise<number> => {
    const whereClause: any = { empresaId, productoId };
    if (almacenId) whereClause.almacenId = almacenId;

    const positive = await prisma.movimientoInventario.aggregate({
        _sum: { cantidad: true },
        where: { ...whereClause, tipoMovimiento: { in: ['ENTRADA', 'AJUSTE_POSITIVO'] } }
    });

    const negative = await prisma.movimientoInventario.aggregate({
        _sum: { cantidad: true },
        where: { ...whereClause, tipoMovimiento: { in: ['SALIDA', 'AJUSTE_NEGATIVO'] } }
    });

    return (positive._sum.cantidad || 0) - (negative._sum.cantidad || 0);
};
