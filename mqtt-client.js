// ============================================================
// CONFIGURACIÓN MQTT - NUEVAS CREDENCIALES
// Broker: d21941469193416fabcba46336fd0980.s1.eu.hivemq.cloud
// Usuario: porton_itibb
// Contraseña: Porton2026
// ============================================================

// Variable GLOBAL para que registro.js pueda acceder a los ciclos del día
let globalCiclosHoy = 0;

const MQTT_CONFIG = {
    broker: 'wss://d21941469193416fabcba46336fd0980.s1.eu.hivemq.cloud:8884/mqtt',
    options: {
        clientId: 'porton_monitor_' + Math.random().toString(16).substr(2, 8),
        username: 'porton_itibb',
        password: 'Porton2026',
        clean: true,
        reconnectPeriod: 5000,
        connectTimeout: 30000,
        rejectUnauthorized: false
    },
    topics: {
        estado: 'porton/estado',
        sensores: 'porton/sensores',
        heartbeat: 'porton/heartbeat',
        contador: 'porton/contador/valor'
    }
};

let mqttClient;
let lastHeartbeat = null;
let ultimoCicloGuardado = 0;
let totalAcumulado = 0;

// ============================================================
// CARGAR DATOS GUARDADOS AL INICIAR
// ============================================================
function cargarDatosPersistentes() {
    // Cargar total acumulado
    const guardadoTotal = localStorage.getItem('porton_total_acumulado');
    totalAcumulado = guardadoTotal ? parseInt(guardadoTotal) : 0;
    
    // Cargar el último ciclo guardado (del ESP32)
    const guardadoUltimoCiclo = localStorage.getItem('ultimo_ciclo_esp32');
    ultimoCicloGuardado = guardadoUltimoCiclo ? parseInt(guardadoUltimoCiclo) : 0;
    
    console.log(`📊 Total acumulado cargado: ${totalAcumulado} ciclos`);
    console.log(`🔄 Último ciclo ESP32 guardado: ${ultimoCicloGuardado} ciclos`);
    
    if (typeof mantenimiento !== 'undefined') {
        mantenimiento.ciclos.total = totalAcumulado;
        mantenimiento.guardarCiclos();
        if (typeof actualizarEstadisticas === 'function') actualizarEstadisticas();
    }
}

// ============================================================
// GUARDAR DATOS PERSISTENTES
// ============================================================
function guardarTotalAcumulado() {
    localStorage.setItem('porton_total_acumulado', totalAcumulado.toString());
    console.log(`💾 Total acumulado guardado: ${totalAcumulado} ciclos`);
}

function guardarUltimoCicloESP32(ciclos) {
    localStorage.setItem('ultimo_ciclo_esp32', ciclos.toString());
    console.log(`💾 Último ciclo ESP32 guardado: ${ciclos} ciclos`);
}

// ============================================================
// GUARDAR CICLO DIARIO PARA REPORTES
// ============================================================
function guardarCicloDiario(fecha, ciclos) {
    let historialDiario = JSON.parse(localStorage.getItem('historial_diario') || '[]');
    const index = historialDiario.findIndex(item => item.fecha === fecha);
    
    if (index !== -1) {
        historialDiario[index].ciclos = ciclos;
        historialDiario[index].timestamp = new Date().toISOString();
    } else {
        historialDiario.push({
            fecha: fecha,
            ciclos: ciclos,
            timestamp: new Date().toISOString()
        });
    }
    
    historialDiario.sort((a, b) => a.fecha.localeCompare(b.fecha));
    
    if (historialDiario.length > 365) {
        historialDiario = historialDiario.slice(-365);
    }
    
    localStorage.setItem('historial_diario', JSON.stringify(historialDiario));
    console.log(`📅 Guardado ciclo diario: ${fecha} → ${ciclos} ciclos`);
}

// ============================================================
// DETECTAR CAMBIO DE DÍA
// ============================================================
function detectarCambioDeDia(fechaActual) {
    const ultimaFecha = localStorage.getItem('ultima_fecha_contador');
    
    if (ultimaFecha && ultimaFecha !== fechaActual) {
        console.log(`🔄 Cambio de día detectado: ${ultimaFecha} → ${fechaActual}`);
        
        // Guardar los ciclos del día anterior
        if (ultimoCicloGuardado > 0) {
            guardarCicloDiario(ultimaFecha, ultimoCicloGuardado);
            console.log(`📅 Ciclos del día ${ultimaFecha}: ${ultimoCicloGuardado}`);
        }
        
        // Reiniciar el contador de referencia para el nuevo día
        ultimoCicloGuardado = 0;
        return true;
    }
    
    return false;
}

function connectMQTT() {
    console.log('🔌 Conectando a MQTT broker:', MQTT_CONFIG.broker);
    
    cargarDatosPersistentes();
    
    mqttClient = mqtt.connect(MQTT_CONFIG.broker, MQTT_CONFIG.options);
    
    mqttClient.on('connect', () => {
        console.log('✅ Conectado a HiveMQ Cloud');
        updateMQTTStatus(true);
        
        Object.values(MQTT_CONFIG.topics).forEach(topic => {
            mqttClient.subscribe(topic, { qos: 1 }, (err) => {
                if (!err) {
                    console.log(`📡 Suscrito a: ${topic}`);
                } else {
                    console.error(`❌ Error suscribiendo a ${topic}:`, err);
                }
            });
        });
    });
    
    mqttClient.on('error', (err) => {
        console.error('❌ Error MQTT:', err);
        updateMQTTStatus(false);
    });
    
    mqttClient.on('message', (topic, message) => {
        try {
            const payload = JSON.parse(message.toString());
            console.log(`📨 Mensaje recibido [${topic}]:`, payload);
            handleMQTTMessage(topic, payload);
        } catch (e) {
            console.error('Error parsing message:', e);
        }
    });
}

