// Sistema de mantenimiento - CONTADOR DE CICLOS POR FLANCO DE SENSOR
class SistemaMantenimiento {
    constructor() {
        this.ciclos = this.cargarCiclos();
        
        // Estado ANTERIOR de los sensores (para detectar flancos)
        this.estadoAnterior = {
            abierto: false,
            cerrado: false
        };
        
        // Bandera para evitar múltiples conteos en un mismo ciclo
        this.ultimoCicloRegistrado = null;
        
        this.alertas = [];
        this.historialMantenimiento = this.cargarHistorialMantenimiento();
        this.ultimoEstadoPorton = null;
    }

    cargarCiclos() {
        const guardado = localStorage.getItem('porton_ciclos_avanzado');
        return guardado ? JSON.parse(guardado) : {
            total: 0,
            historial: [],
            ultimoMantenimiento: null,
            predicciones: {}
        };
    }

    cargarHistorialMantenimiento() {
        const guardado = localStorage.getItem('porton_historial_mantenimiento');
        return guardado ? JSON.parse(guardado) : [];
    }

    guardarCiclos() {
        localStorage.setItem('porton_ciclos_avanzado', JSON.stringify(this.ciclos));
        console.log(`💾 Ciclos guardados: ${this.ciclos.total}`);
    }

    guardarHistorialMantenimiento() {
        localStorage.setItem('porton_historial_mantenimiento', JSON.stringify(this.historialMantenimiento));
    }

    // ============================================================
    // MÉTODO 1: Procesar cambio de estado (solo para mostrar)
    // ============================================================
    procesarCambioEstado(nuevoEstado, timestamp) {
        console.log(`🔄 Estado del portón: ${nuevoEstado}`);
        this.ultimoEstadoPorton = nuevoEstado;
    }

    // ============================================================
    // MÉTODO PRINCIPAL: Procesar sensores con DETECCIÓN DE FLANCO
    // Ahora solo muestra los sensores, NO cuenta ciclos localmente
    // El ESP32 es quien cuenta y envía el contador real
    // ============================================================
    procesarSensores(sensores, timestamp) {
        const abiertoActual = sensores.abierto === true;
        const cerradoActual = sensores.cerrado === true;
        
        const abiertoAnterior = this.estadoAnterior.abierto;
        const cerradoAnterior = this.estadoAnterior.cerrado;
        
        // Solo mostrar cambios relevantes (no contar ciclos)
        if (abiertoActual !== abiertoAnterior) {
            console.log(`📡 Sensor ABIERTO: ${abiertoAnterior} → ${abiertoActual}`);
        }
        if (cerradoActual !== cerradoAnterior) {
            console.log(`📡 Sensor CERRADO: ${cerradoAnterior} → ${cerradoActual}`);
        }
        
        // Actualizar estado anterior para la próxima comparación
        this.estadoAnterior = {
            abierto: abiertoActual,
            cerrado: cerradoActual
        };
    }

    // Esta función ya no se usa para contar, se conserva por si se necesita
    completarCiclo(timestamp) {
        this.ciclos.total++;
        
        const datosCiclo = {
            numero: this.ciclos.total,
            timestamp: timestamp,
            fecha: new Date(timestamp).toISOString().split('T')[0],
            hora: new Date(timestamp).getHours(),
            minuto: new Date(timestamp).getMinutes(),
            segundo: new Date(timestamp).getSeconds()
        };
        
        this.ciclos.historial.push(datosCiclo);
        this.guardarCiclos();
        this.verificarAlertasMantenimiento();
        this.actualizarPredicciones();
        this.actualizarSaludSistema();
        
        console.log(`✅ CICLO #${this.ciclos.total} COMPLETADO a las ${new Date(timestamp).toLocaleTimeString()}`);
        
        if (typeof actualizarEstadisticas === 'function') {
            actualizarEstadisticas();
        }
        if (typeof actualizarGraficos === 'function') {
            actualizarGraficos();
        }
        
        if (typeof notificaciones !== 'undefined' && notificaciones.config.mantenimiento) {
            notificaciones.enviarNotificacion(
                'Ciclo Registrado',
                `Ciclo #${this.ciclos.total} completado. Próximo mantenimiento en ${500 - (this.ciclos.total % 500)} ciclos.`,
                'info'
            );
        }
    }

