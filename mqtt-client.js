// ============================================================
// mqtt-client.js - Página Secundaria SmartGate Monitor
// ITIBB - Informática Industrial
// VERSIÓN CORREGIDA: Con acumulador local y protección contra reinicios del ESP32
// ============================================================

let globalCiclosHoy = 0;
let globalTotalAcumulado = 0;

// NUEVO: Variables para acumulador local
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

        // NO sobreescribir el contador local si ya tenemos un valor mayor
        // Esto protege contra datos antiguos en Supabase
        if (globalCiclosHoy > 0 && contadorLocalAcumulado === 0) {
            contadorLocalAcumulado = globalCiclosHoy;
            localStorage.setItem('contador_local_acumulado', contadorLocalAcumulado);
        }

        // Actualizar UI
        const totalEl  = document.getElementById('totalCycles');
        const hoyEl    = document.getElementById('todayCycles');
        const semanaEl = document.getElementById('weekCycles');
        const mesEl    = document.getElementById('monthCycles');

        if (totalEl)  totalEl.textContent  = globalTotalAcumulado;
        if (hoyEl)    hoyEl.textContent    = contadorLocalAcumulado > 0 ? contadorLocalAcumulado : globalCiclosHoy;
        if (semanaEl) semanaEl.textContent = data.ciclos_semana || 0;
        if (mesEl)    mesEl.textContent    = data.ciclos_mes    || 0;

        // Actualizar mantenimiento con total real
        if (typeof mantenimiento !== 'undefined') {
            mantenimiento.ciclos.total = globalTotalAcumulado;
            mantenimiento.ciclos.hoy   = contadorLocalAcumulado > 0 ? contadorLocalAcumulado : globalCiclosHoy;
            mantenimiento.guardarCiclos();
        }

        if (typeof actualizarEstadisticas === 'function') actualizarEstadisticas();
        if (typeof actualizarGraficos     === 'function') actualizarGraficos();

        console.log('📊 Resumen Supabase:', data);
        console.log('📊 Contador local acumulado:', contadorLocalAcumulado);
    } catch (e) {
        console.warn('⚠️ Error leyendo resumen Supabase:', e);
    }
}

// ── Registrar ciclos del día en Supabase (MODIFICADO: acepta fecha opcional) ──
async function registrarCiclosEnSupabase(ciclosHoy, fecha = null) {
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
            
            // Actualizar UI con el total acumulado
            const totalEl = document.getElementById('totalCycles');
            if (totalEl) totalEl.textContent = globalTotalAcumulado;
            
            return data;
        }
    } catch (e) {
        console.warn('⚠️ Error registrando ciclos:', e);
    }
    return null;
}

// ── NUEVA FUNCIÓN: Guardado diferido para evitar muchas llamadas ──
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
    }, 10000); // Guardar después de 10 segundos sin cambios
}

// ── NUEVA FUNCIÓN: Verificar cambio de día ──
function verificarCambioDeDia() {
    const hoy = new Date().toISOString().split('T')[0];
    
    if (hoy !== fechaActualLocal) {
        console.log(`📅 Cambio de día detectado: ${fechaActualLocal} → ${hoy}`);
        
        // Guardar el contador del día anterior en Supabase
        if (contadorLocalAcumulado > 0) {
            registrarCiclosEnSupabase(contadorLocalAcumulado, fechaActualLocal);
        }
        
        // Resetear contador local para el nuevo día
        contadorLocalAcumulado = 0;
        fechaActualLocal = hoy;
        localStorage.setItem('contador_local_acumulado', 0);
        localStorage.setItem('contador_local_fecha', hoy);
        localStorage.setItem('porton_ciclos_hoy', 0);
        
        // Actualizar UI
        const hoyEl = document.getElementById('todayCycles');
        if (hoyEl) hoyEl.textContent = '0';
        
        // Notificar cambio de día
        if (typeof notificaciones !== 'undefined') {
            notificaciones.enviarNotificacion(
                'Nuevo Día', 
                'El contador diario se ha reiniciado',
                'info'
            );
        }
    }
}

// ── NUEVA FUNCIÓN: Inicializar contador local desde localStorage ──
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
    
    // También recuperar el último valor conocido del ESP32
    const ultimoValor = localStorage.getItem('ultimo_valor_esp32');
    if (ultimoValor !== null) {
        ultimoValorESP32 = parseInt(ultimoValor);
    }
    
    // Actualizar UI
    const hoyEl = document.getElementById('todayCycles');
    if (hoyEl) hoyEl.textContent = contadorLocalAcumulado;
    
    return contadorLocalAcumulado;
}

