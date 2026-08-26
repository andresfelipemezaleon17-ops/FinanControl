/**
 * FinanControl - Punto de Entrada de la Aplicación Frontend
 */

import { store } from './store.js';

document.addEventListener('DOMContentLoaded', async () => {
  console.log('⚡ FinanControl Frontend iniciado correctamente');
  
  // 1. Inicializar almacén de datos (carga ingresos y gastos iniciales via REST API)
  await store.init();

  // 2. Verificación básica del estado del servidor API
  try {
    const response = await fetch('/api/health');
    if (response.ok) {
      const data = await response.json();
      console.log('✅ Conexión con el servidor backend establecida:', data.message);
    }
  } catch (error) {
    console.warn('ℹ️ Servidor ejecutándose en modo estático o backend aún no iniciado.');
  }

  // 3. Inicializar la funcionalidad de los formularios de registro (ingresos y gastos)
  initIncomeForm();
  initExpenseForm();

  // 4. Renderizar listas iniciales y el Dashboard
  renderMovementsList();
  renderExpensesList();
  renderDashboard();

  // 5. Prevenir recargas de página en el enlace de la marca
  const brandLink = document.getElementById('brand-link');
  if (brandLink) {
    brandLink.addEventListener('click', (e) => e.preventDefault());
  }

  // 6. Inicializar escuchadores para eliminación de ingresos y gastos
  initDeleteListeners();

  // 7. Inicializar escuchadores para búsqueda y filtros
  initFilterEvents();
});

/**
 * Renderiza la lista de ingresos en la tabla, actualiza el resumen total y gestiona el estado vacío
 */
function renderMovementsList() {
  const movementsModule = document.querySelector('.movements-module');
  const typeFilter = store.filters.type;

  // Si el filtro es solo de gastos, ocultar la sección de ingresos
  if (typeFilter === 'expense') {
    if (movementsModule) movementsModule.style.display = 'none';
    return;
  } else {
    if (movementsModule) movementsModule.style.display = 'block';
  }

  const movements = store.getFilteredMovements();
  const totalAmount = movements.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);

  const totalElem = document.getElementById('total-income-amount');
  const countBadge = document.getElementById('movements-count-badge');
  const emptyState = document.getElementById('empty-movements');
  const tableWrapper = document.getElementById('movements-table-wrapper');
  const tableBody = document.getElementById('movements-list-body');

  // Actualizar Resumen de Totales
  if (totalElem) {
    totalElem.textContent = formatCurrency(totalAmount);
  }
  if (countBadge) {
    countBadge.textContent = `${movements.length} ${movements.length === 1 ? 'registro' : 'registros'}`;
  }

  // Controlar visibilidad de Estado Vacío vs Tabla
  if (!movements || movements.length === 0) {
    if (emptyState) {
      const hasActiveFilters = store.filters.searchQuery || store.filters.category !== 'all' || store.filters.dateFrom || store.filters.dateTo || store.filters.type !== 'all';
      const titleElem = emptyState.querySelector('.empty-title');
      const descElem = emptyState.querySelector('.empty-desc');

      if (titleElem) titleElem.textContent = hasActiveFilters ? 'No se encontraron ingresos con los filtros aplicados' : 'No hay ingresos registrados aún';
      if (descElem) descElem.textContent = hasActiveFilters ? 'Prueba ajustando o limpiando los criterios de búsqueda y filtros.' : 'Utiliza el formulario superior para registrar tu primer ingreso en FinanControl.';

      emptyState.classList.remove('hidden');
    }
    if (tableWrapper) tableWrapper.classList.add('hidden');
    if (tableBody) tableBody.innerHTML = '';
    return;
  }

  if (emptyState) emptyState.classList.add('hidden');
  if (tableWrapper) tableWrapper.classList.remove('hidden');

  // Renderizar Filas de la Tabla (orden descendente: más recientes primero)
  const sortedMovements = [...movements].sort((a, b) => {
    const dateA = a.date || a.createdAt || '';
    const dateB = b.date || b.createdAt || '';
    if (dateA === dateB) {
      return (new Date(b.createdAt || 0).getTime()) - (new Date(a.createdAt || 0).getTime());
    }
    return dateB.localeCompare(dateA);
  });

  if (tableBody) {
    tableBody.innerHTML = sortedMovements.map(item => {
      const displayConcept = item.concept || item.description || 'Ingreso sin concepto';
      const hasSeparateDescription = item.description && item.concept && item.description.trim() !== item.concept.trim();
      
      return `
        <tr>
          <td>${formatDate(item.date)}</td>
          <td>
            <div class="movement-concept">${escapeHtml(displayConcept)}</div>
            ${hasSeparateDescription ? `<div class="movement-description-subtext">${escapeHtml(item.description)}</div>` : ''}
          </td>
          <td>
            <span class="badge-category">
              ${getCategoryIcon(item.category)} ${escapeHtml(item.category)}
            </span>
          </td>
          <td class="text-right amount-positive">
            +${formatCurrency(item.amount)}
          </td>
          <td class="text-center">
            <button type="button" class="btn-delete" data-id="${item.id}" data-type="income" title="Eliminar ingreso">
              🗑️ Eliminar
            </button>
          </td>
        </tr>
      `;
    }).join('');
  }
}

