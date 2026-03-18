import { Response } from 'express';
import { AuthRequest } from '../middlewares/auth';
import prisma from '../utils/prisma';

function validateRFC(rfc: string): boolean {
    const rfcRegex = /^([A-ZÑ&]{3,4})\d{6}([A-Z\d]{3})$/i;
    return rfcRegex.test(rfc.trim().toUpperCase());
}

export const getProveedores = async (req: AuthRequest, res: Response) => {
    try {
        const empresaId = req.user!.empresaId;
        const proveedores = await prisma.proveedor.findMany({ where: { empresaId }, orderBy: { nombre: 'asc' } });

        const statsRaw = await prisma.movimientoInventario.groupBy({
            by: ['proveedorId'],
            where: { empresaId, proveedorId: { not: null }, tipoMovimiento: { in: ['ENTRADA', 'AJUSTE_POSITIVO'] } },
            _count: { id: true },
            _max: { fecha: true },
        });
        const montos = await prisma.movimientoInventario.findMany({
            where: { empresaId, proveedorId: { not: null }, tipoMovimiento: { in: ['ENTRADA', 'AJUSTE_POSITIVO'] } },
            select: { proveedorId: true, cantidad: true, costoUnitario: true },
        });
        const montosPorProveedor: Record<string, number> = {};
        for (const m of montos) {
            const pid = m.proveedorId!;
            montosPorProveedor[pid] = (montosPorProveedor[pid] || 0) + Number(m.cantidad) * Number(m.costoUnitario);
        }
        const statsMap: Record<string, { totalCompras: number; ultimaCompra: Date | null; montoTotal: number }> = {};
        for (const s of statsRaw) {
            const pid = s.proveedorId!;
            statsMap[pid] = { totalCompras: s._count.id, ultimaCompra: s._max.fecha, montoTotal: montosPorProveedor[pid] || 0 };
        }
        res.json(proveedores.map(p => ({
            ...p,
            totalCompras: statsMap[p.id]?.totalCompras || 0,
            ultimaCompra: statsMap[p.id]?.ultimaCompra || null,
            montoTotal:   statsMap[p.id]?.montoTotal   || 0,
        })));
    } catch (error) { console.error(error); res.status(500).json({ error: 'Error fetching suppliers' }); }
};

export const getProveedorStats = async (req: AuthRequest, res: Response) => {
    try {
        const empresaId = req.user!.empresaId;
        const id = req.params.id as string;
        const proveedor = await prisma.proveedor.findFirst({ where: { id, empresaId } });
        if (!proveedor) return res.status(404).json({ error: 'Proveedor no encontrado' });

        const movimientos = await prisma.movimientoInventario.findMany({
            where: { empresaId, proveedorId: id, tipoMovimiento: { in: ['ENTRADA', 'AJUSTE_POSITIVO'] } },
            orderBy: { fecha: 'desc' },
            include: {
                producto: { select: { nombre: true, sku: true, unidad: true } },
                almacen:  { select: { nombre: true } },
                usuario:  { select: { nombre: true } },
            },
        });
        const totalCompras   = movimientos.length;
        const montoTotal     = movimientos.reduce((acc: number, m: { cantidad: number; costoUnitario: unknown }) => acc + Number(m.cantidad) * Number(m.costoUnitario), 0);
        const ultimaCompra   = movimientos.length > 0 ? movimientos[0].fecha : null;
        const productosSet   = new Set(movimientos.map((m: { productoId: string }) => m.productoId));
        res.json({ proveedor, stats: { totalCompras, montoTotal, ultimaCompra, totalProductos: productosSet.size }, movimientos });
    } catch (error) { console.error(error); res.status(500).json({ error: 'Error fetching supplier stats' }); }
};

export const createProveedor = async (req: AuthRequest, res: Response) => {
    try {
        const empresaId = req.user!.empresaId;
        const { nombre, contacto, telefono, email, direccion, rfc, razonSocial, codigoPostal, regimenFiscal, usoCFDI } = req.body;
        if (!nombre) return res.status(400).json({ error: 'El nombre es obligatorio' });
        if (rfc && !validateRFC(rfc)) return res.status(400).json({ error: 'Formato de RFC inválido' });
        const proveedor = await prisma.proveedor.create({
            data: { empresaId, nombre, contacto, telefono, email, direccion, rfc: rfc?.toUpperCase() || null, razonSocial, codigoPostal, regimenFiscal, usoCFDI },
        });
        res.status(201).json({ ...proveedor, totalCompras: 0, ultimaCompra: null, montoTotal: 0 });
    } catch (error) { res.status(500).json({ error: 'Error creating supplier' }); }
};

export const updateProveedor = async (req: AuthRequest, res: Response) => {
    try {
        const empresaId = req.user!.empresaId;
        const id = req.params.id as string;
        const { nombre, contacto, telefono, email, direccion, rfc, razonSocial, codigoPostal, regimenFiscal, usoCFDI } = req.body;
        if (rfc && !validateRFC(rfc)) return res.status(400).json({ error: 'Formato de RFC inválido' });
        const exists = await prisma.proveedor.findFirst({ where: { id, empresaId } });
        if (!exists) return res.status(404).json({ error: 'Proveedor no encontrado' });
        const updated = await prisma.proveedor.update({
            where: { id },
            data: { nombre, contacto, telefono, email, direccion, rfc: rfc?.toUpperCase() || null, razonSocial, codigoPostal, regimenFiscal, usoCFDI },
        });
        res.json(updated);
    } catch (error) { res.status(500).json({ error: 'Error updating supplier' }); }
};

export const deleteProveedor = async (req: AuthRequest, res: Response) => {
    try {
        const empresaId = req.user!.empresaId;
        const id = req.params.id as string;
        const exists = await prisma.proveedor.findFirst({ where: { id, empresaId } });
        if (!exists) return res.status(404).json({ error: 'Proveedor no encontrado' });
        const movCount = await prisma.movimientoInventario.count({ where: { proveedorId: id } });
        if (movCount > 0) return res.status(409).json({ error: `No se puede eliminar: tiene ${movCount} movimiento(s) asociado(s).` });
        await prisma.proveedor.delete({ where: { id } });
        res.json({ ok: true });
    } catch (error) { res.status(500).json({ error: 'Error deleting supplier' }); }
};
