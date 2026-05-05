// ============================================================
// SMARTGATE - CONFIGURACIÓN MQTT CON SUPABASE (NUEVA VERSIÓN)
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
// SUPABASE - CREDENCIALES
// ============================================================
const SUPABASE_URL = 'https://zdwonipaqrixxgfhxjjt.supabase.co';
const SUPABASE_KEY = 'sb_publishable_hAfw0kf-IxPbIzd9y3nThw_nwoDZf-P';

// ============================================================
// FUNCIÓN: Obtener resumen completo desde Supabase
// ============================================================
async function obtenerResumenSupabase() {
    try {
        const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/obtener_resumen`, {
            method: 'POST',
            headers: {
                'apikey': SUPABASE_KEY,
                'Authorization': `Bearer ${SUPABASE_KEY}`,
                'Content-Type': 'application/json'
            }
        });
        
        const data = await response.json();
        
        console.log('📊 Resumen desde Supabase:', data);
        
        // Actualizar variables globales
        globalTotalAcumulado = data.total_acumulado || 0;
        globalCiclosHoy = data.ciclos_hoy || 0;
        
        // Actualizar mantenimiento
        if (typeof mantenimiento !== 'undefined') {
            mantenimiento.ciclos.total = globalTotalAcumulado;
            mantenimiento.guardarCiclos();
        }
        
        // Actualizar UI
        const totalSpan = document.getElementById('totalCycles');
        if (totalSpan) totalSpan.textContent = globalTotalAcumulado;
        
        const todaySpan = document.getElementById('todayCycles');
        if (todaySpan) todaySpan.textContent = globalCiclosHoy;
        
        if (typeof actualizarEstadisticas === 'function') actualizarEstadisticas();
        if (typeof actualizarGraficos === 'function') actualizarGraficos();
        
        // Datos para gráficos (últimos 30 días)
        if (data.ultimos_dias && data.ultimos_dias.length > 0) {
            console.log(`📈 Datos de gráficos: ${data.ultimos_dias.length} días`);
            // Aquí podrías actualizar el gráfico directamente
        }
        
        return data;
        
    } catch (error) {
        console.log('⚠️ Error obteniendo resumen de Supabase:', error);
        return null;
    }
}

// ============================================================
// FUNCIÓN: Registrar ciclos del ESP32 en Supabase
// ============================================================
async function registrarCiclosEnSupabase(ciclosHoy, fecha = null) {
    try {
        const body = {
            p_ciclos_hoy: ciclosHoy
        };
        if (fecha) body.p_fecha = fecha;
        
        const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/registrar_ciclos_esp32`, {
            method: 'POST',
            headers: {
                'apikey': SUPABASE_KEY,
                'Authorization': `Bearer ${SUPABASE_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(body)
        });
        
        const data = await response.json();
        
        if (data.exito) {
            console.log('✅ Ciclos registrados en Supabase:', data);
            // Actualizar variables globales con los valores devueltos
            globalTotalAcumulado = data.total_acumulado;
            globalCiclosHoy = data.ciclos_hoy;
            
            if (typeof mantenimiento !== 'undefined') {
                mantenimiento.ciclos.total = globalTotalAcumulado;
                mantenimiento.guardarCiclos();
            }
            
            // Actualizar UI
            const totalSpan = document.getElementById('totalCycles');
            if (totalSpan) totalSpan.textContent = globalTotalAcumulado;
            
            const todaySpan = document.getElementById('todayCycles');
            if (todaySpan) todaySpan.textContent = globalCiclosHoy;
            
            if (typeof actualizarEstadisticas === 'function') actualizarEstadisticas();
            if (typeof actualizarGraficos === 'function') actualizarGraficos();
        }
        
        return data;
        
    } catch (error) {
        console.log('⚠️ Error registrando ciclos en Supabase:', error);
        return null;
    }
}

// ============================================================
// CARGAR DATOS LOCALES (RESPALDO)
// ============================================================
function cargarDatosLocales() {
    const guardadoTotal = localStorage.getItem('porton_total_acumulado');
    if (guardadoTotal) {
        globalTotalAcumulado = parseInt(guardadoTotal);
        console.log(`📀 Total local: ${globalTotalAcumulado} ciclos (respaldo)`);
    }
    
    const guardadoCiclosHoy = localStorage.getItem('porton_ciclos_hoy');
    if (guardadoCiclosHoy) {
        globalCiclosHoy = parseInt(guardadoCiclosHoy);
    }
    
    const totalSpan = document.getElementById('totalCycles');
    if (totalSpan && globalTotalAcumulado > 0) totalSpan.textContent = globalTotalAcumulado;
    
    const todaySpan = document.getElementById('todayCycles');
    if (todaySpan && globalCiclosHoy > 0) todaySpan.textContent = globalCiclosHoy;
}

function guardarCiclosHoy(ciclos) {
    localStorage.setItem('porton_ciclos_hoy', ciclos.toString());
}

function guardarTotalAcumulado(total) {
    localStorage.setItem('porton_total_acumulado', total.toString());
}

// ============================================================
// MQTT CONEXIÓN
// ============================================================
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

// ============================================================
// PROCESAR MENSAJES MQTT
// ============================================================
function handleMQTTMessage(topic, data) {
    const ahora = new Date();
    const hoy = ahora.toISOString().split('T')[0];
    
    switch(topic) {
        case 'porton/estado':
            console.log('🚪 ESTADO RECIBIDO:', data.estado);
            
            const stateSpan = document.getElementById('currentState');
            if (stateSpan) {
                if (data.estado === 'ABIERTO') {
                    stateSpan.innerHTML = '✅ ABIERTO';
                } else if (data.estado === 'CERRADO') {
                    stateSpan.innerHTML = '🔒 CERRADO';
                } else {
                    stateSpan.innerHTML = '⚠️ ' + data.estado;
                }
            }
            
            const lastUpdateSpan = document.getElementById('lastUpdate');
            if (lastUpdateSpan) {
                lastUpdateSpan.textContent = `Último: ahora`;
            }
            
            if (typeof registro !== 'undefined') {
                registro.agregarEvento('ESTADO', data);
            }
            
            if (typeof notificaciones !== 'undefined') {
                notificaciones.alertaEstado(data.estado);
            }
            break;
            
        case 'porton/sensores':
            if (typeof registro !== 'undefined') {
                registro.agregarEvento('SENSORES', data);
            }
            break;
            
        case 'porton/contador/valor':
            const ciclosHoyRecibidos = data.ciclos;
            
            if (ciclosHoyRecibidos !== undefined) {
                console.log(`📊 ESP32 envía: ${ciclosHoyRecibidos} ciclos hoy`);
                
                // Detectar cambio de día
                const ultimaFecha = localStorage.getItem('ultima_fecha_contador');
                if (ultimaFecha && ultimaFecha !== hoy) {
                    console.log(`🔄 Cambio de día detectado: ${ultimaFecha} → ${hoy}`);
                }
                
                // Guardar en localStorage (respaldo)
                globalCiclosHoy = ciclosHoyRecibidos;
                guardarCiclosHoy(globalCiclosHoy);
                localStorage.setItem('ultima_fecha_contador', hoy);
                
                // ACTUALIZAR SUPABASE (LO MÁS IMPORTANTE)
                registrarCiclosEnSupabase(ciclosHoyRecibidos, hoy);
                
                // Actualizar UI localmente
                const todayCyclesSpan = document.getElementById('todayCycles');
                if (todayCyclesSpan) {
                    todayCyclesSpan.textContent = ciclosHoyRecibidos;
                }
                
                if (typeof registro !== 'undefined') {
                    registro.agregarEvento('CONTADOR', { 
                        ciclosHoy: ciclosHoyRecibidos,
                        timestamp: data.timestamp 
                    });
                }
            }
            break;
            
        default:
            console.log(`Topic no manejado: ${topic}`, data);
    }
    
    if (typeof actualizarEstadisticas === 'function') actualizarEstadisticas();
    if (typeof actualizarGraficos === 'function') actualizarGraficos();
}

// ============================================================
// INICIALIZACIÓN
// ============================================================
document.addEventListener('DOMContentLoaded', async () => {
    console.log('🚀 Inicializando SmartGate Monitor...');
    
    // 1. Cargar datos locales como respaldo
    cargarDatosLocales();
    
    // 2. Obtener resumen desde Supabase (fuente de verdad)
    await obtenerResumenSupabase();
    
    // 3. Conectar MQTT
    connectMQTT();
    
    // 4. Actualizar cada 10 segundos
    setInterval(obtenerResumenSupabase, 10000);
});