/**
 * Inicializa los eventos y la lógica del formulario de registro de ingresos
 */
function initIncomeForm() {
  const form = document.getElementById('income-form');
  const alertBox = document.getElementById('form-alert');
  const dateInput = document.getElementById('income-date');
  const btnSubmit = document.getElementById('btn-submit');

  if (!form) return;

  // Establecer la fecha actual por defecto
  setTodayAsDefaultDate(dateInput);

  // Escuchar el evento de envío del formulario de forma asíncrona y segura
  form.addEventListener('submit', async (event) => {
    // PREVENIR SIEMPRE la recarga por defecto del navegador
    event.preventDefault();
    event.stopPropagation();

    // 1. Limpiar estados de error previos
    clearFormErrors();
    hideAlert(alertBox);

    // 2. Obtener los valores de los campos
    const conceptElem = document.getElementById('income-concept');
    const concept = conceptElem ? conceptElem.value.trim() : '';
    
    const amountValue = document.getElementById('income-amount').value;
    const amount = parseFloat(amountValue);
    
    const date = dateInput.value;
    const category = document.getElementById('income-category').value;
    
    const descElem = document.getElementById('income-description');
    const description = descElem ? descElem.value.trim() : '';

    // 3. Validar los campos en el cliente (concepto, valor, categoría, fecha son obligatorios; valor > 0)
    const isValid = validateIncomeForm({ concept, amount, amountValue, date, category });

    if (!isValid) {
      showAlert(alertBox, 'Por favor, completa correctamente todos los campos obligatorios.', 'danger');
      return;
    }

    // 4. Deshabilitar botón durante la petición para evitar envíos dobles
    setButtonLoading(btnSubmit, true);

    try {
      // 5. Enviar los datos al backend mediante REST API (POST /api/ingresos)
      const response = await store.addIncome({
        concept,
        description,
        amount,
        date,
        category
      });

      // 6. Procesar la respuesta del servidor
      if (response.success) {
        showAlert(alertBox, `✅ ${response.message || 'Ingreso registrado correctamente.'}`, 'success');
        
        // Limpiar el formulario y reestablecer la fecha de hoy
        form.reset();
        setTodayAsDefaultDate(dateInput);

        // Volver a consultar la API mediante GET /api/ingresos y actualizar la lista y dashboard en tiempo real
        await store.fetchMovements();
        renderMovementsList();
        renderDashboard();
      } else {
        showAlert(alertBox, `❌ ${response.message || 'No se pudo guardar el ingreso.'}`, 'danger');
      }
    } catch (error) {
      console.error('❌ Error inesperado al procesar el formulario:', error);
      showAlert(alertBox, '❌ Ocurrió un error inesperado al procesar la solicitud.', 'danger');
    } finally {
      setButtonLoading(btnSubmit, false);
    }
  });
}

/**
 * Inicializa los eventos y la lógica del formulario de registro de gastos
 */
function initExpenseForm() {
  const form = document.getElementById('expense-form');
  const alertBox = document.getElementById('expense-form-alert');
  const dateInput = document.getElementById('expense-date');
  const btnSubmit = document.getElementById('btn-submit-expense');

  if (!form) return;

  // Establecer la fecha actual por defecto
  setTodayAsDefaultDate(dateInput);

  // Escuchar el evento de envío del formulario de gastos
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    event.stopPropagation();

    // 1. Limpiar estados de error previos
    clearFormErrors();
    hideAlert(alertBox);

    // 2. Obtener los valores del formulario
    const conceptElem = document.getElementById('expense-concept');
    const concept = conceptElem ? conceptElem.value.trim() : '';

    const amountValue = document.getElementById('expense-amount').value;
    const amount = parseFloat(amountValue);

    const date = dateInput.value;
    const category = document.getElementById('expense-category').value;

    const descElem = document.getElementById('expense-description');
    const description = descElem ? descElem.value.trim() : '';

    // 3. Validar los campos en el cliente
    const isValid = validateExpenseForm({ concept, amount, amountValue, date, category });

    if (!isValid) {
      showAlert(alertBox, 'Por favor, completa correctamente todos los campos obligatorios.', 'danger');
      return;
    }

    // 4. Deshabilitar botón durante la petición
    setButtonLoading(btnSubmit, true);

    try {
      // 5. Enviar los datos al backend mediante REST API (POST /api/gastos)
      const response = await store.addExpense({
        concept,
        description,
        amount,
        date,
        category
      });

      // 6. Procesar la respuesta del servidor
      if (response.success) {
        showAlert(alertBox, `✅ ${response.message || 'Gasto registrado correctamente.'}`, 'success');
        
        // Limpiar el formulario y reestablecer la fecha de hoy
        form.reset();
        setTodayAsDefaultDate(dateInput);

        // Volver a consultar la API mediante GET /api/gastos y actualizar la lista
        await store.fetchExpenses();
        renderExpensesList();
        renderDashboard();
      } else {
        showAlert(alertBox, `❌ ${response.message || 'No se pudo guardar el gasto.'}`, 'danger');
      }
    } catch (error) {
      console.error('❌ Error inesperado al procesar el formulario de gastos:', error);
      showAlert(alertBox, '❌ Ocurrió un error inesperado al procesar la solicitud.', 'danger');
    } finally {
      setButtonLoading(btnSubmit, false);
    }
  });
}

