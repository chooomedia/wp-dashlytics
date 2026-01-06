<script>
import { onMount } from "svelte";

// Globale WordPress Daten
const wpData = window.dashlyticsAdmin || {};
const restUrl = wpData.restUrl || '/wp-json/dashlytics/v1/';
const nonce = wpData.nonce || '';
const pluginUrl = wpData.pluginUrl || '';
const matomoDetected = wpData.matomoDetected || { installed: false };
const i18n = wpData.i18n || {};

// State
let settings = {
    matomo_url: '',
    site_id: 1,
    token_auth: '',
    chart_type: 'line',
    chart_color: '#2271b1',
    date_range: 30,
    auto_detect_matomo: true
};

let loading = true;
let saving = false;
let testing = false;
let connectionStatus = null; // null, 'success', 'error'
let connectionMessage = '';
let toast = null;
let activeTab = 'connection';
let showToken = false;
let autoConnected = false;

// Token maskieren für Anzeige
function maskToken(token) {
    if (!token || token.length < 8) return '••••••••';
    return token.substring(0, 4) + '••••••••' + token.substring(token.length - 4);
}

const chartTypes = [
    { value: 'line', label: 'Liniendiagramm', icon: '📈' },
    { value: 'bar', label: 'Balkendiagramm', icon: '📊' },
    { value: 'pie', label: 'Kreisdiagramm', icon: '🥧' }
];

const dateRanges = [
    { value: 7, label: 'Letzte 7 Tage' },
    { value: 14, label: 'Letzte 14 Tage' },
    { value: 30, label: 'Letzte 30 Tage' },
    { value: 60, label: 'Letzte 60 Tage' },
    { value: 90, label: 'Letzte 90 Tage' }
];

// API Funktionen
async function fetchSettings() {
    try {
        const response = await fetch(`${restUrl}settings`, {
        headers: {
                'X-WP-Nonce': nonce
        }
        });
        
        if (response.ok) {
            const data = await response.json();
            settings = { ...settings, ...data };
            
            // Prüfen ob Token bereits existiert (z.B. von Matomo for WordPress)
            if (matomoDetected.installed && settings.token_auth) {
                autoConnected = true;
            }
        }
    } catch (error) {
        console.error('Fehler beim Laden der Einstellungen:', error);
    } finally {
        loading = false;
    }
}

async function saveSettings() {
    saving = true;
    
    try {
        const response = await fetch(`${restUrl}settings`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-WP-Nonce': nonce
            },
            body: JSON.stringify(settings)
        });
        
        if (response.ok) {
            showToast(i18n.saveSuccess || 'Einstellungen gespeichert!', 'success');
        } else {
            showToast(i18n.saveError || 'Fehler beim Speichern.', 'error');
        }
    } catch (error) {
        console.error('Fehler beim Speichern:', error);
        showToast(i18n.saveError || 'Fehler beim Speichern.', 'error');
    } finally {
        saving = false;
    }
}

// Reset connection test status
function resetConnectionTest() {
    connectionStatus = null;
    connectionMessage = '';
}

// Test connection to Matomo
async function testConnection() {
    testing = true;
    connectionStatus = null;

    try {
        const response = await fetch(`${restUrl}test-connection`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-WP-Nonce': nonce
            },
            body: JSON.stringify({
                matomo_url: settings.matomo_url,
                token_auth: settings.token_auth,
                site_id: settings.site_id
            })
            });

        const data = await response.json();

        if (data.success) {
            connectionStatus = 'success';
            connectionMessage = data.message;
            showToast(i18n.connectionSuccess || 'Verbindung erfolgreich!', 'success');
        } else {
            connectionStatus = 'error';
            connectionMessage = data.message;
            showToast(i18n.connectionError || 'Verbindung fehlgeschlagen.', 'error');
        }
    } catch (error) {
        connectionStatus = 'error';
        connectionMessage = error.message;
        showToast(i18n.connectionError || 'Verbindung fehlgeschlagen.', 'error');
    } finally {
        testing = false;
    }
}

