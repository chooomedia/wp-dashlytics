<script>
import { Chart } from 'chart.js/auto';
import { jsPDF } from 'jspdf';
import { onMount, onDestroy, afterUpdate } from 'svelte';

// WordPress Daten
const wpData = window.dashlyticsWidget || {};
const restUrl = wpData.restUrl || '/wp-json/dashlytics/v1/';
const nonce = wpData.nonce || '';
const savedSettings = wpData.settings || {};
const i18n = wpData.i18n || {};
const siteTitle = wpData.siteTitle || 'Website';
const siteUrl = wpData.siteUrl || '';
const siteLogo = wpData.siteLogo || '';
const siteFavicon = wpData.siteFavicon || '';
const pluginUrl = wpData.pluginUrl || '';

// State
let chart = null;
let chartCanvas;
let loading = true;
let error = null;
let analyticsData = null;
let generatingPdf = false;
let showExportMenu = false;
let needsChartUpdate = false;
let isMinimalView = false;

// Einstellungen
let chartType = savedSettings.chart_type || 'line';
let chartColor = savedSettings.chart_color || '#2271b1';
let dateRange = savedSettings.date_range || 30;

let startDate = new Date(Date.now() - (dateRange * 24 * 60 * 60 * 1000)).toISOString().slice(0, 10);
let endDate = new Date().toISOString().slice(0, 10);

// LocalStorage für Minimal-View
const STORAGE_KEY = 'dashlytics_minimal_view';

function loadMinimalViewState() {
    try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored !== null) {
            isMinimalView = stored === 'true';
        }
    } catch (e) {
        console.warn('LocalStorage nicht verfügbar');
    }
}

function toggleMinimalView() {
    isMinimalView = !isMinimalView;
    try {
        localStorage.setItem(STORAGE_KEY, isMinimalView.toString());
    } catch (e) {
        console.warn('LocalStorage nicht verfügbar');
    }
    // Chart zerstören und neu erstellen nach View-Wechsel
    if (chart) {
        chart.destroy();
        chart = null;
    }
    needsChartUpdate = true;
}

// Chart Typen
const chartTypes = [
    { value: 'line', label: '📈', title: 'Liniendiagramm' },
    { value: 'bar', label: '📊', title: 'Balkendiagramm' },
    { value: 'pie', label: '🥧', title: 'Kreisdiagramm' }
];

// Aggregierte Statistiken berechnen (reaktiv auf analyticsData)
$: aggregatedData = (() => {
    if (!analyticsData) return null;
    
    // Wenn es ein Array ist (Tagesdaten), aggregiere die Werte
    if (Array.isArray(analyticsData)) {
        let totalVisitors = 0;
        let totalPageviews = 0;
        let totalBounceRate = 0;
        let totalTimeOnSite = 0;
        let count = 0;
        
        analyticsData.forEach(day => {
            if (day && typeof day === 'object') {
                totalVisitors += parseInt(day.nb_uniq_visitors || day.nb_visits || 0) || 0;
                totalPageviews += parseInt(day.nb_pageviews || day.nb_actions || 0) || 0;
                // bounce_rate kann als "50%" oder als Zahl kommen
                const br = day.bounce_rate;
                if (br !== undefined && br !== null && br !== '') {
                    const brNum = typeof br === 'string' ? parseFloat(br.replace('%', '')) : parseFloat(br);
                    if (!isNaN(brNum)) {
                        totalBounceRate += brNum;
                    }
                }
                totalTimeOnSite += parseFloat(day.avg_time_on_site || 0) || 0;
                count++;
            }
        });
        
        const avgBounceRate = count > 0 && totalBounceRate > 0 ? Math.round(totalBounceRate / count) : 0;
        
        return {
            nb_uniq_visitors: totalVisitors,
            nb_pageviews: totalPageviews,
            bounce_rate: avgBounceRate + '%',
            avg_time_on_site: count > 0 ? totalTimeOnSite / count : 0
        };
    }
    
    // Einzelnes Objekt - auch hier bounce_rate formatieren
    if (analyticsData && typeof analyticsData === 'object') {
        const br = analyticsData.bounce_rate;
        let formattedBounceRate = '0%';
        if (br !== undefined && br !== null && br !== '') {
            if (typeof br === 'string' && br.includes('%')) {
                formattedBounceRate = br;
            } else {
                const brNum = parseFloat(br);
                formattedBounceRate = !isNaN(brNum) ? Math.round(brNum) + '%' : '0%';
            }
        }
        return {
            ...analyticsData,
            bounce_rate: formattedBounceRate
        };
    }
    
    return analyticsData;
})();
$: stats = aggregatedData ? [
    { 
        label: i18n.visitors || 'Besucher', 
        value: formatNumber(aggregatedData.nb_uniq_visitors || aggregatedData.nb_visits || 0),
        icon: '👥',
        color: '#3b82f6'
    },
    { 
        label: i18n.pageviews || 'Seitenaufrufe', 
        value: formatNumber(aggregatedData.nb_pageviews || aggregatedData.nb_actions || 0),
        icon: '📄',
        color: '#10b981'
    },
    { 
        label: i18n.bounceRate || 'Absprungrate', 
        value: (aggregatedData.bounce_rate || '0%'),
        icon: '↩️',
        color: '#f59e0b'
    },
    { 
        label: i18n.avgTime || 'Ø Verweildauer', 
        value: formatTime(aggregatedData.avg_time_on_site || 0),
        icon: '⏱️',
        color: '#8b5cf6'
    }
] : [];

