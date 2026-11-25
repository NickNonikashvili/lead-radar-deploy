<?php
/*
 * EvoSoft admin panel: the first-run setup page and the Security page's tools.
 * © 2026 EvoSoft Solutions. All rights reserved.
 *
 * Neither saves anything. They make the lines the owner pastes into the settings file (evosoft-config.php next to
 * public_html): a password hash (password_hash, bcrypt) and, optionally, an authenticator-app secret (base32, shown as
 * text and as an otpauth:// address; no QR code service is ever called). Until a hash is configured, nobody can sign
 * in: the setup page never grants access.
 */

declare(strict_types=1);

if (!defined('EVO_ADMIN')) {
    http_response_code(404);
    exit;
}

/**
 * Runs one of the tools (POST ?action=tool.password / tool.totp / tool.check) and returns what to show.
 * The caller has already checked where the form came from (and the CSRF token when signed in).
 */
function admin_tool_run(string $action): array
{
    $r = ['errors' => []];
    if ($action === 'tool.password') {
        $pw = $_POST['new_password'] ?? '';
        $again = $_POST['new_password2'] ?? '';
        $pw = is_string($pw) ? $pw : '';
        $again = is_string($again) ? $again : '';
        if (preg_match('/[\x00-\x1F\x7F]/', $pw) || !mb_check_encoding($pw, 'UTF-8')) {
            // (password_hash() can't take a NUL byte, and a password box can't type the others)
            $r['errors']['new_password'] = 'That password has a hidden control character in it. Please type it again.';
        } elseif (mb_strlen($pw) < 12) {
            $r['errors']['new_password'] = 'Use at least 12 characters. A few unrelated words work well.';
        } elseif (strlen($pw) > 72) {
            $r['errors']['new_password'] = 'Use at most 72 characters (fewer if it has accents or other letters).';
        } elseif (!hash_equals($pw, $again)) {
            $r['errors']['new_password2'] = 'The two passwords aren’t the same.';
        }
        if (!$r['errors']) {
            $r['hash'] = password_hash($pw, PASSWORD_DEFAULT, ['cost' => 12]);
        }
    } elseif ($action === 'tool.totp') {
        $r['secret'] = admin_base32_encode(random_bytes(20)); // 160 bits, as RFC 4226 recommends
    } elseif ($action === 'tool.check') {
        $secret = is_string($_POST['secret'] ?? null) ? $_POST['secret'] : '';
        $secret = strtoupper((string)preg_replace('/\s+/', '', $secret));
        $key = admin_base32_decode($secret);
        if ($key === null || strlen($key) < 10) {
            $r['errors']['secret'] = 'That secret isn’t valid. Make a new one.';
        } else {
            $r['secret'] = $secret;
            $code = $_POST['check_code'] ?? '';
            $r['checked'] = admin_totp_match($key, is_string($code) ? $code : '', time()) !== null;
            if (!$r['checked']) {
                $r['errors']['check_code'] = 'That code doesn’t match. Check the phone’s clock is set automatically, then try the newest code.';
            }
        }
    }
    return $r;
}

function admin_config_line(string $key, string $value): string
{
    return "'" . $key . "' => '" . addcslashes($value, "'\\") . "',";
}

/** A block with a line to copy, and a Copy button (admin.js) next to it. */
function admin_copy_block(string $id, string $label, string $text): string
{
    return '<div class="copy"><p class="copy-label" id="' . admin_h($id) . '-label">' . admin_h($label) . '</p>'
        . '<pre class="code" id="' . admin_h($id) . '" aria-labelledby="' . admin_h($id) . '-label"><code>' . admin_h($text) . '</code></pre>'
        . '<button class="btn small" type="button" data-copy="' . admin_h($id) . '" hidden>Copy</button></div>';
}