async function detectToken() {
    try {
        const response = await fetch(`${restUrl}detect-token`, {
            headers: {
                'X-WP-Nonce': nonce
            }
        });
        
        const data = await response.json();
        
        if (data.success && data.token) {
            settings.token_auth = data.token;
            showToast(i18n.tokenGenerated || 'Token automatisch erkannt!', 'success');
            return { useWpAuth: false, token: data.token };
        } else if (data.use_wp_auth) {
            settings.token_auth = ''; // Clear any existing token
            showToast(data.message || 'WordPress Authentifizierung wird verwendet', 'success');
            return { useWpAuth: true };
        }
        
        return { useWpAuth: false };
    } catch (error) {
        console.error('Token-Erkennung fehlgeschlagen:', error);
        showToast('Token-Erkennung fehlgeschlagen', 'error');
        return { useWpAuth: false, error: error.message };
    }
}

function showToast(message, type = 'info') {
    toast = { message, type };
    setTimeout(() => {
        toast = null;
    }, 3000);
}

async function useMatomoWP() {
    if (matomoDetected.installed) {
        settings.matomo_url = '';
        settings.auto_detect_matomo = true;

        // Detect token and handle the response
        const result = await detectToken();

        if (result.useWpAuth) {
            // WordPress authentication will be used (no token needed)
            autoConnected = true;
            connectionStatus = 'success';
            connectionMessage = 'WordPress Authentifizierung aktiviert - kein Token erforderlich';
        } else if (settings.token_auth) {
            // A token was found and set
            autoConnected = true;
            connectionStatus = 'success';
            connectionMessage = 'Automatisch mit Matomo for WordPress verbunden (Token erkannt)';
        } else {
            // No token and no WordPress auth - this shouldn't happen but handle it gracefully
            autoConnected = false;
            connectionStatus = 'error';
            connectionMessage = 'Konnte keine gültige Authentifizierungsmethode erkennen';
            showToast('Verbindungsfehler - bitte manuell konfigurieren', 'error');
        }
    }
}

onMount(() => {
    fetchSettings();
});
</script>

