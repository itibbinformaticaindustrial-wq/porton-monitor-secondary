class GeneradorPDF {
    constructor() {
        this.logos = {
            instituto: null,
            carrera: null
        };
        this.cargarLogos();
    }

    async cargarLogos() {
        const logoInstituto = localStorage.getItem('logo_instituto');
        const logoCarrera = localStorage.getItem('logo_carrera');
        
        if (logoInstituto) this.logos.instituto = logoInstituto;
        if (logoCarrera) this.logos.carrera = logoCarrera;
    }

    async generarReportePDF(tipo = 'completo') {
        try {
            if (typeof jspdf === 'undefined') {
                await this.cargarJsPDF();
            }
            
            const { jsPDF } = window.jspdf;
            const doc = new jsPDF({
                orientation: 'portrait',
                unit: 'mm',
                format: 'a4'
            });
            
            doc.setFont('helvetica');
            await this.agregarEncabezadoConLogos(doc);
            
            switch(tipo) {
                case 'completo':
                    await this.agregarReporteCompleto(doc);
                    break;
                case 'mantenimiento':
                    await this.agregarReporteMantenimiento(doc);
                    break;
                case 'estadisticas':
                    await this.agregarReporteEstadisticas(doc);
                    break;
                default:
                    await this.agregarReporteCompleto(doc);
            }
            
            this.agregarPiePagina(doc);
            
            const fecha = new Date().toISOString().split('T')[0];
            doc.save(`reporte_porton_${fecha}.pdf`);
            
        } catch (error) {
            console.error('Error generando PDF:', error);
            alert('Error al generar PDF. Asegúrate de tener conexión a internet.');
        }
    }

    async agregarEncabezadoConLogos(doc) {
        const pageWidth = doc.internal.pageSize.getWidth();
        const logoWidth = 25;
        const logoHeight = 25;
        
        // Logo izquierdo (Instituto)
        if (this.logos.instituto) {
            try {
                doc.addImage(this.logos.instituto, 'PNG', 15, 10, logoWidth, logoHeight);
            } catch(e) {
                doc.setFontSize(9);
                doc.setTextColor(100);
                doc.text('Instituto Tecnológico', 15, 20);
                doc.text('Industrial', 15, 27);
            }
        } else {
            doc.setFontSize(9);
            doc.setTextColor(100);
            doc.text('Instituto Tecnológico', 15, 20);
            doc.text('Industrial Brasil Bolivia', 15, 27);
        }
        
        // Título central
        doc.setFontSize(16);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(0, 51, 102);
        doc.text('SMARTGATE MONITOR', pageWidth / 2, 20, { align: 'center' });
        
        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(80, 80, 80);
        doc.text('Sistema Predictivo de Mantenimiento', pageWidth / 2, 28, { align: 'center' });
        doc.text('Portón Automático', pageWidth / 2, 34, { align: 'center' });
        
        // Logo derecho (Carrera)
        if (this.logos.carrera) {
            try {
                doc.addImage(this.logos.carrera, 'PNG', pageWidth - 40, 10, logoWidth, logoHeight);
            } catch(e) {
                doc.setFontSize(8);
                doc.setTextColor(100);
                doc.text('Ingeniería', pageWidth - 35, 20);
                doc.text('Informática', pageWidth - 35, 27);
            }
        } else {
            doc.setFontSize(8);
            doc.setTextColor(100);
            doc.text('Ingeniería', pageWidth - 35, 20);
            doc.text('Informática', pageWidth - 35, 27);
        }
        
        doc.setDrawColor(200, 200, 200);
        doc.line(15, 42, pageWidth - 15, 42);
        
        doc.setFontSize(9);
        doc.setTextColor(120, 120, 120);
        const fechaActual = new Date().toLocaleDateString('es-ES', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
        doc.text(`Fecha: ${fechaActual}`, pageWidth - 45, 50);
        
        return 55;
    }

    async agregarReporteCompleto(doc) {
        let yPos = 65;
        const pageWidth = doc.internal.pageSize.getWidth();
        
        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(0, 51, 102);
        doc.text('RESUMEN GENERAL', 15, yPos);
        yPos += 8;
        
        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(0, 0, 0);
        
        const datos = [
            ['Ciclos totales:', mantenimiento.ciclos.total.toString()],
            ['Ciclos hoy:', mantenimiento.obtenerCiclosHoy().toString()],
            ['Estado actual:', document.getElementById('currentState')?.textContent || '---'],
            ['Salud del sistema:', document.getElementById('healthPercent')?.textContent + '%' || '100%'],
            ['Próximo mantenimiento:', document.getElementById('nextMaintenance')?.textContent || '---']
        ];
        
        datos.forEach(([label, value]) => {
            doc.setFont('helvetica', 'bold');
            doc.text(label, 20, yPos);
            doc.setFont('helvetica', 'normal');
            doc.text(value, 80, yPos);
            yPos += 7;
        });
        
        yPos += 10;
        
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(0, 51, 102);
        doc.text('MANTENIMIENTO PREVENTIVO', 15, yPos);
        yPos += 8;
        
        const tablaMantenimiento = [
            ['Tipo', 'Ciclos', 'Estado', 'Próximo'],
            ['Revisión Preventiva', '500', this.obtenerEstadoMantenimiento(500), `${this.obtenerCiclosRestantes(500)} ciclos`],
            ['Lubricación', '1000', this.obtenerEstadoMantenimiento(1000), `${this.obtenerCiclosRestantes(1000)} ciclos`],
            ['Revisión General', '2000', this.obtenerEstadoMantenimiento(2000), `${this.obtenerCiclosRestantes(2000)} ciclos`]
        ];
        
        this.dibujarTabla(doc, tablaMantenimiento, 15, yPos, pageWidth - 30);
        yPos += 45;
        
        if (yPos > 250) {
            doc.addPage();
            yPos = 20;
            await this.agregarEncabezadoConLogos(doc);
            yPos = 55;
        }
        
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(0, 51, 102);
        doc.text('ESTADÍSTICAS DE USO', 15, yPos);
        yPos += 8;
        
        const ciclosPorDia = mantenimiento.obtenerCiclosPorDia(7);
        doc.setFontSize(9);
        doc.text('Ciclos por día (últimos 7 días):', 15, yPos);
        yPos += 5;
        
        ciclosPorDia.forEach(([fecha, cantidad]) => {
            if (yPos > 270) {
                doc.addPage();
                yPos = 20;
                this.agregarEncabezadoConLogos(doc);
                yPos = 50;
            }
            doc.text(`${fecha.substring(5)}: ${cantidad} ciclos`, 20, yPos);
            yPos += 5;
        });
        
        yPos += 5;
        
        const horasActivas = mantenimiento.obtenerCiclosPorHora();
        const horasTop = horasActivas
            .map((cantidad, hora) => ({ hora, cantidad }))
            .sort((a, b) => b.cantidad - a.cantidad)
            .slice(0, 5);
        
        doc.text('Horas de mayor actividad:', 15, yPos);
        yPos += 5;
        horasTop.forEach(({ hora, cantidad }) => {
            if (yPos > 270) {
                doc.addPage();
                yPos = 20;
                this.agregarEncabezadoConLogos(doc);
                yPos = 50;
            }
            doc.text(`${hora}:00 - ${hora + 1}:00: ${cantidad} ciclos`, 20, yPos);
            yPos += 5;
        });
    }

    async agregarReporteMantenimiento(doc) {
        let yPos = 65;
        
        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(0, 51, 102);
        doc.text('HISTORIAL DE MANTENIMIENTO', 15, yPos);
        yPos += 8;
        
        if (mantenimiento.historialMantenimiento.length === 0) {
            doc.text('No hay registros de mantenimiento previos', 20, yPos);
        } else {
            const tablaMantenimientos = [
                ['Fecha', 'Tipo', 'Ciclos al momento']
            ];
            
            mantenimiento.historialMantenimiento.slice(-10).forEach(m => {
                tablaMantenimientos.push([
                    new Date(m.fecha).toLocaleDateString(),
                    m.tipo,
                    m.totalCiclos.toString()
                ]);
            });
            
            this.dibujarTabla(doc, tablaMantenimientos, 15, yPos, 180);
            yPos += 10 + (tablaMantenimientos.length * 7);
        }
        
        if (yPos > 250) {
            doc.addPage();
            yPos = 20;
            await this.agregarEncabezadoConLogos(doc);
            yPos = 55;
        }
        
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.text('RECOMENDACIONES', 15, yPos);
        yPos += 8;
        
        const recomendaciones = [
            '• Realizar inspección visual mensual del mecanismo',
            '• Verificar el correcto funcionamiento de las fotocélulas',
            '• Mantener limpias las guías del portón',
            '• Revisar conexiones eléctricas cada 3 meses',
            '• Programar mantenimiento profesional anual'
        ];
        
        recomendaciones.forEach(rec => {
            if (yPos > 270) {
                doc.addPage();
                yPos = 20;
                this.agregarEncabezadoConLogos(doc);
                yPos = 50;
            }
            doc.setFontSize(9);
            doc.text(rec, 20, yPos);
            yPos += 6;
        });
    }

    async agregarReporteEstadisticas(doc) {
        let yPos = 65;
        
        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(0, 51, 102);
        doc.text('ANÁLISIS DE TENDENCIAS', 15, yPos);
        yPos += 8;
        
        const totalCiclos = mantenimiento.ciclos.total;
        const proyeccion = Math.round(totalCiclos * 1.1);
        
        doc.setFontSize(10);
        doc.text(`Ciclos actuales: ${totalCiclos}`, 20, yPos);
        yPos += 6;
        doc.text(`Proyección próximo mes: ${proyeccion} ciclos`, 20, yPos);
        yPos += 6;
        
        const vidaUtil = 5000;
        const porcentajeVida = (totalCiclos / vidaUtil * 100).toFixed(1);
        doc.text(`Vida útil consumida: ${porcentajeVida}%`, 20, yPos);
        yPos += 6;
        
        const vidaRestante = vidaUtil - totalCiclos;
        doc.text(`Ciclos restantes estimados: ${vidaRestante}`, 20, yPos);
        yPos += 15;
        
        doc.setFontSize(11);
        doc.setFont('helvetica', 'bold');
        
        if (totalCiclos > 4000) {
            doc.setTextColor(220, 38, 38);
            doc.text('⚠️ ALERTA: Se recomienda reemplazo preventivo del motor', 20, yPos);
        } else if (totalCiclos > 3000) {
            doc.setTextColor(245, 158, 11);
            doc.text('⚠️ Atención: Desgaste significativo detectado', 20, yPos);
        } else if (totalCiclos > 2000) {
            doc.setTextColor(59, 130, 246);
            doc.text('ℹ️ Mantenimiento regular requerido', 20, yPos);
        } else {
            doc.setTextColor(16, 185, 129);
            doc.text('✅ Sistema en excelente estado', 20, yPos);
        }
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
                doc.internal.pageSize.getHeight() - 10,
                { align: 'center' }
            );
        }
    }

    dibujarTabla(doc, datos, x, y, width) {
        const colWidth = width / datos[0].length;
        let yPos = y;
        
        doc.setFillColor(0, 51, 102);
        doc.setTextColor(255, 255, 255);
        doc.setFont('helvetica', 'bold');
        
        datos[0].forEach((header, i) => {
            doc.rect(x + (i * colWidth), yPos, colWidth, 8, 'F');
            doc.text(header, x + (i * colWidth) + 2, yPos + 5);
        });
        
        yPos += 8;
        
        doc.setTextColor(0, 0, 0);
        doc.setFont('helvetica', 'normal');
        
        for (let i = 1; i < datos.length; i++) {
            if (i % 2 === 0) {
                doc.setFillColor(240, 240, 240);
                doc.rect(x, yPos, width, 7, 'F');
            }
            
            datos[i].forEach((cell, j) => {
                doc.text(cell.toString(), x + (j * colWidth) + 2, yPos + 5);
            });
            yPos += 7;
        }
    }

    obtenerEstadoMantenimiento(limite) {
        const total = mantenimiento.ciclos.total;
        const completados = Math.floor(total / limite);
        if (completados === 0) return 'Pendiente';
        if (total % limite === 0 && total > 0) return 'Completado';
        return 'En progreso';
    }

    obtenerCiclosRestantes(limite) {
        const total = mantenimiento.ciclos.total;
        const siguiente = Math.ceil(total / limite) * limite;
        return siguiente - total;
    }

    async cargarJsPDF() {
        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
            script.onload = () => {
                const canvasScript = document.createElement('script');
                canvasScript.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js';
                canvasScript.onload = resolve;
                canvasScript.onerror = reject;
                document.head.appendChild(canvasScript);
            };
            script.onerror = reject;
            document.head.appendChild(script);
        });
    }

    async exportarExcelCompleto() {
        try {
            if (typeof XLSX === 'undefined') {
                await this.cargarSheetJS();
            }
            
            const wb = XLSX.utils.book_new();
            
            const resumenData = [
                ['SMARTGATE MONITOR - REPORTE COMPLETO'],
                ['Instituto Tecnológico Industrial Brasil Bolivia - Ingeniería Informática'],
                ['Fecha:', new Date().toLocaleString()],
                [''],
                ['RESUMEN GENERAL'],
                ['Ciclos Totales', mantenimiento.ciclos.total],
                ['Ciclos Hoy', mantenimiento.obtenerCiclosHoy()],
                ['Estado Actual', document.getElementById('currentState')?.textContent || '---'],
                ['Salud del Sistema', document.getElementById('healthPercent')?.textContent + '%' || '100%'],
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
            const ciclosPorDia = mantenimiento.obtenerCiclosPorDia(30);
            ciclosPorDia.forEach(([fecha, cantidad]) => {
                ciclosData.push([fecha, cantidad]);
            });
            
            const wsCiclos = XLSX.utils.aoa_to_sheet(ciclosData);
            wsCiclos['!cols'] = [{wch:15}, {wch:10}];
            XLSX.utils.book_append_sheet(wb, wsCiclos, 'Ciclos por Día');
            
            const eventosData = [['Fecha', 'Tipo', 'Evento', 'Detalles']];
            registro.eventos.slice(0, 500).forEach(evento => {
                eventosData.push([
                    new Date(evento.timestamp).toLocaleString(),
                    evento.tipo,
                    evento.datos.estado || evento.datos.abierto || '-',
                    registro.formatearDetalles(evento.datos)
                ]);
            });
            
            const wsEventos = XLSX.utils.aoa_to_sheet(eventosData);
            wsEventos['!cols'] = [{wch:20}, {wch:12}, {wch:15}, {wch:30}];
            XLSX.utils.book_append_sheet(wb, wsEventos, 'Eventos');
            
            const fecha = new Date().toISOString().split('T')[0];
            XLSX.writeFile(wb, `reporte_porton_${fecha}.xlsx`);
            
        } catch (error) {
            console.error('Error exportando Excel:', error);
            alert('Error al exportar a Excel');
        }
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
