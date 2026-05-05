// ============================================================
// mqtt-client.js - Página Secundaria SmartGate Monitor
// ITIBB - Informática Industrial
// ============================================================

let globalCiclosHoy = 0;
let globalTotalAcumulado = 0;
let ultimoCicloProcesado = 0;
let ultimoTimestampProcesado = 0;

// Exponer variables globales para otros scripts
window.globalTotalAcumulado = globalTotalAcumulado;
window.globalCiclosHoy = globalCiclosHoy;

const MQTT_CONFIG = {
    broker: 'wss://d21941469193416fabcba46336fd0980.s1.eu.hivemq.cloud:8884/mqtt',
    options: {
        clientId: 'porton_monitor_' + Math.random().toString(16).substr(2, 8),
        username: 'porton_itibb',
        password: 'Porton2026',
        clean: true,
        reconnectPeriod: 5000,
        connectTimeout: 30000
    },
    topics: {
        estado:   'porton/estado',
        sensores: 'porton/sensores',
        heartbeat:'porton/heartbeat',
        contador: 'porton/contador/valor'
    }
};

let mqttClient;

// ============================================================
// SUPABASE
// ============================================================
const SUPABASE_URL = 'https://zdwonipaqrixxgfhxjjt.supabase.co';
const SUPABASE_KEY = 'sb_publishable_hAfw0kf-IxPbIzd9y3nThw_nwoDZf-P';

function sbHeaders() {
    return {
        'Content-Type':  'application/json',
        'apikey':        SUPABASE_KEY,
        'Authorization': 'Bearer ' + SUPABASE_KEY
    };
}

// ── Leer resumen completo desde la función SQL ──────────────
async function leerResumenSupabase() {
    try {
        const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/obtener_estado_actual_v3`, {
            method: 'POST',
            headers: sbHeaders(),
            body: '{}'
        });
        const data = await res.json();

        globalTotalAcumulado = data.total_acumulado || 0;
        globalCiclosHoy = data.ciclos_hoy || 0;

        window.globalTotalAcumulado = globalTotalAcumulado;
        window.globalCiclosHoy = globalCiclosHoy;

        const totalEl = document.getElementById('totalCycles');
        const hoyEl = document.getElementById('todayCycles');

        if (totalEl) totalEl.textContent = globalTotalAcumulado;
        if (hoyEl) hoyEl.textContent = globalCiclosHoy;

        if (typeof mantenimiento !== 'undefined') {
            mantenimiento.ciclos.total = globalTotalAcumulado;
            mantenimiento.guardarCiclos();
            mantenimiento.actualizarSaludSistema();
            mantenimiento.verificarAlertasMantenimiento();
        }

        if (typeof actualizarEstadisticas === 'function') actualizarEstadisticas();
        if (typeof actualizarGraficos === 'function') actualizarGraficos();

        console.log('📊 Resumen Supabase:', data);
        return data;
    } catch (e) {
        console.warn('⚠️ Error leyendo resumen Supabase:', e);
        return null;
    }
}

// ── Registrar ciclos con la función V5 (timestamps y reinicios) ──
async function registrarCiclosEnSupabase(ciclosHoy, horaInicio = null, horaActual = null) {
    try {
        const hoy = new Date().toISOString().split('T')[0];
        const ahora = horaActual || Math.floor(Date.now() / 1000);
        const inicio = horaInicio || ahora;
        
        const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/registrar_ciclos_esp32_v5`, {
            method: 'POST',
            headers: sbHeaders(),
            body: JSON.stringify({ 
                p_ciclos_recibidos: ciclosHoy,
                p_hora_inicio: inicio,
                p_hora_actual: ahora,
                p_fecha: hoy
            })
        });
        const data = await res.json();
        
        if (data && data.exito === true) {
            globalTotalAcumulado = data.total_acumulado;
            globalCiclosHoy = data.ciclos_hoy;
            window.globalTotalAcumulado = globalTotalAcumulado;
            window.globalCiclosHoy = globalCiclosHoy;
            
            console.log(`📊 ${data.mensaje}`);
            
            if (data.reinicio_detectado) {
                console.warn(`⚠️ REINICIO DETECTADO: El ESP32 debe usar ${data.esp32_debe_usar} ciclos`);
                // Intentar publicar corrección al ESP32
                if (mqttClient && mqttClient.connected) {
                    mqttClient.publish('porton/comandos', `AJUSTAR_CONTADOR:${data.esp32_debe_usar}`);
                }
            }
            
            await leerResumenSupabase();
            return data;
        } else {
            console.warn('⚠️ La función no devolvió exito:', data);
            return null;
        }
    } catch (e) {
        console.warn('⚠️ Error registrando ciclos:', e);
        return null;
    }
}

