// ============================================================
// SMARTGATE - GENERADOR DE PDF MEJORADO
// Con gráficos visuales desde Chart.js
// ============================================================

class GeneradorPDF {
    constructor() {
        console.log('📄 Inicializando GeneradorPDF Mejorado...');
        this.libreriasCargadas = false;
        
        this.margen = {
            superior: 25,
            inferior: 25,
            izquierdo: 30,
            derecho: 25
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

    // ============================================================
    // NUEVO: Capturar gráficos como imágenes
    // ============================================================
    async capturarGrafico(canvasId) {
        const canvas = document.getElementById(canvasId);
        if (!canvas) {
            console.log(`⚠️ Canvas ${canvasId} no encontrado`);
            return null;
        }
        
        try {
            // Esperar a que Chart.js termine de renderizar
            await new Promise(resolve => setTimeout(resolve, 300));
            
            // Convertir canvas a imagen
            const dataUrl = canvas.toDataURL('image/png');
            console.log(`✅ Gráfico ${canvasId} capturado`);
            return dataUrl;
        } catch (error) {
            console.error(`❌ Error capturando ${canvasId}:`, error);
            return null;
        }
    }

    // ============================================================
    // NUEVO: Capturar múltiples gráficos
    // ============================================================
    async capturarTodosLosGraficos() {
        const graficos = {
            diario: await this.capturarGrafico('dailyChart'),
            horario: await this.capturarGrafico('hourlyChart'),
            tendencia: await this.capturarGrafico('trendChart'),
            proyeccion: await this.capturarGrafico('projectionChart'),
            meta: await this.capturarGrafico('goalChart')
        };
        return graficos;
    }

    async generarReportePDF(tipo = 'completo') {
        console.log('📑 Generando PDF con gráficos visuales tipo:', tipo);
        
        try {
            this.mostrarMensajeCarga('Generando PDF con gráficos, espere...');
            
            if (!this.libreriasCargadas) {
                await this.cargarLibrerias();
                await new Promise(resolve => setTimeout(resolve, 500));
            }
            
            if (typeof jspdf === 'undefined') {
                throw new Error('jsPDF no está disponible');
            }
            
            // Capturar gráficos ANTES de generar el PDF
            const graficos = await this.capturarTodosLosGraficos();
            
            const { jsPDF } = window.jspdf;
            const doc = new jsPDF({
                orientation: 'landscape',
                unit: 'mm',
                format: 'letter'
            });
            
            doc.setFont('helvetica');
            const anchoUtil = doc.internal.pageSize.getWidth() - this.margen.izquierdo - this.margen.derecho;
            
            let yPos = await this.agregarEncabezadoConLogos(doc, anchoUtil);
            yPos += 15;
            
            // CONTENIDO CON GRÁFICOS
            yPos = await this.agregarReporteConGraficos(doc, yPos, anchoUtil, graficos);
            
            this.agregarPiePagina(doc);
            
            const fecha = new Date().toISOString().split('T')[0];
            doc.save(`smartgate_reporte_${fecha}.pdf`);
            
            this.mostrarMensajeExito('✅ PDF con gráficos generado correctamente');
            
        } catch (error) {
            console.error('❌ Error generando PDF:', error);
            this.mostrarMensajeError('Error al generar PDF: ' + error.message);
        }
    }

    // ============================================================
    // NUEVO: Reporte con gráficos visuales
    // ============================================================
    async agregarReporteConGraficos(doc, yPos, anchoUtil, graficos) {
        const x = this.margen.izquierdo;
        const pageWidth = doc.internal.pageSize.getWidth();
        
        // Título
        doc.setFontSize(16);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(0, 51, 102);
        doc.text('📊 DASHBOARD DE MANTENIMIENTO', pageWidth / 2, yPos, { align: 'center' });
        yPos += 12;
        
        // KPI principales
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(0, 51, 102);
        doc.text('INDICADORES PRINCIPALES', x, yPos);
        yPos += 8;
        
        const totalCiclos = typeof globalTotalAcumulado !== 'undefined' ? globalTotalAcumulado : 0;
        const ciclosHoy = typeof globalCiclosHoy !== 'undefined' ? globalCiclosHoy : 0;
        const estadoActual = document.getElementById('currentState')?.textContent || '---';
        
        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(0, 0, 0);
        
        const kpis = [
            { label: '🔢 Ciclos Totales:', value: totalCiclos },
            { label: '📅 Ciclos Hoy:', value: ciclosHoy },
            { label: '🚪 Estado Actual:', value: estadoActual }
        ];
        
        kpis.forEach((kpi, index) => {
            const colX = x + (index * 70);
            doc.setFont('helvetica', 'bold');
            doc.text(kpi.label, colX, yPos);
            doc.setFont('helvetica', 'normal');
            doc.text(String(kpi.value), colX + 45, yPos);
        });
        yPos += 15;
        
        // GRÁFICO 1: Ciclos por día (si está disponible)
        if (graficos.diario) {
            doc.setFontSize(12);
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(0, 51, 102);
            doc.text('📊 Ciclos por día (últimos 7 días)', x, yPos);
            yPos += 5;
            
            try {
                doc.addImage(graficos.diario, 'PNG', x, yPos, 120, 60);
                yPos += 65;
            } catch(e) {
                doc.text('⚠️ Gráfico no disponible', x + 5, yPos);
                yPos += 10;
            }
        }
        
        // GRÁFICO 2: Horario de actividad
        if (graficos.horario) {
            if (yPos > 150) {
                doc.addPage();
                yPos = 30;
                await this.agregarEncabezadoConLogos(doc, anchoUtil);
            }
            
            doc.setFontSize(12);
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(0, 51, 102);
            doc.text('⏰ Horario de mayor actividad', x, yPos);
            yPos += 5;
            
            try {
                doc.addImage(graficos.horario, 'PNG', x, yPos, 120, 55);
                yPos += 60;
            } catch(e) {
                doc.text('⚠️ Gráfico no disponible', x + 5, yPos);
                yPos += 10;
            }
        }
        
        // Nueva página para más gráficos
        doc.addPage();
        yPos = 30;
        await this.agregarEncabezadoConLogos(doc, anchoUtil);
        
        // GRÁFICO 3: Tendencia
        if (graficos.tendencia) {
            doc.setFontSize(12);
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(0, 51, 102);
            doc.text('📈 Tendencia de uso (últimos 30 días)', x, yPos);
            yPos += 5;
            
            try {
                doc.addImage(graficos.tendencia, 'PNG', x, yPos, 140, 65);
                yPos += 70;
            } catch(e) {
                doc.text('⚠️ Gráfico no disponible', x + 5, yPos);
                yPos += 10;
            }
        }
        
        // GRÁFICO 4: Proyección
        if (graficos.proyeccion) {
            if (yPos > 130) {
                doc.addPage();
                yPos = 30;
                await this.agregarEncabezadoConLogos(doc, anchoUtil);
            }
            
            doc.setFontSize(12);
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(0, 51, 102);
            doc.text('🔮 Proyección de mantenimiento', x, yPos);
            yPos += 5;
            
            try {
                doc.addImage(graficos.proyeccion, 'PNG', x, yPos, 130, 60);
                yPos += 65;
            } catch(e) {
                doc.text('⚠️ Gráfico no disponible', x + 5, yPos);
                yPos += 10;
            }
        }
        
        // Tabla de mantenimiento
        if (yPos > 200) {
            doc.addPage();
            yPos = 30;
            await this.agregarEncabezadoConLogos(doc, anchoUtil);
        }
        
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(0, 51, 102);
        doc.text('📋 CALENDARIO DE MANTENIMIENTO', x, yPos);
        yPos += 10;
        
        const tablaMantenimiento = [
            ['Tipo', 'Ciclos', 'Estado', 'Próximo'],
            ['Revisión Preventiva', '500', this.obtenerEstadoMantenimiento(500), `${this.obtenerCiclosRestantes(500)} ciclos`],
            ['Lubricación', '1000', this.obtenerEstadoMantenimiento(1000), `${this.obtenerCiclosRestantes(1000)} ciclos`],
            ['Revisión General', '2000', this.obtenerEstadoMantenimiento(2000), `${this.obtenerCiclosRestantes(2000)} ciclos`]
        ];
        
        yPos = this.dibujarTabla(doc, tablaMantenimiento, x, yPos, 180);
        yPos += 15;
        
        // Predicción
        const total = totalCiclos;
        let prediccion = '';
        let color = [16, 185, 129];
        
        if (total > 4000) {
            prediccion = '⚠️ CRÍTICO: Se recomienda reemplazo preventivo del motor';
            color = [220, 38, 38];
        } else if (total > 3000) {
            prediccion = '⚠️ ATENCIÓN: Desgaste significativo detectado';
            color = [245, 158, 11];
        } else if (total > 2000) {
            prediccion = 'ℹ️ Mantenimiento regular requerido';
            color = [59, 130, 246];
        } else {
            prediccion = '✅ Sistema en excelente estado';
            color = [16, 185, 129];
        }
        
        doc.setFontSize(11);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(color[0], color[1], color[2]);
        doc.text(prediccion, x, yPos);
        
        return yPos + 20;
    }

    // ... (resto de métodos existentes: mostrarMensajes, cargarImagen, encabezados, etc.)
    // Mantengo los métodos originales para no romper nada

    async agregarEncabezadoConLogos(doc, anchoUtil) {
        const pageWidth = doc.internal.pageSize.getWidth();
        const logoWidth = 22;
        const logoHeight = 22;
        const x = this.margen.izquierdo;
        
        let logoInstitutoData = null;
        try {
            logoInstitutoData = await this.cargarImagenDesdeURL(this.urlsLogos.instituto);
        } catch(e) {}
        
        if (logoInstitutoData) {
            try {
                doc.addImage(logoInstitutoData, 'PNG', x, 10, logoWidth, logoHeight);
            } catch(e) {
                this.dibujarTextoInstituto(doc, x, 20);
            }
        } else {
            this.dibujarTextoInstituto(doc, x, 20);
        }
        
        doc.setFontSize(16);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(0, 51, 102);
        doc.text('SMARTGATE MONITOR', pageWidth / 2, 18, { align: 'center' });
        
        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(80, 80, 80);
        doc.text('Sistema Predictivo de Mantenimiento', pageWidth / 2, 26, { align: 'center' });
        doc.text('Portón Automático', pageWidth / 2, 32, { align: 'center' });
        
        let logoCarreraData = null;
        try {
            logoCarreraData = await this.cargarImagenDesdeURL(this.urlsLogos.carrera);
        } catch(e) {}
        
        if (logoCarreraData) {
            try {
                doc.addImage(logoCarreraData, 'PNG', pageWidth - this.margen.derecho - logoWidth, 10, logoWidth, logoHeight);
            } catch(e) {
                this.dibujarTextoUniversidad(doc, pageWidth - this.margen.derecho - 35, 20);
            }
        } else {
            this.dibujarTextoUniversidad(doc, pageWidth - this.margen.derecho - 35, 20);
        }
        
        doc.setDrawColor(200, 200, 200);
        doc.line(x, 42, pageWidth - this.margen.derecho, 42);
        
        doc.setFontSize(9);
        doc.setTextColor(120, 120, 120);
        const fechaActual = new Date().toLocaleDateString('es-ES', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
        doc.text(fechaActual, pageWidth - this.margen.derecho - 5, 52, { align: 'right' });
        
        return 52;
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
            img.onerror = reject;
            img.src = url;
        });
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
        
        doc.setFillColor(0, 51, 102);
        doc.setTextColor(255, 255, 255);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(9);
        
        for (let i = 0; i < colCount; i++) {
            doc.rect(x + (i * colWidth), yPos, colWidth, 8, 'F');
            doc.text(datos[0][i], x + (i * colWidth) + 2, yPos + 5.5);
        }
        
        yPos += 8;
        
        doc.setTextColor(0, 0, 0);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9);
        
        for (let i = 1; i < datos.length; i++) {
            if (i % 2 === 0) {
                doc.setFillColor(245, 245, 245);
                doc.rect(x, yPos, ancho, 7, 'F');
            }
            
            for (let j = 0; j < colCount; j++) {
                let texto = datos[i][j].toString();
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
            this.mostrarMensajeCarga('Generando Excel con gráficos, espere...');
            
            if (typeof XLSX === 'undefined') {
                await this.cargarSheetJS();
                await new Promise(resolve => setTimeout(resolve, 500));
            }
            
            const wb = XLSX.utils.book_new();
            
            const totalCiclos = typeof globalTotalAcumulado !== 'undefined' ? globalTotalAcumulado : 0;
            const ciclosHoy = typeof globalCiclosHoy !== 'undefined' ? globalCiclosHoy : 0;
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
            
            const fecha = new Date().toISOString().split('T')[0];
            XLSX.writeFile(wb, `smartgate_reporte_${fecha}.xlsx`);
            
            this.mostrarMensajeExito('✅ Excel generado correctamente');
            
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
