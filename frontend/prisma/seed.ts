/**
 * seed.ts  —  Datos reales de Teprex (empresa de perforación)
 *
 * Uso:
 *   npx ts-node --compiler-options '{"module":"CommonJS"}' prisma/seed.ts
 *   ó agrega en package.json:
 *     "prisma": { "seed": "ts-node prisma/seed.ts" }
 *   y ejecuta:
 *     npx prisma db seed
 *
 * ⚠️  Este seed BORRA todos los datos existentes antes de insertar.
 *     Sólo usar en entornos DEMO / desarrollo.
 */

import { PrismaClient, Moneda, Role } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("🗑️  Limpiando base de datos...");

  // Eliminar en orden inverso de dependencias para respetar FK
  await prisma.movimientoInventario.deleteMany();
  await prisma.registroDiario.deleteMany();
  await prisma.resumenSemana.deleteMany();
  await prisma.detalleCompra.deleteMany();
  await prisma.detalleSalida.deleteMany();
  await prisma.compra.deleteMany();
  await prisma.salida.deleteMany();
  await prisma.equipo.deleteMany();
  await prisma.producto.deleteMany();
  await prisma.categoria.deleteMany();
  await prisma.almacen.deleteMany();
  await prisma.proveedor.deleteMany();
  await prisma.cliente.deleteMany();
  await prisma.usuario.deleteMany();
  await prisma.empresa.deleteMany();

  console.log("✅ Base de datos limpia.");

  // ──────────────────────────────────────────────
  //  EMPRESA
  // ──────────────────────────────────────────────
  console.log("🏢 Creando empresa...");

  const empresa = await prisma.empresa.create({
    data: {
      nombre: "Teprex",
      url: "teprex",
      telefono: "",
      email: "",
      direccion: "",
      config: {
        monedaPrincipal: "MXN",
        multimoneda: true,
      },
    },
  });

  // ──────────────────────────────────────────────
  //  USUARIOS
  // ──────────────────────────────────────────────
  console.log("👤 Creando usuarios...");

  const passwordHash = await bcrypt.hash("Admin2024!", 10);

  const admin = await prisma.usuario.create({
    data: {
      empresaId: empresa.id,
      nombre: "Administrador",
      email: "admin@teprex.com",
      password: passwordHash,
      role: Role.ADMIN,
    },
  });

  await prisma.usuario.create({
    data: {
      empresaId: empresa.id,
      nombre: "Operador",
      email: "operador@teprex.com",
      password: await bcrypt.hash("Operador2024!", 10),
      role: Role.OPERADOR,
    },
  });

  // ──────────────────────────────────────────────
  //  CATEGORÍAS DE INSUMOS
  // ──────────────────────────────────────────────
  console.log("📂 Creando categorías...");

  const [catLubricantes, catCombustibles, catHerramientas, catManoObra, catMateriales] =
    await Promise.all([
      prisma.categoria.create({
        data: {
          empresaId: empresa.id,
          nombre: "Lubricantes",
          descripcion: "Aceites, grasas y fluidos para mantenimiento de equipo",
        },
      }),
      prisma.categoria.create({
        data: {
          empresaId: empresa.id,
          nombre: "Combustibles",
          descripcion: "Diésel, gasolina y combustibles de operación",
        },
      }),
      prisma.categoria.create({
        data: {
          empresaId: empresa.id,
          nombre: "Herramientas de Perforación",
          descripcion: "Brocas, zancos, barras, coples y accesorios de perforación",
        },
      }),
      prisma.categoria.create({
        data: {
          empresaId: empresa.id,
          nombre: "Mano de Obra",
          descripcion: "Operadores, peones y personal de campo",
        },
      }),
      prisma.categoria.create({
        data: {
          empresaId: empresa.id,
          nombre: "Materiales Generales",
          descripcion: "Vehículos, aerosoles y materiales de apoyo",
        },
      }),
    ]);

  // ──────────────────────────────────────────────
  //  ALMACÉN
  // ──────────────────────────────────────────────
  console.log("🏪 Creando almacén...");

  const almacen = await prisma.almacen.create({
    data: {
      empresaId: empresa.id,
      nombre: "Almacén General",
    },
  });

  // ──────────────────────────────────────────────
  //  PRODUCTOS / INSUMOS  (datos reales del Excel — hoja Gastos)
  //
  //  Precios tomados de las fórmulas del Excel:
  //    Neumático  = 10355.86 / 208 litros  = ~49.79 MXN/lt
  //    15W40      = 16206.90 / 208 litros  = ~77.92 MXN/lt
  //    Grasa 3.8l = 465.51 MXN/pza
  //    Hdco Track = 1431.56 / 20 lt        = ~71.58 MXN/lt
  //    Anticongelante = 723.10 / 19 lt     = ~38.06 MXN/lt
  //    80w90      = 1189.09 / 19 lt        = ~62.58 MXN/lt
  //    Broca X    = 18.5 USD × 278.8       = 5157.80 MXN/pza  (precio en USD: 18.5)
  //    Broca Rtctl= 18.5 USD × 169.4       = 3133.90 MXN/pza  (precio en USD: 18.5)
  //    Cople      = 18.5 USD × 69          = 1276.50 MXN/pza  (precio en USD: 18.5)
  //    Zanco      = 18.5 USD × 179.7       = 3324.45 MXN/pza  (precio en USD: 18.5)
  //    Barra      = 18.5 USD × 368.9       = 6824.65 MXN/pza  (precio en USD: 18.5)
  //    Vehículo   = 1200.00 MXN/jornada
  //    Aerosol    = 100.00 MXN/pza
  //    Operador   = 2700 / 6 = 450 MXN/jornada
  //    Peón       = 1700 / 6 = 283.33 MXN/jornada
  // ──────────────────────────────────────────────
  console.log("📦 Creando productos/insumos...");

  await Promise.all([
    // ── LUBRICANTES ──
    prisma.producto.create({
      data: {
        empresaId: empresa.id,
        nombre: "Neumático (fluido)",
        sku: "LUB-NEU-001",
        categoriaId: catLubricantes.id,
        unidad: "lt",
        precioCompra: 49.79,      // 10355.86 / 208
        moneda: Moneda.MXN,
        stockActual: 0,
        stockMinimo: 20,
      },
    }),
    prisma.producto.create({
      data: {
        empresaId: empresa.id,
        nombre: "Aceite 15W40",
        sku: "LUB-15W40-001",
        categoriaId: catLubricantes.id,
        unidad: "lt",
        precioCompra: 77.92,      // 16206.90 / 208
        moneda: Moneda.MXN,
        stockActual: 0,
        stockMinimo: 20,
      },
    }),
    prisma.producto.create({
      data: {
        empresaId: empresa.id,
        nombre: "Grasa 3.8 lt",
        sku: "LUB-GRS-001",
        categoriaId: catLubricantes.id,
        unidad: "pza",
        precioCompra: 465.51,
        moneda: Moneda.MXN,
        stockActual: 0,
        stockMinimo: 2,
      },
    }),
    prisma.producto.create({
      data: {
        empresaId: empresa.id,
        nombre: "Hdco Track",
        sku: "LUB-HDC-001",
        categoriaId: catLubricantes.id,
        unidad: "lt",
        precioCompra: 71.58,      // 1431.56 / 20
        moneda: Moneda.MXN,
        stockActual: 0,
        stockMinimo: 10,
      },
    }),
    prisma.producto.create({
      data: {
        empresaId: empresa.id,
        nombre: "Anticongelante",
        sku: "LUB-ACG-001",
        categoriaId: catLubricantes.id,
        unidad: "lt",
        precioCompra: 38.06,      // 723.10 / 19
        moneda: Moneda.MXN,
        stockActual: 0,
        stockMinimo: 10,
      },
    }),
    prisma.producto.create({
      data: {
        empresaId: empresa.id,
        nombre: "Aceite 80w90",
        sku: "LUB-80W90-001",
        categoriaId: catLubricantes.id,
        unidad: "lt",
        precioCompra: 62.58,      // 1189.09 / 19
        moneda: Moneda.MXN,
        stockActual: 0,
        stockMinimo: 10,
      },
    }),

    // ── COMBUSTIBLES ──
    prisma.producto.create({
      data: {
        empresaId: empresa.id,
        nombre: "Diésel",
        sku: "COMB-DSL-001",
        categoriaId: catCombustibles.id,
        unidad: "lt",
        precioCompra: 21.95,      // precio promedio observado en el Excel
        moneda: Moneda.MXN,
        stockActual: 0,
        stockMinimo: 100,
      },
    }),
    prisma.producto.create({
      data: {
        empresaId: empresa.id,
        nombre: "Gasolina",
        sku: "COMB-GAS-001",
        categoriaId: catCombustibles.id,
        unidad: "lt",
        precioCompra: 22.5,
        moneda: Moneda.MXN,
        stockActual: 0,
        stockMinimo: 20,
      },
    }),

    // ── HERRAMIENTAS DE PERFORACIÓN (precios en USD, tipo cambio ~18.5) ──
    prisma.producto.create({
      data: {
        empresaId: empresa.id,
        nombre: "Broca X",
        sku: "PERF-BRX-001",
        categoriaId: catHerramientas.id,
        unidad: "pza",
        precioCompra: 278.80,     // USD por pieza
        moneda: Moneda.USD,
        stockActual: 0,
        stockMinimo: 1,
      },
    }),
    prisma.producto.create({
      data: {
        empresaId: empresa.id,
        nombre: "Broca Retráctil",
        sku: "PERF-BRR-001",
        categoriaId: catHerramientas.id,
        unidad: "pza",
        precioCompra: 169.40,     // USD por pieza
        moneda: Moneda.USD,
        stockActual: 0,
        stockMinimo: 1,
      },
    }),
    prisma.producto.create({
      data: {
        empresaId: empresa.id,
        nombre: "Cople",
        sku: "PERF-CPL-001",
        categoriaId: catHerramientas.id,
        unidad: "pza",
        precioCompra: 69.00,      // USD por pieza
        moneda: Moneda.USD,
        stockActual: 0,
        stockMinimo: 2,
      },
    }),
    prisma.producto.create({
      data: {
        empresaId: empresa.id,
        nombre: "Zanco",
        sku: "PERF-ZNC-001",
        categoriaId: catHerramientas.id,
        unidad: "pza",
        precioCompra: 179.70,     // USD por pieza
        moneda: Moneda.USD,
        stockActual: 0,
        stockMinimo: 1,
      },
    }),
    prisma.producto.create({
      data: {
        empresaId: empresa.id,
        nombre: "Barra de Perforación",
        sku: "PERF-BAR-001",
        categoriaId: catHerramientas.id,
        unidad: "pza",
        precioCompra: 368.90,     // USD por pieza
        moneda: Moneda.USD,
        stockActual: 0,
        stockMinimo: 1,
      },
    }),

    // ── MANO DE OBRA ──
    prisma.producto.create({
      data: {
        empresaId: empresa.id,
        nombre: "Operador",
        sku: "MO-OPR-001",
        categoriaId: catManoObra.id,
        unidad: "jornada",
        precioCompra: 450.00,     // 2700 / 6 días
        moneda: Moneda.MXN,
        stockActual: 0,
        stockMinimo: 0,
      },
    }),
    prisma.producto.create({
      data: {
        empresaId: empresa.id,
        nombre: "Peón",
        sku: "MO-PEO-001",
        categoriaId: catManoObra.id,
        unidad: "jornada",
        precioCompra: 283.33,     // 1700 / 6 días
        moneda: Moneda.MXN,
        stockActual: 0,
        stockMinimo: 0,
      },
    }),

    // ── MATERIALES GENERALES ──
    prisma.producto.create({
      data: {
        empresaId: empresa.id,
        nombre: "Vehículo (renta diaria)",
        sku: "MAT-VEH-001",
        categoriaId: catMateriales.id,
        unidad: "jornada",
        precioCompra: 1200.00,
        moneda: Moneda.MXN,
        stockActual: 0,
        stockMinimo: 0,
      },
    }),
    prisma.producto.create({
      data: {
        empresaId: empresa.id,
        nombre: "Aerosol",
        sku: "MAT-AER-001",
        categoriaId: catMateriales.id,
        unidad: "pza",
        precioCompra: 100.00,
        moneda: Moneda.MXN,
        stockActual: 0,
        stockMinimo: 2,
      },
    }),
  ]);

  // ──────────────────────────────────────────────
  //  EQUIPO (PERFORADORA)
  // ──────────────────────────────────────────────
  console.log("⚙️  Creando equipo...");

  await prisma.equipo.create({
    data: {
      empresaId: empresa.id,
      nombre: "Perforadora Principal",
      modelo: "",
      numeroSerie: "",
      numeroEconomico: "EQ-001",
      hodometroInicial: 7662,   // lectura inicial tomada del Excel (h i semana 1)
      activo: true,
      notas: "Equipo principal de perforación. Horómetro inicial: 7662 hrs (Dic 2025)",
    },
  });

  // ──────────────────────────────────────────────
  //  RESUMEN
  // ──────────────────────────────────────────────
  console.log("\n🎉 Seed completado exitosamente:");
  console.log(`   Empresa  : ${empresa.nombre} (url: /${empresa.url})`);
  console.log(`   Usuarios : operador@teprex.com / Operador2024! (OPERADOR)`);
  console.log(`             admin@teprex.com / Admin2024! (ADMIN)`);
  console.log(`   Categorías: 5`);
  console.log(`   Productos : 17 insumos reales del Excel`);
  console.log(`   Equipos   : 1 (Perforadora Principal)`);
  console.log(`   Almacenes : 1 (Almacén General)`);
}

main()
  .catch((e) => {
    console.error("❌ Error en seed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
