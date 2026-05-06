// ============================================================
// maintenance.js - Sistema de Mantenimiento SmartGate
// ITIBB - Informática Industrial - v3.0
// CORREGIDO: Ahora usa Supabase como fuente principal
// ============================================================

class SistemaMantenimiento {
    constructor() {
        this.ciclos = this.cargarCiclos();
        this.estadoAnterior = { abierto: false, cerrado: false };
        this.ultimoCicloRegistrado = null;
        this.alertas = [];
        this.historialMantenimiento = this.cargarHistorialMantenimiento();
        this.ultimoEstadoPorton = null;
        this.cargarHistorialDesdeSupabase(); // ✅ NUEVO: Cargar datos al iniciar
    }

    cargarCiclos() {
        const guardado = localStorage.getItem('porton_ciclos_avanzado');
        return guardado ? JSON.parse(guardado) : {
            total: 0, hoy: 0, historial: [],
            ultimoMantenimiento: null, predicciones: {}
        };
    }

    cargarHistorialMantenimiento() {
        const guardado = localStorage.getItem('porton_historial_mantenimiento');
        return guardado ? JSON.parse(guardado) : [];
    }

    guardarCiclos() {
        localStorage.setItem('porton_ciclos_avanzado', JSON.stringify(this.ciclos));
    }

    guardarHistorialMantenimiento() {
        localStorage.setItem('porton_historial_mantenimiento',
            JSON.stringify(this.historialMantenimiento));
    }

