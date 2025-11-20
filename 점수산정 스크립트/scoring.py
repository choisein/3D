from typing import List, Set, Dict, Any
import re

# ==============================================================================
# 1. 공통 분류 데이터 및 상수
# ==============================================================================
LOCATION_DATA: Dict[str, Dict[str, List[str]]] = {
    'Korea': {
        'ip_prefixes': ['118.34', '211.178', '175.209', '59.15', '220.76', '118.35', '211.179', '175.210', '59.16',
                        '220.77'],
        'languages': ['ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7', 'ko-KR,ko;q=0.9', 'ko']
    },
    'USA': {
        'ip_prefixes': ['104.16', '172.217', '69.171', '23.200', '192.0', '104.17', '172.218', '69.172', '23.201',
                        '192.1'],
        'languages': ['en-US,en;q=0.9', 'en-US,en;q=0.9,es;q=0.8']
    },
    'China': {
        'ip_prefixes': ['120.240', '112.96', '183.232', '223.104', '120.241', '112.97', '183.233', '223.105'],
        'languages': ['zh-CN,zh;q=0.9,en;q=0.8', 'zh-CN,zh;q=0.9']
    },
    'Europe': {
        'ip_prefixes': ['92.122', '185.228', '89.187', '77.222', '193.106', '92.123', '185.229', '89.188', '77.223',
                        '193.107'],
        'languages': ['en-GB,en;q=0.9,de;q=0.8', 'fr-FR,fr;q=0.9,en;q=0.8', 'de-DE,de;q=0.9,en;q=0.8']
    },
    'Malicious': {
        'ip_prefixes': ['5.188', '45.9', '185.220', '198.50', '162.243', '34.200', '172.104', '91.241', '192.241',
                        '64.225'],
        'languages': ['en-US,en;q=0.9', 'en-US', '']
    }
}

COUNTRY_GROUPS: Set[str] = set(['Korea', 'USA', 'China', 'Europe'])
SUSPICIOUS_REFERERS: Set[str] = {
    'https://www.google.com/',
    'http://attacker-site.xyz/login-attack.html',
    'https://capstone3d.dothome.net/fake-login.php',
    None, '', 'none', 'null'
}
ACCEPT_HEADERS_BY_BROWSER_VALID: Dict[str, str] = {
    'Firefox': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
    'Chrome': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
    'Safari': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
}
MODERN_BROWSERS: Set[str] = set(ACCEPT_HEADERS_BY_BROWSER_VALID.keys())

# IP A.B 프리픽스 -> 그룹 이름 매핑 테이블
LOCATION_PREFIX_MAP: Dict[str, str] = {}
for group, data in LOCATION_DATA.items():
    for prefix in data['ip_prefixes']:
        LOCATION_PREFIX_MAP[prefix] = group


def get_group_name(ip_address: str) -> str:
    """IP 주소의 A.B 프리픽스를 기준으로 그룹 이름을 반환합니다."""
    try:
        parts = ip_address.split('.')
        ab_prefix = f"{parts[0]}.{parts[1]}"
        return LOCATION_PREFIX_MAP.get(ab_prefix, "Unknown")
    except:
        return "Unknown"


# ------------------------------------------------------------------

def calculate_dynamic_ip_score_final_country(new_ip: str, user_ip_history: List[str]) -> int:
    """IP 비교 점수 산정 (최대 10점): 악성 IP 감지 시 10점 확정."""
    try:
        new_parts = new_ip.split('.')
        if len(new_parts) != 4: return 0
    except:
        return 0

    new_a, new_b, new_c, new_d = new_parts
    new_group = get_group_name(new_ip)

    if new_group == 'Malicious': return 10

    max_comparison_score = 0
    for prev_ip in user_ip_history:
        try:
            prev_parts = prev_ip.split('.')
            if len(prev_parts) != 4: continue
        except:
            continue

        prev_a, prev_b, prev_c, prev_d = prev_parts
        prev_group = get_group_name(prev_ip)

        comparison_score = 0

        if new_a != prev_a:
            if new_group != prev_group:
                if new_group in COUNTRY_GROUPS and prev_group in COUNTRY_GROUPS:
                    comparison_score = 3
                elif new_group != prev_group:
                    comparison_score = 3
            elif new_group == prev_group:
                comparison_score = 2
        elif new_b != prev_b:
            comparison_score = 2
        elif new_c != prev_c or new_d != prev_d:
            comparison_score = 1

        max_comparison_score = max(max_comparison_score, comparison_score)

    return max_comparison_score


