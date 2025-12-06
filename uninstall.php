<?php
/**
 * Dashlytics Uninstall
 *
 * Wird ausgeführt wenn das Plugin deinstalliert wird.
 * Löscht alle Plugin-Daten aus der Datenbank.
 *
 * @package Dashlytics
 * @since 1.0.0
 */

// Sicherheitscheck - nur ausführen wenn WordPress die Deinstallation durchführt
if (!defined('WP_UNINSTALL_PLUGIN')) {
    exit;
}

// Plugin Optionen löschen
delete_option('dashlytics_settings');

// Alte Optionen aus Version 0.3 löschen (falls vorhanden)
delete_option('tokenauth');
delete_option('apiurl');
delete_option('siteidarl');

// Capabilities entfernen
$role = get_role('administrator');
if ($role) {
    $role->remove_cap('manage_dashlytics');
}

// Transients löschen (falls vorhanden)
delete_transient('dashlytics_analytics_cache');

// Multisite Unterstützung
if (is_multisite()) {
    global $wpdb;
    
    $blog_ids = $wpdb->get_col("SELECT blog_id FROM $wpdb->blogs");
    
    foreach ($blog_ids as $blog_id) {
        switch_to_blog($blog_id);
        
        delete_option('dashlytics_settings');
        delete_option('tokenauth');
        delete_option('apiurl');
        delete_option('siteidarl');
        
        restore_current_blog();
    }
}

