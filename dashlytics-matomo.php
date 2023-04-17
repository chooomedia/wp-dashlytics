<?php
/** 
 * Plugin Name: Dashlytics Dashboard Statistics Widget for Matomo
 * Plugin URI: https://github.com/chooomedia/wp-dashlytics
 * Description: Displays Matomo statistics on the WordPress dashboard. Needs Setup.
 * Version: 0.3
 * Author: Christopher Matt
 * Author URI: http://chooomedia.de
 * License: GPL2
 */

// Exit if accessed directly.
if (!defined('ABSPATH')) {
    exit;
}

define( 'DASHLYTICS_PLUGIN_URL', plugin_dir_url(__FILE__) );
define( 'DASHLYTICS_VERSION', '0.3.0' );

function dashlytics_options_data(WP_REST_Request $request) {
    $setValues = $request->get_param( 'tokenauth' )
                && $request->get_param( 'apiurl' )
                && $request->get_param( 'siteidarl' );

    if ($setValues) {
        $data = array(
            'tokenauth' => update_option('tokenauth', $request->get_param( 'tokenauth' )),
            'apiurl' => update_option('apiurl', $request->get_param( 'apiurl' )),
            'siteidarl' => update_option('siteidarl', $request->get_param( 'siteidarl' ))
        );
    } else {
        $data = array(
            'tokenauth' => get_option('tokenauth'),
            'apiurl' => get_option('apiurl'),
            'siteidarl' => get_option('siteidarl')
        );
    }

    return rest_ensure_response( $data );
}

function dashlytics_register_routes() {
    register_rest_route( 
        'dashlytics/v1', '/options', array(
        'methods' => array('GET', 'POST'),
        'callback' => 'dashlytics_options_data',
        'permission_callback' => '__return_true',
    ) );
}
add_action( 'rest_api_init', 'dashlytics_register_routes' );


function dashlytics_enqueue_scripts() {
    global $pagenow;

    if($pagenow === 'admin.php') {
        wp_enqueue_script( 'dashlytics-settings', DASHLYTICS_PLUGIN_URL . '/app/public/build/settings.js', [], filemtime( DASHLYTICS_PLUGIN_URL . '/app/public/build/settings.js' ), true );
    }
    if ($pagenow === 'index.php') {
        wp_enqueue_script( 'dashlytics-widget', DASHLYTICS_PLUGIN_URL . '/app/public/build/dashboardwidget.js', [], filemtime( DASHLYTICS_PLUGIN_URL . '/app/public/build/dashboardwidget.js' ), true );
    }
    //wp_enqueue_script( 'jspdf', DASHLYTICS_PLUGIN_URL . 'jspdf.min.js', [], DASHLYTICS_VERSION, true );
    wp_enqueue_style( 'dashlytics-style', DASHLYTICS_PLUGIN_URL . '/app/public/build/bundle.css', [], filemtime( DASHLYTICS_PLUGIN_URL . '/app/public/build/bundle.css' ) );
}

add_action('admin_enqueue_scripts', 'dashlytics_enqueue_scripts');

// Eine neue Seite erstellen
add_action('admin_menu', 'dashlytics_add_admin_page');
function dashlytics_add_admin_page() {
    add_menu_page(
        'Dashlytics Matomo Widgets',
        'Dashlytics',
        'manage_options',
        'dashlytics-matomo',
        'dashlytics_render_admin_page',
        'dashicons-tickets',
        80
    );
}

// Die Funktionen zum Rendern der Seite und des Widgets
function dashlytics_render_admin_page() {
    echo '<div id="dashlytics-settings"></div>';
}

add_action('wp_dashboard_setup', function () {
    wp_add_dashboard_widget(
      'dashlytics-widget-wrapper',
      __( 'Dashlytics Widget Matomo', 'wp' ),
      'dashlytics_render_widget_output'
    );
});

function dashlytics_render_widget_output() {
    echo '<div id="dashlytics-widget"></div>';
}

function json_basic_auth_handler( $user ) {
	global $wp_json_basic_auth_error;
	$wp_json_basic_auth_error = null;

	// Don't authenticate twice
	if ( ! empty( $user ) ) {
		return $user;
	}

	// Check that we're trying to authenticate
	if ( !isset( $_SERVER['PHP_AUTH_USER'] ) ) {
		return $user;
	}

	$username = $_SERVER['PHP_AUTH_USER'];
	$password = $_SERVER['PHP_AUTH_PW'];

	/**
	 * In multi-site, wp_authenticate_spam_check filter is run on authentication. This filter calls
	 * get_currentuserinfo which in turn calls the determine_current_user filter. This leads to infinite
	 * recursion and a stack overflow unless the current function is removed from the determine_current_user
	 * filter during authentication.
	 */
	remove_filter( 'determine_current_user', 'json_basic_auth_handler', 20 );

	$user = wp_authenticate( $username, $password );

	add_filter( 'determine_current_user', 'json_basic_auth_handler', 20 );

	if ( is_wp_error( $user ) ) {
		$wp_json_basic_auth_error = $user;
		return null;
	}

	$wp_json_basic_auth_error = true;

	return $user->ID;
}
add_filter( 'determine_current_user', 'json_basic_auth_handler', 20 );

function json_basic_auth_error( $error ) {
	// Passthrough other errors
	if ( ! empty( $error ) ) {
		return $error;
	}
	global $wp_json_basic_auth_error;
	return $wp_json_basic_auth_error;
}
add_filter( 'rest_authentication_errors', 'json_basic_auth_error' );

function dashlytics_register_auth_routes() {
    register_rest_route( 
        'dashlytics/v1', '/options', array(
        'methods' => 'GET',
        'callback' => 'dashlytics_options_auth',
        'args' => array(
            'juser' => array(
              'name' => 'value1'
            ),
            'jpass' => array(
              'value' => '1234'
            ),
          )
    ) );
}
add_action( 'rest_api_init', 'dashlytics_register_auth_routes' );

function dashlytics_options_auth(WP_REST_Request $request) {
    $id = $request->get_param( 'id' );
    $user = json_basic_auth_handler( null );
    $juser = $request->get_param( 'juser' );
    $jpass = $request->get_param( 'jpass' );

	$username = $_SERVER['PHP_AUTH_USER'];
	$password = $_SERVER['PHP_AUTH_PW'];

    return array(
        'id' => $id,
        'juser' => $username,
        'jpass' => $password
      );
}