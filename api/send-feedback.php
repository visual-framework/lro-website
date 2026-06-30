<?php

declare(strict_types=1);

// Allow cross-origin requests from localhost during development
$origin = isset($_SERVER['HTTP_ORIGIN']) ? $_SERVER['HTTP_ORIGIN'] : '';
if (preg_match('/^https?:\/\/localhost(:\d+)?$/', $origin)) {
    header('Access-Control-Allow-Origin: ' . $origin);
    header('Access-Control-Allow-Methods: POST, OPTIONS');
    header('Access-Control-Allow-Headers: Content-Type');
}

// Handle preflight OPTIONS request
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

header('Content-Type: application/json; charset=UTF-8');

function json_response(int $statusCode, array $payload): void
{
    http_response_code($statusCode);
    echo json_encode($payload);
    exit;
}

function is_local_request(): bool
{
    $host = isset($_SERVER['HTTP_HOST']) ? strtolower((string) $_SERVER['HTTP_HOST']) : '';
    $serverName = isset($_SERVER['SERVER_NAME']) ? strtolower((string) $_SERVER['SERVER_NAME']) : '';

    return strpos($host, 'localhost') === 0
        || strpos($host, '127.0.0.1') === 0
        || $serverName === 'localhost'
        || $serverName === '127.0.0.1';
}

function hcaptcha_secret(): string
{
    $secret = getenv('HCAPTCHA_SECRET');
    if ($secret === false || trim($secret) === '') {
        $secret = isset($_ENV['HCAPTCHA_SECRET']) ? (string) $_ENV['HCAPTCHA_SECRET'] : '';
    }
    if (trim($secret) === '') {
        $secret = isset($_SERVER['HCAPTCHA_SECRET']) ? (string) $_SERVER['HCAPTCHA_SECRET'] : '';
    }

    return trim($secret);
}

function post_hcaptcha_verify(array $fields): ?array
{
    $body = http_build_query($fields);

    if (function_exists('curl_init')) {
        $ch = curl_init('https://hcaptcha.com/siteverify');
        curl_setopt_array($ch, [
            CURLOPT_POST => true,
            CURLOPT_POSTFIELDS => $body,
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_TIMEOUT => 8,
            CURLOPT_HTTPHEADER => ['Content-Type: application/x-www-form-urlencoded']
        ]);

        $response = curl_exec($ch);
        $status = curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
        curl_close($ch);

        if ($response === false || $status < 200 || $status >= 300) {
            return null;
        }

        $decoded = json_decode($response, true);
        return is_array($decoded) ? $decoded : null;
    }

    $context = stream_context_create([
        'http' => [
            'method' => 'POST',
            'header' => "Content-Type: application/x-www-form-urlencoded\r\n",
            'content' => $body,
            'timeout' => 8
        ]
    ]);

    $response = file_get_contents('https://hcaptcha.com/siteverify', false, $context);
    if ($response === false) {
        return null;
    }

    $decoded = json_decode($response, true);
    return is_array($decoded) ? $decoded : null;
}

function verify_hcaptcha_token(string $token): bool
{
    if (is_local_request()) {
        return true;
    }

    if ($token === '') {
        json_response(400, [
            'success' => false,
            'error' => 'Captcha token is required.'
        ]);
    }

    $secret = hcaptcha_secret();
    if ($secret === '') {
        json_response(500, [
            'success' => false,
            'error' => 'Captcha verification is not configured.'
        ]);
    }

    $fields = [
        'secret' => $secret,
        'response' => $token
    ];

    if (!empty($_SERVER['REMOTE_ADDR'])) {
        $fields['remoteip'] = (string) $_SERVER['REMOTE_ADDR'];
    }

    $verification = post_hcaptcha_verify($fields);

    return isset($verification['success']) && $verification['success'] === true;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    json_response(405, [
        'success' => false,
        'error' => 'Method not allowed.'
    ]);
}

$rawInput = file_get_contents('php://input');
$payload = json_decode($rawInput ?: '', true);

// Be tolerant in production: if JSON parsing fails, fall back to form-encoded payloads.
if (!is_array($payload)) {
    $payload = $_POST;
}

if (!is_array($payload)) {
    $payload = [];
}

$to = ["es-wwwdev@ebi.ac.uk"];//["snprod-lrowebsite-feedback@ebi.ac.uk"]; //  
$subject = isset($payload['subject']) ? trim((string) $payload['subject']) : 'Feedback';
$message = isset($payload['message']) ? trim((string) $payload['message']) : '';

// Accept common alternate field names from clients/proxies.
if ($message === '' && isset($payload['body'])) {
    $message = trim((string) $payload['body']);
}
if ($message === '' && isset($payload['feedback'])) {
    $message = trim((string) $payload['feedback']);
}

if ($subject === '') {
    $subject = 'Feedback';
}

if ($message === '') {
    json_response(400, [
        'success' => false,
        'error' => 'Message is required.'
    ]);
}

$captchaToken = isset($payload['captchaToken']) ? trim((string) $payload['captchaToken']) : '';
if ($captchaToken === '' && isset($payload['h-captcha-response'])) {
    $captchaToken = trim((string) $payload['h-captcha-response']);
}

if (!verify_hcaptcha_token($captchaToken)) {
    json_response(403, [
        'success' => false,
        'error' => 'Captcha verification failed.'
    ]);
}

$sanitizedSubject = preg_replace('/[\r\n]+/', ' ', $subject);
$siteHost = isset($_SERVER['HTTP_HOST']) ? preg_replace('/[^A-Za-z0-9.-]/', '', $_SERVER['HTTP_HOST']) : 'localhost';
// $fromAddress = 'no-reply@' . ($siteHost !== '' ? $siteHost : 'localhost');
$fromAddress = "no-reply@ebi.ac.uk";

$headers = [
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset=UTF-8',
    'From: LRO Website <' . $fromAddress . '>'
];

$mailto = implode(',', $to);

// Send email
$sent = mail($mailto, $sanitizedSubject, $message, implode("\r\n", $headers));
if (!$sent) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'error' => 'Failed to send email.'
    ]);
    exit;
}

echo json_encode([
    'success' => true
]);
