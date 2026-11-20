<?php
/*
 * Plain-text email through PHP's mail() (as send.php does), from mfs_mail_from().
 * Loaded by boot.php — see the overview at the top of boot.php.
 */
if (!defined('MFS_BOOTED')) { http_response_code(404); exit; }

/** The website's domain for email (no www, no port): from the site's own address, never a visitor's Host header. */
function mfs_mail_domain(): string
{
  $host = (string) parse_url(mfs_site_origin(), PHP_URL_HOST);
  $host = preg_replace('/^www\./i', '', strtolower($host));
  if ($host === '' || $host === 'localhost' || filter_var($host, FILTER_VALIDATE_IP)) $host = 'localhost.localdomain';
  return $host;
}

/**
 * The sender (From) of every email: MFS_MAIL_FROM in admin/config.local.php, else Settings › Form emails
 * (setting mail_from), else mfs_mail_from_auto(). Never throws.
 */
function mfs_mail_from(): string
{
  if (defined('MFS_MAIL_FROM') && valid_email((string) MFS_MAIL_FROM) !== '') return valid_email((string) MFS_MAIL_FROM);
  try {
    $own = valid_email((string) setting('mail_from', ''));
    if ($own !== '') return $own;
  } catch (Throwable $e) {
    // No database: the automatic sender.
  }
  return mfs_mail_from_auto();
}

/**
 * The automatic sender: a form recipient or the website's email address on the site's own domain (an account
 * that exists — Hostinger's mail() wants one), else no-reply@<domain>. Never throws.
 */
function mfs_mail_from_auto(): string
{
  $domain = 'localhost.localdomain';
  try {
    $domain = mfs_mail_domain();
    $c = catalog()['contact'];
    foreach (array_merge(form_recipients(), [(string) ($c['email'] ?? '')]) as $e) {
      $e = valid_email($e);
      if ($e !== '' && strcasecmp((string) substr((string) strrchr($e, '@'), 1), $domain) === 0) return $e;
    }
  } catch (Throwable $e) {
    // No database: the default below.
  }
  return 'no-reply@' . $domain;
}

/**
 * Sends a plain-text email. $to: one address or a list. Returns true if mail() accepted it.
 * Subject and body are plain text (UTF-8); header injection is impossible (addresses are validated).
 */
function send_mail($to, string $subject, string $body, string $replyTo = ''): bool
{
  $list = is_array($to) ? $to : mfs_parse_emails((string) $to);
  $list = array_values(array_filter(array_map('valid_email', $list)));
  if (!$list) return false;
  $brand = (string) (catalog()['brand'] ?? 'Million First Steps');
  $from = mfs_mail_from();
  $subject = str_replace(["\r", "\n"], ' ', $subject);
  $headers = 'From: =?UTF-8?B?' . base64_encode($brand) . '?= <' . $from . ">\r\n"
    . "MIME-Version: 1.0\r\nContent-Type: text/plain; charset=UTF-8\r\nContent-Transfer-Encoding: 8bit\r\n"
    . (valid_email($replyTo) !== '' ? 'Reply-To: ' . valid_email($replyTo) . "\r\n" : '');
  $encSubject = '=?UTF-8?B?' . base64_encode($subject) . '?=';
  $body = str_replace(["\r\n", "\r"], "\n", $body);
  $toLine = implode(', ', $list);
  $ok = @mail($toLine, $encSubject, $body, $headers, '-f' . $from);
  if (!$ok) $ok = @mail($toLine, $encSubject, $body, $headers);
  return (bool) $ok;
}
