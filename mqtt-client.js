// ============================================================
// mqtt-client.js - Página Secundaria SmartGate Monitor
// ITIBB - Informática Industrial
// VERSIÓN FINAL: SOLO LECTURA - No calcula fechas
// ============================================================

let globalCiclosHoy = 0;
let globalTotalAcumulado = 0;

// Variables para respaldo local (NO se usan para mostrar)
let contadorLocalAcumulado = 0;
let ultimoValorESP32 = null;
let fechaActualLocal = new Date().toISOString().split('T')[0];
let timeoutGuardadoPendiente = null;

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
// ✅ SOLO LECTURA - No calcula fechas, usa lo que viene de Supabase
async function leerResumenSupabase() {
    try {
        const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/obtener_resumen`, {
            method: 'POST',
            headers: sbHeaders(),
            body: '{}'
        });
        const data = await res.json();

        // ✅ Usar los valores DIRECTOS de Supabase (ella ya tiene la fecha correcta)
        globalTotalAcumulado = data.total_acumulado || 0;
        globalCiclosHoy = data.ciclos_hoy || 0;

        // Actualizar UI con los valores de Supabase
        const totalEl = document.getElementById('totalCycles');
        const hoyEl = document.getElementById('todayCycles');
        const semanaEl = document.getElementById('weekCycles');
        const mesEl = document.getElementById('monthCycles');

        if (totalEl) totalEl.textContent = globalTotalAcumulado;
        if (hoyEl) hoyEl.textContent = globalCiclosHoy;
        if (semanaEl) semanaEl.textContent = data.ciclos_semana || 0;
        if (mesEl) mesEl.textContent = data.ciclos_mes || 0;

        // Actualizar mantenimiento con total real
        if (typeof mantenimiento !== 'undefined') {
            mantenimiento.ciclos.total = globalTotalAcumulado;
            mantenimiento.ciclos.hoy = globalCiclosHoy;
            mantenimiento.guardarCiclos();
        }

        if (typeof actualizarEstadisticas === 'function') actualizarEstadisticas();
        if (typeof actualizarGraficos === 'function') actualizarGraficos();

        console.log('📊 Total acumulado (Supabase):', globalTotalAcumulado);
        console.log('📊 Ciclos hoy (Supabase):', globalCiclosHoy);
    } catch (e) {
        console.warn('⚠️ Error leyendo resumen Supabase:', e);
    }
}

// ── Registrar ciclos del día en Supabase (SOLO para respaldo) ──
async function registrarCiclosEnSupabase(ciclosHoy, fecha = null) {
    // ⚠️ Esta función SOLO se usa para respaldo, no para mostrar datos
    const fechaRegistro = fecha || new Date().toISOString().split('T')[0];
    
    try {
        const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/registrar_ciclos_esp32`, {
            method: 'POST',
            headers: sbHeaders(),
            body: JSON.stringify({ p_ciclos_hoy: ciclosHoy, p_fecha: fechaRegistro })
        });
        const data = await res.json();
        if (data.exito) {
            globalTotalAcumulado = data.total_acumulado;
            console.log(`✅ Ciclos registrados en Supabase para ${fechaRegistro}: ${ciclosHoy}`);
            
            const totalEl = document.getElementById('totalCycles');
            if (totalEl) totalEl.textContent = globalTotalAcumulado;
            
            return data;
        }
    } catch (e) {
        console.warn('⚠️ Error registrando ciclos:', e);
    }
    return null;
}

// ── Guardado diferido (SOLO respaldo) ──
function programarGuardadoDiferido() {
    if (timeoutGuardadoPendiente) {
        clearTimeout(timeoutGuardadoPendiente);
    }
    timeoutGuardadoPendiente = setTimeout(() => {
        if (contadorLocalAcumulado > 0) {
            registrarCiclosEnSupabase(contadorLocalAcumulado, fechaActualLocal);
            localStorage.setItem('ultimo_guardado_supabase_fecha', fechaActualLocal);
            console.log('💾 Guardado diferido en Supabase:', contadorLocalAcumulado);
        }
        timeoutGuardadoPendiente = null;
    }, 10000);
}

