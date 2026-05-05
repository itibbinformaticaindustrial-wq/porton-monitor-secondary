// ============================================================
// mqtt-client.js - Página Secundaria SmartGate Monitor
// ITIBB - Informática Industrial
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
        const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/obtener_resumen`, {
            method: 'POST',
            headers: sbHeaders(),
            body: '{}'
        });
        const data = await res.json();

        globalTotalAcumulado       = data.total_acumulado || 0;
        globalCiclosHoy            = data.ciclos_hoy      || 0;

        // Actualizar UI
        const totalEl  = document.getElementById('totalCycles');
        const hoyEl    = document.getElementById('todayCycles');
        const semanaEl = document.getElementById('weekCycles');
        const mesEl    = document.getElementById('monthCycles');

        if (totalEl)  totalEl.textContent  = globalTotalAcumulado;
        if (hoyEl)    hoyEl.textContent    = globalCiclosHoy;
        if (semanaEl) semanaEl.textContent = data.ciclos_semana || 0;
        if (mesEl)    mesEl.textContent    = data.ciclos_mes    || 0;

        // Actualizar mantenimiento con total real
        if (typeof mantenimiento !== 'undefined') {
            mantenimiento.ciclos.total = globalTotalAcumulado;
            mantenimiento.ciclos.hoy   = globalCiclosHoy;
            mantenimiento.guardarCiclos();
        }

        if (typeof actualizarEstadisticas === 'function') actualizarEstadisticas();
        if (typeof actualizarGraficos     === 'function') actualizarGraficos();

        console.log('📊 Resumen Supabase:', data);
    } catch (e) {
        console.warn('⚠️ Error leyendo resumen Supabase:', e);
    }
}

// ── Registrar ciclos del día via función SQL ────────────────
async function registrarCiclosEnSupabase(ciclosHoy) {
    try {
        const hoy = new Date().toISOString().split('T')[0];
        const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/registrar_ciclos_esp32`, {
            method: 'POST',
            headers: sbHeaders(),
            body: JSON.stringify({ p_ciclos_hoy: ciclosHoy, p_fecha: hoy })
        });
        const data = await res.json();
        if (data.exito) {
            globalTotalAcumulado = data.total_acumulado;
            console.log('✅ Ciclos registrados:', data);
            leerResumenSupabase(); // refrescar UI
        }
    } catch (e) {
        console.warn('⚠️ Error registrando ciclos:', e);
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
        return await res.json();
    } catch (e) {
        console.warn('⚠️ Error leyendo historial:', e);
        return [];
    }
}

// ── Resetear contador (manual desde la UI) ──────────────────
async function resetearContadorSupabase(motivo = 'Reset manual', realizadoPor = 'Operador') {
    try {
        const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/resetear_contador`, {
            method: 'POST',
            headers: sbHeaders(),
            body: JSON.stringify({ p_motivo: motivo, p_realizado_por: realizadoPor })
        });
        const data = await res.json();
        if (data.exito) {
            console.log('✅ Contador reseteado. Ciclos antes:', data.ciclos_antes);
            globalTotalAcumulado = 0;
            globalCiclosHoy      = 0;
            leerResumenSupabase();
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
        return await res.json();
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

    mqttClient.on('error', () => updateMQTTStatus(false));
    mqttClient.on('offline', () => updateMQTTStatus(false));

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
            // Actualizar estado visual
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
            // ✅ CORRECCIÓN PRINCIPAL: registrar en Supabase con la función SQL
            if (data.ciclos !== undefined) {
                const ciclosNuevos = data.ciclos;

                // Detectar cambio de día
                const ultimaFecha = localStorage.getItem('ultima_fecha_contador');
                if (ultimaFecha && ultimaFecha !== hoy) {
                    console.log('🔄 Nuevo día — ciclos del día anterior ya en Supabase');
                }

                globalCiclosHoy = ciclosNuevos;
                localStorage.setItem('porton_ciclos_hoy', ciclosNuevos);
                localStorage.setItem('ultima_fecha_contador', hoy);

                // Registrar en Supabase → actualiza ciclos_diarios y acumulado
                registrarCiclosEnSupabase(ciclosNuevos);

                const todayEl = document.getElementById('todayCycles');
                if (todayEl) todayEl.textContent = ciclosNuevos;

                if (typeof registro !== 'undefined')
                    registro.agregarEvento('CONTADOR', { ciclosHoy: ciclosNuevos });
            }
            break;

        case 'porton/sensores':
            if (typeof registro !== 'undefined') registro.agregarEvento('SENSORES', data);
            break;
    }

    if (typeof actualizarEstadisticas === 'function') actualizarEstadisticas();
    if (typeof actualizarGraficos     === 'function') actualizarGraficos();
}

// ============================================================
// INICIALIZACIÓN
// ============================================================
document.addEventListener('DOMContentLoaded', () => {
    // Cargar datos locales como respaldo inmediato
    const localHoy = localStorage.getItem('porton_ciclos_hoy');
    if (localHoy) {
        globalCiclosHoy = parseInt(localHoy);
        const el = document.getElementById('todayCycles');
        if (el) el.textContent = globalCiclosHoy;
    }

    connectMQTT();

    // Leer Supabase al arrancar y cada 30s
    leerResumenSupabase();
    setInterval(leerResumenSupabase, 30000);
});
