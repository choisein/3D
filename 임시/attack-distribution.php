<?php
header("Content-Type: application/json; charset=utf-8");
require_once "connect.php";

// ============================
// 0) 전체 로그 수
// ============================
$totalQuery = $pdo->query("SELECT COUNT(*) FROM loginlog");
$total = (int)$totalQuery->fetchColumn();

if ($total === 0) {
    echo json_encode([
        "ipDistribution" => 0,
        "userAgentAnomaly" => 0,
        "refererMismatch" => 0,
        "languageAnomaly" => 0
    ]);
    exit;
}

// ============================
// 1) IP 기반 이상
// (IP가 localhost, 내부망, 이상패턴 포함)
// ============================
$q1 = $pdo->query("
    SELECT COUNT(*) FROM loginlog
    WHERE IP LIKE '127.%'
       OR IP LIKE '::1'
       OR IP LIKE '%:%'        -- IPv6
");
$ip = (int)$q1->fetchColumn();

// ============================
// 2) User-Agent 이상 → 없음
//    대체 기준: riskscore 5~7 구간
// ============================
$q2 = $pdo->query("
    SELECT COUNT(*) FROM loginlog
    WHERE riskscore BETWEEN 5 AND 7
");
$ua = (int)$q2->fetchColumn();

// ============================
// 3) Referer 없음 → loginlog에 없음
//    대체 기준: success = 0
// ============================
$q3 = $pdo->query("
    SELECT COUNT(*) FROM loginlog
    WHERE success = 0
");
$ref = (int)$q3->fetchColumn();

// ============================
// 4) 언어 이상 → loginlog에 없음
//    대체 기준: location 빈 값
// ============================
$q4 = $pdo->query("
    SELECT COUNT(*) FROM loginlog
    WHERE location IS NULL OR location = ''
");
$lang = (int)$q4->fetchColumn();

// ============================
// 백분율 계산 함수
// ============================
function pct($count, $total) {
    if ($total == 0) return 0;
    return round(($count / $total) * 100);
}

// ============================
// JSON 출력
// ============================
echo json_encode([
    "ipDistribution"   => pct($ip, $total),
    "userAgentAnomaly" => pct($ua, $total),
    "refererMismatch"  => pct($ref, $total),
    "languageAnomaly"  => pct($lang, $total)
], JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
