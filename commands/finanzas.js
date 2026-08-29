const {
  addGastoHormiga,
  getFinanzasData,
  resolveFinanceUser,
  registerFinanceUser,
  loginFinanceUser,
  normalizeMonth,
  markAccountPaid,
  updateFinanceSalary,
  createFinanceLoan,
  addFinanceLoanPayment,
  updateFinanceLoan,
  deleteFinanceLoan
} = require('../services/finanzasService');

function money(value) {
  return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(Number(value) || 0);
}

function monthLabel(month) {
  const [number, year] = month.split('-');
  return `${number}/${year}`;
}

function usage() {
  return `💰 *CENTRO DE FINANZAS PERSONALES* 💰\n` +
    `━━━━━━━━━━━━━━━━━━━━\n\n` +
    `🔐 *ACCESO Y CUENTA*\n` +
    `• *#finanzas register usuario contraseña*\n` +
    `  Crea una cuenta y vincula este número de WhatsApp.\n` +
    `  Ejemplo: #finanzas register juan clave123\n\n` +
    `• *#finanzas login usuario contraseña*\n` +
    `  Inicia sesión y vincula este número a tu cuenta.\n` +
    `  Ejemplo: #finanzas login juan clave123\n\n` +
    `📊 *CONSULTAS Y RESUMEN*\n` +
    `• *#finanzas resumen*\n` +
    `  Total del mes, cuentas pagadas, gastos hormiga y sueldo.\n\n` +
    `• *#finanzas resumen 08-2026*\n` +
    `  Consulta un mes específico. También acepta 2026-08.\n\n` +
    `• *#finanzas gastos [mes]*\n` +
    `  Lista tus gastos hormiga y calcula el total del mes.\n\n` +
    `• *#finanzas cuentas*\n` +
    `  Muestra tus cuentas, montos y estado actual.\n\n` +
    `🧾 *PAGOS*\n` +
    `• *#finanzas pagos [mes]*\n` +
    `  Indica qué cuentas están pagadas y cuáles siguen pendientes.\n\n` +
    `• *#finanzas pagar "Alquiler" [mes]*\n` +
    `  Marca una cuenta como pagada.\n` +
    `  Ejemplo: #finanzas pagar "Alquiler" 08-2026\n\n` +
    `🐜 *GASTOS HORMIGA*\n` +
    `• *#finanzas gastohormiga monto "descripción"*\n` +
    `  Registra un gasto con la fecha actual.\n` +
    `  Ejemplo: #finanzas gastohormiga 150000 "compras epic"\n\n` +
    `🤝 *PRÉSTAMOS*\n` +
    `• *#finanzas prestamos*\n` +
    `  Consulta montos, cuotas, vencimientos y estado.\n\n` +
    `• *#finanzas prestamo nuevo "Juan" 100000 0 2026-12-31 1*\n` +
    `  Registra un préstamo: persona, monto, interés, vencimiento y cuotas.\n\n` +
    `• *#finanzas prestamo cuota "Juan"*\n` +
    `  Registra una cuota pagada.\n\n` +
    `• *#finanzas prestamo editar "Juan" monto 120000*\n` +
    `  Edita nombre, monto, intereses, vencimiento, cuotas o pagadas.\n\n` +
    `• *#finanzas prestamo eliminar "Juan"*\n` +
    `  Elimina un préstamo registrado.\n\n` +
    `💼 *SUELDO Y COMPARATIVA*\n` +
    `• *#finanzas sueldo 2500000*\n` +
    `  Actualiza el sueldo usado para comparar tus gastos.\n\n` +
    `ℹ️ *IMPORTANTE*\n` +
    `• Todos los comandos requieren el prefijo *#finanzas*.\n` +
    `• El mes puede escribirse como *08-2026* o *2026-08*.\n` +
    `• Usa *#finanzas ayuda* para volver a ver esta guía.`;
}

function getUserData(whatsappId) {
  const data = getFinanzasData();
  const usuario = resolveFinanceUser(whatsappId, data.usuarios);
  return usuario ? { data, usuario } : null;
}

function handleSummary(data, usuario, monthValue) {
  const month = normalizeMonth(monthValue);
  const accounts = data.cuentas.filter((account) => account.usuarioId === usuario.id);
  const accountIds = new Set(accounts.map((account) => account.id));
  const paid = data.pagos.filter((payment) => payment.usuarioId === usuario.id && payment.mes === month && accountIds.has(payment.cuentaId));
  const ants = data.gastos.filter((expense) => expense.usuarioId === usuario.id && expense.mes === month);
  const accountTotal = paid.reduce((sum, payment) => sum + (Number(accounts.find((account) => account.id === payment.cuentaId)?.monto) || 0), 0);
  const antsTotal = ants.reduce((sum, expense) => sum + (Number(expense.monto) || 0), 0);
  const total = accountTotal + antsTotal;
  const salary = Number(usuario.sueldoIngresado) || 2000000;
  return `📊 *RESUMEN ${monthLabel(month)}*\n\n` +
    `🏦 Cuentas pagadas: ${money(accountTotal)}\n` +
    `🐜 Gastos hormiga: ${money(antsTotal)} (${ants.length})\n` +
    `💸 *Total gastado: ${money(total)}*\n` +
    `💼 Sueldo ingresado: ${money(salary)}\n` +
    (total > salary ? `⚠️ Exceso sobre sueldo: ${money(total - salary)}` : `✅ Disponible según sueldo: ${money(salary - total)}`);
}

