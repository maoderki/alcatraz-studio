<?php
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { exit; }

function x_api_fetch($url) {
    $ch = curl_init($url);
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_FOLLOWLOCATION => true,
        CURLOPT_TIMEOUT => 30,
        CURLOPT_HTTPHEADER => [
            'User-Agent: Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123 Safari/537.36'
        ]
    ]);
    $response = curl_exec($ch);
    $status = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $error = curl_error($ch);
    curl_close($ch);

    if ($error) return [null, $error, $status];
    return [$response, null, $status];
}

if (isset($_GET['asset'])) {
    $assetUrl = trim((string)($_GET['asset'] ?? ''));
    if ($assetUrl === '' || !preg_match('~^https?://~i', $assetUrl)) {
        http_response_code(400);
        header('Content-Type: text/plain; charset=utf-8');
        echo 'Geçersiz görsel adresi.';
        exit;
    }

    $ch = curl_init($assetUrl);
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_FOLLOWLOCATION => true,
        CURLOPT_TIMEOUT => 30,
        CURLOPT_HEADER => true,
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

    if ($error || !$response || $status >= 400) {
        http_response_code(502);
        header('Content-Type: text/plain; charset=utf-8');
        echo 'Görsel alınamadı.';
        exit;
    }

    $body = substr($response, (int)$headerSize);
    $contentType = is_string($contentType) && $contentType !== '' ? $contentType : 'image/jpeg';
    header('Content-Type: ' . $contentType);
    header('Cache-Control: public, max-age=3600');
    echo $body;
    exit;
}

header('Content-Type: application/json; charset=utf-8');

$body = json_decode(file_get_contents('php://input'), true);
$url = trim((string)($body['url'] ?? ''));

if ($url === '') {
    http_response_code(400);
    echo json_encode(['error' => 'X linki gerekli.']);
    exit;
}

if (!preg_match('~https?://(?:www\.)?(?:x\.com|twitter\.com)/[^/]+/status/(\d+)~i', $url, $matches)) {
    http_response_code(400);
    echo json_encode(['error' => 'Gecerli bir X status linki gir.']);
    exit;
}

$tweetId = $matches[1];
$screenName = '';
if (preg_match('~https?://(?:www\.)?(?:x\.com|twitter\.com)/([^/]+)/status/\d+~i', $url, $screenMatches)) {
    $screenName = trim((string)$screenMatches[1]);
}

function x_api_decode_value($value) {
    $value = html_entity_decode((string)$value, ENT_QUOTES | ENT_HTML5, 'UTF-8');
    $value = stripcslashes($value);
    return str_replace('\\/', '/', $value);
}

function x_api_extract_media_image($html) {
    $patterns = [
        '/https:\/\/pbs\.twimg\.com\/media\/[A-Za-z0-9_\-\.]+(?:\?format=(?:jpg|jpeg|png|webp)(?:&name=[^"\']+)?)?/i',
        '/https:\/\/pbs\.twimg\.com\/tweet_video_thumb\/[A-Za-z0-9_\-\.]+(?:\?format=(?:jpg|jpeg|png|webp)(?:&name=[^"\']+)?)?/i',
        '/"image"\s*:\s*\{\s*"imageValue"\s*:\s*"([^"]+)"/i',
        '/"media_url_https":"([^"]+)"/i',
        '/"media_url":"([^"]+)"/i'
    ];

    foreach ($patterns as $pattern) {
        if (preg_match($pattern, $html, $m)) {
            $candidate = x_api_decode_value($m[1] ?? $m[0] ?? '');
            if ($candidate !== '') {
                if (str_contains($candidate, 'name=')) {
                    return $candidate;
                }
                if (str_contains($candidate, 'format=')) {
                    return $candidate . '&name=large';
                }
                return $candidate;
            }
        }
    }

    return '';
}