    // ✅ NUEVO: Cargar historial desde Supabase
    async cargarHistorialDesdeSupabase() {
        try {
            const SUPABASE_URL = 'https://zdwonipaqrixxgfhxjjt.supabase.co';
            const SUPABASE_KEY = 'sb_publishable_hAfw0kf-IxPbIzd9y3nThw_nwoDZf-P';
            
            const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/obtener_resumen`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'apikey': SUPABASE_KEY,
                    'Authorization': 'Bearer ' + SUPABASE_KEY
                },
                body: '{}'
            });
            const data = await res.json();
            
            if (data && data.ultimos_dias && data.ultimos_dias.length > 0) {
                // Convertir formato de Supabase a formato local
                this.ciclos.historial = data.ultimos_dias.map(dia => ({
                    fecha: dia.fecha,
                    timestamp: dia.fecha,
                    ciclos: dia.ciclos
                }));
                this.ciclos.total = data.total_acumulado || 0;
                this.ciclos.hoy = data.ciclos_hoy || 0;
                this.guardarCiclos();
                
                console.log('✅ Historial cargado desde Supabase:', this.ciclos.historial.length, 'días');
                console.log('📊 Total acumulado:', this.ciclos.total);
                console.log('📊 Ciclos hoy:', this.ciclos.hoy);
                
                // Actualizar UI y gráficos
                this.actualizarSaludSistema();
                this.actualizarPredicciones();
                this.verificarAlertasMantenimiento();
                
                if (typeof actualizarGraficos === 'function') {
                    actualizarGraficos();
                }
                if (typeof actualizarEstadisticas === 'function') {
                    actualizarEstadisticas();
                }
            }
        } catch (e) {
            console.warn('⚠️ Error cargando historial desde Supabase:', e);
        }
    }

    // ✅ NUEVO: Sincronizar con Supabase periódicamente
    async sincronizarConSupabase() {
        await this.cargarHistorialDesdeSupabase();
    }

    procesarCambioEstado(nuevoEstado) {
        this.ultimoEstadoPorton = nuevoEstado;
    }

    procesarSensores(sensores) {
        this.estadoAnterior = {
            abierto: sensores.abierto === true,
            cerrado: sensores.cerrado === true
        };
    }

    // ── Salud del sistema ─────────────────────────────────────
    actualizarSaludSistema() {
        const total = this.ciclos.total;
        const porcentajeDesgaste = Math.min(100, (total / 5000) * 100);
        const salud = Math.max(0, 100 - porcentajeDesgaste);

        const circulo      = document.getElementById('healthCircle');
        const porcSpan     = document.getElementById('healthPercent');
        const eficSpan     = document.getElementById('efficiency');
        const desgasteSpan = document.getElementById('wearLevel');
        const vidaSpan     = document.getElementById('lifeCycles');
        const predSpan     = document.getElementById('failurePrediction');

        if (circulo && porcSpan) {
            const offset = 283 - (salud / 100) * 283;
            circulo.style.strokeDashoffset = offset;
            porcSpan.textContent = Math.round(salud);
            circulo.style.stroke = salud > 70 ? '#10b981' : salud > 40 ? '#f59e0b' : '#ef4444';
        }
        if (eficSpan)     eficSpan.textContent     = Math.round(Math.max(0, 100 - total / 100)) + '%';
        if (desgasteSpan) desgasteSpan.textContent = Math.round(porcentajeDesgaste) + '%';
        if (vidaSpan)     vidaSpan.textContent      = `${total} / 5000`;
        if (predSpan) {
            predSpan.textContent =
                total > 4500 ? 'Crítico — Reemplazo próximo' :
                total > 4000 ? 'Alto desgaste' :
                total > 3000 ? 'Desgaste moderado' :
                total > 2000 ? 'Normal' : 'Excelente';
        }
    }

    actualizarPredicciones() {
        const total            = this.ciclos.total;
        const siguiente500     = Math.ceil((total + 1) / 500) * 500;
        const ciclosRestantes  = siguiente500 - total;

        const proxSpan  = document.getElementById('nextMaintenance');
        const restSpan  = document.getElementById('cyclesToNext');

        if (proxSpan) {
            proxSpan.textContent =
                siguiente500 <= 500  ? 'Revisión 500 ciclos' :
                siguiente500 <= 1000 ? 'Lubricación' :
                siguiente500 <= 2000 ? 'Revisión General' :
                `Revisión en ${siguiente500} ciclos`;
        }
        if (restSpan) restSpan.textContent = `${ciclosRestantes} ciclos restantes`;
    }

    // ── Alertas de mantenimiento ──────────────────────────────
    verificarAlertasMantenimiento() {
        const total = this.ciclos.total;
        this.alertas = [];
        const siguiente500    = Math.ceil((total + 1) / 500) * 500;
        const ciclosRestantes = siguiente500 - total;

        if (total > 0 && total % 2000 === 0) {
            this.alertas.push({
                nivel: 'danger', prioridad: 'Alta',
                titulo: '⚠️ REVISIÓN GENERAL URGENTE',
                mensaje: `Se han alcanzado los ${total} ciclos`,
                accion: 'Inspección completa: motor, engranajes, estructura y sistema eléctrico'
            });
            this.agregarRegistroMantenimiento('Revisión General', total);
            if (typeof notificaciones !== 'undefined')
                notificaciones.alertaMantenimiento('REVISIÓN GENERAL — ' + total + ' ciclos');

        } else if (total > 0 && total % 1000 === 0) {
            this.alertas.push({
                nivel: 'warning', prioridad: 'Media',
                titulo: '🛢️ LUBRICACIÓN REQUERIDA',
                mensaje: `${total} ciclos alcanzados`,
                accion: 'Aplicar lubricante en guías, cadena o cremallera. Verificar desgaste.'
            });
            this.agregarRegistroMantenimiento('Lubricación', total);
            if (typeof notificaciones !== 'undefined')
                notificaciones.alertaMantenimiento('LUBRICACIÓN — ' + total + ' ciclos');

        } else if (total > 0 && total % 500 === 0) {
            this.alertas.push({
                nivel: 'info', prioridad: 'Normal',
                titulo: '🔍 REVISIÓN PREVENTIVA',
                mensaje: `${total} ciclos completados`,
                accion: 'Verificar tornillos, conexiones, fotocélulas y ajustes generales'
            });
            this.agregarRegistroMantenimiento('Revisión Preventiva', total);
            if (typeof notificaciones !== 'undefined')
                notificaciones.alertaMantenimiento('REVISIÓN PREVENTIVA — ' + total + ' ciclos');

        } else if (ciclosRestantes <= 50 && ciclosRestantes > 0) {
            this.alertas.push({
                nivel: 'warning', prioridad: 'Media',
                titulo: '📢 MANTENIMIENTO PRÓXIMO',
                mensaje: `Faltan ${ciclosRestantes} ciclos para la próxima revisión`,
                accion: 'Programar mantenimiento preventivo con anticipación'
            });
        }

        this.mostrarAlertas();
    }

    // ── Registrar mantenimiento (local + Supabase) ────────────
    async agregarRegistroMantenimiento(tipo, ciclosEnMantenimiento, notas = '') {
        const registro = {
            fecha: new Date().toISOString(),
            tipo,
            ciclosEnMantenimiento,
            totalCiclos: this.ciclos.total,
            notas
        };
        this.historialMantenimiento.unshift(registro);
        this.guardarHistorialMantenimiento();

        if (typeof guardarMantenimientoSupabase === 'function') {
            await guardarMantenimientoSupabase(tipo, notas || `Automático en ${ciclosEnMantenimiento} ciclos`);
        }
        this.actualizarTablaMantenimiento();
    }

    mostrarAlertas() {
        const contenedor    = document.getElementById('alertsContainer');
        const contadorSpan  = document.getElementById('alertCount');
        if (!contenedor) return;

        if (contadorSpan) contadorSpan.textContent =
            this.alertas.length > 0 ? `${this.alertas.length} alertas` : '0 alertas';

        if (this.alertas.length === 0) {
            contenedor.innerHTML = '<div class="alert alert-success">✅ Todo en orden. El sistema opera correctamente.</div>';
        } else {
            contenedor.innerHTML = this.alertas.map(a => `
                <div class="alert alert-${a.nivel}">
                    <strong>${a.titulo}</strong>
                    <div>${a.mensaje}</div>
                    <small>📋 ${a.accion}</small>
                    <span class="priority-badge">Prioridad: ${a.prioridad}</span>
                </div>`).join('');
        }

        this.actualizarRecomendaciones();
    }

    actualizarRecomendaciones() {
        const contenedor = document.getElementById('recommendationsList');
        if (!contenedor) return;
        const total = this.ciclos.total;
        const recs = total > 4000 ? ['⚠️ Considere reemplazo preventivo del motor en los próximos meses'] :
                     total > 3000 ? ['🔧 Programar inspección de motor y engranajes'] :
                     total > 2000 ? ['🛢️ Verificar nivel de lubricación cada 2 semanas'] :
                     total > 1000 ? ['✅ Mantenimiento regular según lo programado'] :
                                   ['🌟 Sistema en excelente estado, siga con el uso normal'];
        recs.push('📱 Revise mensualmente el estado de las fotocélulas');
        recs.push('🔌 Verifique conexiones eléctricas cada 3 meses');
        contenedor.innerHTML = recs.map(r => `<div class="recommendation-item">${r}</div>`).join('');
        this.actualizarCalendario();
    }

    actualizarCalendario() {
        const contenedor = document.getElementById('scheduleTimeline');
        if (!contenedor) return;
        const total = this.ciclos.total;
        const proximos = [500, 1000, 2000].map(lim => {
            const sig = Math.ceil((total + 1) / lim) * lim;
            if (sig <= total) return null;
            return {
                tipo: lim === 500  ? '🔍 Revisión Preventiva' :
                      lim === 1000 ? '🛢️ Lubricación' : '🔧 Revisión General',
                restantes: sig - total
            };
        }).filter(Boolean);

        contenedor.innerHTML = proximos.map(p => `
            <div class="schedule-item">
                <strong>${p.tipo}</strong><br>
                <small>Faltan ${p.restantes} ciclos ${p.restantes <= 100 ? '— ⚠️ PRÓXIMO' : ''}</small>
            </div>`).join('') || '<div class="empty-state">Sin mantenimientos próximos</div>';
    }

    // ── Tabla de historial de mantenimiento ───────────────────
    async actualizarTablaMantenimiento() {
        const tbody = document.getElementById('maintenanceHistoryBody');
        if (!tbody) return;

        let historial = this.historialMantenimiento;
        if (typeof leerMantenimientosSupabase === 'function') {
            const supabaseData = await leerMantenimientosSupabase(50);
            if (supabaseData && supabaseData.length > 0) {
                historial = supabaseData.map(r => ({
                    fecha: r.fecha,
                    tipo: r.tipo,
                    ciclosEnMantenimiento: r.ciclos_en_evento,
                    notas: r.notas || '',
                    realizado_por: r.realizado_por
                }));
            }
        }

        if (historial.length === 0) {
            tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;opacity:0.6">Sin historial de mantenimiento</td></tr>';
            return;
        }

        tbody.innerHTML = historial.map(h => `
            <tr>
                <td>${new Date(h.fecha).toLocaleString('es-BO')}</td>
                <td><strong>${h.tipo}</strong></td>
                <td>${h.ciclosEnMantenimiento || '—'}</td>
                <td>${h.notas || h.realizado_por || '—'}</td>
            </tr>`).join('');
    }

    // ── Datos para gráficos (CORREGIDOS - usan historial real) ──
    obtenerCiclosPorDia(dias = 7) {
        const diario = {};
        
        // Inicializar los últimos 'dias' días con 0
        for (let i = 0; i < dias; i++) {
            const fecha = new Date(Date.now() - i * 86400000).toISOString().split('T')[0];
            diario[fecha] = 0;
        }
        
        // Sumar ciclos del historial
        this.ciclos.historial.forEach(c => {
            if (diario[c.fecha] !== undefined) {
                diario[c.fecha] += c.ciclos || 1;
            }
        });
        
        return Object.entries(diario).reverse();
    }

    obtenerCiclosPorHora() {
        const porHora = Array(24).fill(0);
        // Si hay timestamp real, usarlo; si no, datos por defecto
        this.ciclos.historial.forEach(c => {
            if (c.timestamp && c.timestamp !== c.fecha) {
                const hora = new Date(c.timestamp).getHours();
                if (!isNaN(hora)) porHora[hora] += (c.ciclos || 1);
            }
        });
        return porHora;
    }

    obtenerEstadisticasMensuales() {
        const mensual = {};
        this.ciclos.historial.forEach(c => {
            const mes = c.fecha.substring(0, 7);
            mensual[mes] = (mensual[mes] || 0) + (c.ciclos || 1);
        });
        return Object.entries(mensual).slice(-6);
    }

    obtenerCiclosHoy() {
        const hoy = new Date().toISOString().split('T')[0];
        let total = 0;
        this.ciclos.historial.forEach(c => {
            if (c.fecha === hoy) {
                total += c.ciclos || 1;
            }
        });
        return total;
    }

    obtenerTendenciaSemanal() {
        const hoy = new Date().toISOString().split('T')[0];
        const ayer = new Date(Date.now() - 86400000).toISOString().split('T')[0];
        
        let ciclosHoy = 0;
        let ciclosAyer = 0;
        
        this.ciclos.historial.forEach(c => {
            if (c.fecha === hoy) ciclosHoy += c.ciclos || 1;
            if (c.fecha === ayer) ciclosAyer += c.ciclos || 1;
        });
        
        return ciclosHoy - ciclosAyer;
    }
}

// ============================================================
// RESET DE CONTADOR DESDE LA UI
// ============================================================
async function resetearContadorUI() {
    const total = typeof globalTotalAcumulado !== 'undefined' ? globalTotalAcumulado : mantenimiento.ciclos.total;

    if (!confirm(`⚠️ ¿Resetear el contador?\nTotal actual: ${total} ciclos\nEsta acción guardará el evento en el historial de Supabase.`)) return;

    const motivo = prompt('Motivo del reset (ej: mantenimiento realizado):', 'Mantenimiento completado') || 'Reset manual';
    const quien  = prompt('Realizado por:', 'Operador') || 'Operador';

    if (typeof resetearContadorSupabase === 'function') {
        const resultado = await resetearContadorSupabase(motivo, quien);
        if (resultado && resultado.exito) {
            mantenimiento.ciclos.total = 0;
            mantenimiento.ciclos.hoy   = 0;
            mantenimiento.guardarCiclos();
            mantenimiento.actualizarSaludSistema();
            mantenimiento.verificarAlertasMantenimiento();
            mantenimiento.actualizarTablaMantenimiento();
            alert(`✅ Contador reseteado.\nCiclos antes del reset: ${resultado.ciclos_antes}\nMotivo: ${motivo}`);
        }
    } else {
        mantenimiento.ciclos.total = 0;
        mantenimiento.guardarCiclos();
        alert('✅ Contador reseteado localmente (Supabase no disponible)');
    }
}

// ── Guardado diario programado ────────────────────────────────
function programarGuardadoDiario() {
    const ahora = new Date();
    const msHastaMedianoche = new Date(
        ahora.getFullYear(), ahora.getMonth(), ahora.getDate() + 1
    ) - ahora;
    setTimeout(() => {
        if (typeof leerResumenSupabase === 'function') leerResumenSupabase();
        if (typeof mantenimiento !== 'undefined') mantenimiento.sincronizarConSupabase();
        setInterval(() => {
            if (typeof leerResumenSupabase === 'function') leerResumenSupabase();
            if (typeof mantenimiento !== 'undefined') mantenimiento.sincronizarConSupabase();
        }, 24 * 60 * 60 * 1000);
    }, msHastaMedianoche);
}

// Programar sincronización cada 5 minutos
setInterval(() => {
    if (typeof mantenimiento !== 'undefined') {
        mantenimiento.sincronizarConSupabase();
    }
}, 5 * 60 * 1000);

programarGuardadoDiario();
const mantenimiento = new SistemaMantenimiento();
