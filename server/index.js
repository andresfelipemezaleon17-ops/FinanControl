import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { MongoClient } from 'mongodb';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  console.error('❌ No se encontró MONGODB_URI en el archivo .env');
  process.exit(1);
}

// Conexión a MongoDB
const client = new MongoClient(MONGODB_URI, {
  tls: true,
  tlsAllowInvalidCertificates: false
});

let db;
let ingresosCollection;
let gastosCollection;

// Categorías válidas
const CATEGORIAS_VALIDAS = [
  'Salario',
  'Freelance',
  'Ventas',
  'Negocio',
  'Otros'
];

const CATEGORIAS_GASTOS_VALIDAS = [
  'Alimentación',
  'Vivienda',
  'Transporte',
  'Servicios',
  'Entretenimiento',
  'Educación',
  'Salud',
  'Otros'
];

// Middlewares
app.use(cors());
app.use(express.json());

// Servir frontend
app.use(express.static(path.join(__dirname, '../public')));

// ================================
// SALUD DEL SERVIDOR
// ================================

app.get('/api/health', async (req, res) => {
  try {
    await db.command({ ping: 1 });

    res.json({
      status: 'ok',
      message: 'Servidor de FinanControl funcionando correctamente',
      database: 'MongoDB conectado'
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'MongoDB no está conectado'
    });
  }
});

// ================================
// INGRESOS
// ================================

// Obtener ingresos
app.get('/api/ingresos', async (req, res) => {
  try {
    const ingresos = await ingresosCollection
      .find({})
      .sort({ createdAt: -1 })
      .toArray();

    res.json({
      success: true,
      data: ingresos
    });
  } catch (error) {
    console.error('❌ Error obteniendo ingresos:', error);

    res.status(500).json({
      success: false,
      message: 'Error al obtener los ingresos'
    });
  }
});

// Registrar ingreso
app.post('/api/ingresos', async (req, res) => {
  try {
    const {
      concept,
      description,
      amount,
      date,
      category
    } = req.body;

    const finalConcept = (concept || description || '')
      .toString()
      .trim();

    // Validar concepto
    if (!finalConcept) {
      return res.status(400).json({
        success: false,
        message: 'El concepto del ingreso es obligatorio.'
      });
    }

    // Validar monto
    const numericAmount = Number(amount);

    if (isNaN(numericAmount) || numericAmount <= 0) {
      return res.status(400).json({
        success: false,
        message: 'El valor del ingreso debe ser mayor que 0.'
      });
    }

    // Validar fecha
    if (!date || isNaN(Date.parse(date))) {
      return res.status(400).json({
        success: false,
        message: 'La fecha proporcionada no es válida.'
      });
    }

    // Validar categoría
    if (!category || !CATEGORIAS_VALIDAS.includes(category)) {
      return res.status(400).json({
        success: false,
        message: 'La categoría del ingreso no es válida.'
      });
    }

    const nuevoIngreso = {
      id: Date.now().toString(),
      concept: finalConcept,
      description:
        typeof description === 'string'
          ? description.trim()
          : '',
      amount: numericAmount,
      date,
      category,
      createdAt: new Date()
    };

    await ingresosCollection.insertOne(nuevoIngreso);

    console.log(
      '✅ Nuevo ingreso guardado en MongoDB:',
      nuevoIngreso
    );

    res.status(201).json({
      success: true,
      message: 'Ingreso registrado correctamente.',
      data: nuevoIngreso
    });

  } catch (error) {
    console.error('❌ Error guardando ingreso:', error);

    res.status(500).json({
      success: false,
      message: 'Error al guardar el ingreso en MongoDB.'
    });
  }
});

// Eliminar ingreso
app.delete('/api/ingresos/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const ingreso = await ingresosCollection.findOne({
      id
    });

    if (!ingreso) {
      return res.status(404).json({
        success: false,
        message: 'No se encontró el ingreso.'
      });
    }

    await ingresosCollection.deleteOne({
      id
    });

    console.log(
      '🗑️ Ingreso eliminado de MongoDB:',
      ingreso
    );

    res.json({
      success: true,
      message: 'Ingreso eliminado correctamente.',
      data: ingreso
    });

  } catch (error) {
    console.error('❌ Error eliminando ingreso:', error);

    res.status(500).json({
      success: false,
      message: 'Error al eliminar el ingreso.'
    });
  }
});