/**
 * Renderiza la lista de gastos registrados en la tabla y actualiza el resumen del módulo de gastos
 */
function renderExpensesList() {
  const expensesModule = document.querySelector('.expenses-module');
  const typeFilter = store.filters.type;

  // Si el filtro es solo de ingresos, ocultar la sección de gastos
  if (typeFilter === 'income') {
    if (expensesModule) expensesModule.style.display = 'none';
    return;
  } else {
    if (expensesModule) expensesModule.style.display = 'block';
  }

  const expenses = store.getFilteredExpenses();
  const totalAmount = expenses.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);

  const totalElem = document.getElementById('total-expense-amount');
  const countBadge = document.getElementById('expenses-count-badge');
  const emptyState = document.getElementById('empty-expenses');
  const tableWrapper = document.getElementById('expenses-table-wrapper');
  const tableBody = document.getElementById('expenses-list-body');

  // Actualizar Resumen de Totales de Gastos
  if (totalElem) {
    totalElem.textContent = '-' + formatCurrency(totalAmount);
  }
  if (countBadge) {
    countBadge.textContent = `${expenses.length} ${expenses.length === 1 ? 'registro' : 'registros'}`;
  }

  // Controlar visibilidad de Estado Vacío vs Tabla
  if (!expenses || expenses.length === 0) {
    if (emptyState) {
      const hasActiveFilters = store.filters.searchQuery || store.filters.category !== 'all' || store.filters.dateFrom || store.filters.dateTo || store.filters.type !== 'all';
      const titleElem = emptyState.querySelector('.empty-title');
      const descElem = emptyState.querySelector('.empty-desc');

      if (titleElem) titleElem.textContent = hasActiveFilters ? 'No se encontraron gastos con los filtros aplicados' : 'No hay gastos registrados aún';
      if (descElem) descElem.textContent = hasActiveFilters ? 'Prueba ajustando o limpiando los criterios de búsqueda y filtros.' : 'Utiliza el formulario superior para registrar tu primer gasto en FinanControl.';

      emptyState.classList.remove('hidden');
    }
    if (tableWrapper) tableWrapper.classList.add('hidden');
    if (tableBody) tableBody.innerHTML = '';
    return;
  }

  if (emptyState) emptyState.classList.add('hidden');
  if (tableWrapper) tableWrapper.classList.remove('hidden');

  // Renderizar Filas de la Tabla (orden descendente: más recientes primero)
  const sortedExpenses = [...expenses].sort((a, b) => {
    const dateA = a.date || a.createdAt || '';
    const dateB = b.date || b.createdAt || '';
    if (dateA === dateB) {
      return (new Date(b.createdAt || 0).getTime()) - (new Date(a.createdAt || 0).getTime());
    }
    return dateB.localeCompare(dateA);
  });

  if (tableBody) {
    tableBody.innerHTML = sortedExpenses.map(item => {
      const displayConcept = item.concept || item.description || 'Gasto sin concepto';
      const hasSeparateDescription = item.description && item.concept && item.description.trim() !== item.concept.trim();
      
      return `
        <tr>
          <td>${formatDate(item.date)}</td>
          <td>
            <div class="movement-concept">${escapeHtml(displayConcept)}</div>
            ${hasSeparateDescription ? `<div class="movement-description-subtext">${escapeHtml(item.description)}</div>` : ''}
          </td>
          <td>
            <span class="badge-category">
              ${getCategoryIcon(item.category)} ${escapeHtml(item.category)}
            </span>
          </td>
          <td class="text-right amount-negative">
            -${formatCurrency(item.amount)}
          </td>
          <td class="text-center">
            <button type="button" class="btn-delete" data-id="${item.id}" data-type="expense" title="Eliminar gasto">
              🗑️ Eliminar
            </button>
          </td>
        </tr>
      `;
    }).join('');
  }
}

/**
 * Inicializa la delegación de eventos para los botones de eliminación en las tablas
 */
function initDeleteListeners() {
  document.addEventListener('click', async (event) => {
    const deleteBtn = event.target.closest('.btn-delete');
    if (!deleteBtn) return;

    const id = deleteBtn.dataset.id;
    const type = deleteBtn.dataset.type;

    if (id && type) {
      await handleDeleteMovement(id, type, deleteBtn);
    }
  });
}

/**
 * Maneja la confirmación y proceso de eliminación de un ingreso o gasto
 * @param {string} id - ID del movimiento
 * @param {string} type - 'income' o 'expense'
 * @param {HTMLElement} button - Botón de eliminación presionado
 */
