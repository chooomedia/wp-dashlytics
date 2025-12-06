<?php
/** 
 * Plugin Name: Dashlytics - Matomo Analytics Widget
 * Plugin URI: https://github.com/chooomedia/wp-dashlytics
 * Description: Optimieren Sie Ihren Website-Erfolg mit Matomo Analytics direkt im Dashboard. Einfache Integration, datenbasierte Entscheidungen.
 * Version: 0.7.8
 * Requires at least: 5.8
 * Requires PHP: 7.4
 * Author: Christopher Matt
 * Author URI: https://chooomedia.de
 * License: GPL-2.0-or-later
 * License URI: https://www.gnu.org/licenses/gpl-2.0.html
 * Text Domain: dashlytics
 * Domain Path: /languages
 */

// Sicherheit: Direkten Zugriff verhindern
if (!defined('ABSPATH')) {
    exit;
}

// Plugin Konstanten
define('DASHLYTICS_VERSION', '0.7.8');
define('DASHLYTICS_PLUGIN_URL', plugin_dir_url(__FILE__));
define('DASHLYTICS_PLUGIN_PATH', plugin_dir_path(__FILE__));
define('DASHLYTICS_PLUGIN_BASENAME', plugin_basename(__FILE__));

/**
 * Plugin-Klasse für saubere Struktur
 */
class Dashlytics {
    
    /**
     * Singleton Instanz
     */
    private static $instance = null;
    
    /**
     * Option Name für Settings
     */
    const OPTION_NAME = 'dashlytics_settings';
    
    /**
     * Singleton Pattern
     */
    public static function get_instance() {
        if (null === self::$instance) {
            self::$instance = new self();
        }
        return self::$instance;
    }
    
    /**
     * Konstruktor
     */
    private function __construct() {
        $this->init_hooks();
    }
    
    /**
     * Initialisiere alle Hooks
     */
    private function init_hooks() {
        // Admin Hooks
        add_action('admin_menu', array($this, 'add_admin_menu'));
        add_action('admin_enqueue_scripts', array($this, 'enqueue_admin_scripts'));
        add_action('wp_dashboard_setup', array($this, 'add_dashboard_widget'));
        
        // REST API
        add_action('rest_api_init', array($this, 'register_rest_routes'));
        
        // Plugin Activation/Deactivation
        register_activation_hook(__FILE__, array($this, 'activate'));
        register_deactivation_hook(__FILE__, array($this, 'deactivate'));
        
        // Settings Link in Plugin Liste
        add_filter('plugin_action_links_' . DASHLYTICS_PLUGIN_BASENAME, array($this, 'add_settings_link'));
        
        // Textdomain laden
        add_action('init', array($this, 'load_textdomain'));
    }
    
    /**
     * Textdomain für Übersetzungen laden
     */
    public function load_textdomain() {
        load_plugin_textdomain('dashlytics', false, dirname(DASHLYTICS_PLUGIN_BASENAME) . '/languages');
    }
    
    /**
     * Plugin Aktivierung
     */
    public function activate() {
        // Standard-Optionen setzen
        $default_options = array(
            'matomo_url' => '',
            'site_id' => 1,
            'token_auth' => '',
            'chart_type' => 'line',
            'chart_color' => '#2271b1',
            'date_range' => 30,
            'auto_detect_matomo' => true
        );
        
        if (!get_option(self::OPTION_NAME)) {
            add_option(self::OPTION_NAME, $default_options);
        }
        
        // Capabilities setzen
        $role = get_role('administrator');
        if ($role) {
            $role->add_cap('manage_dashlytics');
        }
        
        flush_rewrite_rules();
    }
    
    /**
     * Plugin Deaktivierung
     */
    public function deactivate() {
        flush_rewrite_rules();
    }
    
    /**
     * Settings Link zur Plugin-Liste hinzufügen
     */
    public function add_settings_link($links) {
        $settings_link = '<a href="' . admin_url('admin.php?page=dashlytics') . '">' . 
                         __('Einstellungen', 'dashlytics') . '</a>';
        array_unshift($links, $settings_link);
        return $links;
    }
    
