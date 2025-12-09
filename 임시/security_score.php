<?php

// -------------------------------------------
// 1) 국가별 IP 그룹 설정
// -------------------------------------------
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

$COUNTRY_GROUPS = ['Korea','USA','China','Europe'];

$SUSPICIOUS_REFERERS = [
    'https://www.google.com/',
    'http://attacker-site.xyz/login-attack.html',
    'https://capstone3d.dothome.net/fake-login.php',
    '', 'none', 'null', null
];

// -------------------------------------------
// 2) 브라우저별 올바른 ACCEPT 헤더
// -------------------------------------------
$VALID_ACCEPT = [
    'Firefox' => 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
    'Chrome'  => 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
    'Safari'  => 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
];

// -------------------------------------------
// 3) UA 분석
// -------------------------------------------
function parse_ua($ua) {
    if (!$ua || trim($ua)==='' || strtolower($ua)==='none') {
        return ['os'=>'None','browser'=>'None','version'=>'None','type'=>'None'];
    }

    if (strpos($ua,"python-requests")!==false || strpos($ua,"curl")!==false || strpos($ua,"Nmap")!==false) {
        return ['os'=>'Bot','browser'=>'Bot','version'=>'Bot','type'=>'Bot'];
    }

    $os = 'Other';
    if (strpos($ua,'Windows NT')!==false) $os='Windows';
    elseif (strpos($ua,'Mac')!==false) $os='Mac';
    elseif (strpos($ua,'Linux')!==false && strpos($ua,'Android')===false) $os='Linux';
    elseif (strpos($ua,'Android')!==false) $os='Android';

    $browser='Other';
    $version='0';
    $type='Browser';

    if (preg_match('/Firefox\/([\d.]+)/',$ua,$m)) {
        $browser='Firefox'; $version=$m[1];
    }
    elseif (preg_match('/Chrome\/([\d.]+)/',$ua,$m) && strpos($ua,'Safari')!==false) {
        $browser='Chrome'; $version=$m[1];
    }
    elseif (preg_match('/Version\/([\d.]+)/',$ua,$m) && strpos($ua,'Safari')!==false) {
        $browser='Safari'; $version=$m[1];
    }

    return ['os'=>$os,'browser'=>$browser,'version'=>$version,'type'=>$type];
}

// -------------------------------------------
// 4) 점수 계산 함수들
// -------------------------------------------

function calc_ip_score($cur_ip, $history) {
    global $LOCATION_DATA;

    $cur_prefix = implode('.', array_slice(explode('.',$cur_ip),0,2));

    foreach ($LOCATION_DATA['Malicious']['ip_prefixes'] as $mal) {
        if ($cur_prefix===$mal) return 10;
    }

    if (!$history) return 0;

    $max=0;
    foreach ($history as $old_ip) {
        $old_prefix = implode('.', array_slice(explode('.',$old_ip),0,2));
        if ($cur_prefix !== $old_prefix) $max=max($max,3);
        else $max=max($max,1);
    }

    return $max;
}

function calc_ua_score($cur_ua, $history) {
    $new = parse_ua($cur_ua);
    if ($new['os']==='Bot') return 10;

    $max=0;
    foreach ($history as $old_ua) {
        $old = parse_ua($old_ua);
        if ($old['os']==='Bot' || $old['os']==='None') continue;

        if ($new['os'] !== $old['os']) $max=max($max,2);
        elseif ($new['browser']!==$old['browser']) $max=max($max,1);
    }

    return $max;
}

function calc_lang_score($cur_lang, $hist) {
    if (!$hist) return 0;
    if (!in_array($cur_lang,$hist)) return 2;
    return 0;
}

function calc_ref_score($cur_ref) {
    global $SUSPICIOUS_REFERERS;
    return in_array($cur_ref,$SUSPICIOUS_REFERERS) ? 2 : 0;
}

function calc_accept_score($cur_accept, $cur_ua) {
    global $VALID_ACCEPT;

    if (!$cur_accept || trim($cur_accept)==='') return 2;

    $ua = parse_ua($cur_ua);
    $browser = $ua['browser'];

    if (isset($VALID_ACCEPT[$browser])) {
        if ($VALID_ACCEPT[$browser] !== $cur_accept) return 10;
    }
    return 0;
}

function calc_sec_fetch($cur_ua,$site,$mode,$dest,$user) {
    $ua = parse_ua($cur_ua);
    if (!in_array($ua['browser'], ['Chrome','Firefox','Safari'])) return 0;

    if (!$site || !$mode || !$dest) return 10;
    return 0;
}

// -------------------------------------------
// 5) 전체 통합 점수
// -------------------------------------------
function calculate_score($ip,$ua,$accept,$lang,$ref,$sf_site,$sf_mode,$sf_dest,$sf_user,$ipHist,$uaHist,$langHist) {
    return
        calc_ip_score($ip,$ipHist) +
        calc_ua_score($ua,$uaHist) +
        calc_lang_score($lang,$langHist) +
        calc_ref_score($ref) +
        calc_accept_score($accept,$ua) +
        calc_sec_fetch($ua,$sf_site,$sf_mode,$sf_dest,$sf_user);
}

// -------------------------------------------
// 6) 행동(ACTION) 결정
// -------------------------------------------
function determine_action($score) {
    if ($score >= 9) return "BLOCK";
    if ($score >= 7) return "CAPTCHA";
    return "ALLOW";
}
?>
