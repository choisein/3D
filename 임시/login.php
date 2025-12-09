<?php
header("Content-Type: application/json; charset=utf-8");

// 에러는 로그에만 남기기
error_reporting(E_ALL);
ini_set("display_errors", 0);
ini_set("log_errors", 1);
ini_set("error_log", __DIR__ . "/php-error.log");

require_once "connect.php"; // $pdo
$pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

if (session_status() === PHP_SESSION_NONE) {
    session_start();
}

/* =====================================================
 * 1. 입력값
 * ===================================================== */
$id              = $_POST['loginId']        ?? '';
$password        = $_POST['password']       ?? '';
$captchaVerified = $_POST['captchaVerified'] ?? 'false';  // "true" / "false"

if (!$id || !$password) {
    echo json_encode([
        "success" => false,
        "message" => "아이디와 비밀번호를 입력해주세요."
    ], JSON_UNESCAPED_UNICODE);
    exit;
}

/* =====================================================
 * 2. 현재 요청 HTTP 헤더
 * ===================================================== */
$new_ip             = $_SERVER['REMOTE_ADDR']             ?? '';
$new_ua             = $_SERVER['HTTP_USER_AGENT']         ?? '';
$new_accept         = $_SERVER['HTTP_ACCEPT']             ?? '';
$new_lang           = $_SERVER['HTTP_ACCEPT_LANGUAGE']    ?? '';
$new_referer        = $_SERVER['HTTP_REFERER']            ?? '';
$new_sec_fetch_site = $_SERVER['HTTP_SEC_FETCH_SITE']     ?? '';
$new_sec_fetch_mode = $_SERVER['HTTP_SEC_FETCH_MODE']     ?? '';
$new_sec_fetch_dest = $_SERVER['HTTP_SEC_FETCH_DEST']     ?? '';
$new_sec_fetch_user = $_SERVER['HTTP_SEC_FETCH_USER']     ?? '';

/* =====================================================
 * 3. DB: 사용자 조회 (idsave)
 * ===================================================== */