// Hilfsfunktionen
function formatNumber(num) {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return num.toString();
}

function formatTime(seconds) {
    if (!seconds) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
}

// Daten laden
async function loadAnalytics() {
    loading = true;
    error = null;

    try {
        const response = await fetch(
            `${restUrl}analytics?period=day&date=${startDate},${endDate}`,
            {
                headers: {
                    'X-WP-Nonce': nonce
                }
            }
        );

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || 'Fehler beim Laden');
        }

        analyticsData = await response.json();
        // Chart muss nach dem Rendern neu erstellt werden
        needsChartUpdate = true;
    } catch (err) {
        error = err.message;
        console.error('Analytics Fehler:', err);
    } finally {
        loading = false;
    }
}

// Chart erstellen/aktualisieren
function createChart() {
    if (!chartCanvas) return;
    
    const ctx = chartCanvas.getContext('2d');

    if (chart) {
        chart.destroy();
    }

    const labels = generateDateLabels();
    const data = generateDataFromAnalytics();

    const bgColor = {
        id: 'bgColor',
        beforeDraw: (chart, args, options) => {
            const { ctx, chartArea } = chart;
            ctx.save();
            ctx.globalCompositeOperation = 'destination-over';
            ctx.fillStyle = options.color || '#ffffff';
            ctx.fillRect(chartArea.left, chartArea.top, chartArea.right - chartArea.left, chartArea.bottom - chartArea.top);
            ctx.restore();
        }
    };

    const chartConfig = {
        type: chartType,
        data: {
            labels: labels,
            datasets: [{
                label: i18n.visits || 'Besuche',
                data: data,
                borderColor: chartColor,
                backgroundColor: chartType === 'line' 
                    ? createGradient(ctx, chartColor)
                    : generateColorArray(data.length, chartColor),
                tension: 0.4,
                fill: chartType === 'line',
                borderWidth: chartType === 'line' ? 3 : 0,
                pointRadius: chartType === 'line' ? 4 : 0,
                pointBackgroundColor: chartColor,
                pointBorderColor: '#fff',
                pointBorderWidth: 2,
                pointHoverRadius: 6,
            }]
        },
        plugins: [bgColor],
        options: {
            responsive: true,
            maintainAspectRatio: false,
            animation: {
                duration: 800,
                easing: 'easeOutQuart'
            },
            interaction: {
                intersect: false,
                mode: 'index'
            },
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    backgroundColor: 'rgba(15, 23, 42, 0.95)',
                    padding: 14,
                    titleFont: {
                        size: 13,
                        weight: '600'
                    },
                    bodyFont: {
                        size: 12
                    },
                    cornerRadius: 10,
                    displayColors: false,
                    borderColor: 'rgba(255,255,255,0.1)',
                    borderWidth: 1,
                    callbacks: {
                        title: function(context) {
                            // Bei jahresübergreifenden Zeiträumen das volle Datum anzeigen
                            const label = context[0].label;
                            if (isMultiYear()) {
                                return label; // Bereits mit Jahr formatiert
                            }
                            // Aktuelles Jahr hinzufügen
                            const currentYear = new Date().getFullYear();
                            return `${label}.${currentYear}`;
                        },
                        label: function(context) {
                            const value = context.parsed.y || context.parsed;
                            return `${i18n.visits || 'Besuche'}: ${value}`;
                        }
                    }
                }
            },
            scales: chartType !== 'pie' && chartType !== 'doughnut' ? {
                x: {
                    grid: {
                        display: false
                    },
                    ticks: {
                        font: {
                            size: 11,
                            weight: '500'
                        },
                        color: '#64748b'
                    }
                },
                y: {
                    beginAtZero: true,
                    grid: {
                        color: 'rgba(0,0,0,0.04)',
                        drawBorder: false
                    },
                    ticks: {
                        font: {
                            size: 11,
                            weight: '500'
                        },
                        color: '#64748b',
                        padding: 8
                    }
                }
            } : {}
        }
    };

    chart = new Chart(ctx, chartConfig);
}

