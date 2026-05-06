class SistemaNotificaciones {
    constructor() {
        this.permisoPush = false;
        this.notificacionesPendientes = [];
        // ✅ CORREGIDO: 4 sonidos diferentes
        this.sonidos = {
            abrir: new Audio('https://cdn.freesound.org/previews/15/15419_45698-lq.mp3'),
            cerrar: new Audio('https://cdn.freesound.org/previews/423/423774_8326967-lq.mp3'),
            mantenimiento: new Audio('https://cdn.freesound.org/previews/629/629312_13885154-lq.mp3'),
            emergencia: new Audio('https://cdn.freesound.org/previews/532/532821_10949077-lq.mp3')
        };
        this.cargarConfiguracion();
        this.solicitarPermisoPush();
    }

    cargarConfiguracion() {
        this.config = {
            push: localStorage.getItem('notif_push') === 'true',
            sonido: localStorage.getItem('notif_sonido') === 'true',
            mantenimiento: localStorage.getItem('notif_mantenimiento') !== 'false',
            email: localStorage.getItem('notif_email') === 'true',
            emailDestino: localStorage.getItem('report_email') || ''
        };

        const pushCheck = document.getElementById('pushNotifications');
        const soundCheck = document.getElementById('soundAlerts');
        const maintCheck = document.getElementById('maintenanceAlerts');
        const emailCheck = document.getElementById('emailReports');
        const emailInput = document.getElementById('reportEmail');

        if (pushCheck) pushCheck.checked = this.config.push;
        if (soundCheck) soundCheck.checked = this.config.sonido;
        if (maintCheck) maintCheck.checked = this.config.mantenimiento;
        if (emailCheck) emailCheck.checked = this.config.email;
        
        if (this.config.email && emailInput) {
            const emailConfig = document.getElementById('emailConfig');
            if (emailConfig) emailConfig.style.display = 'block';
            emailInput.value = this.config.emailDestino;
        }

        this.agregarEventListeners();
    }

    agregarEventListeners() {
        const pushCheck = document.getElementById('pushNotifications');
        const soundCheck = document.getElementById('soundAlerts');
        const maintCheck = document.getElementById('maintenanceAlerts');
        const emailCheck = document.getElementById('emailReports');

        if (pushCheck) {
            pushCheck.addEventListener('change', (e) => {
                this.config.push = e.target.checked;
                localStorage.setItem('notif_push', this.config.push);
                if (this.config.push) this.solicitarPermisoPush();
            });
        }

        if (soundCheck) {
            soundCheck.addEventListener('change', (e) => {
                this.config.sonido = e.target.checked;
                localStorage.setItem('notif_sonido', this.config.sonido);
            });
        }

        if (maintCheck) {
            maintCheck.addEventListener('change', (e) => {
                this.config.mantenimiento = e.target.checked;
                localStorage.setItem('notif_mantenimiento', this.config.mantenimiento);
            });
        }

        if (emailCheck) {
            emailCheck.addEventListener('change', (e) => {
                this.config.email = e.target.checked;
                localStorage.setItem('notif_email', this.config.email);
                const emailConfig = document.getElementById('emailConfig');
                if (emailConfig) emailConfig.style.display = e.target.checked ? 'block' : 'none';
            });
        }
    }

    async solicitarPermisoPush() {
        if ('Notification' in window) {
            const permiso = await Notification.requestPermission();
            this.permisoPush = permiso === 'granted';
        }
    }

    enviarNotificacion(titulo, cuerpo, tipo = 'info') {
        this.mostrarToast(titulo, cuerpo, tipo);
        
        if (this.config.sonido) {
            this.reproducirSonido(tipo);
        }
        
        if (this.config.push && this.permisoPush && 'Notification' in window) {
            new Notification(titulo, { body: cuerpo, icon: '/favicon.ico' });
        }
        
        this.guardarNotificacion(titulo, cuerpo, tipo);
    }

    mostrarToast(titulo, cuerpo, tipo) {
        const toast = document.createElement('div');
        toast.className = `notification-toast ${tipo}`;
        toast.innerHTML = `
            <span class="toast-icon">${tipo === 'emergencia' ? '🚨' : tipo === 'warning' ? '⚠️' : tipo === 'info' ? 'ℹ️' : '🔔'}</span>
            <div>
                <strong>${titulo}</strong><br>
                <small>${cuerpo}</small>
            </div>
        `;
        
        document.body.appendChild(toast);
        
        setTimeout(() => {
            toast.style.animation = 'slideUp 0.3s reverse';
            setTimeout(() => toast.remove(), 300);
        }, 5000);
    }

    // ✅ CORREGIDO: Reproducir sonido según el tipo de evento
    reproducirSonido(tipo) {
        let sonido = null;
        
        switch(tipo) {
            case 'abrir':
                sonido = this.sonidos.abrir;
                break;
            case 'cerrar':
                sonido = this.sonidos.cerrar;
                break;
            case 'mantenimiento':
            case 'warning':
                sonido = this.sonidos.mantenimiento;
                break;
            case 'emergencia':
            case 'alert':
                sonido = this.sonidos.emergencia;
                break;
            default:
                sonido = this.sonidos.abrir;
        }
        
        if (sonido) {
            sonido.currentTime = 0; // Reiniciar si ya estaba sonando
            sonido.play().catch(e => console.log('Error reproduciendo sonido:', e));
        }
    }

    guardarNotificacion(titulo, cuerpo, tipo) {
        const notificaciones = JSON.parse(localStorage.getItem('notificaciones') || '[]');
        notificaciones.unshift({
            id: Date.now(),
            titulo,
            cuerpo,
            tipo,
            fecha: new Date().toISOString()
        });
        
        while (notificaciones.length > 100) notificaciones.pop();
        localStorage.setItem('notificaciones', JSON.stringify(notificaciones));
    }

    // ✅ NUEVO: Alerta de apertura
    alertaAbrir() {
        if (this.config.sonido) {
            this.reproducirSonido('abrir');
        }
        this.enviarNotificacion('Portón Abriendo', 'El portón se está abriendo', 'info');
    }

    // ✅ NUEVO: Alerta de cierre
    alertaCerrar() {
        if (this.config.sonido) {
            this.reproducirSonido('cerrar');
        }
        this.enviarNotificacion('Portón Cerrando', 'El portón se está cerrando', 'info');
    }

    // ✅ MODIFICADO: Alerta de mantenimiento
    alertaMantenimiento(mensaje) {
        if (this.config.mantenimiento) {
            this.reproducirSonido('mantenimiento');
            this.enviarNotificacion('Mantenimiento Requerido', mensaje, 'warning');
        }
    }

    // ✅ NUEVO: Alerta de emergencia
    alertaEmergencia(mensaje) {
        this.reproducirSonido('emergencia');
        this.enviarNotificacion('🚨 EMERGENCIA 🚨', mensaje, 'emergencia');
    }

    alertaEstado(estado) {
        if (estado === 'ABIERTO') {
            this.alertaAbrir();
        } else if (estado === 'CERRADO') {
            this.alertaCerrar();
        }
        this.enviarNotificacion('Cambio de Estado', `El portón está ${estado}`, 'info');
    }

    async enviarReporteSemanal() {
        if (!this.config.email || !this.config.emailDestino) return;
        
        const stats = {
            totalCiclos: typeof mantenimiento !== 'undefined' ? mantenimiento.ciclos.total : 0,
            ciclosSemana: typeof mantenimiento !== 'undefined' ? mantenimiento.obtenerCiclosPorDia(7).reduce((a,b) => a + b[1], 0) : 0,
            alertas: JSON.parse(localStorage.getItem('notificaciones') || '[]').slice(0, 10),
            salud: document.getElementById('healthPercent')?.textContent || '100'
        };
        
        console.log('Enviando reporte semanal:', stats);
    }
}

function testNotification() {
    if (typeof notificaciones !== 'undefined') {
        notificaciones.enviarNotificacion('Prueba', 'Las notificaciones funcionan correctamente', 'info');
    }
}

function testEmergencia() {
    if (typeof notificaciones !== 'undefined') {
        notificaciones.alertaEmergencia('Prueba de emergencia - ¡ALERTA!');
    }
}

function testMantenimiento() {
    if (typeof notificaciones !== 'undefined') {
        notificaciones.alertaMantenimiento('Prueba de mantenimiento - Revisión programada');
    }
}

function saveEmailConfig() {
    const email = document.getElementById('reportEmail').value;
    localStorage.setItem('report_email', email);
    if (typeof notificaciones !== 'undefined') {
        notificaciones.config.emailDestino = email;
    }
    alert('Email guardado correctamente');
}

const notificaciones = new SistemaNotificaciones();

setInterval(() => {
    const ahora = new Date();
    if (ahora.getDay() === 0 && ahora.getHours() === 9 && typeof notificaciones !== 'undefined') {
        notificaciones.enviarReporteSemanal();
    }
}, 3600000);
