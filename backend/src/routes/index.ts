import { Router } from 'express';
import { login, register } from '../controllers/auth.controller';
import { getProducts, createProduct, getProductById, updateProduct, deleteProduct } from '../controllers/product.controller';
import { getProveedores, createProveedor, updateProveedor, deleteProveedor, getProveedorStats } from '../controllers/supplier.controller';
import { getClientes, createCliente, updateCliente, deleteCliente, getClienteStats } from '../controllers/client.controller';
import { registrarCompra, getCompras } from '../controllers/purchase.controller';
import { registrarSalida, getSalidas } from '../controllers/sales.controller';
import { getKardex, getProductoStock, registerMovement, getAllMovements } from '../controllers/inventory.controller';
import { authenticate } from '../middlewares/auth';
import { requireTenant } from '../middlewares/tenant';

import { getCompanyBySlug, updateCompany, getMyCompany } from '../controllers/company.controller';
import { getAlmacenes, createAlmacen, updateAlmacen, deleteAlmacen } from '../controllers/warehouse.controller';
import { getCategorias, createCategoria, updateCategoria, deleteCategoria } from '../controllers/category.controller';

const router = Router();

// Public Settings route
router.get('/company/:slug', getCompanyBySlug);

// Auth Routes
router.post('/auth/register', register);
router.post('/auth/login', login);

// Protected routes context
router.use(authenticate, requireTenant);

// Company settings
router.get('/company', getMyCompany);
router.put('/company', updateCompany);

// Products
router.get('/products', getProducts);
router.post('/products', createProduct);
router.get('/products/:id', getProductById);
router.put('/products/:id', updateProduct);
router.delete('/products/:id', deleteProduct);

// Suppliers
router.get('/suppliers', getProveedores);
router.get('/suppliers/:id/stats', getProveedorStats);
router.post('/suppliers', createProveedor);
router.put('/suppliers/:id', updateProveedor);
router.delete('/suppliers/:id', deleteProveedor);

// Clients
router.get('/clients', getClientes);
router.get('/clients/:id/stats', getClienteStats);
router.post('/clients', createCliente);
router.put('/clients/:id', updateCliente);
router.delete('/clients/:id', deleteCliente);

// Purchases (Entradas)
router.get('/purchases', getCompras);
router.post('/purchases', registrarCompra);

// Sales (Salidas)
router.get('/sales', getSalidas);
router.post('/sales', registrarSalida);

// Inventory & Kardex
router.get('/inventory/stock/:productoId', getProductoStock);
router.get('/inventory/kardex/:productoId', getKardex);
router.get('/inventory/movements', getAllMovements);
router.post('/inventory/movements', registerMovement);

// Warehouse (Almacenes)
router.get('/warehouse', getAlmacenes);
router.post('/warehouse', createAlmacen);
router.put('/warehouse/:id', updateAlmacen);
router.delete('/warehouse/:id', deleteAlmacen);

// Categories
router.get('/categories', getCategorias);
router.post('/categories', createCategoria);
router.put('/categories/:id', updateCategoria);
router.delete('/categories/:id', deleteCategoria);

export default router;
