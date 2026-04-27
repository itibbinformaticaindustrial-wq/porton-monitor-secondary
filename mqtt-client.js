// ============================================================
// CONFIGURACIÓN MQTT - CON SINCRONIZACIÓN CON SUPABASE
// ============================================================

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

// ============================================================
// SUPABASE - LECTURA DEL TOTAL GLOBAL (usando ID)
// ============================================================
const SUPABASE_URL = 'https://zdwonipaqrixxgfhxjjt.supabase.co';
const SUPABASE_KEY = 'sb_publishable_hAfw0kf-IxPbIzd9y3nThw_nwoDZf-P';

async function leerTotalDesdeSupabase() {
    try {
        // Consultar el ID más alto (último registro)
        const response = await fetch(`${SUPABASE_URL}/rest/v1/ciclos?select=id&order=id.desc&limit=1`, {
            headers: {
                'apikey': SUPABASE_KEY,
                'Authorization': `Bearer ${SUPABASE_KEY}`
            }
        });
        
        const data = await response.json();
        // El total acumulado es el ID del último registro
        const totalAcumulado = data[0]?.id || 0;
        
        console.log('📊 Total acumulado (por ID):', totalAcumulado);
        
        if (typeof mantenimiento !== 'undefined') {
            mantenimiento.ciclos.total = totalAcumulado;
            mantenimiento.guardarCiclos();
            if (typeof actualizarEstadisticas === 'function') actualizarEstadisticas();
            if (typeof actualizarGraficos === 'function') actualizarGraficos();
        }
        
        const totalSpan = document.getElementById('totalCycles');
        if (totalSpan) totalSpan.textContent = totalAcumulado;
        
    } catch (error) {
        console.log('⚠️ Error leyendo desde Supabase:', error);
    }
}

// ============================================================
// CARGAR DATOS GUARDADOS LOCALMENTE (respaldo)
// ============================================================
function cargarDatosLocales() {
    const guardadoCiclosHoy = localStorage.getItem('porton_ciclos_hoy');
    if (guardadoCiclosHoy) {
        globalCiclosHoy = parseInt(guardadoCiclosHoy);
    }
    
    const todayCyclesSpan = document.getElementById('todayCycles');
    if (todayCyclesSpan) {
        todayCyclesSpan.textContent = globalCiclosHoy;
    }
}

function guardarCiclosHoy(ciclos) {
    localStorage.setItem('porton_ciclos_hoy', ciclos.toString());
}

function detectarCambioDeDia() {
    const ultimaFecha = localStorage.getItem('ultima_fecha_contador');
    const hoy = new Date().toISOString().split('T')[0];
    
    if (ultimaFecha && ultimaFecha !== hoy) {
        console.log(`🔄 Cambio de día detectado: ${ultimaFecha} → ${hoy}`);
        globalCiclosHoy = 0;
        guardarCiclosHoy(0);
        localStorage.setItem('ultima_fecha_contador', hoy);
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
                console.log(`✅ Estado actualizado a: ${data.estado}`);
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
                // Detectar cambio de día
                const ultimaFecha = localStorage.getItem('ultima_fecha_contador');
                if (ultimaFecha && ultimaFecha !== hoy) {
                    console.log(`🔄 Cambio de día: ${ultimaFecha} → ${hoy}`);
                    globalCiclosHoy = 0;
                }
                
                // Actualizar ciclos del día
                globalCiclosHoy = ciclosHoyRecibidos;
                guardarCiclosHoy(globalCiclosHoy);
                localStorage.setItem('ultima_fecha_contador', hoy);
                
                console.log(`📅 Ciclos hoy: ${globalCiclosHoy}`);
                
                const todayCyclesSpan = document.getElementById('todayCycles');
                if (todayCyclesSpan) {
                    todayCyclesSpan.textContent = globalCiclosHoy;
                }
                
                // Guardar para reporte diario (al final del día)
                guardarCicloDiario(hoy, globalCiclosHoy);
                
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
document.addEventListener('DOMContentLoaded', () => {
    cargarDatosLocales();
    connectMQTT();
    leerTotalDesdeSupabase();
    setInterval(leerTotalDesdeSupabase, 10000);
});
