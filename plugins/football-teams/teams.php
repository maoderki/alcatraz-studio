<?php
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    exit;
}

function football_teams_error($message, $status = 400) {
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode([
        'success' => false,
        'error' => $message
    ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

function football_teams_fetch($url, $includeHeaders = false) {
    $ch = curl_init($url);
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_FOLLOWLOCATION => true,
        CURLOPT_TIMEOUT => 30,
        CURLOPT_HEADER => $includeHeaders,
        CURLOPT_HTTPHEADER => [
            'User-Agent: Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123 Safari/537.36'
        ]
    ]);

    $response = curl_exec($ch);
    $status = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $headerSize = curl_getinfo($ch, CURLINFO_HEADER_SIZE);
    $contentType = curl_getinfo($ch, CURLINFO_CONTENT_TYPE);
    $error = curl_error($ch);
    curl_close($ch);

    return [$response, $error, $status, $headerSize, $contentType];
}

if (isset($_GET['asset'])) {
    $assetUrl = trim((string)($_GET['asset'] ?? ''));
    if ($assetUrl === '' || !preg_match('~^https?://~i', $assetUrl)) {
        http_response_code(400);
        header('Content-Type: text/plain; charset=utf-8');
        echo 'Gecersiz gorsel adresi.';
        exit;
    }

    [$response, $error, $status, $headerSize, $contentType] = football_teams_fetch($assetUrl, true);

    if ($error || !$response || $status >= 400) {
        http_response_code(502);
        header('Content-Type: text/plain; charset=utf-8');
        echo 'Logo alinamadi.';
        exit;
    }

    $body = substr($response, (int) $headerSize);
    header('Content-Type: ' . (is_string($contentType) && $contentType !== '' ? $contentType : 'image/png'));
    header('Cache-Control: public, max-age=3600');
    echo $body;
    exit;
}

header('Content-Type: application/json; charset=utf-8');

$search = trim((string)($_GET['search'] ?? ''));

if ($search === '' || mb_strlen($search) < 2) {
    football_teams_error('En az 2 karakter gerekli.');
}

$url = 'https://www.thesportsdb.com/api/v1/json/123/searchteams.php?t=' . urlencode($search);
[$response, $curlError, $httpCode] = football_teams_fetch($url, false);

if ($curlError) {
    football_teams_error('cURL hatasi: ' . $curlError, 502);
}

$data = json_decode((string) $response, true);

if ($httpCode !== 200 || !is_array($data)) {
    football_teams_error('API yaniti gecersiz.', 502);
}

$teams = [];

if (!empty($data['teams']) && is_array($data['teams'])) {
    foreach ($data['teams'] as $team) {
        $sport = trim((string)($team['strSport'] ?? ''));
        if ($sport !== '' && strcasecmp($sport, 'Soccer') !== 0) {
            continue;
        }

        $logo = '';
        if (!empty($team['strBadge'])) {
            $logo = trim((string)$team['strBadge']);
        } elseif (!empty($team['strTeamBadge'])) {
            $logo = trim((string)$team['strTeamBadge']);
        } elseif (!empty($team['strLogo'])) {
            $logo = trim((string)$team['strLogo']);
        }

        if ($logo === '') {
            continue;
        }

        $teams[] = [
            'id' => $team['idTeam'] ?? null,
            'name' => trim((string)($team['strTeam'] ?? '')),
            'sport' => $sport,
            'league' => trim((string)($team['strLeague'] ?? '')),
            'country' => trim((string)($team['strCountry'] ?? '')),
            'logo' => $logo,
            'banner' => trim((string)($team['strTeamBanner'] ?? '')),
            'stadium' => trim((string)($team['strStadium'] ?? '')),
            'formedYear' => trim((string)($team['intFormedYear'] ?? ''))
        ];
    }
}

usort($teams, static function ($a, $b) {
    return strcasecmp((string)($a['name'] ?? ''), (string)($b['name'] ?? ''));
});

echo json_encode([
    'success' => true,
    'teams' => $teams
], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
