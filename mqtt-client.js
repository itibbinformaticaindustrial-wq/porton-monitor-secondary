// ============================================================
// CONFIGURACIÓN MQTT - CON SINCRONIZACIÓN GLOBAL VÍA NODE-RED
// ============================================================

let globalCiclosHoy = 0;
let globalTotalAcumulado = 0;
let sincronizacionCompletada = false;

// URL de Node-RED (contador global)
const NODE_RED_URL = 'https://redesigned-xylophone-7799w6wxpqj63r4g7-1880.app.github.dev';

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

// ============================================================
// SINCRONIZAR CON NODE-RED (CONTADOR GLOBAL)
// ============================================================
async function sincronizarConNodeRED() {
    try {
        console.log('🔄 Sincronizando con Node-RED...');
        const response = await fetch(`${NODE_RED_URL}/api/ciclos`);
        const data = await response.json();
        
        if (data.success && data.totalCiclos !== undefined) {
            globalTotalAcumulado = data.totalCiclos;
            
            if (typeof mantenimiento !== 'undefined') {
                mantenimiento.ciclos.total = globalTotalAcumulado;
                mantenimiento.guardarCiclos();
            }
            
            // Forzar actualización de la UI inmediatamente
            const totalCyclesSpan = document.getElementById('totalCycles');
            if (totalCyclesSpan) {
                totalCyclesSpan.textContent = globalTotalAcumulado;
            }
            
            if (typeof actualizarEstadisticas === 'function') {
                actualizarEstadisticas();
            }
            
            sincronizacionCompletada = true;
            console.log(`🌍 Sincronizado con Node-RED: ${globalTotalAcumulado} ciclos totales`);
            return true;
        }
    } catch (error) {
        console.log('⚠️ No se pudo sincronizar con Node-RED', error);
        return false;
    }
}

// ============================================================
// ESPERAR LA SINCRONIZACIÓN INICIAL
// ============================================================
async function esperarSincronizacionInicial() {
    console.log('⏳ Esperando sincronización inicial con Node-RED...');
    let intentos = 0;
    const maxIntentos = 10;
    
    while (!sincronizacionCompletada && intentos < maxIntentos) {
        await sincronizarConNodeRED();
        if (!sincronizacionCompletada) {
            await new Promise(resolve => setTimeout(resolve, 1000));
            intentos++;
        }
    }
    
    if (sincronizacionCompletada) {
        console.log('✅ Sincronización inicial completada');
    } else {
        console.log('⚠️ No se pudo sincronizar inicialmente, usando valores locales');
        cargarDatosLocales();
    }
}

// ============================================================
// CARGAR DATOS GUARDADOS LOCALMENTE (respaldo)
// ============================================================
function cargarDatosLocales() {
    const guardadoTotal = localStorage.getItem('porton_total_acumulado');
    if (guardadoTotal && globalTotalAcumulado === 0) {
        globalTotalAcumulado = parseInt(guardadoTotal);
        if (typeof mantenimiento !== 'undefined') {
            mantenimiento.ciclos.total = globalTotalAcumulado;
            mantenimiento.guardarCiclos();
        }
        console.log(`📀 Total acumulado local: ${globalTotalAcumulado} ciclos (respaldo)`);
        
        const totalCyclesSpan = document.getElementById('totalCycles');
        if (totalCyclesSpan) {
            totalCyclesSpan.textContent = globalTotalAcumulado;
        }
    }
    
    const guardadoUltimoCiclo = localStorage.getItem('ultimo_ciclo_esp32');
    ultimoCicloGuardado = guardadoUltimoCiclo ? parseInt(guardadoUltimoCiclo) : 0;
}

function guardarUltimoCicloESP32(ciclos) {
    localStorage.setItem('ultimo_ciclo_esp32', ciclos.toString());
}

function guardarTotalAcumulado() {
    localStorage.setItem('porton_total_acumulado', globalTotalAcumulado.toString());
}

// ============================================================
// DETECTAR CAMBIO DE DÍA
// ============================================================
function detectarCambioDeDia(fechaActual) {
    const ultimaFecha = localStorage.getItem('ultima_fecha_contador');
    
    if (ultimaFecha && ultimaFecha !== fechaActual) {
        console.log(`🔄 Cambio de día detectado: ${ultimaFecha} → ${fechaActual}`);
        ultimoCicloGuardado = 0;
        return true;
    }
    return false;
}

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
}

function connectMQTT() {
    console.log('🔌 Conectando a MQTT broker...');
    
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
                globalCiclosHoy = ciclosHoyRecibidos;
                detectarCambioDeDia(hoy);
                
                let diferencia = 0;
                if (ciclosHoyRecibidos >= ultimoCicloGuardado) {
                    diferencia = ciclosHoyRecibidos - ultimoCicloGuardado;
                } else {
                    diferencia = ciclosHoyRecibidos;
                }
                
                if (diferencia > 0) {
                    globalTotalAcumulado += diferencia;
                    guardarTotalAcumulado();
                    
                    console.log(`📊 +${diferencia} ciclos nuevos`);
                    console.log(`🌍 Total acumulado: ${globalTotalAcumulado} ciclos`);
                    console.log(`📅 Ciclos hoy (ESP32): ${ciclosHoyRecibidos}`);
                    
                    if (typeof mantenimiento !== 'undefined') {
                        mantenimiento.ciclos.total = globalTotalAcumulado;
                        mantenimiento.guardarCiclos();
                    }
                    
                    if (typeof actualizarEstadisticas === 'function') actualizarEstadisticas();
                    if (typeof actualizarGraficos === 'function') actualizarGraficos();
                    
                    if (typeof registro !== 'undefined') {
                        registro.agregarEvento('CONTADOR', { 
                            ciclosHoy: ciclosHoyRecibidos,
                            totalAcumulado: globalTotalAcumulado,
                            nuevos: diferencia,
                            timestamp: data.timestamp 
                        });
                    }
                }
                
                ultimoCicloGuardado = ciclosHoyRecibidos;
                guardarUltimoCicloESP32(ultimoCicloGuardado);
                localStorage.setItem('ultima_fecha_contador', hoy);
                
                const todayCyclesSpan = document.getElementById('todayCycles');
                if (todayCyclesSpan) {
                    todayCyclesSpan.textContent = ciclosHoyRecibidos;
                }
                
                const totalCyclesSpan = document.getElementById('totalCycles');
                if (totalCyclesSpan) {
                    totalCyclesSpan.textContent = globalTotalAcumulado;
                }
            }
            break;
            
        default:
            console.log(`Topic no manejado: ${topic}`, data);
    }
}

// Sincronizar con Node-RED cada 30 segundos
setInterval(sincronizarConNodeRED, 30000);

document.addEventListener('DOMContentLoaded', () => {
    esperarSincronizacionInicial().then(() => {
        connectMQTT();
    });
});
