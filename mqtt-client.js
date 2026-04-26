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
let ultimoCicloRecibido = 0;
let totalAcumulado = 0;
let contadorGuardadoEnSesion = null;

// Cargar total acumulado al iniciar
function cargarTotalAcumulado() {
    const guardado = localStorage.getItem('porton_total_acumulado');
    totalAcumulado = guardado ? parseInt(guardado) : 0;
    console.log(`📊 Total acumulado cargado: ${totalAcumulado} ciclos`);
    
    // Cargar el último contador recibido para evitar duplicados
    const ultimoContador = localStorage.getItem('ultimo_contador_recibido');
    if (ultimoContador !== null) {
        ultimoCicloRecibido = parseInt(ultimoContador);
        console.log(`🔄 Último contador recibido: ${ultimoCicloRecibido} ciclos`);
    }
    
    if (typeof mantenimiento !== 'undefined') {
        mantenimiento.ciclos.total = totalAcumulado;
        mantenimiento.guardarCiclos();
        if (typeof actualizarEstadisticas === 'function') actualizarEstadisticas();
    }
}

// Guardar total acumulado
function guardarTotalAcumulado() {
    localStorage.setItem('porton_total_acumulado', totalAcumulado.toString());
    console.log(`💾 Total acumulado guardado: ${totalAcumulado} ciclos`);
}

function connectMQTT() {
    console.log('🔌 Conectando a MQTT broker:', MQTT_CONFIG.broker);
    
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
                
                // Verificar si es un nuevo día
                const ultimaFecha = localStorage.getItem('ultima_fecha_contador');
                const fechaActual = hoy;
                
                if (ultimaFecha && ultimaFecha !== fechaActual && ciclosHoyRecibidos < ultimoCicloRecibido) {
                    console.log(`🔄 Nuevo día detectado: ${fechaActual}`);
                    
                    const ciclosAyer = ultimoCicloRecibido;
                    if (ciclosAyer > 0) {
                        guardarCicloDiario(ultimaFecha, ciclosAyer);
                        console.log(`📅 Ciclos del día ${ultimaFecha}: ${ciclosAyer}`);
                    }
                    
                    ultimoCicloRecibido = 0;
                }
                
                // Calcular NUEVOS ciclos (solo los que no habíamos contado)
                let nuevosCiclos = 0;
                if (ciclosHoyRecibidos > ultimoCicloRecibido) {
                    nuevosCiclos = ciclosHoyRecibidos - ultimoCicloRecibido;
                }
                
                if (nuevosCiclos > 0) {
                    totalAcumulado += nuevosCiclos;
                    guardarTotalAcumulado();
                    
                    console.log(`📊 +${nuevosCiclos} ciclos nuevos`);
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
                            nuevos: nuevosCiclos,
                            timestamp: data.timestamp 
                        });
                    }
                } else {
                    console.log(`📊 No hay ciclos nuevos (último: ${ultimoCicloRecibido}, actual: ${ciclosHoyRecibidos})`);
                }
                
                // Actualizar el último contador recibido
                ultimoCicloRecibido = ciclosHoyRecibidos;
                localStorage.setItem('ultimo_contador_recibido', ultimoCicloRecibido.toString());
                localStorage.setItem('ultima_fecha_contador', fechaActual);
                
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
