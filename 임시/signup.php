<?php
// ========================================
// 🔥 에러 숨김 (프로덕션용)
// ========================================
error_reporting(0);
ini_set('display_errors', 0);

// ========================================
// JSON 헤더 먼저 출력
// ========================================
header('Content-Type: application/json; charset=utf-8');

// ========================================
// DB 연결
// ========================================
try {
    require_once 'connect.php';
} catch (Exception $e) {
    echo json_encode([
        "success" => false,
        "message" => "데이터베이스 연결 실패"
    ], JSON_UNESCAPED_UNICODE);
    exit;
}

// ========================================
// 1) 입력값 받기
// ========================================
$id       = trim($_POST['signupId'] ?? '');
$password = $_POST['password'] ?? '';
$name     = trim($_POST['name'] ?? '');
$phone    = trim($_POST['phone'] ?? '');
$email    = trim($_POST['email'] ?? '');

// ========================================
// 2) 필수 입력값 검사
// ========================================
if (!$id || !$password || !$name || !$phone || !$email) {
    echo json_encode([
        "success" => false,
        "message" => "모든 필드를 입력해주세요."
    ], JSON_UNESCAPED_UNICODE);
    exit;
}

// ========================================
// 3) 유효성 검증
// ========================================

// ID 길이 (4-20자)
if (strlen($id) < 4 || strlen($id) > 20) {
    echo json_encode([
        "success" => false,
        "message" => "아이디는 4-20자 사이여야 합니다."
    ], JSON_UNESCAPED_UNICODE);
    exit;
}

// 비밀번호 길이 (8자 이상)
if (strlen($password) < 8) {
    echo json_encode([
        "success" => false,
        "message" => "비밀번호는 8자 이상이어야 합니다."
    ], JSON_UNESCAPED_UNICODE);
    exit;
}

// 이메일 형식
if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
    echo json_encode([
        "success" => false,
        "message" => "올바른 이메일 형식이 아닙니다."
    ], JSON_UNESCAPED_UNICODE);
    exit;
}

try {
    // ========================================
    // 4) 아이디 중복 체크
    // ✅ IDsave (대문자 I, 대문자 S)
    // ========================================
    $checkStmt = $pdo->prepare("SELECT ID FROM idsave WHERE ID = ?");
    $checkStmt->execute([$id]);
    
    if ($checkStmt->fetch()) {
        echo json_encode([
            "success" => false,
            "message" => "이미 사용중인 아이디입니다."
        ], JSON_UNESCAPED_UNICODE);
        exit;
    }

    // ========================================
    // 5) 비밀번호 해시
    // ========================================
    $hashedPassword = password_hash($password, PASSWORD_DEFAULT);

    // ========================================
    // 6) IDsave INSERT
    // ========================================
    $insertStmt = $pdo->prepare("
        INSERT INTO idsave (ID, Password)
        VALUES (?, ?)
    ");
    
    if (!$insertStmt->execute([$id, $hashedPassword])) {
        echo json_encode([
            "success" => false,
            "message" => "회원가입 중 오류가 발생했습니다."
        ], JSON_UNESCAPED_UNICODE);
        exit;
    }

    // 새로 생성된 PK
    $usernum_pk = $pdo->lastInsertId();

    // ========================================
    // 7) IDsave.Usernum 업데이트
    // ========================================
    $updateStmt = $pdo->prepare("UPDATE idsave SET Usernum = ? WHERE inUsernum = ?");
    $updateStmt->execute([$usernum_pk, $usernum_pk]);

    // ========================================
    // 8) 환경정보 수집
    // ========================================
    $ip              = $_SERVER['REMOTE_ADDR'];
    $accept_language = $_SERVER['HTTP_ACCEPT_LANGUAGE'] ?? "";
    $referer         = $_SERVER['HTTP_REFERER'] ?? "";
    $user_agent      = $_SERVER['HTTP_USER_AGENT'] ?? "";
    $accept          = $_SERVER['HTTP_ACCEPT'] ?? "";
    $sec_fetch_site  = $_SERVER['HTTP_SEC_FETCH_SITE'] ?? "";
    $sec_fetch_mode  = $_SERVER['HTTP_SEC_FETCH_MODE'] ?? "";
    $sec_fetch_user  = $_SERVER['HTTP_SEC_FETCH_USER'] ?? "";
    $sec_fetch_dest  = $_SERVER['HTTP_SEC_FETCH_DEST'] ?? "";

    // ========================================
    // 9) useridinformation INSERT
    // ========================================
    $infoStmt = $pdo->prepare("
        INSERT INTO useridinformation 
        (usernum, ip, accept_language, referer, user_agent, accept,
         sec_fetch_site, sec_fetch_mode, sec_fetch_user, sec_fetch_dest)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ");
    
    $infoStmt->execute([
        $usernum_pk,
        $ip,
        $accept_language,
        $referer,
        $user_agent,
        $accept,
        $sec_fetch_site,
        $sec_fetch_mode,
        $sec_fetch_user,
        $sec_fetch_dest
    ]);

    // ========================================
    // 10) 성공 응답
    // ========================================
    echo json_encode([
        "success" => true,
        "message" => "회원가입이 완료되었습니다.",
        "usernum" => $usernum_pk,
        "id" => $id,
        "name" => $name
    ], JSON_UNESCAPED_UNICODE);

} catch (PDOException $e) {
    // 에러 로그 (서버 로그 파일에만 기록)
    error_log("회원가입 오류: " . $e->getMessage());
    
    echo json_encode([
        "success" => false,
        "message" => "회원가입 중 오류가 발생했습니다."
    ], JSON_UNESCAPED_UNICODE);
}
?>
