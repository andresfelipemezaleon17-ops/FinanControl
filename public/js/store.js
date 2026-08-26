/**
 * FinanControl - Módulo de Estado (Store)
 * 
 * Este archivo manejará los datos y la comunicación con el servidor.
 * Por ahora define la estructura inicial del estado preparado para recibir los movimientos.
 */

export const store = {
  // Arreglos para almacenar los ingresos y gastos financieros
  movements: [],
  expenses: [],

  // Filtros aplicables
  filters: {
    type: 'all', // 'all' | 'income' | 'expense'
    category: 'all',
    searchQuery: '',
    dateFrom: '',
    dateTo: ''
  },

  /**
   * Inicializa la carga de datos (ingresos y gastos) desde la API
   */
  async init() {
    await Promise.all([this.fetchMovements(), this.fetchExpenses()]);
    console.log('📦 Store inicializado correctamente con ingresos y gastos.');
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
          console.log(`📦 Ingresos cargados desde el servidor: ${this.movements.length} registros.`);
          return this.movements;
        }
      }
    } catch (error) {
      console.warn('ℹ️ No se pudieron cargar los ingresos del backend.', error);
    }
    return this.movements;
  },

  /**
   * Consulta el endpoint GET /api/gastos para refrescar la lista local de gastos
   */
  async fetchExpenses() {
    try {
      const response = await fetch('/api/gastos');
      if (response.ok) {
        const result = await response.json();
        if (result.success && Array.isArray(result.data)) {
          this.expenses = result.data;
          console.log(`💸 Gastos cargados desde el servidor: ${this.expenses.length} registros.`);
          return this.expenses;
        }
      }
    } catch (error) {
      console.warn('ℹ️ No se pudieron cargar los gastos del backend.', error);
    }
    return this.expenses;
  },

  /**
   * Envía la solicitud POST al servidor backend para registrar un nuevo ingreso.
   * @param {Object} incomeData - Objeto con concept, amount, date, category y description opcional
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
   * Envía la solicitud POST al servidor backend para registrar un nuevo gasto.
   * @param {Object} expenseData - Objeto con concept, amount, date, category y description opcional
   * @returns {Promise<Object>} Respuesta estructurada { success: boolean, message: string, data?: Object }
   */
  async addExpense(expenseData) {
    try {
      const response = await fetch('/api/gastos', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(expenseData)
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || 'Error al registrar el gasto.');
      }

      // Si se guardó exitosamente en el backend, añadirlo al almacén local
      if (result.success && result.data) {
        this.expenses.push(result.data);
      }

      return result;
    } catch (error) {
      console.error('❌ Error en store.addExpense:', error);
      return {
        success: false,
        message: error.message || 'No se pudo conectar con el servidor.'
      };
    }
  },

  /**
   * Envía la solicitud DELETE al servidor backend para eliminar un ingreso por su ID.
   * @param {string} id - ID del ingreso a eliminar
   * @returns {Promise<Object>} Respuesta estructurada { success: boolean, message: string, data?: Object }
   */
  async deleteIncome(id) {
    try {
      const response = await fetch(`/api/ingresos/${id}`, {
        method: 'DELETE'
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || 'Error al eliminar el ingreso.');
      }

      // Si se eliminó exitosamente en el backend, removerlo del estado local
      if (result.success) {
        this.movements = this.movements.filter(item => item.id !== id);
      }

      return result;
    } catch (error) {
      console.error('❌ Error en store.deleteIncome:', error);
      return {
        success: false,
        message: error.message || 'No se pudo conectar con el servidor.'
      };
    }
  },

  /**
   * Envía la solicitud DELETE al servidor backend para eliminar un gasto por su ID.
   * @param {string} id - ID del gasto a eliminar
   * @returns {Promise<Object>} Respuesta estructurada { success: boolean, message: string, data?: Object }
   */
  async deleteExpense(id) {
    try {
      const response = await fetch(`/api/gastos/${id}`, {
        method: 'DELETE'
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || 'Error al eliminar el gasto.');
      }

      // Si se eliminó exitosamente en el backend, removerlo del estado local
      if (result.success) {
        this.expenses = this.expenses.filter(item => item.id !== id);
      }

      return result;
    } catch (error) {
      console.error('❌ Error en store.deleteExpense:', error);
      return {
        success: false,
        message: error.message || 'No se pudo conectar con el servidor.'
      };
    }
  },

  /**
   * Obtiene todos los ingresos actuales
   */
  getMovements() {
    return this.movements;
  },

  /**
   * Obtiene todos los gastos actuales
   */
  getExpenses() {
    return this.expenses;
  },

  /**
   * Calcula y devuelve la suma total de todos los ingresos registrados
   * @returns {number} Suma acumulada de ingresos
   */
  getTotalAmount() {
    return this.movements.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
  },

  /**
   * Calcula y devuelve la suma total de todos los gastos registrados
   * @returns {number} Suma acumulada de gastos
   */
  getTotalExpensesAmount() {
    return this.expenses.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
  },

  /**
   * Calcula y devuelve la suma de los ingresos correspondientes al mes actual
   * @returns {number} Suma acumulada del mes en curso
   */
  getCurrentMonthAmount() {
    const now = new Date();
    const currentYearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    return this.movements
      .filter(item => item.date && item.date.startsWith(currentYearMonth))
      .reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
  },

  /**
   * Calcula y devuelve el saldo neto disponible (Ingresos Totales - Gastos Totales)
   * @returns {number} Saldo disponible
   */
  getNetBalance() {
    return this.getTotalAmount() - this.getTotalExpensesAmount();
  },

  /**
   * Calcula y devuelve la suma de los gastos correspondientes al mes actual
   * @returns {number} Suma acumulada de gastos del mes en curso
   */
  getCurrentMonthExpensesAmount() {
    const now = new Date();
    const currentYearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    return this.expenses
      .filter(item => item.date && item.date.startsWith(currentYearMonth))
      .reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
  },

  /**
   * Calcula el saldo neto del mes actual (Ingresos del mes - Gastos del mes)
   * @returns {number} Saldo del mes en curso
   */
  getCurrentMonthBalance() {
    return this.getCurrentMonthAmount() - this.getCurrentMonthExpensesAmount();
  },

  /**
   * Devuelve la cantidad total de movimientos de ingreso registrados
   * @returns {number} Total de registros de ingresos
   */
  getMovementsCount() {
    return this.movements.length;
  },

  /**
   * Devuelve la cantidad total de registros de gastos
   * @returns {number} Total de registros de gastos
   */
  getExpensesCount() {
    return this.expenses.length;
  },

  /**
   * Calcula el acumulado de ingresos desglosado por cada categoría válida
   * @returns {Object} Objeto con las categorías y sus valores totales acumulados
   */
  getCategoryTotals() {
    const categories = ['Salario', 'Freelance', 'Ventas', 'Negocio', 'Otros'];
    const totals = {
      'Salario': 0,
      'Freelance': 0,
      'Ventas': 0,
      'Negocio': 0,
      'Otros': 0
    };

    this.movements.forEach(item => {
      if (totals.hasOwnProperty(item.category)) {
        totals[item.category] += Number(item.amount) || 0;
      } else {
        totals['Otros'] += Number(item.amount) || 0;
      }
    });

    return totals;
  },

  /**
   * Obtiene los N movimientos más recientes combinando ingresos y gastos ordenados desc por fecha/registro
   * @param {number} limit - Cantidad máxima de movimientos a retornar
   * @returns {Array} Lista de movimientos combinados
   */
  getRecentAllMovements(limit = 5) {
    const incomes = this.movements.map(item => ({ ...item, type: 'income' }));
    const expenses = this.expenses.map(item => ({ ...item, type: 'expense' }));
    const all = [...incomes, ...expenses];

    // Ordenar por fecha (o createdAt) descendente: los más recientes primero
    all.sort((a, b) => {
      const dateA = a.date || a.createdAt || '';
      const dateB = b.date || b.createdAt || '';
      if (dateA === dateB) {
        const timeA = new Date(a.createdAt || 0).getTime();
        const timeB = new Date(b.createdAt || 0).getTime();
        return timeB - timeA;
      }
      return dateB.localeCompare(dateA);
    });

    return all.slice(0, limit);
  },

  /**
   * Obtiene los N ingresos más recientes ordenados por fecha/registro descendente
   * @param {number} limit - Cantidad máxima de movimientos a retornar
   * @returns {Array} Lista de ingresos recientes
   */
  getRecentMovements(limit = 5) {
    return [...this.movements].reverse().slice(0, limit);
  },

  /**
   * Calcula el acumulado de gastos desglosado por cada categoría de gasto válida
   * @returns {Object} Objeto con las categorías de gastos y sus valores totales acumulados
   */
  getExpenseCategoryTotals() {
    const categories = ['Alimentación', 'Vivienda', 'Transporte', 'Servicios', 'Entretenimiento', 'Educación', 'Salud', 'Otros'];
    const totals = {};
    categories.forEach(cat => { totals[cat] = 0; });

    this.expenses.forEach(item => {
      if (totals.hasOwnProperty(item.category)) {
        totals[item.category] += Number(item.amount) || 0;
      } else {
        totals['Otros'] += Number(item.amount) || 0;
      }
    });

    return totals;
  },

  /**
   * Actualiza el estado de los filtros aplicables
   * @param {Object} newFilters 
   */
  setFilters(newFilters) {
    this.filters = { ...this.filters, ...newFilters };
  },

  /**
   * Resetea todos los filtros al valor por defecto
   */
  resetFilters() {
    this.filters = {
      type: 'all',
      category: 'all',
      searchQuery: '',
      dateFrom: '',
      dateTo: ''
    };
  },

  /**
   * Filtra un arreglo de transacciones según los criterios de búsqueda, categoría y fecha
   * @param {Array} items - Arreglo de movimientos o gastos
   * @returns {Array} Arreglo filtrado
   */
  filterItems(items) {
    const { category, searchQuery, dateFrom, dateTo } = this.filters;
    let result = [...items];

    // 1. Filtrar por búsqueda en concepto y descripción
    if (searchQuery && searchQuery.trim() !== '') {
      const q = searchQuery.trim().toLowerCase();
      result = result.filter(item => {
        const concept = (item.concept || '').toLowerCase();
        const description = (item.description || '').toLowerCase();
        return concept.includes(q) || description.includes(q);
      });
    }

    // 2. Filtrar por categoría
    if (category && category !== 'all') {
      result = result.filter(item => item.category === category);
    }

    // 3. Filtrar por fecha desde (inclusive)
    if (dateFrom) {
      result = result.filter(item => item.date >= dateFrom);
    }

    // 4. Filtrar por fecha hasta (inclusive)
    if (dateTo) {
      result = result.filter(item => item.date <= dateTo);
    }

    return result;
  },

  /**
   * Obtiene los ingresos filtrados
   * @returns {Array} Lista de ingresos filtrados
   */
  getFilteredMovements() {
    return this.filterItems(this.movements);
  },

  /**
   * Obtiene los gastos filtrados
   * @returns {Array} Lista de gastos filtrados
   */
  getFilteredExpenses() {
    return this.filterItems(this.expenses);
  },

  /**
   * Calcula la proporción porcentual acumulada para cada categoría de ingreso
   * @returns {Object} Objeto con nombres de categoría y su porcentaje (0 a 100)
   */
  getCategoryPercentages() {
    const total = this.getTotalAmount();
    const totals = this.getCategoryTotals();
    const percentages = {};

    Object.keys(totals).forEach(cat => {
      percentages[cat] = total > 0 ? Number(((totals[cat] / total) * 100).toFixed(1)) : 0;
    });

    return percentages;
  }
};
