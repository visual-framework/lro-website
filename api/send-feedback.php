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

function jsonError(int $statusCode, string $message): void
{
    http_response_code($statusCode);
    echo json_encode([
        'success' => false,
        'error' => $message
    ]);
    exit;
}

function getEnvValue(string $name): string
{
    $value = getenv($name);
    if (is_string($value) && $value !== '') {
        return trim($value);
    }

    if (isset($_SERVER[$name]) && $_SERVER[$name] !== '') {
        return trim((string) $_SERVER[$name]);
    }

    return '';
}

function verifyHcaptchaToken(string $verifyUrl, string $secret, string $token, string $remoteIp = ''): bool
{
    $payload = [
        'secret' => $secret,
        'response' => $token,
    ];

    if ($remoteIp !== '') {
        $payload['remoteip'] = $remoteIp;
    }

    $context = stream_context_create([
        'http' => [
            'method' => 'POST',
            'header' => "Content-Type: application/x-www-form-urlencoded\r\n",
            'content' => http_build_query($payload),
            'timeout' => 10,
        ]
    ]);

    $response = @file_get_contents($verifyUrl, false, $context);
    if ($response === false) {
        return false;
    }

    $decoded = json_decode($response, true);
    return is_array($decoded) && !empty($decoded['success']);
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    jsonError(405, 'Method not allowed.');
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

$defaultRecipient = 'embldev@service-now.com';
$allowedRecipients = [$defaultRecipient];

$to = ["embldev@service-now.com", "es-wwwdev@ebi.ac.uk"]; // Default recipient(s)
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
    jsonError(400, 'Message is required.');
}

$captchaToken = isset($payload['captchaToken']) ? trim((string) $payload['captchaToken']) : '';
$hcaptchaSecret = getEnvValue('HCAPTCHA_SECRET');
$hcaptchaVerifyUrl = getEnvValue('HCAPTCHA_VERIFY_URL');
$hcaptchaVerifyUrl = $hcaptchaVerifyUrl !== '' ? $hcaptchaVerifyUrl : 'https://api.hcaptcha.com/siteverify';
$requestHost = isset($_SERVER['HTTP_HOST']) ? strtolower((string) $_SERVER['HTTP_HOST']) : '';
$remoteIp = isset($_SERVER['REMOTE_ADDR']) ? (string) $_SERVER['REMOTE_ADDR'] : '';
$isLocalRequest = $requestHost === 'localhost'
    || $requestHost === '127.0.0.1'
    || str_starts_with($requestHost, 'localhost:')
    || str_starts_with($requestHost, '127.0.0.1:')
    || $remoteIp === '127.0.0.1'
    || $remoteIp === '::1';

if (!$isLocalRequest) {
    if ($hcaptchaSecret === '') {
        jsonError(500, 'Captcha is not configured.');
    }

    if ($captchaToken === '') {
        jsonError(400, 'Captcha token is required.');
    }

    if (!verifyHcaptchaToken($hcaptchaVerifyUrl, $hcaptchaSecret, $captchaToken, $remoteIp)) {
        jsonError(400, 'Captcha verification failed.');
    }
}

$sanitizedSubject = preg_replace('/[\r\n]+/', ' ', $subject);
$siteHost = isset($_SERVER['HTTP_HOST']) ? preg_replace('/[^A-Za-z0-9.-]/', '', $_SERVER['HTTP_HOST']) : 'localhost';
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
    jsonError(500, 'Failed to send email.');
}

echo json_encode([
    'success' => true
]);