// ── NUEVA FUNCIÓN: Actualizar contador local con validación ──
function actualizarContadorLocal(nuevoValorESP32) {
    const hoy = new Date().toISOString().split('T')[0];
    
    // Verificar cambio de día primero
    if (hoy !== fechaActualLocal) {
        verificarCambioDeDia();
    }
    
    // 🔥 LÓGICA CENTRAL: Protección contra reinicios del ESP32
    if (nuevoValorESP32 === 0 && contadorLocalAcumulado > 0) {
        // ¡ESP32 se reinició! No actualizar el contador local
        console.warn('⚠️ ESP32 reiniciado (valor 0 ignorado) - Contador local protegido:', contadorLocalAcumulado);
        
        // Notificar al usuario (solo una vez cada hora)
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
        
        // Guardar el valor del ESP32 como referencia
        localStorage.setItem('ultimo_valor_esp32', nuevoValorESP32);
        return contadorLocalAcumulado;
    }
    
    // Si el nuevo valor es MAYOR que el actual, incrementar
    if (nuevoValorESP32 > contadorLocalAcumulado) {
        const incremento = nuevoValorESP32 - contadorLocalAcumulado;
        contadorLocalAcumulado = nuevoValorESP32;
        
        console.log(`📈 Incremento detectado: +${incremento} (Total día: ${contadorLocalAcumulado})`);
        
        // Guardar en localStorage
        localStorage.setItem('contador_local_acumulado', contadorLocalAcumulado);
        localStorage.setItem('porton_ciclos_hoy', contadorLocalAcumulado);
        localStorage.setItem('ultimo_valor_esp32', nuevoValorESP32);
        
        // Actualizar UI
        const hoyEl = document.getElementById('todayCycles');
        if (hoyEl) hoyEl.textContent = contadorLocalAcumulado;
        
        // Registrar evento en el timeline
        if (typeof registro !== 'undefined') {
            registro.agregarEvento('CONTADOR', { 
                ciclosHoy: contadorLocalAcumulado,
                incremento: incremento,
                fuente: 'ESP32'
            });
        }
        
        // Programar guardado diferido en Supabase
        programarGuardadoDiferido();
        
    } else if (nuevoValorESP32 < contadorLocalAcumulado && nuevoValorESP32 !== 0) {
        // El valor disminuyó sin ser cero (posible reinicio parcial)
        console.warn(`⚠️ Valor anómalo del ESP32: ${nuevoValorESP32} < ${contadorLocalAcumulado} - Ignorando`);
    }
    
    return contadorLocalAcumulado;
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
            globalCiclosHoy = 0;
            contadorLocalAcumulado = 0;
            fechaActualLocal = new Date().toISOString().split('T')[0];
            localStorage.setItem('contador_local_acumulado', 0);
            localStorage.setItem('porton_ciclos_hoy', 0);
            
            // Actualizar UI
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
            // Heartbeat especial (no es JSON)
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
    const text      = document.querySelector('.status-text');
    if (indicator) indicator.className = 'status-indicator ' + (connected ? 'online' : 'offline');
    if (text)      text.textContent    = connected ? 'MQTT Conectado' : 'Desconectado';
    
    // Actualizar también en el sidebar si existe
    const sidebarIndicator = document.querySelector('#mqttStatusSidebar .status-indicator');
    const sidebarText = document.querySelector('#mqttStatusSidebar .status-text');
    if (sidebarIndicator) sidebarIndicator.className = 'status-indicator ' + (connected ? 'online' : 'offline');
    if (sidebarText) sidebarText.textContent = connected ? 'MQTT Conectado' : 'Desconectado';
}

