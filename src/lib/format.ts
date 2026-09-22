const COUNTRY_ZH: Record<string, string> = {
  "United States": "美国", "China": "中国", "United Kingdom": "英国", "Japan": "日本",
  "Germany": "德国", "France": "法国", "Russia": "俄罗斯", "India": "印度",
  "South Korea": "韩国", "North Korea": "朝鲜", "Taiwan": "中国台湾", "Hong Kong": "中国香港",
  "Singapore": "新加坡", "Australia": "澳大利亚", "Canada": "加拿大", "Ukraine": "乌克兰",
  "Israel": "以色列", "Iran": "伊朗", "Saudi Arabia": "沙特阿拉伯", "Turkey": "土耳其",
  "Italy": "意大利", "Spain": "西班牙", "Netherlands": "荷兰", "Switzerland": "瑞士",
  "Sweden": "瑞典", "Norway": "挪威", "Poland": "波兰", "Brazil": "巴西",
  "Mexico": "墨西哥", "Indonesia": "印度尼西亚", "Vietnam": "越南", "Thailand": "泰国",
  "Malaysia": "马来西亚", "Philippines": "菲律宾", "Pakistan": "巴基斯坦",
  "South Africa": "南非", "Egypt": "埃及", "UAE": "阿联酋", "Qatar": "卡塔尔",
  "Lebanon": "黎巴嫩", "Syria": "叙利亚", "Iraq": "伊拉克", "Yemen": "也门",
  "Belgium": "比利时", "Austria": "奥地利", "Ireland": "爱尔兰", "Denmark": "丹麦",
  "Finland": "芬兰", "Greece": "希腊", "Portugal": "葡萄牙", "Czech Republic": "捷克",
  "Romania": "罗马尼亚", "Hungary": "匈牙利", "New Zealand": "新西兰", "Argentina": "阿根廷",
  "Chile": "智利", "Colombia": "哥伦比亚", "Nigeria": "尼日利亚", "Kenya": "肯尼亚",
  "Ethiopia": "埃塞俄比亚", "Morocco": "摩洛哥", "Algeria": "阿尔及利亚",
  "Bangladesh": "孟加拉国", "Sri Lanka": "斯里兰卡", "Myanmar": "缅甸", "Cambodia": "柬埔寨",
  "Kazakhstan": "哈萨克斯坦", "Uzbekistan": "乌兹别克斯坦", "Azerbaijan": "阿塞拜疆",
  "Armenia": "亚美尼亚", "Georgia": "格鲁吉亚", "Serbia": "塞尔维亚", "Croatia": "克罗地亚",
  "Slovakia": "斯洛伐克", "Slovenia": "斯洛文尼亚", "Bulgaria": "保加利亚",
  "Lithuania": "立陶宛", "Latvia": "拉脱维亚", "Estonia": "爱沙尼亚", "Iceland": "冰岛",
  "Luxembourg": "卢森堡", "Malta": "马耳他", "Cyprus": "塞浦路斯", "Kuwait": "科威特",
  "Oman": "阿曼", "Jordan": "约旦", "Bahrain": "巴林", "Iraq ": "伊拉克",
  "Mongolia": "蒙古", "Nepal": "尼泊尔", "Bhutan": "不丹", "Maldives": "马尔代夫",
  "Brunei": "文莱", "Laos": "老挝", "Papua New Guinea": "巴布亚新几内亚", "Fiji": "斐济",
  "Peru": "秘鲁", "Uruguay": "乌拉圭", "Paraguay": "巴拉圭", "Bolivia": "玻利维亚",
  "Ecuador": "厄瓜多尔", "Venezuela": "委内瑞拉", "Costa Rica": "哥斯达黎加",
  "Panama": "巴拿马", "Cuba": "古巴", "Dominican Republic": "多米尼加",
  "Guatemala": "危地马拉", "Honduras": "洪都拉斯", "El Salvador": "萨尔瓦多",
  "Tunisia": "突尼斯", "Libya": "利比亚", "Sudan": "苏丹", "Ghana": "加纳",
  "Senegal": "塞内加尔", "Ivory Coast": "科特迪瓦", "Cameroon": "喀麦隆",
  "Uganda": "乌干达", "Tanzania": "坦桑尼亚", "Mozambique": "莫桑比克",
  "Zimbabwe": "津巴布韦", "Zambia": "赞比亚", "Botswana": "博茨瓦纳", "Namibia": "纳米比亚",
  "Rwanda": "卢旺达", "Somalia": "索马里", "Afghanistan": "阿富汗",
  "Belarus": "白俄罗斯", "Moldova": "摩尔多瓦", "Bosnia": "波黑", "Albania": "阿尔巴尼亚",
  "North Macedonia": "北马其顿", "Montenegro": "黑山", "Kosovo": "科索沃",
};

export function countryZh(name: string): string {
  if (!name) return "";
  return COUNTRY_ZH[name] ?? name;
}

const LANG_ZH: Record<string, string> = {
  english: "英语", chinese: "中文", arabic: "阿拉伯语", spanish: "西语",
  french: "法语", german: "德语", japanese: "日语", russian: "俄语",
  korean: "韩语", portuguese: "葡语", italian: "意大利语", hindi: "印地语",
  indonesian: "印尼语", thai: "泰语", vietnamese: "越南语", turkish: "土耳其语",
  persian: "波斯语", hebrew: "希伯来语", urdu: "乌尔都语", dutch: "荷兰语",
  polish: "波兰语", swedish: "瑞典语", greek: "希腊语", czech: "捷克语",
  ukrainian: "乌克兰语", romanian: "罗马尼亚语", danish: "丹麦语",
  finnish: "芬兰语", norwegian: "挪威语",
};

export function langZh(code: string): string {
  if (!code) return "";
  return LANG_ZH[code] ?? code;
}

export function timeAgo(iso: string): string {
  const diff = Date.now() - +new Date(iso);
  if (Number.isNaN(diff) || diff < 0) return "刚刚";
  const m = Math.floor(diff / 6e4);
  if (m < 1) return "刚刚";
  if (m < 60) return `${m} 分钟前`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} 小时前`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d} 天前`;
  const w = Math.floor(d / 7);
  if (w < 5) return `${w} 周前`;
  return new Date(iso).toLocaleDateString("zh-CN");
}

export function fmtDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(+d)) return "";
  return d.toLocaleDateString("zh-CN", { year: "numeric", month: "2-digit", day: "2-digit" });
}

export function fmtTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(+d)) return "";
  return d.toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit", hour12: false });
}

export function fmtClock(d: Date): string {
  return d.toLocaleTimeString("zh-CN", { hour12: false });
}

export function fmtDay(d: Date): string {
  return d.toLocaleDateString("zh-CN", {
    year: "numeric", month: "long", day: "numeric", weekday: "long",
  });
}
