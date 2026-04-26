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
            mantenimiento.procesarSensores(data, timestamp);
            break;
            
        case 'porton/heartbeat':
            lastHeartbeat = data.online;
            registro.agregarEvento('HEARTBEAT', { online: data.online });
            break;
            
        case 'porton/contador/valor':
            console.log(`📊 Contador ESP32: ${data.ciclos} ciclos`);
            if (data.ciclos !== undefined) {
                mantenimiento.ciclos.total = data.ciclos;
                mantenimiento.guardarCiclos();
                actualizarEstadisticas();
                actualizarGraficos();
                registro.agregarEvento('CONTADOR', { ciclos: data.ciclos, timestamp: data.timestamp });
                console.log(`✅ Sincronizado con ESP32: ${data.ciclos} ciclos totales`);
            }
            break;
            
        default:
            console.log(`Topic no manejado: ${topic}`, data);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    connectMQTT();
});