    verificarAlertasMantenimiento() {
        const total = this.ciclos.total;
        this.alertas = [];
        
        const siguiente500 = Math.ceil(total / 500) * 500;
        const ciclosRestantes = siguiente500 - total;
        
        if (total >= 2000 && total % 2000 === 0) {
            this.alertas.push({
                nivel: 'danger',
                titulo: '⚠️ REVISIÓN GENERAL URGENTE',
                mensaje: 'Se han alcanzado los 2000 ciclos',
                accion: 'Inspección completa: motor, engranajes, estructura y sistema eléctrico',
                prioridad: 'Alta'
            });
            this.agregarRegistroMantenimiento('Revisión General', 2000);
            if (typeof notificaciones !== 'undefined') {
                notificaciones.alertaMantenimiento('REVISIÓN GENERAL - 2000 ciclos alcanzados');
            }
        } else if (total >= 1000 && total % 1000 === 0) {
            this.alertas.push({
                nivel: 'warning',
                titulo: '🛢️ LUBRICACIÓN REQUERIDA',
                mensaje: '1000 ciclos alcanzados',
                accion: 'Aplicar lubricante en guías, cadena o cremallera. Verificar desgaste.',
                prioridad: 'Media'
            });
            this.agregarRegistroMantenimiento('Lubricación', 1000);
            if (typeof notificaciones !== 'undefined') {
                notificaciones.alertaMantenimiento('LUBRICACIÓN - 1000 ciclos alcanzados');
            }
        } else if (total >= 500 && total % 500 === 0) {
            this.alertas.push({
                nivel: 'info',
                titulo: '🔍 REVISIÓN PREVENTIVA',
                mensaje: '500 ciclos completados',
                accion: 'Verificar tornillos, conexiones, fotocélulas y ajustes generales',
                prioridad: 'Normal'
            });
            this.agregarRegistroMantenimiento('Revisión Preventiva', 500);
            if (typeof notificaciones !== 'undefined') {
                notificaciones.alertaMantenimiento('REVISIÓN PREVENTIVA - 500 ciclos');
            }
        } else if (ciclosRestantes <= 50 && ciclosRestantes > 0) {
            this.alertas.push({
                nivel: 'warning',
                titulo: '📢 MANTENIMIENTO PRÓXIMO',
                mensaje: `Faltan ${ciclosRestantes} ciclos para la próxima revisión`,
                accion: 'Programar mantenimiento preventivo con anticipación',
                prioridad: 'Media'
            });
        }
        
        this.mostrarAlertas();
    }

    agregarRegistroMantenimiento(tipo, ciclosEnMantenimiento) {
        this.historialMantenimiento.push({
            fecha: new Date().toISOString(),
            tipo: tipo,
            ciclosEnMantenimiento: ciclosEnMantenimiento,
            totalCiclos: this.ciclos.total
        });
        this.guardarHistorialMantenimiento();
    }

    actualizarSaludSistema() {
        const total = this.ciclos.total;
        const porcentajeDesgaste = Math.min(100, (total / 5000) * 100);
        const salud = Math.max(0, 100 - porcentajeDesgaste);
        
        const circulo = document.getElementById('healthCircle');
        const porcentajeSpan = document.getElementById('healthPercent');
        const eficienciaSpan = document.getElementById('efficiency');
        const desgasteSpan = document.getElementById('wearLevel');
        const ciclosVidaSpan = document.getElementById('lifeCycles');
        const prediccionSpan = document.getElementById('failurePrediction');
        
        if (circulo && porcentajeSpan) {
            const circunferencia = 283;
            const offset = circunferencia - (salud / 100) * circunferencia;
            circulo.style.strokeDashoffset = offset;
            porcentajeSpan.textContent = Math.round(salud);
            
            if (salud > 70) circulo.style.stroke = '#10b981';
            else if (salud > 40) circulo.style.stroke = '#f59e0b';
            else circulo.style.stroke = '#ef4444';
        }
        
        if (eficienciaSpan) {
            const eficiencia = Math.max(0, 100 - (total / 100));
            eficienciaSpan.textContent = Math.round(eficiencia) + '%';
        }
        
        if (desgasteSpan) {
            desgasteSpan.textContent = Math.round(porcentajeDesgaste) + '%';
        }
        
        if (ciclosVidaSpan) {
            ciclosVidaSpan.textContent = `${total} / 5000`;
        }
        
        if (prediccionSpan) {
            if (total > 4500) prediccionSpan.textContent = 'Crítico - Reemplazo próximo';
            else if (total > 4000) prediccionSpan.textContent = 'Alto desgaste';
            else if (total > 3000) prediccionSpan.textContent = 'Desgaste moderado';
            else if (total > 2000) prediccionSpan.textContent = 'Normal';
            else prediccionSpan.textContent = 'Excelente';
        }
    }

