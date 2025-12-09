<?php
session_start();

$reaction = intval($_POST['reaction']);

// 기준값 예시
if ($reaction > 2000) {  // 2초 이상 → 너무 느림 (봇일 가능성 높음)
    echo json_encode([
        "status" => "fail",
        "message" => "반응이 너무 느립니다. 다시 시도해주세요."
    ]);
    exit;
}

if ($reaction < 80) {  // 0.08초 이하 → 사람이 누르기 불가능 → 봇
    echo json_encode([
        "status" => "fail",
        "message" => "비정상적인 속도감지. 다시 시도해주세요."
    ]);
    exit;
}

// 인증 성공
unset($_SESSION['requires_human_test']);

echo json_encode([
    "status" => "success",
    "message" => "인증이 완료되었습니다."
]);
?>
