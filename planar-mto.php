<?php
/**
 * Plugin Name: PlanarMTO
 * Version: 2.1.1
 * Description: A full-page PlanarMTO tool integrated into WordPress.
 */

if (!defined('ABSPATH')) {
    exit;
}

/**
 * Access Configuration
 */
define('PLANARMTO_BETA_PASSCODE', 'PlanarBeta2026');

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
        // Disable caching
        nocache_headers();
        if (!defined('DONOTCACHEPAGE')) define('DONOTCACHEPAGE', true);

        $has_access = is_user_logged_in();
        $error = '';

        // Check for passcode submission
        if (!$has_access && isset($_POST['planarmto_passcode'])) {
            if (trim($_POST['planarmto_passcode']) === PLANARMTO_BETA_PASSCODE) {
                setcookie('planarmto_guest_access', '1', time() + (30 * DAY_IN_SECONDS), '/');
                $_COOKIE['planarmto_guest_access'] = '1';
                $has_access = true;
            } else {
                $error = "Invalid access code. Please try again.";
            }
        }

        // Check for cookie access
        if (!$has_access && isset($_COOKIE['planarmto_guest_access']) && $_COOKIE['planarmto_guest_access'] === '1') {
            $has_access = true;
        }

        if (!$has_access) {
            planarmto_serve_passcode_form($error);
            exit;
        }

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
 * Guest Access Form
 */
function planarmto_serve_passcode_form($error = '') {
    status_header(200);
    ?>
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>PlanarMTO Beta Access Required</title>
        <script src="https://cdn.tailwindcss.com"></script>
        <style>
            body { background-color: #020617; color: #f1f5f9; }
        </style>
    </head>
    <body class="flex items-center justify-center min-h-screen p-4">
        <div class="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden p-8">
            <div class="text-center mb-8">
                <div class="w-16 h-16 bg-sky-500/10 border border-sky-500/30 rounded-2xl flex items-center justify-center mx-auto mb-4 text-sky-400">
                    <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                </div>
                <h1 class="text-2xl font-bold text-white mb-2">PlanarMTO Beta</h1>
                <p class="text-slate-400 text-sm">Access to the architectural estimator is currently restricted. Please enter your beta access code to continue.</p>
            </div>

            <form method="POST" class="space-y-4">
                <?php if ($error): ?>
                    <div class="bg-red-500/10 border border-red-500/30 text-red-400 text-xs p-3 rounded-lg flex items-center gap-2">
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" x2="12" y1="8" y2="12"/><line x1="12" x2="12.01" y1="16" y2="16"/></svg>
                        <?php echo esc_html($error); ?>
                    </div>
                <?php endif; ?>

                <div>
                    <label for="passcode" class="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2 ml-1">Beta Access Code</label>
                    <div class="relative group">
                        <input 
                            type="password" 
                            name="planarmto_passcode" 
                            id="passcode" 
                            required 
                            autofocus
                            class="w-full bg-slate-950 border border-slate-800 rounded-xl pl-4 pr-12 py-3 text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-sky-500/50 focus:border-sky-500 transition-all shadow-inner"
                            placeholder="Enter your access code"
                        >
                        <button 
                            type="button"
                            onclick="togglePasswordVisibility()"
                            class="absolute right-3 top-1/2 -translate-y-1/2 p-2 text-slate-500 hover:text-sky-400 transition-colors focus:outline-none"
                            title="Toggle Password Visibility"
                        >
                            <svg id="eye-icon" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>
                            <svg id="eye-off-icon" class="hidden" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9.88 9.88a3 3 0 1 0 4.24 4.24"/><path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68"/><path d="M6.61 6.61A13.52 13.52 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61"/><line x1="2" x2="22" y1="2" y2="22"/></svg>
                        </button>
                    </div>
                </div>

                <button 
                    type="submit" 
                    class="w-full bg-sky-600 hover:bg-sky-500 text-white font-bold py-3 rounded-xl shadow-lg shadow-sky-600/20 transition-all flex items-center justify-center gap-2 group"
                >
                    <span>Submit Access Code</span>
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="group-hover:translate-x-1 transition-transform"><path d="m9 18 6-6-6-6"/></svg>
                </button>
            </form>

            <div class="mt-8 pt-8 border-t border-slate-800 text-center">
                <p class="text-[11px] text-slate-500 uppercase tracking-widest font-semibold">&copy; <?php echo date('Y'); ?> PlanarMTO &bull; The Innovative Group</p>
            </div>
        </div>

        <script>
            function togglePasswordVisibility() {
                const input = document.getElementById('passcode');
                const eyeIcon = document.getElementById('eye-icon');
                const eyeOffIcon = document.getElementById('eye-off-icon');
                
                if (input.type === 'password') {
                    input.type = 'text';
                    eyeIcon.classList.add('hidden');
                    eyeOffIcon.classList.remove('hidden');
                } else {
                    input.type = 'password';
                    eyeIcon.classList.remove('hidden');
                    eyeOffIcon.classList.add('hidden');
                }
            }
        </script>
    </body>
    </html>
    <?php
}

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
    ));

    $formatted_projects = array_map(function($row) {
        return [
            'id' => $row->project_uuid,
            'name' => $row->project_name ?: 'Untitled Project',
            'projectNumber' => $row->project_number ?: '',
            'description' => $row->description ?: '',
            'roomCount' => (int)$row->room_count,
            'grossSf' => (float)$row->gross_sf,
            'netSf' => (float)$row->net_sf,
            'estimatedTotal' => (float)$row->estimated_total,
            'createdAt' => strtotime($row->created_at) * 1000,
            'updatedAt' => strtotime($row->updated_at) * 1000,
            'state' => is_string($row->project_state) ? json_decode($row->project_state, true) : $row->project_state,
        ];
    }, $results);

    return rest_ensure_response($formatted_projects);
}

function planarmto_save_project($request) {
    global $wpdb;
    $tenant_id = get_current_user_id();
    $table_name = "{$wpdb->prefix}planarmto_projects";
    
    // Flexible UUID Extraction
    $uuid = $request->get_param('id') ?: $request->get_param('uuid') ?: $request->get_param('project_uuid');
    if (empty($uuid)) {
        // Fallback auto-generate if missing
        $uuid = 'proj_' . time() . '_' . wp_generate_password(6, false);
    }

    $params = $request->get_json_params();

    $data = [
        'project_uuid'    => $uuid,
        'tenant_id'       => $tenant_id,
        'project_name'    => $params['name'] ?? $params['project_name'] ?? 'Untitled Project',
        'project_number'  => $params['projectNumber'] ?? $params['project_number'] ?? '',
        'description'     => $params['description'] ?? '',
        'room_count'      => intval($params['roomCount'] ?? $params['room_count'] ?? 0),
        'gross_sf'        => floatval($params['grossSf'] ?? $params['gross_sf'] ?? 0),
        'net_sf'          => floatval($params['netSf'] ?? $params['net_sf'] ?? 0),
        'estimated_total' => floatval($params['estimatedTotal'] ?? $params['estimated_total'] ?? 0),
        'project_state'   => isset($params['state']) ? json_encode($params['state']) : ($params['project_state'] ?? '{}'),
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