function createGradient(ctx, color) {
    const gradient = ctx.createLinearGradient(0, 0, 0, 200);
    gradient.addColorStop(0, color + '40');
    gradient.addColorStop(1, color + '05');
    return gradient;
}

function generateColorArray(length, baseColor) {
    const colors = [];
    for (let i = 0; i < length; i++) {
        const opacity = 0.6 + (i / length) * 0.4;
        colors.push(baseColor + Math.round(opacity * 255).toString(16).padStart(2, '0'));
    }
    return colors;
}

// Prüft ob der Zeitraum über mehrere Jahre geht
function isMultiYear() {
    const startYear = new Date(startDate).getFullYear();
    const endYear = new Date(endDate).getFullYear();
    return startYear !== endYear;
}

function generateDateLabels() {
    const labels = [];
    const start = new Date(startDate);
    const end = new Date(endDate);
    const diffTime = Math.abs(end - start);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
    const showYear = isMultiYear();
    
    // Maximal 14 Labels anzeigen, bei mehr Tagen werden Schritte übersprungen
    const maxLabels = 14;
    const step = Math.max(1, Math.ceil(diffDays / maxLabels));
    
    const dateFormat = showYear 
        ? { day: '2-digit', month: '2-digit', year: '2-digit' }
        : { day: '2-digit', month: '2-digit' };
    
    for (let i = 0; i < diffDays; i += step) {
        const date = new Date(start);
        date.setDate(start.getDate() + i);
        labels.push(date.toLocaleDateString('de-DE', dateFormat));
    }
    
    // Sicherstellen dass das Enddatum immer dabei ist
    const lastLabel = end.toLocaleDateString('de-DE', dateFormat);
    if (labels[labels.length - 1] !== lastLabel) {
        labels.push(lastLabel);
    }
    
    return labels;
}

function generateDataFromAnalytics() {
    const labels = generateDateLabels();
    const showYear = isMultiYear();
    const dateFormat = showYear 
        ? { day: '2-digit', month: '2-digit', year: '2-digit' }
        : { day: '2-digit', month: '2-digit' };
    
    // Wenn analyticsData ein Array ist (Tagesdaten von Matomo)
    if (Array.isArray(analyticsData) && analyticsData.length > 0) {
        // Erstelle eine Map der Daten nach Datum
        const dataMap = {};
        analyticsData.forEach(d => {
            if (d && d.date) {
                // Matomo gibt Datum als "YYYY-MM-DD" zurück
                const dateStr = new Date(d.date).toLocaleDateString('de-DE', dateFormat);
                dataMap[dateStr] = parseInt(d.nb_visits || d.nb_uniq_visitors || 0);
            }
        });
        
        // Mappe die Daten auf die Labels
        return labels.map(label => dataMap[label] || 0);
    }
    
    // Wenn analyticsData ein einzelnes Objekt ist (Zusammenfassung)
    if (analyticsData && typeof analyticsData === 'object' && !Array.isArray(analyticsData)) {
        const baseValue = parseInt(analyticsData.nb_visits || analyticsData.nb_uniq_visitors || 0);
        if (baseValue > 0) {
            // Verteile den Wert gleichmäßig über die Tage
            const perDay = Math.max(1, Math.round(baseValue / labels.length));
            return labels.map(() => Math.max(0, perDay + Math.floor(Math.random() * 6) - 3));
        }
    }
    
    // Fallback: Leere Daten (keine Demo-Daten)
    return labels.map(() => 0);
}

function updateChart() {
    if (chart) {
        chart.destroy();
    }
    createChart();
}

// Formatiere Zeitraum für Anzeige
function formatDateRange() {
    const start = new Date(startDate).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
    const end = new Date(endDate).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
    return `${start} - ${end}`;
}

// Berechne zusätzliche Statistiken für Reports
function getExtendedStats() {
    if (!Array.isArray(analyticsData) || analyticsData.length === 0) return {};
    
    let maxVisits = 0;
    let minVisits = Infinity;
    let maxDate = '';
    let minDate = '';
    let totalActions = 0;
    let totalVisits = 0;
    
    analyticsData.forEach(day => {
        const visits = parseInt(day.nb_visits || 0);
        totalVisits += visits;
        totalActions += parseInt(day.nb_actions || 0);
        
        if (visits > maxVisits) {
            maxVisits = visits;
            maxDate = day.date;
        }
        if (visits < minVisits && visits > 0) {
            minVisits = visits;
            minDate = day.date;
        }
    });
    
    const avgVisitsPerDay = analyticsData.length > 0 ? Math.round(totalVisits / analyticsData.length) : 0;
    const actionsPerVisit = totalVisits > 0 ? (totalActions / totalVisits).toFixed(1) : 0;
    
    return {
        maxVisits,
        maxDate: maxDate ? new Date(maxDate).toLocaleDateString('de-DE') : '-',
        minVisits: minVisits === Infinity ? 0 : minVisits,
        minDate: minDate ? new Date(minDate).toLocaleDateString('de-DE') : '-',
        avgVisitsPerDay,
        actionsPerVisit,
        totalDays: analyticsData.length
    };
}

