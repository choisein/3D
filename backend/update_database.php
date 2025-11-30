<?php
require_once 'connect.php';

try {
    // 컬럼 추가
    $pdo->exec("
        ALTER TABLE Loginlog 
        ADD COLUMN risklevel INT DEFAULT 0 COMMENT '위험도 점수',
        ADD COLUMN user_agent TEXT COMMENT 'User-Agent 헤더',
        ADD COLUMN referer VARCHAR(500) COMMENT 'Referer 헤더',
        ADD COLUMN accept_language VARCHAR(200) COMMENT 'Accept-Language 헤더',
        ADD COLUMN login_result ENUM('success', 'fail', 'blocked', 'captcha_required') DEFAULT 'fail' COMMENT '로그인 결과'
    ");
    
    echo "✅ 컬럼 추가 완료<br>";
    
    // 인덱스 추가
    $pdo->exec("ALTER TABLE Loginlog ADD INDEX idx_ip (IP)");
    echo "✅ IP 인덱스 추가 완료<br>";
    
    $pdo->exec("ALTER TABLE Loginlog ADD INDEX idx_usernum (Usernum)");
    echo "✅ Usernum 인덱스 추가 완료<br>";
    
    $pdo->exec("ALTER TABLE Loginlog ADD INDEX idx_risklevel (risklevel)");
    echo "✅ risklevel 인덱스 추가 완료<br>";
    
    echo "<hr><strong>🎉 데이터베이스 업데이트 완료!</strong>";
    
} catch (PDOException $e) {
    echo "❌ 오류: " . $e->getMessage();
}
?>