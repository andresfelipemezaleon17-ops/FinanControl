import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';

// Obtener la ruta del directorio actual usando ES Modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Middlewares
app.use(cors());
app.use(express.json());

// Servir archivos estáticos del frontend (carpeta public)
app.use(express.static(path.join(__dirname, '../public')));

// Base de datos temporal en memoria para desarrollo por etapas
const ingresos = [];

// Categorías válidas permitidas
const CATEGORIAS_VALIDAS = ['Salario', 'Freelance', 'Ventas', 'Negocio', 'Otros'];

// Ruta básica de salud / API preliminar
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    message: 'Servidor de FinanControl funcionando correctamente'
  });
});

/**
 * REST API: Obtener todos los ingresos registrados
 * GET /api/ingresos
 */
app.get('/api/ingresos', (req, res) => {
  res.json({
    success: true,
    data: ingresos
  });
});

/**
 * REST API: Registrar un nuevo ingreso
 * POST /api/ingresos
 */
app.post('/api/ingresos', (req, res) => {
  const { description, amount, date, category } = req.body;

  // 1. Validar que la descripción no esté vacía
  if (!description || typeof description !== 'string' || description.trim() === '') {
    return res.status(400).json({
      success: false,
      message: 'La descripción del ingreso es obligatoria y no debe estar vacía.'
    });
  }

  // 2. Validar que el valor sea un número mayor que 0
  const numericAmount = Number(amount);
  if (isNaN(numericAmount) || numericAmount <= 0) {
    return res.status(400).json({
      success: false,
      message: 'El valor del ingreso debe ser un número mayor que 0.'
    });
  }

  // 3. Validar que la fecha sea válida
  if (!date || isNaN(Date.parse(date))) {
    return res.status(400).json({
      success: false,
      message: 'La fecha proporcionada no es válida.'
    });
  }

  // 4. Validar que la categoría sea válida
  if (!category || !CATEGORIAS_VALIDAS.includes(category)) {
    return res.status(400).json({
      success: false,
      message: `La categoría seleccionada no es válida. Las opciones son: ${CATEGORIAS_VALIDAS.join(', ')}.`
    });
  }

  // Crear nuevo registro de ingreso
  const nuevoIngreso = {
    id: Date.now().toString(),
    description: description.trim(),
    amount: numericAmount,
    date,
    category,
    createdAt: new Date().toISOString()
  };

  // Guardar en memoria
  ingresos.push(nuevoIngreso);

  console.log('✅ Nuevo ingreso registrado en backend:', nuevoIngreso);

  return res.status(201).json({
    success: true,
    message: 'Ingreso registrado correctamente.',
    data: nuevoIngreso
  });
});

// Iniciar servidor
app.listen(PORT, () => {
  console.log(`🚀 Servidor ejecutándose en http://localhost:${PORT}`);
});
