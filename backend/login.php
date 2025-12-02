<?php
// login.php - RBA(위험 기반 인증) 통합 버전
session_start();
error_reporting(0);
ini_set('display_errors', 0);

require_once 'connect.php';
header('Content-Type: application/json; charset=utf-8');

// ============================================
// 입력값 받기
// ============================================
$id = $_POST['loginId'] ?? '';
$password = $_POST['password'] ?? '';
$captchaVerified = $_POST['captchaVerified'] ?? 'false'; // 캡차 통과 여부

if (!$id || !$password) {
    echo json_encode([
        "success" => false, 
        "message" => "아이디와 비밀번호를 입력해주세요."
    ]);
    exit;
}

// ============================================
// HTTP 헤더 수집
// ============================================
$ip = $_SERVER['REMOTE_ADDR'];
$userAgent = $_SERVER['HTTP_USER_AGENT'] ?? '';
$referer = $_SERVER['HTTP_REFERER'] ?? '';
$acceptLanguage = $_SERVER['HTTP_ACCEPT_LANGUAGE'] ?? '';
$accept = $_SERVER['HTTP_ACCEPT'] ?? '';

// ============================================
// 위험도 점수 계산 (OWASP 기반)
// ============================================
$riskScore = 0;
$riskReasons = [];

// 1. IP 분석 (최대 3점)
$ipRisk = analyzeIP($ip, $pdo);
$riskScore += $ipRisk['score'];
if ($ipRisk['score'] > 0) {
    $riskReasons[] = $ipRisk['reason'];
}

// 2. User-Agent 분석 (최대 10점)
$uaRisk = analyzeUserAgent($userAgent);
$riskScore += $uaRisk['score'];
if ($uaRisk['score'] > 0) {
    $riskReasons[] = $uaRisk['reason'];
}

// 3. Accept-Language 분석 (최대 2점)
$langRisk = analyzeAcceptLanguage($acceptLanguage);
$riskScore += $langRisk['score'];
if ($langRisk['score'] > 0) {
    $riskReasons[] = $langRisk['reason'];
}

// 4. Referer 분석 (최대 2점)
$refererRisk = analyzeReferer($referer);
$riskScore += $refererRisk['score'];
if ($refererRisk['score'] > 0) {
    $riskReasons[] = $refererRisk['reason'];
}

// 5. Accept 헤더 분석 (최대 2점)
$acceptRisk = analyzeAccept($accept, $userAgent);
$riskScore += $acceptRisk['score'];
if ($acceptRisk['score'] > 0) {
    $riskReasons[] = $acceptRisk['reason'];
}

// 6. 로그인 속도 분석 (최대 5점)
$speedRisk = analyzeLoginSpeed($ip, $pdo);
$riskScore += $speedRisk['score'];
if ($speedRisk['score'] > 0) {
    $riskReasons[] = $speedRisk['reason'];
}

// ============================================
// 위험도에 따른 처리
// ============================================

// Case 1: 위험도 10점 이상 → 즉시 차단
if ($riskScore >= 10) {
    logLoginAttempt($pdo, null, $id, $ip, $userAgent, $referer, $acceptLanguage, $riskScore, 'blocked');
    
    echo json_encode([
        "success" => false,
        "blocked" => true,
        "message" => "보안 정책에 의해 로그인이 차단되었습니다.",
        "riskScore" => $riskScore,
        "reasons" => $riskReasons
    ], JSON_UNESCAPED_UNICODE);
    exit;
}

// Case 2: 위험도 4~9점 → 캡차 필요
if ($riskScore >= 4) {
    // 캡차를 아직 통과하지 않았다면
    if ($captchaVerified !== 'true') {
        logLoginAttempt($pdo, null, $id, $ip, $userAgent, $referer, $acceptLanguage, $riskScore, 'captcha_required');
        
        echo json_encode([
            "success" => false,
            "needCaptcha" => true,
            "message" => "의심스러운 활동이 감지되었습니다. 본인 인증을 완료해주세요.",
            "riskScore" => $riskScore,
            "reasons" => $riskReasons
        ], JSON_UNESCAPED_UNICODE);
        exit;
    }
}

