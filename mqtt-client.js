// ============================================================
// CONFIGURACIÓN MQTT - CON SINCRONIZACIÓN CON SUPABASE
// ============================================================

let globalCiclosHoy = 0;
let globalTotalAcumulado = 0;

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
// SUPABASE - LECTURA DEL TOTAL GLOBAL
// ============================================================
const SUPABASE_URL = 'https://zdwonipaqrixxgfhxjjt.supabase.co';
const SUPABASE_KEY = 'sb_publishable_hAfw0kf-IxPbIzd9y3nThw_nwoDZf-P';

async function leerTotalDesdeSupabase() {
    try {
        const response = await fetch(`${SUPABASE_URL}/rest/v1/ciclos?select=total_ciclos`, {
            headers: {
                'apikey': SUPABASE_KEY,
                'Authorization': `Bearer ${SUPABASE_KEY}`
            }
        });
        
        const data = await response.json();
        const ultimoRegistro = data[data.length - 1];
        const total = ultimoRegistro?.total_ciclos || 0;
        
        console.log('📊 Total en Supabase:', total);
        
        globalTotalAcumulado = total;
        
        if (typeof mantenimiento !== 'undefined') {
            mantenimiento.ciclos.total = total;
            mantenimiento.guardarCiclos();
            if (typeof actualizarEstadisticas === 'function') actualizarEstadisticas();
            if (typeof actualizarGraficos === 'function') actualizarGraficos();
        }
        
        const totalSpan = document.getElementById('totalCycles');
        if (totalSpan) totalSpan.textContent = total;
        
        console.log(`🌍 Sincronizado con Supabase: ${total} ciclos totales`);
        
    } catch (error) {
        console.log('⚠️ Error leyendo desde Supabase:', error);
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
            if (topic === 'porton/heartbeat') {
                const online = message.toString() === 'online';
                if (typeof registro !== 'undefined') {
                    registro.agregarEvento('HEARTBEAT', { online: online });
                }
                return;
            }
            
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
            // ============================================
            // ACTUALIZAR EL ESTADO ACTUAL
            // ============================================
            console.log('🚪 ESTADO RECIBIDO:', data.estado);
            
            const stateSpan = document.getElementById('currentState');
            if (stateSpan) {
                // Mostrar el estado con formato bonito
                if (data.estado === 'ABIERTO') {
                    stateSpan.innerHTML = '✅ ABIERTO';
                } else if (data.estado === 'CERRADO') {
                    stateSpan.innerHTML = '🔒 CERRADO';
                } else {
                    stateSpan.innerHTML = '⚠️ ' + data.estado;
                }
                console.log(`✅ Estado actualizado a: ${data.estado}`);
            }
            
            // Actualizar la última actualización
            const lastUpdateSpan = document.getElementById('lastUpdate');
            if (lastUpdateSpan) {
                lastUpdateSpan.textContent = `Último: ahora`;
            }
            
            // Registrar evento
            if (typeof registro !== 'undefined') {
                registro.agregarEvento('ESTADO', data);
            }
            
            // Notificación
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
            // Ya manejado arriba
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
                    console.log(`📈 Total acumulado: ${globalTotalAcumulado} ciclos`);
                    console.log(`📅 Ciclos hoy: ${ciclosHoyRecibidos}`);
                    
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
    
    // Actualizar gráficos y estadísticas generales
    if (typeof actualizarEstadisticas === 'function') actualizarEstadisticas();
    if (typeof actualizarGraficos === 'function') actualizarGraficos();
}

// ============================================================
// INICIALIZACIÓN
// ============================================================
document.addEventListener('DOMContentLoaded', () => {
    cargarDatosLocales();
    connectMQTT();
    leerTotalDesdeSupabase();
    setInterval(leerTotalDesdeSupabase, 10000);
});
