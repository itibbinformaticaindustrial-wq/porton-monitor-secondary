// ============================================================
// SMARTGATE - GENERADOR DE PDF (VERSIÓN FINAL)
// Con: marca de agua con logo + texto "Informatica Industrial"
// Espacios optimizados y texto completo
// ============================================================

class GeneradorPDF {
    constructor() {
        console.log('📄 Inicializando GeneradorPDF Final...');
        this.libreriasCargadas = false;
        
        // Márgenes más pequeños para aprovechar mejor la página
        this.margen = {
            superior: 20,
            inferior: 20,
            izquierdo: 15,
            derecho: 15
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

    async capturarGrafico(canvasId, escala = 2) {
        const canvas = document.getElementById(canvasId);
        if (!canvas || canvas.width === 0 || canvas.height === 0) {
            return null;
        }
        try {
            await new Promise(r => setTimeout(r, 200));
            const tempCanvas = document.createElement('canvas');
            const ctx = tempCanvas.getContext('2d');
            tempCanvas.width = canvas.width * escala;
            tempCanvas.height = canvas.height * escala;
            ctx.scale(escala, escala);
            ctx.drawImage(canvas, 0, 0);
            return tempCanvas.toDataURL('image/png', 1.0);
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

    // ============================================================
    // MARCA DE AGUA CON LOGO DE CARRERA Y TEXTO
    // ============================================================
    async agregarMarcaDeAgua(doc) {
        const pageWidth = doc.internal.pageSize.getWidth();
        const pageHeight = doc.internal.pageSize.getHeight();
        
        // Cargar logo de carrera para marca de agua
        let logoData = null;
        try {
            if (this.logosCache.carrera) {
                logoData = this.logosCache.carrera;
            } else {
                logoData = await this.cargarImagenDesdeURL(this.urlsLogos.carrera);
            }
        } catch(e) {
            console.log('Logo para marca de agua no disponible');
        }
        
        if (logoData) {
            try {
                // Logo grande en el centro (60mm x 60mm)
                const logoWidth = 55;
                const logoHeight = 55;
                const x = (pageWidth - logoWidth) / 2;
                const y = (pageHeight - logoHeight) / 2 - 20;
                
                doc.saveGraphicsState();
                doc.setGState(new doc.GState({ opacity: 0.12 }));
                doc.addImage(logoData, 'PNG', x, y, logoWidth, logoHeight);
                doc.restoreGraphicsState();
            } catch(e) {}
        }
        
        // Texto "Informatica Industrial" debajo del logo
        doc.saveGraphicsState();
        doc.setGState(new doc.GState({ opacity: 0.12 }));
        doc.setFontSize(20);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(100, 100, 100);
        doc.text('INFORMATICA INDUSTRIAL', pageWidth / 2, (pageHeight / 2) + 50, { align: 'center' });
        doc.restoreGraphicsState();
    }

    async agregarEncabezadoConLogos(doc) {
        const pageWidth = doc.internal.pageSize.getWidth();
        const logoWidth = 20;
        const logoHeight = 20;
        const x = this.margen.izquierdo;
        
        // Logo izquierdo
        let logoInstitutoData = null;
        try {
            if (this.logosCache.instituto) {
                logoInstitutoData = this.logosCache.instituto;
            } else {
                logoInstitutoData = await this.cargarImagenDesdeURL(this.urlsLogos.instituto);
            }
        } catch(e) {}
        
        if (logoInstitutoData) {
            try {
                doc.addImage(logoInstitutoData, 'PNG', x, 8, logoWidth, logoHeight);
            } catch(e) {
                this.dibujarTextoInstituto(doc, x, 15);
            }
        } else {
            this.dibujarTextoInstituto(doc, x, 15);
        }
        
        // Título
        doc.setFontSize(16);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(0, 51, 102);
        doc.text('SMARTGATE MONITOR', pageWidth / 2, 15, { align: 'center' });
        
        doc.setFontSize(9);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(80, 80, 80);
        doc.text('Sistema Predictivo de Mantenimiento | Porton Automatico', pageWidth / 2, 23, { align: 'center' });
        
        // Logo derecho
        let logoCarreraData = null;
        try {
            if (this.logosCache.carrera) {
                logoCarreraData = this.logosCache.carrera;
            } else {
                logoCarreraData = await this.cargarImagenDesdeURL(this.urlsLogos.carrera);
            }
        } catch(e) {}
        
        if (logoCarreraData) {
            try {
                doc.addImage(logoCarreraData, 'PNG', pageWidth - this.margen.derecho - logoWidth, 8, logoWidth, logoHeight);
            } catch(e) {
                this.dibujarTextoUniversidad(doc, pageWidth - this.margen.derecho - 35, 15);
            }
        } else {
            this.dibujarTextoUniversidad(doc, pageWidth - this.margen.derecho - 35, 15);
        }
        
        // Línea separadora
        doc.setDrawColor(200, 200, 200);
        doc.line(x, 35, pageWidth - this.margen.derecho, 35);
        
        // Fecha
        doc.setFontSize(8);
        doc.setTextColor(120, 120, 120);
        const fechaActual = new Date().toLocaleDateString('es-ES', {
            weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
        });
        doc.text(fechaActual, pageWidth - this.margen.derecho, 45, { align: 'right' });
        
        return 50;
    }

    dibujarTextoInstituto(doc, x, y) {
        doc.setFontSize(6);
        doc.setTextColor(100);
        doc.text('Instituto Tecnologico', x, y);
        doc.text('Industrial Brasil Bolivia', x, y + 3);
    }

    dibujarTextoUniversidad(doc, x, y) {
        doc.setFontSize(6);
        doc.setTextColor(100);
        doc.text('Ingenieria', x + 5, y);
        doc.text('Informatica', x + 5, y + 3);
    }

    async agregarResumenEjecutivo(doc, y) {
        const x = this.margen.izquierdo;
        const total = typeof globalTotalAcumulado !== 'undefined' ? globalTotalAcumulado : 0;
        const hoy = typeof globalCiclosHoy !== 'undefined' ? globalCiclosHoy : 0;
        
        let promedioSemanal = 0;
        if (typeof mantenimiento !== 'undefined') {
            const ciclosSemana = mantenimiento.obtenerCiclosPorDia(7);
            const totalSemana = ciclosSemana.reduce((sum, d) => sum + d[1], 0);
            promedioSemanal = Math.round(totalSemana / 7);
        }
        
        doc.setFontSize(11);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(0, 51, 102);
        doc.text('RESUMEN EJECUTIVO', x, y);
        y += 7;
        
        doc.setFontSize(9);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(60, 60, 60);
        
        const resumen = `Durante el dia de hoy, el porton ha registrado ${hoy} ciclos de apertura/cierre. Acumula un total de ${total} ciclos desde su puesta en marcha. El promedio diario de la ultima semana es de ${promedioSemanal} ciclos por dia.`;
        
        const lineas = doc.splitTextToSize(resumen, 170);
        doc.text(lineas, x + 5, y);
        y += (lineas.length * 5) + 8;
        
        return y;
    }

    async agregarComparativaSemanal(doc, y) {
        const x = this.margen.izquierdo;
        
        let semanaActual = 0;
        let semanaAnterior = 0;
        
        if (typeof mantenimiento !== 'undefined') {
            const ciclos = mantenimiento.obtenerCiclosPorDia(14);
            for (let i = 0; i < 7 && i < ciclos.length; i++) {
                semanaActual += ciclos[i][1];
            }
            for (let i = 7; i < 14 && i < ciclos.length; i++) {
                semanaAnterior += ciclos[i][1];
            }
        }
        
        const variacion = semanaAnterior > 0 ? ((semanaActual - semanaAnterior) / semanaAnterior * 100).toFixed(1) : 0;
        const tendencia = variacion >= 0 ? '+' : '';
        const color = variacion >= 0 ? [16, 185, 129] : [220, 38, 38];
        
        doc.setFontSize(10);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(0, 51, 102);
        doc.text('COMPARATIVA SEMANAL', x, y);
        y += 7;
        
        doc.setFontSize(9);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(60, 60, 60);
        doc.text(`Semana actual: ${semanaActual} ciclos`, x + 5, y);
        doc.text(`Semana anterior: ${semanaAnterior} ciclos`, x + 5, y + 6);
        
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(color[0], color[1], color[2]);
        doc.text(`Variacion: ${tendencia}${variacion}%`, x + 5, y + 12);
        
        return y + 24;
    }

    async agregarGraficoSalud(doc, y) {
        const x = this.margen.izquierdo;
        const salud = parseInt(document.getElementById('healthPercent')?.textContent || '100');
        
        const canvas = document.createElement('canvas');
        canvas.width = 150;
        canvas.height = 150;
        const ctx = canvas.getContext('2d');
        
        const angulo = (salud / 100) * 2 * Math.PI;
        const centroX = 75, centroY = 75, radio = 55;
        
        ctx.beginPath();
        ctx.arc(centroX, centroY, radio, 0, 2 * Math.PI);
        ctx.fillStyle = '#e2e8f0';
        ctx.fill();
        
        ctx.beginPath();
        ctx.arc(centroX, centroY, radio, -Math.PI / 2, -Math.PI / 2 + angulo);
        ctx.lineTo(centroX, centroY);
        ctx.fillStyle = salud > 70 ? '#10b981' : (salud > 40 ? '#f59e0b' : '#ef4444');
        ctx.fill();
        
        ctx.font = 'bold 20px Arial';
        ctx.fillStyle = '#1e293b';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(`${salud}%`, centroX, centroY);
        
        ctx.font = '10px Arial';
        ctx.fillStyle = '#64748b';
        ctx.fillText('Salud del Sistema', centroX, centroY + 28);
        
        const dataUrl = canvas.toDataURL('image/png');
        
        doc.setFontSize(10);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(0, 51, 102);
        doc.text('ESTADO DE SALUD', x, y);
        y += 5;
        
        doc.addImage(dataUrl, 'PNG', x + 30, y, 35, 35);
        
        return y + 42;
    }

    async agregarPrediccionConFecha(doc, y) {
        const x = this.margen.izquierdo;
        const total = typeof globalTotalAcumulado !== 'undefined' ? globalTotalAcumulado : 0;
        
        let ciclosPorDia = 10;
        if (typeof mantenimiento !== 'undefined') {
            const ciclosSemana = mantenimiento.obtenerCiclosPorDia(7);
            const totalSemana = ciclosSemana.reduce((sum, d) => sum + d[1], 0);
            ciclosPorDia = Math.max(1, Math.round(totalSemana / 7));
        }
        
        const proximoMantenimiento = 500;
        const ciclosRestantes = proximoMantenimiento - (total % proximoMantenimiento);
        const diasEstimados = Math.ceil(ciclosRestantes / ciclosPorDia);
        
        const fechaEstimada = new Date();
        fechaEstimada.setDate(fechaEstimada.getDate() + diasEstimados);
        const fechaStr = fechaEstimada.toLocaleDateString('es-ES', {
            year: 'numeric', month: 'long', day: 'numeric'
        });
        
        doc.setFontSize(10);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(0, 51, 102);
        doc.text('PREDICCION DE MANTENIMIENTO', x, y);
        y += 7;
        
        doc.setFontSize(9);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(60, 60, 60);
        doc.text(`Proximo mantenimiento: ${ciclosRestantes} ciclos`, x + 5, y);
        doc.text(`Fecha estimada: ${fechaStr}`, x + 5, y + 6);
        doc.text(`(Promedio: ${ciclosPorDia} ciclos/dia)`, x + 5, y + 12);
        
        let mensaje = '';
        let color = [16, 185, 129];
        if (total > 4000) {
            mensaje = 'ALERTA: Reemplazo de motor requerido pronto';
            color = [220, 38, 38];
        } else if (total > 3000) {
            mensaje = 'ATENCION: Desgaste significativo';
            color = [245, 158, 11];
        } else if (total > 2000) {
            mensaje = 'Mantenimiento regular recomendado';
            color = [59, 130, 246];
        } else {
            mensaje = 'Sistema en excelente estado';
            color = [16, 185, 129];
        }
        
        y += 22;
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(color[0], color[1], color[2]);
        doc.text(mensaje, x + 5, y);
        
        return y + 15;
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
            
            const graficoDiario = await this.capturarGrafico('dailyChart', 2);
            const graficoHorario = await this.capturarGrafico('hourlyChart', 2);
            const graficoTendencia = await this.capturarGrafico('trendChart', 2);
            
            // ========== PÁGINA 1 ==========
            let y = await this.agregarEncabezadoConLogos(doc);
            await this.agregarMarcaDeAgua(doc);
            y = await this.agregarResumenEjecutivo(doc, y);
            y = await this.agregarComparativaSemanal(doc, y);
            y = await this.agregarGraficoSalud(doc, y);
            y = await this.agregarPrediccionConFecha(doc, y);
            
            // ========== PÁGINA 2 ==========
            doc.addPage();
            y = await this.agregarEncabezadoConLogos(doc);
            await this.agregarMarcaDeAgua(doc);
            y = await this.agregarGrafico(doc, y, graficoDiario, 'Ciclos por dia (Ultimos 7 dias)');
            y = await this.agregarGrafico(doc, y, graficoHorario, 'Horario de actividad');
            
            // ========== PÁGINA 3 ==========
            doc.addPage();
            y = await this.agregarEncabezadoConLogos(doc);
            await this.agregarMarcaDeAgua(doc);
            if (graficoTendencia) {
                y = await this.agregarGrafico(doc, y, graficoTendencia, 'Tendencia de uso (Ultimos 30 dias)');
            }
            y = await this.agregarTablaMantenimiento(doc, y);
            
            this.agregarPiePagina(doc);
            
            const fecha = new Date().toISOString().split('T')[0];
            doc.save(`smartgate_reporte_${fecha}.pdf`);
            this.mostrarMensaje('PDF generado correctamente', '#10b981');
            
        } catch (error) {
            console.error('Error:', error);
            this.mostrarMensaje('Error: ' + error.message, '#ef4444');
        }
    }

    async agregarGrafico(doc, y, grafico, titulo) {
        const x = this.margen.izquierdo;
        
        doc.setFontSize(11);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(0, 51, 102);
        doc.text(titulo, x, y);
        y += 7;
        
        if (grafico) {
            try {
                doc.addImage(grafico, 'PNG', x, y, 170, 65);
                y += 75;
            } catch(e) {
                doc.text('Grafico no disponible', x + 5, y);
                y += 10;
            }
        } else {
            doc.text('No hay datos suficientes', x + 5, y);
            y += 10;
        }
        
        return y;
    }

    async agregarTablaMantenimiento(doc, y) {
        const x = this.margen.izquierdo;
        
        doc.setFontSize(11);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(0, 51, 102);
        doc.text('MANTENIMIENTO PREVENTIVO', x, y);
        y += 8;
        
        const total = typeof globalTotalAcumulado !== 'undefined' ? globalTotalAcumulado : 
                     (typeof mantenimiento !== 'undefined' ? mantenimiento.ciclos.total : 0);
        
        const filas = [
            ['Revision Preventiva', '500', this.getEstado(total, 500), this.getRestantes(total, 500)],
            ['Lubricacion', '1000', this.getEstado(total, 1000), this.getRestantes(total, 1000)],
            ['Revision General', '2000', this.getEstado(total, 2000), this.getRestantes(total, 2000)]
        ];
        
        const colWidth = [40, 22, 30, 35];
        let xPos = x;
        
        doc.setFillColor(0, 51, 102);
        doc.setTextColor(255, 255, 255);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8);
        
        doc.rect(xPos, y, colWidth[0], 7, 'F');
        doc.text('Tipo', xPos + 2, y + 5);
        xPos += colWidth[0];
        
        doc.rect(xPos, y, colWidth[1], 7, 'F');
        doc.text('Ciclos', xPos + 2, y + 5);
        xPos += colWidth[1];
        
        doc.rect(xPos, y, colWidth[2], 7, 'F');
        doc.text('Estado', xPos + 2, y + 5);
        xPos += colWidth[2];
        
        doc.rect(xPos, y, colWidth[3], 7, 'F');
        doc.text('Proximo', xPos + 2, y + 5);
        y += 7;
        
        doc.setTextColor(0, 0, 0);
        doc.setFont('helvetica', 'normal');
        
        for (let i = 0; i < filas.length; i++) {
            if (i % 2 === 0) {
                doc.setFillColor(245, 245, 245);
                doc.rect(x, y, colWidth[0] + colWidth[1] + colWidth[2] + colWidth[3], 6, 'F');
            }
            
            xPos = x;
            doc.text(filas[i][0], xPos + 2, y + 4.5);
            xPos += colWidth[0];
            doc.text(filas[i][1], xPos + 2, y + 4.5);
            xPos += colWidth[1];
            doc.text(filas[i][2], xPos + 2, y + 4.5);
            xPos += colWidth[2];
            doc.text(filas[i][3], xPos + 2, y + 4.5);
            
            y += 6;
        }
        
        return y + 10;
    }

    getEstado(total, limite) {
        if (total >= limite) return 'Completado';
        const restantes = limite - total;
        if (restantes <= 100) return 'Proximo';
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
            doc.setFontSize(7);
            doc.setTextColor(150, 150, 150);
            doc.text(
                'Instituto Tecnologico Industrial Brasil Bolivia - Ingenieria Informatica | Pagina ' + i + ' de ' + pageCount,
                pageWidth / 2,
                doc.internal.pageSize.getHeight() - 10,
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
