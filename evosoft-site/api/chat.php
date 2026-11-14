<?php
/*
 * EvoSoft website chat assistant: answers visitors' questions about EvoSoft using Claude.
 * The knowledge comes from api/knowledge.md, which site-builder/build.mjs generates from the site's own data.
 * If no API key is set (or the SDK isn't installed) it answers 503 and the page uses its built-in answers instead.
 * © 2026 EvoSoft Solutions. All rights reserved.
 */

declare(strict_types=1);

use Anthropic\Client;
use Anthropic\Core\Exceptions\APIConnectionException;
use Anthropic\Core\Exceptions\APIStatusException;
use Anthropic\Core\Exceptions\AuthenticationException;
use Anthropic\Core\Exceptions\BadRequestException;
use Anthropic\Core\Exceptions\RateLimitException;

require __DIR__ . '/lib.php';

$cfg = evo_config();
$ready = $cfg['anthropic_api_key'] !== '' && is_file(__DIR__ . '/vendor/autoload.php') && is_file(__DIR__ . '/knowledge.md');

$req = evo_read_request(24000);
if (isset($req['__health'])) {
    evo_json(['ok' => true, 'ai' => $ready]);
}
if (!$ready) {
    evo_json(['error' => 'not_configured'], 503);
}

// ---- validate the conversation ----
$messages = [];
foreach (array_slice(is_array($req['messages'] ?? null) ? $req['messages'] : [], -12) as $m) {
    $role = $m['role'] ?? '';
    $content = is_string($m['content'] ?? null) ? evo_clean_text($m['content'], 1500) : '';
    if (($role !== 'user' && $role !== 'assistant') || $content === '') {
        continue;
    }
    // keep strict user/assistant alternation, merging accidental repeats
    if ($messages && end($messages)['role'] === $role) {
        $messages[count($messages) - 1]['content'] .= "\n\n" . $content;
        continue;
    }
    $messages[] = ['role' => $role, 'content' => $content];
}
while ($messages && $messages[0]['role'] !== 'user') {
    array_shift($messages);
}
if (!$messages || end($messages)['role'] !== 'user') {
    evo_json(['error' => 'bad_request'], 400);
}

// ---- limits: per visitor, and a daily ceiling for the whole site ----
$ip = evo_client_ip();
if (!evo_rate_ok('chat10m', $ip, (int)$cfg['chat_per_ip_10min'], 600) || !evo_rate_ok('chatday', $ip, (int)$cfg['chat_per_ip_day'], 86400)) {
    evo_json(['error' => 'rate_limited'], 429);
}
if (!evo_rate_ok('chatall', 'site', (int)$cfg['chat_global_day'], 86400)) {
    evo_json(['error' => 'busy'], 503);
}

// ---- ask Claude ----
require __DIR__ . '/vendor/autoload.php';


$system = file_get_contents(__DIR__ . '/knowledge.md');
$model = (string)$cfg['chat_model'];
// Server-side refusal fallbacks exist for these model families; other models get no fallbacks parameter.
$withFallbacks = (bool)preg_match('/^claude-(opus-5|fable-5|sonnet-5-5)/', $model);

try {
    $client = new Client(
        apiKey: (string)$cfg['anthropic_api_key'],
        baseUrl: $cfg['anthropic_base_url'] ?: null,
        requestOptions: ['timeout' => 45, 'maxRetries' => 1],
    );
    $params = [
        'maxTokens' => (int)$cfg['chat_max_tokens'],
        'messages' => $messages,
        'model' => $model,
        // The knowledge base is the same on every request, so it is cached between visitors.
        'system' => [['type' => 'text', 'text' => $system, 'cacheControl' => ['type' => 'ephemeral']]],
        'outputConfig' => ['effort' => (string)$cfg['chat_effort']],
    ];
    if ($withFallbacks) {
        $params['fallbacks'] = 'default';
        $params['betas'] = ['server-side-fallback-2026-07-01'];
    }
    $message = $client->beta->messages->create(...$params);
} catch (RateLimitException $e) {
    evo_json(['error' => 'busy'], 503);
} catch (AuthenticationException $e) {
    error_log('EvoSoft chat: the Anthropic API key was rejected.');
    evo_json(['error' => 'not_configured'], 503);
} catch (BadRequestException $e) {
    error_log('EvoSoft chat: bad request: ' . $e->getMessage());
    evo_json(['error' => 'unavailable'], 503);
} catch (APIStatusException $e) {
    error_log('EvoSoft chat: API error: ' . $e->getMessage());
    evo_json(['error' => 'unavailable'], 503);
} catch (APIConnectionException $e) {
    error_log('EvoSoft chat: could not reach the API: ' . $e->getMessage());
    evo_json(['error' => 'unavailable'], 503);
} catch (\Throwable $e) {
    error_log('EvoSoft chat: ' . get_class($e) . ': ' . $e->getMessage());
    evo_json(['error' => 'unavailable'], 503);
}

if ($message->stopReason === 'refusal') {
    evo_json(['reply' => "I can't help with that one. I can answer questions about EvoSoft, our services, the live demos or getting a quote.", 'source' => 'ai']);
}

$reply = '';
foreach ($message->content as $block) {
    if ($block->type === 'text') {
        $reply .= $block->text;
    }
}
$reply = trim($reply);
if ($reply === '') {
    evo_json(['error' => 'unavailable'], 503);
}
evo_json(['reply' => $reply, 'source' => 'ai']);