    actualizarPredicciones() {
        const total = this.ciclos.total;
        const siguiente500 = Math.ceil(total / 500) * 500;
        const ciclosRestantes = siguiente500 - total;
        
        const proximoMantenimientoSpan = document.getElementById('nextMaintenance');
        const ciclosRestantesSpan = document.getElementById('cyclesToNext');
        
        if (proximoMantenimientoSpan) {
            if (siguiente500 === 500) proximoMantenimientoSpan.textContent = 'Revisión 500 ciclos';
            else if (siguiente500 === 1000) proximoMantenimientoSpan.textContent = 'Lubricación';
            else if (siguiente500 === 2000) proximoMantenimientoSpan.textContent = 'Revisión General';
            else proximoMantenimientoSpan.textContent = `Revisión en ${siguiente500} ciclos`;
        }
        
        if (ciclosRestantesSpan) {
            ciclosRestantesSpan.textContent = `${ciclosRestantes} ciclos restantes`;
        }
    }

    mostrarAlertas() {
        const contenedor = document.getElementById('alertsContainer');
        const contadorAlertasSpan = document.getElementById('alertCount');
        
        if (!contenedor) return;
        
        if (this.alertas.length === 0) {
            contenedor.innerHTML = '<div class="alert alert-success">✅ Todo en orden. El sistema opera correctamente.</div>';
            if (contadorAlertasSpan) contadorAlertasSpan.textContent = '0 alertas';
            return;
        }
        
        if (contadorAlertasSpan) contadorAlertasSpan.textContent = `${this.alertas.length} alertas`;
        
        contenedor.innerHTML = this.alertas.map(alerta => `
            <div class="alert alert-${alerta.nivel}">
                <strong>${alerta.titulo}</strong>
                <div>${alerta.mensaje}</div>
                <small>📋 ${alerta.accion}</small>
                <span class="priority-badge">Prioridad: ${alerta.prioridad}</span>
            </div>
        `).join('');
        
        this.actualizarRecomendaciones();
    }

    actualizarRecomendaciones() {
        const contenedor = document.getElementById('recommendationsList');
        if (!contenedor) return;
        
        const recomendaciones = [];
        
        if (this.ciclos.total > 4000) {
            recomendaciones.push('⚠️ Considere reemplazo preventivo del motor en los próximos meses');
        } else if (this.ciclos.total > 3000) {
            recomendaciones.push('🔧 Programar inspección de motor y engranajes');
        } else if (this.ciclos.total > 2000) {
            recomendaciones.push('🛢️ Verificar nivel de lubricación cada 2 semanas');
        } else if (this.ciclos.total > 1000) {
            recomendaciones.push('✅ Mantenimiento regular según lo programado');
        } else {
            recomendaciones.push('🌟 Sistema en excelente estado, siga con el uso normal');
        }
        
        recomendaciones.push('📱 Revise mensualmente el estado de las fotocélulas');
        recomendaciones.push('🔌 Verifique conexiones eléctricas cada 3 meses');
        
        contenedor.innerHTML = recomendaciones.map(rec => `
            <div class="recommendation-item">${rec}</div>
        `).join('');
        
        this.actualizarCalendario();
    }

    actualizarCalendario() {
        const contenedor = document.getElementById('scheduleTimeline');
        if (!contenedor) return;
        
        const proximos = [];
        const total = this.ciclos.total;
        
        [500, 1000, 2000].forEach(limite => {
            const siguiente = Math.ceil(total / limite) * limite;
            if (siguiente > total) {
                const restantes = siguiente - total;
                let tipo = '';
                if (limite === 500) tipo = '🔍 Revisión Preventiva';
                else if (limite === 1000) tipo = '🛢️ Lubricación';
                else tipo = '🔧 Revisión General';
                
                proximos.push({
                    tipo: tipo,
                    ciclosRestantes: restantes,
                    cuando: restantes <= 100 ? '⚠️ PRÓXIMO' : 'Programado'
                });
            }
        });
        
        contenedor.innerHTML = proximos.map(item => `
            <div class="schedule-item">
                <strong>${item.tipo}</strong><br>
                <small>Faltan ${item.ciclosRestantes} ciclos - ${item.cuando}</small>
            </div>
        `).join('');
        
        if (proximos.length === 0) {
            contenedor.innerHTML = '<div class="empty-state">No hay mantenimientos programados próximamente</div>';
        }
    }