    /**
     * Admin Menü hinzufügen
     */
    public function add_admin_menu() {
        add_menu_page(
            __('Dashlytics Analytics', 'dashlytics'),
            __('Dashlytics', 'dashlytics'),
            'manage_options',
            'dashlytics',
            array($this, 'render_settings_page'),
            'dashicons-chart-area',
            80
        );
    }
    
    /**
     * Admin Scripts und Styles laden
     */
    public function enqueue_admin_scripts($hook) {
        // Settings Seite
        if ($hook === 'toplevel_page_dashlytics') {
            wp_enqueue_style(
                'dashlytics-admin',
                DASHLYTICS_PLUGIN_URL . 'assets/css/admin.css',
                array(),
                DASHLYTICS_VERSION
            );
            
            wp_enqueue_script(
                'dashlytics-settings',
                DASHLYTICS_PLUGIN_URL . 'app/public/build/settings.js',
                array(),
                DASHLYTICS_VERSION,
                true
            );
            
            wp_localize_script('dashlytics-settings', 'dashlyticsAdmin', array(
                'restUrl' => rest_url('dashlytics/v1/'),
                'nonce' => wp_create_nonce('wp_rest'),
                'ajaxUrl' => admin_url('admin-ajax.php'),
                'pluginUrl' => DASHLYTICS_PLUGIN_URL,
                'matomoDetected' => $this->detect_matomo_plugin(),
                'i18n' => array(
                    'saveSuccess' => __('Einstellungen gespeichert!', 'dashlytics'),
                    'saveError' => __('Fehler beim Speichern.', 'dashlytics'),
                    'connectionSuccess' => __('Verbindung erfolgreich!', 'dashlytics'),
                    'connectionError' => __('Verbindung fehlgeschlagen.', 'dashlytics'),
                    'tokenGenerated' => __('Token automatisch erkannt!', 'dashlytics'),
                )
            ));
        }
        
        // Dashboard
        if ($hook === 'index.php') {
            wp_enqueue_style(
                'dashlytics-widget',
                DASHLYTICS_PLUGIN_URL . 'assets/css/widget.css',
                array(),
                DASHLYTICS_VERSION
            );
            
            wp_enqueue_script(
                'dashlytics-widget',
                DASHLYTICS_PLUGIN_URL . 'app/public/build/dashboardwidget.js',
                array(),
                DASHLYTICS_VERSION,
                true
            );
            
            // Site Logo holen
            $custom_logo_id = get_theme_mod('custom_logo');
            $site_logo = $custom_logo_id ? wp_get_attachment_image_url($custom_logo_id, 'medium') : '';
            
            // Favicon holen (Site Icon aus Customizer)
            $site_icon_id = get_option('site_icon');
            $site_favicon = $site_icon_id ? wp_get_attachment_image_url($site_icon_id, 'full') : '';
            
            wp_localize_script('dashlytics-widget', 'dashlyticsWidget', array(
                'restUrl' => rest_url('dashlytics/v1/'),
                'nonce' => wp_create_nonce('wp_rest'),
                'settings' => $this->get_settings(),
                'siteTitle' => get_bloginfo('name'),
                'siteUrl' => home_url(),
                'siteLogo' => $site_logo,
                'siteFavicon' => $site_favicon,
                'pluginUrl' => DASHLYTICS_PLUGIN_URL,
                'i18n' => array(
                    'visits' => __('Besuche', 'dashlytics'),
                    'pageviews' => __('Seitenaufrufe', 'dashlytics'),
                    'visitors' => __('Besucher', 'dashlytics'),
                    'bounceRate' => __('Absprungrate', 'dashlytics'),
                    'avgTime' => __('Ø Verweildauer', 'dashlytics'),
                    'loading' => __('Lade Daten...', 'dashlytics'),
                    'noData' => __('Keine Daten verfügbar', 'dashlytics'),
                    'error' => __('Fehler beim Laden', 'dashlytics'),
                    'configure' => __('Bitte konfigurieren Sie das Plugin', 'dashlytics'),
                )
            ));
        }
    }
    
