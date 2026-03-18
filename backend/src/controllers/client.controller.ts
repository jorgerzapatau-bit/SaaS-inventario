import { Response } from 'express';
import { AuthRequest } from '../middlewares/auth';
import prisma from '../utils/prisma';

// Validar formato RFC mexicano (12 chars persona física, 13 moral)
function validateRFC(rfc: string): boolean {
    const rfcRegex = /^([A-ZÑ&]{3,4})\d{6}([A-Z\d]{3})$/i;
    return rfcRegex.test(rfc.trim().toUpperCase());
}

export const getClientes = async (req: AuthRequest, res: Response) => {
    try {
        const empresaId = req.user!.empresaId;
        const clientes = await prisma.cliente.findMany({
            where: { empresaId },
            orderBy: { nombre: 'asc' },
        });

        // Stats básicos por cliente
        const statsRaw = await prisma.movimientoInventario.groupBy({
            by: ['clienteId'],
            where: { empresaId, clienteId: { not: null }, tipoMovimiento: { in: ['SALIDA', 'AJUSTE_NEGATIVO'] } },
            _count: { id: true },
            _max: { fecha: true },
        });
        const ventas = await prisma.movimientoInventario.findMany({
            where: { empresaId, clienteId: { not: null }, tipoMovimiento: { in: ['SALIDA', 'AJUSTE_NEGATIVO'] } },
            select: { clienteId: true, cantidad: true, precioVenta: true },
        });
        const montosPorCliente: Record<string, number> = {};
        for (const m of ventas) {
            const cid = m.clienteId!;
            montosPorCliente[cid] = (montosPorCliente[cid] || 0) + Number(m.cantidad) * Number(m.precioVenta || 0);
        }
        const statsMap: Record<string, { totalVentas: number; ultimaVenta: Date | null; montoTotal: number }> = {};
        for (const s of statsRaw) {
            const cid = s.clienteId!;
            statsMap[cid] = { totalVentas: s._count.id, ultimaVenta: s._max.fecha, montoTotal: montosPorCliente[cid] || 0 };
        }
        res.json(clientes.map(c => ({
            ...c,
            totalVentas: statsMap[c.id]?.totalVentas || 0,
            ultimaVenta: statsMap[c.id]?.ultimaVenta  || null,
            montoTotal:  statsMap[c.id]?.montoTotal   || 0,
        })));
    } catch (error) { console.error(error); res.status(500).json({ error: 'Error fetching clients' }); }
};

export const getClienteStats = async (req: AuthRequest, res: Response) => {
    try {
        const empresaId = req.user!.empresaId;
        const id = req.params.id as string;
        const cliente = await prisma.cliente.findFirst({ where: { id, empresaId } });
        if (!cliente) return res.status(404).json({ error: 'Cliente no encontrado' });

        const movimientos = await prisma.movimientoInventario.findMany({
            where: { empresaId, clienteId: id, tipoMovimiento: { in: ['SALIDA', 'AJUSTE_NEGATIVO'] } },
            orderBy: { fecha: 'desc' },
            include: {
                producto: { select: { nombre: true, sku: true, unidad: true } },
                almacen:  { select: { nombre: true } },
                usuario:  { select: { nombre: true } },
            },
        });
        const totalVentas   = movimientos.length;
        const montoTotal    = movimientos.reduce((acc: number, m: { cantidad: number; precioVenta: unknown }) => acc + Number(m.cantidad) * Number(m.precioVenta || 0), 0);
        const ultimaVenta   = movimientos.length > 0 ? movimientos[0].fecha : null;
        const productosSet  = new Set(movimientos.map((m: { productoId: string }) => m.productoId));
        res.json({ cliente, stats: { totalVentas, montoTotal, ultimaVenta, totalProductos: productosSet.size }, movimientos });
    } catch (error) { console.error(error); res.status(500).json({ error: 'Error fetching client stats' }); }
};

export const createCliente = async (req: AuthRequest, res: Response) => {
    try {
        const empresaId = req.user!.empresaId;
        const { nombre, contacto, telefono, email, direccion, rfc, razonSocial, codigoPostal, regimenFiscal, usoCFDI } = req.body;
        if (!nombre) return res.status(400).json({ error: 'El nombre es obligatorio' });
        if (rfc && !validateRFC(rfc)) return res.status(400).json({ error: 'Formato de RFC inválido' });
        const cliente = await prisma.cliente.create({
            data: { empresaId, nombre, contacto, telefono, email, direccion, rfc: rfc?.toUpperCase() || null, razonSocial, codigoPostal, regimenFiscal, usoCFDI },
        });
        res.status(201).json({ ...cliente, totalVentas: 0, ultimaVenta: null, montoTotal: 0 });
    } catch (error) { res.status(500).json({ error: 'Error creating client' }); }
};

export const updateCliente = async (req: AuthRequest, res: Response) => {
    try {
        const empresaId = req.user!.empresaId;
        const id = req.params.id as string;
        const { nombre, contacto, telefono, email, direccion, rfc, razonSocial, codigoPostal, regimenFiscal, usoCFDI } = req.body;
        if (rfc && !validateRFC(rfc)) return res.status(400).json({ error: 'Formato de RFC inválido' });
        const exists = await prisma.cliente.findFirst({ where: { id, empresaId } });
        if (!exists) return res.status(404).json({ error: 'Cliente no encontrado' });
        const updated = await prisma.cliente.update({
            where: { id },
            data: { nombre, contacto, telefono, email, direccion, rfc: rfc?.toUpperCase() || null, razonSocial, codigoPostal, regimenFiscal, usoCFDI },
        });
        res.json(updated);
    } catch (error) { res.status(500).json({ error: 'Error updating client' }); }
};

export const deleteCliente = async (req: AuthRequest, res: Response) => {
    try {
        const empresaId = req.user!.empresaId;
        const id = req.params.id as string;
        const exists = await prisma.cliente.findFirst({ where: { id, empresaId } });
        if (!exists) return res.status(404).json({ error: 'Cliente no encontrado' });
        const movCount = await prisma.movimientoInventario.count({ where: { clienteId: id } });
        if (movCount > 0) return res.status(409).json({ error: `No se puede eliminar: tiene ${movCount} movimiento(s) asociado(s).` });
        await prisma.cliente.delete({ where: { id } });
        res.json({ ok: true });
    } catch (error) { res.status(500).json({ error: 'Error deleting client' }); }
};
