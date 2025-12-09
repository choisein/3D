<?php
header("Content-Type: application/json; charset=utf-8");

// DB 연결
require_once "connect.php";  // PDO 객체: $pdo 제공

// ------------------------------
// 요청값
// ------------------------------
$page   = isset($_GET['page']) ? intval($_GET['page']) : 1;
$filter = isset($_GET['filter']) ? $_GET['filter'] : "all";

$limit = 20;
$offset = ($page - 1) * $limit;

// ------------------------------
// 필터 조건
// ------------------------------
$where = "";

if ($filter === "suspicious") {
    // 위험 점수 높음 (예: 40 이상)
    $where = "WHERE riskscore >= 40";
} elseif ($filter === "blocked") {
    // 성공 여부가 0(실패)인 경우 차단된 시도로 간주
    $where = "WHERE success = 0";
}

// ------------------------------
// SQL 실행
// ------------------------------
$sql = "SELECT * FROM loginlog
        $where
        ORDER BY date DESC
        LIMIT :offset, :limit";

$stmt = $pdo->prepare($sql);
$stmt->bindValue(":offset", $offset, PDO::PARAM_INT);
$stmt->bindValue(":limit", $limit, PDO::PARAM_INT);
$stmt->execute();

$result = $stmt->fetchAll(PDO::FETCH_ASSOC);

// ------------------------------
// JSON 생성 (JS 구조에 맞춤)
// ------------------------------
$logs = [];

foreach ($result as $row) {
    $logs[] = [
        "time"      => $row["date"],
        "userId"    => $row["Usernum"],
        "ip"        => $row["IP"],
        "location"  => $row["location"],
        "riskScore" => intval($row["riskscore"]),
        "riskLevel" => $row["risklevel"],
        "success"   => intval($row["success"])
    ];
}

// ------------------------------
// JSON 출력
// ------------------------------
echo json_encode([
    "logs" => $logs
], JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