    /**
     * Prüfe ob Matomo Plugin installiert ist
     */
    private function detect_matomo_plugin() {
        // Lade Plugin-Funktionen falls noch nicht verfügbar
        if (!function_exists('is_plugin_active')) {
            include_once(ABSPATH . 'wp-admin/includes/plugin.php');
        }
        
        // Prüfe auf Matomo for WordPress Plugin
        if (function_exists('is_plugin_active') && is_plugin_active('matomo/matomo.php')) {
            return array(
                'installed' => true,
                'type' => 'matomo-for-wordpress',
                'restEndpoint' => home_url('/?rest_route=/matomo/v1/api/')
            );
        }
        
        // Prüfe auf WP-Matomo Integration
        if (class_exists('WpMatomo')) {
            return array(
                'installed' => true,
                'type' => 'wp-matomo',
                'restEndpoint' => home_url('/?rest_route=/matomo/v1/api/')
            );
        }
        
        return array(
            'installed' => false,
            'type' => null,
            'restEndpoint' => null
        );
    }
    
    /**
     * Settings abrufen
     */
    public function get_settings() {
        $defaults = array(
            'matomo_url' => '',
            'site_id' => 1,
            'token_auth' => '',
            'chart_type' => 'line',
            'chart_color' => '#2271b1',
            'date_range' => 30,
            'auto_detect_matomo' => true
        );
        
        $settings = get_option(self::OPTION_NAME, $defaults);
        return wp_parse_args($settings, $defaults);
    }
    
    /**
     * REST API Routen registrieren
     */
    public function register_rest_routes() {
        // Settings Route
        register_rest_route('dashlytics/v1', '/settings', array(
            array(
                'methods' => WP_REST_Server::READABLE,
                'callback' => array($this, 'rest_get_settings'),
                'permission_callback' => array($this, 'check_admin_permission'),
            ),
            array(
                'methods' => WP_REST_Server::CREATABLE,
                'callback' => array($this, 'rest_save_settings'),
                'permission_callback' => array($this, 'check_admin_permission'),
            ),
        ));
        
        // Analytics Data Route
        register_rest_route('dashlytics/v1', '/analytics', array(
            'methods' => WP_REST_Server::READABLE,
            'callback' => array($this, 'rest_get_analytics'),
            'permission_callback' => array($this, 'check_view_permission'),
            'args' => array(
                'period' => array(
                    'default' => 'day',
                    'sanitize_callback' => 'sanitize_text_field',
                ),
                'date' => array(
                    'default' => 'last30',
                    'sanitize_callback' => 'sanitize_text_field',
                ),
            ),
        ));
        
        // Connection Test Route
        register_rest_route('dashlytics/v1', '/test-connection', array(
            'methods' => WP_REST_Server::CREATABLE,
            'callback' => array($this, 'rest_test_connection'),
            'permission_callback' => array($this, 'check_admin_permission'),
        ));
        
        // Auto-Detect Token Route
        register_rest_route('dashlytics/v1', '/detect-token', array(
            'methods' => WP_REST_Server::READABLE,
            'callback' => array($this, 'rest_detect_token'),
            'permission_callback' => array($this, 'check_admin_permission'),
        ));
    }
    
    /**
     * Permission Check für Admins
     */
    public function check_admin_permission() {
        return current_user_can('manage_options');
    }
    
    /**
     * Permission Check für Dashboard View
     */
    public function check_view_permission() {
        return current_user_can('read');
    }
    
    /**
     * REST: Settings abrufen
     */
    public function rest_get_settings($request) {
        $settings = $this->get_settings();
        
        // Token maskiert zurückgeben (für Admin-Anzeige)
        $settings['token_auth_set'] = !empty($settings['token_auth']);
        // Token bleibt für maskierte Anzeige erhalten
        
        return rest_ensure_response($settings);
    }
    
