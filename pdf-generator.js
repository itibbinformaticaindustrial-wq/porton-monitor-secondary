// ============================================================
// SMARTGATE - GENERADOR DE PDF (VERSIÓN HÍBRIDA)
// Con logos + gráficos + sin caracteres rotos
// ============================================================

class GeneradorPDF {
    constructor() {
        console.log('📄 Inicializando GeneradorPDF...');
        this.libreriasCargadas = false;
        
        this.margen = {
            superior: 25,
            inferior: 25,
            izquierdo: 20,
            derecho: 20
        };
        
        // URLs de logos (desde localStorage o por defecto)
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
            console.log('✅ Librerías ya cargadas');
            this.libreriasCargadas = true;
        } else {
            console.log('⏳ Cargando librerías...');
            this.cargarLibrerias();
        }
    }

    async cargarLibrerias() {
        return new Promise((resolve, reject) => {
            const script1 = document.createElement('script');
            script1.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
            script1.onload = () => {
                const script2 = document.createElement('script');
                script2.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js';
                script2.onload = () => {
                    this.libreriasCargadas = true;
                    resolve();
                };
                script2.onerror = reject;
                document.head.appendChild(script2);
            };
            script1.onerror = reject;
            document.head.appendChild(script1);
        });
    }

    async capturarGrafico(canvasId) {
        const canvas = document.getElementById(canvasId);
        if (!canvas || canvas.width === 0 || canvas.height === 0) {
            return null;
        }
        try {
            await new Promise(r => setTimeout(r, 200));
            return canvas.toDataURL('image/png');
        } catch (e) {
            return null;
        }
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

    async agregarEncabezadoConLogos(doc) {
        const pageWidth = doc.internal.pageSize.getWidth();
        const logoWidth = 22;
        const logoHeight = 22;
        const x = this.margen.izquierdo;
        
        // Logo izquierdo (Instituto)
        let logoInstitutoData = null;
        try {
            if (this.logosCache.instituto) {
                logoInstitutoData = this.logosCache.instituto;
            } else {
                logoInstitutoData = await this.cargarImagenDesdeURL(this.urlsLogos.instituto);
            }
        } catch(e) {
            console.log('Logo instituto no disponible');
        }
        
        if (logoInstitutoData) {
            try {
                doc.addImage(logoInstitutoData, 'PNG', x, 10, logoWidth, logoHeight);
            } catch(e) {
                this.dibujarTextoInstituto(doc, x, 20);
            }
        } else {
            this.dibujarTextoInstituto(doc, x, 20);
        }
        
        // Título central
        doc.setFontSize(18);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(0, 51, 102);
        doc.text('SMARTGATE MONITOR', pageWidth / 2, 18, { align: 'center' });
        
        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(80, 80, 80);
        doc.text('Sistema Predictivo de Mantenimiento', pageWidth / 2, 26, { align: 'center' });
        doc.text('Porton Automatico', pageWidth / 2, 32, { align: 'center' });
        
        // Logo derecho (Carrera)
        let logoCarreraData = null;
        try {
            if (this.logosCache.carrera) {
                logoCarreraData = this.logosCache.carrera;
            } else {
                logoCarreraData = await this.cargarImagenDesdeURL(this.urlsLogos.carrera);
            }
        } catch(e) {
            console.log('Logo carrera no disponible');
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
        doc.line(x, 42, pageWidth - this.margen.derecho, 42);
        
        // Fecha
        doc.setFontSize(9);
        doc.setTextColor(120, 120, 120);
        const fechaActual = new Date().toLocaleDateString('es-ES', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
        doc.text(fechaActual, pageWidth - this.margen.derecho - 5, 52, { align: 'right' });
        
        return 58;
    }

    dibujarTextoInstituto(doc, x, y) {
        doc.setFontSize(7);
        doc.setTextColor(100);
        doc.text('Instituto Tecnologico', x, y);
        doc.text('Industrial Brasil Bolivia', x, y + 4);
    }

    dibujarTextoUniversidad(doc, x, y) {
        doc.setFontSize(7);
        doc.setTextColor(100);
        doc.text('Ingenieria', x + 5, y);
        doc.text('Informatica', x + 5, y + 4);
    }

    async generarReportePDF(tipo = 'completo') {
        try {
            this.mostrarMensaje('Generando PDF...', '#3b82f6');
            
            if (!this.libreriasCargadas) {
                await this.cargarLibrerias();
                await new Promise(r => setTimeout(r, 500));
            }
            
            const { jsPDF } = window.jspdf;
            const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'letter' });
            
            // Capturar gráficos
            const graficoDiario = await this.capturarGrafico('dailyChart');
            const graficoHorario = await this.capturarGrafico('hourlyChart');
            
            // Página 1
            let y = await this.agregarEncabezadoConLogos(doc);
            y = await this.agregarResumen(doc, y);
            y = await this.agregarGrafico(doc, y, graficoDiario, 'Ciclos por dia (Ultimos 7 dias)');
            
            // Página 2
            doc.addPage();
            y = await this.agregarEncabezadoConLogos(doc);
            y = await this.agregarGrafico(doc, y, graficoHorario, 'Horario de actividad');
            y = await this.agregarTablaMantenimiento(doc, y);
            y = await this.agregarPrediccion(doc, y);
            
            this.agregarPiePagina(doc);
            
            const fecha = new Date().toISOString().split('T')[0];
            doc.save(`smartgate_reporte_${fecha}.pdf`);
            this.mostrarMensaje('PDF generado correctamente', '#10b981');
            
        } catch (error) {
            console.error('Error:', error);
            this.mostrarMensaje('Error: ' + error.message, '#ef4444');
        }
    }

    async agregarResumen(doc, y) {
        const x = this.margen.izquierdo;
        
        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(0, 51, 102);
        doc.text('RESUMEN GENERAL', x, y);
        y += 10;
        
        const total = typeof globalTotalAcumulado !== 'undefined' ? globalTotalAcumulado : 
                     (typeof mantenimiento !== 'undefined' ? mantenimiento.ciclos.total : 0);
        const hoy = typeof globalCiclosHoy !== 'undefined' ? globalCiclosHoy : 
                    (typeof mantenimiento !== 'undefined' ? mantenimiento.obtenerCiclosHoy() : 0);
        const estado = document.getElementById('currentState')?.textContent || '---';
        const salud = document.getElementById('healthPercent')?.textContent || '100';
        
        doc.setFontSize(11);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(0, 0, 0);
        
        doc.text(`Ciclos Totales: ${total}`, x + 5, y);
        doc.text(`Ciclos Hoy: ${hoy}`, x + 5, y + 10);
        doc.text(`Estado Actual: ${estado}`, x + 5, y + 20);
        doc.text(`Salud del Sistema: ${salud}%`, x + 5, y + 30);
        
        return y + 50;
    }

    async agregarGrafico(doc, y, grafico, titulo) {
        const x = this.margen.izquierdo;
        
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(0, 51, 102);
        doc.text(titulo, x, y);
        y += 8;
        
        if (grafico) {
            try {
                doc.addImage(grafico, 'PNG', x, y, 160, 70);
                y += 80;
            } catch(e) {
                doc.text('Grafico no disponible', x + 5, y);
                y += 15;
            }
        } else {
            doc.text('No hay datos suficientes', x + 5, y);
            y += 15;
        }
        
        return y;
    }

    async agregarTablaMantenimiento(doc, y) {
        const x = this.margen.izquierdo;
        
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(0, 51, 102);
        doc.text('MANTENIMIENTO PREVENTIVO', x, y);
        y += 10;
        
        const total = typeof globalTotalAcumulado !== 'undefined' ? globalTotalAcumulado : 
                     (typeof mantenimiento !== 'undefined' ? mantenimiento.ciclos.total : 0);
        
        const filas = [
            ['Revision Preventiva', '500', this.getEstado(total, 500), this.getRestantes(total, 500) + ' ciclos'],
            ['Lubricacion', '1000', this.getEstado(total, 1000), this.getRestantes(total, 1000) + ' ciclos'],
            ['Revision General', '2000', this.getEstado(total, 2000), this.getRestantes(total, 2000) + ' ciclos']
        ];
        
        // Cabecera
        doc.setFillColor(0, 51, 102);
        doc.setTextColor(255, 255, 255);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(9);
        
        const colWidth = [45, 25, 35, 40];
        let xPos = x;
        
        doc.rect(xPos, y, colWidth[0], 8, 'F');
        doc.text('Tipo', xPos + 2, y + 5.5);
        xPos += colWidth[0];
        
        doc.rect(xPos, y, colWidth[1], 8, 'F');
        doc.text('Ciclos', xPos + 2, y + 5.5);
        xPos += colWidth[1];
        
        doc.rect(xPos, y, colWidth[2], 8, 'F');
        doc.text('Estado', xPos + 2, y + 5.5);
        xPos += colWidth[2];
        
        doc.rect(xPos, y, colWidth[3], 8, 'F');
        doc.text('Proximo', xPos + 2, y + 5.5);
        y += 8;
        
        // Filas
        doc.setTextColor(0, 0, 0);
        doc.setFont('helvetica', 'normal');
        
        for (let i = 0; i < filas.length; i++) {
            if (i % 2 === 0) {
                doc.setFillColor(245, 245, 245);
                doc.rect(x, y, colWidth[0] + colWidth[1] + colWidth[2] + colWidth[3], 7, 'F');
            }
            
            xPos = x;
            doc.text(filas[i][0], xPos + 2, y + 5);
            xPos += colWidth[0];
            doc.text(filas[i][1], xPos + 2, y + 5);
            xPos += colWidth[1];
            doc.text(filas[i][2], xPos + 2, y + 5);
            xPos += colWidth[2];
            doc.text(filas[i][3], xPos + 2, y + 5);
            
            y += 7;
        }
        
        return y + 15;
    }

    async agregarPrediccion(doc, y) {
        const x = this.margen.izquierdo;
        
        const total = typeof globalTotalAcumulado !== 'undefined' ? globalTotalAcumulado : 
                     (typeof mantenimiento !== 'undefined' ? mantenimiento.ciclos.total : 0);
        
        let mensaje = '';
        let color = [16, 185, 129];
        
        if (total > 4000) {
            mensaje = 'ALERTA: Se recomienda reemplazo preventivo del motor';
            color = [220, 38, 38];
        } else if (total > 3000) {
            mensaje = 'ATENCION: Desgaste significativo detectado';
            color = [245, 158, 11];
        } else if (total > 2000) {
            mensaje = 'Mantenimiento regular requerido';
            color = [59, 130, 246];
        } else if (total > 1000) {
            mensaje = 'Sistema funcionando dentro de parametros normales';
            color = [16, 185, 129];
        } else {
            mensaje = 'Sistema en excelente estado';
            color = [16, 185, 129];
        }
        
        doc.setFontSize(11);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(color[0], color[1], color[2]);
        doc.text(mensaje, x + 5, y);
        
        return y + 15;
    }

    getEstado(total, limite) {
        if (total >= limite) return 'Completado';
        return 'Pendiente';
    }

    getRestantes(total, limite) {
        if (total >= limite) return 0;
        return limite - total;
    }

    agregarPiePagina(doc) {
        const pageCount = doc.internal.getNumberOfPages();
        const pageWidth = doc.internal.pageSize.getWidth();
        
        for (let i = 1; i <= pageCount; i++) {
            doc.setPage(i);
            doc.setFontSize(8);
            doc.setTextColor(150, 150, 150);
            doc.text(
                'Instituto Tecnologico Industrial Brasil Bolivia - Ingenieria Informatica | Pagina ' + i + ' de ' + pageCount,
                pageWidth / 2,
                doc.internal.pageSize.getHeight() - 12,
                { align: 'center' }
            );
        }
    }

    mostrarMensaje(texto, color) {
        const existing = document.getElementById('pdfToast');
        if (existing) existing.remove();
        
        const toast = document.createElement('div');
        toast.id = 'pdfToast';
        toast.style.cssText = `
            position: fixed;
            bottom: 20px;
            right: 20px;
            background: ${color};
            color: white;
            padding: 12px 20px;
            border-radius: 10px;
            z-index: 10000;
            font-size: 14px;
        `;
        toast.innerHTML = texto === 'Generando PDF...' ? '⏳ ' + texto : '✅ ' + texto;
        document.body.appendChild(toast);
        
        if (texto !== 'Generando PDF...') {
            setTimeout(() => toast.remove(), 3000);
        }
    }

    async exportarExcelCompleto() {
        try {
            this.mostrarMensaje('Generando Excel...', '#3b82f6');
            
            if (typeof XLSX === 'undefined') {
                const script = document.createElement('script');
                script.src = 'https://cdn.sheetjs.com/xlsx-0.20.2/package/dist/xlsx.full.min.js';
                await new Promise((resolve, reject) => {
                    script.onload = resolve;
                    script.onerror = reject;
                    document.head.appendChild(script);
                });
                await new Promise(r => setTimeout(r, 500));
            }
            
            const wb = XLSX.utils.book_new();
            
            const total = typeof globalTotalAcumulado !== 'undefined' ? globalTotalAcumulado : 
                         (typeof mantenimiento !== 'undefined' ? mantenimiento.ciclos.total : 0);
            const hoy = typeof globalCiclosHoy !== 'undefined' ? globalCiclosHoy : 
                       (typeof mantenimiento !== 'undefined' ? mantenimiento.obtenerCiclosHoy() : 0);
            
            const data = [
                ['SMARTGATE MONITOR - REPORTE COMPLETO'],
                ['Instituto Tecnologico Industrial Brasil Bolivia - Ingenieria Informatica'],
                ['Fecha:', new Date().toLocaleString()],
                [''],
                ['RESUMEN GENERAL'],
                ['Ciclos Totales', total],
                ['Ciclos Hoy', hoy],
                [''],
                ['MANTENIMIENTO'],
                ['Tipo', 'Ciclos', 'Estado', 'Proximo'],
                ['Revision Preventiva', 500, this.getEstado(total, 500), this.getRestantes(total, 500)],
                ['Lubricacion', 1000, this.getEstado(total, 1000), this.getRestantes(total, 1000)],
                ['Revision General', 2000, this.getEstado(total, 2000), this.getRestantes(total, 2000)]
            ];
            
            const ws = XLSX.utils.aoa_to_sheet(data);
            ws['!cols'] = [{wch:28}, {wch:12}, {wch:12}, {wch:15}];
            XLSX.utils.book_append_sheet(wb, ws, 'SmartGate');
            
            const fecha = new Date().toISOString().split('T')[0];
            XLSX.writeFile(wb, `smartgate_reporte_${fecha}.xlsx`);
            
            this.mostrarMensaje('Excel generado correctamente', '#10b981');
        } catch (error) {
            console.error('Error:', error);
            this.mostrarMensaje('Error: ' + error.message, '#ef4444');
        }
    }
}

const generadorPDF = new GeneradorPDF();

function generarPDFCompleto() {
    generadorPDF.generarReportePDF('completo');
}

function generarPDFMantenimiento() {
    generadorPDF.generarReportePDF('completo');
}

function generarPDFEstadisticas() {
    generadorPDF.generarReportePDF('completo');
}

function exportarExcelCompleto() {
    generadorPDF.exportarExcelCompleto();
}