// ── Obtener estado actual para ESP32 ────────────────────────
async function obtenerEstadoActualParaESP32() {
    try {
        const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/obtener_estado_actual_v3`, {
            method: 'POST',
            headers: sbHeaders(),
            body: '{}'
        });
        const data = await res.json();
        console.log('📡 Estado para ESP32:', data);
        return data;
    } catch (e) {
        console.warn('⚠️ Error obteniendo estado:', e);
        return null;
    }
}

// ── Leer historial diario (últimos 30 días) ─────────────────
async function leerHistorialDiario(dias = 30) {
    try {
        const desde = new Date(Date.now() - dias * 86400000).toISOString().split('T')[0];
        const res = await fetch(
            `${SUPABASE_URL}/rest/v1/ciclos_diarios?fecha=gte.${desde}&order=fecha.desc`,
            { headers: sbHeaders() }
        );
        const data = await res.json();
        console.log(`📅 Historial diario (últimos ${dias} días):`, data.length, 'registros');
        return data;
    } catch (e) {
        console.warn('⚠️ Error leyendo historial:', e);
        return [];
    }
}

// ── Resetear contador (manual desde la UI) ──────────────────
async function resetearContadorSupabase(motivo = 'Reset manual', realizadoPor = 'Operador') {
    if (!confirm('⚠️ ¿Estás seguro de resetear el contador? Esta acción registrará un evento de mantenimiento.')) {
        return null;
    }
    
    try {
        const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/resetear_contador`, {
            method: 'POST',
            headers: sbHeaders(),
            body: JSON.stringify({ p_motivo: motivo, p_realizado_por: realizadoPor })
        });
        const data = await res.json();
        
        if (data && data.exito) {
            console.log('✅ Contador reseteado. Ciclos antes:', data.ciclos_antes);
            globalTotalAcumulado = 0;
            globalCiclosHoy = 0;
            window.globalTotalAcumulado = 0;
            window.globalCiclosHoy = 0;
            ultimoCicloProcesado = 0;
            ultimoTimestampProcesado = 0;
            
            await leerResumenSupabase();
            
            if (typeof notificaciones !== 'undefined') {
                notificaciones.enviarNotificacion(
                    'Contador Reiniciado',
                    `Se reinició el contador. Había ${data.ciclos_antes} ciclos acumulados.`,
                    'warning'
                );
            }
            return data;
        }
    } catch (e) {
        console.warn('⚠️ Error reseteando contador:', e);
    }
    return null;
}

// ── Guardar evento de mantenimiento en Supabase ─────────────
async function guardarMantenimientoSupabase(tipo, notas = '', realizadoPor = 'Operador') {
    try {
        const res = await fetch(`${SUPABASE_URL}/rest/v1/mantenimiento_eventos`, {
            method: 'POST',
            headers: { ...sbHeaders(), 'Prefer': 'return=representation' },
            body: JSON.stringify({
                tipo,
                ciclos_en_evento: globalTotalAcumulado,
                notas,
                realizado_por: realizadoPor
            })
        });
        const data = await res.json();
        console.log('✅ Mantenimiento guardado en Supabase:', data);
        
        if (typeof notificaciones !== 'undefined') {
            notificaciones.enviarNotificacion(
                'Mantenimiento Registrado',
                `${tipo} registrado. Total de ciclos: ${globalTotalAcumulado}`,
                'info'
            );
        }
        return data;
    } catch (e) {
        console.warn('⚠️ Error guardando mantenimiento:', e);
        return null;
    }
}

// ── Leer historial de mantenimientos desde Supabase ─────────
async function leerMantenimientosSupabase(limite = 50) {
    try {
        const res = await fetch(
            `${SUPABASE_URL}/rest/v1/mantenimiento_eventos?order=fecha.desc&limit=${limite}`,
            { headers: sbHeaders() }
        );
        const data = await res.json();
        console.log(`🔧 Historial de mantenimientos (últimos ${limite}):`, data.length, 'registros');
        return data;
    } catch (e) {
        console.warn('⚠️ Error leyendo mantenimientos:', e);
        return [];
    }
}

// ============================================================
// MQTT
// ============================================================
function connectMQTT() {
    console.log('🔌 Conectando MQTT...');
    mqttClient = mqtt.connect(MQTT_CONFIG.broker, MQTT_CONFIG.options);

    mqttClient.on('connect', () => {
        console.log('✅ MQTT conectado');
        updateMQTTStatus(true);
        Object.values(MQTT_CONFIG.topics).forEach(t => mqttClient.subscribe(t, { qos: 1 }));
    });

    mqttClient.on('error', (err) => {
        console.error('❌ Error MQTT:', err);
        updateMQTTStatus(false);
    });
    mqttClient.on('offline', () => updateMQTTStatus(false));
    mqttClient.on('reconnect', () => console.log('🔄 Reintentando conexión MQTT...'));

    mqttClient.on('message', (topic, message) => {
        try {
            if (topic === 'porton/heartbeat') {
                if (typeof registro !== 'undefined')
                    registro.agregarEvento('HEARTBEAT', { online: true });
                return;
            }

            const payload = JSON.parse(message.toString());
            handleMQTTMessage(topic, payload);
        } catch (e) {
            console.error('Error parsing MQTT:', e);
        }
    });
}