function updateMQTTStatus(connected) {
    const statusDiv = document.querySelector('.mqtt-status');
    const indicator = statusDiv?.querySelector('.status-indicator');
    const text = statusDiv?.querySelector('.status-text');
    
    if (indicator) {
        if (connected) {
            indicator.classList.add('online');
            indicator.classList.remove('offline');
        } else {
            indicator.classList.remove('online');
            indicator.classList.add('offline');
        }
    }
    
    if (text) {
        text.textContent = connected ? 'MQTT Conectado' : 'Desconectado';
    }
}

function handleMQTTMessage(topic, data) {
    const timestamp = new Date().toISOString();
    const ahora = new Date();
    const hoy = ahora.toISOString().split('T')[0];
    
    switch(topic) {
        case 'porton/estado':
            const stateSpan = document.getElementById('currentState');
            if (stateSpan && data.estado) {
                stateSpan.textContent = data.estado;
                console.log(`🚪 Estado actualizado: ${data.estado}`);
            }
            if (typeof registro !== 'undefined') {
                registro.agregarEvento('ESTADO', data);
            }
            if (typeof actualizarEstadisticas === 'function') actualizarEstadisticas();
            if (typeof actualizarGraficos === 'function') actualizarGraficos();
            if (typeof notificaciones !== 'undefined') {
                notificaciones.alertaEstado(data.estado);
            }
            break;
            
        case 'porton/sensores':
            if (typeof registro !== 'undefined') {
                registro.agregarEvento('SENSORES', data);
            }
            if (typeof mantenimiento !== 'undefined') {
                mantenimiento.procesarSensores(data, timestamp);
            }
            break;
            
        case 'porton/heartbeat':
            lastHeartbeat = data.online;
            if (typeof registro !== 'undefined') {
                registro.agregarEvento('HEARTBEAT', { online: data.online });
            }
            break;
            
        case 'porton/contador/valor':
            const ciclosHoyRecibidos = data.ciclos;
            
            if (ciclosHoyRecibidos !== undefined) {
                // Actualizar variable GLOBAL
                globalCiclosHoy = ciclosHoyRecibidos;
                
                // Detectar cambio de día
                detectarCambioDeDia(hoy);
                
                // ============================================================
                // LÓGICA PRINCIPAL: diferencia entre el ciclo actual y el último guardado
                // ============================================================
                let diferencia = 0;
                
                if (ciclosHoyRecibidos >= ultimoCicloGuardado) {
                    // Caso normal: el contador subió o se quedó igual
                    diferencia = ciclosHoyRecibidos - ultimoCicloGuardado;
                } else {
                    // Caso: el ESP32 se reinició (contador menor al anterior)
                    // Esto también puede indicar cambio de día (ya detectado arriba)
                    diferencia = ciclosHoyRecibidos;
                }
                
                if (diferencia > 0) {
                    // Sumar la diferencia al total acumulado
                    totalAcumulado += diferencia;
                    guardarTotalAcumulado();
                    
                    console.log(`📊 +${diferencia} ciclos nuevos (${ultimoCicloGuardado} → ${ciclosHoyRecibidos})`);
                    console.log(`📈 Total acumulado: ${totalAcumulado} ciclos`);
                    console.log(`📅 Ciclos hoy (ESP32): ${ciclosHoyRecibidos}`);
                    
                    if (typeof mantenimiento !== 'undefined') {
                        mantenimiento.ciclos.total = totalAcumulado;
                        mantenimiento.guardarCiclos();
                    }
                    
                    if (typeof actualizarEstadisticas === 'function') actualizarEstadisticas();
                    if (typeof actualizarGraficos === 'function') actualizarGraficos();
                    
                    if (typeof registro !== 'undefined') {
                        registro.agregarEvento('CONTADOR', { 
                            ciclosHoy: ciclosHoyRecibidos,
                            totalAcumulado: totalAcumulado,
                            nuevos: diferencia,
                            timestamp: data.timestamp 
                        });
                    }
                } else {
                    console.log(`📊 Sin cambios (último: ${ultimoCicloGuardado}, actual: ${ciclosHoyRecibidos})`);
                }
                
                // Guardar el nuevo valor para futuras comparaciones
                ultimoCicloGuardado = ciclosHoyRecibidos;
                guardarUltimoCicloESP32(ultimoCicloGuardado);
                localStorage.setItem('ultima_fecha_contador', hoy);
                
                // Actualizar la UI directamente
                const todayCyclesSpan = document.getElementById('todayCycles');
                if (todayCyclesSpan) {
                    todayCyclesSpan.textContent = ciclosHoyRecibidos;
                }
                
                const totalCyclesSpan = document.getElementById('totalCycles');
                if (totalCyclesSpan) {
                    totalCyclesSpan.textContent = totalAcumulado;
                }
            }
            break;
            
        default:
            console.log(`Topic no manejado: ${topic}`, data);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    connectMQTT();
});
