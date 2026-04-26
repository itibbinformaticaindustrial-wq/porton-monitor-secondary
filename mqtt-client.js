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
let ultimoCicloRecibido = 0;
let totalAcumulado = 0;

// Cargar total acumulado al iniciar
function cargarTotalAcumulado() {
    const guardado = localStorage.getItem('porton_total_acumulado');
    totalAcumulado = guardado ? parseInt(guardado) : 0;
    console.log(`📊 Total acumulado cargado: ${totalAcumulado} ciclos`);
}

// Guardar total acumulado
function guardarTotalAcumulado() {
    localStorage.setItem('porton_total_acumulado', totalAcumulado.toString());
    console.log(`💾 Total acumulado guardado: ${totalAcumulado} ciclos`);
}

function connectMQTT() {
    console.log('🔌 Conectando a MQTT broker:', MQTT_CONFIG.broker);
    
    // Cargar total acumulado al iniciar
    cargarTotalAcumulado();
    
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
            registro.agregarEvento('ESTADO', data);
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
            // ============================================
            // EL ESP32 MANDA LOS CICLOS DEL DÍA
            // NOSOTROS ACUMULAMOS PARA EL TOTAL HISTÓRICO
            // ============================================
            const ciclosHoyRecibidos = data.ciclos;
            
            if (ciclosHoyRecibidos !== undefined) {
                // Verificar si es un nuevo día (el contador se reinició)
                const ultimaFecha = localStorage.getItem('ultima_fecha_contador');
                const fechaActual = hoy;
                
                if (ultimaFecha !== fechaActual && ciclosHoyRecibidos < ultimoCicloRecibido) {
                    // ¡Nuevo día! El ESP32 reinició su contador
                    console.log(`🔄 Nuevo día detectado: ${fechaActual}`);
                    
                    // Guardar el total del día anterior en el historial
                    const ciclosAyer = ultimoCicloRecibido;
                    if (ciclosAyer > 0) {
                        guardarCicloDiario(ultimaFecha, ciclosAyer);
                        console.log(`📅 Ciclos del día ${ultimaFecha}: ${ciclosAyer}`);
                    }
                    
                    // Reiniciar el contador del día
                    ultimoCicloRecibido = 0;
                }
                
                // Calcular nuevos ciclos (diferencia desde la última lectura)
                let nuevosCiclos = 0;
                if (ciclosHoyRecibidos >= ultimoCicloRecibido) {
                    nuevosCiclos = ciclosHoyRecibidos - ultimoCicloRecibido;
                } else {
                    // Reinicio sin cambio de día (por si acaso)
                    nuevosCiclos = ciclosHoyRecibidos;
                }
                
                if (nuevosCiclos > 0) {
                    // Sumar al total acumulado
                    totalAcumulado += nuevosCiclos;
                    guardarTotalAcumulado();
                    
                    console.log(`📊 +${nuevosCiclos} ciclos nuevos`);
                    console.log(`📈 Total acumulado: ${totalAcumulado} ciclos`);
                    console.log(`📅 Ciclos hoy (ESP32): ${ciclosHoyRecibidos}`);
                    
                    // Actualizar mantenimiento
                    mantenimiento.ciclos.total = totalAcumulado;
                    mantenimiento.guardarCiclos();
                    
                    // Actualizar UI
                    actualizarEstadisticas();
                    actualizarGraficos();
                    
                    // Registrar evento
                    registro.agregarEvento('CONTADOR', { 
                        ciclosHoy: ciclosHoyRecibidos,
                        totalAcumulado: totalAcumulado,
                        nuevos: nuevosCiclos,
                        timestamp: data.timestamp 
                    });
                }
                
                // Guardar para la próxima comparación
                ultimoCicloRecibido = ciclosHoyRecibidos;
                localStorage.setItem('ultima_fecha_contador', fechaActual);
            }
            break;
            
        default:
            console.log(`Topic no manejado: ${topic}`, data);
    }
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

document.addEventListener('DOMContentLoaded', () => {
    connectMQTT();
});
