<?php

declare(strict_types=1);

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

if (!is_array($payload)) {
    http_response_code(400);
    echo json_encode([
        'success' => false,
        'error' => 'Invalid JSON payload.'
    ]);
    exit;
}

$defaultRecipient = 'embldev@service-now.com';
$allowedRecipients = [$defaultRecipient];

$to = isset($payload['to']) ? trim((string) $payload['to']) : $defaultRecipient;
$subject = isset($payload['subject']) ? trim((string) $payload['subject']) : 'Feedback';
$message = isset($payload['message']) ? trim((string) $payload['message']) : '';

if ($to === '' || !in_array($to, $allowedRecipients, true)) {
    http_response_code(400);
    echo json_encode([
        'success' => false,
        'error' => 'Recipient is not allowed.'
    ]);
    exit;
}

if ($subject === '' || $message === '') {
    http_response_code(400);
    echo json_encode([
        'success' => false,
        'error' => 'Subject and message are required.'
    ]);
    exit;
}

$sanitizedSubject = preg_replace('/[\r\n]+/', ' ', $subject);
$siteHost = isset($_SERVER['HTTP_HOST']) ? preg_replace('/[^A-Za-z0-9.-]/', '', $_SERVER['HTTP_HOST']) : 'localhost';
$fromAddress = 'no-reply@' . ($siteHost !== '' ? $siteHost : 'localhost');

$headers = [
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset=UTF-8',
    'From: LRO Website <' . $fromAddress . '>'
];

$sent = mail($to, $sanitizedSubject, $message, implode("\r\n", $headers));

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
