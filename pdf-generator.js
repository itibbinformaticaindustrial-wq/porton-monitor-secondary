// Generador de PDF - VERSIÓN CON MÁRGENES PROFESIONALES
class GeneradorPDF {
    constructor() {
        console.log('📄 Inicializando GeneradorPDF...');
        this.libreriasCargadas = false;
        
        // Configuración de márgenes (en mm)
        this.margen = {
            superior: 55,
            izquierdo: 20,
            derecho: 20,
            inferior: 20
        };
        
        this.urlsLogos = {
            instituto: window.location.origin + '/porton-monitor-secondary/img/logo-instituto.png',
            carrera: window.location.origin + '/porton-monitor-secondary/img/logo-carrera.webp'
        };
        
        this.logosCache = {
            instituto: localStorage.getItem('logo_instituto'),
            carrera: localStorage.getItem('logo_carrera')
        };
        
        this.verificarLibrerias();
    }

    verificarLibrerias() {
        if (typeof jspdf !== 'undefined' && typeof html2canvas !== 'undefined') {
            console.log('✅ Librerías jsPDF y html2canvas ya cargadas');
            this.libreriasCargadas = true;
        } else {
            console.log('⏳ Esperando carga de librerías...');
            this.cargarLibrerias();
        }
    }

    async cargarLibrerias() {
        return new Promise((resolve, reject) => {
            const script1 = document.createElement('script');
            script1.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
            script1.onload = () => {
                console.log('✅ jsPDF cargado');
                const script2 = document.createElement('script');
                script2.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js';
                script2.onload = () => {
                    console.log('✅ html2canvas cargado');
                    this.libreriasCargadas = true;
                    resolve();
                };
                script2.onerror = (e) => {
                    console.error('❌ Error cargando html2canvas:', e);
                    reject(e);
                };
                document.head.appendChild(script2);
            };
            script1.onerror = (e) => {
                console.error('❌ Error cargando jsPDF:', e);
                reject(e);
            };
            document.head.appendChild(script1);
        });
    }

    async generarReportePDF(tipo = 'completo') {
        console.log('📑 Generando PDF tipo:', tipo);
        
        try {
            this.mostrarMensajeCarga('Generando PDF, espere un momento...');
            
            if (!this.libreriasCargadas) {
                await this.cargarLibrerias();
                await new Promise(resolve => setTimeout(resolve, 500));
            }
            
            if (typeof jspdf === 'undefined') {
                throw new Error('jsPDF no está disponible');
            }
            
            const { jsPDF } = window.jspdf;
            const doc = new jsPDF({
                orientation: 'portrait',
                unit: 'mm',
                format: 'a4'
            });
            
            doc.setFont('helvetica');
            
            // Configurar márgenes
            const anchoUtil = doc.internal.pageSize.getWidth() - this.margen.izquierdo - this.margen.derecho;
            let yPos = this.margen.superior;
            
            // Agregar encabezado
            yPos = await this.agregarEncabezadoConLogos(doc, yPos, anchoUtil);
            yPos += 10;
            
            // Agregar contenido según tipo
            switch(tipo) {
                case 'completo':
                    yPos = await this.agregarReporteCompleto(doc, yPos, anchoUtil);
                    break;
                case 'mantenimiento':
                    yPos = await this.agregarReporteMantenimiento(doc, yPos, anchoUtil);
                    break;
                case 'estadisticas':
                    yPos = await this.agregarReporteEstadisticas(doc, yPos, anchoUtil);
                    break;
                default:
                    yPos = await this.agregarReporteCompleto(doc, yPos, anchoUtil);
            }
            
            this.agregarPiePagina(doc);
            
            const fecha = new Date().toISOString().split('T')[0];
            doc.save(`reporte_porton_${fecha}.pdf`);
            
            this.mostrarMensajeExito('✅ PDF generado correctamente');
            
        } catch (error) {
            console.error('❌ Error generando PDF:', error);
            this.mostrarMensajeError('Error al generar PDF: ' + error.message);
        }
    }

    mostrarMensajeCarga(mensaje) {
        const toast = document.getElementById('pdfLoadingToast');
        if (toast) toast.remove();
        
        const nuevo = document.createElement('div');
        nuevo.id = 'pdfLoadingToast';
        nuevo.style.cssText = `
            position: fixed;
            bottom: 20px;
            right: 20px;
            background: #3b82f6;
            color: white;
            padding: 12px 20px;
            border-radius: 10px;
            z-index: 10000;
            font-size: 14px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.2);
        `;
        nuevo.innerHTML = `⏳ ${mensaje}`;
        document.body.appendChild(nuevo);
    }

