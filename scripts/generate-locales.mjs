#!/usr/bin/env node

import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const sourceRoot = join(projectRoot, '..', 'gametest', 'project-data', 'iron-nest');
const dataRoot = join(projectRoot, 'data');
const locales = ['en', 'zh-cn', 'zh-tw'];
const readJson = async (path) => JSON.parse(await readFile(path, 'utf8'));
const writeJson = async (path, value) => {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`);
};
const sortedObject = (entries) => Object.fromEntries([...entries].sort(([a], [b]) => a.localeCompare(b)));
const normalize = (value) => String(value ?? '').trim().toLocaleLowerCase('en-US').replaceAll('&', 'and').replace(/\s+/g, ' ');

const glossarySource = await readJson(join(sourceRoot, '12-terminology.json'));
const glossary = new Map(glossarySource.glossary.map((item) => [item.source_key, item]));
const routes = (await readJson(join(dataRoot, 'routes.json'))).pages;
const facts = Object.fromEntries(await Promise.all([
  'shells', 'missions', 'achievements', 'medals', 'punchcards', 'mutators', 'map-entities',
].map(async (name) => [name, await readJson(join(dataRoot, 'en', 'entities', `${name}.json`))])));

const glossaryValue = (item, locale) => locale === 'en'
  ? item.english
  : locale === 'zh-cn' ? item.term : item.traditional_chinese;
const requireGlossary = (key, context) => {
  const item = glossary.get(key);
  if (!item) throw new Error(`${context}: glossary key not found: ${key}`);
  return item;
};

const achievementNames = {
  'zh-cn': {
    ACHIEVEMENT_1_CLEAR: '只是校准', ACHIEVEMENT_2_CLEAR: '荣誉礼炮', ACHIEVEMENT_3_CLEAR: '为他们着想',
    ACHIEVEMENT_4_CLEAR: '首次回应', ACHIEVEMENT_5_CLEAR: '全面清除', ACHIEVEMENT_6_CLEAR: '突围',
    ACHIEVEMENT_7_CLEAR: '冷启动', ACHIEVEMENT_8_CLEAR: '假旗出击', ACHIEVEMENT_9_CLEAR: '稳健之手',
    ACHIEVEMENT_10_CLEAR: '火炮回应', ACHIEVEMENT_11_CLEAR: '滩头拒止', ACHIEVEMENT_12_CLEAR: '空无一物',
    ACHIEVEMENT_13_CLEAR: '镜像', ACHIEVEMENT_14_CLEAR: '黑暗之中', ACHIEVEMENT_15A_CLEAR: '欢庆之城',
    ACHIEVEMENT_15B_CLEAR: '屈服之城', ACHIEVEMENT_15C_CLEAR: '未择之路', ACHIEVEMENT_15D_CLEAR: '寂静之城',
    ACHIEVEMENT_1_GOLDEN: '尽职尽责', ACHIEVEMENT_2_GOLDEN: '神射手荣誉', ACHIEVEMENT_3_GOLDEN: '模范服役',
    ACHIEVEMENT_4_GOLDEN: '卓越表现', ACHIEVEMENT_5_GOLDEN: '黄铜加冕', ACHIEVEMENT_6_GOLDEN: '海军嘉奖',
    ACHIEVEMENT_8_GOLDEN: '功绩勋章', ACHIEVEMENT_9_GOLDEN: '无声精准', ACHIEVEMENT_10_GOLDEN: '钢铁纪律',
    ACHIEVEMENT_11_GOLDEN: '海防勋章', ACHIEVEMENT_12_GOLDEN: '岿然不动', ACHIEVEMENT_13_GOLDEN: '炮术大师',
    ACHIEVEMENT_14_GOLDEN: '夜间精准', ACHIEVEMENT_15_GOLDEN: '卡斯蒂利亚之傲', ACHIEVEMENT_7_GOLDEN: '炮火下的英勇',
  },
  'zh-tw': {
    ACHIEVEMENT_1_CLEAR: '只是校準', ACHIEVEMENT_2_CLEAR: '榮譽禮炮', ACHIEVEMENT_3_CLEAR: '為他們著想',
    ACHIEVEMENT_4_CLEAR: '首次回應', ACHIEVEMENT_5_CLEAR: '全面清除', ACHIEVEMENT_6_CLEAR: '突圍',
    ACHIEVEMENT_7_CLEAR: '冷啟動', ACHIEVEMENT_8_CLEAR: '假旗出擊', ACHIEVEMENT_9_CLEAR: '穩健之手',
    ACHIEVEMENT_10_CLEAR: '火炮回應', ACHIEVEMENT_11_CLEAR: '灘頭拒止', ACHIEVEMENT_12_CLEAR: '空無一物',
    ACHIEVEMENT_13_CLEAR: '鏡像', ACHIEVEMENT_14_CLEAR: '黑暗之中', ACHIEVEMENT_15A_CLEAR: '歡慶之城',
    ACHIEVEMENT_15B_CLEAR: '臣服之城', ACHIEVEMENT_15C_CLEAR: '未擇之路', ACHIEVEMENT_15D_CLEAR: '寂靜之城',
    ACHIEVEMENT_1_GOLDEN: '克盡職守', ACHIEVEMENT_2_GOLDEN: '神射手榮譽', ACHIEVEMENT_3_GOLDEN: '模範服役',
    ACHIEVEMENT_4_GOLDEN: '卓越表現', ACHIEVEMENT_5_GOLDEN: '黃銅加冕', ACHIEVEMENT_6_GOLDEN: '海軍嘉獎',
    ACHIEVEMENT_8_GOLDEN: '功績勳章', ACHIEVEMENT_9_GOLDEN: '無聲精準', ACHIEVEMENT_10_GOLDEN: '鋼鐵紀律',
    ACHIEVEMENT_11_GOLDEN: '海防勳章', ACHIEVEMENT_12_GOLDEN: '屹立不搖', ACHIEVEMENT_13_GOLDEN: '炮術大師',
    ACHIEVEMENT_14_GOLDEN: '夜間精準', ACHIEVEMENT_15_GOLDEN: '卡斯提亞之傲', ACHIEVEMENT_7_GOLDEN: '炮火下的英勇',
  },
};

const clearAchievementDescriptions = {
  'zh-cn': {
    ACHIEVEMENT_1_CLEAR: '完成“校射”任务。', ACHIEVEMENT_2_CLEAR: '完成“炮火与光辉”任务。',
    ACHIEVEMENT_3_CLEAR: '完成“解放”任务。', ACHIEVEMENT_4_CLEAR: '完成“反炮兵”任务。',
    ACHIEVEMENT_5_CLEAR: '完成“钢铁之路”任务。', ACHIEVEMENT_6_CLEAR: '完成“卡塔赫纳之围”任务。',
    ACHIEVEMENT_7_CLEAR: '在“峡谷要冲”中生还。', ACHIEVEMENT_8_CLEAR: '完成“居高临下”任务。',
    ACHIEVEMENT_9_CLEAR: '完成“盲区推算”任务。', ACHIEVEMENT_10_CLEAR: '完成“火力支援”任务。',
    ACHIEVEMENT_11_CLEAR: '完成“敌人如潮”任务。', ACHIEVEMENT_12_CLEAR: '完成“孤独发炮”任务。',
    ACHIEVEMENT_13_CLEAR: '完成“幽灵炮台”任务。', ACHIEVEMENT_14_CLEAR: '完成“最终收割”任务。',
    ACHIEVEMENT_15A_CLEAR: '一座出城迎接你的城市。', ACHIEVEMENT_15B_CLEAR: '一座屈膝并称之为和平的城市。',
    ACHIEVEMENT_15C_CLEAR: '一座幸免于难的城市，以及一条再无人会踏上的路。', ACHIEVEMENT_15D_CLEAR: '一座从地图上被抹去的城市。',
  },
  'zh-tw': {
    ACHIEVEMENT_1_CLEAR: '完成「校準射擊」任務。', ACHIEVEMENT_2_CLEAR: '完成「射擊與照明」任務。',
    ACHIEVEMENT_3_CLEAR: '完成「解放」任務。', ACHIEVEMENT_4_CLEAR: '完成「反炮兵戰」任務。',
    ACHIEVEMENT_5_CLEAR: '完成「鋼鐵之路」任務。', ACHIEVEMENT_6_CLEAR: '完成「卡塔赫納圍城」任務。',
    ACHIEVEMENT_7_CLEAR: '在「峽谷」中存活。', ACHIEVEMENT_8_CLEAR: '完成「直布羅陀巨巖」任務。',
    ACHIEVEMENT_9_CLEAR: '完成「盲區推算」任務。', ACHIEVEMENT_10_CLEAR: '完成「呼叫火力支援」任務。',
    ACHIEVEMENT_11_CLEAR: '完成「漲潮」任務。', ACHIEVEMENT_12_CLEAR: '完成「盲射」任務。',
    ACHIEVEMENT_13_CLEAR: '完成「幻影炮台」任務。', ACHIEVEMENT_14_CLEAR: '完成「最終收割」任務。',
    ACHIEVEMENT_15A_CLEAR: '一座出城迎接你的城市。', ACHIEVEMENT_15B_CLEAR: '一座屈膝並將此稱為和平的城市。',
    ACHIEVEMENT_15C_CLEAR: '一座得以倖存的城市，以及一條再也無人踏上的道路。', ACHIEVEMENT_15D_CLEAR: '一座從地圖上徹底抹去的城市。',
  },
};

function missionTitleItemForRecord(record) {
  const candidates = [record.displayName, record.location].filter(Boolean).map(normalize);
  return glossarySource.glossary.find((item) => item.source_key.startsWith('STR_MISSION_TITLE_') && candidates.includes(normalize(item.english)));
}

function missionLocation(record, locale) {
  if (!record.location) return '';
  if (locale === 'en') return record.location;
  const titleMatch = glossarySource.glossary.find((item) => item.source_key.startsWith('STR_MISSION_TITLE_') && normalize(item.english) === normalize(record.location));
  if (titleMatch) return glossaryValue(titleMatch, locale);
  const locations = {
    'zh-cn': { Barcelona: '巴塞罗那', 'Map Aranjuez': '阿兰胡埃斯地图', 'Ciudad Real': '雷阿尔城', 'Seige of Cartagena': '卡塔赫纳之围' },
    'zh-tw': { Barcelona: '巴塞隆納', 'Map Aranjuez': '阿蘭胡埃斯地圖', 'Ciudad Real': '雷阿爾城', 'Seige of Cartagena': '卡塔赫納圍城' },
  };
  const translated = locations[locale][record.location];
  if (!translated) throw new Error(`Untranslated Mission location: ${record.id}: ${record.location}`);
  return translated;
}

const missionRoutes = routes.filter((route) => route.entity === 'Mission' && route.page_type === 'data_entity');
const missionRecords = new Map();
const missionTerms = new Map();
for (const route of missionRoutes) {
  const candidates = facts.missions.filter((record) => record.id === route.source_record_id);
  const record = candidates.find((item) => missionTitleItemForRecord(item));
  const term = record && missionTitleItemForRecord(record);
  if (!record || !term) {
    throw new Error(`Mission join failed: ${JSON.stringify({ url_path: route.url_path, source_record_id: route.source_record_id, candidates })}`);
  }
  missionRecords.set(route.source_record_id, record);
  missionTerms.set(route.source_record_id, term);
}

function achievementDescription(record, locale) {
  if (locale === 'en') return record.description;
  if (record.type === 'CLEAR') return clearAchievementDescriptions[locale][record.name];
  const match = record.description.match(/^Earn gold on all medals in "(.+)\."$/);
  if (!match) throw new Error(`Unrecognized achievement description: ${record.name}: ${record.description}`);
  const mission = glossarySource.glossary.find((item) => item.source_key.startsWith('STR_MISSION_TITLE_') && normalize(item.english) === normalize(match[1]));
  if (!mission) throw new Error(`Achievement mission title not in glossary: ${record.name}: ${match[1]}`);
  return locale === 'zh-cn'
    ? `在“${mission.term}”任务的全部奖章上获得金牌。`
    : `於「${mission.traditional_chinese}」任務的所有勳章取得金牌。`;
}

function mutatorKey(record) {
  return `${record.displayName}::${record.description}`;
}
function mutatorTranslation(record, locale) {
  if (locale === 'en') return { displayName: record.displayName, description: record.description };
  const tier = record.displayName.match(/T\d+$/)?.[0] ?? '';
  if (record.displayName.startsWith('Aerial Distance')) {
    const direction = record.description.includes('Aerial Direction');
    return locale === 'zh-cn'
      ? { displayName: `空中测距 ${tier}`, description: direction ? '影响空中方位修正信息的精度。' : '影响空中距离修正信息的精度。' }
      : { displayName: `空中測距 ${tier}`, description: direction ? '影響空中方位修正資訊的精確度。' : '影響空中距離修正資訊的精確度。' };
  }
  if (record.displayName.startsWith('Enemy Artillery')) {
    const level = record.displayName.match(/\d+$/)?.[0] ?? '';
    return locale === 'zh-cn'
      ? { displayName: `敌方炮兵 ${level}`, description: '决定任务中出现的敌方炮兵数量。' }
      : { displayName: `敵軍炮兵 ${level}`, description: '決定任務中出現的敵軍炮兵數量。' };
  }
  if (record.displayName === 'Tutorial Cutaways') {
    return locale === 'zh-cn'
      ? { displayName: '教程剖视图', description: '教程剖视图。' }
      : { displayName: '教學剖視圖', description: '教學剖視圖。' };
  }
  throw new Error(`Untranslated mutator: ${record.displayName}`);
}

const labelSets = Object.fromEntries(locales.map((locale) => [locale, {}]));
for (const locale of locales) {
  labelSets[locale]['map-entities.labels.json'] = sortedObject([...new Set(facts['map-entities'].map((record) => record.Name).filter(Boolean))].map((key) => {
    const term = requireGlossary(key, 'MapEntity.Name');
    return [key, { displayName: glossaryValue(term, locale) }];
  }));

  labelSets[locale]['medals.labels.json'] = sortedObject([...new Map(facts.medals.map((record) => [record.id, record])).entries()].map(([id, record]) => [id, {
    displayName: glossaryValue(requireGlossary(record['displayNameV2.Key'], `Medal ${id} name`), locale),
    hintText: glossaryValue(requireGlossary(record['hintTextV2.Key'], `Medal ${id} hint`), locale),
  }]));

  labelSets[locale]['punchcards.labels.json'] = sortedObject([...new Map(facts.punchcards.map((record) => [record.ID, record])).entries()].map(([id, record]) => [id, {
    title: glossaryValue(requireGlossary(record['Title.Key'], `Punchcard ${id} title`), locale),
    description: glossaryValue(requireGlossary(record['Description.Key'], `Punchcard ${id} description`), locale),
  }]));

  labelSets[locale]['missions.labels.json'] = sortedObject(missionRoutes.map((route) => {
    const record = missionRecords.get(route.source_record_id);
    const term = missionTerms.get(route.source_record_id);
    return [route.source_record_id, {
      displayName: glossaryValue(term, locale),
      location: missionLocation(record, locale),
    }];
  }));

  labelSets[locale]['achievements.labels.json'] = sortedObject(facts.achievements.map((record) => [record.name, {
    displayName: locale === 'en' ? record.displayName : achievementNames[locale][record.name],
    description: achievementDescription(record, locale),
  }]));

  labelSets[locale]['mutators.labels.json'] = sortedObject([...new Map(facts.mutators.map((record) => [mutatorKey(record), record])).entries()].map(([key, record]) => [key, mutatorTranslation(record, locale)]));
}

const fieldLabels = {
  en: {
    Armour: 'Armour', BronzeConditions: 'Bronze conditions', Cost: 'Cost', Damage: 'Damage', Description: 'Description', 'Description.Key': 'Description', DisplayName: 'Display name', GoldConditions: 'Gold conditions', Health: 'Health', ID: 'ID', ImmuneShells: 'Immune shells', ImpactRadius: 'Impact radius', IsRecon: 'Recon', MaxUses: 'Maximum uses', Name: 'Name', Position: 'Position', Requirements: 'Requirements', Role: 'Role', Scale: 'Scale', ShellId: 'Shell ID', ShellSpeed: 'Shell speed', SilverConditions: 'Silver conditions', Stars: 'Stars', State: 'State', 'Title.Key': 'Title', achievementForClearing: 'Clear achievement', achievementForGolding: 'Gold achievement', charge_N_maxRange: 'Maximum range by charge', contents: 'Contents', date: 'Date', defaultPowderCharge: 'Default powder charge', description: 'Description', displayName: 'Display name', 'displayNameV2.Key': 'Medal name', hidden: 'Hidden', 'hintTextV2.Key': 'Hint', horizontalDispersion: 'Horizontal dispersion', id: 'ID', location: 'Location', maxPowderCharges: 'Maximum powder charges', medalRefs: 'Medals', missionRef: 'Mission', name: 'Name', projectilesPerShell: 'Projectiles per shell', shellSpeedVariationPercent: 'Speed variation', tier: 'Tier', title: 'Title', type: 'Type', unlockedBy: 'Prerequisite', unlocks: 'Unlocks', verticalDispersion: 'Vertical dispersion',
  },
  'zh-cn': {
    Armour: '装甲', BronzeConditions: '铜牌条件', Cost: '花费', Damage: '伤害', Description: '说明', 'Description.Key': '说明', DisplayName: '显示名称', GoldConditions: '金牌条件', Health: '生命值', ID: 'ID', ImmuneShells: '免疫炮弹', ImpactRadius: '爆炸半径', IsRecon: '侦察类', MaxUses: '最大使用次数', Name: '名称', Position: '位置', Requirements: '需求条件', Role: '角色', Scale: '规模', ShellId: '炮弹ID', ShellSpeed: '炮弹速度', SilverConditions: '银牌条件', Stars: '星级', State: '状态', 'Title.Key': '标题', achievementForClearing: '通关成就', achievementForGolding: '全金成就', charge_N_maxRange: '各装药等级最大射程', contents: '内容', date: '日期', defaultPowderCharge: '默认装药', description: '说明', displayName: '显示名称', 'displayNameV2.Key': '勋章名称', hidden: '隐藏', 'hintTextV2.Key': '达成提示', horizontalDispersion: '水平散布', id: 'ID', location: '地点', maxPowderCharges: '最大装药数', medalRefs: '奖章', missionRef: '任务', name: '名称', projectilesPerShell: '每发投射物数量', shellSpeedVariationPercent: '速度浮动', tier: '等级', title: '标题', type: '类型', unlockedBy: '前置任务', unlocks: '后续任务', verticalDispersion: '垂直散布',
  },
  'zh-tw': {
    Armour: '裝甲', BronzeConditions: '銅牌條件', Cost: '花費', Damage: '傷害', Description: '說明', 'Description.Key': '說明', DisplayName: '顯示名稱', GoldConditions: '金牌條件', Health: '生命值', ID: 'ID', ImmuneShells: '免疫炮彈', ImpactRadius: '爆炸半徑', IsRecon: '偵察類', MaxUses: '最大使用次數', Name: '名稱', Position: '位置', Requirements: '需求條件', Role: '角色', Scale: '規模', ShellId: '炮彈 ID', ShellSpeed: '炮彈速度', SilverConditions: '銀牌條件', Stars: '星級', State: '狀態', 'Title.Key': '標題', achievementForClearing: '通關成就', achievementForGolding: '全金成就', charge_N_maxRange: '各裝藥等級最大射程', contents: '內容', date: '日期', defaultPowderCharge: '預設裝藥', description: '說明', displayName: '顯示名稱', 'displayNameV2.Key': '勳章名稱', hidden: '隱藏', 'hintTextV2.Key': '達成提示', horizontalDispersion: '水平散布', id: 'ID', location: '地點', maxPowderCharges: '最大裝藥數', medalRefs: '勳章', missionRef: '任務', name: '名稱', projectilesPerShell: '每發投射物數量', shellSpeedVariationPercent: '速度浮動', tier: '等級', title: '標題', type: '類型', unlockedBy: '前置任務', unlocks: '後續任務', verticalDispersion: '垂直散布',
  },
};

const ui = {
  en: {
    primary_navigation: 'Primary navigation', database_indexes: 'Database indexes', quick_jump: 'Quick jump', search_placeholder: 'Search shells, missions, achievements…', search_label: 'Search IRON NEST pages', search_no_results: 'No matching pages', search_unavailable: 'Search is temporarily unavailable', theme_to_light: 'Switch to light theme', theme_to_dark: 'Switch to dark theme', go: 'Go', language_switcher: 'Language', breadcrumb_navigation: 'Breadcrumb', home: 'Home', skip_to_content: 'Skip to content', data_page: '{entity} data page', entity_index: '{entity} index', verified_data: 'Verified data', field_readout: 'Field readout', related_records: 'Related {entity} records', record_provenance: 'Record provenance', game_version: 'Game version', source: 'Source', updated: 'Updated', confidence: 'Confidence', related_pages: 'Related pages', pages_in_index: 'Pages in this index', source_records_represented: 'Source records represented', verified_records: 'Verified records', related_indexes: 'Related indexes and missions', no_records: 'No records matched this approved route join.', tested_interpretation: 'Tested interpretation', no_tested_insight: 'No owner-tested interpretation is available yet. The page reports verified data only.', dataset_scope: 'Dataset scope', maximum_range: 'Maximum range', requisition_cost: 'Requisition cost', prerequisites: 'Prerequisites', following_missions: 'Following missions', medal_slots: 'Medal slots', mission_targets: 'Mission targets', steam_completion: 'Steam completion', official_names: 'Official names', localization_keys: 'Localization keys', source_records: 'Source records', mission_appearances: 'Mission appearances', unpublished_section: 'Unpublished section', placeholder_body: 'This route is present only so the site structure can be tested. It is marked noindex,follow and excluded from the sitemap until reviewed content or functionality is ready.', return_home: 'Return to the database home', official_update_evidence: 'Official update evidence', patch_source_timeline: 'Patch source timeline', steam_snapshot: 'Official Steam news snapshot. Detailed issue prose remains a later content task.', related_missions: 'Related missions', not_found_title: 'Page not found', not_found_description: 'The requested IronNestPedia page does not exist.', not_found_body: 'The requested route is not part of the published database.', home_eyebrow: 'IRON NEST verified data reference', current_question: 'Start with a current question', planned_teaser: 'Planned around the site’s verified shell fields; no inactive link is published.', browse_database: 'Browse the database', verified_pages: '{count} verified pages.', verified_entries: '{count} verified index entries.', latest_updates: 'Latest updates', view_tracker: 'View the patch-verified issue tracker', data_provenance: 'Data provenance', records_retain: 'Entity records retain game_version, data_source, last_updated, and confidence.', mission_map_title: 'Mission Map', mission_map_reason: 'The interactive mission map is reserved for a later release and is not yet available.',
  },
  'zh-cn': {
    primary_navigation: '主导航', database_indexes: '数据库索引', quick_jump: '快速跳转', search_placeholder: '搜索炮弹、任务、成就…', search_label: '搜索 IRON NEST 页面', search_no_results: '没有匹配页面', search_unavailable: '搜索暂时不可用', theme_to_light: '切换到浅色主题', theme_to_dark: '切换到深色主题', go: '前往', language_switcher: '语言', breadcrumb_navigation: '面包屑导航', home: '首页', skip_to_content: '跳到正文', data_page: '{entity}数据页', entity_index: '{entity}索引', verified_data: '已核实数据', field_readout: '字段读数', related_records: '相关{entity}记录', record_provenance: '数据来源', game_version: '游戏版本', source: '来源', updated: '更新时间', confidence: '可信度', related_pages: '相关页面', pages_in_index: '本索引包含的页面', source_records_represented: '收录的源记录', verified_records: '已核实记录', related_indexes: '相关索引与任务', no_records: '没有记录符合这个已批准的路由关联条件。', tested_interpretation: '实测解读', no_tested_insight: '暂无站长实测解读。本页只报告已核实数据。', dataset_scope: '数据集范围', maximum_range: '最大射程', requisition_cost: '征用花费', prerequisites: '前置任务数', following_missions: '后续任务数', medal_slots: '勋章槽位', mission_targets: '任务目标记录', steam_completion: 'Steam完成率', official_names: '官方名称', localization_keys: '本地化键数量', source_records: '源记录数', mission_appearances: '出现任务数', unpublished_section: '尚未发布的栏目', placeholder_body: '此路径仅用于测试网站结构，当前标记为 noindex,follow，并从 sitemap 中排除；待内容或功能审定后再发布。', return_home: '返回数据库首页', official_update_evidence: '官方更新依据', patch_source_timeline: '补丁来源时间线', steam_snapshot: '官方 Steam 新闻快照；具体问题说明将在后续内容步骤补充。', related_missions: '相关任务', not_found_title: '页面不存在', not_found_description: '请求的 IronNestPedia 页面不存在。', not_found_body: '请求的路径不属于当前已发布数据库。', home_eyebrow: 'IRON NEST 已核实数据参考站', current_question: '从当前问题开始', planned_teaser: '该功能将使用本站已核实的炮弹字段开发，目前不提供无效链接。', browse_database: '浏览数据库', verified_pages: '{count} 个已核实页面。', verified_entries: '{count} 条已核实索引记录。', latest_updates: '最新更新', view_tracker: '查看经补丁核实的问题追踪页', data_provenance: '数据来源说明', records_retain: '实体记录保留游戏版本、数据来源、更新时间和可信度。', mission_map_title: '任务地图', mission_map_reason: '交互式任务地图计划在后续版本推出，目前尚不可用。',
  },
  'zh-tw': {
    primary_navigation: '主導覽', database_indexes: '資料庫索引', quick_jump: '快速跳轉', search_placeholder: '搜尋炮彈、任務、成就…', search_label: '搜尋 IRON NEST 頁面', search_no_results: '沒有相符頁面', search_unavailable: '搜尋暫時無法使用', theme_to_light: '切換至淺色主題', theme_to_dark: '切換至深色主題', go: '前往', language_switcher: '語言', breadcrumb_navigation: '階層導覽', home: '首頁', skip_to_content: '跳至正文', data_page: '{entity}資料頁', entity_index: '{entity}索引', verified_data: '已核實資料', field_readout: '欄位讀數', related_records: '相關{entity}記錄', record_provenance: '資料來源', game_version: '遊戲版本', source: '來源', updated: '更新時間', confidence: '可信度', related_pages: '相關頁面', pages_in_index: '此索引包含的頁面', source_records_represented: '收錄的來源記錄', verified_records: '已核實記錄', related_indexes: '相關索引與任務', no_records: '沒有記錄符合這項已核准的路由關聯條件。', tested_interpretation: '實測解讀', no_tested_insight: '暫無站長實測解讀。本頁只報告已核實資料。', dataset_scope: '資料集範圍', maximum_range: '最大射程', requisition_cost: '徵用花費', prerequisites: '前置任務數', following_missions: '後續任務數', medal_slots: '勳章欄位', mission_targets: '任務目標記錄', steam_completion: 'Steam完成率', official_names: '官方名稱', localization_keys: '本地化鍵數量', source_records: '來源記錄數', mission_appearances: '出現任務數', unpublished_section: '尚未發布的區段', placeholder_body: '此路徑僅用於測試網站結構，目前標記為 noindex,follow 並從 sitemap 排除；內容或功能完成審核後才會發布。', return_home: '返回資料庫首頁', official_update_evidence: '官方更新依據', patch_source_timeline: '更新來源時間軸', steam_snapshot: '官方 Steam 新聞快照；詳細問題說明將於後續內容步驟補上。', related_missions: '相關任務', not_found_title: '找不到頁面', not_found_description: '要求的 IronNestPedia 頁面不存在。', not_found_body: '要求的路徑不在目前已發布的資料庫中。', home_eyebrow: 'IRON NEST 已核實資料參考站', current_question: '從目前的問題開始', planned_teaser: '此功能將以本站已核實的炮彈欄位開發，目前不提供無效連結。', browse_database: '瀏覽資料庫', verified_pages: '{count} 個已核實頁面。', verified_entries: '{count} 筆已核實索引記錄。', latest_updates: '最新更新', view_tracker: '查看經更新內容核實的問題追蹤頁', data_provenance: '資料來源說明', records_retain: '實體記錄保留遊戲版本、資料來源、更新時間與可信度。', mission_map_title: '任務地圖', mission_map_reason: '互動式任務地圖預計於後續版本推出，目前尚未開放。',
  },
};

const entityNames = {
  en: { Shell: 'Shell', Mission: 'Mission', Achievement: 'Achievement', MapEntity: 'Unit', Medal: 'Medal', Punchcard: 'Punchcard', Mutator: 'Mutator', 'Meta/Updates': 'Updates' },
  'zh-cn': { Shell: '炮弹', Mission: '任务', Achievement: '成就', MapEntity: '单位', Medal: '勋章', Punchcard: '征用卡', Mutator: '修正项', 'Meta/Updates': '更新' },
  'zh-tw': { Shell: '炮彈', Mission: '任務', Achievement: '成就', MapEntity: '單位', Medal: '勳章', Punchcard: '徵用卡', Mutator: '修正項', 'Meta/Updates': '更新' },
};

const patchTitles = {
  en: {
    '1840944183782791': 'Patch #5: Minor Fixes and Improvements', '1840944183774585': 'Patch #4: Bug Fixes and Gameplay Improvements', '1840310314354123': 'Steam Global Top Sellers for week of 4 Aug — 11 August 2026', '1840310314350447': 'Patch #3: IRON NEST - PATCH 1.0 (1577)', '1840310314347288': 'Patch #2: IRON NEST - PATCH 1.0 (1558)',
  },
  'zh-cn': {
    '1840944183782791': '补丁 #5：小幅修复与改进', '1840944183774585': '补丁 #4：Bug修复与玩法改进', '1840310314354123': '2026年8月4日至11日 Steam 全球热销榜', '1840310314350447': '补丁 #3：IRON NEST 1.0（1577）', '1840310314347288': '补丁 #2：IRON NEST 1.0（1558）',
  },
  'zh-tw': {
    '1840944183782791': '更新 #5：小幅修正與改善', '1840944183774585': '更新 #4：錯誤修正與遊玩體驗改善', '1840310314354123': '2026年8月4日至11日 Steam 全球暢銷榜', '1840310314350447': '更新 #3：IRON NEST 1.0（1577）', '1840310314347288': '更新 #2：IRON NEST 1.0（1558）',
  },
};

const siteBase = await readJson(join(dataRoot, 'en', 'site.json'));
const siteLabels = {
  en: { navigation: ['Shells', 'Missions', 'Achievements', 'Units'], indexes: ['Shells', 'Missions', 'Achievements', 'Units', 'Medals', 'Punchcards', 'Mutators'], footer: siteBase.footer_disclaimer, note: siteBase.data_note, placeholder: siteBase.placeholder_disclaimer, homeTitle: 'IronNestPedia — IRON NEST Database, Guides & Tools', homeDescription: 'Explore verified IRON NEST shell, mission, achievement, medal, punchcard, mutator and unit data, with version and source metadata retained.' },
  'zh-cn': { navigation: ['炮弹', '任务', '成就', '单位'], indexes: ['炮弹', '任务', '成就', '单位', '勋章', '征用卡', '修正项'], footer: '非官方玩家数据参考站。IRON NEST及相关商标归各自权利人所有。', note: '数据来自已核实的游戏文件与Steam API记录；每条记录均保留版本、来源、更新时间和可信度。', placeholder: '步骤21临时文案；步骤26将替换为审定后的合规内容。', homeTitle: 'IronNestPedia — IRON NEST 数据库、攻略与工具', homeDescription: '查询经核实的IRON NEST炮弹、任务、成就、勋章、征用卡、修正项和单位数据，并查看版本与来源信息。' },
  'zh-tw': { navigation: ['炮彈', '任務', '成就', '單位'], indexes: ['炮彈', '任務', '成就', '單位', '勳章', '徵用卡', '修正項'], footer: '非官方玩家資料參考站。IRON NEST及相關商標均屬各自權利人所有。', note: '資料來自已核實的遊戲檔案與Steam API記錄；每筆記錄皆保留版本、來源、更新時間與可信度。', placeholder: '步驟21暫用文字；步驟26將替換為審核後的合規內容。', homeTitle: 'IronNestPedia — IRON NEST 資料庫、攻略與工具', homeDescription: '查詢經核實的IRON NEST炮彈、任務、成就、勳章、徵用卡、修正項及單位資料，並查看版本與來源資訊。' },
};

const contactEmail = 'corrections@ironnestpedia.com';
const contactCopy = {
  en: {
    seo_title: 'Contact & Data Corrections | IronNestPedia',
    seo_description: 'Report incorrect IRON NEST data, include supporting evidence, or contact IronNestPedia by email.',
    eyebrow: 'Correction channel',
    h1: 'Contact & data corrections',
    intro: 'Email the site owner when a field, value, label, or page is wrong.',
    what_to_include: 'What to include',
    items: ['The page URL and incorrect field or value.', 'What you believe the correct value should be.', 'Evidence such as the game version, a screenshot, a game-file key, or a source link.'],
    email_action: 'Email a correction',
    email_note: 'This link opens your email app. IronNestPedia does not collect the message through a web form.',
    response_note: 'There is no automated support desk. Reports are reviewed against the evidence provided.',
    footer_label: 'Contact / corrections',
    generic_subject: 'Correction: IronNestPedia',
    report_issue: 'Report an issue',
    report_body: 'Page: {page_url}\n\nField or value that looks wrong:\n\nWhat should it say instead:\n\nEvidence (game version, screenshot, game-file key, or source link):\n\nAdditional context:',
  },
  'zh-cn': {
    seo_title: '联系与数据纠错 | IronNestPedia',
    seo_description: '通过电子邮件报告错误的IRON NEST数据，并附上游戏版本、截图、文件键或来源链接等依据。',
    eyebrow: '纠错渠道',
    h1: '联系与数据纠错',
    intro: '如果字段、数值、名称或页面有误，请发送邮件联系站长。',
    what_to_include: '邮件请写清楚',
    items: ['页面网址以及有误的字段或数值。', '你认为正确的内容。', '依据，例如游戏版本、截图、游戏文件键或来源链接。'],
    email_action: '发送纠错邮件',
    email_note: '此链接会打开你的邮件应用；IronNestPedia不会通过网页表单收集邮件内容。',
    response_note: '本站没有自动客服；站长会根据你提供的依据核对反馈。',
    footer_label: '联系／纠错',
    generic_subject: '纠错：IronNestPedia',
    report_issue: '报告问题',
    report_body: '页面：{page_url}\n\n不正确的字段或数值：\n\n应该改成：\n\n依据（游戏版本、截图、游戏文件键或来源链接）：\n\n补充说明：',
  },
  'zh-tw': {
    seo_title: '聯絡與資料糾錯 | IronNestPedia',
    seo_description: '透過電子郵件回報錯誤的IRON NEST資料，並附上遊戲版本、截圖、檔案鍵或來源連結等依據。',
    eyebrow: '糾錯管道',
    h1: '聯絡與資料糾錯',
    intro: '如果欄位、數值、名稱或頁面有誤，請寄信聯絡站長。',
    what_to_include: '郵件請寫清楚',
    items: ['頁面網址以及有誤的欄位或數值。', '你認為正確的內容。', '依據，例如遊戲版本、截圖、遊戲檔案鍵或來源連結。'],
    email_action: '寄送糾錯郵件',
    email_note: '此連結會開啟你的郵件應用程式；IronNestPedia不會透過網頁表單收集郵件內容。',
    response_note: '本站沒有自動客服；站長會依據你提供的資料核對回報。',
    footer_label: '聯絡／糾錯',
    generic_subject: '糾錯：IronNestPedia',
    report_issue: '回報問題',
    report_body: '頁面：{page_url}\n\n不正確的欄位或數值：\n\n應該改成：\n\n依據（遊戲版本、截圖、遊戲檔案鍵或來源連結）：\n\n補充說明：',
  },
};

const languageLabels = {
  en: ['English', '简体中文', '繁體中文'],
  'zh-cn': ['英文', '简体中文', '繁体中文'],
  'zh-tw': ['英文', '簡體中文', '繁體中文'],
};
const localeMeta = {
  en: { html_lang: 'en', hreflang: 'en' },
  'zh-cn': { html_lang: 'zh-CN', hreflang: 'zh-CN' },
  'zh-tw': { html_lang: 'zh-TW', hreflang: 'zh-TW' },
};

for (const locale of locales) {
  const labels = siteLabels[locale];
  const site = {
    ...siteBase,
    locale,
    ...localeMeta[locale],
    navigation: siteBase.navigation.map((item, index) => ({ ...item, label: labels.navigation[index] })),
    entity_indexes: siteBase.entity_indexes.map((item, index) => ({ ...item, label: labels.indexes[index] })),
    languages: locales.map((code, index) => ({ code, label: languageLabels[locale][index], hreflang: localeMeta[code].hreflang })),
    footer_disclaimer: labels.footer,
    contact_email: contactEmail,
    contact: contactCopy[locale],
    data_note: labels.note,
    placeholder_disclaimer: labels.placeholder,
    home_seo: { title: labels.homeTitle, description: labels.homeDescription },
    entity_names: entityNames[locale],
    field_labels: fieldLabels[locale],
    patch_titles: patchTitles[locale],
    ui: ui[locale],
  };
  await writeJson(join(dataRoot, locale, 'site.json'), site);
}

const homeBase = await readJson(join(dataRoot, 'en', 'home.json'));
const homeCopy = {
  en: {
    h1: homeBase.h1, hero: { description: homeBase.blocks[0].description, stats: homeBase.blocks[0].hero_stats.map((stat) => stat.label), ctas: homeBase.blocks[0].cta_buttons.map((cta) => cta.label), teaser: homeBase.blocks[0].dev_teaser.label }, cards: siteLabels.en.indexes, blocks: ['Homepage Hero', 'Database indexes', 'Latest updates', 'Selected guides', 'Data notes', 'Footer'], latest: 'Game Version 4 (Patch #5)', compliance: ['About', 'Privacy Policy', 'Cookie Policy', 'Terms of Service', 'Contact'],
  },
  'zh-cn': {
    h1: 'IronNestPedia — IRON NEST 数据库、攻略与工具', hero: { description: '在《IRON NEST》中，你将坐进一座巨型炮塔的控制席——这台战争机器专为主宰残酷的柴油朋克战场而造。', stats: ['好评如潮 · 12,254 篇评测中 98% 好评', '452 个已核实数据点 · 105 个页面', '3 种语言', '游戏版本 4 · 补丁 #5'], ctas: ['“幽灵炮台”任务指南', '已知问题与路线图追踪', '浏览数据库'], teaser: '🔧 综合射击规划器 · 开发中' }, cards: siteLabels['zh-cn'].indexes, blocks: ['首页主视觉', '数据库入口', '最新更新', '精选指南', '数据说明', '页脚'], latest: '游戏版本4（补丁 #5）', compliance: ['关于本站', '隐私政策', 'Cookie政策', '服务条款', '联系我们'],
  },
  'zh-tw': {
    h1: 'IronNestPedia — IRON NEST 資料庫、攻略與工具', hero: { description: '在《IRON NEST》中，你將坐進一座巨型砲塔的控制席——這台戰爭機器專為支配殘酷的柴油龐克戰場而造。', stats: ['壓倒性好評 · 12,254 篇評論中 98% 好評', '452 個已核實資料點 · 105 個頁面', '3 種語言', '遊戲版本 4 · 更新 #5'], ctas: ['「幻影炮台」任務指南', '已知問題與開發路線追蹤', '瀏覽資料庫'], teaser: '🔧 綜合射擊規劃器 · 開發中' }, cards: siteLabels['zh-tw'].indexes, blocks: ['首頁主視覺', '資料庫入口', '最新更新', '精選攻略', '資料說明', '頁尾'], latest: '遊戲版本4（更新 #5）', compliance: ['關於本站', '隱私權政策', 'Cookie政策', '服務條款', '聯絡我們'],
  },
};

for (const locale of locales) {
  const copy = structuredClone(homeBase);
  const tr = homeCopy[locale];
  copy.h1 = tr.h1;
  copy.blocks.forEach((block, index) => { block.name = tr.blocks[index]; });
  const hero = copy.blocks.find((block) => block.order === 1);
  hero.description = tr.hero.description;
  hero.hero_stats.forEach((stat, index) => { stat.label = tr.hero.stats[index]; });
  hero.cta_buttons.forEach((cta, index) => { cta.label = tr.hero.ctas[index]; });
  hero.dev_teaser.label = tr.hero.teaser;
  copy.blocks.find((block) => block.order === 2).cards.forEach((card, index) => { card.label = tr.cards[index]; });
  copy.blocks.find((block) => block.order === 3).latest_patch_label = locale === 'en' ? 'Patch #5' : locale === 'zh-cn' ? '补丁 #5' : '更新 #5';
  copy.blocks.find((block) => block.order === 5).fields.latest_version_label = tr.latest;
  copy.blocks.find((block) => block.order === 6).compliance_links = tr.compliance;
  await writeJson(join(dataRoot, locale, 'home.json'), copy);
}

const routeMap = new Map(routes.map((route) => [route.url_path, route]));
const entityFacts = { Shell: facts.shells, Mission: facts.missions, Achievement: facts.achievements, MapEntity: facts['map-entities'] };
const idFields = { Shell: 'ShellId', Mission: 'id', Achievement: 'name', MapEntity: 'ID' };
function rowsForRoute(route) {
  const rows = entityFacts[route.entity] ?? [];
  const ids = route.data_source?.filter?.ID_in ?? [route.source_record_id];
  return rows.filter((row) => ids.includes(row[idFields[route.entity]]));
}
function labelForRoute(route, locale) {
  if (!route || route.page_type === 'index') return '';
  if (route.entity === 'Shell') return route.source_record_id;
  if (route.entity === 'Mission') return labelSets[locale]['missions.labels.json'][route.source_record_id]?.displayName ?? route.source_record_id;
  if (route.entity === 'Achievement') return labelSets[locale]['achievements.labels.json'][route.source_record_id]?.displayName ?? route.source_record_id;
  if (route.entity === 'MapEntity') {
    const rows = rowsForRoute(route);
    const preferred = rows.find((row) => normalize(requireGlossary(row.Name, 'MapEntity label').english) === normalize(route.source_record_id)) ?? rows[0];
    return labelSets[locale]['map-entities.labels.json'][preferred?.Name]?.displayName ?? route.source_record_id;
  }
  return route.source_record_id ?? route.url_path;
}

const indexSeo = {
  'zh-cn': {
    '/shells': ['IRON NEST 炮弹数据库：20种弹药数据', '比较20种可用炮弹的速度、伤害、爆炸半径和各装药等级射程，并区分不会出现在玩家弹药中的EMPT哨兵记录。', 'IRON NEST 炮弹数据库', ['IRON NEST 炮弹类型', 'IRON NEST 弹药数据', 'IRON NEST 炮弹射程']],
    '/missions': ['IRON NEST 任务列表：17个战役与挑战任务', '查看17个正式任务的前置关系、奖章、成就和任务内目标记录；调试、教程重复体与Base模板不计入玩家任务。', 'IRON NEST 任务列表', ['IRON NEST 任务攻略', 'IRON NEST 战役顺序', 'IRON NEST 挑战任务']],
    '/achievements': ['IRON NEST 成就列表：33项解锁条件与完成率', '查看33项Steam成就对应的任务、CLEAR或GOLD条件及实时全球完成率。', 'IRON NEST 成就列表', ['IRON NEST Steam成就', 'IRON NEST 成就条件', 'IRON NEST 全金成就']],
    '/units': ['IRON NEST 单位数据库：任务目标与单位数据', '按任务汇总敌军、友军、目标和参考实体的生命、装甲、星级与角色配置，并保留合并前的源ID。', 'IRON NEST 单位数据库', ['IRON NEST 敌军单位', 'IRON NEST 任务目标', 'IRON NEST 单位数据']],
    '/medals': ['IRON NEST 勋章条件：铜牌、银牌与金牌要求', '集中查看正式任务引用的勋章名称、达成提示，以及铜牌、银牌和金牌的结构化条件。', 'IRON NEST 勋章条件', ['IRON NEST 金牌条件', 'IRON NEST 任务勋章', 'IRON NEST 奖章列表']],
    '/punchcards': ['IRON NEST 征用卡列表：花费、次数与效果', '比较33张正式征用卡的花费、最大使用次数、需求条件与官方效果说明，包括炮弹卡和独立能力。', 'IRON NEST 征用卡列表', ['IRON NEST 征用卡', 'IRON NEST 打孔卡', 'IRON NEST 炮弹解锁']],
    '/mutators': ['IRON NEST 修正项：等级与效果说明', '查看修正项的显示名称、等级和效果差异，包括空中方位、距离精度与敌方炮兵数量配置。', 'IRON NEST 修正项', ['IRON NEST mutator', 'IRON NEST 难度修正', 'IRON NEST 空中测距']],
    '/known-issues': ['IRON NEST 已知问题与更新追踪', '依据官方Steam补丁记录追踪已修复问题、当前更新和后续路线，避免把旧问题误报为仍然存在。', 'IRON NEST 已知问题', ['IRON NEST Bug修复', 'IRON NEST 更新日志', 'IRON NEST 路线图', 'IRON NEST 存档问题']],
  },
  'zh-tw': {
    '/shells': ['IRON NEST 炮彈資料庫：20種彈藥資料', '比較20種可用炮彈的速度、傷害、爆炸半徑與各裝藥等級射程，並區分不會出現在玩家彈藥中的EMPT哨兵記錄。', 'IRON NEST 炮彈資料庫', ['IRON NEST 炮彈種類', 'IRON NEST 彈藥資料', 'IRON NEST 炮彈射程']],
    '/missions': ['IRON NEST 任務列表：17個戰役與挑戰任務', '查看17個正式任務的前置關係、勳章、成就及任務內目標記錄；除錯、教學重複項與Base範本不列入玩家任務。', 'IRON NEST 任務列表', ['IRON NEST 任務攻略', 'IRON NEST 戰役順序', 'IRON NEST 挑戰任務']],
    '/achievements': ['IRON NEST 成就列表：33項解鎖條件與完成率', '查看33項Steam成就對應的任務、CLEAR或GOLD條件，以及即時全球完成率。', 'IRON NEST 成就列表', ['IRON NEST Steam成就', 'IRON NEST 成就條件', 'IRON NEST 全金成就']],
    '/units': ['IRON NEST 單位資料庫：任務目標與單位資料', '依任務彙整敵軍、友軍、目標及參照實體的生命、裝甲、星級與角色設定，並保留合併前的來源ID。', 'IRON NEST 單位資料庫', ['IRON NEST 敵軍單位', 'IRON NEST 任務目標', 'IRON NEST 單位資料']],
    '/medals': ['IRON NEST 勳章條件：銅牌、銀牌與金牌要求', '集中查看正式任務引用的勳章名稱、達成提示，以及銅牌、銀牌與金牌的結構化條件。', 'IRON NEST 勳章條件', ['IRON NEST 金牌條件', 'IRON NEST 任務勳章', 'IRON NEST 獎章列表']],
    '/punchcards': ['IRON NEST 徵用卡列表：花費、次數與效果', '比較33張正式徵用卡的花費、最大使用次數、需求條件與官方效果說明，包含炮彈卡及獨立能力。', 'IRON NEST 徵用卡列表', ['IRON NEST 徵用卡', 'IRON NEST 打孔卡', 'IRON NEST 炮彈解鎖']],
    '/mutators': ['IRON NEST 修正項：等級與效果說明', '查看修正項的顯示名稱、等級及效果差異，包含空中方位、距離精度與敵軍炮兵數量設定。', 'IRON NEST 修正項', ['IRON NEST mutator', 'IRON NEST 難度修正', 'IRON NEST 空中測距']],
    '/known-issues': ['IRON NEST 已知問題與更新追蹤', '依據官方Steam更新記錄追蹤已修正問題、目前更新與後續規劃，避免將舊問題誤報為仍然存在。', 'IRON NEST 已知問題', ['IRON NEST 錯誤修正', 'IRON NEST 更新日誌', 'IRON NEST 開發路線', 'IRON NEST 存檔問題']],
  },
};

function localizedSeo(page, locale) {
  const route = routeMap.get(page.url_path);
  const fixed = indexSeo[locale][page.url_path];
  if (fixed) return { url_path: page.url_path, primary_keyword: fixed[2], keyword_candidates: fixed[3].slice(0, page.keyword_candidates.length), title: fixed[0], description: fixed[1] };
  if (!route) throw new Error(`SEO page has no route: ${page.url_path}`);
  const label = labelForRoute(route, locale);
  const entity = entityNames[locale][route.entity];
  let title;
  let description;
  let primary;
  let candidates;
  if (route.entity === 'Shell') {
    const row = rowsForRoute(route)[0];
    title = locale === 'zh-cn' ? `IRON NEST ${label}炮弹：伤害、爆炸半径与射程` : `IRON NEST ${label}炮彈：傷害、爆炸半徑與射程`;
    description = locale === 'zh-cn'
      ? `查看${label}炮弹的速度${row.ShellSpeed}、伤害${row.Damage}、爆炸半径${row.ImpactRadius}、装药等级射程和关联征用卡数据。`
      : `查看${label}炮彈的速度${row.ShellSpeed}、傷害${row.Damage}、爆炸半徑${row.ImpactRadius}、裝藥等級射程與相關徵用卡資料。`;
    primary = `IRON NEST ${label}${entity}`;
    candidates = locale === 'zh-cn' ? [`${label}炮弹数据`, `${label}伤害`, `${label}射程`] : [`${label}炮彈資料`, `${label}傷害`, `${label}射程`];
  } else if (route.entity === 'Mission') {
    const row = missionRecords.get(route.source_record_id);
    const targetSource = route.embedded_data_sources?.find((source) => source.file.endsWith('/map-entities.json'));
    const match = targetSource?.filter?.match(/^missionRef == "([^"]+)"$/);
    const targets = match ? facts['map-entities'].filter((item) => item.missionRef === match[1]).length : 0;
    title = locale === 'zh-cn' ? `IRON NEST“${label}”任务：奖章、成就与目标` : `IRON NEST「${label}」任務：勳章、成就與目標`;
    description = locale === 'zh-cn'
      ? `汇总“${label}”的${row.unlockedBy.length}个前置任务、${row.unlocks.length}个后续任务、${row.medalRefs.length}个奖章槽、关联成就和${targets}条目标记录。`
      : `彙整「${label}」的${row.unlockedBy.length}個前置任務、${row.unlocks.length}個後續任務、${row.medalRefs.length}個勳章欄位、相關成就與${targets}筆目標記錄。`;
    primary = `IRON NEST ${label}${entity}`;
    candidates = locale === 'zh-cn' ? [`${label}任务攻略`, `${label}奖章`, `${label}成就`] : [`${label}任務攻略`, `${label}勳章`, `${label}成就`];
  } else if (route.entity === 'Achievement') {
    const missionPath = route.internal_link_candidates?.find((path) => path.startsWith('/missions/'));
    const missionLabel = labelForRoute(routeMap.get(missionPath), locale);
    title = locale === 'zh-cn' ? `IRON NEST“${label}”成就：条件与完成率` : `IRON NEST「${label}」成就：條件與完成率`;
    description = locale === 'zh-cn'
      ? `查看“${label}”的解锁条件、关联任务“${missionLabel}”及Steam全球完成率，完成率数据会随玩家进度更新。`
      : `查看「${label}」的解鎖條件、相關任務「${missionLabel}」及Steam全球完成率；完成率資料會隨玩家進度更新。`;
    primary = `IRON NEST ${label}${entity}`;
    candidates = locale === 'zh-cn' ? [`${label}成就`, `${label}解锁条件`, `${missionLabel}成就`] : [`${label}成就`, `${label}解鎖條件`, `${missionLabel}成就`];
  } else if (route.entity === 'MapEntity') {
    const rows = rowsForRoute(route);
    const missionCount = new Set(rows.map((row) => row.missionRef)).size;
    title = locale === 'zh-cn' ? `IRON NEST ${label}单位：任务、生命与装甲数据` : `IRON NEST ${label}單位：任務、生命與裝甲資料`;
    description = locale === 'zh-cn'
      ? `汇总${label}在${missionCount}个任务中的${rows.length}条生成记录，包括生命、装甲、星级和角色配置，并保留全部源ID差异。`
      : `彙整${label}在${missionCount}個任務中的${rows.length}筆生成記錄，包含生命、裝甲、星級與角色設定，並保留所有來源ID差異。`;
    primary = `IRON NEST ${label}${entity}`;
    candidates = locale === 'zh-cn' ? [`${label}单位数据`, `${label}任务`, `${label}装甲`] : [`${label}單位資料`, `${label}任務`, `${label}裝甲`];
  } else {
    throw new Error(`Unsupported SEO route: ${page.url_path}`);
  }
  return { url_path: page.url_path, primary_keyword: primary, keyword_candidates: candidates.slice(0, page.keyword_candidates.length), title, description };
}

const seoFiles = (await readdir(join(dataRoot, 'en', 'seo'))).filter((name) => name.endsWith('.json')).sort();
for (const locale of ['zh-cn', 'zh-tw']) {
  for (const file of seoFiles) {
    const source = await readJson(join(dataRoot, 'en', 'seo', file));
    await writeJson(join(dataRoot, locale, 'seo', file), {
      ...source,
      pages: source.pages.map((page) => localizedSeo(page, locale)),
    });
  }
}

for (const locale of locales) {
  for (const [file, labels] of Object.entries(labelSets[locale])) {
    await writeJson(join(dataRoot, locale, 'entities', file), labels);
  }
}

console.log(JSON.stringify({
  status: 'PASS',
  locales,
  mission_join: { expected: missionRoutes.length, matched: missionTerms.size, unmatched: [] },
  official_join_coverage: {
    map_entity_name_keys: Object.keys(labelSets.en['map-entities.labels.json']).length,
    medal_ids: Object.keys(labelSets.en['medals.labels.json']).length,
    punchcard_ids: Object.keys(labelSets.en['punchcards.labels.json']).length,
  },
  ai_translation_coverage: {
    achievements: Object.keys(labelSets.en['achievements.labels.json']).length,
    mutator_variants: Object.keys(labelSets.en['mutators.labels.json']).length,
  },
  seo_pages_per_translated_locale: (await Promise.all(seoFiles.map(async (file) => (await readJson(join(dataRoot, 'en', 'seo', file))).pages.length))).reduce((a, b) => a + b, 0),
}, null, 2));
