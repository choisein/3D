<?php
error_reporting(E_ALL);
ini_set('display_errors', 1);

require_once 'connect.php';
header('Content-Type: application/json; charset=utf-8');

// ========================================
// 1) 입력값 검사
// ========================================
$id       = $_POST['signupId'] ?? '';
$password = $_POST['password'] ?? '';

if (!$id || !$password) {
    echo json_encode([
        "success" => false,
        "message" => "아이디와 비밀번호를 입력해주세요."
    ], JSON_UNESCAPED_UNICODE);
    exit;
}

try {

    // ========================================
    // 2) 아이디 중복 체크
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
    // 3) 비밀번호 해시
    // ========================================
    $hashedPassword = password_hash($password, PASSWORD_DEFAULT);

    // ========================================
    // 4) idsave INSERT (PK=inUsernum 생성)
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

    // 새로 생성된 PK (inUsernum)
    $usernum_pk = $pdo->lastInsertId();

    // ========================================
    // 5) idsave.Usernum 업데이트 (FK 매칭용)
    // ========================================
    $updateStmt = $pdo->prepare("UPDATE idsave SET Usernum = ? WHERE inUsernum = ?");
    $updateStmt->execute([$usernum_pk, $usernum_pk]);

    // ========================================
    // 6) 환경정보 수집
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
    // 7) useridinformation INSERT
    // ========================================
    $infoStmt = $pdo->prepare("
        INSERT INTO useridinformation 
        (usernum, ip, accept_language, referer, user_agent, accept,
         sec_fetch_site, sec_fetch_mode, sec_fetch_user, sec_fetch_dest)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ");

    $infoStmt->execute([
        $usernum_pk,     // FK → idsave.Usernum
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
    // 8) 성공 응답
    // ========================================
    echo json_encode([
        "success" => true,
        "message" => "회원가입이 완료되었습니다.",
        "usernum" => $usernum_pk
    ], JSON_UNESCAPED_UNICODE);

} catch (PDOException $e) {

    echo json_encode([
        "success" => false,
        "message" => "DB 오류: " . $e->getMessage()
    ], JSON_UNESCAPED_UNICODE);
}
?>
