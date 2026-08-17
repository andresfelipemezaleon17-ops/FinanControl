/**
 * FinanControl - Punto de Entrada de la Aplicación Frontend
 */

import { store } from './store.js';

document.addEventListener('DOMContentLoaded', async () => {
  console.log('⚡ FinanControl Frontend iniciado correctamente');
  
  // 1. Inicializar almacén de datos (carga movimientos iniciales via GET /api/ingresos)
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

  // 3. Inicializar la funcionalidad del formulario de registro de ingresos
  initIncomeForm();

  // 4. Renderizar la lista de movimientos inicial
  renderMovementsList();

  // 5. Prevenir recargas de página en el enlace de la marca
  const brandLink = document.getElementById('brand-link');
  if (brandLink) {
    brandLink.addEventListener('click', (e) => e.preventDefault());
  }
});

/**
 * Renderiza la lista de ingresos en la tabla, actualiza el resumen total y gestiona el estado vacío
 */
function renderMovementsList() {
  const movements = store.getMovements();
  const totalAmount = store.getTotalAmount();

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
    if (emptyState) emptyState.classList.remove('hidden');
    if (tableWrapper) tableWrapper.classList.add('hidden');
    if (tableBody) tableBody.innerHTML = '';
    return;
  }

  if (emptyState) emptyState.classList.add('hidden');
  if (tableWrapper) tableWrapper.classList.remove('hidden');

  // Renderizar Filas de la Tabla (orden descendente: más recientes primero)
  const sortedMovements = [...movements].reverse();

  if (tableBody) {
    tableBody.innerHTML = sortedMovements.map(item => `
      <tr>
        <td>${formatDate(item.date)}</td>
        <td><strong>${escapeHtml(item.description)}</strong></td>
        <td>
          <span class="badge-category">
            ${getCategoryIcon(item.category)} ${escapeHtml(item.category)}
          </span>
        </td>
        <td class="text-right amount-positive">
          +${formatCurrency(item.amount)}
        </td>
      </tr>
    `).join('');
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
    const description = document.getElementById('income-description').value.trim();
    const amountValue = document.getElementById('income-amount').value;
    const amount = parseFloat(amountValue);
    const date = dateInput.value;
    const category = document.getElementById('income-category').value;

    // 3. Validar los campos en el cliente
    const isValid = validateIncomeForm({ description, amount, amountValue, date, category });

    if (!isValid) {
      showAlert(alertBox, 'Por favor, completa correctamente todos los campos obligatorios.', 'danger');
      return;
    }

    // 4. Deshabilitar botón durante la petición para evitar envíos dobles
    setButtonLoading(btnSubmit, true);

    try {
      // 5. Enviar los datos al backend mediante REST API (POST /api/ingresos)
      const response = await store.addIncome({
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

        // Volver a consultar la API mediante GET /api/ingresos y actualizar la lista en tiempo real
        await store.fetchMovements();
        renderMovementsList();
      } else {
        showAlert(alertBox, `❌ ${response.message || 'No se pudo guardar el ingreso.'}`, 'danger');
      }
    } catch (error) {
      console.error('❌ Error insospechado al procesar el formulario:', error);
      showAlert(alertBox, '❌ Ocurrió un error inesperado al procesar la solicitud.', 'danger');
    } finally {
      setButtonLoading(btnSubmit, false);
    }
  });
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
 * Valida los datos del formulario en el cliente
 */
function validateIncomeForm({ description, amount, amountValue, date, category }) {
  let valid = true;

  if (!description) {
    showFieldError('income-description', 'error-description');
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
    'Salario': '💼',
    'Freelance': '💻',
    'Ventas': '🛒',
    'Negocio': '🏢',
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
