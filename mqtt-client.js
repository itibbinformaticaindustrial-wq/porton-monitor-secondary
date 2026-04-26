// ============================================================
// CONFIGURACIÓN MQTT - NUEVAS CREDENCIALES
// Broker: d21941469193416fabcba46336fd0980.s1.eu.hivemq.cloud
// Usuario: porton_itibb
// Contraseña: Porton2026
// ============================================================

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
let ultimoCicloRegistrado = 0; // Para evitar duplicados

function connectMQTT() {
    console.log('🔌 Conectando a MQTT broker:', MQTT_CONFIG.broker);
    
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
    const horaActual = ahora.getHours();
    
    switch(topic) {
        case 'porton/estado':
            // ============================================
            // 1. ACTUALIZAR ESTADO ACTUAL EN LA UI
            // ============================================
            const stateSpan = document.getElementById('currentState');
            if (stateSpan && data.estado) {
                stateSpan.textContent = data.estado;
                console.log(`🚪 Estado actualizado: ${data.estado}`);
            }
            
            // Registrar evento
            registro.agregarEvento('ESTADO', data);
            
            // Actualizar gráficos y estadísticas
            actualizarEstadisticas();
            actualizarGraficos();
            
            // Notificación si está habilitada
            if (typeof notificaciones !== 'undefined') {
                notificaciones.alertaEstado(data.estado);
            }
            break;
            
        case 'porton/sensores':
            registro.agregarEvento('SENSORES', data);
            mantenimiento.procesarSensores(data, timestamp);
            break;
            
        case 'porton/heartbeat':
            lastHeartbeat = data.online;
            registro.agregarEvento('HEARTBEAT', { online: data.online });
            break;
            
        case 'porton/contador/valor':
            // ============================================
            // 2. ACTUALIZAR CONTADOR DE CICLOS
            // ============================================
            const ciclosRecibidos = data.ciclos;
            
            if (ciclosRecibidos !== undefined && ciclosRecibidos > ultimoCicloRegistrado) {
                // Actualizar ciclos totales
                mantenimiento.ciclos.total = ciclosRecibidos;
                
                // ============================================
                // 3. ACTUALIZAR HISTORIAL PARA "CICLOS HOY"
                // ============================================
                // Buscar si ya hay un registro para hoy
                const indexHoy = mantenimiento.ciclos.historial.findIndex(c => c.fecha === hoy);
                
                if (indexHoy !== -1) {
                    // Actualizar el registro de hoy con el último valor
                    mantenimiento.ciclos.historial[indexHoy] = {
                        numero: ciclosRecibidos,
                        timestamp: timestamp,
                        fecha: hoy,
                        hora: horaActual,
                        minuto: ahora.getMinutes(),
                        segundo: ahora.getSeconds()
                    };
                } else {
                    // Crear nuevo registro para hoy
                    mantenimiento.ciclos.historial.unshift({
                        numero: ciclosRecibidos,
                        timestamp: timestamp,
                        fecha: hoy,
                        hora: horaActual,
                        minuto: ahora.getMinutes(),
                        segundo: ahora.getSeconds()
                    });
                }
                
                // Mantener solo los últimos 365 días (para gráficos)
                if (mantenimiento.ciclos.historial.length > 365) {
                    mantenimiento.ciclos.historial = mantenimiento.ciclos.historial.slice(0, 365);
                }
                
                // Guardar cambios
                mantenimiento.guardarCiclos();
                
                // Actualizar UI
                actualizarEstadisticas();
                actualizarGraficos();
                
                // Registrar evento
                registro.agregarEvento('CONTADOR', { 
                    ciclos: ciclosRecibidos, 
                    ciclosHoy: mantenimiento.obtenerCiclosHoy(),
                    timestamp: data.timestamp 
                });
                
                console.log(`✅ CICLOS TOTALES: ${ciclosRecibidos}`);
                console.log(`📅 CICLOS HOY: ${mantenimiento.obtenerCiclosHoy()}`);
                
                ultimoCicloRegistrado = ciclosRecibidos;
            }
            break;
            
        default:
            console.log(`Topic no manejado: ${topic}`, data);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    connectMQTT();
});
