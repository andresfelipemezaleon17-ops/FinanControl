import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

// Obtener la ruta del directorio actual usando ES Modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Configuración de rutas para la persistencia de datos (data/db.json)
const DATA_DIR = path.join(__dirname, '../data');
const DB_PATH = path.join(DATA_DIR, 'db.json');

/**
 * Garantiza la existencia del directorio data y el archivo db.json
 */
const ensureDbFileExists = () => {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    if (!fs.existsSync(DB_PATH)) {
      const initialData = { ingresos: [], gastos: [] };
      fs.writeFileSync(DB_PATH, JSON.stringify(initialData, null, 2), 'utf-8');
    }
  } catch (error) {
    console.error('❌ Error al crear/verificar el archivo db.json:', error);
  }
};

/**
 * Lee los datos almacenados en db.json
 * @returns {{ ingresos: Array, gastos: Array }}
 */
const readDb = () => {
  ensureDbFileExists();
  try {
    const fileContent = fs.readFileSync(DB_PATH, 'utf-8');
    const parsed = JSON.parse(fileContent);
    return {
      ingresos: Array.isArray(parsed.ingresos) ? parsed.ingresos : [],
      gastos: Array.isArray(parsed.gastos) ? parsed.gastos : []
    };
  } catch (error) {
    console.error('❌ Error al leer db.json:', error);
    return { ingresos: [], gastos: [] };
  }
};

/**
 * Guarda el estado actual de ingresos y gastos en db.json
 * @param {{ ingresos: Array, gastos: Array }} data
 * @returns {boolean}
 */
const saveDb = (data) => {
  ensureDbFileExists();
  try {
    fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2), 'utf-8');
    return true;
  } catch (error) {
    console.error('❌ Error al escribir en db.json:', error);
    return false;
  }
};

// Middlewares
app.use(cors());
app.use(express.json());

// Servir archivos estáticos del frontend (carpeta public)
app.use(express.static(path.join(__dirname, '../public')));

// Categorías válidas permitidas
const CATEGORIAS_VALIDAS = ['Salario', 'Freelance', 'Ventas', 'Negocio', 'Otros'];
const CATEGORIAS_GASTOS_VALIDAS = ['Alimentación', 'Vivienda', 'Transporte', 'Servicios', 'Entretenimiento', 'Educación', 'Salud', 'Otros'];

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
  const dbData = readDb();
  res.json({
    success: true,
    data: dbData.ingresos
  });
});

/**
 * REST API: Registrar un nuevo ingreso
 * POST /api/ingresos
 */
app.post('/api/ingresos', (req, res) => {
  const { concept, description, amount, date, category } = req.body;

  // 1. Validar que el concepto del ingreso no esté vacío (o description si viene en formato antiguo)
  const finalConcept = (concept || description || '').toString().trim();
  if (!finalConcept) {
    return res.status(400).json({
      success: false,
      message: 'El concepto del ingreso es obligatorio y no debe estar vacío.'
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

  // Descripción opcional
  const optionalDescription = description && typeof description === 'string' ? description.trim() : '';

  // Crear nuevo registro de ingreso
  const nuevoIngreso = {
    id: Date.now().toString(),
    concept: finalConcept,
    description: optionalDescription,
    amount: numericAmount,
    date,
    category,
    createdAt: new Date().toISOString()
  };

  // Leer estado actual de db.json, agregar nuevo ingreso y guardar
  const dbData = readDb();
  dbData.ingresos.push(nuevoIngreso);
  saveDb(dbData);

  console.log('✅ Nuevo ingreso registrado en backend y guardado en db.json:', nuevoIngreso);

  return res.status(201).json({
    success: true,
    message: 'Ingreso registrado correctamente.',
    data: nuevoIngreso
  });
});

/**
 * REST API: Obtener todos los gastos registrados
 * GET /api/gastos
 */
app.get('/api/gastos', (req, res) => {
  const dbData = readDb();
  res.json({
    success: true,
    data: dbData.gastos
  });
});

/**
 * REST API: Registrar un nuevo gasto
 * POST /api/gastos
 */
app.post('/api/gastos', (req, res) => {
  const { concept, description, amount, date, category } = req.body;

  // 1. Validar que el concepto del gasto no esté vacío
  const finalConcept = (concept || description || '').toString().trim();
  if (!finalConcept) {
    return res.status(400).json({
      success: false,
      message: 'El concepto del gasto es obligatorio y no debe estar vacío.'
    });
  }

  // 2. Validar que el valor sea un número mayor que 0
  const numericAmount = Number(amount);
  if (isNaN(numericAmount) || numericAmount <= 0) {
    return res.status(400).json({
      success: false,
      message: 'El valor del gasto debe ser un número mayor que 0.'
    });
  }

  // 3. Validar que la fecha sea válida
  if (!date || isNaN(Date.parse(date))) {
    return res.status(400).json({
      success: false,
      message: 'La fecha proporcionada no es válida.'
    });
  }

  // 4. Validar que la categoría de gasto sea válida
  if (!category || !CATEGORIAS_GASTOS_VALIDAS.includes(category)) {
    return res.status(400).json({
      success: false,
      message: `La categoría seleccionada no es válida. Las opciones son: ${CATEGORIAS_GASTOS_VALIDAS.join(', ')}.`
    });
  }

  // Descripción opcional
  const optionalDescription = description && typeof description === 'string' ? description.trim() : '';

  // Crear nuevo registro de gasto
  const nuevoGasto = {
    id: Date.now().toString(),
    concept: finalConcept,
    description: optionalDescription,
    amount: numericAmount,
    date,
    category,
    createdAt: new Date().toISOString()
  };

  // Leer estado actual de db.json, agregar nuevo gasto y guardar
  const dbData = readDb();
  dbData.gastos.push(nuevoGasto);
  saveDb(dbData);

  console.log('💸 Nuevo gasto registrado en backend y guardado en db.json:', nuevoGasto);

  return res.status(201).json({
    success: true,
    message: 'Gasto registrado correctamente.',
    data: nuevoGasto
  });
});

/**
 * REST API: Eliminar un ingreso por ID
 * DELETE /api/ingresos/:id
 */
app.delete('/api/ingresos/:id', (req, res) => {
  const { id } = req.params;
  const dbData = readDb();

  const index = dbData.ingresos.findIndex(item => item.id === id);
  if (index === -1) {
    return res.status(404).json({
      success: false,
      message: 'No se encontró el ingreso con el ID proporcionado.'
    });
  }

  const [deletedIncome] = dbData.ingresos.splice(index, 1);
  saveDb(dbData);

  console.log('🗑️ Ingreso eliminado del backend:', deletedIncome);

  return res.json({
    success: true,
    message: 'Ingreso eliminado correctamente.',
    data: deletedIncome
  });
});

/**
 * REST API: Eliminar un gasto por ID
 * DELETE /api/gastos/:id
 */
app.delete('/api/gastos/:id', (req, res) => {
  const { id } = req.params;
  const dbData = readDb();

  const index = dbData.gastos.findIndex(item => item.id === id);
  if (index === -1) {
    return res.status(404).json({
      success: false,
      message: 'No se encontró el gasto con el ID proporcionado.'
    });
  }

  const [deletedExpense] = dbData.gastos.splice(index, 1);
  saveDb(dbData);

  console.log('🗑️ Gasto eliminado del backend:', deletedExpense);

  return res.json({
    success: true,
    message: 'Gasto eliminado correctamente.',
    data: deletedExpense
  });
});

// Iniciar servidor
app.listen(PORT, () => {
  console.log(`🚀 Servidor ejecutándose en http://localhost:${PORT}`);
});