/** The tool forms and their results. $signedIn adds the CSRF field. */
function admin_tools_html(array $r, bool $signedIn): string
{
    $err = $r['errors'] ?? [];
    $csrf = $signedIn ? admin_csrf_field() : '';
    $fieldError = static function (string $name) use ($err): array {
        if (!isset($err[$name])) {
            return ['', ''];
        }
        return [' aria-invalid="true" aria-describedby="err-' . $name . '"', '<p class="field-error" id="err-' . $name . '">' . admin_h($err[$name]) . '</p>'];
    };
    $paste = '<ol class="steps"><li>In hPanel, open <strong>File Manager</strong> and the file <code>evosoft-config.php</code> next to <code>public_html</code> (copy <code>public_html/api/config.example.php</code> there if it isn’t there yet).</li>'
        . '<li>Paste the line inside <code>return [</code> … <code>];</code>, replacing the old line with the same name if there is one.</li>'
        . '<li>Save the file, then reload this page.</li></ol>';

    // 1. password
    [$a1, $e1] = $fieldError('new_password');
    [$a2, $e2] = $fieldError('new_password2');
    $html = '<section class="card" aria-labelledby="t-pw"><h2 id="t-pw">' . ($signedIn ? 'Change the password' : 'Choose a password') . '</h2>';
    if (isset($r['hash'])) {
        $html .= '<div class="result" role="status"><p><strong>Done.</strong> Your settings line (it holds a one-way hash, never the password):</p>'
            . admin_copy_block('line-hash', 'Settings line', admin_config_line('admin_password_hash', $r['hash'])) . $paste
            . ($signedIn ? '<p class="muted">Once you save it, every open session signs out and the new password is the one that works.</p>' : '') . '</div>';
    }
    $html .= '<form method="post" action="' . admin_h(admin_url(['action' => 'tool.password'] + ($signedIn ? ['view' => 'security'] : []))) . '" class="stack" novalidate>' . $csrf . '
<div class="field"><label for="new_password">New password</label>
<input id="new_password" name="new_password" type="password" autocomplete="new-password" required minlength="12" maxlength="72"' . ($a1 !== '' ? $a1 : ' aria-describedby="pw-hint"') . '>
<p class="hint" id="pw-hint">At least 12 characters. Nothing is saved: you get a line to paste into the settings file.</p>' . $e1 . '</div>
<div class="field"><label for="new_password2">The same password again</label>
<input id="new_password2" name="new_password2" type="password" autocomplete="new-password" required maxlength="72"' . $a2 . '>' . $e2 . '</div>
<button class="btn primary" type="submit">Make the settings line</button>
</form></section>';

    // 2. authenticator app
    $html .= '<section class="card" aria-labelledby="t-totp"><h2 id="t-totp">Two-step sign-in <span class="muted">(optional)</span></h2>'
        . '<p>Ask for a 6-digit code from an authenticator app (such as Google Authenticator, 1Password or Aegis) as well as the password.</p>';
    if (isset($r['secret'])) {
        $secret = $r['secret'];
        $uri = 'otpauth://totp/EvoSoft:admin?secret=' . $secret . '&issuer=EvoSoft&algorithm=SHA1&digits=6&period=30';
        $html .= '<div class="result" role="status">'
            . '<p>In the app, choose <strong>Add account</strong> → <strong>Enter a setup key</strong> (type: time-based) and type this key:</p>'
            . admin_copy_block('totp-key', 'Setup key', trim(chunk_split($secret, 4, ' ')))
            . admin_copy_block('totp-uri', 'Or, if your app takes an otpauth address', $uri);
        [$a3, $e3] = $fieldError('check_code');
        $html .= '<form method="post" action="' . admin_h(admin_url(['action' => 'tool.check'] + ($signedIn ? ['view' => 'security'] : []))) . '" class="stack inline-form" novalidate>' . $csrf
            . '<input type="hidden" name="secret" value="' . admin_h($secret) . '">'
            . '<div class="field"><label for="check_code">Check a code from the app</label>'
            . '<input id="check_code" name="check_code" type="text" inputmode="numeric" autocomplete="one-time-code" maxlength="9"' . $a3 . '>' . $e3 . '</div>'
            . '<button class="btn" type="submit">Check</button></form>';
        if (!empty($r['checked'])) {
            $html .= '<p class="flash flash-ok" role="status">The code matches: the app is set up. Now paste the line below.</p>';
        }
        $html .= admin_copy_block('line-totp', 'Settings line', admin_config_line('admin_totp_secret', $secret)) . $paste
            . '<p class="muted">Keep the key somewhere safe (a password manager): if you lose the phone, it’s how you set the app up again. To turn two-step sign-in off, delete the line.</p></div>';
    } elseif (isset($err['secret'])) {
        $html .= '<p class="flash flash-error" role="alert">' . admin_h($err['secret']) . '</p>';
    }
    $html .= '<form method="post" action="' . admin_h(admin_url(['action' => 'tool.totp'] + ($signedIn ? ['view' => 'security'] : []))) . '">' . $csrf
        . '<button class="btn" type="submit">' . (isset($r['secret']) ? 'Make a different key' : 'Make a key for the app') . '</button></form></section>';
    return $html;
}

/** The page shown while admin_password_hash isn't set (or isn't a hash). Never signs anyone in. */
function admin_setup_page(array $cfg, string $hashState, array $result = [], int $code = 200): never
{
    http_response_code($code);
    $intro = $hashState === 'invalid'
        ? '<p class="flash flash-error" role="alert"><code>admin_password_hash</code> is set in the settings file, but it isn’t a password hash, so the panel stays locked. Make a new line below and replace it.</p>'
        : '<p>The panel is locked: no admin password has been set yet, so nobody can sign in. Choose a password below.'
          . ' This page saves nothing and signs nobody in: it gives you a line to paste into the settings file on the server.</p>';
    $body = '<div class="page-head"><h1>Set up the admin panel</h1>' . $intro . '</div><div class="grid2">' . admin_tools_html($result, false) . '</div>';
    admin_layout('Set up', $body, '');
    exit;
}

/** Security: how signing in works now, and the same tools. */
function admin_security_view(array $cfg, array $result = []): string
{
    $key = admin_totp_key($cfg);
    $minutes = intdiv(admin_idle_seconds($cfg), 60);
    $html = '<div class="page-head"><h1>Security</h1><p>How signing in to this panel works, and tools to change it. Changes are made in the settings file, never here.</p></div>';
    if (is_string($_SESSION['rehash'] ?? null)) {
        $html .= '<section class="card notice" aria-labelledby="t-rehash"><h2 id="t-rehash">Update your password line</h2>'
            . '<p>Your password is stored with older settings than this server now uses. It still works; for a stronger hash, replace the line in the settings file with this one (same password):</p>'
            . admin_copy_block('line-rehash', 'Settings line', admin_config_line('admin_password_hash', $_SESSION['rehash'])) . '</section>';
    }
    $html .= '<section class="card" aria-labelledby="t-now"><h2 id="t-now">Now</h2><dl class="facts">'
        . '<div><dt>Password</dt><dd>Set</dd></div>'
        . '<div><dt>Two-step sign-in</dt><dd>' . ($key !== '' ? 'On (authenticator app)' : 'Off') . '</dd></div>'
        . '<div><dt>Signed out after</dt><dd>' . $minutes . ' minutes without using the panel, and 12 hours after signing in</dd></div>'
        . '<div><dt>Sign-in attempts</dt><dd>5 per address and 30 in all, per 15 minutes. A browser you have signed in from before has its own 10, so others using up the 30 can’t lock you out.</dd></div>'
        . '</dl></section><div class="grid2">' . admin_tools_html($result, true) . '</div>';
    return $html;
}