    /**
     * REST: Settings speichern
     */
    public function rest_save_settings($request) {
        $params = $request->get_json_params();
        $settings = $this->get_settings();
        
        // Sanitize und validiere
        if (isset($params['matomo_url'])) {
            $settings['matomo_url'] = esc_url_raw($params['matomo_url']);
        }
        
        if (isset($params['site_id'])) {
            $settings['site_id'] = absint($params['site_id']);
        }
        
        if (isset($params['token_auth'])) {
            $settings['token_auth'] = sanitize_text_field($params['token_auth']);
        }
        
        if (isset($params['chart_type'])) {
            $allowed_types = array('line', 'bar', 'pie', 'doughnut');
            if (in_array($params['chart_type'], $allowed_types)) {
                $settings['chart_type'] = $params['chart_type'];
            }
        }
        
        if (isset($params['chart_color'])) {
            $settings['chart_color'] = sanitize_hex_color($params['chart_color']);
        }
        
        if (isset($params['date_range'])) {
            $settings['date_range'] = absint($params['date_range']);
        }
        
        if (isset($params['auto_detect_matomo'])) {
            $settings['auto_detect_matomo'] = (bool) $params['auto_detect_matomo'];
        }
        
        update_option(self::OPTION_NAME, $settings);
        
        return rest_ensure_response(array(
            'success' => true,
            'message' => __('Einstellungen gespeichert', 'dashlytics'),
        ));
    }
    
    /**
     * REST: Analytics Daten abrufen
     */
    public function rest_get_analytics($request) {
        $settings = $this->get_settings();
        
        if (empty($settings['matomo_url']) && empty($settings['token_auth'])) {
            // Versuche Matomo for WordPress zu nutzen
            $matomo = $this->detect_matomo_plugin();
            if ($matomo['installed']) {
                return $this->get_matomo_wp_analytics($request);
            }
            
            return new WP_Error(
                'not_configured',
                __('Dashlytics ist noch nicht konfiguriert.', 'dashlytics'),
                array('status' => 400)
            );
        }
        
        $period = $request->get_param('period');
        $date = $request->get_param('date');
        
        // Baue Matomo API URL
        $api_url = trailingslashit($settings['matomo_url']) . 'index.php';
        
        // Für Zeiträume mit Komma (z.B. "2025-11-06,2025-12-06") nutze range
        $use_range = strpos($date, ',') !== false;
        
        $query_args = array(
            'module' => 'API',
            'method' => 'VisitsSummary.get',
            'idSite' => $settings['site_id'],
            'period' => $use_range ? 'day' : $period,
            'date' => $use_range ? str_replace(',', ',', $date) : $date,
            'format' => 'JSON',
            'token_auth' => $settings['token_auth'],
        );
        
        $response = wp_remote_get(add_query_arg($query_args, $api_url), array(
            'timeout' => 15,
            'sslverify' => true,
        ));
        
        if (is_wp_error($response)) {
            return new WP_Error(
                'api_error',
                $response->get_error_message(),
                array('status' => 500)
            );
        }
        
        $body = wp_remote_retrieve_body($response);
        $data = json_decode($body, true);
        
        if (isset($data['result']) && $data['result'] === 'error') {
            return new WP_Error(
                'matomo_error',
                $data['message'],
                array('status' => 400)
            );
        }
        
        // Wenn wir Tagesdaten haben, formatiere sie für den Chart
        if ($use_range && is_array($data) && !isset($data['nb_visits'])) {
            // Matomo gibt ein Objekt mit Datum als Key zurück
            // Konvertiere zu Array mit Datum-Feld
            $formatted = array();
            foreach ($data as $dateKey => $dayData) {
                if (is_array($dayData)) {
                    $dayData['date'] = $dateKey;
                    $formatted[] = $dayData;
                }
            }
            return rest_ensure_response($formatted);
        }
        
        return rest_ensure_response($data);
    }
    