<div class="dashlytics-settings">
    <!-- Header -->
    <header class="dashlytics-header">
        <div class="dashlytics-header-content">
            <div class="dashlytics-logo">📊</div>
            <div>
                <h1>Dashlytics</h1>
                <p>Matomo Widget Dashboard für WordPress</p>
            </div>
        </div>
                    <div class="dashlytics-header-actions">
                        <span class="dashlytics-version">v0.7.9</span>
            {#if connectionStatus === 'success'}
                <span class="dashlytics-status dashlytics-status--connected">
                    <span class="dashlytics-status-dot"></span>
                    Verbunden
                </span>
            {:else if connectionStatus === 'error'}
                <span class="dashlytics-status dashlytics-status--disconnected">
                    <span class="dashlytics-status-dot"></span>
                    Nicht verbunden
                </span>
            {:else}
                <span class="dashlytics-status dashlytics-status--pending">
                    <span class="dashlytics-status-dot"></span>
                    Konfiguration erforderlich
                </span>
            {/if}
        </div>
    </header>

    <!-- Matomo Detection Banner -->
    {#if matomoDetected.installed}
        <div class="dashlytics-detection">
            <div class="dashlytics-detection-icon">✓</div>
            <div class="dashlytics-detection-content">
                <h3>Matomo for WordPress erkannt!</h3>
                <p>Das Matomo Plugin ist installiert. Dashlytics kann automatisch verbunden werden.</p>
            </div>
            <button class="dashlytics-btn dashlytics-btn--success" on:click={useMatomoWP}>
                Automatisch verbinden
            </button>
        </div>
    {/if}

    <!-- Tabs -->
    <div class="dashlytics-tabs">
        <button 
            class="dashlytics-tab" 
            class:dashlytics-tab--active={activeTab === 'connection'}
            on:click={() => activeTab = 'connection'}
        >
            🔗 Verbindung
        </button>
        <button 
            class="dashlytics-tab" 
            class:dashlytics-tab--active={activeTab === 'display'}
            on:click={() => activeTab = 'display'}
        >
            🎨 Darstellung
        </button>
        <button 
            class="dashlytics-tab" 
            class:dashlytics-tab--active={activeTab === 'help'}
            on:click={() => activeTab = 'help'}
        >
            ❓ Hilfe
        </button>
    </div>

    {#if loading}
        <div class="dashlytics-card">
            <div class="dashlytics-card-body">
                <div class="dashlytics-skeleton" style="height: 200px;"></div>
            </div>
        </div>
    {:else}
        <!-- Connection Tab -->
        {#if activeTab === 'connection'}
            <div class="dashlytics-grid">
                <div class="dashlytics-card dashlytics-card--flex">
                    <div class="dashlytics-card-header">
                        <h2 class="dashlytics-card-title">
                            <span class="dashlytics-card-icon">🔌</span>
                            API Verbindung
                        </h2>
                    </div>
                    <div class="dashlytics-card-body dashlytics-card-body--grow">
                        {#if !matomoDetected.installed}
                            <div class="dashlytics-form-group">
                                <label class="dashlytics-label">
                                    Matomo URL
                                    <span class="dashlytics-label-hint">(Ihre Matomo Installation)</span>
                                </label>
                                <input 
                                    type="url" 
                                    class="dashlytics-input" 
                                    bind:value={settings.matomo_url}
                                    placeholder="https://analytics.ihre-domain.de"
                                />
                            </div>
                        {/if}

                        <div class="dashlytics-form-group">
                            <label class="dashlytics-label">
                                Site ID
                                <span class="dashlytics-label-hint">(Standard: 1)</span>
                            </label>
                            <input 
                                type="number" 
                                class="dashlytics-input" 
                                bind:value={settings.site_id}
                                min="1"
                                style="max-width: 120px;"
                            />
                        </div>

                        <div class="dashlytics-form-group">
                            <label class="dashlytics-label">
                                Auth Token
                                <span class="dashlytics-label-hint">
                                    {#if autoConnected && settings.token_auth}
                                        (automatisch erkannt)
                                    {:else if autoConnected && !settings.token_auth}
                                        (WordPress Authentifizierung)
                                    {:else}
                                        (API Zugriffstoken)
                                    {/if}
                                </span>
                            </label>
                            <div class="dashlytics-input-group">
                                <input 
                                    type="text"
                                    class="dashlytics-input" 
                                    class:dashlytics-input--readonly={autoConnected || (matomoDetected.installed && settings.token_auth)}
                                    value={showToken ? settings.token_auth : (settings.token_auth ? maskToken(settings.token_auth) : '')}
                                    placeholder="Ihr Matomo API Token"
                                    readonly={autoConnected || (matomoDetected.installed && settings.token_auth)}
                                    on:input={(e) => { if (!autoConnected && !(matomoDetected.installed && settings.token_auth)) settings.token_auth = e.target.value; }}
                                />
                                <button 
                                    type="button"
                                    class="dashlytics-btn dashlytics-btn--icon"
                                    on:click={() => showToken = !showToken}
                                    title={showToken ? 'Token verbergen' : 'Token anzeigen'}
                                >
                                    <span class="dashicons" class:dashicons-visibility={!showToken} class:dashicons-hidden={showToken}></span>
                                </button>
                                {#if matomoDetected.installed && !autoConnected && !settings.token_auth}
                                    <button 
                                        type="button"
                                        class="dashlytics-btn dashlytics-btn--secondary"
                                        on:click={detectToken}
                                        title="Token automatisch erkennen"
                                    >
                                        🔍 Auto
                                    </button>
                                {/if}
                            </div>
                            {#if autoConnected && settings.token_auth}
                                <p class="dashlytics-field-info">
                                    ✓ Token wurde automatisch von Matomo for WordPress übernommen
                                </p>
                            {:else if autoConnected && !settings.token_auth}
                                <p class="dashlytics-field-info">
                                    ✓ WordPress Authentifizierung aktiviert - kein Token erforderlich
                                </p>
                            {/if}
                        </div>

                        {#if connectionMessage}
                            <div class="dashlytics-alert" class:dashlytics-alert--success={connectionStatus === 'success'} class:dashlytics-alert--error={connectionStatus === 'error'}>
                                <span class="dashlytics-alert-icon">
                                    {connectionStatus === 'success' ? '✓' : '✗'}
                                </span>
                                <div class="dashlytics-alert-content">
                                    <p>{connectionMessage}</p>
                                </div>
                            </div>
                        {/if}
                    </div>
                    <div class="dashlytics-card-footer dashlytics-card-footer--sticky">
                        {#if connectionStatus !== null}
                            <button 
                                type="button"
                                class="dashlytics-btn dashlytics-btn--tertiary"
                                on:click={resetConnectionTest}
                                title="Verbindungstest zurücksetzen"
                            >
                                🔄 Zurücksetzen
                            </button>
                        {/if}
                        <button 
                            type="button"
                            class="dashlytics-btn dashlytics-btn--secondary"
                            on:click={testConnection}
                            disabled={testing}
                            class:dashlytics-btn--loading={testing}
                        >
                            {testing ? '' : '🔄'} Verbindung testen
                        </button>
                        <button 
                            type="button"
                            class="dashlytics-btn dashlytics-btn--primary"
                            on:click={saveSettings}
                            disabled={saving}
                            class:dashlytics-btn--loading={saving}
                        >
                            {saving ? '' : '💾'} Speichern
                        </button>
                    </div>
                </div>

                <!-- Quick Stats Preview -->
                <div class="dashlytics-card">
                    <div class="dashlytics-card-header">
                        <h2 class="dashlytics-card-title">
                            <span class="dashlytics-card-icon">📈</span>
                            Vorschau
                        </h2>
                    </div>
                    <div class="dashlytics-card-body">
                        <div class="dashlytics-preview">
                            <div class="dashlytics-preview-chart">
                                {#each [40, 65, 45, 80, 55, 90, 70] as height, i}
                                    <div 
                                        class="dashlytics-preview-bar" 
                                        style="height: {height}%; background: {settings.chart_color}; animation-delay: {i * 0.1}s;"
                                    ></div>
                                {/each}
                            </div>
                            <p style="color: #666; font-size: 13px;">
                                So wird Ihr Dashboard Widget aussehen
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        {/if}

        <!-- Display Tab -->
        {#if activeTab === 'display'}
            <div class="dashlytics-grid">
                <div class="dashlytics-card">
                    <div class="dashlytics-card-header">
                        <h2 class="dashlytics-card-title">
                            <span class="dashlytics-card-icon">📊</span>
                            Chart Einstellungen
                        </h2>
                    </div>
                    <div class="dashlytics-card-body">
                        <div class="dashlytics-form-group">
                            <label class="dashlytics-label">Diagramm-Typ</label>
                            <div class="dashlytics-chart-types">
                                {#each chartTypes as type}
                                    <label class="dashlytics-chart-type" class:active={settings.chart_type === type.value}>
                                        <input 
                                            type="radio" 
                                            name="chart_type" 
                                            value={type.value}
                                            bind:group={settings.chart_type}
                                        />
                                        <span class="dashlytics-chart-type-icon">{type.icon}</span>
                                        <span class="dashlytics-chart-type-label">{type.label}</span>
                                    </label>
                                {/each}
                            </div>
                        </div>

                        <div class="dashlytics-form-group">
                            <label class="dashlytics-label">Hauptfarbe</label>
                            <div class="dashlytics-color-picker">
                                <input 
                                    type="color" 
                                    class="dashlytics-color-input"
                                    bind:value={settings.chart_color}
                                />
                                <span class="dashlytics-color-value">{settings.chart_color}</span>
                            </div>
                        </div>

                        <div class="dashlytics-form-group">
                            <label class="dashlytics-label">Standard Zeitraum</label>
                            <select class="dashlytics-select" bind:value={settings.date_range}>
                                {#each dateRanges as range}
                                    <option value={range.value}>{range.label}</option>
                                {/each}
                            </select>
                        </div>
                    </div>
                    <div class="dashlytics-card-footer">
                        <button 
                            class="dashlytics-btn dashlytics-btn--primary"
                            on:click={saveSettings}
                            disabled={saving}
                            class:dashlytics-btn--loading={saving}
                        >
                            {saving ? '' : '💾'} Speichern
                        </button>
                    </div>
                </div>

                <!-- Live Preview -->
                <div class="dashlytics-card">
                    <div class="dashlytics-card-header">
                        <h2 class="dashlytics-card-title">
                            <span class="dashlytics-card-icon">👁️</span>
                            Live Vorschau
                        </h2>
                    </div>
                    <div class="dashlytics-card-body">
                        <div class="dashlytics-preview" style="background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%);">
                            <div class="dashlytics-preview-chart">
                                {#if settings.chart_type === 'line'}
                                    <!-- Liniendiagramm mit Punkten und Verbindung -->
                                    <svg viewBox="0 0 140 80" style="width: 100%; height: 100px;">
                                        <polyline 
                                            fill="none" 
                                            stroke="{settings.chart_color}" 
                                            stroke-width="2"
                                            points="10,60 30,40 50,50 70,25 90,35 110,15 130,30"
                                        />
                                        <circle cx="10" cy="60" r="4" fill="{settings.chart_color}"/>
                                        <circle cx="30" cy="40" r="4" fill="{settings.chart_color}"/>
                                        <circle cx="50" cy="50" r="4" fill="{settings.chart_color}"/>
                                        <circle cx="70" cy="25" r="4" fill="{settings.chart_color}"/>
                                        <circle cx="90" cy="35" r="4" fill="{settings.chart_color}"/>
                                        <circle cx="110" cy="15" r="4" fill="{settings.chart_color}"/>
                                        <circle cx="130" cy="30" r="4" fill="{settings.chart_color}"/>
                                    </svg>
                                {:else if settings.chart_type === 'bar'}
                                    <!-- Balkendiagramm -->
                                    {#each [40, 65, 45, 80, 55, 90, 70] as height, i}
                                        <div 
                                            class="dashlytics-preview-bar" 
                                            style="height: {height}%; background: {settings.chart_color}; border-radius: 4px 4px 0 0; width: 20px;"
                                        ></div>
                                    {/each}
                                {:else}
                                    <!-- Kreisdiagramm -->
                                    <div style="width: 120px; height: 120px; border-radius: 50%; background: conic-gradient({settings.chart_color} 0% 35%, #e0e0e0 35% 55%, {settings.chart_color}88 55% 80%, #ccc 80% 100%);"></div>
                                {/if}
                            </div>
                            <p style="margin: 16px 0 0; color: #666; font-size: 13px;">
                                {chartTypes.find(t => t.value === settings.chart_type)?.label || 'Diagramm'}
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        {/if}

        <!-- Help Tab -->
        {#if activeTab === 'help'}
            <div class="dashlytics-grid dashlytics-grid--full">
                <div class="dashlytics-card">
                    <div class="dashlytics-card-header">
                        <h2 class="dashlytics-card-title">
                            <span class="dashlytics-card-icon">📖</span>
                            Schnellstart Anleitung
                        </h2>
                    </div>
                    <div class="dashlytics-card-body">
                        <div class="dashlytics-help-steps">
                            {#if matomoDetected.installed}
                                <!-- Vereinfachte Anleitung für Matomo for WordPress -->
                                <div class="dashlytics-help-step">
                                    <span class="dashlytics-help-step-number">1</span>
                                    <div class="dashlytics-help-step-content">
                                        <strong>Automatisch verbinden</strong>
                                        <p>Matomo for WordPress wurde erkannt! Klicken Sie oben auf "Automatisch verbinden" - Dashlytics übernimmt alle Einstellungen automatisch.</p>
                                    </div>
                                </div>
                                <div class="dashlytics-help-step">
                                    <span class="dashlytics-help-step-number">2</span>
                                    <div class="dashlytics-help-step-content">
                                        <strong>Dashboard Widget nutzen</strong>
                                        <p>Nach der Verbindung erscheint das Statistik-Widget auf Ihrem WordPress Dashboard. Sie können Zeitraum, Diagramm-Typ und Farbe direkt im Widget anpassen.</p>
                                    </div>
                                </div>
                                <div class="dashlytics-help-step">
                                    <span class="dashlytics-help-step-number">3</span>
                                    <div class="dashlytics-help-step-content">
                                        <strong>Reports exportieren</strong>
                                        <p>Nutzen Sie den "Report" Button im Widget um Ihre Statistiken als PDF-Bericht oder PNG-Bild zu exportieren.</p>
                                    </div>
                                </div>
                            {:else}
                                <!-- Anleitung für externe Matomo Installation -->
                                <div class="dashlytics-help-step">
                                    <span class="dashlytics-help-step-number">1</span>
                                    <div class="dashlytics-help-step-content">
                                        <strong>Matomo for WordPress installieren</strong>
                                        <p>Für die beste Integration installieren Sie das kostenlose "Matomo Analytics" Plugin aus dem WordPress Plugin-Verzeichnis.</p>
                                    </div>
                                </div>
                                <div class="dashlytics-help-step">
                                    <span class="dashlytics-help-step-number">2</span>
                                    <div class="dashlytics-help-step-content">
                                        <strong>Alternative: Externe Matomo Installation</strong>
                                        <p>Falls Sie Matomo extern hosten, tragen Sie Ihre Matomo-URL, Site-ID und einen API-Token unter "Verbindung" ein.</p>
                                    </div>
                                </div>
                                <div class="dashlytics-help-step">
                                    <span class="dashlytics-help-step-number">3</span>
                                    <div class="dashlytics-help-step-content">
                                        <strong>Verbindung testen</strong>
                                        <p>Klicken Sie auf "Verbindung testen" um sicherzustellen, dass alles funktioniert.</p>
                                    </div>
                                </div>
                            {/if}
                        </div>

                        <!-- Features Übersicht -->
                        <div class="dashlytics-features-section">
                            <h3 class="dashlytics-features-title">Widget Funktionen</h3>
                            <div class="dashlytics-feature-cards">
                                <div class="dashlytics-feature-card">
                                    <div class="dashlytics-feature-card-icon" style="background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%);">
                                        <span class="dashicons dashicons-chart-bar"></span>
                                    </div>
                                    <div class="dashlytics-feature-card-content">
                                        <h4>Statistik-Karten</h4>
                                        <p>Besucher, Seitenaufrufe, Absprungrate und Verweildauer auf einen Blick</p>
                                    </div>
                                </div>
                                <div class="dashlytics-feature-card">
                                    <div class="dashlytics-feature-card-icon" style="background: linear-gradient(135deg, #10b981 0%, #059669 100%);">
                                        <span class="dashicons dashicons-chart-line"></span>
                                    </div>
                                    <div class="dashlytics-feature-card-content">
                                        <h4>Interaktive Charts</h4>
                                        <p>Linie, Balken oder Kreis - wählen Sie Ihre Darstellung</p>
                                    </div>
                                </div>
                                <div class="dashlytics-feature-card">
                                    <div class="dashlytics-feature-card-icon" style="background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);">
                                        <span class="dashicons dashicons-calendar-alt"></span>
                                    </div>
                                    <div class="dashlytics-feature-card-content">
                                        <h4>Flexibler Zeitraum</h4>
                                        <p>Beliebigen Zeitraum per Datumswahl im Widget auswählen</p>
                                    </div>
                                </div>
                                <div class="dashlytics-feature-card">
                                    <div class="dashlytics-feature-card-icon" style="background: linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%);">
                                        <span class="dashicons dashicons-download"></span>
                                    </div>
                                    <div class="dashlytics-feature-card-content">
                                        <h4>PDF & PNG Export</h4>
                                        <p>Statistiken als professionellen Report oder Bild exportieren</p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div class="dashlytics-support">
                            <a href="https://github.com/chooomedia/wp-dashlytics" target="_blank" class="dashlytics-support-link">
                                <span class="dashlytics-support-link-icon">📦</span>
                                <span>GitHub Repository</span>
                            </a>
                            <a href="https://developer.matomo.org/api-reference/reporting-api" target="_blank" class="dashlytics-support-link">
                                <span class="dashlytics-support-link-icon">📚</span>
                                <span>Matomo API Docs</span>
                            </a>
                            <a href="https://www.paypal.com/paypalme/choooomedia/4" target="_blank" class="dashlytics-support-link">
                                <span class="dashlytics-support-link-icon">☕</span>
                                <span>Entwickler unterstützen</span>
                            </a>
                            <a href="https://chooomedia.de" target="_blank" class="dashlytics-support-link">
                                <span class="dashlytics-support-link-icon">🌐</span>
                                <span>chooomedia.de</span>
                            </a>
                        </div>
                    </div>
                </div>
            </div>
        {/if}
    {/if}

    <!-- Toast Notification -->
    {#if toast}
        <div class="dashlytics-toast" class:dashlytics-toast--success={toast.type === 'success'} class:dashlytics-toast--error={toast.type === 'error'}>
            {toast.message}
    </div>
    {/if}
</div>

<style>
    .dashlytics-settings {
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen-Sans, Ubuntu, Cantarell, "Helvetica Neue", sans-serif;
    }

    .dashlytics-chart-types {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
        gap: 12px;
    }

    .dashlytics-chart-type {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 8px;
        padding: 16px;
        background: #f0f0f1;
        border: 2px solid transparent;
        border-radius: 8px;
        cursor: pointer;
        transition: all 0.2s ease;
    }

    .dashlytics-chart-type:hover {
        background: #e7f3ff;
    }

    .dashlytics-chart-type.active {
        background: #e7f3ff;
        border-color: #2271b1;
    }

    .dashlytics-chart-type input {
        display: none;
    }

    .dashlytics-chart-type-icon {
        font-size: 28px;
    }

    .dashlytics-chart-type-label {
        font-size: 13px;
        font-weight: 500;
        color: #1d2327;
    }

    /* Token Field */
    .dashlytics-input--readonly {
        background: #f6f7f7;
        font-family: monospace;
        letter-spacing: 1px;
    }

    .dashlytics-field-info {
        margin: 8px 0 0;
        font-size: 12px;
        color: #00a32a;
    }

    /* Features Section */
    .dashlytics-features-section {
        margin-top: 24px;
        padding-top: 24px;
        border-top: 1px solid #e2e8f0;
    }

    .dashlytics-features-title {
        margin: 0 0 20px;
        font-size: 16px;
        font-weight: 600;
        color: #1e293b;
        display: flex;
        align-items: center;
        gap: 8px;
    }

    .dashlytics-features-title::before {
        content: '';
        width: 4px;
        height: 20px;
        background: linear-gradient(135deg, #2271b1 0%, #135e96 100%);
        border-radius: 2px;
    }

    .dashlytics-feature-cards {
        display: grid;
        grid-template-columns: repeat(2, 1fr);
        gap: 16px;
    }

    @media (max-width: 768px) {
        .dashlytics-feature-cards {
            grid-template-columns: 1fr;
        }
    }

    .dashlytics-feature-card {
        display: flex;
        align-items: flex-start;
        gap: 16px;
        padding: 20px;
        background: #ffffff;
        border: 1px solid #e2e8f0;
        border-radius: 12px;
        transition: all 0.2s ease;
    }

    .dashlytics-feature-card:hover {
        border-color: #2271b1;
        box-shadow: 0 4px 12px rgba(34, 113, 177, 0.1);
        transform: translateY(-2px);
    }

    .dashlytics-feature-card-icon {
        flex-shrink: 0;
        width: 48px;
        height: 48px;
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: 12px;
        color: #ffffff;
    }

    .dashlytics-feature-card-icon .dashicons {
        font-size: 24px;
        width: 24px;
        height: 24px;
    }

    .dashlytics-feature-card-content h4 {
        margin: 0 0 6px;
        font-size: 15px;
        font-weight: 600;
        color: #1e293b;
    }

    .dashlytics-feature-card-content p {
        margin: 0;
        font-size: 13px;
        color: #64748b;
        line-height: 1.5;
    }

    /* Button Styles - Tertiary */
    .dashlytics-btn--tertiary {
        background-color: transparent;
        border: 1px solid #e2e8f0;
        color: #64748b;
    }

    .dashlytics-btn--tertiary:hover {
        background-color: #f8fafc;
        border-color: #cbd5e1;
        color: #334155;
    }

    /* Animations */
    .dashlytics-preview-bar {
        animation: growUp 0.6s ease-out forwards;
        transform-origin: bottom;
    }

    @keyframes growUp {
        from {
            transform: scaleY(0);
        }
        to {
            transform: scaleY(1);
        }
    }
</style>