async function handleDeleteMovement(id, type, button) {
  const isIncome = type === 'income';
  const label = isIncome ? 'este ingreso' : 'este gasto';
  const alertBox = isIncome ? document.getElementById('form-alert') : document.getElementById('expense-form-alert');

  const confirmDelete = window.confirm(`¿Estás seguro de que deseas eliminar ${label}? Esta acción no se puede deshacer.`);
  if (!confirmDelete) return;

  if (button) button.disabled = true;

  try {
    const response = isIncome ? await store.deleteIncome(id) : await store.deleteExpense(id);

    if (response.success) {
      showAlert(alertBox, `✅ ${response.message || 'Registro eliminado correctamente.'}`, 'success');

      // Actualizar automáticamente ambas listas y el Dashboard completo
      renderMovementsList();
      renderExpensesList();
      renderDashboard();
    } else {
      showAlert(alertBox, `❌ ${response.message || 'No se pudo eliminar el registro.'}`, 'danger');
    }
  } catch (error) {
    console.error(`❌ Error al eliminar ${label}:`, error);
    showAlert(alertBox, '❌ Ocurrió un error inesperado al intentar eliminar el registro.', 'danger');
  }
}

/**
 * Asigna la fecha actual (YYYY-MM-DD) al campo de fecha
 */
function setTodayAsDefaultDate(dateInput) {
  if (dateInput) {
    const today = new Date().toISOString().split('T')[0];
    dateInput.value = today;
  }
}

/**
 * Valida los datos del formulario de ingresos en el cliente
 */
function validateIncomeForm({ concept, amount, amountValue, date, category }) {
  let valid = true;

  if (!concept) {
    showFieldError('income-concept', 'error-concept');
    valid = false;
  }

  if (!amountValue || isNaN(amount) || amount <= 0) {
    showFieldError('income-amount', 'error-amount');
    valid = false;
  }

  if (!date || isNaN(Date.parse(date))) {
    showFieldError('income-date', 'error-date');
    valid = false;
  }

  if (!category) {
    showFieldError('income-category', 'error-category');
    valid = false;
  }

  return valid;
}

/**
 * Valida los datos del formulario de gastos en el cliente
 */
function validateExpenseForm({ concept, amount, amountValue, date, category }) {
  let valid = true;

  if (!concept) {
    showFieldError('expense-concept', 'error-expense-concept');
    valid = false;
  }

  if (!amountValue || isNaN(amount) || amount <= 0) {
    showFieldError('expense-amount', 'error-expense-amount');
    valid = false;
  }

  if (!date || isNaN(Date.parse(date))) {
    showFieldError('expense-date', 'error-expense-date');
    valid = false;
  }

  if (!category) {
    showFieldError('expense-category', 'error-expense-category');
    valid = false;
  }

  return valid;
}

/**
 * Muestra el mensaje de error de un campo específico
 */
function showFieldError(inputId, errorTextId) {
  const inputElem = document.getElementById(inputId);
  const errorElem = document.getElementById(errorTextId);

  if (inputElem) inputElem.classList.add('has-error');
  if (errorElem) errorElem.classList.remove('hidden');
}

/**
 * Limpia todos los errores visuales del formulario
 */
function clearFormErrors() {
  const inputs = document.querySelectorAll('.form-control');
  inputs.forEach(input => input.classList.remove('has-error'));

  const errorTexts = document.querySelectorAll('.error-text');
  errorTexts.forEach(text => text.classList.add('hidden'));
}

/**
 * Muestra una alerta informativa (éxito o error)
 */
function showAlert(alertElem, message, type) {
  if (!alertElem) return;
  alertElem.textContent = message;
  alertElem.className = `alert alert-${type}`;
  alertElem.classList.remove('hidden');
}

/**
 * Oculta la caja de alerta
 */
function hideAlert(alertElem) {
  if (!alertElem) return;
  alertElem.classList.add('hidden');
}

/**
 * Cambia el estado visual del botón de envío durante la petición
 */
function setButtonLoading(button, isLoading) {
  if (!button) return;
  
  if (isLoading) {
    button.disabled = true;
    button.dataset.originalText = button.innerHTML;
    button.innerHTML = '<span>⏳ Guardando...</span>';
  } else {
    button.disabled = false;
    if (button.dataset.originalText) {
      button.innerHTML = button.dataset.originalText;
    }
  }
}

/**
 * Formatea un número como moneda ($1,500.00)
 */
