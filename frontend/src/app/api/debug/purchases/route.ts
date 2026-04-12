import { NextRequest } from 'next/server';
import prisma from '../../lib/prisma';
import { getAuthUser } from '../../lib/auth';

/**
 * GET /api/debug/purchases
 * Endpoint de diagnóstico — ELIMINAR en producción.
 * Muestra qué datos existen en la BD y si el empresaId del JWT coincide.
 */
export async function GET(req: NextRequest) {
    const user = getAuthUser(req);

    // Contar todas las compras en la BD (sin filtrar por empresa)
    const totalComprasDB = await prisma.compra.count();
    const totalMovDB     = await prisma.movimientoInventario.count({
        where: { compraId: null },
    });

    // Si no hay token válido, mostrar info genérica
    if (!user) {
        return Response.json({
            error:          'Token inválido o ausente — no se puede filtrar por empresa',
            totalComprasDB,
            totalMovDB,
            hint:           'Verifica que el token en localStorage sea válido y no esté expirado.',
        });
    }

    // Compras del usuario
    const comprasEmpresa = await prisma.compra.findMany({
        where:   { empresaId: user.empresaId },
        select:  { id: true, referencia: true, status: true, total: true, fecha: true, empresaId: true },
        orderBy: { fecha: 'desc' },
        take:    20,
    });

    // Movimientos sin compraId de la empresa
    const movsEmpresa = await prisma.movimientoInventario.findMany({
        where: {
            empresaId: user.empresaId,
            compraId:  null,
        },
        select: {
            id: true, tipoMovimiento: true, referencia: true,
            cantidad: true, costoUnitario: true, fecha: true,
            proveedorId: true, empresaId: true,
        },
        orderBy: { fecha: 'desc' },
        take:    20,
    });

    // Empresas existentes
    const empresas = await prisma.empresa.findMany({
        select: { id: true, nombre: true },
    });

    return Response.json({
        tokenInfo: {
            userId:    user.id,
            empresaId: user.empresaId,
            role:      user.role,
        },
        empresasEnDB:          empresas,
        comprasDeEstaEmpresa:  comprasEmpresa,
        movimientosSinCompra:  movsEmpresa,
        totalComprasEnTodaDB:  totalComprasDB,
        totalMovsEnTodaDB:     totalMovDB,
    });
}
