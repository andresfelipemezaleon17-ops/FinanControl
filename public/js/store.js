/**
 * FinanControl - Módulo de Estado (Store)
 * 
 * Este archivo manejará los datos y la comunicación con el servidor.
 * Por ahora define la estructura inicial del estado preparado para recibir los movimientos.
 */

export const store = {
  // Arreglo inicial para almacenar los movimientos financieros
  movements: [],

  // Filtros aplicables
  filters: {
    category: 'all',
    searchQuery: '',
    dateFrom: null,
    dateTo: null
  },

  /**
   * Inicializa la carga de datos (preparado para la API)
   */
  async init() {
    await this.fetchMovements();
    console.log('📦 Store inicializado correctamente.');
  },

  /**
   * Consulta el endpoint GET /api/ingresos para refrescar la lista local de movimientos
   */
  async fetchMovements() {
    try {
      const response = await fetch('/api/ingresos');
      if (response.ok) {
        const result = await response.json();
        if (result.success && Array.isArray(result.data)) {
          this.movements = result.data;
          console.log(`📦 Movimientos cargados desde el servidor: ${this.movements.length} registros.`);
          return this.movements;
        }
      }
    } catch (error) {
      console.warn('ℹ️ No se pudieron cargar los ingresos iniciales del backend.', error);
    }
    return this.movements;
  },

  /**
   * Envía la solicitud POST al servidor backend para registrar un nuevo ingreso.
   * @param {Object} incomeData - Objeto con description, amount, date, category
   * @returns {Promise<Object>} Respuesta estructurada { success: boolean, message: string, data?: Object }
   */
  async addIncome(incomeData) {
    try {
      const response = await fetch('/api/ingresos', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(incomeData)
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || 'Error al comunicarse con el servidor.');
      }

      // Si se guardó exitosamente en el backend, añadirlo al almacén local
      if (result.success && result.data) {
        this.movements.push(result.data);
      }

      return result;
    } catch (error) {
      console.error('❌ Error en store.addIncome:', error);
      return {
        success: false,
        message: error.message || 'No se pudo conectar con el servidor.'
      };
    }
  },

  /**
   * Obtiene todos los movimientos actuales
   */
  getMovements() {
    return this.movements;
  },

  /**
   * Calcula y devuelve la suma total de todos los ingresos registrados
   * @returns {number} Suma acumulada de ingresos
   */
  getTotalAmount() {
    return this.movements.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
  }
};
