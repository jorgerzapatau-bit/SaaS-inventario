const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
    console.log('Seeding data...');
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash('admin123', salt);

    // Create Demo Company
    const demo = await prisma.empresa.upsert({
        where: { url: 'demo' },
        update: {},
        create: {
            nombre: 'Demo',
            url: 'demo',
            usuarios: {
                create: {
                    nombre: 'Admin General',
                    email: 'admin@demo.com',
                    password: hashedPassword,
                    role: 'ADMIN',
                },
            },
        },
    });

    // Create Teprex Company
    const teprex = await prisma.empresa.upsert({
        where: { url: 'teprex' },
        update: {},
        create: {
            nombre: 'Teprex',
            url: 'teprex',
            telefono: '4737312390',
            email: 'teprex@hotmail.com',
            direccion: 'Pedregal #2, Col. Blvd. Guanajuato, 36080, Guanajuato, Gto .',
            usuarios: {
                create: {
                    nombre: 'Admin Teprex',
                    email: 'admin@teprex.com',
                    password: hashedPassword,
                    role: 'ADMIN',
                },
            },
        },
    });

    console.log('Empresas and Admins created:', { demo, teprex });

    // --- Seed test data for Demo company ---
    const adminDemo = await prisma.usuario.findFirst({ where: { email: 'admin@demo.com' } });

    // Categories
    const catElect = await prisma.categoria.create({ data: { nombre: 'Electrónicos', empresaId: demo.id } });
    const catRopa = await prisma.categoria.create({ data: { nombre: 'Ropa', empresaId: demo.id } });

    // Warehouse
    const almacen = await prisma.almacen.create({ data: { nombre: 'Almacén Principal', empresaId: demo.id } });

    // Supplier
    const proveedor = await prisma.proveedor.create({ data: { nombre: 'Tech Distributors LLC', contacto: 'John Doe', empresaId: demo.id } });

    // Products
    const p1 = await prisma.producto.create({
        data: {
            nombre: 'Laptop Pro 15', sku: 'LAP-001', unidad: 'pieza', precioCompra: 800, precioVenta: 1200, stockMinimo: 5,
            empresaId: demo.id, categoriaId: catElect.id
        }
    });

    const p2 = await prisma.producto.create({
        data: {
            nombre: 'Mouse Inalámbrico', sku: 'MOU-002', unidad: 'pieza', precioCompra: 15, precioVenta: 30, stockMinimo: 20,
            empresaId: demo.id, categoriaId: catElect.id
        }
    });

    // Dummy movements
    await prisma.movimientoInventario.create({
        data: {
            empresaId: demo.id, productoId: p1.id, almacenId: almacen.id,
            tipoMovimiento: 'ENTRADA', cantidad: 10, costoUnitario: 800, referencia: 'Compra Inicial', usuarioId: adminDemo.id
        }
    });

    await prisma.movimientoInventario.create({
        data: {
            empresaId: demo.id, productoId: p2.id, almacenId: almacen.id,
            tipoMovimiento: 'ENTRADA', cantidad: 50, costoUnitario: 15, referencia: 'Compra Inicial', usuarioId: adminDemo.id
        }
    });

    await prisma.movimientoInventario.create({
        data: {
            empresaId: demo.id, productoId: p1.id, almacenId: almacen.id,
            tipoMovimiento: 'SALIDA', cantidad: 2, costoUnitario: 800, referencia: 'Venta #001', usuarioId: adminDemo.id
        }
    });

    console.log('Test data created for Demo company.');
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