    obtenerCiclosPorDia(dias = 7) {
        const diario = {};
        const hoy = new Date();
        
        for (let i = 0; i < dias; i++) {
            const fecha = new Date(hoy);
            fecha.setDate(fecha.getDate() - i);
            const fechaStr = fecha.toISOString().split('T')[0];
            diario[fechaStr] = 0;
        }
        
        this.ciclos.historial.forEach(ciclo => {
            if (diario[ciclo.fecha] !== undefined) {
                diario[ciclo.fecha]++;
            }
        });
        
        return Object.entries(diario).reverse();
    }

    obtenerCiclosPorHora() {
        const porHora = Array(24).fill(0);
        this.ciclos.historial.forEach(ciclo => {
            const hora = new Date(ciclo.timestamp).getHours();
            porHora[hora]++;
        });
        return porHora;
    }

    obtenerEstadisticasMensuales() {
        const mensual = {};
        this.ciclos.historial.forEach(ciclo => {
            const mes = ciclo.fecha.substring(0, 7);
            mensual[mes] = (mensual[mes] || 0) + 1;
        });
        return Object.entries(mensual).slice(-6);
    }

    obtenerCiclosHoy() {
        const hoy = new Date().toISOString().split('T')[0];
        return this.ciclos.historial.filter(ciclo => ciclo.fecha === hoy).length;
    }

    obtenerTendenciaSemanal() {
        const hoy = this.obtenerCiclosHoy();
        const ayer = new Date();
        ayer.setDate(ayer.getDate() - 1);
        const ayerStr = ayer.toISOString().split('T')[0];
        const ciclosAyer = this.ciclos.historial.filter(c => c.fecha === ayerStr).length;
        return hoy - ciclosAyer;
    }
}

// ============================================================
// FUNCIONES PARA SINCRONIZAR CON EL ESP32 (SERVIDOR HTTP)
// ============================================================

async function sincronizarConESP32() {
    try {
        const response = await fetch('http://192.168.1.200/contador');
        const data = await response.json();
        
        if (data.ciclos !== undefined && data.ciclos > mantenimiento.ciclos.total) {
            mantenimiento.ciclos.total = data.ciclos;
            mantenimiento.guardarCiclos();
            if (typeof actualizarEstadisticas === 'function') actualizarEstadisticas();
            if (typeof actualizarGraficos === 'function') actualizarGraficos();
            console.log(`✅ Sincronizado con ESP32: ${data.ciclos} ciclos`);
        } else if (data.ciclos !== undefined) {
            console.log(`📊 ESP32 tiene ${data.ciclos} ciclos (local: ${mantenimiento.ciclos.total})`);
        }
    } catch (error) {
        console.log('⚠️ No se pudo sincronizar con ESP32 (HTTP)');
    }
}

// ============================================================
// ALMACENAR CICLOS POR DÍA (para reportes)
// ============================================================

function guardarCicloDiario() {
    const hoy = new Date().toISOString().split('T')[0];
    const ciclosHoy = mantenimiento.ciclos.total;
    
    let historialDiario = JSON.parse(localStorage.getItem('historial_diario') || '[]');
    
    const index = historialDiario.findIndex(item => item.fecha === hoy);
    
    if (index !== -1) {
        historialDiario[index].ciclos = ciclosHoy;
        historialDiario[index].timestamp = new Date().toISOString();
    } else {
        historialDiario.push({
            fecha: hoy,
            ciclos: ciclosHoy,
            timestamp: new Date().toISOString()
        });
    }
    
    if (historialDiario.length > 365) {
        historialDiario = historialDiario.slice(-365);
    }
    
    localStorage.setItem('historial_diario', JSON.stringify(historialDiario));
    console.log(`💾 Ciclo diario guardado: ${hoy} → ${ciclosHoy} ciclos`);
}

function programarGuardadoDiario() {
    const ahora = new Date();
    const msHastaMedianoche = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate() + 1) - ahora;
    
    setTimeout(() => {
        guardarCicloDiario();
        setInterval(guardarCicloDiario, 24 * 60 * 60 * 1000);
    }, msHastaMedianoche);
}

// Iniciar sincronización y guardado al cargar
setTimeout(() => {
    sincronizarConESP32();
    programarGuardadoDiario();
}, 2000);

setInterval(sincronizarConESP32, 30000);

const mantenimiento = new SistemaMantenimiento();
