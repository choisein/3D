<?php
header("Content-Type: application/json; charset=utf-8");
require_once "connect.php";

// 1) 전체 로그인 시도
$q1 = $pdo->query("SELECT COUNT(*) FROM loginlog");
$totalLoginAttempts = (int)$q1->fetchColumn();

// 2) 공격 시도로 간주하는 값 (riskscore >= 7)
$q2 = $pdo->query("SELECT COUNT(*) FROM loginlog WHERE riskscore >= 7");
$detectedAttacks = (int)$q2->fetchColumn();

// 3) 2차 방어(실패한 로그인 success=0)
$q3 = $pdo->query("SELECT COUNT(*) FROM loginlog WHERE success = 0");
$secondaryDefenseCount = (int)$q3->fetchColumn();

echo json_encode([
    "totalLoginAttempts" => $totalLoginAttempts,
    "detectedAttacks" => $detectedAttacks,
    "secondaryDefenseCount" => $secondaryDefenseCount
], JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
