<?php
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { exit; }

$body = json_decode(file_get_contents('php://input'), true);
$payload = is_array($body) ? $body : [];

if (!isset($payload['model']) || trim((string)$payload['model']) === '') {
    http_response_code(400);
    echo json_encode(['error' => 'Colormind model bilgisi eksik.']);
    exit;
}

$ch = curl_init('http://colormind.io/api/');
curl_setopt_array($ch, [
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_POST => true,
    CURLOPT_HTTPHEADER => [
        'Content-Type: application/json'
    ],
    CURLOPT_POSTFIELDS => json_encode($payload),
    CURLOPT_TIMEOUT => 45
]);

$response = curl_exec($ch);
$curlErr = curl_error($ch);
$status = curl_getinfo($ch, CURLINFO_HTTP_CODE);
curl_close($ch);

if ($curlErr) {
    http_response_code(502);
    echo json_encode(['error' => 'cURL: ' . $curlErr]);
    exit;
}

$data = json_decode($response, true);
if (!is_array($data)) {
    http_response_code(502);
    echo json_encode(['error' => 'Colormind yaniti parse edilemedi.']);
    exit;
}

if ($status >= 400) {
    http_response_code($status);
    echo json_encode(['error' => $data['error'] ?? ('Colormind hatasi (' . $status . ')')]);
    exit;
}

echo json_encode($data, JSON_UNESCAPED_UNICODE);