# ------------------------------------------------------------------

def extract_ua_features(ua_string: str) -> Dict[str, str]:
    """UA 문자열에서 OS, 브라우저, 타입 등을 추출합니다."""
    if not ua_string or str(ua_string).strip() == '' or str(ua_string).lower() in ['none', 'null', 'nan']:
        return {'os': 'None', 'browser': 'None', 'version': 'None', 'type': 'None'}

    ua_string = str(ua_string)
    os_info = 'Other'
    if 'Windows NT' in ua_string: os_info = 'Windows'
    elif 'Macintosh' in ua_string or 'Mac OS X' in ua_string: os_info = 'Mac'
    elif 'Linux' in ua_string and 'Android' not in ua_string: os_info = 'Linux'
    elif 'Android' in ua_string: os_info = 'Android'

    browser, version, type = 'Other', '0', 'Other'
    if 'python-requests' in ua_string or 'curl' in ua_string or 'Nmap' in ua_string:
        if 'python-requests' in ua_string: browser = 'Python-Requests'
        elif 'curl' in ua_string: browser = 'Curl'
        elif 'Nmap' in ua_string: browser = 'Nmap'
        return {'os': 'Bot', 'browser': browser, 'version': 'Bot', 'type': 'Bot'}

    match = re.search(r'Firefox/([\d.]+)', ua_string)
    if match: browser, version, type = 'Firefox', match.group(1).split('.')[0], 'Browser'
    elif 'Chrome' in ua_string and 'Safari' in ua_string:
        match = re.search(r'Chrome/([\d.]+)', ua_string)
        if match: browser, version, type = 'Chrome', match.group(1).split('.')[0], 'Browser'
    elif 'Safari' in ua_string and 'Version/' in ua_string:
        match = re.search(r'Version/([\d.]+)', ua_string)
        if match: browser, version, type = 'Safari', match.group(1).split('.')[0], 'Browser'

    return {'os': os_info, 'browser': browser, 'version': version, 'type': type}


def calculate_dynamic_ua_score(new_ua: str, user_ua_history: List[str]) -> int:
    """UA 비교 점수 산정 (최대 10점): 봇/스캐너 감지 시 10점 확정."""
    new_features = extract_ua_features(new_ua)
    if new_features['os'] == 'Bot': return 10
    if new_features['os'] == 'None': return 1

    max_comparison_score = 0
    for prev_ua in user_ua_history:
        prev_features = extract_ua_features(prev_ua)
        if prev_features['os'] == 'None' or prev_features['os'] == 'Bot': continue

        comparison_score = 0
        if new_features['os'] != prev_features['os']:
            comparison_score = 2
        elif new_features['browser'] != prev_features['browser'] or \
                new_features['version'] != prev_features['version']:
            comparison_score = 1

        max_comparison_score = max(max_comparison_score, comparison_score)
    return max_comparison_score


def calculate_dynamic_language_score(new_language: str, user_language_history: List[str]) -> int:
    """Language 헤더가 이전 기록과 다를 경우 (+2점)을 부여합니다."""
    if not user_language_history: return 0
    if new_language not in user_language_history:
        return 2
    return 0


def calculate_referer_score(new_referer: str) -> int:
    """Referer 헤더가 의심스러운 목록에 포함되는지 확인하여 +2점을 부여합니다."""
    if new_referer in SUSPICIOUS_REFERERS or str(new_referer) in SUSPICIOUS_REFERERS:
        return 2
    return 0


