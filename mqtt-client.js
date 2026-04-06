// Configuración MQTT
const CONFIG_MQTT = {
    broker: 'wss://broker.hivemq.com:8000/mqtt',
    topics: {
        estado: 'porton/estado',
        sensores: 'porton/sensores',
        heartbeat: 'porton/heartbeat'
    }
};

let clienteMQTT;
let ultimoHeartbeat = null;

function conectarMQTT() {
    const idCliente = 'monitor_porton_' + Math.random().toString(16).substr(2, 8);
    
    clienteMQTT = mqtt.connect(CONFIG_MQTT.broker, {
        clientId: idCliente,
        clean: true,
        reconnectPeriod: 5000
    });
    
    clienteMQTT.on('connect', () => {
        console.log('✅ Conectado al broker MQTT');
        actualizarEstadoMQTT(true);
        
        // Suscribirse a todos los temas
        Object.values(CONFIG_MQTT.topics).forEach(topico => {
            clienteMQTT.subscribe(topico, (err) => {
                if (!err) console.log(`📡 Suscrito a: ${topico}`);
            });
        });
    });
    
    clienteMQTT.on('error', (err) => {
        console.error('❌ Error MQTT:', err);
        actualizarEstadoMQTT(false);
    });
    
    clienteMQTT.on('message', (topico, mensaje) => {
        try {
            const datos = JSON.parse(mensaje.toString());
            console.log(`📨 Mensaje recibido [${topico}]:`, datos);
            procesarMensajeMQTT(topico, datos);
        } catch (e) {
            console.error('Error al procesar mensaje:', e);
        }
    });
}

function actualizarEstadoMQTT(conectado) {
    const estadoDiv = document.querySelector('.mqtt-status');
    const indicador = estadoDiv?.querySelector('.status-indicator');
    const texto = estadoDiv?.querySelector('.status-text');
    
    if (indicador) {
        if (conectado) {
            indicador.classList.add('online');
            indicador.classList.remove('offline');
        } else {
            indicador.classList.remove('online');
            indicador.classList.add('offline');
        }
    }
    
    if (texto) {
        texto.textContent = conectado ? 'MQTT Conectado' : 'Desconectado';
    }
}

function procesarMensajeMQTT(topico, datos) {
    const timestamp = new Date().toISOString();
    
    switch(topico) {
        case 'porton/estado':
            registro.agregarEvento('ESTADO', datos);
            mantenimiento.procesarCambioEstado(datos.estado, timestamp);
            document.getElementById('currentState').textContent = datos.estado;
            actualizarEstadisticas();
            actualizarGraficos();
            break;
            
        case 'porton/sensores':
            registro.agregarEvento('SENSORES', datos);
            break;
            
        case 'porton/heartbeat':
            ultimoHeartbeat = datos.online;
            break;
    }
}

// Iniciar conexión cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', () => {
    conectarMQTT();
});
