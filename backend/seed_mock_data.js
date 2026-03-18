const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
    const adminUser = await prisma.usuario.findFirst({ where: { email: 'admin@demo.com' } });
    if (!adminUser) return console.log("Admin no encontrado. Ejecuta prisma db seed primero");

    const empresaId = adminUser.empresaId;

    // Categorias
    const catElect = await prisma.categoria.create({ data: { nombre: 'Electrónica', empresaId } });
    const catAcces = await prisma.categoria.create({ data: { nombre: 'Accesorios', empresaId } });

    // Productos
    await prisma.producto.createMany({
        data: [
            { empresaId, categoriaId: catElect.id, sku: 'LAP-DELL-XPS', nombre: 'Laptop Dell XPS 15', unidad: 'Unidades', precioCompra: 1000, precioVenta: 1250, stockMinimo: 5 },
            { empresaId, categoriaId: catAcces.id, sku: 'MOU-LOG-MX3', nombre: 'Mouse Logitech MX Master 3', unidad: 'Unidades', precioCompra: 60, precioVenta: 90, stockMinimo: 10 },
            { empresaId, categoriaId: catElect.id, sku: 'MON-LG-27', nombre: 'Monitor LG 27"', unidad: 'Unidades', precioCompra: 200, precioVenta: 350, stockMinimo: 3 },
            { empresaId, categoriaId: catAcces.id, sku: 'CAB-USB-C', nombre: 'Cable USB-C a USB-C 2m', unidad: 'Unidades', precioCompra: 5, precioVenta: 15, stockMinimo: 50 },
        ]
    });

    // Proveedores
    await prisma.proveedor.createMany({
        data: [
            { empresaId, nombre: 'Dell Technologies', contacto: 'Ana G.', email: 'ventas@dell.mx', telefono: '555-0101', direccion: 'Mexico' },
            { empresaId, nombre: 'Logitech Latam', contacto: 'Carlos R.', email: 'dist@logitech.com', telefono: '555-0202', direccion: 'Colombia' }
        ]
    });

    console.log("Mock data created!");
}
run().catch(console.error).finally(() => prisma.$disconnect());