function x_api_extract_media_images($html) {
    $patterns = [
        '/https:\/\/pbs\.twimg\.com\/media\/[A-Za-z0-9_\-\.]+(?:\?format=(?:jpg|jpeg|png|webp)(?:&name=[^"\']+)?)?/i',
        '/https:\/\/pbs\.twimg\.com\/tweet_video_thumb\/[A-Za-z0-9_\-\.]+(?:\?format=(?:jpg|jpeg|png|webp)(?:&name=[^"\']+)?)?/i',
        '/"media_url_https":"([^"]+)"/i',
        '/"media_url":"([^"]+)"/i'
    ];

    $images = [];
    foreach ($patterns as $pattern) {
        if (!preg_match_all($pattern, $html, $matches, PREG_SET_ORDER)) {
            continue;
        }

        foreach ($matches as $match) {
            $candidate = x_api_decode_value($match[1] ?? $match[0] ?? '');
            if ($candidate === '') continue;
            if (!str_contains($candidate, 'name=') && str_contains($candidate, 'format=')) {
                $candidate .= '&name=large';
            }
            $images[] = trim($candidate);
        }
    }

    $images = array_values(array_unique(array_filter($images, fn($value) => is_string($value) && $value !== '')));
    return $images;
}

function x_api_extract_og_image($html) {
    if (preg_match('/<meta[^>]+property=["\']og:image["\'][^>]+content=["\']([^"\']+)["\']/i', $html, $m)) {
        return x_api_decode_value($m[1]);
    }
    return '';
}

function x_api_extract_profile_image($html) {
    if (preg_match('/"profile_image_url_https":"([^"]+)"/', $html, $m)) {
        $value = stripcslashes($m[1]);
        return str_replace('_normal', '_400x400', $value);
    }
    if (preg_match('/https:\/\/pbs\.twimg\.com\/profile_images\/[^"\']+/i', $html, $m)) {
        return str_replace('_normal', '_400x400', $m[0]);
    }
    return '';
}

function x_api_extract_username($authorUrl, $fallbackUrl) {
    foreach ([$authorUrl, $fallbackUrl] as $value) {
        if (preg_match('~https?://(?:www\.)?(?:x\.com|twitter\.com)/([^/?#]+)~i', (string)$value, $m)) {
            return $m[1];
        }
    }
    return '';
}

function x_api_detect_badge($html) {
    $checks = [
        'gold' => [
            '/"affiliate_label"\s*:/i',
            '/Business account/i',
            '/Verified business/i',
            '/Gold check/i'
        ],
        'gray' => [
            '/Government account/i',
            '/State-affiliated/i',
            '/Official account/i',
            '/Gray check/i'
        ],
        'blue' => [
            '/"is_blue_verified":true/i',
            '/Verified account/i',
            '/Blue check/i'
        ]
    ];

    foreach (['gold', 'gray', 'blue'] as $badge) {
        foreach ($checks[$badge] as $pattern) {
            if (preg_match($pattern, $html)) {
                return $badge;
            }
        }
    }

    return '';
}

function x_api_parse_oembed_text($html) {
    if (!$html) return '';
    $text = preg_replace('~<script\b[^>]*>.*?</script>~is', '', $html);
    $text = preg_replace('~<a\b[^>]*>pic\.twitter\.com/[^<]+</a>~i', '', $text);
    $text = strip_tags($text);
    $text = html_entity_decode($text, ENT_QUOTES | ENT_HTML5, 'UTF-8');
    $text = preg_replace('/\s+/', ' ', $text);
    return trim($text);
}

function x_api_extract_fxtwitter_data($data, $tweetId) {
    $tweet = is_array($data['tweet'] ?? null) ? $data['tweet'] : [];
    $author = is_array($tweet['author'] ?? null) ? $tweet['author'] : [];
    $media = is_array($tweet['media'] ?? null) ? $tweet['media'] : [];

    $images = [];
    $photos = is_array($media['photos'] ?? null) ? $media['photos'] : [];
    foreach ($photos as $photo) {
        $url = trim((string)($photo['url'] ?? ''));
        if ($url !== '') $images[] = $url;
    }
    if (empty($images)) {
        $videos = is_array($media['videos'] ?? null) ? $media['videos'] : [];
        foreach ($videos as $video) {
            $thumb = trim((string)($video['thumbnail_url'] ?? ''));
            $url = trim((string)($video['url'] ?? ''));
            if ($thumb !== '') $images[] = $thumb;
            elseif ($url !== '') $images[] = $url;
        }
    }
    if (empty($images)) {
        $external = is_array($media['external'] ?? null) ? $media['external'] : [];
        $thumb = trim((string)($external['thumbnail_url'] ?? ''));
        if ($thumb !== '') $images[] = $thumb;
    }

    $images = array_values(array_unique(array_filter($images, fn($value) => is_string($value) && $value !== '')));
    $image = '';
    if (!empty($images[0])) {
        $image = (string)$images[0];
    } else {
        $image = '';
    }

    return [
        'tweetId' => (string)($tweet['id'] ?? $tweetId),
        'authorName' => trim((string)($author['name'] ?? '')),
        'authorUrl' => trim((string)($author['url'] ?? '')),
        'username' => trim((string)($author['screen_name'] ?? '')),
        'text' => trim((string)($tweet['text'] ?? '')),
        'profileImage' => trim((string)($author['avatar_url'] ?? '')),
        'image' => trim((string)$image),
        'images' => $images
    ];
}

