import type { Database } from '@/lib/supabase/types';

type ExpenseSource = Database['public']['Enums']['expense_source'];

export type ParsedExpense = {
    amount: number | null;
    category: string | null;
    source: ExpenseSource | null;
    notes: string | null;
    incurredOn: string | null;
};

const CATEGORY_PATTERNS: Array<{ label: string; pattern: RegExp }> = [
    { label: '交通', pattern: /(机票|车票|交通|地铁|高铁|公交|打车|出租|动车|航班)/i },
    { label: '住宿', pattern: /(酒店|住宿|民宿|旅馆|客栈|房间)/i },
    { label: '餐饮', pattern: /(餐|饭|餐厅|美食|吃|早餐|午餐|晚餐|宵夜)/i },
    { label: '门票', pattern: /(门票|景点|博物馆|乐园|公园|参观)/i },
    { label: '购物', pattern: /(购物|买|纪念品|特产|手信)/i },
];

export function parseExpenseTranscript(text: string): ParsedExpense {
    const cleaned = text.trim();
    if (!cleaned) {
        return {
            amount: null,
            category: null,
            source: null,
            notes: null,
            incurredOn: null,
        };
    }

    const amount = extractAmount(cleaned);
    const category = inferCategory(cleaned);
    const source = inferSource(cleaned);
    const incurredOn = inferDate(cleaned);

    return {
        amount,
        category,
        source,
        notes: cleaned,
        incurredOn,
    };
}

function extractAmount(text: string) {
    const numericMatch = text.match(/([0-9]+(?:\.[0-9]+)?)/);
    if (numericMatch) {
        const value = Number(numericMatch[1]);
        if (Number.isFinite(value)) {
            return value;
        }
    }

    const chineseMatch = text.match(/[零一二两三四五六七八九十百千万点]+/);
    if (chineseMatch) {
        const converted = chineseToNumber(chineseMatch[0]);
        if (converted != null) {
            return converted;
        }
    }

    return null;
}

function inferCategory(text: string) {
    for (const entry of CATEGORY_PATTERNS) {
        if (entry.pattern.test(text)) {
            return entry.label;
        }
    }
    return '其他';
}

function inferSource(text: string): ExpenseSource {
    if (/(计划|预算|预留|预估|打算)/i.test(text)) {
        return 'plan';
    }
    if (/(已经|刚|刚刚|实际|花了|支付|消费)/i.test(text)) {
        return 'actual';
    }
    return 'actual';
}

function inferDate(text: string) {
    const monthDay = text.match(/(\d{1,2})月(\d{1,2})日?/);
    if (monthDay) {
        const year = new Date().getFullYear();
        const month = Number(monthDay[1]);
        const day = Number(monthDay[2]);
        return formatIsoDate(year, month, day);
    }

    if (text.includes('今天')) {
        return formatRelativeDate(0);
    }
    if (text.includes('昨天')) {
        return formatRelativeDate(-1);
    }
    if (text.includes('明天')) {
        return formatRelativeDate(1);
    }

    return null;
}

function formatRelativeDate(offset: number) {
    const date = new Date();
    date.setDate(date.getDate() + offset);
    return formatIsoDate(date.getFullYear(), date.getMonth() + 1, date.getDate());
}

function formatIsoDate(year: number, month: number, day: number) {
    if (!year || !month || !day) {
        return null;
    }
    const m = String(month).padStart(2, '0');
    const d = String(day).padStart(2, '0');
    return `${year}-${m}-${d}`;
}

function chineseToNumber(value: string) {
    const digitMap: Record<string, number> = {
        零: 0,
        一: 1,
        二: 2,
        两: 2,
        三: 3,
        四: 4,
        五: 5,
        六: 6,
        七: 7,
        八: 8,
        九: 9,
    };
    const unitMap: Record<string, number> = {
        十: 10,
        百: 100,
        千: 1000,
        万: 10000,
    };

    let result = 0;
    let section = 0;
    let number = 0;

    for (const char of value) {
        if (char in digitMap) {
            number = digitMap[char];
        } else if (char in unitMap) {
            const unit = unitMap[char];
            if (unit === 10000) {
                section = (section + number) * unit;
                result += section;
                section = 0;
            } else {
                section += (number || 1) * unit;
            }
            number = 0;
        }
    }

    return result + section + number;
}
