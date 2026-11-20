<?php
/*
 * Plain-text email through PHP's mail() (as send.php does), from no-reply@<this domain>.
 * Loaded by boot.php — see the overview at the top of boot.php.
 */
if (!defined('MFS_BOOTED')) { http_response_code(404); exit; }

/** The From address: no-reply@<domain without www and port>. */
function mfs_mail_from(): string
{
  $host = preg_replace('/:\d+$/', '', mfs_host());
  $host = preg_replace('/^www\./i', '', $host);
  if ($host === '' || $host === 'localhost' || filter_var($host, FILTER_VALIDATE_IP)) $host = 'localhost.localdomain';
  return 'no-reply@' . $host;
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