$oembedUrl = 'https://publish.twitter.com/oembed?omit_script=1&hide_thread=0&align=center&url=' . rawurlencode($url);
[$oembedResponse, $oembedError, $oembedStatus] = x_api_fetch($oembedUrl);
if ($oembedError || $oembedStatus >= 400 || !$oembedResponse) {
    http_response_code(502);
    echo json_encode(['error' => 'oEmbed verisi alinamadi.']);
    exit;
}

$oembed = json_decode($oembedResponse, true);
if (!is_array($oembed)) {
    http_response_code(502);
    echo json_encode(['error' => 'oEmbed yaniti parse edilemedi.']);
    exit;
}

$fxUrl = 'https://api.fxtwitter.com/' . ($screenName !== '' ? rawurlencode($screenName) . '/status/' : 'status/') . rawurlencode($tweetId);
[$fxResponse, $fxError, $fxStatus] = x_api_fetch($fxUrl);
$fxData = [];
if (!$fxError && $fxStatus < 400 && $fxResponse) {
    $parsedFx = json_decode($fxResponse, true);
    if (is_array($parsedFx) && (int)($parsedFx['code'] ?? 0) === 200) {
        $fxData = x_api_extract_fxtwitter_data($parsedFx, $tweetId);
    }
}

[$tweetHtml, $tweetError, $tweetStatus] = x_api_fetch($url);
$tweetHtml = is_string($tweetHtml) ? $tweetHtml : '';

$authorName = trim((string)($fxData['authorName'] ?? $oembed['author_name'] ?? ''));
$authorUrl = trim((string)($fxData['authorUrl'] ?? $oembed['author_url'] ?? ''));
$text = trim((string)($fxData['text'] ?? ''));
if ($text === '') {
    $text = x_api_parse_oembed_text((string)($oembed['html'] ?? ''));
}
$username = trim((string)($fxData['username'] ?? ''));
if ($username === '') {
    $username = x_api_extract_username($authorUrl, $url);
}
$profileImage = trim((string)($fxData['profileImage'] ?? ''));
if ($profileImage === '' && $tweetHtml !== '') {
    $profileImage = x_api_extract_profile_image($tweetHtml);
}
$badge = $tweetHtml !== '' ? x_api_detect_badge($tweetHtml) : '';
$image = '';
if (!empty($fxData['image'])) {
    $image = trim((string)$fxData['image']);
}
$images = array_values(array_unique(array_filter(is_array($fxData['images'] ?? null) ? $fxData['images'] : [], fn($value) => is_string($value) && trim($value) !== '')));
if ($tweetHtml !== '') {
    if (!$images) {
        $images = x_api_extract_media_images($tweetHtml);
    }
    if ($image === '') {
        $image = x_api_extract_media_image($tweetHtml);
    }
    if ($image === '') {
        $image = x_api_extract_og_image($tweetHtml);
    }
}
if ($image !== '' && !in_array($image, $images, true)) {
    array_unshift($images, $image);
}
if ($image === '' && !empty($images[0])) {
    $image = (string)$images[0];
}

echo json_encode([
    'tweetId' => $tweetId,
    'authorName' => $authorName,
    'authorUrl' => $authorUrl,
    'username' => $username,
    'text' => $text,
    'badge' => $badge,
    'profileImage' => $profileImage,
    'image' => $image,
    'images' => $images
], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