// ============================================================
// HANDLER MODIFICADO - CON PROTECCIÓN CONTRA REINICIOS
// ============================================================
function handleMQTTMessage(topic, data) {
    const hoy = new Date().toISOString().split('T')[0];

    switch (topic) {
        case 'porton/estado':
            // Actualizar estado visual
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
                // Opcional: mostrar tiempo exacto
                lastEl.title = new Date().toLocaleString();
            }
            
            if (typeof registro !== 'undefined') {
                registro.agregarEvento('ESTADO', data);
            }
            break;

        case 'porton/contador/valor':
            // 🔥 CORRECCIÓN PRINCIPAL: Usar el acumulador local con protección
            if (data.ciclos !== undefined) {
                const valorRecibido = parseInt(data.ciclos);
                console.log(`📊 Valor recibido del ESP32: ${valorRecibido} ciclos`);
                
                // Actualizar el contador local con protección
                const nuevoTotal = actualizarContadorLocal(valorRecibido);
                
                // Actualizar variable global para otros módulos
                globalCiclosHoy = nuevoTotal;
                
                // Actualizar UI inmediatamente
                const todayEl = document.getElementById('todayCycles');
                if (todayEl) todayEl.textContent = nuevoTotal;
                
                // Guardar en localStorage adicional
                localStorage.setItem('porton_ciclos_hoy', nuevoTotal);
                localStorage.setItem('ultima_fecha_contador', hoy);
                localStorage.setItem('ultimo_valor_contador', valorRecibido);
                localStorage.setItem('ultima_actualizacion', Date.now().toString());
            }
            break;

        case 'porton/sensores':
            if (typeof registro !== 'undefined') {
                registro.agregarEvento('SENSORES', data);
            }
            
            // Opcional: Mostrar alerta si hay valores anómalos
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

// ── NUEVA FUNCIÓN: Guardado periódico forzado ──
function iniciarGuardadoPeriodico() {
    // Guardar cada hora (por si acaso)
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
    }, 60 * 60 * 1000); // Cada hora
    
    // Verificar cambio de día cada minuto
    setInterval(() => {
        verificarCambioDeDia();
    }, 60 * 1000); // Cada minuto
}

// ── NUEVA FUNCIÓN: Sincronizar con servidor al recuperar conexión ──
async function sincronizarAlReconectar() {
    console.log('🔄 Sincronizando datos después de reconexión...');
    await leerResumenSupabase();
    
    // Verificar si el contador local necesita actualizarse desde Supabase
    if (globalCiclosHoy > contadorLocalAcumulado) {
        console.log(`🔄 Actualizando contador local desde Supabase: ${globalCiclosHoy}`);
        contadorLocalAcumulado = globalCiclosHoy;
        localStorage.setItem('contador_local_acumulado', contadorLocalAcumulado);
        
        const hoyEl = document.getElementById('todayCycles');
        if (hoyEl) hoyEl.textContent = contadorLocalAcumulado;
    }
}

// ============================================================
// INICIALIZACIÓN MODIFICADA
// ============================================================
document.addEventListener('DOMContentLoaded', () => {
    console.log('🚀 Inicializando mqtt-client.js versión corregida...');
    
    // Inicializar contador local desde localStorage
    inicializarContadorLocal();
    
    // Cargar datos locales como respaldo inmediato
    const localHoy = localStorage.getItem('porton_ciclos_hoy');
    if (localHoy && parseInt(localHoy) > contadorLocalAcumulado) {
        contadorLocalAcumulado = parseInt(localHoy);
        localStorage.setItem('contador_local_acumulado', contadorLocalAcumulado);
        console.log('📊 Contador local actualizado desde backup:', contadorLocalAcumulado);
    }
    
    // Actualizar UI con el contador local
    const hoyEl = document.getElementById('todayCycles');
    if (hoyEl) hoyEl.textContent = contadorLocalAcumulado;
    
    // Conectar MQTT
    connectMQTT();
    
    // Leer Supabase al arrancar
    leerResumenSupabase();
    
    // Configurar intervalos
    setInterval(leerResumenSupabase, 30000); // Cada 30 segundos
    iniciarGuardadoPeriodico();
    
    // Sincronizar cada 5 minutos
    setInterval(() => {
        sincronizarAlReconectar();
    }, 5 * 60 * 1000);
    
    // Guardar al cerrar la página (por si acaso)
    window.addEventListener('beforeunload', () => {
        if (contadorLocalAcumulado > 0) {
            const hoy = new Date().toISOString().split('T')[0];
            // Usar sync para que se ejecute antes de cerrar
            navigator.sendBeacon(
                `${SUPABASE_URL}/rest/v1/rpc/registrar_ciclos_esp32`,
                JSON.stringify({ p_ciclos_hoy: contadorLocalAcumulado, p_fecha: hoy })
            );
        }
    });
    
    console.log('✅ mqtt-client.js inicializado correctamente');
    console.log(`📊 Estado inicial - Contador local: ${contadorLocalAcumulado}`);
});

// Exportar funciones para uso global
window.actualizarContadorLocal = actualizarContadorLocal;
window.verificarCambioDeDia = verificarCambioDeDia;
window.sincronizarAlReconectar = sincronizarAlReconectar;
