import type { CategoryKey, Platform } from '../types.ts'

// Matched case-insensitively against merchant + product description.
// Order matters: the first category with a hit wins, so specific categories
// (Coffee, Gas/Fuel, Pet) come before broad ones (Groceries, Dining Out).
// Shopping is the fallback and needs no keywords.
//
// Avoid single-character or too-generic keywords: 猫 would match 天猫,
// bare digits would match order numbers.
export const CATEGORY_KEYWORDS: readonly (readonly [CategoryKey, readonly string[]])[] = [
  ['Baby', [
    '尿裤', '纸尿裤', '拉拉裤', '尿片', '奶粉', '奶瓶', '辅食', '米粉',
    '婴儿', '婴幼儿', '宝宝', '新生儿', '早产', '童装', '童鞋', '儿童',
    'nb码', 'moony', '尤妮佳', '帮宝适', 'pampers', '好奇', 'huggies',
    '大王', 'goo.n', '花王', 'merries', '贝亲', 'pigeon', '爱他美', 'aptamil',
    '美素佳儿', '飞鹤', '惠氏', '母婴', '亲子', '玩具', '积木', '安抚奶嘴',
    '湿巾', '口水巾', '吸奶器', '奶嘴'
  ]],
  ['Pet', [
    '宠物', '猫粮', '狗粮', '猫砂', '猫罐头', '狗罐头', '猫条', '冻干猫',
    '猫窝', '狗窝', '狗绳', '牵引绳', '逗猫', '猫抓板', '宠物医院', '疫苗宠'
  ]],
  ['Coffee', [
    '咖啡', 'coffee', '瑞幸', 'luckin', '星巴克', 'starbucks', '库迪', 'cotti',
    'manner', '拿铁', '美式', '摩卡', '卡布奇诺'
  ]],
  ['GasFuel', [
    '加油', '加油站', '中石化', '中石油', '汽油', '柴油', '壳牌',
    '充电桩', '特来电', '星星充电', '油费'
  ]],
  ['Transport', [
    '滴滴', '出行', '打车', '出租车', '网约车', '代驾', '顺风车',
    '地铁', '公交', '轻轨', '高铁', '火车票', '12306', '铁路',
    '机票', '航空', '航班', '值机', '停车', '高速费', '过路费',
    '共享单车', '哈啰', '青桔', '租车', '携程用车'
  ]],
  ['Groceries', [
    '超市', '生鲜', '新鲜', '买菜', '菜场', '卖菜', '食品', '零食', '水果', '蔬菜',
    '牛奶', '面包', '大米', '粮油', '鸡蛋', '海鲜', '坚果',
    '盒马', '山姆', 'sam', '永辉', '大润发', '便利店', '罗森', '全家便利'
  ]],
  ['DiningOut', [
    '美团', '饿了么', '外卖', '餐饮', '餐厅', '饭店', '食堂', '小吃',
    '麦当劳', '肯德基', 'kfc', '必胜客', '海底捞', '火锅', '烧烤', '面馆',
    '奶茶', '茶饮', '喜茶', '蜜雪冰城', '蛋糕', '烘焙'
  ]]
]

// Used when no keyword matches. Scan-to-pay bills are overwhelmingly corner
// shops and food markets, while the marketplaces are general retail.
export const PLATFORM_FALLBACK_CATEGORIES: Partial<Record<Platform, CategoryKey>> = {
  wechat: 'Groceries',
  alipay: 'Groceries'
}

export const FALLBACK_CATEGORY: CategoryKey = 'Shopping'
