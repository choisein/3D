<?php
// 🚫 에러 HTML 노출 방지
error_reporting(0);
ini_set('display_errors', 0);

require_once 'connect.php';
header('Content-Type: application/json; charset=utf-8');

// ✅ 입력값 받기
$id = $_POST['loginId'] ?? '';
$password = $_POST['password'] ?? '';

if (!$id || !$password) {
    echo json_encode(["success" => false, "message" => "아이디와 비밀번호를 입력해주세요."]);
    exit;
}

try {
    // ✅ 사용자 확인
    $stmt = $pdo->prepare("SELECT * FROM IDsave WHERE ID = ?");
    $stmt->execute([$id]);
    $user = $stmt->fetch(PDO::FETCH_ASSOC);

    // ✅ 비밀번호 검증
    if ($user && password_verify($password, $user['Password'])) {

        // --- 로그인 성공 시 ---
        $usernum = $user['Usernum']; // ✅ IDsave의 Usernum (정수형)
        $ip = $_SERVER['REMOTE_ADDR'];
        $location = getLocationFromIP($ip);

        // ✅ 로그인 로그 기록
        $logStmt = $pdo->prepare("
            INSERT INTO Loginlog (Usernum, IP, location, data)
            VALUES (?, ?, ?, NOW())
        ");
        $logStmt->execute([$usernum, $ip, $location]);

        // ✅ 성공 응답
        echo json_encode([
            "success" => true,
            "message" => "로그인 성공",
            "usernum" => $usernum,
            "ip" => $ip,
            "location" => $location
        ], JSON_UNESCAPED_UNICODE);

    } else {
        // 로그인 실패
        echo json_encode([
            "success" => false,
            "message" => "아이디 또는 비밀번호가 일치하지 않습니다."
        ], JSON_UNESCAPED_UNICODE);
    }

} catch (PDOException $e) {
    echo json_encode([
        "success" => false,
        "message" => "DB 오류 발생: " . $e->getMessage()
    ], JSON_UNESCAPED_UNICODE);
    exit;
}

/**
 * ✅ IP 기반 위치 정보 가져오기 (간단 버전)
 */
function getLocationFromIP($ip) {
    if ($ip === '127.0.0.1' || $ip === '::1') {
        return 'Localhost';
    }

    $apiURL = "http://ip-api.com/json/{$ip}?fields=country,city";
    $response = @file_get_contents($apiURL);
    if ($response) {
        $data = json_decode($response, true);
        if (isset($data['country']) && isset($data['city'])) {
            return "{$data['country']} {$data['city']}";
        }
    }
    return 'Unknown';
}
?>
