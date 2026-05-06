// ============================================================
// SMARTGATE - GENERADOR DE PDF CORREGIDO
// Sin emojis, sin caracteres rotos, sin bucles infinitos
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
        
        this.verificarLibrerias();
    }

    verificarLibrerias() {
        if (typeof jspdf !== 'undefined' && typeof html2canvas !== 'undefined') {
            this.libreriasCargadas = true;
        } else {
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

    // Capturar gráfico como imagen
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

    // Generar PDF principal
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
            const graficos = {
                diario: await this.capturarGrafico('dailyChart'),
                horario: await this.capturarGrafico('hourlyChart'),
                tendencia: await this.capturarGrafico('trendChart')
            };
            
            // Página 1
            let y = await this.agregarEncabezado(doc);
            y = await this.agregarResumen(doc, y);
            y = await this.agregarGraficoDiario(doc, y, graficos.diario);
            
            // Página 2
            doc.addPage();
            y = await this.agregarEncabezado(doc);
            y = await this.agregarGraficoHorario(doc, y, graficos.horario);
            y = await this.agregarTablaMantenimiento(doc, y);
            
            // Página 3
            doc.addPage();
            y = await this.agregarEncabezado(doc);
            y = await this.agregarPrediccion(doc, y);
            
            this.agregarPiePagina(doc);
            
            const fecha = new Date().toISOString().split('T')[0];
            doc.save(`smartgate_reporte_${fecha}.pdf`);
            this.mostrarMensaje('PDF generado correctamente', '#10b981');
            
        } catch (error) {
            console.error(error);
            this.mostrarMensaje('Error: ' + error.message, '#ef4444');
        }
    }

    // Encabezado (sin emojis)
    async agregarEncabezado(doc) {
        const pageWidth = doc.internal.pageSize.getWidth();
        const x = this.margen.izquierdo;
        
        doc.setFontSize(18);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(0, 51, 102);
        doc.text('SMARTGATE MONITOR', pageWidth / 2, 20, { align: 'center' });
        
        doc.setFontSize(11);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(80, 80, 80);
        doc.text('Sistema Predictivo de Mantenimiento', pageWidth / 2, 28, { align: 'center' });
        doc.text('Porton Automatico', pageWidth / 2, 34, { align: 'center' });
        
        doc.setDrawColor(200, 200, 200);
        doc.line(x, 42, pageWidth - this.margen.derecho, 42);
        
        doc.setFontSize(9);
        doc.setTextColor(120, 120, 120);
        const fecha = new Date().toLocaleDateString('es-ES', {
            weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
        });
        doc.text(fecha, pageWidth - this.margen.derecho - 5, 52, { align: 'right' });
        
        return 60;
    }

    // Resumen de indicadores
    async agregarResumen(doc, y) {
        const x = this.margen.izquierdo;
        
        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(0, 51, 102);
        doc.text('RESUMEN GENERAL', x, y);
        y += 10;
        
        const total = typeof globalTotalAcumulado !== 'undefined' ? globalTotalAcumulado : 0;
        const hoy = typeof globalCiclosHoy !== 'undefined' ? globalCiclosHoy : 0;
        const estado = document.getElementById('currentState')?.textContent || '---';
        const salud = document.getElementById('healthPercent')?.textContent || '100';
        
        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(0, 0, 0);
        
        doc.text(`Ciclos Totales: ${total}`, x + 5, y);
        doc.text(`Ciclos Hoy: ${hoy}`, x + 5, y + 8);
        doc.text(`Estado Actual: ${estado}`, x + 5, y + 16);
        doc.text(`Salud del Sistema: ${salud}%`, x + 5, y + 24);
        
        return y + 40;
    }

    // Gráfico diario
    async agregarGraficoDiario(doc, y, grafico) {
        const x = this.margen.izquierdo;
        
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(0, 51, 102);
        doc.text('Ciclos por Dia (Ultimos 7 dias)', x, y);
        y += 8;
        
        if (grafico) {
            try {
                doc.addImage(grafico, 'PNG', x, y, 160, 70);
                y += 75;
            } catch(e) {
                doc.text('No se pudo cargar el grafico', x + 5, y);
                y += 10;
            }
        } else {
            doc.text('No hay datos suficientes para mostrar el grafico', x + 5, y);
            y += 10;
        }
        
        return y;
    }

    // Gráfico horario
    async agregarGraficoHorario(doc, y, grafico) {
        const x = this.margen.izquierdo;
        
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(0, 51, 102);
        doc.text('Horario de Actividad', x, y);
        y += 8;
        
        if (grafico) {
            try {
                doc.addImage(grafico, 'PNG', x, y, 160, 60);
                y += 65;
            } catch(e) {
                doc.text('No se pudo cargar el grafico', x + 5, y);
                y += 10;
            }
        } else {
            doc.text('No hay datos suficientes para mostrar el grafico', x + 5, y);
            y += 10;
        }
        
        return y;
    }

    // Tabla de mantenimiento
    async agregarTablaMantenimiento(doc, y) {
        const x = this.margen.izquierdo;
        
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(0, 51, 102);
        doc.text('Mantenimiento Preventivo', x, y);
        y += 10;
        
        const total = typeof globalTotalAcumulado !== 'undefined' ? globalTotalAcumulado : 
                     (typeof mantenimiento !== 'undefined' ? mantenimiento.ciclos.total : 0);
        
        const filas = [
            ['Revision Preventiva', '500', this.getEstado(total, 500), this.getRestantes(total, 500)],
            ['Lubricacion', '1000', this.getEstado(total, 1000), this.getRestantes(total, 1000)],
            ['Revision General', '2000', this.getEstado(total, 2000), this.getRestantes(total, 2000)]
        ];
        
        // Cabecera
        doc.setFillColor(0, 51, 102);
        doc.setTextColor(255, 255, 255);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(9);
        
        const colWidth = [45, 25, 35, 35];
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

    // Predicción
    async agregarPrediccion(doc, y) {
        const x = this.margen.izquierdo;
        
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(0, 51, 102);
        doc.text('Prediccion y Recomendaciones', x, y);
        y += 10;
        
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
            mensaje = 'Mantenimiento regular requerido proximamente';
            color = [59, 130, 246];
        } else if (total > 1000) {
            mensaje = 'Sistema funcionando dentro de parametros normales';
            color = [16, 185, 129];
        } else {
            mensaje = 'Sistema en excelente estado, todo correcto';
            color = [16, 185, 129];
        }
        
        doc.setFontSize(11);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(color[0], color[1], color[2]);
        doc.text(mensaje, x + 5, y);
        y += 15;
        
        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(80, 80, 80);
        
        const recomendaciones = [
            '- Realizar inspeccion visual mensual',
            '- Verificar fotocelulas y sensores periodicamente',
            '- Mantener limpias las guias del porton'
        ];
        
        for (const rec of recomendaciones) {
            doc.text(rec, x + 5, y);
            y += 7;
        }
        
        return y;
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
            const total = typeof globalTotalAcumulado !== 'undefined' ? globalTotalAcumulado : 0;
            const hoy = typeof globalCiclosHoy !== 'undefined' ? globalCiclosHoy : 0;
            
            const data = [
                ['SMARTGATE MONITOR - REPORTE COMPLETO'],
                ['Instituto Tecnologico Industrial Brasil Bolivia'],
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
            ws['!cols'] = [{wch:25}, {wch:12}, {wch:12}, {wch:12}];
            XLSX.utils.book_append_sheet(wb, ws, 'SmartGate');
            
            const fecha = new Date().toISOString().split('T')[0];
            XLSX.writeFile(wb, `smartgate_reporte_${fecha}.xlsx`);
            
            this.mostrarMensaje('Excel generado', '#10b981');
        } catch (error) {
            console.error(error);
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