    mostrarMensajeExito(mensaje) {
        const toast = document.getElementById('pdfLoadingToast');
        if (toast) toast.remove();
        
        const exito = document.createElement('div');
        exito.style.cssText = `
            position: fixed;
            bottom: 20px;
            right: 20px;
            background: #10b981;
            color: white;
            padding: 12px 20px;
            border-radius: 10px;
            z-index: 10000;
            font-size: 14px;
        `;
        exito.innerHTML = `✅ ${mensaje}`;
        document.body.appendChild(exito);
        setTimeout(() => exito.remove(), 3000);
    }

    mostrarMensajeError(mensaje) {
        const toast = document.getElementById('pdfLoadingToast');
        if (toast) toast.remove();
        
        const error = document.createElement('div');
        error.style.cssText = `
            position: fixed;
            bottom: 20px;
            right: 20px;
            background: #ef4444;
            color: white;
            padding: 12px 20px;
            border-radius: 10px;
            z-index: 10000;
            font-size: 14px;
        `;
        error.innerHTML = `❌ ${mensaje}`;
        document.body.appendChild(error);
        setTimeout(() => error.remove(), 5000);
    }

    async cargarImagenDesdeURL(url) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.crossOrigin = 'Anonymous';
            img.onload = () => {
                const canvas = document.createElement('canvas');
                canvas.width = img.width;
                canvas.height = img.height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0);
                resolve(canvas.toDataURL('image/png'));
            };
            img.onerror = (e) => {
                console.log('No se pudo cargar imagen:', url);
                reject(e);
            };
            img.src = url;
        });
    }

    async agregarEncabezadoConLogos(doc, yStart, anchoUtil) {
        const pageWidth = doc.internal.pageSize.getWidth();
        const logoWidth = 22;
        const logoHeight = 22;
        
        // Logo izquierdo (Instituto)
        let logoInstitutoData = null;
        try {
            logoInstitutoData = await this.cargarImagenDesdeURL(this.urlsLogos.instituto);
        } catch(e) {
            console.log('Usando texto para logo instituto');
        }
        
        if (logoInstitutoData) {
            try {
                doc.addImage(logoInstitutoData, 'PNG', this.margen.izquierdo, 10, logoWidth, logoHeight);
            } catch(e) {
                this.dibujarTextoInstituto(doc, this.margen.izquierdo, 20);
            }
        } else {
            this.dibujarTextoInstituto(doc, this.margen.izquierdo, 20);
        }
        
        // Título central
        doc.setFontSize(16);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(0, 51, 102);
        doc.text('SMARTGATE MONITOR', pageWidth / 2, 18, { align: 'center' });
        
        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(80, 80, 80);
        doc.text('Sistema Predictivo de Mantenimiento', pageWidth / 2, 26, { align: 'center' });
        doc.text('Portón Automático', pageWidth / 2, 32, { align: 'center' });
        
        // Logo derecho (Carrera)
        let logoCarreraData = null;
        try {
            logoCarreraData = await this.cargarImagenDesdeURL(this.urlsLogos.carrera);
        } catch(e) {
            console.log('Usando texto para logo carrera');
        }
        
        if (logoCarreraData) {
            try {
                doc.addImage(logoCarreraData, 'PNG', pageWidth - this.margen.derecho - logoWidth, 10, logoWidth, logoHeight);
            } catch(e) {
                this.dibujarTextoUniversidad(doc, pageWidth - this.margen.derecho - 35, 20);
            }
        } else {
            this.dibujarTextoUniversidad(doc, pageWidth - this.margen.derecho - 35, 20);
        }
        
        // Línea separadora
        doc.setDrawColor(200, 200, 200);
        doc.line(this.margen.izquierdo, 42, pageWidth - this.margen.derecho, 42);
        
        // Fecha (bien posicionada, sin salirse)
        doc.setFontSize(9);
        doc.setTextColor(120, 120, 120);
        const fechaActual = new Date().toLocaleDateString('es-ES', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
        doc.text(`Fecha: ${fechaActual}`, pageWidth - this.margen.derecho - 35, 50);
        
        return 55;
    }

    dibujarTextoInstituto(doc, x, y) {
        doc.setFontSize(7);
        doc.setTextColor(100);
        doc.text('Instituto Tecnológico', x, y);
        doc.text('Industrial Brasil Bolivia', x, y + 4);
    }

    dibujarTextoUniversidad(doc, x, y) {
        doc.setFontSize(7);
        doc.setTextColor(100);
        doc.text('Ingeniería', x + 5, y);
        doc.text('Informática', x + 5, y + 4);
    }

    async agregarReporteCompleto(doc, yPos, anchoUtil) {
        const pageWidth = doc.internal.pageSize.getWidth();
        const x = this.margen.izquierdo;
        
        // Título sección
        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(0, 51, 102);
        doc.text('RESUMEN GENERAL', x, yPos);
        yPos += 10;
        
        // Datos
        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(0, 0, 0);
        
        const totalCiclos = typeof mantenimiento !== 'undefined' ? mantenimiento.ciclos.total : 0;
        const ciclosHoy = typeof mantenimiento !== 'undefined' ? mantenimiento.obtenerCiclosHoy() : 0;
        const estadoActual = document.getElementById('currentState')?.textContent || '---';
        const saludSistema = document.getElementById('healthPercent')?.textContent + '%' || '100%';
        const proximoMantenimiento = document.getElementById('nextMaintenance')?.textContent || '---';
        
        const datos = [
            ['Ciclos totales:', totalCiclos.toString()],
            ['Ciclos hoy:', ciclosHoy.toString()],
            ['Estado actual:', estadoActual],
            ['Salud del sistema:', saludSistema],
            ['Próximo mantenimiento:', proximoMantenimiento]
        ];
        
        datos.forEach(([label, value]) => {
            doc.setFont('helvetica', 'bold');
            doc.text(label, x + 5, yPos);
            doc.setFont('helvetica', 'normal');
            doc.text(value, x + 55, yPos);
            yPos += 7;
        });
        
        yPos += 10;
        
        // Verificar espacio para tabla
        if (yPos > 250) {
            doc.addPage();
            yPos = this.margen.superior;
            await this.agregarEncabezadoConLogos(doc, yPos, anchoUtil);
            yPos += 10;
        }
        
        // Tabla de mantenimiento
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(0, 51, 102);
        doc.text('MANTENIMIENTO PREVENTIVO', x, yPos);
        yPos += 8;
        
        const tablaMantenimiento = [
            ['Tipo', 'Ciclos', 'Estado', 'Próximo'],
            ['Revisión Preventiva', '500', this.obtenerEstadoMantenimiento(500), `${this.obtenerCiclosRestantes(500)} ciclos`],
            ['Lubricación', '1000', this.obtenerEstadoMantenimiento(1000), `${this.obtenerCiclosRestantes(1000)} ciclos`],
            ['Revisión General', '2000', this.obtenerEstadoMantenimiento(2000), `${this.obtenerCiclosRestantes(2000)} ciclos`]
        ];
        
        yPos = this.dibujarTabla(doc, tablaMantenimiento, x, yPos, anchoUtil);
        yPos += 10;
        
        // Verificar espacio
        if (yPos > 230) {
            doc.addPage();
            yPos = this.margen.superior;
            await this.agregarEncabezadoConLogos(doc, yPos, anchoUtil);
            yPos += 10;
        }
        
        // Estadísticas de uso
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(0, 51, 102);
        doc.text('ESTADÍSTICAS DE USO', x, yPos);
        yPos += 8;
        
        let ciclosPorDia = [];
        if (typeof mantenimiento !== 'undefined') {
            ciclosPorDia = mantenimiento.obtenerCiclosPorDia(7);
        }
        
        doc.setFontSize(9);
        doc.text('Ciclos por día (últimos 7 días):', x, yPos);
        yPos += 5;
        
        if (ciclosPorDia.length === 0) {
            doc.text('No hay datos disponibles', x + 5, yPos);
            yPos += 5;
        } else {
            for (const [fecha, cantidad] of ciclosPorDia) {
                if (yPos > 270) {
                    doc.addPage();
                    yPos = this.margen.superior;
                    await this.agregarEncabezadoConLogos(doc, yPos, anchoUtil);
                    yPos += 10;
                }
                doc.text(`${fecha.substring(5)}: ${cantidad} ciclos`, x + 5, yPos);
                yPos += 5;
            }
        }
        
        yPos += 5;
        
        // Horas más activas
        let horasActivas = [];
        if (typeof mantenimiento !== 'undefined') {
            horasActivas = mantenimiento.obtenerCiclosPorHora();
        }
        
        const horasTop = horasActivas
            .map((cantidad, hora) => ({ hora, cantidad }))
            .sort((a, b) => b.cantidad - a.cantidad)
            .slice(0, 5);
        
        doc.text('Horas de mayor actividad:', x, yPos);
        yPos += 5;
        
        if (horasTop.length === 0 || horasTop[0].cantidad === 0) {
            doc.text('No hay datos de actividad disponibles', x + 5, yPos);
        } else {
            for (const { hora, cantidad } of horasTop) {
                if (yPos > 270) {
                    doc.addPage();
                    yPos = this.margen.superior;
                    await this.agregarEncabezadoConLogos(doc, yPos, anchoUtil);
                    yPos += 10;
                }
                doc.text(`${hora}:00 - ${hora + 1}:00: ${cantidad} ciclos`, x + 5, yPos);
                yPos += 5;
            }
        }
        
        return yPos;
    }

    async agregarReporteMantenimiento(doc, yPos, anchoUtil) {
        const x = this.margen.izquierdo;
        
        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(0, 51, 102);
        doc.text('HISTORIAL DE MANTENIMIENTO', x, yPos);
        yPos += 10;
        
        let historialMantenimiento = [];
        if (typeof mantenimiento !== 'undefined') {
            historialMantenimiento = mantenimiento.historialMantenimiento || [];
        }
        
        if (historialMantenimiento.length === 0) {
            doc.text('No hay registros de mantenimiento previos', x + 5, yPos);
            yPos += 10;
        } else {
            const tablaMantenimientos = [
                ['Fecha', 'Tipo', 'Ciclos al momento']
            ];
            
            historialMantenimiento.slice(-10).forEach(m => {
                tablaMantenimientos.push([
                    new Date(m.fecha).toLocaleDateString(),
                    m.tipo,
                    m.totalCiclos.toString()
                ]);
            });
            
            yPos = this.dibujarTabla(doc, tablaMantenimientos, x, yPos, anchoUtil);
            yPos += 10;
        }
        
        if (yPos > 230) {
            doc.addPage();
            yPos = this.margen.superior;
            await this.agregarEncabezadoConLogos(doc, yPos, anchoUtil);
            yPos += 10;
        }
        
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.text('RECOMENDACIONES', x, yPos);
        yPos += 8;
        
        const recomendaciones = [
            '• Realizar inspección visual mensual del mecanismo',
            '• Verificar el correcto funcionamiento de las fotocélulas',
            '• Mantener limpias las guías del portón',
            '• Revisar conexiones eléctricas cada 3 meses',
            '• Programar mantenimiento profesional anual'
        ];
        
        doc.setFontSize(9);
        for (const rec of recomendaciones) {
            if (yPos > 270) {
                doc.addPage();
                yPos = this.margen.superior;
                await this.agregarEncabezadoConLogos(doc, yPos, anchoUtil);
                yPos += 10;
            }
            doc.text(rec, x + 5, yPos);
            yPos += 6;
        }
        
        return yPos;
    }

    async agregarReporteEstadisticas(doc, yPos, anchoUtil) {
        const x = this.margen.izquierdo;
        
        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(0, 51, 102);
        doc.text('ANÁLISIS DE TENDENCIAS', x, yPos);
        yPos += 10;
        
        const totalCiclos = typeof mantenimiento !== 'undefined' ? mantenimiento.ciclos.total : 0;
        const proyeccion = Math.round(totalCiclos * 1.1);
        
        doc.setFontSize(10);
        doc.text(`Ciclos actuales: ${totalCiclos}`, x + 5, yPos);
        yPos += 7;
        doc.text(`Proyección próximo mes: ${proyeccion} ciclos`, x + 5, yPos);
        yPos += 7;
        
        const vidaUtil = 5000;
        const porcentajeVida = (totalCiclos / vidaUtil * 100).toFixed(1);
        doc.text(`Vida útil consumida: ${porcentajeVida}%`, x + 5, yPos);
        yPos += 7;
        
        const vidaRestante = vidaUtil - totalCiclos;
        doc.text(`Ciclos restantes estimados: ${vidaRestante}`, x + 5, yPos);
        yPos += 15;
        
        doc.setFontSize(11);
        doc.setFont('helvetica', 'bold');
        
        if (totalCiclos > 4000) {
            doc.setTextColor(220, 38, 38);
            doc.text('⚠️ ALERTA: Se recomienda reemplazo preventivo del motor', x + 5, yPos);
        } else if (totalCiclos > 3000) {
            doc.setTextColor(245, 158, 11);
            doc.text('⚠️ Atención: Desgaste significativo detectado', x + 5, yPos);
        } else if (totalCiclos > 2000) {
            doc.setTextColor(59, 130, 246);
            doc.text('ℹ️ Mantenimiento regular requerido', x + 5, yPos);
        } else {
            doc.setTextColor(16, 185, 129);
            doc.text('✅ Sistema en excelente estado', x + 5, yPos);
        }
        
        return yPos + 10;
    }

    agregarPiePagina(doc) {
        const pageCount = doc.internal.getNumberOfPages();
        const pageWidth = doc.internal.pageSize.getWidth();
        
        for (let i = 1; i <= pageCount; i++) {
            doc.setPage(i);
            doc.setFontSize(8);
            doc.setTextColor(150, 150, 150);
            doc.text(
                `Instituto Tecnológico Industrial Brasil Bolivia - Ingeniería Informática | Página ${i} de ${pageCount}`,
                pageWidth / 2,
                doc.internal.pageSize.getHeight() - 12,
                { align: 'center' }
            );
        }
    }

    dibujarTabla(doc, datos, x, y, ancho) {
        const colCount = datos[0].length;
        const colWidth = ancho / colCount;
        let yPos = y;
        
        // Cabecera
        doc.setFillColor(0, 51, 102);
        doc.setTextColor(255, 255, 255);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(9);
        
        for (let i = 0; i < colCount; i++) {
            doc.rect(x + (i * colWidth), yPos, colWidth, 8, 'F');
            doc.text(datos[0][i], x + (i * colWidth) + 2, yPos + 5.5);
        }
        
        yPos += 8;
        
        // Filas
        doc.setTextColor(0, 0, 0);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9);
        
        for (let i = 1; i < datos.length; i++) {
            // Color alternado
            if (i % 2 === 0) {
                doc.setFillColor(245, 245, 245);
                doc.rect(x, yPos, ancho, 7, 'F');
            }
            
            for (let j = 0; j < colCount; j++) {
                let texto = datos[i][j].toString();
                // Truncar texto si es muy largo
                if (texto.length > 20) {
                    texto = texto.substring(0, 18) + '...';
                }
                doc.text(texto, x + (j * colWidth) + 2, yPos + 5);
            }
            yPos += 7;
        }
        
        return yPos + 5;
    }

    obtenerEstadoMantenimiento(limite) {
        if (typeof mantenimiento === 'undefined') return 'Sin datos';
        const total = mantenimiento.ciclos.total;
        const completados = Math.floor(total / limite);
        if (completados === 0) return 'Pendiente';
        if (total % limite === 0 && total > 0) return 'Completado';
        return 'En progreso';
    }

    obtenerCiclosRestantes(limite) {
        if (typeof mantenimiento === 'undefined') return 0;
        const total = mantenimiento.ciclos.total;
        const siguiente = Math.ceil(total / limite) * limite;
        return siguiente - total;
    }

    formatearDetallesExcel(datos) {
        const detalles = [];
        if (datos.modoAuto !== undefined) detalles.push(`Auto:${datos.modoAuto}`);
        if (datos.emergenciaActiva) detalles.push('Emergencia');
        if (datos.permisoEspecial) detalles.push('Permiso Especial');
        if (datos.horarioActivo) detalles.push('Modo Horario');
        if (datos.abierto === true) detalles.push('Sensor ABIERTO');
        if (datos.cerrado === true) detalles.push('Sensor CERRADO');
        if (datos.fotoHabilitado === true) detalles.push('Fotocélula OK');
        if (datos.botonFisicoHabilitado === true) detalles.push('Botón Físico OK');
        return detalles.join(' | ') || 'Sin detalles';
    }

    async cargarSheetJS() {
        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = 'https://cdn.sheetjs.com/xlsx-0.20.2/package/dist/xlsx.full.min.js';
            script.onload = resolve;
            script.onerror = reject;
            document.head.appendChild(script);
        });
    }

    async exportarExcelCompleto() {
        try {
            this.mostrarMensajeCarga('Generando Excel, espere...');
            
            if (typeof XLSX === 'undefined') {
                await this.cargarSheetJS();
                await new Promise(resolve => setTimeout(resolve, 500));
            }
            
            const wb = XLSX.utils.book_new();
            
            const totalCiclos = typeof mantenimiento !== 'undefined' ? mantenimiento.ciclos.total : 0;
            const ciclosHoy = typeof mantenimiento !== 'undefined' ? mantenimiento.obtenerCiclosHoy() : 0;
            const estadoActual = document.getElementById('currentState')?.textContent || '---';
            const saludSistema = document.getElementById('healthPercent')?.textContent + '%' || '100%';
            
            const resumenData = [
                ['SMARTGATE MONITOR - REPORTE COMPLETO'],
                ['Instituto Tecnológico Industrial Brasil Bolivia - Ingeniería Informática'],
                ['Fecha:', new Date().toLocaleString()],
                [''],
                ['RESUMEN GENERAL'],
                ['Ciclos Totales', totalCiclos],
                ['Ciclos Hoy', ciclosHoy],
                ['Estado Actual', estadoActual],
                ['Salud del Sistema', saludSistema],
                [''],
                ['MANTENIMIENTO'],
                ['Tipo', 'Ciclo Requerido', 'Estado', 'Ciclos Restantes'],
                ['Revisión Preventiva', '500', this.obtenerEstadoMantenimiento(500), this.obtenerCiclosRestantes(500)],
                ['Lubricación', '1000', this.obtenerEstadoMantenimiento(1000), this.obtenerCiclosRestantes(1000)],
                ['Revisión General', '2000', this.obtenerEstadoMantenimiento(2000), this.obtenerCiclosRestantes(2000)]
            ];
            
            const wsResumen = XLSX.utils.aoa_to_sheet(resumenData);
            wsResumen['!cols'] = [{wch:25}, {wch:15}];
            XLSX.utils.book_append_sheet(wb, wsResumen, 'Resumen');
            
            const ciclosData = [['Fecha', 'Ciclos']];
            if (typeof mantenimiento !== 'undefined') {
                const ciclosPorDia = mantenimiento.obtenerCiclosPorDia(30);
                ciclosPorDia.forEach(([fecha, cantidad]) => {
                    ciclosData.push([fecha, cantidad]);
                });
            }
            
            const wsCiclos = XLSX.utils.aoa_to_sheet(ciclosData);
            wsCiclos['!cols'] = [{wch:15}, {wch:10}];
            XLSX.utils.book_append_sheet(wb, wsCiclos, 'Ciclos por Día');
            
            const eventosData = [['Fecha', 'Tipo', 'Evento', 'Detalles']];
            if (typeof registro !== 'undefined' && registro.eventos) {
                registro.eventos.slice(0, 500).forEach(evento => {
                    eventosData.push([
                        new Date(evento.timestamp).toLocaleString(),
                        evento.tipo,
                        evento.datos.estado || evento.datos.abierto || '-',
                        this.formatearDetallesExcel(evento.datos)
                    ]);
                });
            }
            
            const wsEventos = XLSX.utils.aoa_to_sheet(eventosData);
            wsEventos['!cols'] = [{wch:20}, {wch:12}, {wch:15}, {wch:30}];
            XLSX.utils.book_append_sheet(wb, wsEventos, 'Eventos');
            
            const fecha = new Date().toISOString().split('T')[0];
            XLSX.writeFile(wb, `reporte_porton_${fecha}.xlsx`);
            
            this.mostrarMensajeExito('✅ Excel exportado correctamente');
            
        } catch (error) {
            console.error('Error exportando Excel:', error);
            this.mostrarMensajeError('Error al exportar a Excel: ' + error.message);
        }
    }
}

const generadorPDF = new GeneradorPDF();

function generarPDFCompleto() {
    generadorPDF.generarReportePDF('completo');
}

function generarPDFMantenimiento() {
    generadorPDF.generarReportePDF('mantenimiento');
}

function generarPDFEstadisticas() {
    generadorPDF.generarReportePDF('estadisticas');
}

function exportarExcelCompleto() {
    generadorPDF.exportarExcelCompleto();
}
