import re
from typing import List, Tuple

from app.models import SensitiveLevel

SENSITIVE_KEYWORDS = {
    "政治敏感": [
        "台独", "港独", "藏独", "疆独", "法轮功", "反共", "反党", "反政府",
        "领导人骂名", "政治敏感词", "政权颠覆", "分裂国家", "恐怖主义",
        "恐怖袭击", "恐怖分子", "极端主义", "极端分子",
    ],
    "暴力恐怖": [
        "杀人", "放火", "爆炸", "炸弹", "恐怖", "血腥", "暴力", "虐待",
        "酷刑", "强奸", "性侵", "猥亵", "绑架", "劫持", "抢劫", "盗窃",
    ],
    "色情低俗": [
        "色情", "淫秽", "性爱", "性交", "做爱", "色情片", "黄片", "AV",
        "三级片", "情色", "色情网站", "裸照", "露点", "性暗示", "卖淫",
        "嫖娼", "约炮", "一夜情", "包养", "小三", "出轨",
    ],
    "赌博毒品": [
        "赌博", "赌球", "赌马", "彩票诈骗", "高利贷", "毒品", "吸毒",
        "贩毒", "大麻", "海洛因", "可卡因", "冰毒", "摇头丸", "K粉",
    ],
    "虚假信息": [
        "诈骗", "欺诈", "传销", "非法集资", "高利贷", "假币", "假货",
        "高仿", "仿冒", "假冒", "骗贷", "洗钱",
    ],
    "其他违法": [
        "枪支", "弹药", "管制刀具", "爆炸物", "剧毒", "放射性",
        "非法买卖", "走私", "逃税", "偷税", "假证", "假章",
    ],
}

SENSITIVE_WARNING_KEYWORDS = [
    "广告", "推广", "营销", "销售", "购买", "点击领取", "扫码关注",
    "加微信", "加QQ", "联系方式", "电话", "手机号", "微信号",
]


def check_sensitive_content(text: str) -> Tuple[SensitiveLevel, List[str], str]:
    if not text or not text.strip():
        return SensitiveLevel.SAFE, [], ""
    
    text_lower = text.lower()
    matched_keywords = []
    matched_categories = []
    
    for category, keywords in SENSITIVE_KEYWORDS.items():
        for keyword in keywords:
            if keyword in text_lower:
                matched_keywords.append(keyword)
                if category not in matched_categories:
                    matched_categories.append(category)
    
    if matched_keywords:
        reason = f"检测到敏感内容，涉及类别：{', '.join(matched_categories)}，关键词：{', '.join(matched_keywords[:10])}"
        return SensitiveLevel.BLOCKED, matched_keywords, reason
    
    warning_matched = []
    for keyword in SENSITIVE_WARNING_KEYWORDS:
        if keyword in text_lower:
            warning_matched.append(keyword)
    
    if warning_matched:
        reason = f"检测到潜在广告/营销内容，关键词：{', '.join(warning_matched[:10])}"
        return SensitiveLevel.WARNING, warning_matched, reason
    
    return SensitiveLevel.SAFE, [], ""


def filter_sensitive_content(text: str, replace_char: str = "*") -> str:
    if not text:
        return text
    
    result = text
    all_keywords = []
    
    for keywords in SENSITIVE_KEYWORDS.values():
        all_keywords.extend(keywords)
    
    all_keywords.extend(SENSITIVE_WARNING_KEYWORDS)
    all_keywords.sort(key=len, reverse=True)
    
    for keyword in all_keywords:
        pattern = re.compile(re.escape(keyword), re.IGNORECASE)
        result = pattern.sub(replace_char * len(keyword), result)
    
    return result
