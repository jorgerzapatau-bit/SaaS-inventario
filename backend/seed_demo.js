// seed_demo.js - Datos de prueba para Demo Company
// Ejecutar con: node seed_demo.js

const { PrismaClient } = require('@prisma/client');
require('dotenv').config();

const prisma = new PrismaClient();

function daysAgo(days) {
    const d = new Date();
    d.setDate(d.getDate() - days);
    return d;
}

async function main() {
    console.log('🔍 Buscando empresa Demo...');

    const empresa = await prisma.empresa.findUnique({ where: { url: 'demo' } });
    if (!empresa) throw new Error('Empresa "demo" no encontrada. Verifica que exista en la base de datos.');

    const usuario = await prisma.usuario.findFirst({ where: { empresaId: empresa.id } });
    if (!usuario) throw new Error('No hay usuarios en la empresa demo.');

    console.log(`✅ Empresa: ${empresa.nombre} | Usuario: ${usuario.email}`);

    // ── Categorías ──────────────────────────────────────────────
    console.log('📁 Creando categorías...');
    const [catElec, catAcc, catPeri, catCons] = await Promise.all([
        prisma.categoria.create({ data: { nombre: 'Electrónicos', empresaId: empresa.id } }),
        prisma.categoria.create({ data: { nombre: 'Accesorios', empresaId: empresa.id } }),
        prisma.categoria.create({ data: { nombre: 'Periféricos', empresaId: empresa.id } }),
        prisma.categoria.create({ data: { nombre: 'Consumibles', empresaId: empresa.id } }),
    ]);

    // ── Almacenes ───────────────────────────────────────────────
    console.log('🏭 Creando almacenes...');
    const [almPrincipal, almSecundario] = await Promise.all([
        prisma.almacen.create({ data: { nombre: 'Almacén Principal', empresaId: empresa.id } }),
        prisma.almacen.create({ data: { nombre: 'Almacén Secundario', empresaId: empresa.id } }),
    ]);

    // ── Proveedores ─────────────────────────────────────────────
    console.log('🚚 Creando proveedores...');
    const [prov1, prov2, prov3] = await Promise.all([
        prisma.proveedor.create({ data: { nombre: 'Tech Distributors SA', contacto: 'Carlos Mendoza', telefono: '5551234567', email: 'ventas@techdist.com', direccion: 'Av. Reforma 123, CDMX', empresaId: empresa.id } }),
        prisma.proveedor.create({ data: { nombre: 'Global Electronics', contacto: 'Ana Pérez', telefono: '5559876543', email: 'ana@globalelec.com', direccion: 'Blvd. Insurgentes 456, CDMX', empresaId: empresa.id } }),
        prisma.proveedor.create({ data: { nombre: 'Consumibles MX', contacto: 'Roberto Lima', telefono: '5554567890', email: 'roberto@consumibles.mx', direccion: 'Calle 5 de Mayo 789, Guadalajara', empresaId: empresa.id } }),
    ]);

    // ── Productos ───────────────────────────────────────────────
    console.log('📦 Creando productos...');
    const productos = await Promise.all([
        prisma.producto.create({ data: { nombre: 'Laptop Dell Inspiron 15', sku: 'LAP-001', unidad: 'pieza', precioCompra: 12500, precioVenta: 17999, stockMinimo: 3, empresaId: empresa.id, categoriaId: catElec.id } }),
        prisma.producto.create({ data: { nombre: 'MacBook Air M2', sku: 'LAP-002', unidad: 'pieza', precioCompra: 22000, precioVenta: 28999, stockMinimo: 2, empresaId: empresa.id, categoriaId: catElec.id } }),
        prisma.producto.create({ data: { nombre: 'Monitor LG 27" 4K', sku: 'MON-001', unidad: 'pieza', precioCompra: 6800, precioVenta: 9500, stockMinimo: 5, empresaId: empresa.id, categoriaId: catElec.id } }),
        prisma.producto.create({ data: { nombre: 'Mouse Logitech MX Master', sku: 'MOU-001', unidad: 'pieza', precioCompra: 850, precioVenta: 1299, stockMinimo: 10, empresaId: empresa.id, categoriaId: catPeri.id } }),
        prisma.producto.create({ data: { nombre: 'Teclado Mecánico Redragon', sku: 'TEC-001', unidad: 'pieza', precioCompra: 650, precioVenta: 999, stockMinimo: 10, empresaId: empresa.id, categoriaId: catPeri.id } }),
        prisma.producto.create({ data: { nombre: 'Audífonos Sony WH-1000XM5', sku: 'AUD-001', unidad: 'pieza', precioCompra: 3200, precioVenta: 4999, stockMinimo: 5, empresaId: empresa.id, categoriaId: catElec.id } }),
        prisma.producto.create({ data: { nombre: 'Webcam Logitech C920', sku: 'CAM-001', unidad: 'pieza', precioCompra: 1100, precioVenta: 1799, stockMinimo: 5, empresaId: empresa.id, categoriaId: catPeri.id } }),
        prisma.producto.create({ data: { nombre: 'Cable HDMI 2m', sku: 'CAB-001', unidad: 'pieza', precioCompra: 85, precioVenta: 150, stockMinimo: 20, empresaId: empresa.id, categoriaId: catAcc.id } }),
        prisma.producto.create({ data: { nombre: 'Papel Bond A4 (resma)', sku: 'PAP-001', unidad: 'resma', precioCompra: 95, precioVenta: 150, stockMinimo: 30, empresaId: empresa.id, categoriaId: catCons.id } }),
        prisma.producto.create({ data: { nombre: 'Cartucho Tinta HP Negro', sku: 'CAR-001', unidad: 'pieza', precioCompra: 280, precioVenta: 450, stockMinimo: 15, empresaId: empresa.id, categoriaId: catCons.id } }),
        prisma.producto.create({ data: { nombre: 'USB Hub 7 puertos', sku: 'USB-001', unidad: 'pieza', precioCompra: 320, precioVenta: 549, stockMinimo: 8, empresaId: empresa.id, categoriaId: catAcc.id } }),
        prisma.producto.create({ data: { nombre: 'SSD Samsung 1TB', sku: 'SSD-001', unidad: 'pieza', precioCompra: 1800, precioVenta: 2699, stockMinimo: 5, empresaId: empresa.id, categoriaId: catElec.id } }),
    ]);

    const [laptop1, laptop2, monitor, mouse, teclado, audifonos, webcam, hdmi, papel, cartucho, usbhub, ssd] = productos;

    // ── Movimientos de Inventario (últimos 60 días) ─────────────
    console.log('📊 Creando movimientos de inventario...');

    const movimientos = [
        // Entradas iniciales (hace 60 días)
        { productoId: laptop1.id, almacenId: almPrincipal.id, tipoMovimiento: 'ENTRADA', cantidad: 10, costoUnitario: 12500, referencia: 'Compra inicial OC-001', fecha: daysAgo(60) },
        { productoId: laptop2.id, almacenId: almPrincipal.id, tipoMovimiento: 'ENTRADA', cantidad: 5, costoUnitario: 22000, referencia: 'Compra inicial OC-001', fecha: daysAgo(60) },
        { productoId: monitor.id, almacenId: almPrincipal.id, tipoMovimiento: 'ENTRADA', cantidad: 15, costoUnitario: 6800, referencia: 'Compra inicial OC-001', fecha: daysAgo(60) },
        { productoId: mouse.id, almacenId: almPrincipal.id, tipoMovimiento: 'ENTRADA', cantidad: 30, costoUnitario: 850, referencia: 'Compra inicial OC-001', fecha: daysAgo(60) },
        { productoId: teclado.id, almacenId: almPrincipal.id, tipoMovimiento: 'ENTRADA', cantidad: 25, costoUnitario: 650, referencia: 'Compra inicial OC-001', fecha: daysAgo(60) },
        { productoId: audifonos.id, almacenId: almPrincipal.id, tipoMovimiento: 'ENTRADA', cantidad: 12, costoUnitario: 3200, referencia: 'Compra inicial OC-001', fecha: daysAgo(60) },
        { productoId: webcam.id, almacenId: almPrincipal.id, tipoMovimiento: 'ENTRADA', cantidad: 20, costoUnitario: 1100, referencia: 'Compra inicial OC-001', fecha: daysAgo(60) },
        { productoId: hdmi.id, almacenId: almPrincipal.id, tipoMovimiento: 'ENTRADA', cantidad: 50, costoUnitario: 85, referencia: 'Compra inicial OC-001', fecha: daysAgo(60) },
        { productoId: papel.id, almacenId: almSecundario.id, tipoMovimiento: 'ENTRADA', cantidad: 100, costoUnitario: 95, referencia: 'Compra inicial OC-001', fecha: daysAgo(60) },
        { productoId: cartucho.id, almacenId: almSecundario.id, tipoMovimiento: 'ENTRADA', cantidad: 40, costoUnitario: 280, referencia: 'Compra inicial OC-001', fecha: daysAgo(60) },
        { productoId: usbhub.id, almacenId: almPrincipal.id, tipoMovimiento: 'ENTRADA', cantidad: 20, costoUnitario: 320, referencia: 'Compra inicial OC-001', fecha: daysAgo(60) },
        { productoId: ssd.id, almacenId: almPrincipal.id, tipoMovimiento: 'ENTRADA', cantidad: 18, costoUnitario: 1800, referencia: 'Compra inicial OC-001', fecha: daysAgo(60) },

        // Ventas semana 1 (hace 45 días)
        { productoId: laptop1.id, almacenId: almPrincipal.id, tipoMovimiento: 'SALIDA', cantidad: 2, costoUnitario: 12500, referencia: 'Venta #V-001', fecha: daysAgo(45) },
        { productoId: mouse.id, almacenId: almPrincipal.id, tipoMovimiento: 'SALIDA', cantidad: 5, costoUnitario: 850, referencia: 'Venta #V-001', fecha: daysAgo(45) },
        { productoId: hdmi.id, almacenId: almPrincipal.id, tipoMovimiento: 'SALIDA', cantidad: 8, costoUnitario: 85, referencia: 'Venta #V-001', fecha: daysAgo(45) },
        { productoId: papel.id, almacenId: almSecundario.id, tipoMovimiento: 'SALIDA', cantidad: 15, costoUnitario: 95, referencia: 'Consumo interno oficina', fecha: daysAgo(45) },

        // Segunda compra (hace 30 días)
        { productoId: laptop1.id, almacenId: almPrincipal.id, tipoMovimiento: 'ENTRADA', cantidad: 5, costoUnitario: 12800, referencia: 'Reabastecimiento OC-002', fecha: daysAgo(30) },
        { productoId: ssd.id, almacenId: almPrincipal.id, tipoMovimiento: 'ENTRADA', cantidad: 10, costoUnitario: 1750, referencia: 'Reabastecimiento OC-002', fecha: daysAgo(30) },
        { productoId: cartucho.id, almacenId: almSecundario.id, tipoMovimiento: 'ENTRADA', cantidad: 20, costoUnitario: 275, referencia: 'Reabastecimiento OC-002', fecha: daysAgo(30) },

        // Ventas semana 2 (hace 20 días)
        { productoId: monitor.id, almacenId: almPrincipal.id, tipoMovimiento: 'SALIDA', cantidad: 3, costoUnitario: 6800, referencia: 'Venta #V-002', fecha: daysAgo(20) },
        { productoId: audifonos.id, almacenId: almPrincipal.id, tipoMovimiento: 'SALIDA', cantidad: 4, costoUnitario: 3200, referencia: 'Venta #V-002', fecha: daysAgo(20) },
        { productoId: teclado.id, almacenId: almPrincipal.id, tipoMovimiento: 'SALIDA', cantidad: 6, costoUnitario: 650, referencia: 'Venta #V-002', fecha: daysAgo(20) },
        { productoId: webcam.id, almacenId: almPrincipal.id, tipoMovimiento: 'SALIDA', cantidad: 5, costoUnitario: 1100, referencia: 'Venta #V-002', fecha: daysAgo(20) },
        { productoId: ssd.id, almacenId: almPrincipal.id, tipoMovimiento: 'SALIDA', cantidad: 7, costoUnitario: 1800, referencia: 'Venta #V-002', fecha: daysAgo(20) },

        // Ajustes (hace 10 días)
        { productoId: papel.id, almacenId: almSecundario.id, tipoMovimiento: 'AJUSTE_NEGATIVO', cantidad: 5, costoUnitario: 95, referencia: 'Ajuste por daño en almacén', fecha: daysAgo(10) },
        { productoId: usbhub.id, almacenId: almPrincipal.id, tipoMovimiento: 'AJUSTE_POSITIVO', cantidad: 3, costoUnitario: 320, referencia: 'Ajuste por conteo físico', fecha: daysAgo(10) },

        // Ventas recientes (últimos 5 días)
        { productoId: laptop2.id, almacenId: almPrincipal.id, tipoMovimiento: 'SALIDA', cantidad: 2, costoUnitario: 22000, referencia: 'Venta #V-003', fecha: daysAgo(4) },
        { productoId: mouse.id, almacenId: almPrincipal.id, tipoMovimiento: 'SALIDA', cantidad: 8, costoUnitario: 850, referencia: 'Venta #V-003', fecha: daysAgo(3) },
        { productoId: cartucho.id, almacenId: almSecundario.id, tipoMovimiento: 'SALIDA', cantidad: 12, costoUnitario: 280, referencia: 'Venta #V-003', fecha: daysAgo(2) },
        { productoId: laptop1.id, almacenId: almPrincipal.id, tipoMovimiento: 'SALIDA', cantidad: 3, costoUnitario: 12500, referencia: 'Venta #V-004', fecha: daysAgo(1) },
        { productoId: hdmi.id, almacenId: almPrincipal.id, tipoMovimiento: 'SALIDA', cantidad: 10, costoUnitario: 85, referencia: 'Venta #V-004', fecha: daysAgo(1) },
    ];

    for (const mov of movimientos) {
        await prisma.movimientoInventario.create({
            data: { ...mov, empresaId: empresa.id, usuarioId: usuario.id }
        });
    }

    console.log(`✅ ${movimientos.length} movimientos creados.`);
    console.log('\n🎉 Seed completado exitosamente!');
    console.log('\n📊 Resumen:');
    console.log(`   • 4 categorías`);
    console.log(`   • 2 almacenes`);
    console.log(`   • 3 proveedores`);
    console.log(`   • 12 productos`);
    console.log(`   • ${movimientos.length} movimientos (60 días de historial)`);
}

main()
    .catch((e) => { console.error('❌ Error:', e.message); process.exit(1); })
    .finally(async () => { await prisma.$disconnect(); });
