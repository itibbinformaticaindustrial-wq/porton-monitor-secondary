class RegistroEventos {
    constructor() {
        this.eventos = this.cargarEventos();
        this.actualizarUI();
        this.actualizarTablaHistorial();
    }

    cargarEventos() {
        const guardado = localStorage.getItem('porton_eventos_avanzado');
        return guardado ? JSON.parse(guardado) : [];
    }

    guardarEventos() {
        localStorage.setItem('porton_eventos_avanzado', JSON.stringify(this.eventos));
        if (this.eventos.length > 2000) {
            this.eventos = this.eventos.slice(-2000);
            this.guardarEventos();
        }
    }

    agregarEvento(tipo, datos) {
        const evento = {
            id: Date.now(),
            timestamp: new Date().toISOString(),
            tipo: tipo,
            datos: datos,
            horaMostrar: new Date().toLocaleString()
        };
        
        this.eventos.unshift(evento);
        this.guardarEventos();
        this.actualizarUI();
        this.actualizarTablaHistorial();
        this.agregarALineaTiempo(evento);
        
        return evento;
    }

    agregarALineaTiempo(evento) {
        const timeline = document.getElementById('activityTimeline');
        if (!timeline) return;
        
        if (timeline.querySelector('.empty-state')) {
            timeline.innerHTML = '';
        }
        
        let icono = '📡';
        let descripcion = '';
        
        if (evento.tipo === 'ESTADO') {
            icono = '🚪';
            descripcion = evento.datos.estado || 'Cambio de estado';
        } else if (evento.tipo === 'SENSORES') {
            icono = '📡';
            const sensores = [];
            if (evento.datos.abierto) sensores.push('ABIERTO');
            if (evento.datos.cerrado) sensores.push('CERRADO');
            descripcion = sensores.join(' | ') || 'Lectura de sensores';
        } else if (evento.tipo === 'HEARTBEAT') {
            icono = '💓';
            descripcion = evento.datos.online ? 'ESP32 Online' : 'ESP32 Offline';
        } else if (evento.tipo === 'CONTADOR') {
            icono = '📊';
            descripcion = `Contador ESP32: ${evento.datos.ciclos} ciclos`;
        }
        
        const elemento = document.createElement('div');
        elemento.className = 'timeline-item';
        elemento.innerHTML = `
            <div class="timeline-time">${new Date(evento.timestamp).toLocaleTimeString()}</div>
            <div class="timeline-icon">${icono}</div>
            <div class="timeline-content">
                <div class="timeline-title">${evento.tipo}</div>
                <div class="timeline-desc">${descripcion}</div>
            </div>
        `;
        
        timeline.insertBefore(elemento, timeline.firstChild);
        
        while (timeline.children.length > 50) {
            timeline.removeChild(timeline.lastChild);
        }
    }

    actualizarUI() {
        const ultimoEventoSpan = document.getElementById('lastUpdate');
        if (ultimoEventoSpan && this.eventos.length > 0) {
            const ultimoEvento = this.eventos[0];
            const segundos = Math.floor((Date.now() - new Date(ultimoEvento.timestamp).getTime()) / 1000);
            ultimoEventoSpan.textContent = `Último: hace ${segundos}s`;
        }
        
        const tendenciaSpan = document.getElementById('trendWeek');
        if (tendenciaSpan) {
            const tendencia = mantenimiento.obtenerTendenciaSemanal();
            tendenciaSpan.textContent = `${tendencia >= 0 ? '+' : ''}${tendencia} esta semana`;
            tendenciaSpan.style.color = tendencia >= 0 ? '#10b981' : '#ef4444';
        }
        
        document.getElementById('totalCycles').textContent = mantenimiento.ciclos.total;
        document.getElementById('todayCycles').textContent = mantenimiento.obtenerCiclosHoy();
    }

    actualizarTablaHistorial() {
        const tbody = document.getElementById('historyBody');
        if (!tbody) return;
        
        const filtrados = this.filtrarEventos();
        
        if (filtrados.length === 0) {
            tbody.innerHTML = '<tr><td colspan="4">No hay eventos registrados</td>' + '</tr>';
            return;
        }
        
        tbody.innerHTML = filtrados.slice(0, 100).map(evento => `
            <tr>
                <td>${new Date(evento.timestamp).toLocaleString()}</td>
                <td><strong>${evento.tipo}</strong></td>
                <td>${evento.datos.estado || evento.datos.abierto || evento.datos.online || evento.datos.ciclos || '-'}</td>
                <td>${this.formatearDetalles(evento.datos)}</td>
            </tr>
        `).join('');
        
        document.getElementById('totalEvents').textContent = this.eventos.length;
        const esteMes = this.eventos.filter(e => {
            const fechaEvento = new Date(e.timestamp);
            const ahora = new Date();
            return fechaEvento.getMonth() === ahora.getMonth() && 
                   fechaEvento.getFullYear() === ahora.getFullYear();
        }).length;
        document.getElementById('monthEvents').textContent = esteMes;
        document.getElementById('avgDaily').textContent = 
            (this.eventos.length / 30).toFixed(1);
    }

    filtrarEventos() {
        const tipoFiltro = document.getElementById('eventTypeFilter')?.value || 'all';
        const fechaDesde = document.getElementById('dateFrom')?.value;
        const fechaHasta = document.getElementById('dateTo')?.value;
        
        let filtrados = this.eventos;
        
        if (tipoFiltro !== 'all') {
            filtrados = filtrados.filter(e => e.tipo === tipoFiltro);
        }
        
        if (fechaDesde) {
            filtrados = filtrados.filter(e => e.timestamp >= fechaDesde);
        }
        
        if (fechaHasta) {
            const fechaFin = new Date(fechaHasta);
            fechaFin.setDate(fechaFin.getDate() + 1);
            filtrados = filtrados.filter(e => e.timestamp < fechaFin.toISOString());
        }
        
        return filtrados;
    }

    formatearDetalles(datos) {
        const detalles = [];
        
        // Estado del portón
        if (datos.estado) detalles.push(`🚪 ${datos.estado}`);
        
        // Modos y configuraciones
        if (datos.modoAuto !== undefined) detalles.push(`🤖 Auto: ${datos.modoAuto ? 'ON' : 'OFF'}`);
        if (datos.fotoHabilitado !== undefined) detalles.push(`📷 Foto: ${datos.fotoHabilitado ? 'ON' : 'OFF'}`);
        if (datos.botonFisicoHabilitado !== undefined) detalles.push(`🎮 Botón: ${datos.botonFisicoHabilitado ? 'ON' : 'OFF'}`);
        if (datos.pirHabilitado !== undefined) detalles.push(`🚪 PIR: ${datos.pirHabilitado ? 'ON' : 'OFF'}`);
        if (datos.modoHorario !== undefined) detalles.push(`⏰ Horario: ${datos.modoHorario ? 'ON' : 'OFF'}`);
        if (datos.horarioActivo !== undefined) detalles.push(`📅 Horario activo: ${datos.horarioActivo ? 'Sí' : 'No'}`);
        
        // Emergencias
        if (datos.emergenciaActiva) detalles.push('🛑 EMERGENCIA LOCAL');
        if (datos.emergenciaRemotaActiva) detalles.push('🌐 EMERGENCIA REMOTA');
        
        // Permiso especial
        if (datos.permisoEspecial) {
            const tiempo = datos.tiempoPermiso ? ` ${datos.tiempoPermiso}s` : '';
            detalles.push(`🔑 PERMISO ESPECIAL${tiempo}`);
        }
        
        // Motor y chapa
        if (datos.motorActivo !== undefined) detalles.push(`⚙️ Motor: ${datos.motorActivo ? 'ACTIVO' : 'OFF'}`);
        if (datos.chapaActiva !== undefined) detalles.push(`🔐 Chapa: ${datos.chapaActiva ? 'ON' : 'OFF'}`);
        if (datos.movimientoSolicitado !== undefined) detalles.push(`🏃 Movimiento: ${datos.movimientoSolicitado ? 'Solicitado' : 'No'}`);
        
        // Sensores de final de carrera
        if (datos.abierto === true) detalles.push('🔓 Sensor ABIERTO');
        if (datos.cerrado === true) detalles.push('🔒 Sensor CERRADO');
        
        // Heartbeat
        if (datos.online !== undefined) detalles.push(datos.online ? '💚 ESP32 Online' : '🖤 ESP32 Offline');
        
        // NUEVO: Contador del ESP32
        if (datos.ciclos !== undefined) {
            detalles.push(`📊 Contador ESP32: ${datos.ciclos} ciclos`);
        }
        
        if (detalles.length === 0) {
            return 'Sin detalles';
        }
        
        return detalles.join(' | ');
    }

    exportarCSV() {
        const encabezados = ['Fecha/Hora', 'Tipo', 'Evento', 'Detalles'];
        const filas = this.eventos.map(evento => [
            evento.timestamp,
            evento.tipo,
            evento.datos.estado || evento.datos.abierto || evento.datos.online || evento.datos.ciclos || '',
            this.formatearDetalles(evento.datos)
        ]);
        
        const contenidoCSV = [encabezados, ...filas].map(fila => fila.join(',')).join('\n');
        const blob = new Blob(["\uFEFF" + contenidoCSV], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `porton_datos_${new Date().toISOString().split('T')[0]}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    }

    exportarJSON() {
        const datos = {
            fechaExportacion: new Date().toISOString(),
            totalCiclos: mantenimiento.ciclos.total,
            totalEventos: this.eventos.length,
            historialMantenimiento: mantenimiento.historialMantenimiento,
            eventos: this.eventos,
            ciclos: mantenimiento.ciclos.historial
        };
        
        const blob = new Blob([JSON.stringify(datos, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `porton_completo_${new Date().toISOString().split('T')[0]}.json`;
        a.click();
        URL.revokeObjectURL(url);
    }

    limpiarDatos() {
        if (confirm('⚠️ ¿Está seguro? Esta acción eliminará TODOS los datos registrados. No se puede deshacer.')) {
            this.eventos = [];
            mantenimiento.ciclos = { total: 0, historial: [], ultimoMantenimiento: null, predicciones: {} };
            mantenimiento.historialMantenimiento = [];
            mantenimiento.guardarCiclos();
            mantenimiento.guardarHistorialMantenimiento();
            this.guardarEventos();
            this.actualizarTablaHistorial();
            document.getElementById('activityTimeline').innerHTML = '<div class="empty-state">Esperando actividad del portón...</div>';
            mantenimiento.verificarAlertasMantenimiento();
            actualizarEstadisticas();
            actualizarGraficos();
        }
    }
}

const registro = new RegistroEventos();

// Funciones globales
function exportToCSV() { registro.exportarCSV(); }
function exportToJSON() { registro.exportarJSON(); }
function clearEvents() { registro.limpiarDatos(); }
function refreshData() { 
    registro.actualizarUI();
    registro.actualizarTablaHistorial();
    actualizarGraficos();
}
function filterHistory() { registro.actualizarTablaHistorial(); }
function resetFilters() {
    document.getElementById('dateFrom').value = '';
    document.getElementById('dateTo').value = '';
    document.getElementById('eventTypeFilter').value = 'all';
    registro.actualizarTablaHistorial();
}

function actualizarEstadisticas() {
    document.getElementById('totalCycles').textContent = mantenimiento.ciclos.total;
    document.getElementById('todayCycles').textContent = mantenimiento.obtenerCiclosHoy();
    mantenimiento.actualizarPredicciones();
}

let graficoDiario, graficoPorHora, graficoProyeccion, graficoMeta, graficoMensual, graficoComparacion, graficoTendencia;

function inicializarGraficos() {
    const ctx1 = document.getElementById('dailyChart')?.getContext('2d');
    const ctx2 = document.getElementById('hourlyChart')?.getContext('2d');
    const ctx3 = document.getElementById('projectionChart')?.getContext('2d');
    const ctx4 = document.getElementById('goalChart')?.getContext('2d');
    const ctx5 = document.getElementById('monthlyChart')?.getContext('2d');
    const ctx6 = document.getElementById('comparisonChart')?.getContext('2d');
    const ctx7 = document.getElementById('trendChart')?.getContext('2d');
    
    if (ctx1) {
        graficoDiario = new Chart(ctx1, {
            type: 'bar',
            data: { labels: [], datasets: [{ label: 'Ciclos', data: [], backgroundColor: '#667eea', borderRadius: 8 }] },
            options: { responsive: true, maintainAspectRatio: true, plugins: { legend: { position: 'top' } } }
        });
    }
    
    if (ctx2) {
        graficoPorHora = new Chart(ctx2, {
            type: 'line',
            data: { labels: Array.from({length: 24}, (_, i) => `${i}:00`), datasets: [{ label: 'Actividad', data: Array(24).fill(0), borderColor: '#764ba2', backgroundColor: 'rgba(118,75,162,0.1)', fill: true, tension: 0.4 }] },
            options: { responsive: true, maintainAspectRatio: true }
        });
    }
    
    if (ctx3) {
        graficoProyeccion = new Chart(ctx3, {
            type: 'line',
            data: { labels: [], datasets: [{ label: 'Proyección de uso', data: [], borderColor: '#f59e0b', fill: false }] },
            options: { responsive: true }
        });
    }
    
    if (ctx4) {
        graficoMeta = new Chart(ctx4, {
            type: 'doughnut',
            data: { labels: ['Completados', 'Restantes'], datasets: [{ data: [0, 500], backgroundColor: ['#10b981', '#e2e8f0'] }] },
            options: { responsive: true, plugins: { legend: { position: 'bottom' } } }
        });
    }
    
    if (ctx5) {
        graficoMensual = new Chart(ctx5, {
            type: 'bar',
            data: { labels: [], datasets: [{ label: 'Ciclos por mes', data: [], backgroundColor: '#3b82f6' }] },
            options: { responsive: true }
        });
    }
    
    if (ctx6) {
        graficoComparacion = new Chart(ctx6, {
            type: 'bar',
            data: { labels: ['Semana 1', 'Semana 2', 'Semana 3', 'Semana 4'], datasets: [{ label: 'Ciclos', data: [0,0,0,0], backgroundColor: '#10b981' }] },
            options: { responsive: true }
        });
    }
    
    if (ctx7) {
        graficoTendencia = new Chart(ctx7, {
            type: 'line',
            data: { labels: [], datasets: [{ label: 'Tendencia de uso', data: [], borderColor: '#ef4444', fill: false }] },
            options: { responsive: true }
        });
    }
}

function actualizarGraficos() {
    const dias = parseInt(document.getElementById('daysRange')?.value || 7);
    const datosDiarios = mantenimiento.obtenerCiclosPorDia(dias);
    if (graficoDiario) {
        graficoDiario.data.labels = datosDiarios.map(d => d[0].substring(5));
        graficoDiario.data.datasets[0].data = datosDiarios.map(d => d[1]);
        graficoDiario.update();
    }
    
    const datosPorHora = mantenimiento.obtenerCiclosPorHora();
    if (graficoPorHora) {
        graficoPorHora.data.datasets[0].data = datosPorHora;
        graficoPorHora.update();
    }
    
    const datosMensuales = mantenimiento.obtenerEstadisticasMensuales();
    if (graficoMensual) {
        graficoMensual.data.labels = datosMensuales.map(m => m[0]);
        graficoMensual.data.datasets[0].data = datosMensuales.map(m => m[1]);
        graficoMensual.update();
    }
    
    if (graficoMeta) {
        const progreso = mantenimiento.ciclos.total % 500;
        graficoMeta.data.datasets[0].data = [progreso, 500 - progreso];
        graficoMeta.update();
    }
    
    if (graficoProyeccion) {
        const ultimos7 = mantenimiento.obtenerCiclosPorDia(7);
        const promedios = ultimos7.map(d => d[1]);
        const promedio = promedios.reduce((a,b) => a+b, 0) / promedios.length;
        const proyeccion = [0, promedio, promedio*2, promedio*3, promedio*4];
        graficoProyeccion.data.labels = ['Hoy', 'Semana 1', 'Semana 2', 'Semana 3', 'Semana 4'];
        graficoProyeccion.data.datasets[0].data = proyeccion;
        graficoProyeccion.update();
    }
    
    if (graficoComparacion) {
        const semanas = [[], [], [], []];
        mantenimiento.ciclos.historial.slice(-28).forEach(ciclo => {
            const semana = Math.floor((new Date() - new Date(ciclo.fecha)) / (7*24*60*60*1000));
            if (semana < 4) semanas[semana].push(ciclo);
        });
        graficoComparacion.data.datasets[0].data = semanas.map(s => s.length);
        graficoComparacion.update();
    }
    
    if (graficoTendencia) {
        const ultimos30 = mantenimiento.obtenerCiclosPorDia(30);
        graficoTendencia.data.labels = ultimos30.map(d => d[0].substring(5));
        graficoTendencia.data.datasets[0].data = ultimos30.map(d => d[1]);
        graficoTendencia.update();
    }
}

document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', (e) => {
        e.preventDefault();
        const vista = item.dataset.view;
        document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
        document.getElementById(`${vista}View`).classList.add('active');
        document.querySelectorAll('.nav-item').forEach(nav => nav.classList.remove('active'));
        item.classList.add('active');
        
        if (vista === 'analytics') actualizarGraficos();
        if (vista === 'history') registro.actualizarTablaHistorial();
        if (vista === 'maintenance') mantenimiento.actualizarSaludSistema();
        
        if (window.innerWidth <= 1024) {
            document.getElementById('sidebar').classList.add('closed');
        }
    });
});

document.getElementById('openSidebar')?.addEventListener('click', () => {
    document.getElementById('sidebar').classList.remove('closed');
});

document.getElementById('closeSidebar')?.addEventListener('click', () => {
    document.getElementById('sidebar').classList.add('closed');
});

document.addEventListener('click', (e) => {
    if (window.innerWidth <= 1024) {
        const sidebar = document.getElementById('sidebar');
        const openBtn = document.getElementById('openSidebar');
        if (!sidebar.contains(e.target) && !openBtn.contains(e.target) && !sidebar.classList.contains('closed')) {
            sidebar.classList.add('closed');
        }
    }
});

document.addEventListener('DOMContentLoaded', () => {
    inicializarGraficos();
    actualizarEstadisticas();
    actualizarGraficos();
    mantenimiento.actualizarSaludSistema();
    mantenimiento.verificarAlertasMantenimiento();
});

function toggleDarkMode() {
    document.body.classList.toggle('dark-mode');
    const isDark = document.body.classList.contains('dark-mode');
    localStorage.setItem('dark_mode', isDark);
    const btn = document.querySelector('.btn-icon[title="Modo oscuro"]');
    if (btn) btn.textContent = isDark ? '☀️' : '🌙';
}

function changeColorTheme(theme) {
    const root = document.documentElement;
    const themes = {
        default: { primary: '#667eea', secondary: '#764ba2' },
        blue: { primary: '#3b82f6', secondary: '#2563eb' },
        green: { primary: '#10b981', secondary: '#059669' },
        orange: { primary: '#f59e0b', secondary: '#d97706' }
    };
    const colors = themes[theme];
    if (colors) {
        root.style.setProperty('--primary-color', colors.primary);
        root.style.setProperty('--secondary-color', colors.secondary);
    }
}

if (localStorage.getItem('dark_mode') === 'true') {
    document.body.classList.add('dark-mode');
}

const theme = localStorage.getItem('color_theme') || 'default';
const themeSelect = document.getElementById('colorTheme');
if (themeSelect) {
    themeSelect.value = theme;
    changeColorTheme(theme);
}

document.getElementById('darkModeToggle')?.addEventListener('change', (e) => {
    if (e.target.checked && !document.body.classList.contains('dark-mode')) toggleDarkMode();
    else if (!e.target.checked && document.body.classList.contains('dark-mode')) toggleDarkMode();
});

document.getElementById('colorTheme')?.addEventListener('change', (e) => {
    localStorage.setItem('color_theme', e.target.value);
    changeColorTheme(e.target.value);
});

function updateDailyGoal() {
    const goal = document.getElementById('dailyGoal').value;
    localStorage.setItem('daily_goal', goal);
    const sub = document.querySelector('.kpi-sub');
    if (sub && sub.textContent.includes('Meta:')) {
        sub.textContent = `Meta: ${goal} ciclos/día`;
    }
    alert(`Meta diaria actualizada a ${goal} ciclos`);
}

function clearAllData() {
    if (confirm('⚠️ ¿ELIMINAR TODOS LOS DATOS? Esta acción es irreversible.')) {
        localStorage.clear();
        alert('Todos los datos han sido eliminados. La página se recargará.');
        location.reload();
    }
}
