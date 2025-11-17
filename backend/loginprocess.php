<?php
session_start();
include "connect.php";

// 사용자 입력
$username = $_POST['username'];
$password = $_POST['password'];

// risklevel 계산 함수 (너가 만든 방식으로 계산 가능)
function calculateRiskLevel() {
    $risk = 0;

    // 예시: IP, user-agent, 빠른 반복 요청 등
    if (!isset($_SESSION['last_login_attempt'])) {
        $_SESSION['last_login_attempt'] = time();
    } else {
        $interval = time() - $_SESSION['last_login_attempt'];
        if ($interval < 2) $risk += 5; // 너무 빠른 요청 → 위험
        if ($interval < 1) $risk += 7; // 매우 빠른 요청 → 매우 위험
    }
    $_SESSION['last_login_attempt'] = time();

    // 기본 예시
    if (strpos($_SERVER['HTTP_USER_AGENT'], "bot") !== false) {
        $risk += 10;
    }

    return $risk;
}

$risklevel = calculateRiskLevel();

// 로그인 시도 로그 기록
$stmt = $conn->prepare("INSERT INTO loginlog (username, ip, user_agent, risklevel) VALUES (?, ?, ?, ?)");
$stmt->bind_param("sssi", $username, $_SERVER['REMOTE_ADDR'], $_SERVER['HTTP_USER_AGENT'], $risklevel);
$stmt->execute();

// 1) 매우 위험 (risklevel >= 10) → 로그인 차단
if ($risklevel >= 10) {
    echo json_encode([
        "status" => "blocked",
        "message" => "자동화 공격이 감지되어 로그인 시도가 차단되었습니다.",
        "risk" => $risklevel
    ]);
    exit;
}

// 2) 위험 (risklevel 5~9) → 추가 인증(인간 판별 시험)
if ($risklevel >= 5) {
    $_SESSION['requires_human_test'] = true;
    echo json_encode([
        "status" => "need_test",
        "message" => "의심스러운 활동이 감지되었습니다. 추가 인증을 완료해주세요.",
        "risk" => $risklevel
    ]);
    exit;
}

// 3) 정상 위험도 → 실제 로그인 검증
$stmt = $conn->prepare("SELECT * FROM users WHERE username=? AND password=? LIMIT 1");
$stmt->bind_param("ss", $username, $password);
$stmt->execute();
$result = $stmt->get_result();

if ($result->num_rows == 1) {
    $_SESSION['username'] = $username;
    echo json_encode(["status" => "ok"]);
} else {
    echo json_encode(["status" => "fail"]);
}
?>