    /**
     * Analytics von Matomo for WordPress Plugin holen
     */
    private function get_matomo_wp_analytics($request) {
        $date = $request->get_param('date');
        
        // Für Zeiträume mit Komma (z.B. "2025-11-06,2025-12-06") nutze range
        $use_range = strpos($date, ',') !== false;
        
        // Nutze die Matomo API direkt
        if (class_exists('\WpMatomo\Site') && class_exists('\WpMatomo\Bootstrap')) {
            try {
                $site = new \WpMatomo\Site();
                $site_id = $site->get_current_matomo_site_id();
                
                if (empty($site_id)) {
                    return new WP_Error(
                        'no_site_id',
                        __('Keine Matomo Site ID gefunden.', 'dashlytics'),
                        array('status' => 400)
                    );
                }
                
                // Bootstrap Matomo
                \WpMatomo\Bootstrap::do_bootstrap();
                
                // API Parameter für direkte Matomo API
                $api_params = array(
                    'idSite' => $site_id,
                    'period' => $use_range ? 'day' : 'range',
                    'date' => $date,
                );
                
                // Matomo API direkt aufrufen
                $data = \Piwik\API\Request::processRequest('VisitsSummary.get', $api_params);
                
                // DataTable zu Array konvertieren
                if ($data instanceof \Piwik\DataTable\Map) {
                    // Multi-Period Daten (Tag für Tag)
                    $result = array();
                    foreach ($data->getDataTables() as $label => $table) {
                        $row = $table->getFirstRow();
                        if ($row) {
                            $dayData = $row->getColumns();
                            $dayData['date'] = $label;
                            $result[] = $dayData;
                        } else {
                            // Leerer Tag
                            $result[] = array(
                                'date' => $label,
                                'nb_visits' => 0,
                                'nb_uniq_visitors' => 0,
                                'nb_pageviews' => 0,
                                'nb_actions' => 0,
                                'bounce_rate' => 0,
                                'avg_time_on_site' => 0,
                            );
                        }
                    }
                    return rest_ensure_response($result);
                    
                } elseif ($data instanceof \Piwik\DataTable) {
                    // Einzelne Periode
                    $row = $data->getFirstRow();
                    if ($row) {
                        return rest_ensure_response($row->getColumns());
                    }
                    return rest_ensure_response(array(
                        'nb_visits' => 0,
                        'nb_uniq_visitors' => 0,
                        'nb_pageviews' => 0,
                        'nb_actions' => 0,
                        'bounce_rate' => 0,
                        'avg_time_on_site' => 0,
                    ));
                }
                
                // Falls schon ein Array
                if (is_array($data)) {
                    return rest_ensure_response($data);
                }
                
                return rest_ensure_response($data);
                
            } catch (\Exception $e) {
                error_log('Dashlytics: Matomo API Fehler - ' . $e->getMessage());
                return new WP_Error(
                    'matomo_api_error',
                    'Matomo API Fehler: ' . $e->getMessage(),
                    array('status' => 500)
                );
            }
        }
        
        // Matomo nicht verfügbar
        return new WP_Error(
            'matomo_not_available',
            __('Matomo for WordPress ist nicht korrekt konfiguriert.', 'dashlytics'),
            array('status' => 400)
        );
    }
    
    /**
     * REST: Verbindung testen
     */
    public function rest_test_connection($request) {
        $params = $request->get_json_params();
        
        $matomo_url = isset($params['matomo_url']) ? esc_url_raw($params['matomo_url']) : '';
        $token_auth = isset($params['token_auth']) ? sanitize_text_field($params['token_auth']) : '';
        $site_id = isset($params['site_id']) ? absint($params['site_id']) : 1;
        
        if (empty($matomo_url) || empty($token_auth)) {
            return new WP_Error(
                'missing_params',
                __('URL und Token sind erforderlich.', 'dashlytics'),
                array('status' => 400)
            );
        }
        
        // Teste die Verbindung
        $api_url = trailingslashit($matomo_url) . 'index.php';
        $query_args = array(
            'module' => 'API',
            'method' => 'API.getMatomoVersion',
            'format' => 'JSON',
            'token_auth' => $token_auth,
        );
        
        $response = wp_remote_get(add_query_arg($query_args, $api_url), array(
            'timeout' => 10,
            'sslverify' => true,
        ));
        
        if (is_wp_error($response)) {
            return rest_ensure_response(array(
                'success' => false,
                'message' => $response->get_error_message(),
            ));
        }
        
        $body = wp_remote_retrieve_body($response);
        $data = json_decode($body, true);
        
        if (isset($data['result']) && $data['result'] === 'error') {
            return rest_ensure_response(array(
                'success' => false,
                'message' => $data['message'],
            ));
        }
        
        if (isset($data['value'])) {
            return rest_ensure_response(array(
                'success' => true,
                'message' => sprintf(__('Verbunden mit Matomo %s', 'dashlytics'), $data['value']),
                'version' => $data['value'],
            ));
        }
        
        return rest_ensure_response(array(
            'success' => false,
            'message' => __('Unbekannte Antwort von Matomo', 'dashlytics'),
        ));
    }
    