try {
    $stmt = $pdo->prepare("
        SELECT Usernum, ID, Password
        FROM idsave
        WHERE LOWER(ID) = LOWER(?)
        LIMIT 1
    ");
    $stmt->execute([$id]);
    $user = $stmt->fetch(PDO::FETCH_ASSOC);

    $usernum = $user ? (int)$user['Usernum'] : null;

    /* =================================================
     * 4. useridinformation 에서 과거 헤더 정보 가져오기
     *    (user_ip_history, user_ua_history, user_language_history 생성)
     * ================================================= */
    $user_ip_history        = [];
    $user_ua_history        = [];
    $user_language_history  = [];

    if ($usernum !== null) {
        // 한 사용자에 대해 최근 N개 정도만 사용 (여기선 5개 예시)
        $histStmt = $pdo->prepare("
            SELECT ip, user_agent, accept_language
            FROM useridinformation
            WHERE usernum = ?
            ORDER BY log_time DESC
            LIMIT 5
        ");
        $histStmt->execute([$usernum]);
        $rows = $histStmt->fetchAll(PDO::FETCH_ASSOC);

        foreach ($rows as $r) {
            if (!empty($r['ip']))              $user_ip_history[]       = $r['ip'];
            if (!empty($r['user_agent']))      $user_ua_history[]       = $r['user_agent'];
            if (!empty($r['accept_language'])) $user_language_history[] = $r['accept_language'];
        }
    }

    /* =================================================
     * 5. scoring.py 로직 기반으로 위험도 계산
     * ================================================= */
    $riskScore = calculate_integrated_login_score_php(
        $new_ip,
        $new_ua,
        $new_accept,
        $new_lang,
        $new_referer,
        $new_sec_fetch_site,
        $new_sec_fetch_mode,
        $new_sec_fetch_dest,
        $new_sec_fetch_user,
        $user_ip_history,
        $user_ua_history,
        $user_language_history
    );

    $action = determine_security_action_php($riskScore);

    // ====== 5-1. 점수 기준에 따른 차단/캡차 처리 ======
    if ($action === 'BLOCK_AND_REDIRECT_MAIN') {
        log_login_attempt($pdo, $usernum, $id, $new_ip, $new_ua, $new_referer,
                          $new_lang, $riskScore, 0); // success=0

        echo json_encode([
            "success"   => false,
            "blocked"   => true,
            "message"   => "보안 정책에 의해 로그인이 차단되었습니다.",
            "riskScore" => $riskScore
        ], JSON_UNESCAPED_UNICODE);
        exit;
    }

    if ($action === 'REQUIRE_CAPTCHA' && $captchaVerified !== 'true') {
        log_login_attempt($pdo, $usernum, $id, $new_ip, $new_ua, $new_referer,
                          $new_lang, $riskScore, 0); // success=0

        echo json_encode([
            "success"     => false,
            "needCaptcha" => true,
            "message"     => "의심스러운 활동이 감지되었습니다. 캡차 인증을 완료해주세요.",
            "riskScore"   => $riskScore
        ], JSON_UNESCAPED_UNICODE);
        exit;
    }

    /* =================================================
     * 6. 아이디 / 비밀번호 실제 검증
     * ================================================= */
    if (!$user || !password_verify($password, $user['Password'])) {

        log_login_attempt($pdo, $usernum, $id, $new_ip, $new_ua, $new_referer,
                          $new_lang, $riskScore, 0); // 실패

        echo json_encode([
            "success" => false,
            "message" => "아이디 또는 비밀번호가 일치하지 않습니다."
        ], JSON_UNESCAPED_UNICODE);
        exit;
    }

    /* =================================================
     * 7. 여기까지 도달 = 점수 허용 + 캡차통과 + 비밀번호 일치
     * ================================================= */
    $_SESSION['usernum'] = $usernum;
    $_SESSION['id']      = $id;

    log_login_attempt($pdo, $usernum, $id, $new_ip, $new_ua, $new_referer,
                      $new_lang, $riskScore, 1); // 성공

    echo json_encode([
        "success"   => true,
        "message"   => "로그인 성공",
        "id"        => $id,
        "name"      => $id,
        "usernum"   => $usernum,
        "location"  => get_location_from_ip($new_ip),
        "riskScore" => $riskScore
    ], JSON_UNESCAPED_UNICODE);
    exit;

} catch (PDOException $e) {
    error_log("DB 오류: " . $e->getMessage());
    echo json_encode([
        "success" => false,
        "message" => "DB 오류 발생: " . $e->getMessage()
    ], JSON_UNESCAPED_UNICODE);
    exit;
}

/* =====================================================
 * 8. scoring.py 내용 PHP 버전
 * ===================================================== */

function get_location_from_ip($ip) {
    if ($ip === '127.0.0.1' || $ip === '::1') {
        return 'Localhost';
    }
    $url  = "http://ip-api.com/json/{$ip}?fields=country,city";
    $resp = @file_get_contents($url);
    if ($resp) {
        $data = json_decode($resp, true);
        if (!empty($data['country']) && !empty($data['city'])) {
            return $data['country'] . ' ' . $data['city'];
        }
    }
    return 'Unknown';
}

/* ---------- scoring.py 와 동일한 상수들 ---------- */
function get_scoring_globals() {
    static $inited = false, $data = null;
    if ($inited) return $data;

    $LOCATION_DATA = [
        'Korea' => [
            'ip_prefixes' => ['118.34','211.178','175.209','59.15','220.76','118.35','211.179','175.210','59.16','220.77'],
            'languages'   => ['ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7','ko-KR,ko;q=0.9','ko']
        ],
        'USA' => [
            'ip_prefixes' => ['104.16','172.217','69.171','23.200','192.0','104.17','172.218','69.172','23.201','192.1'],
            'languages'   => ['en-US,en;q=0.9','en-US,en;q=0.9,es;q=0.8']
        ],
        'China' => [
            'ip_prefixes' => ['120.240','112.96','183.232','223.104','120.241','112.97','183.233','223.105'],
            'languages'   => ['zh-CN,zh;q=0.9,en;q=0.8','zh-CN,zh;q=0.9']
        ],
        'Europe' => [
            'ip_prefixes' => ['92.122','185.228','89.187','77.222','193.106','92.123','185.229','89.188','77.223','193.107'],
            'languages'   => ['en-GB,en;q=0.9,de;q=0.8','fr-FR,fr;q=0.9,en;q=0.8','de-DE,de;q=0.9,en;q=0.8']
        ],
        'Malicious' => [
            'ip_prefixes' => ['5.188','45.9','185.220','198.50','162.243','34.200','172.104','91.241','192.241','64.225'],
            'languages'   => ['en-US,en;q=0.9','en-US','']
        ]
    ];

    $LOCATION_PREFIX_MAP = [];
    foreach ($LOCATION_DATA as $group => $d) {
        foreach ($d['ip_prefixes'] as $p) {
            $LOCATION_PREFIX_MAP[$p] = $group;
        }
    }

    // ★ Accept 헤더는 이제 "정답 문자열" 대신 패턴만 사용할 거라
    //   여기 값은 참고용으로만 둠
    $ACCEPT_HEADERS_BY_BROWSER_VALID = [
        'Firefox' => 'text/html,application/xhtml+xml,application/xml;q=0.9',
        'Chrome'  => 'text/html,application/xhtml+xml,application/xml;q=0.9',
        'Safari'  => 'text/html,application/xhtml+xml,application/xml;q=0.9',
    ];

    $MODERN_BROWSERS = ['Firefox','Chrome','Safari'];

    // ★ Referer: 진짜 공격 URL 만 남기고, null / 빈값은 제거
    $SUSPICIOUS_REFERERS = [
        'http://attacker-site.xyz/login-attack.html',
        'https://capstone3d.dothome.net/fake-login.php'
    ];

    $data = [
        'LOCATION_PREFIX_MAP'             => $LOCATION_PREFIX_MAP,
        'COUNTRY_GROUPS'                  => ['Korea','USA','China','Europe'],
        'ACCEPT_HEADERS_BY_BROWSER_VALID' => $ACCEPT_HEADERS_BY_BROWSER_VALID,
        'MODERN_BROWSERS'                 => $MODERN_BROWSERS,
        'SUSPICIOUS_REFERERS'             => $SUSPICIOUS_REFERERS
    ];
    $inited = true;
    return $data;
}

/* ---------- Python 함수들을 PHP 로 포팅 ---------- */

function get_group_name_php($ip) {
    $g   = get_scoring_globals();
    $map = $g['LOCATION_PREFIX_MAP'];
    $parts = explode('.', $ip);
    if (count($parts) < 2) return 'Unknown';
    $key = $parts[0] . '.' . $parts[1];
    return $map[$key] ?? 'Unknown';
}

function calculate_dynamic_ip_score_final_country_php($new_ip, $user_ip_history) {
    $g = get_scoring_globals();
    $COUNTRY_GROUPS = $g['COUNTRY_GROUPS'];

    $new_parts = explode('.', $new_ip);
    if (count($new_parts) != 4) return 0;

    $new_group = get_group_name_php($new_ip);
    if ($new_group === 'Malicious') return 10;

    $max_score = 0;
    foreach ($user_ip_history as $prev_ip) {
        $prev_parts = explode('.', $prev_ip);
        if (count($prev_parts) != 4) continue;

        $prev_group = get_group_name_php($prev_ip);
        $comparison = 0;

        if ($new_parts[0] !== $prev_parts[0]) {
            if ($new_group !== $prev_group) {
                if (in_array($new_group, $COUNTRY_GROUPS) && in_array($prev_group, $COUNTRY_GROUPS)) {
                    $comparison = 3;
                } else {
                    $comparison = 3;
                }
            } else {
                $comparison = 2;
            }
        } elseif ($new_parts[1] !== $prev_parts[1]) {
            $comparison = 2;
        } elseif ($new_parts[2] !== $prev_parts[2] || $new_parts[3] !== $prev_parts[3]) {
            $comparison = 1;
        }

        if ($comparison > $max_score) $max_score = $comparison;
    }
    return $max_score;
}

function extract_ua_features_php($ua) {
    $ua = (string)$ua;
    if (trim($ua) === '' || in_array(strtolower($ua), ['none','null','nan'])) {
        return ['os' => 'None', 'browser' => 'None', 'version' => 'None', 'type' => 'None'];
    }

    $os = 'Other';
    if (strpos($ua,'Windows NT') !== false) $os = 'Windows';
    elseif (strpos($ua,'Macintosh') !== false || strpos($ua,'Mac OS X') !== false) $os = 'Mac';
    elseif (strpos($ua,'Linux') !== false && strpos($ua,'Android') === false) $os = 'Linux';
    elseif (strpos($ua,'Android') !== false) $os = 'Android';

    // 봇
    if (strpos($ua,'python-requests') !== false ||
        strpos($ua,'curl') !== false ||
        strpos($ua,'Nmap') !== false) {

        $browser = 'Bot';
        if (strpos($ua,'python-requests') !== false) $browser = 'Python-Requests';
        elseif (strpos($ua,'curl') !== false)        $browser = 'Curl';
        elseif (strpos($ua,'Nmap') !== false)        $browser = 'Nmap';

        return ['os' => 'Bot', 'browser' => $browser, 'version' => 'Bot', 'type' => 'Bot'];
    }

    $browser = 'Other'; $version = '0'; $type = 'Other';

    if (preg_match('/Firefox\/([\d.]+)/', $ua, $m)) {
        $browser = 'Firefox'; $version = explode('.',$m[1])[0]; $type = 'Browser';
    } elseif (strpos($ua,'Chrome') !== false && strpos($ua,'Safari') !== false) {
        if (preg_match('/Chrome\/([\d.]+)/', $ua, $m)) {
            $browser = 'Chrome'; $version = explode('.',$m[1])[0]; $type = 'Browser';
        }
    } elseif (strpos($ua,'Safari') !== false && strpos($ua,'Version/') !== false) {
        if (preg_match('/Version\/([\d.]+)/', $ua, $m)) {
            $browser = 'Safari'; $version = explode('.',$m[1])[0]; $type = 'Browser';
        }
    }

    return ['os'=>$os,'browser'=>$browser,'version'=>$version,'type'=>$type];
}

function calculate_dynamic_ua_score_php($new_ua, $user_ua_history) {
    $new = extract_ua_features_php($new_ua);
    if ($new['os'] === 'Bot')  return 10;
    if ($new['os'] === 'None') return 1;

    $max = 0;
    foreach ($user_ua_history as $prev_ua) {
        $prev = extract_ua_features_php($prev_ua);
        if ($prev['os'] === 'None' || $prev['os'] === 'Bot') continue;

        $score = 0;
        if ($new['os'] !== $prev['os']) {
            $score = 2;
        } elseif ($new['browser'] !== $prev['browser'] || $new['version'] !== $prev['version']) {
            $score = 1;
        }
        if ($score > $max) $max = $score;
    }
    return $max;
}

function calculate_dynamic_language_score_php($new_lang, $user_lang_history) {
    if (empty($user_lang_history)) return 0;
    if (!in_array($new_lang, $user_lang_history)) return 2;
    return 0;
}

function calculate_referer_score_php($new_ref) {
    $g   = get_scoring_globals();
    $set = $g['SUSPICIOUS_REFERERS'];

    // ★ Referer 가 비어있는 건 정상으로 간주
    if ($new_ref === null || trim($new_ref) === '') {
        return 0;
    }

    if (in_array($new_ref, $set, true)) {
        return 2;
    }
    return 0;
}

function calculate_accept_score_php($new_accept, $new_ua) {
    if (trim((string)$new_accept) === '' ||
        strtolower($new_accept) === 'none' ||
        strtolower($new_accept) === 'null') {
        return 2;  // 그대로 유지
    }

    $ua   = extract_ua_features_php($new_ua);
    $type = $ua['type'];

    if ($type === 'Browser') {
        // 기존: text/html 없으면 10점
        // 수정: text/html 없더라도, */* 이나 application/json 은 허용
        if (strpos($new_accept, 'text/html') === false) {
            // AJAX / fetch 기본값들은 0점 처리
            if (strpos($new_accept, '*/*') !== false ||
                strpos($new_accept, 'application/json') !== false) {
                return 0;
            }
            // 진짜 이상한 Accept 일 때만 5점 정도만 줘도 됨
            return 5;
        }
        return 0;
    }

    return 0;
}


function calculate_sec_fetch_score_php($new_ua, $site, $mode, $dest, $user) {
    // ★ 실제 서비스 환경에서는 브라우저마다 sec-fetch-* 지원이 다르고
    //   프록시/보안소프트 때문에 빠지는 경우도 많아서,
    //   일단 점수 0으로 두고 나중에 필요하면 1~2점 정도만 부여하도록 수정
    return 0;
}

/* ---------- 최종 점수 + 액션 ---------- */

function calculate_integrated_login_score_php(
    $new_ip,
    $new_ua,
    $new_accept,
    $new_lang,
    $new_referer,
    $new_sec_fetch_site,
    $new_sec_fetch_mode,
    $new_sec_fetch_dest,
    $new_sec_fetch_user,
    $user_ip_history,
    $user_ua_history,
    $user_language_history
) {
    $ip_score   = calculate_dynamic_ip_score_final_country_php($new_ip, $user_ip_history);
    $ua_score   = calculate_dynamic_ua_score_php($new_ua, $user_ua_history);
    $lang_score = calculate_dynamic_language_score_php($new_lang, $user_language_history);
    $ref_score  = calculate_referer_score_php($new_referer);
    $acc_score  = calculate_accept_score_php($new_accept, $new_ua);
    $sec_score  = calculate_sec_fetch_score_php($new_ua, $new_sec_fetch_site, $new_sec_fetch_mode,
                                                $new_sec_fetch_dest, $new_sec_fetch_user);

    return $ip_score + $ua_score + $lang_score + $ref_score + $acc_score + $sec_score;
}

function determine_security_action_php($total_score) {
    if ($total_score >= 9)  return "BLOCK_AND_REDIRECT_MAIN";
    if ($total_score >= 7)  return "REQUIRE_CAPTCHA";
    return "ALLOW_LOGIN";
}

/* ---------- loginlog 기록 함수 ---------- */

function log_login_attempt($pdo, $usernum, $id, $ip, $ua, $referer, $lang, $riskScore, $success) {
    try {
        $location = get_location_from_ip($ip);

        $stmt = $pdo->prepare("
            INSERT INTO loginlog
                (Usernum, IP, location, date, riskscore, risklevel, success)
            VALUES
                (:usernum, :ip, :location, NOW(), :riskscore, :risklevel, :success)
        ");

        if ($usernum === null) {
            $stmt->bindValue(':usernum', null, PDO::PARAM_NULL);
        } else {
            $stmt->bindValue(':usernum', (int)$usernum, PDO::PARAM_INT);
        }
        $stmt->bindValue(':ip',        $ip);
        $stmt->bindValue(':location',  $location);
        $stmt->bindValue(':riskscore', (int)$riskScore, PDO::PARAM_INT);
        $stmt->bindValue(':risklevel', (int)$riskScore, PDO::PARAM_INT);
        $stmt->bindValue(':success',   (int)$success,   PDO::PARAM_INT);
        $stmt->execute();

        // 자세한 로그는 php-error.log 에 남기기
        $logData = [
            'timestamp'  => date('Y-m-d H:i:s'),
            'usernum'    => $usernum,
            'id'         => $id,
            'ip'         => $ip,
            'user_agent' => $ua,
            'referer'    => $referer,
            'lang'       => $lang,
            'risk_score' => $riskScore,
            'success'    => $success
        ];
        error_log("LOGIN_ATTEMPT: " . json_encode($logData, JSON_UNESCAPED_UNICODE));

    } catch (PDOException $e) {
        error_log("loginlog insert 실패: " . $e->getMessage());
    }
}

?>
