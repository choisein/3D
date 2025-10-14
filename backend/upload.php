<?php
// MySQL 연결
include(__DIR__ . '/connect.php');

// ID 자료 파일 연결
$filename = __DIR__ . '/../사용자계정/web_service_accounts.csv';

// 자료 열기 시도
if (($handle = fopen($filename, "r")) !== FALSE) {
    fgetcsv($handle); // 헤더 건너뛰기

    $successcount = 0;
    $failcount = 0;
    $skipcount = 0;

    while (($data = fgetcsv($handle, 1000, ",")) !== FALSE) {
        $id = trim($data[0]);
        $firpassword = trim($data[1]);
        $secpaddword = password_hash($firpassword, PASSWORD_DEFAULT);

        // ID 중복 여부 확인
        $check = $pdo->prepare("SELECT ID FROM IDsave WHERE ID = ?");
        $check->execute([$id]);
        $existing = $check->fetch();

        if ($existing) {
            echo "계정이 이미 존재 - {$id} -> 건너뛰기<br>";
            $skipcount++;
            continue;
        }

        // DB에 삽입
        $stmt = $pdo->prepare("INSERT INTO IDsave (ID, Password) VALUES (?, ?)");
        if ($stmt->execute([$id, $secpaddword])) {
            echo "계정 등록 성공: {$id}<br>";
            $successcount++;
        } else {
            echo "계정 등록 실패: {$id}<br>";
            $failcount++;
        }
    }

    fclose($handle);
    echo "<hr> CSV 등록 완료<br>";
    echo "성공 - {$successcount}<br>";
    echo "건너뜀 - {$skipcount}<br>";
    echo "실패 - {$failcount}<br>";

} else {
    echo "CSV 파일을 열 수 없음";
}
?>