def calculate_accept_score(new_accept: str, new_ua: str) -> int:
    """
    Accept 헤더를 검증하여 점수를 부여합니다.
    +2점: 헤더가 비어있음
    +10점: 브라우저 타입과 Accept 값이 불일치함
    """
    if not new_accept or str(new_accept).strip() == '' or str(new_accept).lower() in ['none', 'null']:
        return 2

    ua_features = extract_ua_features(new_ua)
    browser_type = ua_features['browser']
    ua_type = ua_features['type']

    if ua_type == 'Browser' and browser_type in ACCEPT_HEADERS_BY_BROWSER_VALID:
        valid_accept = ACCEPT_HEADERS_BY_BROWSER_VALID[browser_type]

        if new_accept != valid_accept:
            return 10
    return 0


def calculate_sec_fetch_score(
        new_ua: str,
        site: str,
        mode: str,
        dest: str,
        user: str
) -> int:
    """
    최신 브라우저인데 Sec-Fetch 헤더가 없는 경우 (+10점)을 부여합니다.
    """
    ua_features = extract_ua_features(new_ua)
    browser_type = ua_features['browser']

    if browser_type not in MODERN_BROWSERS:
        return 0

    missing_site = site is None or str(site).strip() == '' or str(site).lower() == 'none'
    missing_mode = mode is None or str(mode).strip() == '' or str(mode).lower() == 'none'
    missing_dest = dest is None or str(dest).strip() == '' or str(dest).lower() == 'none'

    if missing_site or missing_mode or missing_dest:
        return 10
    return 0


# ==============================================================================
# 4. 최종 통합 점수 산정 함수 및 보안 액션
# ==============================================================================

def calculate_integrated_login_score(
        new_ip: str,
        new_ua: str,
        new_accept: str,
        new_language: str,
        new_referer: str,
        new_sec_fetch_site: str,
        new_sec_fetch_mode: str,
        new_sec_fetch_dest: str,
        new_sec_fetch_user: str,
        user_ip_history: List[str],
        user_ua_history: List[str],
        user_language_history: List[str]
) -> int:
    """
    모든 헤더 점수를 합산하여 최종 통합 위험 점수를 산정합니다.
    """

    ip_score = calculate_dynamic_ip_score_final_country(new_ip, user_ip_history)
    ua_score = calculate_dynamic_ua_score(new_ua, user_ua_history)
    language_score = calculate_dynamic_language_score(new_language, user_language_history)
    referer_score = calculate_referer_score(new_referer)
    accept_score = calculate_accept_score(new_accept, new_ua)
    sec_fetch_score = calculate_sec_fetch_score(
        new_ua,
        new_sec_fetch_site,
        new_sec_fetch_mode,
        new_sec_fetch_dest,
        new_sec_fetch_user
    )

    return ip_score + ua_score + language_score + referer_score + accept_score + sec_fetch_score

#캡차 시행 또는 차단 시 메인페이지로 넘어갈 수 있게 연동 필요
def determine_security_action(total_score: int) -> str:
    """
    통합 점수를 기반으로 필요한 보안 조치를 결정합니다.
    """
    if total_score >= 9:
        return "BLOCK_AND_REDIRECT_MAIN" # 9점 이상이면 메인페이지로 이동 (차단/실패 처리)
    elif total_score >= 7:
        return "REQUIRE_CAPTCHA" # 7점 이상이면 CAPTCHA 요구
    else:
        return "ALLOW_LOGIN" # 7점 미만은 로그인 허용


# --- 테스트 예시 ---
# # Case 1: 총점 7점 (CAPTCHA 요구)
# score_7 = calculate_integrated_login_score(
#     new_ip="104.16.1.1", new_ua="Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:129.0) Gecko/20100101 Firefox/129.0",
#     new_accept=ACCEPT_HEADERS_BY_BROWSER_VALID['Firefox'], new_language="ko", new_referer="https://google.com/",
#     new_sec_fetch_site="same-origin", new_sec_fetch_mode="navigate", new_sec_fetch_dest="document", new_sec_fetch_user="?1",
#     user_ip_history=["175.209.1.1"], user_ua_history=["Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36"],
#     user_language_history=["ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7"]
# )
# print(f"총점: {score_7} -> 조치: {determine_security_action(score_7)}")
# # (IP: 3점 + UA: 1점 + Lang: 2점 + Ref: 2점 + Accept: 0 + SecFetch: 0) = 8점 -> REQUIRE_CAPTCHA