// ============================================
// 실제 로그인 검증 (ID/PW 확인)
// ============================================
try {
    $stmt = $pdo->prepare("SELECT * FROM IDsave WHERE ID = ?");
    $stmt->execute([$id]);
    $user = $stmt->fetch(PDO::FETCH_ASSOC);

    // ========================================
// 사용자 인증 (비밀번호 검증)
// ========================================
if ($user && password_verify($password, $user['Password'])) {
    
    $usernum = $user['Usernum'];
    $ip = $_SERVER['REMOTE_ADDR'];
    $location = getLocationFromIP($ip);
    
    // ✅✅✅ 로그는 무조건 먼저 기록! (차단 여부와 상관없이)
    try {
        $logStmt = $pdo->prepare("
            INSERT INTO Loginlog (Usernum, IP, location, data)
            VALUES (?, ?, ?, NOW())
        ");
        $logStmt->execute([$usernum, $ip, $location]);
    } catch (PDOException $e) {
        error_log("로그 기록 실패: " . $e->getMessage());
    }
    
    // ========================================
    // 캡차 검증 확인
    // ========================================
    $captchaVerified = ($_POST['captchaVerified'] ?? 'false') === 'true';
    
    if (!$captchaVerified) {
        // RBA 분석
        $riskScore = 0;
        $riskReasons = [];
        
        // HTTP 헤더 분석
        $ipAnalysis = analyzeIP($ip, $pdo);
        $riskScore += $ipAnalysis['score'];
        if ($ipAnalysis['score'] > 0 && !empty($ipAnalysis['reason'])) {
            $riskReasons[] = $ipAnalysis['reason'];
        }

        $uaAnalysis = analyzeUserAgent($userAgent);
        $riskScore += $uaAnalysis['score'];
        if ($uaAnalysis['score'] > 0 && !empty($uaAnalysis['reason'])) {
            $riskReasons[] = $uaAnalysis['reason'];
        }

        $acceptLangAnalysis = analyzeAcceptLanguage($acceptLanguage);
        $riskScore += $acceptLangAnalysis['score'];
        if ($acceptLangAnalysis['score'] > 0 && !empty($acceptLangAnalysis['reason'])) {
            $riskReasons[] = $acceptLangAnalysis['reason'];
        }

        $refererAnalysis = analyzeReferer($referer);
        $riskScore += $refererAnalysis['score'];
        if ($refererAnalysis['score'] > 0 && !empty($refererAnalysis['reason'])) {
            $riskReasons[] = $refererAnalysis['reason'];
        }

        $acceptAnalysis = analyzeAccept($accept, $userAgent);   
        $riskScore += $acceptAnalysis['score'];
        if (!empty($acceptAnalysis['reasons'])) {
            $riskReasons = array_merge($riskReasons, $acceptAnalysis['reasons']);
        }

        $speedAnalysis = analyzeLoginSpeed($ip, $pdo);
        $riskScore += $speedAnalysis['score'];
        if ($speedAnalysis['score'] > 0 && !empty($speedAnalysis['reason'])) {
            $riskReasons[] = $speedAnalysis['reason'];
        }
        // ========================================
        // 위험도 판정 (로그는 이미 기록됨!)
        // ========================================
        if ($riskScore >= 10) {
            // 즉시 차단
            echo json_encode([
                "success" => false,
                "blocked" => true,
                "message" => "보안 정책에 의해 로그인이 차단되었습니다.",
                "riskScore" => $riskScore,
                "reasons" => $riskReasons
            ], JSON_UNESCAPED_UNICODE);
            exit;
        }
        
        if ($riskScore >= 4) {
            // 캡차 요구
            echo json_encode([
                "success" => false,
                "needCaptcha" => true,
                "message" => "추가 인증이 필요합니다.",
                "riskScore" => $riskScore,
                "reasons" => $riskReasons
            ], JSON_UNESCAPED_UNICODE);
            exit;
        }
    }
    
    // ========================================
    // 로그인 성공
    // ========================================
    session_start();
    $_SESSION['usernum'] = $usernum;
    $_SESSION['id'] = $id;
    
    echo json_encode([
        "success" => true,
        "message" => "로그인 성공",
        "id" => $id,
        "name" => $id,
        "usernum" => $usernum,
        "location" => $location,
        "riskScore" => $riskScore ?? 0
    ], JSON_UNESCAPED_UNICODE);
    
} else {
    // ========================================
    // 로그인 실패 (잘못된 비밀번호)
    // ========================================
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

// ============================================
// 분석 함수들
// ============================================

/**
 * IP 분석
 */
function analyzeIP($ip, $pdo) {
    $score = 0;
    $reason = '';
    
    // 로컬호스트는 정상
    if ($ip === '127.0.0.1' || $ip === '::1') {
        return ['score' => 0, 'reason' => ''];
    }
    
    // 최근 1분간 동일 IP에서 5회 이상 시도 → 의심
    try {
        $stmt = $pdo->prepare("
            SELECT COUNT(*) as cnt 
            FROM Loginlog 
            WHERE IP = ? 
            AND data >= DATE_SUB(NOW(), INTERVAL 1 MINUTE)
        ");
        $stmt->execute([$ip]);
        $result = $stmt->fetch();
        
        if ($result['cnt'] >= 5) {
            $score += 3;
            $reason = "단시간 다중 시도 ({$result['cnt']}회)";
        }
    } catch (Exception $e) {
        // 오류 무시
    }
    
    return ['score' => $score, 'reason' => $reason];
}

/**
 * User-Agent 분석
 */
function analyzeUserAgent($ua) {
    $score = 0;
    $reason = '';
    
    // User-Agent 없음
    if (empty($ua)) {
        return ['score' => 1, 'reason' => 'User-Agent 누락'];
    }
    
    // 봇/스캐너 키워드
    $botKeywords = ['bot', 'crawler', 'spider', 'scraper', 'curl', 'wget', 'python', 'java', 'go-http'];
    foreach ($botKeywords as $keyword) {
        if (stripos($ua, $keyword) !== false) {
            return ['score' => 10, 'reason' => '봇 User-Agent 감지'];
        }
    }
    
    // 정상적인 브라우저인지 확인
    $validBrowsers = ['Chrome', 'Firefox', 'Safari', 'Edge', 'Opera'];
    $hasValidBrowser = false;
    foreach ($validBrowsers as $browser) {
        if (stripos($ua, $browser) !== false) {
            $hasValidBrowser = true;
            break;
        }
    }
    
    if (!$hasValidBrowser) {
        $score += 2;
        $reason = '비표준 브라우저';
    }
    
    return ['score' => $score, 'reason' => $reason];
}

/**
 * Accept-Language 분석
 */
function analyzeAcceptLanguage($lang) {
    if (empty($lang)) {
        return ['score' => 2, 'reason' => 'Accept-Language 누락'];
    }
    return ['score' => 0, 'reason' => ''];
}

/**
 * Referer 분석
 */
function analyzeReferer($referer) {
    // Referer가 없으면 약간 의심 (직접 접근 가능성)
    if (empty($referer)) {
        return ['score' => 2, 'reason' => 'Referer 누락'];
    }
    return ['score' => 0, 'reason' => ''];
}

/**
 * Accept 헤더 분석
 */
function analyzeAccept($accept, $userAgent) {
    $score = 0;
    $reasons = [];
    
    // Accept 헤더가 아예 없는 경우
    if (empty($accept)) {
        $score += 2;
        $reasons[] = "Accept 헤더 누락";
        return ['score' => $score, 'reasons' => $reasons];
    }
    
    // ✅ 브라우저 판단 로직 개선
    $isBrowser = false;
    
    // Chrome, Firefox, Safari, Edge 등 주요 브라우저 체크
    $browserPatterns = [
        'Chrome', 'Firefox', 'Safari', 'Edge', 
        'Opera', 'Brave', 'Vivaldi', 'Samsung'
    ];
    
    foreach ($browserPatterns as $browser) {
        if (stripos($userAgent, $browser) !== false) {
            $isBrowser = true;
            break;
        }
    }
    
    // ✅ 모바일 브라우저 체크
    $mobilePatterns = ['Mobile', 'Android', 'iPhone', 'iPad'];
    foreach ($mobilePatterns as $mobile) {
        if (stripos($userAgent, $mobile) !== false) {
            $isBrowser = true;
            break;
        }
    }
    
    // 브라우저인데 Accept 헤더 검증
    if ($isBrowser) {
        // ✅ text/html 또는 application/xhtml+xml 또는 */* 포함 여부만 체크
        $validAccepts = ['text/html', 'application/xhtml+xml', '*/*', 'text/*'];
        $hasValidAccept = false;
        
        foreach ($validAccepts as $valid) {
            if (stripos($accept, $valid) !== false) {
                $hasValidAccept = true;
                break;
            }
        }
        
        // ❌ 브라우저인데 유효한 Accept가 하나도 없으면
        if (!$hasValidAccept) {
            $score += 10;
            $reasons[] = "브라우저인데 Accept 헤더 불일치";
        }
    }
    
    return ['score' => $score, 'reasons' => $reasons];
}

/**
 * 로그인 속도 분석 (세션 기반)
 */
function analyzeLoginSpeed($ip, $pdo) {
    $score = 0;
    $reason = '';
    
    // 세션에 마지막 시도 시간 확인
    if (!isset($_SESSION['last_login_attempt'])) {
        $_SESSION['last_login_attempt'] = time();
        return ['score' => 0, 'reason' => ''];
    }
    
    $interval = time() - $_SESSION['last_login_attempt'];
    $_SESSION['last_login_attempt'] = time();
    
    // 1초 이내 재시도 → 매우 의심
    if ($interval < 1) {
        $score += 5;
        $reason = '매우 빠른 재시도 (1초 이내)';
    }
    // 2초 이내 재시도 → 의심
    else if ($interval < 2) {
        $score += 3;
        $reason = '빠른 재시도 (2초 이내)';
    }
    
    return ['score' => $score, 'reason' => $reason];
}

/**
 * IP 기반 위치 정보 가져오기
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

/**
 * 로그인 시도 기록 (안전 버전)
 */
function logLoginAttempt($pdo, $usernum, $id, $ip, $userAgent, $referer, $acceptLanguage, $riskScore, $result) {
    try {
        $location = getLocationFromIP($ip);
        
        // ✅ 기본 컬럼만 사용 (Usernum, IP, location, data)
        $stmt = $pdo->prepare("
            INSERT INTO Loginlog 
            (Usernum, IP, location, data) 
            VALUES (?, ?, ?, NOW())
        ");
        
        $stmt->execute([
            $usernum,
            $ip,
            $location
        ]);
        
        // ✅ 추가 정보는 별도 로그 파일에 기록 (선택사항)
        $logData = [
            'timestamp' => date('Y-m-d H:i:s'),
            'usernum' => $usernum,
            'id' => $id,
            'ip' => $ip,
            'user_agent' => $userAgent,
            'referer' => $referer,
            'accept_language' => $acceptLanguage,
            'risk_score' => $riskScore,
            'result' => $result
        ];
        
        error_log("LOGIN_ATTEMPT: " . json_encode($logData, JSON_UNESCAPED_UNICODE));
        
    } catch (PDOException $e) {
        error_log("Login log failed: " . $e->getMessage());
    }
}
?>
