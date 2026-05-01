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

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode([
        'success' => false,
        'error' => 'Method not allowed.'
    ]);
    exit;
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

// if ($to === '' || !in_array($to, $allowedRecipients, true)) {
//     // Never fail user submissions on recipient mismatch; route to default mailbox.
//     $to = $defaultRecipient;
// }


if ($subject === '') {
    $subject = 'Feedback';
}

if ($message === '') {
    http_response_code(400);
    echo json_encode([
        'success' => false,
        'error' => 'Message is required.'
    ]);
    exit;
}

$sanitizedSubject = preg_replace('/[\r\n]+/', ' ', $subject);
$siteHost = isset($_SERVER['HTTP_HOST']) ? preg_replace('/[^A-Za-z0-9.-]/', '', $_SERVER['HTTP_HOST']) : 'localhost';
$fromAddress = 'no-reply@' . ($siteHost !== '' ? $siteHost : 'localhost');
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