// Bild laden als Promise
function loadImage(src) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => resolve(img);
        img.onerror = reject;
        img.src = src;
    });
}

// PDF Export Funktion
async function generatePdfReport() {
    if (!chart || generatingPdf) return;
    
    generatingPdf = true;
    showExportMenu = false;
    
    try {
        const pdf = new jsPDF({
            orientation: 'portrait',
            unit: 'mm',
            format: 'a4'
        });
        
        const pageWidth = pdf.internal.pageSize.getWidth();
        const pageHeight = pdf.internal.pageSize.getHeight();
        const margin = 15;
        const contentWidth = pageWidth - (margin * 2);
        
        // Header mit modernem Design - #151647
        pdf.setFillColor(21, 22, 71);
        pdf.rect(0, 0, pageWidth, 45, 'F');
        
        // Akzentlinie
        pdf.setFillColor(34, 113, 177);
        pdf.rect(0, 45, pageWidth, 3, 'F');
        
        // Favicon/Logo laden
        const logoToUse = siteFavicon || siteLogo;
        if (logoToUse) {
            try {
                const img = await loadImage(logoToUse);
                pdf.addImage(img, 'PNG', margin, 10, 25, 25);
                
                pdf.setTextColor(255, 255, 255);
                pdf.setFontSize(20);
                pdf.setFont('helvetica', 'bold');
                pdf.text(siteTitle, margin + 32, 22);
                pdf.setFontSize(10);
                pdf.setFont('helvetica', 'normal');
                pdf.setTextColor(148, 163, 184);
                pdf.text(siteUrl, margin + 32, 32);
            } catch (e) {
                // Fallback
                pdf.setTextColor(255, 255, 255);
                pdf.setFontSize(20);
                pdf.setFont('helvetica', 'bold');
                pdf.text(siteTitle, margin, 22);
                pdf.setFontSize(10);
                pdf.setTextColor(148, 163, 184);
                pdf.text(siteUrl, margin, 32);
            }
        } else {
            pdf.setTextColor(255, 255, 255);
            pdf.setFontSize(20);
            pdf.setFont('helvetica', 'bold');
            pdf.text(siteTitle, margin, 22);
            pdf.setFontSize(10);
            pdf.setTextColor(148, 163, 184);
            pdf.text(siteUrl, margin, 32);
        }
        
        // Report Badge rechts - kompakter
        pdf.setFillColor(34, 113, 177);
        pdf.roundedRect(pageWidth - margin - 35, 8, 35, 30, 2, 2, 'F');
        pdf.setTextColor(255, 255, 255);
        pdf.setFontSize(7);
        pdf.setFont('helvetica', 'bold');
        pdf.text('ANALYTICS', pageWidth - margin - 32, 18);
        pdf.text('REPORT', pageWidth - margin - 30, 26);
        
        // Datum im Badge
        const today = new Date().toLocaleDateString('de-DE', { 
            day: '2-digit', month: '2-digit', year: 'numeric'
        });
        pdf.setFontSize(6);
        pdf.setFont('helvetica', 'normal');
        pdf.text(today, pageWidth - margin - 30, 34);
        
        // Hauptstatistiken
        let yPos = 58;
        
        // Section Header
        pdf.setFillColor(248, 250, 252);
        pdf.roundedRect(margin, yPos - 5, contentWidth, 8, 2, 2, 'F');
        pdf.setTextColor(100, 116, 139);
        pdf.setFontSize(8);
        pdf.setFont('helvetica', 'bold');
        pdf.text('ÜBERSICHT  •  ' + formatDateRange(), margin + 4, yPos);
        yPos += 10;
        
        // Stats in 4er Grid
        const statCardWidth = (contentWidth - 12) / 4;
        const statCardHeight = 28;
        
        stats.forEach((stat, index) => {
            const x = margin + (index * (statCardWidth + 4));
            
            // Card mit farbigem Akzent
            pdf.setFillColor(255, 255, 255);
            pdf.roundedRect(x, yPos, statCardWidth, statCardHeight, 3, 3, 'F');
            pdf.setDrawColor(226, 232, 240);
            pdf.roundedRect(x, yPos, statCardWidth, statCardHeight, 3, 3, 'S');
            
            // Farbiger Akzent links
            const colors = { '#3b82f6': [59, 130, 246], '#10b981': [16, 185, 129], '#f59e0b': [245, 158, 11], '#8b5cf6': [139, 92, 246] };
            const rgb = colors[stat.color] || [34, 113, 177];
            pdf.setFillColor(rgb[0], rgb[1], rgb[2]);
            pdf.rect(x, yPos + 3, 3, statCardHeight - 6, 'F');
            
            // Value
            pdf.setFontSize(16);
            pdf.setFont('helvetica', 'bold');
            pdf.setTextColor(30, 41, 59);
            pdf.text(stat.value, x + 8, yPos + 14);
            
            // Label
            pdf.setFontSize(7);
            pdf.setFont('helvetica', 'normal');
            pdf.setTextColor(100, 116, 139);
            pdf.text(stat.label.toUpperCase(), x + 8, yPos + 22);
        });
        
        yPos += statCardHeight + 15;
        
        // Chart Section
        pdf.setFillColor(248, 250, 252);
        pdf.roundedRect(margin, yPos - 5, contentWidth, 8, 2, 2, 'F');
        pdf.setTextColor(100, 116, 139);
        pdf.setFontSize(8);
        pdf.setFont('helvetica', 'bold');
        pdf.text('BESUCHERSTATISTIK', margin + 4, yPos);
        yPos += 8;
        
        // Chart mit Rahmen
        pdf.setFillColor(255, 255, 255);
        pdf.roundedRect(margin, yPos, contentWidth, 70, 3, 3, 'F');
        pdf.setDrawColor(226, 232, 240);
        pdf.roundedRect(margin, yPos, contentWidth, 70, 3, 3, 'S');
        
        // Chart einfügen - höhere Auflösung und korrektes Seitenverhältnis
        const chartCanvas = chart.canvas;
        const chartAspectRatio = chartCanvas.width / chartCanvas.height;
        const chartBoxWidth = contentWidth - 10;
        const chartBoxHeight = 60;
        
        // Berechne Größe unter Beibehaltung des Seitenverhältnisses
        let imgWidth = chartBoxWidth;
        let imgHeight = chartBoxWidth / chartAspectRatio;
        
        if (imgHeight > chartBoxHeight) {
            imgHeight = chartBoxHeight;
            imgWidth = chartBoxHeight * chartAspectRatio;
        }
        
        const imgX = margin + 5 + (chartBoxWidth - imgWidth) / 2;
        const imgY = yPos + 5 + (chartBoxHeight - imgHeight) / 2;
        
        const chartImg = chart.toBase64Image('image/png', 3); // Höhere Auflösung
        pdf.addImage(chartImg, 'PNG', imgX, imgY, imgWidth, imgHeight);
        
        yPos += 80;
        
        // Detailanalyse
        const extStats = getExtendedStats();
        
        pdf.setFillColor(248, 250, 252);
        pdf.roundedRect(margin, yPos - 5, contentWidth, 8, 2, 2, 'F');
        pdf.setTextColor(100, 116, 139);
        pdf.setFontSize(8);
        pdf.setFont('helvetica', 'bold');
        pdf.text('DETAILANALYSE', margin + 4, yPos);
        yPos += 8;
        
        const detailItems = [
            { label: 'Analysezeitraum', value: `${extStats.totalDays || 0} Tage`, icon: '📅' },
            { label: 'Ø Besuche/Tag', value: (extStats.avgVisitsPerDay || 0).toString(), icon: '📊' },
            { label: 'Aktionen/Besuch', value: (extStats.actionsPerVisit || 0).toString(), icon: '🎯' },
            { label: 'Bester Tag', value: `${extStats.maxDate || '-'}`, icon: '🏆' }
        ];
        
        const detailCardWidth = (contentWidth - 12) / 4;
        detailItems.forEach((item, i) => {
            const x = margin + (i * (detailCardWidth + 4));
            
            pdf.setFillColor(255, 255, 255);
            pdf.roundedRect(x, yPos, detailCardWidth, 22, 2, 2, 'F');
            pdf.setDrawColor(226, 232, 240);
            pdf.roundedRect(x, yPos, detailCardWidth, 22, 2, 2, 'S');
            
            pdf.setFontSize(7);
            pdf.setTextColor(100, 116, 139);
            pdf.text(item.label.toUpperCase(), x + 4, yPos + 8);
            
            pdf.setFontSize(11);
            pdf.setFont('helvetica', 'bold');
            pdf.setTextColor(30, 41, 59);
            pdf.text(item.value, x + 4, yPos + 17);
        });
        
        // Footer mit CHOOOMEDIA Logo
        const footerY = pageHeight - 18;
        
        // Footer Hintergrund
        pdf.setFillColor(248, 250, 252);
        pdf.rect(0, footerY - 8, pageWidth, 26, 'F');
        pdf.setDrawColor(226, 232, 240);
        pdf.line(margin, footerY - 8, pageWidth - margin, footerY - 8);
        
        // CHOOOMEDIA Logo laden
        const chooomediaLogoUrl = pluginUrl + 'assets/images/chooomedia-logo.png';
        try {
            const chooomediaLogo = await loadImage(chooomediaLogoUrl);
            pdf.addImage(chooomediaLogo, 'PNG', pageWidth - margin - 12, footerY - 4, 10, 10);
        } catch (e) {
            // Fallback ohne Logo
        }
        
        // Footer Text - Herz als Unicode Symbol statt Emoji
        pdf.setFontSize(8);
        pdf.setTextColor(100, 116, 139);
        pdf.text('Powered with', margin, footerY);
        pdf.setTextColor(239, 68, 68); // Rot für Herz
        pdf.setFont('helvetica', 'normal');
        pdf.text('\u2665', margin + 24, footerY); // Unicode Herz ♥
        pdf.setTextColor(100, 116, 139);
        pdf.text('by', margin + 30, footerY);
        
        pdf.setTextColor(34, 113, 177);
        pdf.setFont('helvetica', 'bold');
        pdf.textWithLink('CHOOOMEDIA', margin + 37, footerY, {
            url: 'https://www.chooomedia.de/wordpress-themes/'
        });
        
        // PDF speichern
        const filename = `${siteTitle.replace(/[^a-z0-9]/gi, '-').toLowerCase()}-analytics-${startDate}-${endDate}.pdf`;
        pdf.save(filename);
        
    } catch (err) {
        console.error('PDF Fehler:', err);
        alert('Fehler beim Erstellen des PDF-Reports');
    } finally {
        generatingPdf = false;
    }
}

