<?php
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { exit; }

$body = json_decode(file_get_contents('php://input'), true);
$apiKey = '';
$source = trim((string)($body['source'] ?? ''));
$targetWidth = max(1, intval($body['targetWidth'] ?? 0));
$targetHeight = max(1, intval($body['targetHeight'] ?? 0));

if ($source === '') {
    http_response_code(400);
    echo json_encode(['error' => 'Kaynak görsel bulunamadı.']);
    exit;
}

function upscale_pick_size($width, $height) {
    if ($width <= 0 || $height <= 0) return '1024x1024';
    $ratio = $width / max($height, 1);
    if ($ratio > 1.15) return '1536x1024';
    if ($ratio < 0.87) return '1024x1536';
    return '1024x1024';
}

function upscale_decode_source($source) {
    if (preg_match('/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/', $source, $matches)) {
        $mime = strtolower($matches[1]);
        $binary = base64_decode($matches[2], true);
        if ($binary === false) {
            return [null, null, 'Base64 görsel çözülemedi.'];
        }
        return [$binary, $mime, null];
    }

    if (preg_match('/^https?:\/\//i', $source)) {
        $context = stream_context_create([
            'http' => [
                'timeout' => 45,
                'user_agent' => 'Alcatraz-Studio-Image-Upscale/1.0'
            ]
        ]);
        $binary = @file_get_contents($source, false, $context);
        if ($binary === false) {
            return [null, null, 'Kaynak URL indirilemedi.'];
        }

        $mime = null;
        if (isset($http_response_header) && is_array($http_response_header)) {
            foreach ($http_response_header as $headerLine) {
                if (stripos($headerLine, 'Content-Type:') === 0) {
                    $mime = trim(substr($headerLine, strlen('Content-Type:')));
                    $mime = trim(explode(';', $mime)[0]);
                    break;
                }
            }
        }

        if (!$mime) {
            $info = @getimagesizefromstring($binary);
            $mime = $info['mime'] ?? 'image/png';
        }

        return [$binary, strtolower($mime), null];
    }

    return [null, null, 'Desteklenmeyen görsel kaynağı.'];
}

function upscale_extension_from_mime($mime) {
    $map = [
        'image/jpeg' => '.jpg',
        'image/jpg' => '.jpg',
        'image/png' => '.png',
        'image/webp' => '.webp'
    ];
    return $map[$mime] ?? '.png';
}

function upscale_normalize_mime($binary, $mime) {
    $mime = strtolower(trim((string)$mime));
    $allowed = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];

    if (in_array($mime, $allowed, true)) {
        return $mime === 'image/jpg' ? 'image/jpeg' : $mime;
    }

    $info = @getimagesizefromstring($binary);
    $detectedMime = strtolower(trim((string)($info['mime'] ?? '')));
    if (in_array($detectedMime, $allowed, true)) {
        return $detectedMime === 'image/jpg' ? 'image/jpeg' : $detectedMime;
    }

    return null;
}

function upscale_openai_edit($apiKey, $filePath, $mime, $prompt, $size) {
    $extension = upscale_extension_from_mime($mime);
    $payload = [
        'model' => 'gpt-image-1.5',
        'prompt' => $prompt,
        'size' => $size,
        'quality' => 'high',
        'input_fidelity' => 'high',
        'output_format' => 'png',
        'image[]' => curl_file_create($filePath, $mime, 'upscale-source' . $extension)
    ];

    $ch = curl_init('https://api.openai.com/v1/images/edits');
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_POST => true,
        CURLOPT_HTTPHEADER => [
            'Authorization: Bearer ' . $apiKey
        ],
        CURLOPT_POSTFIELDS => $payload,
        CURLOPT_TIMEOUT => 240
    ]);

    $response = curl_exec($ch);
    $curlErr = curl_error($ch);
    curl_close($ch);

    if ($curlErr) {
        return [null, 'cURL: ' . $curlErr];
    }

    $data = json_decode($response, true);
    if (!is_array($data)) {
        return [null, 'OpenAI yanıtı parse edilemedi.'];
    }

    if (isset($data['error'])) {
        return [null, $data['error']['message'] ?? 'OpenAI hatası'];
    }

    $b64 = $data['data'][0]['b64_json'] ?? null;
    if (!$b64) {
        return [null, 'Upscale görseli dönmedi.'];
    }

    return ['data:image/png;base64,' . $b64, null];
}

[$binary, $mime, $decodeError] = upscale_decode_source($source);
if ($decodeError) {
    http_response_code(400);
    echo json_encode(['error' => $decodeError]);
    exit;
}

$mime = upscale_normalize_mime($binary, $mime);
if (!$mime) {
    http_response_code(400);
    echo json_encode(['error' => 'Desteklenmeyen görsel formatı. Sadece JPG, PNG veya WEBP kullanılabilir.']);
    exit;
}

$filePath = tempnam(sys_get_temp_dir(), 'upscale_');
$filePath = $filePath ?: '';
$finalPath = $filePath !== '' ? $filePath . upscale_extension_from_mime($mime) : '';
if ($filePath === '' || $finalPath === '') {
    http_response_code(500);
    echo json_encode(['error' => 'Geçici dosya oluşturulamadı.']);
    exit;
}
rename($filePath, $finalPath);
file_put_contents($finalPath, $binary);

$size = upscale_pick_size($targetWidth, $targetHeight);
$prompt = 'Upscale this exact image to a higher fidelity version. Preserve the same subject, crop, composition, colors, transparency, and overall look. Do not add new objects, do not change framing, and do not redesign the image. Increase clarity and natural detail only.';

[$imageDataUrl, $error] = upscale_openai_edit($apiKey, $finalPath, $mime, $prompt, $size);
@unlink($finalPath);

if ($error) {
    http_response_code(502);
    echo json_encode(['error' => $error]);
    exit;
}

echo json_encode([
    'imageDataUrl' => $imageDataUrl,
    'requestedSize' => $size,
    'targetWidth' => $targetWidth,
    'targetHeight' => $targetHeight
], JSON_UNESCAPED_UNICODE);