    /**
     * REST: Token automatisch erkennen (für Matomo for WordPress)
     */
    public function rest_detect_token($request) {
        // Lade Plugin-Funktionen falls noch nicht verfügbar
        if (!function_exists('is_plugin_active')) {
            include_once(ABSPATH . 'wp-admin/includes/plugin.php');
        }
        
        // Prüfe ob Matomo for WordPress aktiv ist
        if (!function_exists('is_plugin_active') || !is_plugin_active('matomo/matomo.php')) {
            return rest_ensure_response(array(
                'success' => false,
                'message' => __('Matomo for WordPress ist nicht installiert.', 'dashlytics'),
            ));
        }
        
        // Versuche Token aus Matomo Settings zu holen
        $matomo_settings = get_option('matomo-global-settings');
        
        if ($matomo_settings && isset($matomo_settings['token_auth'])) {
            return rest_ensure_response(array(
                'success' => true,
                'token' => $matomo_settings['token_auth'],
                'message' => __('Token automatisch erkannt!', 'dashlytics'),
            ));
        }
        
        // Alternative: Generiere einen neuen Token für den aktuellen User
        if (class_exists('WpMatomo\User\Sync')) {
            try {
                $user_sync = new \WpMatomo\User\Sync();
                // Token kann hier generiert werden
                return rest_ensure_response(array(
                    'success' => true,
                    'message' => __('Bitte nutzen Sie die Matomo REST API ohne Token.', 'dashlytics'),
                    'use_wp_auth' => true,
                ));
            } catch (Exception $e) {
                // Fallback
            }
        }
        
        return rest_ensure_response(array(
            'success' => false,
            'message' => __('Token konnte nicht automatisch erkannt werden.', 'dashlytics'),
        ));
    }
    
    /**
     * Dashboard Widget hinzufügen
     */
    public function add_dashboard_widget() {
        wp_add_dashboard_widget(
            'dashlytics_widget',
            __('📊 Dashlytics - Website Statistiken', 'dashlytics'),
            array($this, 'render_dashboard_widget'),
            null,
            null,
            'normal',
            'high'
        );
    }
    
    /**
     * Dashboard Widget rendern
     */
    public function render_dashboard_widget() {
        $settings = $this->get_settings();
        $matomo = $this->detect_matomo_plugin();
        
        if (empty($settings['matomo_url']) && empty($settings['token_auth']) && !$matomo['installed']) {
            echo '<div class="dashlytics-setup-notice">';
            echo '<p>' . __('Willkommen bei Dashlytics! Bitte konfigurieren Sie das Plugin.', 'dashlytics') . '</p>';
            echo '<a href="' . admin_url('admin.php?page=dashlytics') . '" class="button button-primary">';
            echo __('Jetzt einrichten', 'dashlytics');
            echo '</a>';
            echo '</div>';
            return;
        }
        
        echo '<div id="dashlytics-widget"></div>';
    }
    
    /**
     * Settings Seite rendern
     */
    public function render_settings_page() {
        ?>
        <div class="wrap dashlytics-wrap">
            <div id="dashlytics-settings"></div>
        </div>
        <?php
    }
}

// Plugin initialisieren
function dashlytics_init() {
    return Dashlytics::get_instance();
}

// Starten
add_action('plugins_loaded', 'dashlytics_init');
