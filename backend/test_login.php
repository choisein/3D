<?php
// test_login_batch.php
// Usage: php test_login_batch.php
// Requires: connect.php (provides $pdo)
// Default input: ../사용자계정/attack_accounts.csv
// Default output: ../사용자계정/attack_results.csv

// 설정(필요 시 경로 수정)
$inputCsv = __DIR__ . '/../사용자계정/successful_attack_accounts.csv';
$outputCsv = __DIR__ . '/../사용자계정/successful_attack_results.csv';

// 옵션: true로 바꾸면 DB에 저장된 해시 비교 없이 ID 존재만으로 로그 삽입 (테스트 전용)
$BYPASS_PASSWORD_CHECK = false;

if (!file_exists($inputCsv)) {
    echo "ERROR: input CSV not found: $inputCsv\n";
    exit(1);
}

// DB 연결 (connect.php에서 $pdo 생성)
require_once __DIR__ . '/connect.php';
if (!isset($pdo) || !$pdo instanceof PDO) {
    echo "ERROR: \$pdo not available from connect.php\n";
    exit(1);
}

// 준비문
$selectUserStmt = $pdo->prepare("SELECT Usernum, Password FROM IDsave WHERE ID = ? LIMIT 1");
$insertLogStmt  = $pdo->prepare("INSERT INTO Loginlog (Usernum, IP, location, data) VALUES (?, ?, ?, NOW())");

// 입출력 파일 열기
$in = fopen($inputCsv, 'r');
if (!$in) {
    echo "ERROR: cannot open input CSV\n";
    exit(1);
}
$out = fopen($outputCsv, 'w');
if (!$out) {
    echo "ERROR: cannot open output CSV for write\n";
    exit(1);
}

// 출력 헤더
fputcsv($out, ['id','password','result','usernum','logged_insert_id','message','timestamp']);

// 건너뛰기/처리
$rowNum = 0;
while (($row = fgetcsv($in)) !== false) {
    $rowNum++;
    // skip empty lines
    if (count($row) < 2) continue;
    // skip header if first row looks like header
    if ($rowNum === 1 && preg_match('/id/i', $row[0])) continue;

    $id = trim($row[0]);
    $pw = trim($row[1]);

    if ($id === '') {
        fputcsv($out, [$id, $pw, 'skipped_empty_id', '', '', 'Empty ID', date('c')]);
        echo "[$rowNum] skip empty id\n";
        continue;
    }

    try {
        // 사용자 조회
        $selectUserStmt->execute([$id]);
        $user = $selectUserStmt->fetch(PDO::FETCH_ASSOC);

        if (!$user) {
            // ID 없음
            fputcsv($out, [$id, $pw, 'no_user', '', '', 'ID not found', date('c')]);
            echo "[$rowNum] $id -> no_user\n";
            continue;
        }

        $usernum = isset($user['Usernum']) ? intval($user['Usernum']) : null;
        $storedHash = $user['Password'] ?? '';

        $ok = false;
        if ($BYPASS_PASSWORD_CHECK) {
            $ok = true;
        } else {
            // password_verify 사용
            if ($storedHash !== '' && password_verify($pw, $storedHash)) {
                $ok = true;
            } else {
                $ok = false;
            }
        }

        if ($ok) {
            // 로그 삽입 (IP/location 기본값 사용)
            $ip = '127.0.0.1';
            $location = 'Localhost';
            $insertLogStmt->execute([$usernum, $ip, $location]);
            $insertId = $pdo->lastInsertId();

            fputcsv($out, [$id, $pw, 'logged', $usernum, $insertId, 'Inserted into Loginlog', date('c')]);
            echo "[$rowNum] $id -> logged (usernum={$usernum}, insertId={$insertId})\n";
        } else {
            fputcsv($out, [$id, $pw, 'bad_password', $usernum, '', 'Password mismatch', date('c')]);
            echo "[$rowNum] $id -> bad_password\n";
        }
    } catch (PDOException $e) {
        fputcsv($out, [$id, $pw, 'db_error', '', '', $e->getMessage(), date('c')]);
        echo "[$rowNum] $id -> DB ERROR: " . $e->getMessage() . "\n";
    }
}

fclose($in);
fclose($out);
echo "Done. Results written to: $outputCsv\n";