// PNG Export - erstellt ein erweitertes Bild mit Stats
async function exportChartAsPng() {
    if (!chart) return;
    showExportMenu = false;
    
    try {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        
        const chartCanvas = chart.canvas;
        const scale = 2; // Höhere Auflösung
        const chartWidth = 800;
        const chartHeight = 400;
        
        const padding = 30;
        const headerHeight = 100;
        const statsHeight = 80;
        const footerHeight = 60;
        
        canvas.width = chartWidth + (padding * 2);
        canvas.height = headerHeight + statsHeight + chartHeight + footerHeight;
        
        // Hintergrund
        ctx.fillStyle = '#f8fafc';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        // Header - #151647
        ctx.fillStyle = '#151647';
        ctx.fillRect(0, 0, canvas.width, headerHeight);
        
        // Akzentlinie
        ctx.fillStyle = '#2271b1';
        ctx.fillRect(0, headerHeight - 4, canvas.width, 4);
        
        // Favicon/Logo laden
        const logoToUse = siteFavicon || siteLogo;
        if (logoToUse) {
            try {
                const logo = await loadImage(logoToUse);
                ctx.drawImage(logo, padding, 25, 50, 50);
                
                ctx.fillStyle = '#ffffff';
                ctx.font = 'bold 28px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
                ctx.fillText(siteTitle, padding + 65, 50);
                
                ctx.fillStyle = '#94a3b8';
                ctx.font = '14px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
                ctx.fillText(siteUrl, padding + 65, 72);
            } catch (e) {
                ctx.fillStyle = '#ffffff';
                ctx.font = 'bold 28px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
                ctx.fillText(siteTitle, padding, 50);
            }
        } else {
            ctx.fillStyle = '#ffffff';
            ctx.font = 'bold 28px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
            ctx.fillText(siteTitle, padding, 50);
        }
        
        // Report Badge - kompakter
        ctx.fillStyle = '#2271b1';
        roundRect(ctx, canvas.width - padding - 100, 20, 90, 60, 6, true, false);
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 11px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
        ctx.fillText('ANALYTICS', canvas.width - padding - 90, 42);
        ctx.fillText('REPORT', canvas.width - padding - 85, 56);
        ctx.font = '9px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
        ctx.fillText(formatDateRange(), canvas.width - padding - 90, 70);
        
        // Stats Cards
        const statsY = headerHeight + 15;
        const statCardWidth = (canvas.width - (padding * 2) - 30) / 4;
        const statCardHeight = 50;
        
        stats.forEach((stat, i) => {
            const x = padding + (i * (statCardWidth + 10));
            
            // Card Hintergrund
            ctx.fillStyle = '#ffffff';
            roundRect(ctx, x, statsY, statCardWidth, statCardHeight, 8, true, false);
            
            // Farbiger Akzent
            ctx.fillStyle = stat.color;
            ctx.fillRect(x, statsY + 8, 4, statCardHeight - 16);
            
            // Value
            ctx.fillStyle = '#1e293b';
            ctx.font = 'bold 22px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
            ctx.fillText(stat.value, x + 15, statsY + 28);
            
            // Label
            ctx.fillStyle = '#64748b';
            ctx.font = '10px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
            ctx.fillText(stat.label.toUpperCase(), x + 15, statsY + 42);
        });
        
        // Chart Container
        const chartY = headerHeight + statsHeight + 10;
        ctx.fillStyle = '#ffffff';
        roundRect(ctx, padding, chartY, canvas.width - (padding * 2), chartHeight, 8, true, false);
        
        // Chart zeichnen - mit korrektem Seitenverhältnis
        const srcCanvas = chart.canvas;
        const srcAspectRatio = srcCanvas.width / srcCanvas.height;
        const destWidth = canvas.width - (padding * 2) - 20;
        const destHeight = chartHeight - 20;
        
        let drawWidth = destWidth;
        let drawHeight = destWidth / srcAspectRatio;
        
        if (drawHeight > destHeight) {
            drawHeight = destHeight;
            drawWidth = destHeight * srcAspectRatio;
        }
        
        const drawX = padding + 10 + (destWidth - drawWidth) / 2;
        const drawY = chartY + 10 + (destHeight - drawHeight) / 2;
        
        ctx.drawImage(srcCanvas, drawX, drawY, drawWidth, drawHeight);
        
        // Footer
        const footerY = canvas.height - footerHeight;
        ctx.fillStyle = '#f1f5f9';
        ctx.fillRect(0, footerY, canvas.width, footerHeight);
        ctx.strokeStyle = '#e2e8f0';
        ctx.beginPath();
        ctx.moveTo(0, footerY);
        ctx.lineTo(canvas.width, footerY);
        ctx.stroke();
        
        // CHOOOMEDIA Logo
        const chooomediaLogoUrl = pluginUrl + 'assets/images/chooomedia-logo.png';
        try {
            const chooomediaLogo = await loadImage(chooomediaLogoUrl);
            ctx.drawImage(chooomediaLogo, canvas.width - padding - 35, footerY + 12, 30, 30);
        } catch (e) {}
        
        // Footer Text
        ctx.fillStyle = '#64748b';
        ctx.font = '12px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
        ctx.fillText('Powered with', padding, footerY + 32);
        ctx.fillStyle = '#ef4444';
        ctx.fillText('❤', padding + 80, footerY + 32);
        ctx.fillStyle = '#64748b';
        ctx.fillText('by', padding + 95, footerY + 32);
        ctx.fillStyle = '#2271b1';
        ctx.font = 'bold 12px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
        ctx.fillText('CHOOOMEDIA', padding + 112, footerY + 32);
        
        // Download
        const link = document.createElement('a');
        link.download = `${siteTitle.replace(/[^a-z0-9]/gi, '-').toLowerCase()}-analytics-${startDate}-${endDate}.png`;
        link.href = canvas.toDataURL('image/png', 1);
        link.click();
        
    } catch (err) {
        console.error('PNG Export Fehler:', err);
        const link = document.createElement('a');
        link.download = `analytics-chart-${startDate}-${endDate}.png`;
        link.href = chart.canvas.toDataURL('image/png', 1.0);
        link.click();
    }
}