async function handleFinanzas(msg, texto, whatsappId) {
  const args = tokenize(texto);
  const subcommand = (args[1] || 'ayuda').toLowerCase();
  if (subcommand === 'ayuda' || subcommand === 'help') return msg.reply(usage());

  if (subcommand === 'register' || subcommand === 'registro') {
    const result = registerFinanceUser(whatsappId, args[2], args[3]);
    if (result.error === 'formato') return msg.reply('❌ Usa: #finanzas register usuario contraseña');
    if (result.error === 'usuario_existente') return msg.reply('❌ Ese usuario ya existe. Usa #finanzas login usuario contraseña.');
    if (result.error === 'numero_vinculado') return msg.reply('❌ Este número de WhatsApp ya está vinculado a otra cuenta.');
    return msg.reply(`✅ Cuenta financiera creada y vinculada a este WhatsApp, *${result.usuario.usuario}*.`);
  }

  if (subcommand === 'login') {
    const result = loginFinanceUser(whatsappId, args[2], args[3]);
    if (result.error === 'credenciales') return msg.reply('❌ Usuario o contraseña incorrectos.');
    if (result.error === 'numero_vinculado') return msg.reply('❌ Este número de WhatsApp ya está vinculado a otra cuenta.');
    return msg.reply(`✅ Sesión iniciada. Este WhatsApp quedó vinculado a *${result.usuario.usuario}*.`);
  }

  if (subcommand === 'gastohormiga') {
    const result = addGastoHormiga(whatsappId, String(texto).replace(/^#finanzas\s+gastohormiga/i, '#gastohormiga'));
    if (result.error === 'formato') return msg.reply('❌ Formato: #finanzas gastohormiga 150000 "compras epic"');
    if (result.error) return msg.reply('❌ No hay una cuenta financiera asociada a este número.');
    return msg.reply(`✅ *Gasto registrado*\n💸 ${money(result.gasto.monto)}\n📝 ${result.gasto.descripcion}\n📅 ${result.gasto.fecha}`);
  }

  const context = getUserData(whatsappId);
  if (!context) return msg.reply('❌ No hay una cuenta financiera disponible para este número.');
  const { data, usuario } = context;

  if (subcommand === 'resumen') return msg.reply(handleSummary(data, usuario, args[2]));
  if (subcommand === 'sueldo') {
    const salary = Number(String(args[2] || '').replace(/[.,]/g, ''));
    if (!Number.isFinite(salary) || salary <= 0) return msg.reply('❌ Usa: #finanzas sueldo 2500000');
    updateFinanceSalary(whatsappId, salary);
    return msg.reply(`✅ Sueldo comparativo actualizado a ${money(salary)}.`);
  }
  if (subcommand === 'gastos') {
    const month = normalizeMonth(args[2]);
    const expenses = data.gastos.filter((expense) => expense.usuarioId === usuario.id && expense.mes === month);
    if (!expenses.length) return msg.reply(`🐜 No hay gastos hormiga en ${monthLabel(month)}.`);
    return msg.reply(`🐜 *GASTOS ${monthLabel(month)}*\n\n${expenses.map((expense) => `📅 ${expense.fecha} · ${money(expense.monto)} · ${expense.descripcion}`).join('\n')}\n\n💸 *Total: ${money(expenses.reduce((sum, expense) => sum + Number(expense.monto || 0), 0))}*`);
  }
  if (subcommand === 'cuentas') {
    const accounts = data.cuentas.filter((account) => account.usuarioId === usuario.id);
    return msg.reply(`🏦 *CUENTAS*\n\n${accounts.length ? accounts.map((account) => `${account.estado === 'pagando' ? '🔄' : '✅'} *${account.nombre}* · ${money(account.monto)} · ${account.estado}`).join('\n') : 'No hay cuentas registradas.'}`);
  }
  if (subcommand === 'pagos') {
    const month = normalizeMonth(args[2]);
    const accounts = data.cuentas.filter((account) => account.usuarioId === usuario.id);
    const paidIds = new Set(data.pagos.filter((payment) => payment.usuarioId === usuario.id && payment.mes === month).map((payment) => payment.cuentaId));
    return msg.reply(`🧾 *PAGOS ${monthLabel(month)}*\n\n${accounts.map((account) => `${paidIds.has(account.id) ? '✅' : '⬜'} ${account.nombre} · ${money(account.monto)}`).join('\n') || 'No hay cuentas registradas.'}`);
  }
  if (subcommand === 'pagar') {
    const name = args.slice(2).join(' ').replace(/\s+(\d{2}-\d{4}|\d{4}-\d{2})$/, '').trim();
    const month = args[args.length - 1].match(/^\d{2}-\d{4}$|^\d{4}-\d{2}$/) ? args[args.length - 1] : undefined;
    const result = markAccountPaid(whatsappId, name, month);
    if (result.error === 'cuenta_no_encontrada') return msg.reply('❌ No encontré esa cuenta. Usa #finanzas cuentas.');
    if (result.error) return msg.reply('❌ No hay una cuenta financiera asociada a este número.');
    return msg.reply(`${result.repetido ? 'ℹ️ Ya estaba registrada' : '✅ Pago registrado'}: *${result.cuenta.nombre}* en ${monthLabel(result.mes)}.`);
  }
  if (subcommand === 'prestamos') {
    const loans = data.prestamos.filter((loan) => loan.usuarioId === usuario.id);
    return msg.reply(`🤝 *PRESTAMOS*\n\n${loans.length ? loans.map((loan) => `${loan.cuotasPagadas >= loan.cuotas ? '✅' : '⏳'} *${loan.prestante}* · ${money(loan.monto)} · vence ${loan.fechaVencimiento}`).join('\n') : 'No hay préstamos registrados.'}`);
  }
  if (subcommand === 'prestamo' || subcommand === 'préstamo') {
    const action = (args[2] || 'lista').toLowerCase();
    if (action === 'lista') return msg.reply(`🤝 *PRESTAMOS*\n\n${data.prestamos.filter((loan) => loan.usuarioId === usuario.id).map((loan) => `${loan.cuotasPagadas >= loan.cuotas ? '✅' : '⏳'} *${loan.prestante}* · ${money(loan.monto)} · ${loan.cuotasPagadas}/${loan.cuotas} cuotas · vence ${loan.fechaVencimiento}`).join('\n') || 'No hay préstamos registrados.'}`);
    if (action === 'nuevo' || action === 'crear') {
      const result = createFinanceLoan(whatsappId, { prestante: args[3], monto: args[4], intereses: args[5], fechaVencimiento: args[6], cuotas: args[7] });
      if (result.error === 'formato') return msg.reply('❌ Usa: #finanzas prestamo nuevo "Juan" 100000 0 2026-12-31 1');
      if (result.error) return msg.reply('❌ No hay una cuenta financiera asociada a este número.');
      return msg.reply(`✅ Préstamo registrado para *${result.prestamo.prestante}* por ${money(result.prestamo.monto)} en ${result.prestamo.cuotas} cuota(s).`);
    }
    if (action === 'cuota' || action === 'pagar') {
      const result = addFinanceLoanPayment(whatsappId, args.slice(3).join(' '));
      if (result.error === 'prestamo_no_encontrado') return msg.reply('❌ No encontré ese préstamo. Usa #finanzas prestamos.');
      if (result.error === 'completado') return msg.reply('ℹ️ Ese préstamo ya tiene todas sus cuotas pagadas.');
      if (result.error) return msg.reply('❌ No hay una cuenta financiera asociada a este número.');
      return msg.reply(`✅ Cuota registrada para *${result.prestamo.prestante}*: ${result.prestamo.cuotasPagadas}/${result.prestamo.cuotas}.`);
    }
    if (action === 'editar' || action === 'edit') {
      const result = updateFinanceLoan(whatsappId, args[3], args[4], args[5]);
      if (result.error === 'formato') return msg.reply('❌ Usa: #finanzas prestamo editar "Juan" monto 120000');
      if (result.error === 'valor_invalido') return msg.reply('❌ El nuevo valor dejaría el préstamo inválido.');
      if (result.error === 'prestamo_no_encontrado') return msg.reply('❌ No encontré ese préstamo.');
      if (result.error) return msg.reply('❌ No hay una cuenta financiera asociada a este número.');
      return msg.reply(`✅ Préstamo de *${result.prestamo.prestante}* actualizado.`);
    }
    if (action === 'eliminar' || action === 'borrar') {
      const result = deleteFinanceLoan(whatsappId, args.slice(3).join(' '));
      if (result.error === 'prestamo_no_encontrado') return msg.reply('❌ No encontré ese préstamo.');
      if (result.error) return msg.reply('❌ No hay una cuenta financiera asociada a este número.');
      return msg.reply(`✅ Préstamo de *${result.prestamo.prestante}* eliminado.`);
    }
    return msg.reply('❌ Acción inválida. Usa #finanzas ayuda.');
  }
  return msg.reply(`❌ Subcomando financiero desconocido.\n\n${usage()}`);
}

function tokenize(text) {
  return String(text).trim().match(/(?:[^\s"]+|"[^"]*")+/g) || [];
}

module.exports = { handleFinanzas, usage };