// ── Verificar cambio de día (SOLO para respaldo) ──
function verificarCambioDeDia() {
    const hoy = new Date().toISOString().split('T')[0];
    
    if (hoy !== fechaActualLocal) {
        console.log(`📅 Cambio de día detectado: ${fechaActualLocal} → ${hoy}`);
        
        if (contadorLocalAcumulado > 0) {
            registrarCiclosEnSupabase(contadorLocalAcumulado, fechaActualLocal);
        }
        
        contadorLocalAcumulado = 0;
        fechaActualLocal = hoy;
        localStorage.setItem('contador_local_acumulado', 0);
        localStorage.setItem('contador_local_fecha', hoy);
        localStorage.setItem('porton_ciclos_hoy', 0);
        
        // NO actualizar la UI con 0, esperar a Supabase
        // La UI se actualizará con leerResumenSupabase()
        
        if (typeof notificaciones !== 'undefined') {
            notificaciones.enviarNotificacion(
                'Nuevo Día', 
                'El contador diario se ha reiniciado',
                'info'
            );
        }
    }
}

// ── Inicializar contador local (SOLO respaldo) ──
function inicializarContadorLocal() {
    const fechaGuardada = localStorage.getItem('contador_local_fecha');
    const hoy = new Date().toISOString().split('T')[0];
    const contadorGuardado = localStorage.getItem('contador_local_acumulado');
    
    if (fechaGuardada === hoy && contadorGuardado !== null) {
        contadorLocalAcumulado = parseInt(contadorGuardado) || 0;
        console.log(`📊 Contador local restaurado: ${contadorLocalAcumulado} ciclos (${fechaGuardada})`);
    } else {
        contadorLocalAcumulado = 0;
        fechaActualLocal = hoy;
        localStorage.setItem('contador_local_fecha', hoy);
        localStorage.setItem('contador_local_acumulado', 0);
        console.log(`📊 Contador local inicializado: 0 ciclos (${hoy})`);
    }
    
    const ultimoValor = localStorage.getItem('ultimo_valor_esp32');
    if (ultimoValor !== null) {
        ultimoValorESP32 = parseInt(ultimoValor);
    }
    
    return contadorLocalAcumulado;
}

// ── Actualizar contador local (SOLO para respaldo) ──
function actualizarContadorLocal(nuevoValorESP32) {
    const hoy = new Date().toISOString().split('T')[0];
    
    if (hoy !== fechaActualLocal) {
        verificarCambioDeDia();
    }
    
    if (nuevoValorESP32 === 0 && contadorLocalAcumulado > 0) {
        console.warn('⚠️ ESP32 reiniciado (valor 0 ignorado) - Contador local protegido:', contadorLocalAcumulado);
        
        const ultimaNotificacion = localStorage.getItem('ultima_notificacion_reinicio');
        const ahora = Date.now();
        if (!ultimaNotificacion || (ahora - parseInt(ultimaNotificacion)) > 3600000) {
            if (typeof notificaciones !== 'undefined') {
                notificaciones.enviarNotificacion(
                    '⚠️ ESP32 Reiniciado',
                    `El dispositivo se reinició, pero se han conservado ${contadorLocalAcumulado} ciclos de hoy.`,
                    'warning'
                );
            }
            localStorage.setItem('ultima_notificacion_reinicio', ahora.toString());
        }
        
        localStorage.setItem('ultimo_valor_esp32', nuevoValorESP32);
        return contadorLocalAcumulado;
    }
    
    if (nuevoValorESP32 > contadorLocalAcumulado) {
        const incremento = nuevoValorESP32 - contadorLocalAcumulado;
        contadorLocalAcumulado = nuevoValorESP32;
        
        console.log(`📈 Incremento detectado: +${incremento} (Total día: ${contadorLocalAcumulado})`);
        
        localStorage.setItem('contador_local_acumulado', contadorLocalAcumulado);
        localStorage.setItem('porton_ciclos_hoy', contadorLocalAcumulado);
        localStorage.setItem('ultimo_valor_esp32', nuevoValorESP32);
        
        // ✅ NO actualizar la UI aquí, esperar a Supabase
        // La UI se actualizará con leerResumenSupabase()
        
        if (typeof registro !== 'undefined') {
            registro.agregarEvento('CONTADOR', { 
                ciclosHoy: contadorLocalAcumulado,
                incremento: incremento,
                fuente: 'ESP32'
            });
        }
        
        programarGuardadoDiferido();
        
    } else if (nuevoValorESP32 < contadorLocalAcumulado && nuevoValorESP32 !== 0) {
        console.warn(`⚠️ Valor anómalo del ESP32: ${nuevoValorESP32} < ${contadorLocalAcumulado} - Ignorando`);
    }
    
    return contadorLocalAcumulado;
}