function updateMQTTStatus(connected) {
    const indicator = document.querySelector('.status-indicator');
    const text      = document.querySelector('.status-text');
    if (indicator) indicator.className = 'status-indicator ' + (connected ? 'online' : 'offline');
    if (text)      text.textContent    = connected ? 'MQTT Conectado' : 'Desconectado';
}

function handleMQTTMessage(topic, data) {
    const hoy = new Date().toISOString().split('T')[0];

    switch (topic) {
        case 'porton/estado':
            const stateEl = document.getElementById('currentState');
            if (stateEl) {
                if (data.estado === 'ABIERTO')      stateEl.innerHTML = '✅ ABIERTO';
                else if (data.estado === 'CERRADO') stateEl.innerHTML = '🔒 CERRADO';
                else                                stateEl.innerHTML = '⚠️ ' + data.estado;
            }
            const lastEl = document.getElementById('lastUpdate');
            if (lastEl) lastEl.textContent = 'Ahora';
            if (typeof registro !== 'undefined') registro.agregarEvento('ESTADO', data);
            break;

        case 'porton/contador/valor':
            if (data.ciclos !== undefined) {
                const ciclosRecibidos = data.ciclos;
                const timestampRecibido = data.hora_actual || Math.floor(Date.now() / 1000);
                const horaInicio = data.hora_inicio || timestampRecibido;
                
                // Evitar duplicados por timestamp
                if (timestampRecibido === ultimoTimestampProcesado && ciclosRecibidos === ultimoCicloProcesado) {
                    console.log('⏭️ Mensaje duplicado ignorado');
                    return;
                }
                
                console.log(`📊 Recibido: ${ciclosRecibidos} ciclos (inicio: ${horaInicio})`);
                
                // Registrar en Supabase con timestamps
                registrarCiclosEnSupabase(ciclosRecibidos, horaInicio, timestampRecibido);
                
                // Actualizar UI local
                const todayEl = document.getElementById('todayCycles');
                if (todayEl) todayEl.textContent = ciclosRecibidos;
                
                // Guardar último procesado
                ultimoCicloProcesado = ciclosRecibidos;
                ultimoTimestampProcesado = timestampRecibido;
                localStorage.setItem('porton_ciclos_hoy', ciclosRecibidos);
                localStorage.setItem('ultima_fecha_contador', hoy);

                if (typeof registro !== 'undefined') {
                    registro.agregarEvento('CONTADOR', { 
                        ciclosHoy: ciclosRecibidos,
                        horaInicio: horaInicio,
                        timestamp: timestampRecibido,
                        totalAcumulado: globalTotalAcumulado
                    });
                }
            }
            break;

        case 'porton/sensores':
            if (typeof registro !== 'undefined') registro.agregarEvento('SENSORES', data);
            break;
    }

    if (typeof actualizarEstadisticas === 'function') actualizarEstadisticas();
    if (typeof actualizarGraficos === 'function') actualizarGraficos();
}

// ============================================================
// FUNCIONES GLOBALES EXPORTADAS
// ============================================================
window.leerResumenSupabase = leerResumenSupabase;
window.obtenerEstadoActualParaESP32 = obtenerEstadoActualParaESP32;
window.resetearContadorSupabase = resetearContadorSupabase;
window.guardarMantenimientoSupabase = guardarMantenimientoSupabase;
window.leerHistorialDiario = leerHistorialDiario;
window.leerMantenimientosSupabase = leerMantenimientosSupabase;

// ============================================================
// INICIALIZACIÓN
// ============================================================
document.addEventListener('DOMContentLoaded', async () => {
    console.log('🚀 Inicializando SmartGate Monitor...');
    
    const localHoy = localStorage.getItem('porton_ciclos_hoy');
    if (localHoy) {
        globalCiclosHoy = parseInt(localHoy);
        window.globalCiclosHoy = globalCiclosHoy;
        const el = document.getElementById('todayCycles');
        if (el) el.textContent = globalCiclosHoy;
    }
    
    const localTotal = localStorage.getItem('porton_total_acumulado');
    if (localTotal) {
        globalTotalAcumulado = parseInt(localTotal);
        window.globalTotalAcumulado = globalTotalAcumulado;
        const totalEl = document.getElementById('totalCycles');
        if (totalEl) totalEl.textContent = globalTotalAcumulado;
    }

    connectMQTT();
    await leerResumenSupabase();
    leerHistorialDiario(30);
    leerMantenimientosSupabase(20);
    
    setInterval(leerResumenSupabase, 30000);
    
    console.log('✅ SmartGate Monitor inicializado correctamente');
});
