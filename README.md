# SaaS de Inventarios

Sistema completo de gestión de inventarios SaaS multiempresa (multi-tenant) moderno y escalable.

## 🚀 Arquitectura
- **Frontend**: Next.js 14 (App Router), React, Tailwind CSS. Funciona como cliente independiente.
- **Backend**: Node.js, Express, TypeScript, Prisma (ORM). Arquitectura en capas.
- **Base de Datos**: PostgreSQL. Aislamiento multi-tenant mediante `empresaId`.

## 📦 Lógica del Inventario (Kardex)
El stock es **100% inmutable** y se calcula dinámicamente sumando (Entradas, Ajustes Positivos) y restando (Salidas, Ajustes Negativos) desde la tabla `MovimientoInventario`. No existen campos de "stock" directamente editables.

## 🛠️ Cómo ejecutar localmente

### 1. Requisitos
- Node.js (v18+)
- PostgreSQL ejecutándose localmente o en la nube (Neon, Supabase).

### 2. Base de Datos & Backend
1. Navega a `cd backend`
2. Instala dependencias: `npm install`
3. Configura el archivo `.env`:
   ```env
   DATABASE_URL="postgresql://usuario:clave@localhost:5432/inventory_saas?schema=public"
   PORT=4000
   JWT_SECRET="super-secret-key-change-me"
   ```
4. Aplica las migraciones: `npx prisma db push` o `npx prisma migrate dev`
5. Ejecuta el servidor: `npm run dev`

### 3. Frontend
1. Navega a `cd frontend`
2. Instala dependencias: `npm install`
3. Ejecuta Next.js: `npm run dev`
4. Abre `http://localhost:3000` en tu navegador.

## ☁️ Instrucciones de Despliegue

### Backend (Railway / Vercel)
- Crea un proyecto en Railway.
- Añade un plugin de PostgreSQL.
- Conecta tu repositorio de GitHub.
- Railway detectará `package.json` e instalará/ejecutará todo.
- Añade la variable `DATABASE_URL` y `JWT_SECRET`.
- Configura un "Build Command" personalizado (opcional): `npx prisma generate && npm run build`.
- "Start Command": `npm start`.

### Frontend (Vercel)
- En Vercel, crea "New Project" e importa el repositorio.
- Selecciona el Root Directory como `frontend`.
- Vercel configurará automáticamente los build settings de Next.js.
- Añade `NEXT_PUBLIC_API_URL=https://tu-backend.up.railway.app/api`. (Debes configurar axios para usar esta URL base en las peticiones cliente).

## 🗺️ Roadmap de Desarrollo Futuro
1. [ ] Implementación de roles granulares (RBAC en frontend y backend).
2. [ ] Sistema de reportes exportables a PDF y Excel (ExcelJS/Puppeteer).
3. [ ] Escaneo de código de barras para entradas y salidas.
4. [ ] Sistema de facturación integrado y conexión a APIs tributarias locales.
5. [ ] **Arquitectura para escalar a miles de empresas**: 
   - Transicionar de esquema aislado por fila (Shared Database, Shared Schema) a **Schema-per-Tenant** utilizando el soporte multitenant de PostgreSQL si la aplicación crece drásticamente.
   - Implementar caché distribuida en Redis para aligerar o parcializar el recálculo dinámico del Kardex en bases de datos con millones de registros.
   - Microservicios de reportes separados del API principal para evitar lock-ups de recursos.