// ── Leer historial diario ──
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

// ── Resetear contador ──
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
            globalCiclosHoy = 0;
            contadorLocalAcumulado = 0;
            fechaActualLocal = new Date().toISOString().split('T')[0];
            localStorage.setItem('contador_local_acumulado', 0);
            localStorage.setItem('porton_ciclos_hoy', 0);
            
            // Actualizar UI con 0
            const totalEl = document.getElementById('totalCycles');
            const hoyEl = document.getElementById('todayCycles');
            if (totalEl) totalEl.textContent = '0';
            if (hoyEl) hoyEl.textContent = '0';
            
            leerResumenSupabase();
            return data;
        }
    } catch (e) {
        console.warn('⚠️ Error reseteando contador:', e);
    }
    return null;
}

// ── Guardar evento de mantenimiento ──
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

// ── Leer historial de mantenimientos ──
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

    mqttClient.on('error', (err) => {
        console.error('❌ MQTT Error:', err);
        updateMQTTStatus(false);
    });
    
    mqttClient.on('offline', () => {
        console.warn('⚠️ MQTT Offline');
        updateMQTTStatus(false);
    });
    
    mqttClient.on('reconnect', () => {
        console.log('🔄 MQTT Reconectando...');
    });

    mqttClient.on('message', (topic, message) => {
        try {
            if (topic === 'porton/heartbeat') {
                if (typeof registro !== 'undefined') {
                    registro.agregarEvento('HEARTBEAT', { online: true, timestamp: Date.now() });
                }
                console.log('💓 Heartbeat recibido');
                return;
            }

            const payload = JSON.parse(message.toString());
            handleMQTTMessage(topic, payload);
        } catch (e) {
            console.error('❌ Error parsing MQTT message:', e.message);
        }
    });
}

function updateMQTTStatus(connected) {
    const indicator = document.querySelector('.status-indicator');
    const text = document.querySelector('.status-text');
    if (indicator) indicator.className = 'status-indicator ' + (connected ? 'online' : 'offline');
    if (text) text.textContent = connected ? 'MQTT Conectado' : 'Desconectado';
    
    const sidebarIndicator = document.querySelector('#mqttStatusSidebar .status-indicator');
    const sidebarText = document.querySelector('#mqttStatusSidebar .status-text');
    if (sidebarIndicator) sidebarIndicator.className = 'status-indicator ' + (connected ? 'online' : 'offline');
    if (sidebarText) sidebarText.textContent = connected ? 'MQTT Conectado' : 'Desconectado';
}