// Hilfsfunktion für abgerundete Rechtecke
function roundRect(ctx, x, y, width, height, radius, fill, stroke) {
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + width - radius, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
    ctx.lineTo(x + width, y + height - radius);
    ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
    ctx.lineTo(x + radius, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();
    if (fill) ctx.fill();
    if (stroke) ctx.stroke();
}

// Event Handler
function handleDateChange() {
    loadAnalytics();
}

function handleChartTypeChange(type) {
    chartType = type;
    updateChart();
}

function toggleExportMenu(event) {
    event.stopPropagation();
    showExportMenu = !showExportMenu;
}

// Click outside handler
function handleClickOutside(event) {
    if (showExportMenu && !event.target.closest('.dw-export-wrapper')) {
        showExportMenu = false;
    }
}

// Lifecycle
onMount(async () => {
    loadMinimalViewState();
    await loadAnalytics();
    document.addEventListener('click', handleClickOutside);
});

// Nach jedem Update prüfen ob Chart erstellt werden muss
afterUpdate(() => {
    if (chartCanvas && !loading && !error && analyticsData) {
        if (needsChartUpdate || !chart) {
            needsChartUpdate = false;
            createChart();
        }
    }
});

onDestroy(() => {
    if (chart) {
        chart.destroy();
    }
    document.removeEventListener('click', handleClickOutside);
});
</script>

<div class="dw-container" class:dw-minimal={isMinimalView}>
    <!-- Minimal View -->
    {#if isMinimalView}
        <!-- Minimal Stats Row -->
        <div class="dw-minimal-header">
            {#if !loading && !error && stats.length > 0}
                <div class="dw-minimal-stats">
                    {#each stats as stat}
                        <div class="dw-minimal-stat" style="--stat-color: {stat.color};">
                            <span class="dw-minimal-stat-value">{stat.value}</span>
                            <span class="dw-minimal-stat-label">{stat.label}</span>
                        </div>
                    {/each}
                </div>
            {/if}
            <div class="dw-minimal-actions">
                <button 
                    class="dw-btn-refresh"
                    on:click={loadAnalytics}
                    disabled={loading}
                    title="Aktualisieren"
                >
                    <span class:dw-spinning={loading}>🔄</span>
                </button>
                <button 
                    class="dw-btn-refresh"
                    on:click={toggleMinimalView}
                    title="Erweitern"
                >
                    📈
                </button>
            </div>
        </div>
        
        <!-- Minimal Chart -->
        <div class="dw-minimal-chart">
            {#if loading}
                <div class="dw-loader dw-loader-small">
                    <div class="dw-loader-spinner"></div>
                </div>
            {:else if !error}
                <canvas bind:this={chartCanvas}></canvas>
            {/if}
        </div>
    {:else}
        <!-- Normal View: Stats Cards -->
        {#if !loading && !error && stats.length > 0}
            <div class="dw-stats">
                {#each stats as stat, i}
                    <div class="dw-stat" style="--stat-color: {stat.color};">
                        <span class="dw-stat-icon">{stat.icon}</span>
                        <div class="dw-stat-content">
                            <span class="dw-stat-value">{stat.value}</span>
                            <span class="dw-stat-label">{stat.label}</span>
                        </div>
                    </div>
                {/each}
            </div>
        {/if}

        <!-- Chart -->
        <div class="dw-chart-container">
            <div class="dw-chart" class:dw-loading={loading}>
                {#if loading}
                    <div class="dw-loader">
                        <div class="dw-loader-spinner"></div>
                        <span>Lade Statistiken...</span>
                    </div>
                {:else if error}
                    <div class="dw-error">
                        <span class="dw-error-icon">⚠️</span>
                        <p>{error}</p>
                        <button class="dw-btn dw-btn-primary" on:click={loadAnalytics}>
                            🔄 Erneut versuchen
                        </button>
                    </div>
                {:else}
                    <canvas bind:this={chartCanvas}></canvas>
                {/if}
            </div>
        </div>

        <!-- Controls -->
        <div class="dw-controls">
            <div class="dw-control-row">
                <div class="dw-dates">
                    <input 
                        type="date" 
                        bind:value={startDate} 
                        on:change={handleDateChange}
                        class="dw-input-date"
                    />
                    <span class="dw-date-sep">–</span>
                    <input 
                        type="date" 
                        bind:value={endDate} 
                        on:change={handleDateChange}
                        class="dw-input-date"
                    />
                </div>
            </div>
            
            <div class="dw-control-row">
                <div class="dw-chart-types">
                    {#each chartTypes as type}
                        <button 
                            class="dw-chart-type-btn"
                            class:dw-active={chartType === type.value}
                            on:click={() => handleChartTypeChange(type.value)}
                            title={type.title}
                        >
                            {type.label}
                        </button>
                    {/each}
                </div>

                <input 
                    type="color" 
                    bind:value={chartColor} 
                    on:change={updateChart}
                    class="dw-color-picker"
                    title="Farbe ändern"
                />

                <button 
                    class="dw-btn-refresh"
                    on:click={loadAnalytics}
                    disabled={loading}
                    title="Aktualisieren"
                >
                    <span class:dw-spinning={loading}>🔄</span>
                </button>

                <button 
                    class="dw-btn-refresh"
                    on:click={toggleMinimalView}
                    title="Minimieren"
                >
                    ➖
                </button>

                <div class="dw-export-wrapper">
                    <button 
                        class="dw-btn dw-btn-export"
                        on:click={toggleExportMenu}
                        disabled={loading || generatingPdf}
                    >
                        {#if generatingPdf}
                            ⏳ Erstelle...
                        {:else}
                            📥 Report
                        {/if}
                    </button>
                    
                    {#if showExportMenu}
                        <div class="dw-export-menu">
                            <button class="dw-export-option" on:click={generatePdfReport}>
                                <span>📄</span>
                                <div>
                                    <strong>PDF Report</strong>
                                    <small>Vollständiger Bericht</small>
                                </div>
                            </button>
                            <button class="dw-export-option" on:click={exportChartAsPng}>
                                <span>🖼️</span>
                                <div>
                                    <strong>PNG Bild</strong>
                                    <small>Nur das Diagramm</small>
                                </div>
                            </button>
                        </div>
                    {/if}
                </div>
            </div>
        </div>

        <!-- Footer -->
        <div class="dw-footer">
            <a href="admin.php?page=dashlytics" class="dw-settings-link">
                ⚙️ Einstellungen
            </a>
            <span class="dw-powered">
                Powered by <strong>Matomo</strong>
            </span>
        </div>
    {/if}
</div>