function formatCurrency(amount) {
  const num = Number(amount) || 0;
  return '$' + num.toLocaleString('es-CO', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

/**
 * Formatea una cadena de fecha YYYY-MM-DD a formato legible (ej. 17 ago 2026)
 */
function formatDate(dateString) {
  if (!dateString) return '-';
  const parts = dateString.split('-');
  if (parts.length === 3) {
    const year = parts[0];
    const monthIndex = parseInt(parts[1], 10) - 1;
    const day = parts[2];
    const months = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
    return `${day} ${months[monthIndex] || ''} ${year}`;
  }
  return dateString;
}

/**
 * Devuelve un icono representativo para cada categoría
 */
function getCategoryIcon(category) {
  const icons = {
    // Categorías de Ingresos
    'Salario': '💼',
    'Freelance': '💻',
    'Ventas': '🛒',
    'Negocio': '🏢',
    // Categorías de Gastos
    'Alimentación': '🍕',
    'Vivienda': '🏠',
    'Transporte': '🚌',
    'Servicios': '💡',
    'Entretenimiento': '🎬',
    'Educación': '📚',
    'Salud': '🏥',
    'Otros': '📦'
  };
  return icons[category] || '🏷️';
}

/**
 * Escapa caracteres HTML para evitar XSS
 */
function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

/**
 * Renderiza los elementos del Dashboard "Resumen financiero":
 * - Tarjeta: Ingresos totales
 * - Tarjeta: Ingresos del mes actual
 * - Tarjeta: Cantidad de movimientos
 * - Resumen y gráfico visual por categorías
 */
function renderDashboard() {
  const totalIncome = store.getTotalAmount();
  const totalExpenses = store.getTotalExpensesAmount();
  const availableBalance = store.getNetBalance();

  const monthIncome = store.getCurrentMonthAmount();
  const monthExpenses = store.getCurrentMonthExpensesAmount();
  const monthBalance = store.getCurrentMonthBalance();

  const categoryTotals = store.getCategoryTotals();
  const expenseCategoryTotals = store.getExpenseCategoryTotals();

  // 1. Indicadores Principales del Dashboard
  const totalIncomeElem = document.getElementById('dashboard-total-income');
  if (totalIncomeElem) totalIncomeElem.textContent = formatCurrency(totalIncome);

  const totalExpensesElem = document.getElementById('dashboard-total-expenses');
  if (totalExpensesElem) totalExpensesElem.textContent = '-' + formatCurrency(totalExpenses);

  const availableBalanceElem = document.getElementById('dashboard-available-balance');
  if (availableBalanceElem) {
    const formattedBalance = (availableBalance < 0 ? '-' : '') + formatCurrency(Math.abs(availableBalance));
    availableBalanceElem.textContent = formattedBalance;
    if (availableBalance < 0) {
      availableBalanceElem.classList.add('amount-negative');
    } else {
      availableBalanceElem.classList.remove('amount-negative');
    }
  }

  // 2. Resumen del Mes Actual
  const monthIncomeElem = document.getElementById('dashboard-month-income');
  if (monthIncomeElem) monthIncomeElem.textContent = formatCurrency(monthIncome);

  const monthExpensesElem = document.getElementById('dashboard-month-expenses');
  if (monthExpensesElem) monthExpensesElem.textContent = '-' + formatCurrency(monthExpenses);

  const monthBalanceElem = document.getElementById('dashboard-month-balance');
  if (monthBalanceElem) {
    monthBalanceElem.textContent = (monthBalance < 0 ? '-' : '') + formatCurrency(Math.abs(monthBalance));
    if (monthBalance < 0) {
      monthBalanceElem.classList.add('amount-negative');
    } else {
      monthBalanceElem.classList.remove('amount-negative');
    }
  }

  // 3. Renderizar Gráfico Comparativo Ingresos vs Gastos
  renderComparisonChart(totalIncome, totalExpenses);

  // 4. Actualizar Resumen Visual por Categoría de Ingreso (Barras + Porcentajes)
  const categoryListElem = document.getElementById('category-summary-list');
  if (categoryListElem) {
    const categories = ['Salario', 'Freelance', 'Ventas', 'Negocio', 'Otros'];

    categoryListElem.innerHTML = categories.map(cat => {
      const amount = categoryTotals[cat] || 0;
      const percentageNum = totalIncome > 0 ? (amount / totalIncome) * 100 : 0;
      const percentage = percentageNum.toFixed(1);
      const icon = getCategoryIcon(cat);

      return `
        <div class="category-item-card">
          <div class="category-item-header">
            <div class="category-item-title">
              <span class="category-item-icon">${icon}</span>
              <span class="category-item-name">${escapeHtml(cat)}</span>
            </div>
            <span class="category-item-badge">${percentage}%</span>
          </div>
          <div class="category-item-amount">${formatCurrency(amount)}</div>
          <div class="category-progress-track">
            <div 
              class="category-progress-bar bar-${cat.toLowerCase()}" 
              style="width: ${Math.min(percentageNum, 100)}%"
              aria-valuenow="${percentage}"
              aria-valuemin="0"
              aria-valuemax="100"
            ></div>
          </div>
        </div>
      `;
    }).join('');
  }

  // 5. Actualizar Resumen Visual por Categoría de Gasto (Barras + Porcentajes)
  const expenseListElem = document.getElementById('expense-category-summary-list');
  if (expenseListElem) {
    const expenseCategories = ['Alimentación', 'Vivienda', 'Transporte', 'Servicios', 'Entretenimiento', 'Educación', 'Salud', 'Otros'];

    expenseListElem.innerHTML = expenseCategories.map(cat => {
      const amount = expenseCategoryTotals[cat] || 0;
      const percentageNum = totalExpenses > 0 ? (amount / totalExpenses) * 100 : 0;
      const percentage = percentageNum.toFixed(1);
      const icon = getCategoryIcon(cat);

      return `
        <div class="category-item-card">
          <div class="category-item-header">
            <div class="category-item-title">
              <span class="category-item-icon">${icon}</span>
              <span class="category-item-name">${escapeHtml(cat)}</span>
            </div>
            <span class="category-item-badge">${percentage}%</span>
          </div>
          <div class="category-item-amount amount-negative">-${formatCurrency(amount)}</div>
          <div class="category-progress-track">
            <div 
              class="category-progress-bar bar-${cat.toLowerCase()}" 
              style="width: ${Math.min(percentageNum, 100)}%"
              aria-valuenow="${percentage}"
              aria-valuemin="0"
              aria-valuemax="100"
            ></div>
          </div>
        </div>
      `;
    }).join('');
  }

  // 6. Renderizar Gráficos Donut SVG (Ingresos y Gastos por Categoría)
  renderIncomeChart(totalIncome, categoryTotals);
  renderExpenseChart(totalExpenses, expenseCategoryTotals);

  // 7. Renderizar Lista de Movimientos Recientes (Combinando Ingresos y Gastos)
  renderRecentDashboardMovements();
}

/**
 * Genera y renderiza una tarjeta visual comparativa entre Ingresos Totales y Gastos Totales
 */
function renderComparisonChart(totalIncome, totalExpenses) {
  const container = document.getElementById('comparison-chart-container');
  if (!container) return;

  const maxVal = Math.max(totalIncome, totalExpenses, 1);
  const incomePct = Math.min((totalIncome / maxVal) * 100, 100).toFixed(1);
  const expensePct = Math.min((totalExpenses / maxVal) * 100, 100).toFixed(1);
  
  const netBalance = totalIncome - totalExpenses;
  const savingsRate = totalIncome > 0 ? ((netBalance / totalIncome) * 100).toFixed(1) : '0.0';

  container.innerHTML = `
    <div class="comparison-bar-group">
      <div class="comparison-bar-header">
        <span>💰 Ingresos Totales</span>
        <span>${formatCurrency(totalIncome)}</span>
      </div>
      <div class="comparison-bar-track">
        <div class="comparison-bar-fill-income" style="width: ${incomePct}%"></div>
      </div>
    </div>

    <div class="comparison-bar-group">
      <div class="comparison-bar-header">
        <span>💸 Gastos Totales</span>
        <span style="color: #f87171;">-${formatCurrency(totalExpenses)}</span>
      </div>
      <div class="comparison-bar-track">
        <div class="comparison-bar-fill-expense" style="width: ${expensePct}%"></div>
      </div>
    </div>

    <div class="comparison-summary-box">
      <div class="comparison-savings-rate">
        <span>Margen Neto Disponible</span>
        <div style="font-size: 1.15rem; font-weight: 700; color: ${netBalance >= 0 ? '#34d399' : '#f87171'};">
          ${netBalance < 0 ? '-' : ''}${formatCurrency(Math.abs(netBalance))}
        </div>
      </div>
      <div class="comparison-savings-badge" style="${netBalance < 0 ? 'background-color: rgba(239, 68, 68, 0.15); color: #f87171; border-color: rgba(239, 68, 68, 0.3);' : ''}">
        ${savingsRate}% ${netBalance >= 0 ? 'Disponible' : 'Déficit'}
      </div>
    </div>
  `;
}

/**
 * Genera y renderiza una gráfica circular de Donut SVG interactiva para la distribución de ingresos
 */
function renderIncomeChart(totalIncome, categoryTotals) {
  const chartContainer = document.getElementById('income-chart-container');
  if (!chartContainer) return;

  const categories = [
    { name: 'Salario', color: '#3b82f6' },
    { name: 'Freelance', color: '#10b981' },
    { name: 'Ventas', color: '#f59e0b' },
    { name: 'Negocio', color: '#8b5cf6' },
    { name: 'Otros', color: '#06b6d4' }
  ];

  if (totalIncome <= 0) {
    chartContainer.innerHTML = `
      <div class="donut-chart-container">
        <svg class="donut-chart-svg" viewBox="0 0 200 200">
          <circle cx="100" cy="100" r="75" fill="none" stroke="rgba(255, 255, 255, 0.08)" stroke-width="18" />
        </svg>
        <div class="donut-center-info">
          <div class="donut-center-label">Total Ingresos</div>
          <div class="donut-center-value">$0.00</div>
        </div>
      </div>
      <div class="chart-legend-grid">
        <span class="legend-item" style="color: var(--text-muted);">Sin ingresos registrados aún</span>
      </div>
    `;
    return;
  }

  // Cálculo de segmentos para el SVG Donut Chart
  const radius = 75;
  const circumference = 2 * Math.PI * radius;
  let accumulatedOffset = 0;

  const svgSegments = categories.map(catObj => {
    const amount = categoryTotals[catObj.name] || 0;
    if (amount <= 0) return '';

    const ratio = amount / totalIncome;
    const dashLength = ratio * circumference;
    const strokeDasharray = `${dashLength} ${circumference - dashLength}`;
    const strokeDashoffset = -accumulatedOffset;
    accumulatedOffset += dashLength;

    return `
      <circle 
        class="donut-segment" 
        cx="100" 
        cy="100" 
        r="${radius}" 
        fill="none" 
        stroke="${catObj.color}" 
        stroke-width="18" 
        stroke-dasharray="${strokeDasharray}" 
        stroke-dashoffset="${strokeDashoffset}"
      >
        <title>${catObj.name}: ${formatCurrency(amount)} (${(ratio * 100).toFixed(1)}%)</title>
      </circle>
    `;
  }).join('');

  const legendItems = categories.map(catObj => {
    const amount = categoryTotals[catObj.name] || 0;
    const percentage = totalIncome > 0 ? ((amount / totalIncome) * 100).toFixed(1) : '0.0';
    return `
      <div class="legend-item">
        <span class="legend-color-dot" style="background-color: ${catObj.color};"></span>
        <span>${escapeHtml(catObj.name)}: <strong>${percentage}%</strong></span>
      </div>
    `;
  }).join('');

  chartContainer.innerHTML = `
    <div class="donut-chart-container">
      <svg class="donut-chart-svg" viewBox="0 0 200 200">
        <circle cx="100" cy="100" r="${radius}" fill="none" stroke="rgba(255, 255, 255, 0.05)" stroke-width="18" />
        ${svgSegments}
      </svg>
      <div class="donut-center-info">
        <div class="donut-center-label">Ingresos</div>
        <div class="donut-center-value">${formatCurrency(totalIncome)}</div>
      </div>
    </div>
    <div class="chart-legend-grid">
      ${legendItems}
    </div>
  `;
}

/**
 * Genera y renderiza una gráfica circular de Donut SVG interactiva para la distribución de gastos
 */
function renderExpenseChart(totalExpenses, expenseCategoryTotals) {
  const chartContainer = document.getElementById('expense-chart-container');
  if (!chartContainer) return;

  const categories = [
    { name: 'Alimentación', color: '#f59e0b' },
    { name: 'Vivienda', color: '#8b5cf6' },
    { name: 'Transporte', color: '#06b6d4' },
    { name: 'Servicios', color: '#ec4899' },
    { name: 'Entretenimiento', color: '#3b82f6' },
    { name: 'Educación', color: '#10b981' },
    { name: 'Salud', color: '#ef4444' },
    { name: 'Otros', color: '#64748b' }
  ];

  if (totalExpenses <= 0) {
    chartContainer.innerHTML = `
      <div class="donut-chart-container">
        <svg class="donut-chart-svg" viewBox="0 0 200 200">
          <circle cx="100" cy="100" r="75" fill="none" stroke="rgba(255, 255, 255, 0.08)" stroke-width="18" />
        </svg>
        <div class="donut-center-info">
          <div class="donut-center-label">Total Gastos</div>
          <div class="donut-center-value">$0.00</div>
        </div>
      </div>
      <div class="chart-legend-grid">
        <span class="legend-item" style="color: var(--text-muted);">Sin gastos registrados aún</span>
      </div>
    `;
    return;
  }

  // Cálculo de segmentos para el SVG Donut Chart
  const radius = 75;
  const circumference = 2 * Math.PI * radius;
  let accumulatedOffset = 0;

  const svgSegments = categories.map(catObj => {
    const amount = expenseCategoryTotals[catObj.name] || 0;
    if (amount <= 0) return '';

    const ratio = amount / totalExpenses;
    const dashLength = ratio * circumference;
    const strokeDasharray = `${dashLength} ${circumference - dashLength}`;
    const strokeDashoffset = -accumulatedOffset;
    accumulatedOffset += dashLength;

    return `
      <circle 
        class="donut-segment" 
        cx="100" 
        cy="100" 
        r="${radius}" 
        fill="none" 
        stroke="${catObj.color}" 
        stroke-width="18" 
        stroke-dasharray="${strokeDasharray}" 
        stroke-dashoffset="${strokeDashoffset}"
      >
        <title>${catObj.name}: ${formatCurrency(amount)} (${(ratio * 100).toFixed(1)}%)</title>
      </circle>
    `;
  }).join('');

  const legendItems = categories.map(catObj => {
    const amount = expenseCategoryTotals[catObj.name] || 0;
    const percentage = totalExpenses > 0 ? ((amount / totalExpenses) * 100).toFixed(1) : '0.0';
    return `
      <div class="legend-item">
        <span class="legend-color-dot" style="background-color: ${catObj.color};"></span>
        <span>${escapeHtml(catObj.name)}: <strong>${percentage}%</strong></span>
      </div>
    `;
  }).join('');

  chartContainer.innerHTML = `
    <div class="donut-chart-container">
      <svg class="donut-chart-svg" viewBox="0 0 200 200">
        <circle cx="100" cy="100" r="${radius}" fill="none" stroke="rgba(255, 255, 255, 0.05)" stroke-width="18" />
        ${svgSegments}
      </svg>
      <div class="donut-center-info">
        <div class="donut-center-label">Gastos</div>
        <div class="donut-center-value">-${formatCurrency(totalExpenses)}</div>
      </div>
    </div>
    <div class="chart-legend-grid">
      ${legendItems}
    </div>
  `;
}

/**
 * Renderiza la lista compacta de movimientos recientes (combina Ingresos y Gastos) dentro del Dashboard
 */
function renderRecentDashboardMovements() {
  const container = document.getElementById('recent-movements-container');
  if (!container) return;

  const recentMovements = store.getRecentAllMovements(5);

  if (!recentMovements || recentMovements.length === 0) {
    container.innerHTML = `
      <div class="empty-state" style="padding: 1.5rem 1rem;">
        <p class="empty-desc">No hay movimientos recientes (ingresos ni gastos) registrados.</p>
      </div>
    `;
    return;
  }

  container.innerHTML = `
    <div class="recent-movements-list">
      ${recentMovements.map(item => {
        const isIncome = item.type === 'income';
        const displayConcept = item.concept || item.description || (isIncome ? 'Ingreso sin concepto' : 'Gasto sin concepto');
        const icon = getCategoryIcon(item.category);
        const amountClass = isIncome ? 'amount-positive' : 'amount-negative';
        const amountSign = isIncome ? '+' : '-';
        const typeLabel = isIncome ? 'Ingreso' : 'Gasto';
        
        return `
          <div class="recent-movement-item">
            <div class="recent-movement-left">
              <div class="recent-movement-icon">${icon}</div>
              <div class="recent-movement-details">
                <span class="recent-movement-title">${escapeHtml(displayConcept)}</span>
                <div class="recent-movement-meta">
                  <span>${formatDate(item.date)}</span>
                  <span>•</span>
                  <span>${escapeHtml(item.category)}</span>
                  <span>•</span>
                  <span style="font-weight: 600; color: ${isIncome ? '#34d399' : '#f87171'};">${typeLabel}</span>
                </div>
              </div>
            </div>
            <div class="recent-movement-amount ${amountClass}">${amountSign}${formatCurrency(item.amount)}</div>
          </div>
        `;
      }).join('')}
    </div>
  `;
}

/**
 * Inicializa los escuchadores de eventos para los filtros y el campo de búsqueda
 */
function initFilterEvents() {
  const searchInput = document.getElementById('filter-search');
  const typeSelect = document.getElementById('filter-type');
  const categorySelect = document.getElementById('filter-category');
  const dateFromInput = document.getElementById('filter-date-from');
  const dateToInput = document.getElementById('filter-date-to');
  const btnReset = document.getElementById('btn-reset-filters');

  // Cargar categorías iniciales en el selector
  updateCategoryFilterOptions('all');

  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      store.setFilters({ searchQuery: e.target.value });
      applyFilters();
    });
  }

  if (typeSelect) {
    typeSelect.addEventListener('change', (e) => {
      const type = e.target.value;
      store.setFilters({ type, category: 'all' });
      updateCategoryFilterOptions(type);
      applyFilters();
    });
  }

  if (categorySelect) {
    categorySelect.addEventListener('change', (e) => {
      store.setFilters({ category: e.target.value });
      applyFilters();
    });
  }

  if (dateFromInput) {
    dateFromInput.addEventListener('change', (e) => {
      store.setFilters({ dateFrom: e.target.value });
      applyFilters();
    });
  }

  if (dateToInput) {
    dateToInput.addEventListener('change', (e) => {
      store.setFilters({ dateTo: e.target.value });
      applyFilters();
    });
  }

  if (btnReset) {
    btnReset.addEventListener('click', () => {
      store.resetFilters();
      if (searchInput) searchInput.value = '';
      if (typeSelect) typeSelect.value = 'all';
      if (dateFromInput) dateFromInput.value = '';
      if (dateToInput) dateToInput.value = '';
      updateCategoryFilterOptions('all');
      applyFilters();
    });
  }
}