// ================================
// GASTOS
// ================================

// Obtener gastos
app.get('/api/gastos', async (req, res) => {
  try {
    const gastos = await gastosCollection
      .find({})
      .sort({ createdAt: -1 })
      .toArray();

    res.json({
      success: true,
      data: gastos
    });

  } catch (error) {
    console.error('❌ Error obteniendo gastos:', error);

    res.status(500).json({
      success: false,
      message: 'Error al obtener los gastos'
    });
  }
});

// Registrar gasto
app.post('/api/gastos', async (req, res) => {
  try {
    const {
      concept,
      description,
      amount,
      date,
      category
    } = req.body;

    const finalConcept = (concept || description || '')
      .toString()
      .trim();

    // Validar concepto
    if (!finalConcept) {
      return res.status(400).json({
        success: false,
        message: 'El concepto del gasto es obligatorio.'
      });
    }

    // Validar monto
    const numericAmount = Number(amount);

    if (isNaN(numericAmount) || numericAmount <= 0) {
      return res.status(400).json({
        success: false,
        message: 'El valor del gasto debe ser mayor que 0.'
      });
    }

    // Validar fecha
    if (!date || isNaN(Date.parse(date))) {
      return res.status(400).json({
        success: false,
        message: 'La fecha proporcionada no es válida.'
      });
    }

    // Validar categoría
    if (
      !category ||
      !CATEGORIAS_GASTOS_VALIDAS.includes(category)
    ) {
      return res.status(400).json({
        success: false,
        message: 'La categoría del gasto no es válida.'
      });
    }

    const nuevoGasto = {
      id: Date.now().toString(),
      concept: finalConcept,
      description:
        typeof description === 'string'
          ? description.trim()
          : '',
      amount: numericAmount,
      date,
      category,
      createdAt: new Date()
    };

    await gastosCollection.insertOne(nuevoGasto);

    console.log(
      '💸 Nuevo gasto guardado en MongoDB:',
      nuevoGasto
    );

    res.status(201).json({
      success: true,
      message: 'Gasto registrado correctamente.',
      data: nuevoGasto
    });

  } catch (error) {
    console.error('❌ Error guardando gasto:', error);

    res.status(500).json({
      success: false,
      message: 'Error al guardar el gasto en MongoDB.'
    });
  }
});

// Eliminar gasto
app.delete('/api/gastos/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const gasto = await gastosCollection.findOne({
      id
    });

    if (!gasto) {
      return res.status(404).json({
        success: false,
        message: 'No se encontró el gasto.'
      });
    }

    await gastosCollection.deleteOne({
      id
    });

    console.log(
      '🗑️ Gasto eliminado de MongoDB:',
      gasto
    );

    res.json({
      success: true,
      message: 'Gasto eliminado correctamente.',
      data: gasto
    });

  } catch (error) {
    console.error('❌ Error eliminando gasto:', error);

    res.status(500).json({
      success: false,
      message: 'Error al eliminar el gasto.'
    });
  }
});

// ================================
// CONECTAR MONGODB Y ARRANCAR
// ================================

async function startServer() {
  try {
    console.log('🔄 Conectando a MongoDB Atlas...');

    await client.connect();

    db = client.db('financontrol');

    ingresosCollection = db.collection('ingresos');
    gastosCollection = db.collection('gastos');

    await db.command({ ping: 1 });

    console.log('✅ MongoDB Atlas conectado correctamente');
    console.log('📊 Base de datos: financontrol');

    app.listen(PORT, () => {
      console.log(
        `🚀 Servidor ejecutándose en http://localhost:${PORT}`
      );
    });

  } catch (error) {
    console.error('❌ Error conectando a MongoDB Atlas:');
    console.error(error);

    process.exit(1);
  }
}

startServer();