// ============================================================
// HANDLER - Solo registra eventos, NO actualiza UI directamente
// ============================================================
function handleMQTTMessage(topic, data) {
    switch (topic) {
        case 'porton/estado':
            const stateEl = document.getElementById('currentState');
            if (stateEl) {
                let estadoTexto = '';
                let estadoEmoji = '';
                
                if (data.estado === 'ABIERTO') {
                    estadoTexto = 'ABIERTO';
                    estadoEmoji = '✅';
                } else if (data.estado === 'CERRADO') {
                    estadoTexto = 'CERRADO';
                    estadoEmoji = '🔒';
                } else {
                    estadoTexto = data.estado;
                    estadoEmoji = '⚠️';
                }
                stateEl.innerHTML = `${estadoEmoji} ${estadoTexto}`;
            }
            
            const lastEl = document.getElementById('lastUpdate');
            if (lastEl) {
                lastEl.textContent = 'Ahora';
                lastEl.title = new Date().toLocaleString();
            }
            
            if (typeof registro !== 'undefined') {
                registro.agregarEvento('ESTADO', data);
            }
            break;

        case 'porton/contador/valor':
            if (data.ciclos !== undefined) {
                const valorRecibido = parseInt(data.ciclos);
                console.log(`📊 Valor recibido del ESP32: ${valorRecibido} ciclos`);
                
                // Solo actualizar respaldo local, NO la UI principal
                actualizarContadorLocal(valorRecibido);
                
                // Guardar en localStorage
                const hoy = new Date().toISOString().split('T')[0];
                localStorage.setItem('ultima_fecha_contador', hoy);
                localStorage.setItem('ultimo_valor_contador', valorRecibido);
                localStorage.setItem('ultima_actualizacion', Date.now().toString());
            }
            break;

        case 'porton/sensores':
            if (typeof registro !== 'undefined') {
                registro.agregarEvento('SENSORES', data);
            }
            
            if (data.temperatura && data.temperatura > 80) {
                if (typeof notificaciones !== 'undefined') {
                    notificaciones.enviarNotificacion(
                        '⚠️ Temperatura Alta',
                        `Temperatura del motor: ${data.temperatura}°C`,
                        'alert'
                    );
                }
            }
            break;
            
        default:
            console.log(`📡 Mensaje no manejado en topic: ${topic}`, data);
    }

    if (typeof actualizarEstadisticas === 'function') actualizarEstadisticas();
    if (typeof actualizarGraficos === 'function') actualizarGraficos();
}

// ── Guardado periódico ──
function iniciarGuardadoPeriodico() {
    setInterval(() => {
        if (contadorLocalAcumulado > 0) {
            const ultimoGuardado = localStorage.getItem('ultimo_guardado_supabase_fecha');
            const hoy = new Date().toISOString().split('T')[0];
            
            if (ultimoGuardado !== hoy) {
                registrarCiclosEnSupabase(contadorLocalAcumulado, fechaActualLocal);
                localStorage.setItem('ultimo_guardado_supabase_fecha', hoy);
                console.log('💾 Guardado periódico (hora) en Supabase:', contadorLocalAcumulado);
            }
        }
    }, 60 * 60 * 1000);
    
    setInterval(() => {
        verificarCambioDeDia();
    }, 60 * 1000);
}

// ── Sincronizar al reconectar ──
async function sincronizarAlReconectar() {
    console.log('🔄 Sincronizando datos después de reconexión...');
    await leerResumenSupabase();
}

// ============================================================
// INICIALIZACIÓN
// ============================================================
document.addEventListener('DOMContentLoaded', () => {
    console.log('🚀 Inicializando mqtt-client.js versión FINAL...');
    
    inicializarContadorLocal();
    
    const localHoy = localStorage.getItem('porton_ciclos_hoy');
    if (localHoy && parseInt(localHoy) > contadorLocalAcumulado) {
        contadorLocalAcumulado = parseInt(localHoy);
        localStorage.setItem('contador_local_acumulado', contadorLocalAcumulado);
        console.log('📊 Contador local actualizado desde backup:', contadorLocalAcumulado);
    }
    
    connectMQTT();
    
    // ✅ LO MÁS IMPORTANTE: Leer Supabase al arrancar y periódicamente
    leerResumenSupabase();
    
    // Actualizar cada 30 segundos desde Supabase
    setInterval(leerResumenSupabase, 30000);
    
    iniciarGuardadoPeriodico();
    
    setInterval(() => {
        sincronizarAlReconectar();
    }, 5 * 60 * 1000);
    
    window.addEventListener('beforeunload', () => {
        if (contadorLocalAcumulado > 0) {
            const hoy = new Date().toISOString().split('T')[0];
            navigator.sendBeacon(
                `${SUPABASE_URL}/rest/v1/rpc/registrar_ciclos_esp32`,
                JSON.stringify({ p_ciclos_hoy: contadorLocalAcumulado, p_fecha: hoy })
            );
        }
    });
    
    console.log('✅ mqtt-client.js inicializado correctamente');
    console.log('📊 La página muestra SOLO los datos de Supabase');
});

// Exportar funciones
window.actualizarContadorLocal = actualizarContadorLocal;
window.verificarCambioDeDia = verificarCambioDeDia;
window.sincronizarAlReconectar = sincronizarAlReconectar;