/**
 * Actualiza las opciones del selector de categoría según el tipo seleccionado
 */
function updateCategoryFilterOptions(type) {
  const categorySelect = document.getElementById('filter-category');
  if (!categorySelect) return;

  const incomeCategories = ['Salario', 'Freelance', 'Ventas', 'Negocio', 'Otros'];
  const expenseCategories = ['Alimentación', 'Vivienda', 'Transporte', 'Servicios', 'Entretenimiento', 'Educación', 'Salud', 'Otros'];

  if (type === 'income') {
    categorySelect.innerHTML = `
      <option value="all">Todas las categorías de ingreso</option>
      ${incomeCategories.map(cat => `<option value="${cat}">${getCategoryIcon(cat)} ${cat}</option>`).join('')}
    `;
  } else if (type === 'expense') {
    categorySelect.innerHTML = `
      <option value="all">Todas las categorías de gasto</option>
      ${expenseCategories.map(cat => `<option value="${cat}">${getCategoryIcon(cat)} ${cat}</option>`).join('')}
    `;
  } else {
    categorySelect.innerHTML = `
      <option value="all">Todas las categorías</option>
      <optgroup label="💵 Categorías de Ingreso">
        ${incomeCategories.map(cat => `<option value="${cat}">${getCategoryIcon(cat)} ${cat}</option>`).join('')}
      </optgroup>
      <optgroup label="💸 Categorías de Gasto">
        ${expenseCategories.map(cat => `<option value="${cat}">${getCategoryIcon(cat)} ${cat}</option>`).join('')}
      </optgroup>
    `;
  }

  categorySelect.value = store.filters.category;
}

/**
 * Aplica los filtros actuales renderizando las tablas de movimientos y gastos
 */
function applyFilters() {
  renderMovementsList();
  renderExpensesList();
}


