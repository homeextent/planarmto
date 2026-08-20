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

            // Inject Authentication Config
            $config_script = '<script>
              window.planarMTOConfig = {
                restUrl: "' . esc_url_raw(rest_url('planarmto/v1/')) . '",
                nonce: "' . wp_create_nonce('wp_rest') . '",
                currentUserId: ' . get_current_user_id() . '
              };
            </script>';
            $html = str_replace('</head>', $config_script . '</head>', $html);

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
    global $wpdb;
    $table_name = "{$wpdb->prefix}planarmto_projects";
    $charset_collate = $wpdb->get_charset_collate();

    $sql = "CREATE TABLE $table_name (
        id BIGINT(20) UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
        project_uuid VARCHAR(64) NOT NULL,
        tenant_id BIGINT(20) UNSIGNED NOT NULL,
        project_name VARCHAR(255) NOT NULL,
        project_number VARCHAR(64) DEFAULT '',
        description TEXT NULL,
        room_count INT(11) DEFAULT 0,
        gross_sf FLOAT DEFAULT 0,
        net_sf FLOAT DEFAULT 0,
        estimated_total DECIMAL(10,2) DEFAULT 0.00,
        project_state LONGTEXT NOT NULL,
        created_at DATETIME NOT NULL,
        updated_at DATETIME NOT NULL,
        KEY tenant_id (tenant_id),
        KEY project_uuid (project_uuid)
    ) $charset_collate;";

    require_once(ABSPATH . 'wp-admin/includes/upgrade.php');
    dbDelta($sql);

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

/**
 * Register REST API Routes
 */
add_action('rest_api_init', function () {
    // GET Projects
    register_rest_route('planarmto/v1', '/projects', [
        'methods'  => 'GET',
        'callback' => 'planarmto_get_projects',
        'permission_callback' => 'planarmto_rest_permission_check',
    ]);

    // POST Projects (Save/Update)
    register_rest_route('planarmto/v1', '/projects', [
        'methods'  => 'POST',
        'callback' => 'planarmto_save_project',
        'permission_callback' => 'planarmto_rest_permission_check',
    ]);

    // DELETE Project
    register_rest_route('planarmto/v1', '/projects/(?P<uuid>[a-zA-Z0-9_\-]+)', [
        'methods'  => 'DELETE',
        'callback' => 'planarmto_delete_project',
        'permission_callback' => 'planarmto_rest_permission_check',
    ]);

    // GET Branding
    register_rest_route('planarmto/v1', '/branding', [
        'methods'  => 'GET',
        'callback' => 'planarmto_get_branding',
        'permission_callback' => 'planarmto_rest_permission_check',
    ]);

    // POST Branding
    register_rest_route('planarmto/v1', '/branding', [
        'methods'  => 'POST',
        'callback' => 'planarmto_update_branding',
        'permission_callback' => 'planarmto_rest_permission_check',
    ]);
});

/**
 * Permission Callback
 */
function planarmto_rest_permission_check() {
    return is_user_logged_in();
}

/**
 * REST Callbacks
 */

function planarmto_get_projects() {
    global $wpdb;
    $tenant_id = get_current_user_id();
    $table_name = "{$wpdb->prefix}planarmto_projects";

    $results = $wpdb->get_results($wpdb->prepare(
        "SELECT * FROM $table_name WHERE tenant_id = %d ORDER BY updated_at DESC",
        $tenant_id
    ), ARRAY_A);

    return rest_ensure_response($results);
}

function planarmto_save_project($request) {
    global $wpdb;
    $tenant_id = get_current_user_id();
    $table_name = "{$wpdb->prefix}planarmto_projects";
    $params = $request->get_json_params();

    $uuid = $params['project_uuid'] ?? '';
    if (!$uuid) {
        return new WP_Error('missing_uuid', 'Project UUID is required', ['status' => 400]);
    }

    $data = [
        'project_uuid'    => $uuid,
        'tenant_id'       => $tenant_id,
        'project_name'    => $params['project_name'] ?? 'Untitled Project',
        'project_number'  => $params['project_number'] ?? '',
        'description'     => $params['description'] ?? '',
        'room_count'      => intval($params['room_count'] ?? 0),
        'gross_sf'        => floatval($params['gross_sf'] ?? 0),
        'net_sf'          => floatval($params['net_sf'] ?? 0),
        'estimated_total' => floatval($params['estimated_total'] ?? 0),
        'project_state'   => $params['project_state'] ?? '{}',
        'updated_at'      => current_time('mysql'),
    ];

    $existing = $wpdb->get_row($wpdb->prepare(
        "SELECT id FROM $table_name WHERE project_uuid = %s AND tenant_id = %d",
        $uuid, $tenant_id
    ));

    if ($existing) {
        $wpdb->update($table_name, $data, ['id' => $existing->id]);
    } else {
        $data['created_at'] = current_time('mysql');
        $wpdb->insert($table_name, $data);
    }

    return rest_ensure_response(['success' => true]);
}

function planarmto_delete_project($request) {
    global $wpdb;
    $tenant_id = get_current_user_id();
    $table_name = "{$wpdb->prefix}planarmto_projects";
    $uuid = $request['uuid'];

    $result = $wpdb->delete($table_name, [
        'project_uuid' => $uuid,
        'tenant_id'    => $tenant_id
    ]);

    return rest_ensure_response(['success' => (bool)$result]);
}

function planarmto_get_branding() {
    $tenant_id = get_current_user_id();
    $branding = get_user_meta($tenant_id, 'planarmto_company_branding', true);
    return rest_ensure_response($branding ?: new stdClass());
}

function planarmto_update_branding($request) {
    $tenant_id = get_current_user_id();
    $params = $request->get_json_params();
    update_user_meta($tenant_id, 'planarmto_company_branding', $params);
    return rest_ensure_response(['success' => true]);
}
