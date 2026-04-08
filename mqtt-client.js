// ============================================================
// CONFIGURACIÓN MQTT PARA BROKER PRIVADO DE HIVEMQ CLOUD
// ============================================================

const MQTT_CONFIG = {
    broker: 'wss://fce01a048733432a9eae2f8d8454ef46.s1.eu.hivemq.cloud:8884/mqtt',
    options: {
        clientId: 'porton_monitor_' + Math.random().toString(16).substr(2, 8),
        username: 'prueba',
        password: 'Prueba2026',
        clean: true,
        reconnectPeriod: 5000,
        connectTimeout: 30000,
        rejectUnauthorized: false
    },
    topics: {
        estado: 'porton/estado',
        sensores: 'porton/sensores',
        heartbeat: 'porton/heartbeat'
    }
};

let mqttClient;
let lastHeartbeat = null;

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
    
    switch(topic) {
        case 'porton/estado':
            registro.agregarEvento('ESTADO', data);
            const stateSpan = document.getElementById('currentState');
            if (stateSpan && data.estado) {
                stateSpan.textContent = data.estado;
            }
            mantenimiento.procesarCambioEstado(data.estado, timestamp);
            actualizarEstadisticas();
            actualizarGraficos();
            if (typeof notificaciones !== 'undefined') {
                notificaciones.alertaEstado(data.estado);
            }
            break;
            
        case 'porton/sensores':
            registro.agregarEvento('SENSORES', data);
            // PROCESAR SENSORES PARA CONTAR CICLOS (flanco de subida)
            mantenimiento.procesarSensores(data, timestamp);
            break;
            
        case 'porton/heartbeat':
            lastHeartbeat = data.online;
            registro.agregarEvento('HEARTBEAT', { online: data.online });
            break;
            
        default:
            console.log(`Topic no manejado: ${topic}`, data);
    }
}

// Iniciar conexión cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', () => {
    connectMQTT();
});
