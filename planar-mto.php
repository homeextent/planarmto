<?php
/**
 * Plugin Name: PlanarMTO
 * Version: 2.0.0
 * Description: A full-page PlanarMTO tool integrated into WordPress.
 */

if (!defined('ABSPATH')) {
    exit;
}

/**
 * Register custom rewrite rule for the full-page route
 */
function planarmto_add_rewrite_rules() {
    add_rewrite_rule('^planarmto/?$', 'index.php?planarmto_route=1', 'top');
}
add_action('init', 'planarmto_add_rewrite_rules');

/**
 * Register query variable
 */
function planarmto_query_vars($vars) {
    $vars[] = 'planarmto_route';
    return $vars;
}
add_filter('query_vars', 'planarmto_query_vars');

/**
 * Handle the custom route
 */
function planarmto_template_redirect() {
    if (get_query_var('planarmto_route')) {
        $dist_path = plugin_dir_path(__FILE__) . 'dist/index.html';
        $dist_url  = plugin_dir_url(__FILE__) . 'dist/';

        if (file_exists($dist_path)) {
            $html = file_get_contents($dist_path);

            // Replace relative asset references with absolute plugin URLs
            $html = str_replace('./assets/', $dist_url . 'assets/', $html);
            $html = str_replace('="assets/', '="' . $dist_url . 'assets/', $html);
            $html = str_replace('="/assets/', '="' . $dist_url . 'assets/', $html);

            status_header(200);
            header('Content-Type: text/html; charset=utf-8');
            echo $html;
            exit;
        } else {
            wp_die('PlanarMTO build directory (dist/) not found. Please run "npm run build" and ensure the dist folder is uploaded.');
        }
    }
}
add_action('template_redirect', 'planarmto_template_redirect');

/**
 * Flush rewrite rules on activation and deactivation
 */
function planarmto_activate() {
    planarmto_add_rewrite_rules();
    flush_rewrite_rules();
}
register_activation_hook(__FILE__, 'planarmto_activate');

function planarmto_deactivate() {
    flush_rewrite_rules();
}
register_deactivation_hook(__FILE__, 'planarmto_deactivate');

/**
 * Add Admin Menu Item
 */
function planarmto_admin_menu() {
    add_menu_page(
        'PlanarMTO',
        'PlanarMTO',
        'manage_options',
        'planarmto-admin',
        'planarmto_admin_page',
        'dashicons-layout',
        25
    );
}
add_action('admin_menu', 'planarmto_admin_menu');

function planarmto_admin_page() {
    ?>
    <div class="wrap">
        <h1>PlanarMTO Dashboard</h1>
        <div class="card" style="max-width: 500px; padding: 20px; margin-top: 20px;">
            <h2>Launch Tool</h2>
            <p>Click the button below to open the PlanarMTO tool in full-screen mode.</p>
            <p>
                <a href="<?php echo home_url('/planarmto'); ?>" target="_blank" class="button button-primary button-large">
                    Launch PlanarMTO
                </a>
            </p>
            <p><small>Route: <code><?php echo home_url('/planarmto'); ?></code></small></p>
        </div>
    </div>
    <?php
}
