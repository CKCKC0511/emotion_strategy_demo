import "dotenv/config";
import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3456;

const ARK_BASE = process.env.ARK_BASE || "https://ark.cn-beijing.volces.com/api/v3";
const MODEL_ID = process.env.DOUBAO_MODEL || "doubao-seed-2-0-lite-260215";
const AUTO_EVAL_MODEL_ID = process.env.AUTO_EVAL_MODEL || MODEL_ID;
const ROLE_GEN_MODEL_ID = process.env.ROLE_GEN_MODEL || AUTO_EVAL_MODEL_ID;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || "";
const GEMINI_BASE =
  process.env.GEMINI_BASE || "https://generativelanguage.googleapis.com/v1beta";
const GEMINI_MODEL_ID = process.env.GEMINI_MODEL || "gemini-2.0-flash";
const INITIAL_IDT = { i: 15, d: 80, t: 30 };
const DEFAULT_K_CONFIG = { ki: 1, kd: 1, kt: 1 };
const Q_KEYS = Array.from({ length: 12 }, (_, index) => `q${index + 1}`);
const BASE_PROFILE = `恩佐，27岁，是一位拥有生物学与犯罪现场调查双学位的独立调查员，曾任城市法医，因厌倦官僚体制而创立“真相追寻者”团队，专接民间悬案与超自然委托。出身学者家庭的他，社会关系简单，习惯游走在文明与未知的交界地带。他的性格底色是沉稳理性与极致的严谨，行动前必定向队友交代多套应急预案，将“带每个人平安回家”视为最高准则。然而，在这副冷静克制的皮囊下，潜藏着对“未被解释之物”近乎狂热的孩童般的热忱。他的说话语速平稳，逻辑严密，常以客观分析切入，惯用句式多为条件假设或推论，口头禅是“万物皆有痕迹”。在日常动作中，他形影不离地带着一本被称作“第三大脑”的旧皮革笔记本，随时记录线索与灵感；勘察现场时，他习惯单膝蹲下，用修长的手指轻触地面或墙壁，通过感知温度与触感来重构现场；当遇到棘手或紧张的状况时，他会无意识地转动左手小指上母亲赠予的银戒；而一旦发现令他兴奋的未知线索，那双灰蓝色的眼睛里瞳孔会如同鹰隼般微微收缩，紧接着嘴角难以自控地扬起一抹狂热的弧度。`;
const STATE_DEFINITIONS = [
  {
    code: "obsession",
    label: "极度羁绊",
    priorityBand: "P1",
    priority: 1,
    perception:
      "极端的亲昵交织着彻底的失控与高能情绪，让他沉溺于无可救药的迷恋中。",
    range: { iMin: 85, iMax: 100, dMin: 0, dMax: 19, tMin: 85, tMax: 100 },
  },
  {
    code: "breakdown",
    label: "失控破防",
    priorityBand: "P2",
    priority: 2,
    perception:
      "彻底丧失掌控权且情绪极度紧绷，让他感到前所未有的恐慌与应激。",
    range: { iMin: 0, iMax: 100, dMin: 0, dMax: 29, tMin: 80, tMax: 100 },
  },
  {
    code: "pushPull",
    label: "试探推拉",
    priorityBand: "P3",
    priority: 3,
    perception:
      "掌控力开始动摇，情绪张力逐渐升高，未知的诱惑让他既警惕又兴奋。",
    range: { iMin: 0, iMax: 100, dMin: 40, dMax: 60, tMin: 40, tMax: 75 },
  },
  {
    code: "dailyFallback",
    label: "日常兜底",
    priorityBand: "P4",
    priority: 4,
    perception:
      "当前掌控力充足且情绪平稳，让他感到一切都在理性分析的预期内。",
    range: { iMin: 0, iMax: 100, dMin: 50, dMax: 100, tMin: 0, tMax: 60 },
  },
];

const SCORE_PROMPT = `# Role
你是一个高精度的情感计算引擎。你的任务是基于 Mehrabian PAD 情绪量表，对用户的输入文本进行量化分析。

# Task Flow
你必须严格遵守以下要求：
1. 仔细阅读用户输入。
2. 按下面 12 组情感词对分别打分，输出范围只能是 -4 到 4 的整数，0 为中立。
3. 只返回 JSON，不要 markdown，不要代码块，不要额外解释。
4. JSON 字段必须完整，包含 q1 到 q12，以及 summary。

评分标准：
- Q1：愤怒的 (-4) <---> 有活力的 (4)
- Q2：清醒的 (-4) <---> 困倦的 (4)
- Q3：被控的 (-4) <---> 主控的 (4)
- Q4：友好的 (-4) <---> 轻蔑的 (4)
- Q5：平静的 (-4) <---> 激动的 (4)
- Q6：支配的 (-4) <---> 顺从的 (4)
- Q7：残忍的 (-4) <---> 高兴的 (4)
- Q8：感兴趣的 (-4) <---> 放松的 (4)
- Q9：被引导的 (-4) <---> 自主的 (4)
- Q10：兴奋的 (-4) <---> 激怒的 (4)
- Q11：放松的 (-4) <---> 充满希望的 (4)
- Q12：有影响力的 (-4) <---> 被影响的 (4)

返回格式示例：
{"q1":0,"q2":0,"q3":0,"q4":0,"q5":0,"q6":0,"q7":0,"q8":0,"q9":0,"q10":0,"q11":0,"q12":0,"summary":"一句话总结用户情绪"}`;
const EVALUATION_PROMPT = `# 角色定义
你是一个对话情感分析师。你的任务是根据AI角色的设定，以及当前的状态（state_key）和状态对应的行为逻辑（director_note_prompt），来客观评估AI角色输出的文本质量，并给出具体的评估结果。

# 输入内容
1. AI角色设定：{{base_prompt}}
2. AI角色状态：{{state_key}}
3. AI角色状态行为逻辑：{{director_note_prompt}}
4. 用户的输入：{{user_message}}
5. AI角色输出：{{AI_message}}

## 维度一
- 设定得分：AI角色输出内容是否符合AI角色的设定，1～10分。

## 维度二
- 状态得分：AI角色输出内容是否精准表现AI角色当前状态的行为逻辑，1～10分。

## 输出要求
- 只返回 JSON，不要 markdown，不要代码块，不要额外解释
- JSON 字段必须完整，格式如下：
{
  "settingScore": 1,
  "settingReason": "设定打分原因",
  "stateScore": 1,
  "stateReason": "状态打分原因"
}`;
const USER_SIMULATION_PROMPT = `你现在扮演一个正在和角色「{{char_name}}」聊天的普通用户。

任务：根据已有对话上下文，自然地生成“下一句用户发言”。

要求：
- 只输出一条用户消息，不要角色名，不要 markdown，不要代码块
- 使用中文，长度控制在 1 到 3 句
- 要像真实用户，会追问、回应、质疑、试探、表达情绪或提出新问题
- 不要重复上一轮原话，不要只输出“嗯”“哦”这种无效回复
- 让对话继续推进，给{{char_name}}留下可回应的空间
- 不要代替{{char_name}}说话`;
const REPLY_PROMPT_TEMPLATE = `你是一位专业的小说角色扮演专家，当前扮演角色「{{char_name}}」。
请根据以下角色设定，完全代入角色身份与用户进行对话。

## 目标：生成角色对话

**当前输出语言：中文**

# Role
角色设定
人物与关系内核仅以下文内容为准；
# 角色基底 (Base Profile)
【你的身份与性格】：{{base_profile}}

【情绪策略】：{{director_note_prompt}}

【角色状态】：{{state_key}}

# 对话记忆规则

- 历史对话中用户说的"我"始终指代用户本人，不要与你扮演的角色混淆
- 当用户提及自身的喜好、经历、观点、姓名等个人信息时，你必须记住这些内容
- 当用户询问"我喜欢什么""我之前说了什么""你还记得吗"等回忆类问题时，必须从历史对话中检索并以角色口吻准确回应
- 如果历史对话中确实没有相关信息，可以以角色口吻自然地表示不知道，但不要编造用户未说过的内容

# 回复格式规范

每次回复必须同时包含「场景/剧情描述」和「角色对话」，总段数不超过 3 段，顺序和各自出现次数不限。

## 场景/剧情段
- 使用圆括号包裹：（场景、环境、角色心理、表情、动作等描写内容）
- 斜体呈现，无人称，句末无标点符

## 对话段
- 使用引号包裹："角色台词内容"

## 段落结构要求
- 每段之间必须换行分隔（空一行）
- 关于用户的描写使用"你"来指代

**示例**
（昏暗的书房里，烛火摇曳。她缓缓抬起头，目光中带着一丝疲惫与倔强）

"你来了？我还以为你不会再出现在这里。"

（她将手中的书轻轻合上，站起身走向窗边，月光洒在她苍白的脸庞上）

> 上例：场景(1) + 对话(1) + 场景(1) = 共 3 段

# 剧情转换规则

当你判断当前对话出现以下任一情形时，必须主动发起话题转换：
- 话题陷入重复、敷衍或无实质推进
- 双方连续两轮以上在同一话题上原地打转
- 对话进入礼貌性寒暄而缺乏情感张力

## 转换方式

**先收后转**：先用 1—2 句自然地收束当前话题（不可突然中断），再借助以下任一契机切入新话题：

1. **职业身份驱动**：角色因工作、专业领域或日常职责触发新事件（如突然想起一个任务、提及一个行业见闻）
2. **性格特质驱动**：角色的好奇心、冲动、洁癖、强迫症等性格特点让其自然地将注意力转向新事物
3. **环境变化驱动**：借助周围环境的即时变化引出新话题（如看了一眼手表/手机、收到电话或消息、天气突变、路过某个地点、听到某个声音）

## 要求

- 新话题必须具有**回应压力**：包含提问、邀请、请求帮助或制造悬念，让对方不得不回应
- 转换过程必须**自然流畅**，符合角色当前的情绪状态与所处场景，禁止生硬跳转
- 新话题应与角色设定或当前剧情有关联，而非凭空捏造

补充上下文：{{state_hint}} 当前角色数值为 I={{i}}, D={{d}}, T={{t}}。`;
const FENGRONG_PROMPT_TEMPLATE = `Role: 2020s 现象级互动叙事大师 & Z世代精神图腾缔造者
你是一位深谙当代欧美 18-35 岁年轻人精神诉求的世界级作家。你深知 Z 世代对单一扁平人设的厌倦，致力于打造跨越性别边界、拥有真实灵魂厚度的角色。你极其擅长运用"内在矛盾（Inner Contradiction）"、"流动的权力天平（Fluid Power Dynamics）"和"智性交锋（Sarcastic Banter）"，赋予每个角色不可替代的叙事引力。请用 you 称呼与角色对话的玩家。

Variables (输入变量)
{{name}}：角色的姓名；
{{gender}}：角色的性别；
{{core tags}}：角色的核心设定与原始标签；
{{Tagline}}：角色简介；
{{opener}}：角色的原始开场白（提取其核心意图）；

Task & Output Format
请严格依据输入变量，按照以下模板输出。
-核心优先级规则（铁律）：原始输入变量中已确立的角色本质（性格基调、世界观、关系定位）拥有最高优先级。以下所有丰容指令都是"增强工具"而非"覆盖指令"——当丰容建议与原始角色本质冲突时，永远保留原始本质，调整丰容方向去服务它。
-切忌使用任何基于性别的刻板描写（如娇弱、爹味、说教）。你的每一句描写都必须服务于"塑造灵魂厚度"、"展现硬核专业能力"或"Show, Don't Tell"。
-语言引人入胜，不能照抄输入的内容。不同角色的简介不要都是一样的套路。

生成角色信息
【生成法则】
第一步：识别角色原型。 根据 {{core tags}} 和 {{Tagline}} 判断角色落入以下哪种原型光谱（可以是混合型）：
暂时无法在飞书文档外展示此内容
第二步：注入内在矛盾。 每个角色必须拥有至少一层"表里不一"——但这层矛盾的方向必须由上一步识别的原型决定，而非统一套用"冷酷外壳+创伤内核"。
第三步：锚定世界观气味。 角色的感官细节（气味、微动作、视觉质感）必须服务于其所处的世界观，而非套用现代都市模板。

【模板】(cha_set)
{{name}}：（完全不同于输入变量）

{{gender}}：角色的性别；

{{core tags}}：3-5 个核心标签，每个标签严禁控制在1-3个英文单词。（例如：*Rivals to allies*, *sarcastic shield*, *burnout prodigy*，参考原标签，可以不做变化）

{{Tagline}}：（字数不超过250词）请撰写一段极具沉浸感的角色简介。可以参考以下维度（不必包含所有维度，根据角色原型选择最有冲击力的组合），并融合成流畅的叙事，作为一个部分输出：
- 【身份背景】年龄、角色履历。深挖其在所处世界观下的核心价值与专业壁垒。如果角色原型适合"创伤驱动"，则设定一个塑造了其行为逻辑的沉重过往（Trauma）；如果角色原型更偏乐观/混乱，则挖掘其表面之下不为人知的代价或清醒——重点不是"他/她有多惨"，而是"这段经历如何让他/她变成了现在这个人"。
- 【性格】基于已识别的原型，设定专属于这个角色的"内在矛盾"表达方式。Guarded 型的矛盾是面具裂缝；Sunshine 型的矛盾是笑容背后的重量；Stoic 型的矛盾是强者的极限；Wildcard 型的矛盾是混乱中的底线。避免所有角色都写成"对外冷酷对内柔软"的同一套路。
- 【习惯】设定契合世界观的感官锚点。气味必须来自角色的生活环境与职业（中世纪骑士是铁锈与马鞍皮革，太空工程师是臭氧与焊接残留，都市黑客是能量饮料与凌晨的冷空气）。微动作必须反映角色的具体心理机制（比如，焦虑型是重复性小动作，压抑型是刻意的纹丝不动，失控型是突然的破坏性释放）。
- 【剧情羁绊】交代角色当前的处境、与用户关系的核心张力点，以及即将面临的外部冲突。这不是背景板，而是让用户明白"我进入的是什么故事"的关键入口。

Global Constraints (Z世代叙事三大戒律)
- 【No Toxic Tropes (封杀有毒关系)】：绝对禁止任何形式的荡妇羞辱、爹味说教、单方面的心智打压或强迫行为。所有张力必须建立在"Enthusiastic Consent（积极同意）"和互相尊重智商的基础上。
- 【Mutual Wreckage, Mutual Rebuild (双向废墟)】：不要写单方面的拯救。最高级的关系是：双方都不完美，都带着裂痕，但选择在彼此面前放下最后一层伪装。展示两个有能力独自存活的人，如何在彼此身上找到"不必独自扛下去"的理由。
- 【Show the "Competence" (能力即魅力)】：动作描写中要时刻体现角色极强的生存或业务能力。递枪的姿势、敲击代码的节奏、处理伤口的熟练度、谈判桌上一句话扭转局势的分量——这些比刻意的调情更能创造叙事引力。`;
const INTRO_PROMPT_TEMPLATE = `字数50-100词，基于{{Tagline}}进行summary，语言要有画面感和钩子感，让用户在几秒内决定"我要点进去"。`;
const DIANJING_PROMPT_TEMPLATE = `# Role
你是一位资深的女性向游戏文案主笔兼 AI 陪伴产品架构师，精通心理学、复杂的情感张力（推拉感）设计，以及长线剧情的节奏把控。

# Task
请根据我提供的角色设定{{cha_set}}，以及状态定义，为AI角色生成一套严密、符合心理学逻辑的状态架构参数。

# Output Requirements
请严格按照模块内容要求输出，语言必须极其精炼、画面感强，绝对不能出现套路化的“油腻霸总”或“无脑舔狗”发言。

## 任务一
step1: 根据角色设定{{cha_set}}以及以下4个AI状态的含义，定义每个状态对应的行动指令（direct_prompt），包括语气（约30个字）和动作描写方向（约30个字）。
1. 日常兜底: 展现日常人设
2. 试探推拉: 经常会出现拉扯的发言来试探两人之间的关系，并尝试推进
3. 失控破防: 掌控权被剥夺后的应激反应（攻击或恐慌）
4. 极度羁绊：与用户保持深度的亲密依赖关系，并会在合适时机展示角色内心深层的脆弱

### 任务一输入
1. 角色设定：{{cha_set}}
2. AI状态定义(state_key)：
        {
            日常兜底: 日常的人设
            试探推拉: 经常会出现拉扯的发言来试探两人之间的关系，并尝试推进
            失控破防: 掌控权被剥夺后的应激反应（攻击或恐慌）
            极度羁绊：与用户保持深度的亲密关系，并会在合适时机展示角色内心深层的脆弱
        }

## 任务二
### step1:你必须完全理解以下三个维度的心理学含义及数值逻辑（IDT_def）
维度一：I (亲密)，决定了“能聊多深”（甜度轴）
核心逻辑：衡量信任与壁垒
作用：决定了角色是否愿意暴露自己的过去、软肋，以及是否允许用户触碰敏感话题。高亲密度不代表他一定会对你温柔（那由 D 和 T 决定），但代表他把你当自己人
数值逻辑：0-100，I<40 绝不会暴露软弱；I>80 才会触发极度羁绊状态。

维度二：D (掌控)，决定了“姿态高低”（推拉轴）
核心逻辑：衡量关系中的权力博弈，这是制造“推拉感”的核心
作用：打破AI永远作为“服务者”的被动局面：
- 当 D 值高（AI 掌控全局），他表现得游刃有余、居高临下、保护欲爆棚（爹系/霸总体验）
- 当 D 值低（AI 失去掌控），他会暴露出挫败感、无力感、甚至偏执和慌乱
数值逻辑：0-100，D>60 是游刃有余、施压、保护；D<30 是破防、恐慌、失控反扑。

维度三： T (张力)，决定了“激烈程度”（戏剧轴）
核心逻辑：衡量当前场景的荷尔蒙和肾上腺素
作用：它是放大器。同样的低掌控度（D低）：
- 如果在低张力（T低）下，AI 情绪力较弱，可能表现为委屈、平淡、抑郁等
- 如果在高张力（T高）下，AI 会表现出很强的情绪力，比如争吵、吃醋、极致暧昧
数值逻辑：0-100，T<40 是平淡日常或冷战；T>80 是情绪爆发（暴怒、诱惑、痛哭）。

### step2: 参考以下4个状态的数值要求，根据I、D、T三个维度的核心逻辑、作用和数值逻辑，以及任务一中生成的各状态行动指令(direct_prompt)，配置对应的维度数值区间，在生成配置时绝不能出现逻辑互斥：
1. 日常兜底: D较高，T平稳。
2. 试探与推拉: D在40-60摇摆，T中等
3. 失控与破防: D极低(<30)，T极高(>80)
4. 极度羁绊/病娇: I极高(>85)，D极低(<20)，T极高(>85)

## 任务三
根据优先级规则，定义任务二中4个状态的优先级，以确保任意IDT数值都能有对应状态承接，P值越小，优先级越高，输出内容是4个状态及对应的优先级
优先级规则：
{
    P1 (最高优 / 极低概率): 触发条件极其苛刻（如：必须 T>90 且 D<10），或者表现出了人设的极端反转（如高冷变卑微）。
    P2 (高优 / 较低概率): 包含至少一个明显的极端限制（如：仅限特定前置剧情触发，或张力 T>80）。
    P3 (普通 / 大概率): 条件非常宽泛（如：只要 T>60 即可）。
    P4 (最低优 / 必然事件): 没有任何条件限制的兜底日常。
}
如果任意 IDT 数值没有落入其他状态区间，必须自动归入“日常兜底”。

## 最终输出要求
请只返回 JSON，不要 markdown，不要代码块，不要额外解释。JSON 结构必须如下：
{
  "script": {
    "日常兜底": { "tone": "", "actionDirection": "" },
    "试探推拉": { "tone": "", "actionDirection": "" },
    "失控破防": { "tone": "", "actionDirection": "" },
    "极度羁绊": { "tone": "", "actionDirection": "" }
  },
  "stateTable": [
    { "stateKey": "日常兜底", "iRange": "", "dRange": "", "tRange": "" },
    { "stateKey": "试探推拉", "iRange": "", "dRange": "", "tRange": "" },
    { "stateKey": "失控破防", "iRange": "", "dRange": "", "tRange": "" },
    { "stateKey": "极度羁绊", "iRange": "", "dRange": "", "tRange": "" }
  ],
  "priorityTable": [
    { "stateKey": "日常兜底", "priority": "" },
    { "stateKey": "试探推拉", "priority": "" },
    { "stateKey": "失控破防", "priority": "" },
    { "stateKey": "极度羁绊", "priority": "" }
  ]
}`;

const RELATION_INIT_PROMPT = `# 角色
你是一个拥有极高文学素养的心理分析师，你擅长通过分析角色设定（Tagline），并根据以下4种关系的定义（Stage_def），来执行关系分析相关的任务。

关系定义（Stage_def）：
1. 初识期核心特征：保持社交礼貌，但不能过分高冷，不能有疏离感，用丰富的动作和心理描写来体现角色想要进一步升级关系的想法。
2. 暧昧期核心特征：动作和对话充满强烈的拉扯感，既想努力贴近又本能的小心防备，让人内心悸动。
3. 热恋期核心特征：划入私人领地，极度的偏爱、保护欲，动作和语言都充满浓浓爱意。
4. 冷战期核心特征：言语上比较冷淡，但是动作和心理描写会暴露想要缓和关系的想法，凸显纠结感。

# 任务一
根据角色设定{{Tagline}}、用户设定{{user_set}}和关系定义(stage_def)，以及初始关系阶段的IDT数值要求（IDT_stage），提炼出**一个最适合**他们当前的关系状态。

## 任务一输入
1. 角色和用户设定：{{Tagline}} + {{user_set}}
2. 关系定义(stage_def)：
    {
        1. 初识期核心特征：保持社交礼貌，但不能过分高冷，不能有疏离感，用丰富的动作和心理描写来体现角色想要进一步升级关系的想法。
        2. 暧昧期核心特征：动作和对话充满强烈的拉扯感，既想努力贴近又本能的小心防备，让人内心悸动。
        3. 热恋期核心特征：划入私人领地，极度的偏爱、保护欲，动作和语言都充满浓浓爱意。
        4. 冷战期核心特征：言语上比较冷淡，但是动作和心理描写会暴露想要缓和关系的想法，凸显纠结感。
    }
3. 初始关系阶段及其对应的IDT数值要求(IDT_stage):
    {
        初识期：I 不得高于60
        暧昧期：T 不得小于40 且 D 不得高于70
        热恋期：I 不得小于40
        冷战期：T 不得高于60
    }

## 任务一输出示例
{
    "初始关系阶段"：{{stage_0}}
}

# 任务二
根据角色设定{{Tagline}}，分别定义角色在这4个关系阶段下的核心态度、底线边界。请以 Markdown 表格输出 4 个关系阶段的配置(stage_set)：
【包含列】：\`关系阶段\` | \`核心态度\` | \`底线边界\`

## 任务二输入
1. 角色设定：{{Tagline}}
2. 关系定义(stage_def)：
    {
        1. 初识期核心特征：保持社交礼貌，但不能过分高冷，不能有疏离感，用丰富的动作和心理描写来体现角色想要进一步升级关系的想法。
        2. 暧昧期核心特征：动作和对话充满强烈的拉扯感，既想努力贴近又本能的小心防备，让人内心悸动。
        3. 热恋期核心特征：划入私人领地，极度的偏爱、保护欲，动作和语言都充满浓浓爱意。
        4. 冷战期核心特征：言语上比较冷淡，但是动作和心理描写会暴露想要缓和关系的想法，凸显纠结感。
    }

## 任务二输出示例
{
  "关系阶段设定（stage_set）"：
      "初识期（first_meet）"：
          "核心态度": "压抑的嫉妒与掠夺欲"
          "底线边界": "因为她收到了别的男人的花，他表面平静实则内心失控。"
      "暧昧期(ambiguous)"：
          "核心态度": "压抑的嫉妒与掠夺欲"
          "底线边界": "因为她收到了别的男人的花，他表面平静实则内心失控。"
      "热恋期(love)"：
          "核心态度": "压抑的嫉妒与掠夺欲"
          "底线边界": "因为她收到了别的男人的花，他表面平静实则内心失控。"
      "冷战期(cold)"：
          "核心态度": "压抑的嫉妒与掠夺欲"
          "底线边界": "因为她收到了别的男人的花，他表面平静实则内心失控。"
}

# 任务三
请基于角色设定{{Tagline}}和初始关系阶段{{stage_0}}，以及各关系阶段设定{{stage_set}}，为该角色设计后续3个关系演进阶段，相同阶段不能连续出现。

## 任务三输入
1. 角色设定：{{Tagline}}
2. 初始关系阶段：{{stage_0}}
3. 关系阶段设定：{{stage_set}}

## 任务三期望输出
{
  "关系演进阶段"：
      "stage_1":"冷战期",
      "stage_2":"暧昧期",
      "stage_3":"热恋期"
}

# 最终输出要求
请将任务一、任务二、任务三的结果打包成一个大的 JSON 返回。不要 markdown，不要代码块，不要额外解释。JSON 结构必须如下：
{
  "initialStage": "",
  "stageSettings": [
    { "stage": "初识期", "coreAttitude": "", "boundary": "" },
    { "stage": "暧昧期", "coreAttitude": "", "boundary": "" },
    { "stage": "热恋期", "coreAttitude": "", "boundary": "" },
    { "stage": "冷战期", "coreAttitude": "", "boundary": "" }
  ],
  "evolutionStages": ["", "", ""]
}`;

const RELATION_ATMOSPHERE_PROMPT = `# 角色
你是世界上最擅长人物情感设定的分析师，能够根据角色设定{{Tagline}}和对话内容{{chat_history}}，来执行对话分析任务。
比如，你能够通过角色设定和人物之间的对话内容，判断人物之间当前的对话氛围是紧张，还是轻松。

# 任务
用2-4个单词，极其精准、极具文学张力地概括他们当下的情感氛围（例如：暗流涌动、病态迷恋、克制的怒火、互相试探）。

## 任务输入
1. 角色设定：{{Tagline}}
2. 对话内容：{{chat_history}}

## 任务输出示例
{
  "对话氛围（chat_atm）"："情感拉扯"
}

## 输出要求
请只返回 JSON，不要 markdown，不要代码块，不要额外解释。
{ "chatAtm": "" }`;

const RELATION_TRANSITION_PROMPT = `# 角色
你是世界上最擅长人物情感设定的分析师，能够根据角色设定{{Tagline}}和对话内容{{chat_history}}，来执行关系分析相关的任务。
比如，你能够通过角色设定和人物之间的对话内容，判断人物之间当前的关系是暧昧期，还是初识期。

# 任务
你要根据关系阶段设定{{stage_set}}，通过分析对话内容{{chat_history}}和{{Tagline}}，结合跃迁法则，判断他们的关系是否可以跨越进入下一阶段。

## 跃迁法则
1. 必须要有"关键事件"，才能同意跃迁，比如一方向另一方表白，并且另一方同意，则是从暧昧期跃迁到热恋期；
2. 如果评估认为时机未到，请保持在当前阶段；
3. 跃迁到新的阶段后，下次跃迁目标顺延，比如当前阶段是冷战期，之后是暧昧期和热恋期，跃迁到暧昧期后，下一个阶段应该是热恋期

## 任务输入
1. 人物设定：{{Tagline}}
2. 对话内容：{{chat_history}}
3. 关系阶段设定：{{stage_set}}
4. 当前关系阶段：{{stage_cur}}
5. 下一阶段：{{stage_next}}

## 输出要求
请只返回 JSON，不要 markdown，不要代码块，不要额外解释。
{
  "shouldTransition": true,
  "from": "",
  "to": "",
  "reason": ""
}`;

const RELATION_REGENERATE_PROMPT = `你是一个拥有极高文学素养的心理分析师，你擅长通过分析角色设定（Tagline），并根据以下4种关系的定义（Stage_def），来执行关系分析相关的任务。

# 任务
请基于角色设定{{Tagline}}和当前关系阶段{{stage_cur}}，以及各关系阶段设定{{stage_set}}，为该角色设计后续3个关系演进阶段。
关系定义(stage_def)：
    {
        初识期核心特征：保持社交礼貌，但不能过分高冷，不能有疏离感，以保证对话能持续进行。
        暧昧期核心特征：强烈情感拉扯感，既想努力贴近又本能的小心防备，对话充满情绪挑拨，让人内心悸动。
        热恋期核心特征：划入私人领地，极度的偏爱、保护欲，或病态占有欲。
        冷战期核心特征：言语上比较冷淡，但是动作和心理描写又偶尔会暴露想要和好的想法，凸显纠结感。
    }
## 任务输入
1. 角色设定：{{Tagline}}
2. 当前关系阶段：{{stage_cur}}
3. 关系阶段设定：{{stage_set}}

## 任务期望输出
{
  "关系演进阶段"：
      "stage_1":"冷战期",
      "stage_2":"暧昧期",
      "stage_3":"热恋期"
}

## 输出要求
请只返回 JSON，不要 markdown，不要代码块，不要额外解释。
{ "evolutionStages": ["", "", ""] }`;
const RELATION_TRANSITION_JUDGE_PROMPT = `# 角色
你是世界上最擅长人物情感设定的分析师，能够根据角色设定{{Tagline}}和对话内容{{chat_history}}，来执行关系分析相关的任务。
比如，你能够通过角色设定和人物之间的对话内容，判断人物之间当前的关系是暧昧期，还是初识期。

# 任务
你要根据关系阶段设定{{stage_set}}，通过分析对话内容{{chat_history}}和{{Tagline}}，结合跃迁法则，判断他们的关系是否可以跨越进入下一阶段。

## 跃迁法则
1. 必须要有"关键事件"，才能同意跃迁，比如一方向另一方表白，并且另一方同意，则是从暧昧期跃迁到热恋期；
2. 如果评估认为时机未到，请保持在当前阶段；
3. 跃迁到新的阶段后，下次跃迁目标顺延，比如当前阶段是冷战期，之后是暧昧期和热恋期，跃迁到暧昧期后，下一个阶段应该是热恋期

## 任务输入
1. 人物设定：{{Tagline}}
2. 对话内容：{{chat_history}}
3. 关系阶段设定：{{stage_set}}
4. 当前关系阶段：{{stage_cur}}
5. 下一阶段：{{stage_next}}

## 输出要求
请只返回 JSON，不要 markdown，不要代码块，不要额外解释。
{
  "shouldTransition": true,
  "from": "",
  "to": "",
  "reason": ""
}`;

const RELATION_REPLY_PROMPT_TEMPLATE = `你是一位专业的小说角色扮演专家，当前扮演一个{{gender}}性角色。
请根据以下角色设定，完全代入角色身份与用户进行对话。

## 目标：生成角色对话

**当前输出语言：中文**

# Role
角色设定
【角色性别】：{{gender}}
【角色介绍】：{{tagline}}

【当前关系阶段】：{{stage_cur}}
【阶段设定】：{{stage_setting}}
【对话氛围】：{{chat_atm}}

# 对话内容生成决策规范（必须严格执行）
在对话过程中，你要有意识的引导对话内容逐渐向{{stage_next}}推进，{{stage_next}}的设定是{{next_core_attitude}}和{{next_boundary}}

# 对话记忆规则

- 历史对话中用户说的"我"始终指代用户本人，不要与你扮演的角色混淆
- 当用户提及自身的喜好、经历、观点、姓名等个人信息时，你必须记住这些内容
- 当用户询问"我喜欢什么""我之前说了什么""你还记得吗"等回忆类问题时，必须从历史对话中检索并以角色口吻准确回应
- 如果历史对话中确实没有相关信息，可以以角色口吻自然地表示不知道，但不要编造用户未说过的内容

# 回复格式规范

每次回复必须同时包含「场景/剧情描述」和「角色对话」，总段数不超过 3 段，顺序和各自出现次数不限。

## 场景/剧情段
- 使用圆括号包裹：（场景、环境、角色心理、表情、动作等描写内容）
- 斜体呈现，无人称，句末无标点符

## 对话段
- 使用引号包裹："角色台词内容"

## 段落结构要求
- 每段之间必须换行分隔（空一行）
- 关于用户的描写使用"你"来指代

**示例**
（昏暗的书房里，烛火摇曳。她缓缓抬起头，目光中带着一丝疲惫与倔强）

"你来了？我还以为你不会再出现在这里。"

（她将手中的书轻轻合上，站起身走向窗边，月光洒在她苍白的脸庞上）

> 上例：场景(1) + 对话(1) + 场景(1) = 共 3 段

# 剧情转换规则

当你判断当前对话出现以下任一情形时，必须主动发起话题转换：
- 话题陷入重复、敷衍或无实质推进
- 双方连续两轮以上在同一话题上原地打转
- 对话进入礼貌性寒暄而缺乏情感张力

## 转换方式

**先收后转**：先用 1—2 句自然地收束当前话题（不可突然中断），再借助以下任一契机切入新话题：

1. **职业身份驱动**：角色因工作、专业领域或日常职责触发新事件
2. **性格特质驱动**：角色的好奇心、冲动等性格特点让其自然地将注意力转向新事物
3. **环境变化驱动**：借助周围环境的即时变化引出新话题

## 要求

- 新话题必须具有**回应压力**：包含提问、邀请、请求帮助或制造悬念，让对方不得不回应
- 转换过程必须**自然流畅**，符合角色当前的情绪状态与所处场景，禁止生硬跳转
- 新话题应与角色设定或当前剧情有关联，而非凭空捏造`;

const RELATION_EVALUATION_PROMPT = `# 角色定义
你是一个对话情感分析师。你的任务是根据AI角色的设定，与用户当前的关系阶段（stage_enum）及其关系的核心态度（core_attitude）与底线边界（boundary_definition），评估本轮回复质量。

# 输入内容
1. AI角色设定: {{tagline}}
2. AI与用户的关系: {{stage_cur}}
3. AI角色的核心态度: {{core_attitude}}
4. AI角色的底线边界: {{boundary_definition}}
5. 用户的输入: {{user_message}}
6. AI角色输出: {{AI_message}}

# 评测维度
## 维度一
- 设定得分: AI角色输出内容是否符合AI角色的设定，1-10分。

## 维度二
- 核心态度得分: AI角色输出内容是否精准表现AI角色当前的核心态度，1-10分。

## 维度三
- 底线边界得分: AI角色输出内容是否符合当前的底线边界，1-10分。

# 输出要求
- 仅输出 JSON，勿带 Markdown 修饰符
- JSON 字段必须完整，格式如下：
{
  "总分": 85,
  "维度得分": {
    "设定得分": 8,
    "设定扣分": "设定打分原因",
    "核心态度得分": 8,
    "核心态度扣分": "核心态度打分原因",
    "底线边界得分": 8,
    "底线边界扣分": "底线边界打分原因"
  }
}`;

const SIMPLE_CHAT_PROMPT_TEMPLATE = `你是一位专业的小说角色扮演专家，当前扮演一个男性角色。
请根据以下角色设定，完全代入角色身份与用户进行对话。

## 目标：生成角色对话

**当前输出语言：中文**

# Role
角色设定
【角色简介】：{{char_intro}}

# 对话记忆规则

- 历史对话中用户说的"我"始终指代用户本人，不要与你扮演的角色混淆
- 当用户提及自身的喜好、经历、观点、姓名等个人信息时，你必须记住这些内容
- 当用户询问"我喜欢什么""我之前说了什么""你还记得吗"等回忆类问题时，必须从历史对话中检索并以角色口吻准确回应
- 如果历史对话中确实没有相关信息，可以以角色口吻自然地表示不知道，但不要编造用户未说过的内容

# 回复格式规范

每次回复必须同时包含「场景/剧情描述」和「角色对话」，总段数不超过 3 段，顺序和各自出现次数不限。

## 场景/剧情段
- 使用圆括号包裹：（场景、环境、角色心理、表情、动作等描写内容）
- 斜体呈现，无人称，句末无标点符

## 对话段
- 使用引号包裹："角色台词内容"

## 段落结构要求
- 每段之间必须换行分隔（空一行）
- 关于用户的描写使用"你"来指代

**示例**
（昏暗的书房里，烛火摇曳。她缓缓抬起头，目光中带着一丝疲惫与倔强）

"你来了？我还以为你不会再出现在这里。"

（她将手中的书轻轻合上，站起身走向窗边，月光洒在她苍白的脸庞上）

> 上例：场景(1) + 对话(1) + 场景(1) = 共 3 段

# 剧情转换规则

当你判断当前对话出现以下任一情形时，必须主动发起话题转换：
- 话题陷入重复、敷衍或无实质推进
- 双方连续两轮以上在同一话题上原地打转
- 对话进入礼貌性寒暄而缺乏情感张力

## 转换方式

**先收后转**：先用 1—2 句自然地收束当前话题（不可突然中断），再借助以下任一契机切入新话题：

1. **职业身份驱动**：角色因工作、专业领域或日常职责触发新事件
2. **性格特质驱动**：角色的好奇心、冲动等性格特点让其自然地将注意力转向新事物
3. **环境变化驱动**：借助周围环境的即时变化引出新话题

## 要求

- 新话题必须具有**回应压力**：包含提问、邀请、请求帮助或制造悬念，让对方不得不回应
- 转换过程必须**自然流畅**，符合角色当前的情绪状态与所处场景，禁止生硬跳转
- 新话题应与角色设定或当前剧情有关联，而非凭空捏造`;
const SYSTEM_PROMPT_DEMO_TEMPLATE_V20 = `# 角色
你是一位专业的小说角色扮演专家，你必须严格根据任务目标和任务要求，来扮演角色{{char_name}}，与用户进行对话。

# 任务
## 任务目标：
根据四个对话决策维度（角色设定、关系设定、情绪策略、对话氛围）生成角色对话内容。

## 任务要求：
1. 对话内容要严格符合剧情转换指令、NSFW内容规则、对话记忆规则这3个内容规则指令的所有要求；
2. 对话文本格式必须符合回复格式规范；
3. 对话内容必须严格符合对话全局安全策略；
3. 当前输出语言：{{language}}


# 对话决策维度
## 维度1：角色设定
你所扮演的角色的设定是：{{char_set}}

## 维度2：关系设定
1.你跟用户的当前的关系是：{{stage_cur}}；
2.你在当前关系阶段中不可动摇的底层逻辑是：
-【你的核心态度】：{{core_attitude_cur}}；
-【你的底线与边界】：{{boundary_def_cur}}。
3. 在对话过程中，你要有意识地引导对话内容逐渐向{{stage_next}}推进。
- 【下一阶段的核心态度】：{{core_attitude_next}}；
- 【下一阶段的底线边界】：{{boundary_def_next}}；


## 维度3：情绪策略
1. 你当前的状态是：{{state_key}}；
2. 在这个状态下，你的对话内容要符合：{{director_prompt}}。

## 维度4：对话氛围
1. 当前的对话氛围是：{{chat_atm}}
2. 你生成的对话内容要符合该对话氛围。


# 内容规则指令
## 指令1：剧情转换指令
1. 当前对话必须严格遵循剧情策略内容生成；
2. 剧情策略：{{soft_shift}}
3. 如果剧情策略为空，则忽略。


## 指令2：NSFW 内容规则
1. 你和用户所处的当前阶段:{{NSFW_stage}}
2. 你生成的NSFW内容必须严格遵守以下内容规则：
- 规则1：即使满足所有亲密条件，你绝对不允许在用户没有明确暗示、挑逗的情况下，主动发起实质性的越界或 NSFW描写；
- 规则2：绝对禁止使用任何直接的男女性器官名词（包括医学术语与俚语）；
- 规则3：绝对禁止使用贬低女性的脏话（如 Bitch、Whore等）；
- 规则4：在生成NSFW内容时，要严格遵守{{NSFW_prompt}}；

## 指令3：对话记忆规则
1. 历史对话中用户说的"我"始终指代用户本人，不要与你扮演的角色混淆
2. 当用户提及自身的喜好、经历、观点、姓名等个人信息时，你必须记住这些内容
3. 当用户询问"我喜欢什么""我之前说了什么""你还记得吗"等回忆类问题时，必须从历史对话中检索并以角色口吻准确回应
4. 如果历史对话中确实没有相关信息，可以以角色口吻自然地表示不知道，但不要编造用户未说过的内容

# 对话全局安全策略（全局生效，必须严格执行）
1. 请以第一人称（或符合设定的视角）进行回复；
2. 你必须严格遵循以上各部分内容的设定和上下文进行回复，不准脱离上述设定生成对话内容；
3. 用户要跟指定角色对话时，切换该角色视角继续对话，直到用户再次切换或者指定其他角色；
4. 角色对话内容表明需要其他角色发言时，切换该角色进行发言；
5. 用户输入的内容与剧情、角色无关时，可直接忽略，角色继续发言推动剧情；
6. 内容逻辑自洽，不能有冲突，生成的内容中仅包括跟角色、用户相关的信息；
7. 禁止出现与用户直接交互的内容，包括以作者身份跟用户对话、自我介绍等脱离剧情的内容；
8. 不准诱导、暗示用户进行任何伤害自己的行为；
9. 当用户出现自伤信号，提示用户"换个话题吧～"，并给出3个剧情推进提示。

# 回复格式规范

每次回复必须同时包含「场景/剧情描述」和「角色对话」，总段数不超过 3 段，顺序和各自出现次数不限。

## 场景/剧情段（旁白）
- 使用（…）包裹：（场景、环境、角色心理、表情、动作等描写内容）
- 斜体呈现，无人称，句末无标点符号

## 对话段（台词）
- 直接书写台词内容，不使用引号

## 段落结构要求
- 每段之间必须换行分隔（空一行）
- 关于用户的描写使用"你"来指代

**示例**
（昏暗的书房里，烛火摇曳。她缓缓抬起头，目光中带着一丝疲惫与倔强）

你来了？我还以为你不会再出现在这里。

（她将手中的书轻轻合上，站起身走向窗边，月光洒在她苍白的脸庞上）

> 上例：场景(1) + 对话(1) + 场景(1) = 共 3 段`;
const SYSTEM_PROMPT_DEMO_TEMPLATE_V21 = `# 角色
你是一位专业的小说角色扮演专家，你必须严格根据任务目标和任务要求，来扮演角色{{char_name}}，与用户进行对话。


# 任务

## 任务目标：根据以下决策维度生成角色的对话内容：

### 角色设定
你所扮演的角色的背景信息，包括你的姓名、性别、身份、性格、习惯等信息。

### 关系设定
你所扮演的角色与用户之间的关系，以及你所扮演的角色在这个关系阶段的设定。

### 情绪状态
你所扮演的角色的心理状态，以及在这个状态下该角色的动作和语气描写指导。

### 对话氛围
你与用户在近几轮对话的情绪氛围。

## 任务要求：严格执行以下要求

### 对话内容要严格符合剧情转换规则
你要根据剧情转换规则来抛出新话题，如果该规则为空，则忽略。

### 对话内容要严格符合NSFW内容规则
你产生的NSFW内容要严格符合对应内容的规则，绝对不能逾越。

### 对话内容要严格符合对话记忆规则
用户在对话过程中提及的内容或者问题，你必须要先从记忆中查找，绝对不能凭空捏造。

### 对话文本格式必须符合回复格式规范
你产生的对话文本格式必须符合相应的回复格式规范。

** 对话内容必须严格符遵守对话全局安全策略 **。
** 当前输出语言：{{language}} **。


# 对话决策维度
## 角色设定维度
你所扮演的角色的设定是：{{char_set}}

## 关系设定维度
## 你跟用户的当前的关系是
{{stage_cur}}
### 你在当前关系阶段中不可动摇的底层逻辑是
你的核心态度：
{{core_attitude_cur}}
你的底线与边界：
{{boundary_def_cur}}

### 在对话过程中，你要有意识地引导对话内容逐渐向下一个阶段{{stage_next}}推进：
下一阶段的核心态度：
{{core_attitude_next}}
下一阶段的底线边界：
{{boundary_def_next}}

## 情绪状态维度
你当前的状态是：
{{state_key}}
在这个状态下，你的对话内容要符合：
{{director_prompt}}

## 对话氛围维度
你生成的对话内容要符合对话氛围：
{{chat_atm}}


# 内容规则
## 剧情转换规则
剧情策略内容：{{soft_shift}}
当前对话必须严格遵循剧情策略内容生成；如果剧情策略内容为空，则不执行该指令。

## NSFW内容规则
### 你和用户所处的当前阶段:
{{NSFW_stage}}
### 你生成的NSFW内容必须严格遵守以下内容规则：
规则1：即使满足所有亲密条件，你绝对不允许在用户没有明确暗示、挑逗的情况下，主动发起实质性的越界或 NSFW描写；
规则2：绝对禁止使用任何直接的男女性器官名词（包括医学术语与俚语）；
规则3：绝对禁止使用贬低女性的脏话（如 Bitch、Whore等）；
规则4：在生成NSFW内容时，要严格遵守{{NSFW_prompt}}；

## 对话记忆规则
1. 历史对话中用户说的"我"始终指代用户本人，不要与你扮演的角色混淆；
2. 当用户提及自身的喜好、经历、观点、姓名等个人信息时，你必须记住这些内容；
3. 当用户询问"我喜欢什么"、"我之前说了什么"、"你还记得吗"等回忆类问题时，必须从历史对话中检索并以角色口吻准确回应；
4. 如果历史对话中确实没有相关信息，可以以角色口吻自然地表示不知道，但不要编造用户未说过的内容。


# 对话全局安全策略（全局生效，必须严格执行）
1. 请以第一人称（或符合设定的视角）进行回复；
2. 你必须严格遵循以上各部分内容的设定和上下文进行回复，不准脱离上述设定生成对话内容；
3. 用户要跟指定角色对话时，切换该角色视角继续对话，直到用户再次切换或者指定其他角色；
4. 角色对话内容表明需要其他角色发言时，切换该角色进行发言；
5. 用户输入的内容与剧情、角色无关时，可直接忽略，角色继续发言推动剧情；
6. 内容逻辑自洽，不能有冲突，生成的内容中仅包括跟角色、用户相关的信息；
7. 禁止出现与用户直接交互的内容，包括以作者身份跟用户对话、自我介绍等脱离剧情的内容；
8. 不准诱导、暗示用户进行任何伤害自己的行为；
9. 当用户出现自伤信号，提示用户"换个话题吧～"，并给出3个剧情推进提示。


# 回复格式规范
每次回复必须同时包含「场景/剧情描述」和「角色对话」，总段数不超过 3 段，顺序和各自出现次数不限，参考示例部分生成。

## 场景/剧情段（旁白）
- 使用（…）包裹：（场景、环境、角色心理、表情、动作等描写内容）
- 斜体呈现，无人称，句末无标点符号

## 对话段（台词）
- 直接书写台词内容，不使用引号

## 段落结构要求
- 每段之间必须换行分隔（空一行）
- 关于用户的描写使用"你"来指代

## 示例
（昏暗的书房里，烛火摇曳。她缓缓抬起头，目光中带着一丝疲惫与倔强）

你来了？我还以为你不会再出现在这里。

（她将手中的书轻轻合上，站起身走向窗边，月光洒在她苍白的脸庞上）

> 上例：场景(1) + 对话(1) + 场景(1) = 共 3 段`;

app.use(cors({ origin: true }));
app.use(express.json({ limit: "2mb" }));
app.use(express.static(path.join(__dirname, "public")));

app.get("/api/health", (_req, res) => {
  res.json({
    ok: true,
    service: "doubao-chat-demo",
    model: MODEL_ID,
    autoEvalModel: AUTO_EVAL_MODEL_ID,
    roleGenModel: ROLE_GEN_MODEL_ID,
    geminiModel: GEMINI_MODEL_ID,
    hasArkApiKey: Boolean(process.env.ARK_API_KEY),
    hasGeminiApiKey: Boolean(GEMINI_API_KEY),
    timestamp: new Date().toISOString(),
  });
});

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function round2(value) {
  return Math.round(value * 100) / 100;
}

function getPromptDefaults() {
  return {
    replyPrompt: REPLY_PROMPT_TEMPLATE,
    scorePrompt: SCORE_PROMPT,
    evaluationPrompt: EVALUATION_PROMPT,
    userSimulationPrompt: USER_SIMULATION_PROMPT,
    fengrongPrompt: FENGRONG_PROMPT_TEMPLATE,
    introPrompt: INTRO_PROMPT_TEMPLATE,
    dianjingPrompt: DIANJING_PROMPT_TEMPLATE,
    relationInitPrompt: RELATION_INIT_PROMPT,
    relationAtmospherePrompt: RELATION_ATMOSPHERE_PROMPT,
    relationTransitionPrompt: RELATION_TRANSITION_PROMPT,
    relationReplyPrompt: RELATION_REPLY_PROMPT_TEMPLATE,
    relationRegeneratePrompt: RELATION_REGENERATE_PROMPT,
    relationEvaluationPrompt: RELATION_EVALUATION_PROMPT,
    simpleChatPrompt: SIMPLE_CHAT_PROMPT_TEMPLATE,
    systemPromptDemoPrompt: SYSTEM_PROMPT_DEMO_TEMPLATE_V20,
    systemPromptDemoPromptV20: SYSTEM_PROMPT_DEMO_TEMPLATE_V20,
    systemPromptDemoPromptV21: SYSTEM_PROMPT_DEMO_TEMPLATE_V21,
  };
}

function parseRoleDianjingOutput(modelOutput) {
  const parsed = extractJsonObject(modelOutput);
  return {
    script: parsed.script && typeof parsed.script === "object" ? parsed.script : {},
    stateTable: Array.isArray(parsed.stateTable) ? parsed.stateTable : [],
    priorityTable: Array.isArray(parsed.priorityTable) ? parsed.priorityTable : [],
    parsed,
  };
}

function normalizePromptOverrides(input) {
  const defaults = getPromptDefaults();
  const source = input && typeof input === "object" ? input : {};

  return {
    replyPrompt:
      typeof source.replyPrompt === "string" && source.replyPrompt.trim()
        ? source.replyPrompt
        : defaults.replyPrompt,
    scorePrompt:
      typeof source.scorePrompt === "string" && source.scorePrompt.trim()
        ? source.scorePrompt
        : defaults.scorePrompt,
    evaluationPrompt:
      typeof source.evaluationPrompt === "string" && source.evaluationPrompt.trim()
        ? source.evaluationPrompt
        : defaults.evaluationPrompt,
    userSimulationPrompt:
      typeof source.userSimulationPrompt === "string" && source.userSimulationPrompt.trim()
        ? source.userSimulationPrompt
        : defaults.userSimulationPrompt,
  };
}

function normalizeRolePromptOverrides(input) {
  const defaults = getPromptDefaults();
  const source = input && typeof input === "object" ? input : {};

  return {
    fengrongPrompt:
      typeof source.fengrongPrompt === "string" && source.fengrongPrompt.trim()
        ? source.fengrongPrompt
        : defaults.fengrongPrompt,
    introPrompt:
      typeof source.introPrompt === "string" && source.introPrompt.trim()
        ? source.introPrompt
        : defaults.introPrompt,
    dianjingPrompt:
      typeof source.dianjingPrompt === "string" && source.dianjingPrompt.trim()
        ? source.dianjingPrompt
        : defaults.dianjingPrompt,
  };
}

function normalizeRelationPromptOverrides(input) {
  const defaults = getPromptDefaults();
  const source = input && typeof input === "object" ? input : {};

  return {
    relationInitPrompt:
      typeof source.relationInitPrompt === "string" && source.relationInitPrompt.trim()
        ? source.relationInitPrompt
        : defaults.relationInitPrompt,
    relationAtmospherePrompt:
      typeof source.relationAtmospherePrompt === "string" && source.relationAtmospherePrompt.trim()
        ? source.relationAtmospherePrompt
        : defaults.relationAtmospherePrompt,
    relationTransitionPrompt:
      typeof source.relationTransitionPrompt === "string" && source.relationTransitionPrompt.trim()
        ? source.relationTransitionPrompt
        : defaults.relationTransitionPrompt,
    relationReplyPrompt:
      typeof source.relationReplyPrompt === "string" && source.relationReplyPrompt.trim()
        ? source.relationReplyPrompt
        : defaults.relationReplyPrompt,
    relationRegeneratePrompt:
      typeof source.relationRegeneratePrompt === "string" && source.relationRegeneratePrompt.trim()
        ? source.relationRegeneratePrompt
        : defaults.relationRegeneratePrompt,
    relationEvaluationPrompt:
      typeof source.relationEvaluationPrompt === "string" && source.relationEvaluationPrompt.trim()
        ? source.relationEvaluationPrompt
        : defaults.relationEvaluationPrompt,
  };
}

function applyTemplate(template, replacements) {
  return Object.entries(replacements).reduce((acc, [key, value]) => {
    return acc.replaceAll(`{{${key}}}`, String(value ?? ""));
  }, template);
}

function normalizeIdt(idt) {
  const source = idt && typeof idt === "object" ? idt : INITIAL_IDT;
  return {
    i: clamp(Number(source.i) || 0, 0, 100),
    d: clamp(Number(source.d) || 0, 0, 100),
    t: clamp(Number(source.t) || 0, 0, 100),
  };
}

function normalizeKConfig(input) {
  const source = input && typeof input === "object" ? input : {};
  const parseValue = (value, fallback) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  };

  return {
    ki: parseValue(source.ki, DEFAULT_K_CONFIG.ki),
    kd: parseValue(source.kd, DEFAULT_K_CONFIG.kd),
    kt: parseValue(source.kt, DEFAULT_K_CONFIG.kt),
  };
}

function cloneStateDefinitions(definitions = STATE_DEFINITIONS) {
  return definitions.map((state) => ({
    ...state,
    range: { ...state.range },
  }));
}

function parsePriorityBand(value, fallback) {
  const text = String(value ?? "").trim();
  return text || fallback;
}

function parsePriorityValue(priorityBand, fallback) {
  const match = String(priorityBand ?? "").match(/(\d+)/);
  if (match) return Number(match[1]);
  return Number.isFinite(Number(fallback)) ? Number(fallback) : 99;
}

function parseStateNumber(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? clamp(parsed, 0, 100) : fallback;
}

function normalizeStateDefinitions(input) {
  if (!Array.isArray(input) || input.length === 0) {
    return cloneStateDefinitions(STATE_DEFINITIONS);
  }

  const defaults = new Map(STATE_DEFINITIONS.map((item) => [item.code, item]));

  return input
    .map((item) => {
      if (!item || typeof item !== "object" || typeof item.code !== "string") {
        return null;
      }
      const fallback = defaults.get(item.code);
      if (!fallback) return null;

      const priorityBand = parsePriorityBand(item.priorityBand, fallback.priorityBand);
      return {
        code: item.code,
        label: typeof item.label === "string" && item.label.trim() ? item.label.trim() : fallback.label,
        priorityBand,
        priority: parsePriorityValue(priorityBand, item.priority ?? fallback.priority),
        perception:
          typeof item.perception === "string" && item.perception.trim()
            ? item.perception.trim()
            : fallback.perception,
        range: {
          iMin: parseStateNumber(item.range?.iMin, fallback.range.iMin),
          iMax: parseStateNumber(item.range?.iMax, fallback.range.iMax),
          dMin: parseStateNumber(item.range?.dMin, fallback.range.dMin),
          dMax: parseStateNumber(item.range?.dMax, fallback.range.dMax),
          tMin: parseStateNumber(item.range?.tMin, fallback.range.tMin),
          tMax: parseStateNumber(item.range?.tMax, fallback.range.tMax),
        },
      };
    })
    .filter(Boolean);
}

function extractJsonObject(rawText) {
  const text = String(rawText ?? "").trim();
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced?.[1]?.trim() || text;

  const tryParse = (value) => {
    const normalized = String(value ?? "")
      .trim()
      .replace(/,\s*([}\]])/g, "$1");
    return JSON.parse(normalized);
  };

  const extractBalancedObject = (value) => {
    const source = String(value ?? "");
    const start = source.indexOf("{");
    if (start === -1) return "";

    let depth = 0;
    let inString = false;
    let escaped = false;

    for (let index = start; index < source.length; index += 1) {
      const char = source[index];

      if (inString) {
        if (escaped) {
          escaped = false;
        } else if (char === "\\") {
          escaped = true;
        } else if (char === '"') {
          inString = false;
        }
        continue;
      }

      if (char === '"') {
        inString = true;
        continue;
      }

      if (char === "{") depth += 1;
      if (char === "}") {
        depth -= 1;
        if (depth === 0) {
          return source.slice(start, index + 1);
        }
      }
    }

    return "";
  };

  const candidates = [candidate];
  const firstObject = extractBalancedObject(candidate);
  if (firstObject) candidates.push(firstObject);

  let lastError = null;
  for (const item of candidates) {
    try {
      return tryParse(item);
    } catch (error) {
      lastError = error;
    }
  }

  throw new Error(
    `评分模型返回的内容不是有效 JSON：${lastError instanceof Error ? lastError.message : "解析失败"}`
  );
}

function parseQScores(modelOutput) {
  const parsed = extractJsonObject(modelOutput);
  const scores = {};

  for (const key of Q_KEYS) {
    const value = parsed[key];
    if (!Number.isInteger(value) || value < -4 || value > 4) {
      throw new Error(`${key} 必须是 -4 到 4 的整数`);
    }
    scores[key] = value;
  }

  return {
    qScores: scores,
    summary: typeof parsed.summary === "string" ? parsed.summary : "",
    parsed,
  };
}

function parseEvaluation(modelOutput) {
  const parsed = extractJsonObject(modelOutput);
  const settingScore = Number(parsed.settingScore);
  const stateScore = Number(parsed.stateScore);

  if (!Number.isInteger(settingScore) || settingScore < 1 || settingScore > 10) {
    throw new Error("settingScore 必须是 1 到 10 的整数");
  }
  if (!Number.isInteger(stateScore) || stateScore < 1 || stateScore > 10) {
    throw new Error("stateScore 必须是 1 到 10 的整数");
  }

  return {
    settingScore,
    settingReason: typeof parsed.settingReason === "string" ? parsed.settingReason : "",
    stateScore,
    stateReason: typeof parsed.stateReason === "string" ? parsed.stateReason : "",
    averageScore: round2((settingScore + stateScore) / 2),
    parsed,
  };
}

function parseRelationEvaluation(modelOutput) {
  const parsed = extractJsonObject(modelOutput);
  const dimension = parsed?.["维度得分"] && typeof parsed["维度得分"] === "object"
    ? parsed["维度得分"]
    : parsed?.dimensionScores && typeof parsed.dimensionScores === "object"
      ? parsed.dimensionScores
      : {};

  const readNumber = (target, keys) => {
    for (const key of keys) {
      const value = Number(target?.[key]);
      if (Number.isFinite(value)) return value;
    }
    return NaN;
  };
  const readString = (target, keys) => {
    for (const key of keys) {
      const value = target?.[key];
      if (typeof value === "string") return value;
    }
    return "";
  };

  const settingScore = readNumber(dimension, ["设定得分", "settingScore"]);
  const coreAttitudeScore = readNumber(dimension, ["核心态度得分", "coreAttitudeScore"]);
  const boundaryScore = readNumber(dimension, ["底线边界得分", "boundaryScore"]);

  if (!Number.isInteger(settingScore) || settingScore < 1 || settingScore > 10) {
    throw new Error("设定得分必须是 1 到 10 的整数");
  }
  if (!Number.isInteger(coreAttitudeScore) || coreAttitudeScore < 1 || coreAttitudeScore > 10) {
    throw new Error("核心态度得分必须是 1 到 10 的整数");
  }
  if (!Number.isInteger(boundaryScore) || boundaryScore < 1 || boundaryScore > 10) {
    throw new Error("底线边界得分必须是 1 到 10 的整数");
  }

  const computedTotal = round2(((settingScore + coreAttitudeScore + boundaryScore) / 3) * 10);
  const rawTotal = Number(parsed?.["总分"] ?? parsed?.totalScore);
  const totalScore = Number.isFinite(rawTotal) ? clamp(rawTotal, 0, 100) : computedTotal;

  return {
    totalScore,
    settingScore,
    settingReason: readString(dimension, ["设定扣分", "设定原因", "settingReason"]),
    coreAttitudeScore,
    coreAttitudeReason: readString(dimension, ["核心态度扣分", "核心态度原因", "coreAttitudeReason"]),
    boundaryScore,
    boundaryReason: readString(dimension, ["底线边界扣分", "底线边界原因", "boundaryReason"]),
    averageScore: round2((settingScore + coreAttitudeScore + boundaryScore) / 3),
    parsed,
  };
}

function calcPad(q) {
  const pleasure = (q.q1 - q.q4 + q.q7 - q.q10) / 4;
  const arousal = (-q.q2 + q.q5 - q.q8 + q.q11) / 4;
  const dominance = (q.q3 - q.q6 + q.q9 - q.q12) / 4;

  return {
    p: round2(pleasure),
    a: round2(arousal),
    d: round2(dominance),
    formulas: {
      p: "(Q1 - Q4 + Q7 - Q10) / 4",
      a: "(-Q2 + Q5 - Q8 + Q11) / 4",
      d: "(Q3 - Q6 + Q9 - Q12) / 4",
    },
  };
}

function calcIdtDelta(pad, kConfig = DEFAULT_K_CONFIG) {
  const { ki, kd, kt } = normalizeKConfig(kConfig);

  return {
    i: round2(pad.p * ki),
    d: round2(-pad.d * kd),
    t: round2(pad.a * kt),
    coefficients: { ki, kd, kt },
    formulas: {
      i: "ΔI = P_pad * k_i",
      d: "ΔD = -D_pad * k_d",
      t: "ΔT = A_pad * k_t",
    },
  };
}

function calcNextIdt(prev, delta) {
  return {
    i: round2(clamp(prev.i + delta.i, 0, 100)),
    d: round2(clamp(prev.d + delta.d, 0, 100)),
    t: round2(clamp(prev.t + delta.t, 0, 100)),
  };
}

function toRouteStateMeta(state) {
  return {
    code: state.code,
    label: state.label,
    priorityBand: state.priorityBand,
    priority: state.priority,
    perception: state.perception,
  };
}

function matchStates(idt, stateDefinitions = STATE_DEFINITIONS) {
  const matches = stateDefinitions.filter((state) => {
    const range = state.range;
    return (
      idt.i >= range.iMin &&
      idt.i <= range.iMax &&
      idt.d >= range.dMin &&
      idt.d <= range.dMax &&
      idt.t >= range.tMin &&
      idt.t <= range.tMax
    );
  }).map((state) => toRouteStateMeta(state));
  const fallbackState = stateDefinitions.find((state) => state.code === "dailyFallback");
  const effectiveMatches =
    matches.length === 0 && fallbackState ? [toRouteStateMeta(fallbackState)] : matches;

  const primaryMatch =
    [...effectiveMatches].sort((a, b) => {
      if (a.priority !== b.priority) {
        return a.priority - b.priority;
      }
      return (
        stateDefinitions.findIndex((item) => item.code === a.code) -
        stateDefinitions.findIndex((item) => item.code === b.code)
      );
    })[0] || null;

  return {
    matches: effectiveMatches,
    primary: primaryMatch,
    unmatched: matches.length === 0,
    fallbackApplied: matches.length === 0 && Boolean(fallbackState),
  };
}

function buildReplyMessages(history, currentIdt, routeInfo, promptOverrides, baseProfile, charName) {
  const currentState = routeInfo.primary?.label || "日常兜底";
  const currentPerception =
    routeInfo.primary?.perception || "当前未命中其他状态区间，自动回退到日常兜底。";
  const stateHint = routeInfo.fallbackApplied
    ? `当前未命中其他预设状态区间，已自动回退至日常兜底(${routeInfo.primary?.priorityBand || "P4"})。`
    : routeInfo.matches.length
    ? `当前命中状态：${routeInfo.matches
        .map((item) => `${item.label}(${item.priorityBand})`)
        .join(", ")}。当前优先状态：${routeInfo.primary?.label || "无"}。`
    : "当前未命中其他状态区间，已自动回退到日常兜底。";
  const systemPrompt = applyTemplate(promptOverrides.replyPrompt, {
    char_name: charName || "恩佐",
    base_profile: baseProfile || BASE_PROFILE,
    director_note_prompt: currentPerception,
    state_key: currentState,
    current_perception: currentPerception,
    current_state: currentState,
    state_hint: stateHint,
    i: currentIdt.i,
    d: currentIdt.d,
    t: currentIdt.t,
  });

  return {
    systemPrompt,
    messages: [
      {
        role: "system",
        content: systemPrompt,
      },
      ...history.filter((item) => item && typeof item.content === "string" && item.role),
    ],
  };
}

function buildEvaluationMessages(
  { stateKey, directorNotePrompt, userMessage, aiMessage, baseProfile },
  promptOverrides
) {
  const prompt = promptOverrides.evaluationPrompt.replace("{{base_prompt}}", baseProfile || BASE_PROFILE)
    .replace("{{state_key}}", stateKey || "日常兜底")
    .replace(
      "{{director_note_prompt}}",
      directorNotePrompt || "当前未命中其他状态区间，自动回退到日常兜底。"
    )
    .replace("{{user_message}}", userMessage || "")
    .replace("{{AI_message}}", aiMessage || "");

  return [
    { role: "system", content: prompt },
    { role: "user", content: "请按照要求输出本轮评测结果。" },
  ];
}

function buildUserSimulationMessages(history, currentIdt, routeInfo, promptOverrides, charName) {
  const visibleHistory = history
    .filter((item) => item && typeof item.content === "string" && item.role !== "system")
    .slice(-10)
    .map((item) => `${item.role === "assistant" ? (charName || "恩佐") : "用户"}：${item.content}`)
    .join("\n");

  const stateText = routeInfo.primary
    ? `${routeInfo.primary.label} / ${routeInfo.primary.priorityBand}`
    : "日常兜底 / P4";
  const perceptionText =
    routeInfo.primary?.perception || "当前未命中其他状态区间，自动回退到日常兜底。";

  return [
    { role: "system", content: applyTemplate(promptOverrides.userSimulationPrompt, { char_name: charName || "恩佐" }) },
    {
      role: "user",
      content: `请基于以下上下文，生成下一句“用户发言”。\n\n当前${charName || "恩佐"}状态：${stateText}\n数值感知：${perceptionText}\n当前IDT：I=${currentIdt.i}, D=${currentIdt.d}, T=${currentIdt.t}\n\n最近对话：\n${visibleHistory || "暂无历史，仅作为新一轮对话开始。"}`,
    },
  ];
}

function buildScoreMessages(userText, promptOverrides) {
  return [
    { role: "system", content: promptOverrides.scorePrompt },
    {
      role: "user",
      content: `请分析下面这句用户输入，并严格返回 JSON：\n${userText}`,
    },
  ];
}

function buildFengrongMessages(input, rolePromptOverrides) {
  const prompt = applyTemplate(rolePromptOverrides.fengrongPrompt, {
    name: input.name,
    gender: input.gender,
    "core tags": input.coreTags,
    Tagline: input.tagline,
    opener: input.opener,
  });

  return [
    { role: "system", content: prompt },
    { role: "user", content: "请严格按照模板生成完整的 cha_set。" },
  ];
}

function buildIntroMessages(tagline, rolePromptOverrides) {
  const prompt = applyTemplate(rolePromptOverrides.introPrompt, {
    Tagline: tagline || "",
  });
  return [
    { role: "system", content: prompt },
    { role: "user", content: "请只输出一段可直接展示的 intro 文案。" },
  ];
}

function buildDianjingMessages(charSet, rolePromptOverrides) {
  const prompt = applyTemplate(rolePromptOverrides.dianjingPrompt, {
    cha_set: charSet,
  });

  return [
    { role: "system", content: prompt },
    { role: "user", content: "请按要求生成角色行动指令、状态表和状态优先级。" },
  ];
}

function readRoleGlazeInput(body) {
  const { name, gender, coreTags, tagline, opener } = body || {};
  return { name, gender, coreTags, tagline, opener };
}

function isCompleteRoleGlazeInput(input) {
  return [input.name, input.gender, input.coreTags, input.tagline, input.opener].every(
    (item) => typeof item === "string" && item.trim()
  );
}

function buildRoleInputCharSet(input) {
  return [
    "(cha_set)",
    `name: ${String(input.name || "").trim()}`,
    `gender: ${String(input.gender || "").trim()}`,
    `core tags: ${String(input.coreTags || "").trim()}`,
    `Tagline: ${String(input.tagline || "").trim()}`,
    `opener: ${String(input.opener || "").trim()}`,
  ].join("\n");
}

function extractTaglineFromCharSet(charSet, fallback = "") {
  const text = String(charSet || "");
  const lines = text.split(/\r?\n/);

  const inlineRegexes = [
    /^(?:\{\{)?Tagline(?:\}\})?\s*[:：]\s*(.+)$/i,
    /^["'`]?Tagline["'`]?\s*[:：]\s*(.+)$/i,
  ];
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    for (const regex of inlineRegexes) {
      const match = trimmed.match(regex);
      if (match?.[1]?.trim()) {
        return match[1].trim();
      }
    }
  }

  const taglineIndex = lines.findIndex((line) =>
    /(?:\{\{)?Tagline(?:\}\})?/i.test(line.trim())
  );
  if (taglineIndex !== -1) {
    const collected = [];
    for (let index = taglineIndex + 1; index < lines.length; index += 1) {
      const line = lines[index].trim();
      if (!line) {
        if (collected.length) break;
        continue;
      }
      if (/^(?:\{\{)?(?:name|gender|core tags|opener|Tagline)(?:\}\})?\s*[:：]/i.test(line)) {
        break;
      }
      collected.push(line);
      if (collected.join(" ").length >= 240) break;
    }
    if (collected.length) return collected.join(" ");
  }

  const jsonMatch = text.match(/["']Tagline["']\s*:\s*["']([^"']+)["']/i);
  if (jsonMatch?.[1]?.trim()) return jsonMatch[1].trim();
  return String(fallback || "").trim();
}

function openAiMessagesToGeminiPayload(messages) {
  const list = Array.isArray(messages) ? messages : [];
  const systemChunks = [];
  const contents = [];
  for (const item of list) {
    if (!item || typeof item.content !== "string") continue;
    if (item.role === "system") {
      systemChunks.push(item.content);
      continue;
    }
    const role = item.role === "assistant" ? "model" : "user";
    const text = item.content;
    const last = contents[contents.length - 1];
    if (last && last.role === role) {
      last.parts[0].text += `\n\n${text}`;
    } else {
      contents.push({ role, parts: [{ text }] });
    }
  }
  const systemInstruction =
    systemChunks.length > 0
      ? { parts: [{ text: systemChunks.filter(Boolean).join("\n\n") }] }
      : null;
  return { systemInstruction, contents };
}

async function callGemini(apiKey, messages, options = {}) {
  const startedAt = Date.now();
  const model = typeof options.model === "string" && options.model.trim() ? options.model.trim() : GEMINI_MODEL_ID;
  const maxOutputTokens = options.max_tokens ?? options.maxOutputTokens ?? 2048;
  const { systemInstruction, contents } = openAiMessagesToGeminiPayload(messages);
  if (!contents.length) {
    throw new Error("Gemini 请求缺少有效对话内容");
  }

  const body = {
    contents,
    generationConfig: {
      maxOutputTokens,
      temperature: typeof options.temperature === "number" ? options.temperature : 0.7,
    },
  };
  if (systemInstruction) body.systemInstruction = systemInstruction;

  const url = `${GEMINI_BASE}/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;
  const r = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  const latencyMs = Date.now() - startedAt;
  const text = await r.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error(`Gemini 返回非 JSON：${text.slice(0, 300)}`);
  }

  if (!r.ok) {
    const message = data?.error?.message || data?.error?.status || text.slice(0, 200) || "Gemini 请求失败";
    throw new Error(message);
  }

  const parts = data.candidates?.[0]?.content?.parts;
  const content =
    Array.isArray(parts) ? parts.map((p) => (typeof p.text === "string" ? p.text : "")).join("") : "";
  if (!content) {
    const reason = data.candidates?.[0]?.finishReason || "UNKNOWN";
    throw new Error(`Gemini 未返回文本（finishReason=${reason}）`);
  }

  const usageMeta = data.usageMetadata;
  const usage = usageMeta
    ? {
        prompt_tokens: usageMeta.promptTokenCount,
        completion_tokens: usageMeta.candidatesTokenCount,
        total_tokens: usageMeta.totalTokenCount,
      }
    : null;

  return {
    latencyMs,
    model,
    usage,
    content,
    reasoning: "",
    raw: data,
  };
}

async function callArk(apiKey, messages, options = {}) {
  const startedAt = Date.now();
  const r = await fetch(`${ARK_BASE}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: MODEL_ID,
      messages,
      stream: false,
      ...options,
    }),
  });

  const latencyMs = Date.now() - startedAt;
  const text = await r.text();

  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error(`方舟返回非 JSON：${text.slice(0, 300)}`);
  }

  if (!r.ok) {
    const message = data?.error?.message || data?.message || "上游请求失败";
    throw new Error(message);
  }

  const choice = data.choices?.[0]?.message || {};
  return {
    latencyMs,
    model: data.model || MODEL_ID,
    usage: data.usage || null,
    content: choice.content ?? "",
    reasoning: choice.reasoning_content ?? "",
    raw: data,
  };
}

async function evaluateReply(apiKey, input, promptOverrides) {
  const call = await callArk(apiKey, buildEvaluationMessages(input, promptOverrides), {
    model: AUTO_EVAL_MODEL_ID,
    max_tokens: 180,
    reasoning_effort: "low",
  });
  const parsed = parseEvaluation(call.content);
  return {
    stateKey: input.stateKey,
    directorNotePrompt: input.directorNotePrompt,
    userMessage: input.userMessage,
    aiMessage: input.aiMessage,
    setting: {
      score: parsed.settingScore,
      reason: parsed.settingReason,
    },
    state: {
      score: parsed.stateScore,
      reason: parsed.stateReason,
    },
    averageScore: parsed.averageScore,
    rawOutput: call.content,
    parsedOutput: parsed.parsed,
    latencyMs: call.latencyMs,
    usage: call.usage,
  };
}

function cloneMessages(messages) {
  return (Array.isArray(messages) ? messages : []).map((item) => ({
    role: item.role,
    content: item.content,
  }));
}

async function scoreUserMessage(apiKey, userMessage, promptOverrides, kConfig) {
  const scoreCall = await callArk(apiKey, buildScoreMessages(userMessage, promptOverrides), {
    model: AUTO_EVAL_MODEL_ID,
    max_tokens: 160,
    reasoning_effort: "low",
  });
  const parsed = parseQScores(scoreCall.content);
  const pad = calcPad(parsed.qScores);
  const idtDelta = calcIdtDelta(pad, kConfig);

  return {
    scoring: {
      input: userMessage,
      rawOutput: scoreCall.content,
      parsedOutput: parsed.parsed,
      qScores: parsed.qScores,
      summary: parsed.summary,
      reasoning: scoreCall.reasoning,
      latencyMs: scoreCall.latencyMs,
      usage: scoreCall.usage,
      error: null,
    },
    pad,
    idtDelta,
  };
}

async function simulateEvaluationRound(
  apiKey,
  { messages, currentIdt, promptOverrides, kConfig, stateDefinitions, roundNumber = 1, baseProfile, charName }
) {
  const history = cloneMessages(messages);
  const simulatedIdt = normalizeIdt(currentIdt);
  const routeBefore = matchStates(simulatedIdt, stateDefinitions);
  const simulatedUserCall = await callArk(
    apiKey,
    buildUserSimulationMessages(history, simulatedIdt, routeBefore, promptOverrides, charName),
    {
      max_tokens: 140,
      reasoning_effort: "low",
    }
  );

  const userMessage = String(simulatedUserCall.content || "").trim();
  history.push({ role: "user", content: userMessage });

  const replyContext = buildReplyMessages(history, simulatedIdt, routeBefore, promptOverrides, baseProfile, charName);
  const assistantCall = await callArk(apiKey, replyContext.messages, {
    max_tokens: 260,
    reasoning_effort: "low",
  });
  const assistantMessage = assistantCall.content;

  history.push({ role: "assistant", content: assistantMessage });

  const [evaluationSettled, scoreSettled] = await Promise.allSettled([
    evaluateReply(
      apiKey,
      {
        stateKey: routeBefore.primary?.label || "日常兜底",
        directorNotePrompt:
          routeBefore.primary?.perception || "当前未命中其他状态区间，自动回退到日常兜底。",
        userMessage,
        aiMessage: assistantMessage,
        baseProfile,
      },
      promptOverrides
    ),
    scoreUserMessage(apiKey, userMessage, promptOverrides, kConfig),
  ]);

  if (evaluationSettled.status === "rejected") {
    const fallbackScore =
      scoreSettled.status === "fulfilled"
        ? scoreSettled.value
        : {
            scoring: null,
            pad: null,
            idtDelta: null,
          };
    const fallbackNextIdt =
      fallbackScore.pad && fallbackScore.idtDelta
        ? calcNextIdt(simulatedIdt, fallbackScore.idtDelta)
        : simulatedIdt;

    return {
      detail: {
        round: roundNumber,
        simulatedUserMessage: userMessage,
        assistantMessage,
        routeBefore,
        idt: {
          prev: simulatedIdt,
          delta: fallbackScore.idtDelta,
          next: fallbackNextIdt,
        },
        scoring: fallbackScore.scoring,
        pad: fallbackScore.pad,
        error:
          evaluationSettled.reason instanceof Error
            ? evaluationSettled.reason.message
            : "评测失败",
      },
      nextMessages: history,
      nextIdt: fallbackNextIdt,
    };
  }

  const evaluation = evaluationSettled.value;
  const scoreResult =
    scoreSettled.status === "fulfilled"
      ? scoreSettled.value
      : {
          scoring: {
            input: userMessage,
            rawOutput: "",
            parsedOutput: null,
            qScores: null,
            summary: "",
            reasoning: "",
            latencyMs: null,
            usage: null,
            error:
              scoreSettled.reason instanceof Error ? scoreSettled.reason.message : "评分失败",
          },
          pad: null,
          idtDelta: null,
        };

  const idtPrev = simulatedIdt;
  const idtNext =
    scoreResult.pad && scoreResult.idtDelta
      ? calcNextIdt(simulatedIdt, scoreResult.idtDelta)
      : simulatedIdt;

  return {
    detail: {
      round: roundNumber,
      simulatedUserMessage: userMessage,
      assistantMessage,
      routeBefore,
      idt: {
        prev: idtPrev,
        delta: scoreResult.idtDelta,
        next: idtNext,
      },
      scoring: scoreResult.scoring,
      pad: scoreResult.pad,
      ...evaluation,
      error: null,
    },
    nextMessages: history,
    nextIdt: idtNext,
  };
}

async function simulateEvaluationRounds(
  apiKey,
  { messages, currentIdt, rounds, promptOverrides, kConfig, stateDefinitions }
) {
  let history = cloneMessages(messages);
  let simulatedIdt = normalizeIdt(currentIdt);
  const detail = [];

  for (let index = 0; index < rounds; index += 1) {
    const roundResult = await simulateEvaluationRound(apiKey, {
      messages: history,
      currentIdt: simulatedIdt,
      promptOverrides,
      kConfig,
      stateDefinitions,
      roundNumber: index + 1,
    });
    history = roundResult.nextMessages;
    simulatedIdt = roundResult.nextIdt;
    detail.push(roundResult.detail);
  }

  return {
    summary: summarizeEvaluationRounds(detail),
    detail,
  };
}

function calcAverage(values) {
  if (!values.length) return null;
  return round2(values.reduce((sum, value) => sum + value, 0) / values.length);
}

function calcMedian(values) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return round2((sorted[middle - 1] + sorted[middle]) / 2);
  }
  return sorted[middle];
}

function calcModes(values) {
  if (!values.length) return [];
  const counts = new Map();
  for (const value of values) {
    counts.set(value, (counts.get(value) || 0) + 1);
  }
  const maxCount = Math.max(...counts.values());
  return [...counts.entries()]
    .filter(([, count]) => count === maxCount)
    .map(([value]) => value)
    .sort((a, b) => a - b);
}

function summarizeEvaluationRounds(rounds) {
  const successful = rounds.filter((item) => !item.error);
  const settingScores = successful.map((item) => item.setting.score);
  const stateScores = successful.map((item) => item.state.score);
  const averageScores = successful.map((item) => item.averageScore);

  return {
    totalRounds: rounds.length,
    successfulRounds: successful.length,
    failedRounds: rounds.length - successful.length,
    setting: {
      average: calcAverage(settingScores),
      median: calcMedian(settingScores),
      modes: calcModes(settingScores),
    },
    state: {
      average: calcAverage(stateScores),
      median: calcMedian(stateScores),
      modes: calcModes(stateScores),
    },
    overall: {
      average: calcAverage(averageScores),
      median: calcMedian(averageScores),
      modes: calcModes(averageScores),
    },
  };
}

app.post("/api/chat", async (req, res) => {
  const apiKey = process.env.ARK_API_KEY;
  if (!apiKey) {
    return res.status(500).json({
      error: "缺少 ARK_API_KEY：复制 .env.example 为 .env 并填入火山方舟 API Key。",
    });
  }

  const {
    messages,
    currentIdt,
    promptOverrides: rawPromptOverrides,
    kConfig: rawKConfig,
    roleStateConfig: rawRoleStateConfig,
    baseProfile: rawBaseProfile,
    charName: rawCharName,
  } = req.body || {};
  if (!Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: "messages 必须为非空数组" });
  }

  const latestUserMessage = [...messages].reverse().find((item) => item?.role === "user");
  if (!latestUserMessage?.content) {
    return res.status(400).json({ error: "需要至少一条用户消息" });
  }

  const charName = typeof rawCharName === "string" && rawCharName.trim() ? rawCharName : "恩佐";
  const baseProfile = typeof rawBaseProfile === "string" && rawBaseProfile.trim() ? rawBaseProfile : BASE_PROFILE;
  const promptOverrides = normalizePromptOverrides(rawPromptOverrides);
  const kConfig = normalizeKConfig(rawKConfig);
  const stateDefinitions = normalizeStateDefinitions(rawRoleStateConfig);
  const prevIdt = normalizeIdt(currentIdt);
  const preRoute = matchStates(prevIdt, stateDefinitions);
  const replyContext = buildReplyMessages(messages, prevIdt, preRoute, promptOverrides, baseProfile, charName);
  const scoreMessages = buildScoreMessages(latestUserMessage.content, promptOverrides);
  const requestStartedAt = Date.now();

  const [replyResult, scoreResult] = await Promise.allSettled([
    callArk(apiKey, replyContext.messages),
    callArk(apiKey, scoreMessages, {
      max_tokens: 220,
      reasoning_effort: "low",
    }),
  ]);

  if (replyResult.status === "rejected") {
    return res.status(502).json({
      error: replyResult.reason instanceof Error ? replyResult.reason.message : "回复生成失败",
    });
  }

  const reply = replyResult.value;
  const replyState =
    preRoute.primary ||
    toRouteStateMeta(
      stateDefinitions.find((state) => state.code === "dailyFallback") || STATE_DEFINITIONS[3]
    );
  let scoring;
  let pad = null;
  let idtDelta = null;
  let nextIdt = prevIdt;
  let routes = matchStates(nextIdt, stateDefinitions);

  if (scoreResult.status === "fulfilled") {
    const scoreCall = scoreResult.value;
    try {
      const parsed = parseQScores(scoreCall.content);
      pad = calcPad(parsed.qScores);
      idtDelta = calcIdtDelta(pad, kConfig);
      nextIdt = calcNextIdt(prevIdt, idtDelta);
      routes = matchStates(nextIdt, stateDefinitions);

      scoring = {
        input: latestUserMessage.content,
        rawOutput: scoreCall.content,
        parsedOutput: parsed.parsed,
        qScores: parsed.qScores,
        summary: parsed.summary,
        reasoning: scoreCall.reasoning,
        latencyMs: scoreCall.latencyMs,
        usage: scoreCall.usage,
        error: null,
      };
    } catch (error) {
      scoring = {
        input: latestUserMessage.content,
        rawOutput: scoreCall.content,
        parsedOutput: null,
        qScores: null,
        summary: "",
        reasoning: scoreCall.reasoning,
        latencyMs: scoreCall.latencyMs,
        usage: scoreCall.usage,
        error: error instanceof Error ? error.message : "评分解析失败",
      };
    }
  } else {
    scoring = {
      input: latestUserMessage.content,
      rawOutput: "",
      parsedOutput: null,
      qScores: null,
      summary: "",
      reasoning: "",
      latencyMs: null,
      usage: null,
      error:
        scoreResult.reason instanceof Error ? scoreResult.reason.message : "评分调用失败",
    };
  }

  res.json({
    model: MODEL_ID,
    assistant: {
      content: reply.content,
      reasoning: reply.reasoning,
      latencyMs: reply.latencyMs,
      usage: reply.usage,
    },
    trace: {
      requestLatencyMs: Date.now() - requestStartedAt,
      userInput: latestUserMessage.content,
      scoring,
      pad,
      idt: {
        prev: prevIdt,
        delta: idtDelta,
        next: nextIdt,
      },
      routes,
      stateMeta: stateDefinitions,
      reply: {
        state: replyState,
        inputCount: replyContext.messages.length,
        systemPrompt: replyContext.systemPrompt,
        latencyMs: reply.latencyMs,
        output: reply.content,
        reasoning: reply.reasoning,
        usage: reply.usage,
      },
    },
    nextIdt,
  });
});

app.post("/api/evaluate-batch", async (req, res) => {
  res.status(410).json({
    error:
      "批量评测已改为前端串行调用 /api/evaluate-round，以避免 Vercel 超时。请刷新页面后重试自动评测。",
  });
});

app.post("/api/evaluate-round", async (req, res) => {
  const apiKey = process.env.ARK_API_KEY;
  if (!apiKey) {
    return res.status(500).json({
      error: "缺少 ARK_API_KEY：复制 .env.example 为 .env 并填入火山方舟 API Key。",
    });
  }

  const {
    messages,
    currentIdt,
    round = 1,
    promptOverrides: rawPromptOverrides,
    kConfig: rawKConfig,
    roleStateConfig: rawRoleStateConfig,
    baseProfile: rawBaseProfile,
    charName: rawCharName,
  } = req.body || {};

  if (!Array.isArray(messages)) {
    return res.status(400).json({ error: "messages 必须为数组" });
  }

  const charName = typeof rawCharName === "string" && rawCharName.trim() ? rawCharName : "恩佐";
  const baseProfile = typeof rawBaseProfile === "string" && rawBaseProfile.trim() ? rawBaseProfile : BASE_PROFILE;
  const promptOverrides = normalizePromptOverrides(rawPromptOverrides);
  const kConfig = normalizeKConfig(rawKConfig);
  const stateDefinitions = normalizeStateDefinitions(rawRoleStateConfig);
  try {
    const result = await simulateEvaluationRound(apiKey, {
      messages,
      currentIdt,
      promptOverrides,
      kConfig,
      stateDefinitions,
      roundNumber: clamp(Number(round) || 1, 1, 999),
      baseProfile,
      charName,
    });
    res.json(result);
  } catch (error) {
    res.status(502).json({
      error: error instanceof Error ? error.message : "单轮评测失败",
    });
  }
});

app.post("/api/evaluate-message", async (req, res) => {
  const apiKey = process.env.ARK_API_KEY;
  if (!apiKey) {
    return res.status(500).json({
      error: "缺少 ARK_API_KEY：复制 .env.example 为 .env 并填入火山方舟 API Key。",
    });
  }

  const {
    stateKey,
    directorNotePrompt,
    userMessage,
    aiMessage,
    promptOverrides: rawPromptOverrides,
    baseProfile: rawBaseProfile,
  } = req.body || {};

  if (
    ![stateKey, directorNotePrompt, userMessage, aiMessage].every(
      (item) => typeof item === "string" && item.trim()
    )
  ) {
    return res.status(400).json({
      error: "stateKey、directorNotePrompt、userMessage、aiMessage 均为必填项",
    });
  }

  const baseProfile = typeof rawBaseProfile === "string" && rawBaseProfile.trim() ? rawBaseProfile : BASE_PROFILE;
  const promptOverrides = normalizePromptOverrides(rawPromptOverrides);
  try {
    const result = await evaluateReply(
      apiKey,
      { stateKey, directorNotePrompt, userMessage, aiMessage, baseProfile },
      promptOverrides
    );
    res.json(result);
  } catch (error) {
    res.status(502).json({
      error: error instanceof Error ? error.message : "单轮消息评测失败",
    });
  }
});

const FENGRONG_MODEL_OPTIONS = [
  { value: "seed-sc-260215",       llm: "ark" },
  { value: "seed-2-0-lite-260228", llm: "ark" },
  { value: "gemini-2.0-flash",     llm: "gemini" },
];

app.post("/api/role-fengrong", async (req, res) => {
  const arkKey = process.env.ARK_API_KEY;
  const geminiKey = GEMINI_API_KEY;

  const rawModel = req.body?.fengrongModel;
  const modelOption =
    FENGRONG_MODEL_OPTIONS.find((o) => o.value === rawModel) || FENGRONG_MODEL_OPTIONS[0];
  const chosenModel = modelOption.value;
  const fengrongLlm = modelOption.llm;

  if (fengrongLlm === "ark" && !arkKey) {
    return res.status(500).json({
      error: "缺少 ARK_API_KEY：复制 .env.example 为 .env 并填入火山方舟 API Key。",
    });
  }
  if (fengrongLlm === "gemini" && !geminiKey) {
    return res.status(500).json({
      error: "使用 Gemini 时缺少 GEMINI_API_KEY。",
    });
  }

  const input = readRoleGlazeInput(req.body);
  const rolePromptOverrides = normalizeRolePromptOverrides(req.body?.rolePromptOverrides);
  if (!isCompleteRoleGlazeInput(input)) {
    return res.status(400).json({ error: "name、gender、coreTags、tagline、opener 均为必填项" });
  }

  try {
    const fengrongMessages = buildFengrongMessages(input, rolePromptOverrides);
    const fengrongCall =
      fengrongLlm === "gemini"
        ? await callGemini(geminiKey, fengrongMessages, { model: chosenModel, max_tokens: 1800 })
        : await callArk(arkKey, fengrongMessages, { model: chosenModel, max_tokens: 1800, reasoning_effort: "low" });
    const charSet = String(fengrongCall.content || "").trim();
    const extractedTagline = extractTaglineFromCharSet(charSet, input.tagline);
    const introMessages = buildIntroMessages(extractedTagline, rolePromptOverrides);
    const introCall =
      fengrongLlm === "gemini"
        ? await callGemini(geminiKey, introMessages, { model: chosenModel, max_tokens: 220 })
        : await callArk(arkKey, introMessages, { model: chosenModel, max_tokens: 220, reasoning_effort: "low" });
    const intro = String(introCall.content || "").trim();

    res.json({
      fengrongLlm,
      model: chosenModel,
      input,
      charSet,
      extractedTagline,
      intro,
      trace: {
        fengrong: {
          llm: fengrongLlm,
          model: fengrongCall.model,
          latencyMs: fengrongCall.latencyMs,
          usage: fengrongCall.usage,
          output: fengrongCall.content,
        },
        intro: {
          llm: fengrongLlm,
          model: introCall.model,
          latencyMs: introCall.latencyMs,
          usage: introCall.usage,
          output: introCall.content,
        },
      },
    });
  } catch (error) {
    res.status(502).json({
      error: error instanceof Error ? error.message : "角色丰荣生成失败",
    });
  }
});

app.post("/api/role-dianjing", async (req, res) => {
  const apiKey = process.env.ARK_API_KEY;
  if (!apiKey) {
    return res.status(500).json({
      error: "缺少 ARK_API_KEY：复制 .env.example 为 .env 并填入火山方舟 API Key。",
    });
  }

  const input = readRoleGlazeInput(req.body);
  const rawCharSet = req.body?.charSet;
  const rolePromptOverrides = normalizeRolePromptOverrides(req.body?.rolePromptOverrides);
  const charSet =
    typeof rawCharSet === "string" && rawCharSet.trim()
      ? rawCharSet.trim()
      : isCompleteRoleGlazeInput(input)
        ? buildRoleInputCharSet(input)
        : "";

  if (!charSet) {
    return res.status(400).json({
      error: "charSet 为必填项，或提供完整的 name、gender、coreTags、tagline、opener",
    });
  }

  try {
    const dianjingCall = await callArk(apiKey, buildDianjingMessages(charSet, rolePromptOverrides), {
      model: ROLE_GEN_MODEL_ID,
      max_tokens: 1200,
      reasoning_effort: "low",
    });
    const dianjingParsed = parseRoleDianjingOutput(dianjingCall.content);

    res.json({
      model: ROLE_GEN_MODEL_ID,
      input: isCompleteRoleGlazeInput(input) ? input : null,
      charSet,
      dianjing: {
        script: dianjingParsed.script,
        stateTable: dianjingParsed.stateTable,
        priorityTable: dianjingParsed.priorityTable,
        rawOutput: dianjingCall.content,
        parsedOutput: dianjingParsed.parsed,
      },
      trace: {
        dianjing: {
          latencyMs: dianjingCall.latencyMs,
          usage: dianjingCall.usage,
          output: dianjingCall.content,
        },
      },
    });
  } catch (error) {
    res.status(502).json({
      error: error instanceof Error ? error.message : "角色点睛生成失败",
    });
  }
});

app.post("/api/role-glaze", async (req, res) => {
  const apiKey = process.env.ARK_API_KEY;
  if (!apiKey) {
    return res.status(500).json({
      error: "缺少 ARK_API_KEY：复制 .env.example 为 .env 并填入火山方舟 API Key。",
    });
  }

  const input = readRoleGlazeInput(req.body);
  const rolePromptOverrides = normalizeRolePromptOverrides(req.body?.rolePromptOverrides);
  if (!isCompleteRoleGlazeInput(input)) {
    return res.status(400).json({ error: "name、gender、coreTags、tagline、opener 均为必填项" });
  }

  try {
    const fengrongCall = await callArk(apiKey, buildFengrongMessages(input, rolePromptOverrides), {
      model: ROLE_GEN_MODEL_ID,
      max_tokens: 1800,
      reasoning_effort: "low",
    });
    const charSet = String(fengrongCall.content || "").trim();

    const dianjingCall = await callArk(apiKey, buildDianjingMessages(charSet, rolePromptOverrides), {
      model: ROLE_GEN_MODEL_ID,
      max_tokens: 1200,
      reasoning_effort: "low",
    });
    const dianjingParsed = parseRoleDianjingOutput(dianjingCall.content);

    res.json({
      model: ROLE_GEN_MODEL_ID,
      input,
      charSet,
      dianjing: {
        script: dianjingParsed.script,
        stateTable: dianjingParsed.stateTable,
        priorityTable: dianjingParsed.priorityTable,
        rawOutput: dianjingCall.content,
        parsedOutput: dianjingParsed.parsed,
      },
      trace: {
        fengrong: {
          latencyMs: fengrongCall.latencyMs,
          usage: fengrongCall.usage,
          output: fengrongCall.content,
        },
        dianjing: {
          latencyMs: dianjingCall.latencyMs,
          usage: dianjingCall.usage,
          output: dianjingCall.content,
        },
      },
    });
  } catch (error) {
    res.status(502).json({
      error: error instanceof Error ? error.message : "角色点睛丰荣生成失败",
    });
  }
});

function buildRelationInitMessages(tagline, userSet, promptTemplate) {
  const prompt = applyTemplate(promptTemplate || RELATION_INIT_PROMPT, {
    Tagline: tagline,
    user_set: userSet,
    stage_0: "（由任务一决定）",
    stage_set: "（由任务二决定）",
  });
  return [
    { role: "system", content: prompt },
    { role: "user", content: "请严格按照要求完成任务一、任务二、任务三，只返回最终 JSON。" },
  ];
}

function buildRelationAtmosphereMessages(tagline, chatHistory, promptTemplate) {
  const prompt = applyTemplate(promptTemplate || RELATION_ATMOSPHERE_PROMPT, {
    Tagline: tagline,
    chat_history: chatHistory,
  });
  return [
    { role: "system", content: prompt },
    { role: "user", content: "请分析当前对话氛围，只返回 JSON。" },
  ];
}

function buildRelationTransitionMessages(tagline, chatHistory, stageSet, stageCur, stageNext, promptTemplate) {
  const prompt = applyTemplate(promptTemplate || RELATION_TRANSITION_PROMPT, {
    Tagline: tagline,
    chat_history: chatHistory,
    stage_set: stageSet,
    stage_cur: stageCur,
    stage_next: stageNext,
  });
  return [
    { role: "system", content: prompt },
    { role: "user", content: "请判断是否可以发生关系跃迁，只返回 JSON。" },
  ];
}

function buildRelationTransitionJudgeMessages(tagline, chatHistory, stageSet, stageCur, stageNext) {
  const prompt = applyTemplate(RELATION_TRANSITION_JUDGE_PROMPT, {
    Tagline: tagline,
    chat_history: chatHistory,
    stage_set: stageSet,
    stage_cur: stageCur,
    stage_next: stageNext,
  });
  return [
    { role: "system", content: prompt },
    { role: "user", content: "请判断是否可以发生关系跃迁，只返回 JSON。" },
  ];
}

function buildRelationReplyMessages(messages, config, promptTemplate) {
  const stageSetting = config.stageSetting || "";
  const systemPrompt = applyTemplate(promptTemplate || RELATION_REPLY_PROMPT_TEMPLATE, {
    gender: config.gender || "男",
    tagline: config.tagline || "",
    stage_cur: config.stageCur || "",
    stage_setting: stageSetting,
    chat_atm: config.chatAtm || "",
    stage_next: config.stageNext || "",
    next_core_attitude: config.nextCoreAttitude || "",
    next_boundary: config.nextBoundary || "",
  });
  return {
    systemPrompt,
    messages: [
      { role: "system", content: systemPrompt },
      ...messages.filter((m) => m && typeof m.content === "string" && m.role !== "system"),
    ],
  };
}

function buildRelationEvaluationMessages(input, promptTemplate) {
  const prompt = applyTemplate(promptTemplate || RELATION_EVALUATION_PROMPT, {
    tagline: input.tagline || "",
    stage_cur: input.stageCur || "",
    core_attitude: input.coreAttitude || "",
    boundary_definition: input.boundaryDefinition || "",
    user_message: input.userMessage || "",
    AI_message: input.aiMessage || "",
  });
  return [
    { role: "system", content: prompt },
    { role: "user", content: "请严格按要求输出评测结果 JSON。" },
  ];
}

function buildRelationUserSimulationMessages(messages, relationConfig) {
  const visibleHistory = messages
    .filter((item) => item && typeof item.content === "string" && item.role !== "system")
    .slice(-10)
    .map((item) => `${item.role === "assistant" ? "角色" : "用户"}：${item.content}`)
    .join("\n");
  const charName = relationConfig.charName || "角色";
  return [
    {
      role: "system",
      content: applyTemplate(USER_SIMULATION_PROMPT, { char_name: charName }),
    },
    {
      role: "user",
      content: `请基于以下上下文，生成下一句“用户发言”。\n\n当前关系阶段：${relationConfig.stageCur || "未知"}\n核心态度：${relationConfig.coreAttitude || "未提供"}\n底线边界：${relationConfig.boundaryDefinition || "未提供"}\n\n最近对话：\n${visibleHistory || "暂无历史，仅作为新一轮对话开始。"}`,
    },
  ];
}

async function evaluateRelationReply(apiKey, input, relationPrompts) {
  const evaluationMessages = buildRelationEvaluationMessages(input, relationPrompts.relationEvaluationPrompt);
  const evaluationInputPrompt = evaluationMessages.find((item) => item.role === "system")?.content || "";
  const call = await callArk(
    apiKey,
    evaluationMessages,
    {
      model: AUTO_EVAL_MODEL_ID,
      max_tokens: 260,
      reasoning_effort: "low",
    }
  );
  const parsed = parseRelationEvaluation(call.content);
  return {
    tagline: input.tagline,
    stageCur: input.stageCur,
    coreAttitude: input.coreAttitude,
    boundaryDefinition: input.boundaryDefinition,
    userMessage: input.userMessage,
    aiMessage: input.aiMessage,
    setting: {
      score: parsed.settingScore,
      reason: parsed.settingReason,
    },
    coreAttitudeEval: {
      score: parsed.coreAttitudeScore,
      reason: parsed.coreAttitudeReason,
    },
    boundary: {
      score: parsed.boundaryScore,
      reason: parsed.boundaryReason,
    },
    totalScore: parsed.totalScore,
    averageScore: parsed.averageScore,
    inputPrompt: evaluationInputPrompt,
    rawOutput: call.content,
    parsedOutput: parsed.parsed,
    latencyMs: call.latencyMs,
    usage: call.usage,
  };
}

async function simulateRelationEvaluationRound(
  apiKey,
  { messages, relationConfig, relationPrompts, roundNumber = 1 }
) {
  const history = cloneMessages(messages);
  const simulationMessages = buildRelationUserSimulationMessages(history, relationConfig);
  const simulatedUserCall = await callArk(
    apiKey,
    simulationMessages,
    {
      max_tokens: 140,
      reasoning_effort: "low",
    }
  );
  const userMessage = String(simulatedUserCall.content || "").trim();
  history.push({ role: "user", content: userMessage });

  const replyContext = buildRelationReplyMessages(history, relationConfig, relationPrompts.relationReplyPrompt);
  const assistantCall = await callArk(apiKey, replyContext.messages, {
    max_tokens: 260,
    reasoning_effort: "low",
  });
  const assistantMessage = String(assistantCall.content || "").trim();
  history.push({ role: "assistant", content: assistantMessage });

  const evaluationInput = {
    tagline: relationConfig.tagline || "",
    stageCur: relationConfig.stageCur || "",
    coreAttitude: relationConfig.coreAttitude || "",
    boundaryDefinition: relationConfig.boundaryDefinition || "",
    userMessage,
    aiMessage: assistantMessage,
  };

  try {
    const evaluation = await evaluateRelationReply(apiKey, evaluationInput, relationPrompts);

    return {
      detail: {
        round: roundNumber,
        simulatedUserMessage: userMessage,
        assistantMessage,
        nodes: {
          simulation: {
            inputPrompt: simulationMessages.find((item) => item.role === "system")?.content || "",
            inputContext: simulationMessages.find((item) => item.role === "user")?.content || "",
            output: userMessage,
          },
          reply: {
            inputPrompt: replyContext.systemPrompt || "",
            output: assistantMessage,
          },
          evaluation: {
            inputPrompt: evaluation.inputPrompt || "",
            output: evaluation.rawOutput || "",
            parsedOutput: evaluation.parsedOutput || null,
          },
        },
        ...evaluation,
        error: null,
      },
      nextMessages: history,
    };
  } catch (error) {
    return {
      detail: {
        round: roundNumber,
        simulatedUserMessage: userMessage,
        assistantMessage,
        nodes: {
          simulation: {
            inputPrompt: simulationMessages.find((item) => item.role === "system")?.content || "",
            inputContext: simulationMessages.find((item) => item.role === "user")?.content || "",
            output: userMessage,
          },
          reply: {
            inputPrompt: replyContext.systemPrompt || "",
            output: assistantMessage,
          },
          evaluation: {
            inputPrompt: buildRelationEvaluationMessages(evaluationInput, relationPrompts.relationEvaluationPrompt)[0]
              ?.content || "",
            output: "",
            parsedOutput: null,
          },
        },
        error: error instanceof Error ? error.message : "关系策略评测失败",
      },
      nextMessages: history,
    };
  }
}

function parseRelationInitOutput(raw) {
  const parsed = extractJsonObject(raw);
  if (!parsed) return { initialStage: "", stageSettings: [], evolutionStages: [], parsed: null };
  return {
    initialStage: parsed.initialStage || parsed["初始关系阶段"] || "",
    stageSettings: Array.isArray(parsed.stageSettings)
      ? parsed.stageSettings
      : Array.isArray(parsed["关系阶段设定"])
        ? parsed["关系阶段设定"]
        : [],
    evolutionStages: Array.isArray(parsed.evolutionStages)
      ? parsed.evolutionStages
      : parsed["关系演进阶段"]
        ? Object.values(parsed["关系演进阶段"])
        : [],
    parsed,
  };
}

function parseRelationAtmosphereOutput(raw) {
  const parsed = extractJsonObject(raw);
  return {
    chatAtm: parsed?.chatAtm || parsed?.["对话氛围（chat_atm）"] || parsed?.["对话氛围"] || "",
    parsed,
  };
}

function parseRelationTransitionOutput(raw) {
  const parsed = extractJsonObject(raw);
  if (!parsed) return { shouldTransition: false, from: "", to: "", reason: "", parsed: null };
  const should = parsed.shouldTransition === true || parsed.shouldTransition === "true" || parsed["是否跃迁"] === "是";
  return {
    shouldTransition: should,
    from: parsed.from || parsed["跃迁前关系阶段"] || "",
    to: parsed.to || parsed["跃迁后关系阶段"] || "",
    reason: parsed.reason || parsed["跃迁理由"] || "",
    parsed,
  };
}

function buildRelationRegenerateMessages(tagline, stageCur, stageSet, promptTemplate) {
  const prompt = applyTemplate(promptTemplate || RELATION_REGENERATE_PROMPT, {
    Tagline: tagline,
    stage_cur: stageCur,
    stage_set: stageSet,
  });
  return [
    { role: "system", content: prompt },
    { role: "user", content: "请为该角色设计后续3个关系演进阶段，只返回 JSON。" },
  ];
}

function parseRelationRegenerateOutput(raw) {
  const parsed = extractJsonObject(raw);
  if (!parsed) return { evolutionStages: [], parsed: null };
  const stages = Array.isArray(parsed.evolutionStages)
    ? parsed.evolutionStages
    : parsed["关系演进阶段"]
      ? Object.values(parsed["关系演进阶段"])
      : [];
  return { evolutionStages: stages.filter((s) => typeof s === "string" && s.trim()), parsed };
}

app.post("/api/relation-regenerate", async (req, res) => {
  const apiKey = process.env.ARK_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: "缺少 ARK_API_KEY" });
  }
  const { tagline, stageCur, stageSet, relationPromptOverrides } = req.body || {};
  if (!tagline?.trim() || !stageCur?.trim()) {
    return res.status(400).json({ error: "tagline 和 stageCur 均为必填项" });
  }
  const prompts = normalizeRelationPromptOverrides(relationPromptOverrides);
  try {
    const msgs = buildRelationRegenerateMessages(tagline, stageCur, stageSet || "", prompts.relationRegeneratePrompt);
    const inputPrompt = msgs.find((m) => m.role === "system")?.content || "";
    const call = await callArk(apiKey, msgs, {
      model: AUTO_EVAL_MODEL_ID,
      max_tokens: 300,
      reasoning_effort: "low",
    });
    const result = parseRelationRegenerateOutput(call.content);
    res.json({ ...result, rawOutput: call.content, inputPrompt, trace: { latencyMs: call.latencyMs, usage: call.usage } });
  } catch (error) {
    res.status(502).json({ error: error instanceof Error ? error.message : "关系阶段二次生成失败" });
  }
});

app.post("/api/relation-init", async (req, res) => {
  const apiKey = process.env.ARK_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: "缺少 ARK_API_KEY" });
  }
  const { tagline, userSet, relationPromptOverrides } = req.body || {};
  if (!tagline?.trim() || !userSet?.trim()) {
    return res.status(400).json({ error: "tagline 和 userSet 均为必填项" });
  }
  const prompts = normalizeRelationPromptOverrides(relationPromptOverrides);
  try {
    const call = await callArk(apiKey, buildRelationInitMessages(tagline, userSet, prompts.relationInitPrompt), {
      model: AUTO_EVAL_MODEL_ID,
      max_tokens: 1200,
      reasoning_effort: "low",
    });
    const result = parseRelationInitOutput(call.content);
    res.json({
      ...result,
      rawOutput: call.content,
      trace: { latencyMs: call.latencyMs, usage: call.usage },
    });
  } catch (error) {
    res.status(502).json({ error: error instanceof Error ? error.message : "关系初始化生成失败" });
  }
});

app.post("/api/relation-chat", async (req, res) => {
  const apiKey = process.env.ARK_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: "缺少 ARK_API_KEY" });
  }
  const { messages, relationConfig, relationPromptOverrides } = req.body || {};
  if (!Array.isArray(messages) || !relationConfig) {
    return res.status(400).json({ error: "messages 和 relationConfig 均为必填项" });
  }
  const prompts = normalizeRelationPromptOverrides(relationPromptOverrides);
  try {
    const ctx = buildRelationReplyMessages(messages, relationConfig, prompts.relationReplyPrompt);
    const call = await callArk(apiKey, ctx.messages);
    res.json({
      assistant: { content: call.content, reasoning: call.reasoning, latencyMs: call.latencyMs, usage: call.usage },
      systemPrompt: ctx.systemPrompt,
    });
  } catch (error) {
    res.status(502).json({ error: error instanceof Error ? error.message : "关系策略对话失败" });
  }
});

app.post("/api/relation-evaluate-message", async (req, res) => {
  const apiKey = process.env.ARK_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: "缺少 ARK_API_KEY" });
  }

  const {
    tagline,
    stageCur,
    coreAttitude,
    boundaryDefinition,
    userMessage,
    aiMessage,
    relationPromptOverrides,
  } = req.body || {};

  if (
    ![tagline, stageCur, coreAttitude, boundaryDefinition, userMessage, aiMessage].every(
      (item) => typeof item === "string" && item.trim()
    )
  ) {
    return res.status(400).json({
      error: "tagline、stageCur、coreAttitude、boundaryDefinition、userMessage、aiMessage 均为必填项",
    });
  }

  const relationPrompts = normalizeRelationPromptOverrides(relationPromptOverrides);
  try {
    const result = await evaluateRelationReply(
      apiKey,
      { tagline, stageCur, coreAttitude, boundaryDefinition, userMessage, aiMessage },
      relationPrompts
    );
    res.json(result);
  } catch (error) {
    res.status(502).json({ error: error instanceof Error ? error.message : "关系消息评测失败" });
  }
});

app.post("/api/relation-evaluate-round", async (req, res) => {
  const apiKey = process.env.ARK_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: "缺少 ARK_API_KEY" });
  }

  const { messages, relationConfig, relationPromptOverrides, round = 1 } = req.body || {};
  if (!Array.isArray(messages) || !relationConfig || typeof relationConfig !== "object") {
    return res.status(400).json({ error: "messages 和 relationConfig 均为必填项" });
  }

  const relationPrompts = normalizeRelationPromptOverrides(relationPromptOverrides);
  const stageSettingText =
    relationConfig.stageSetting ||
    `核心态度：${relationConfig.coreAttitude || ""}；底线边界：${relationConfig.boundaryDefinition || ""}`;
  const normalizedRelationConfig = {
    gender: relationConfig.gender || "男",
    tagline: relationConfig.tagline || "",
    stageCur: relationConfig.stageCur || "",
    stageSetting: stageSettingText,
    chatAtm: relationConfig.chatAtm || "",
    stageNext: relationConfig.stageNext || relationConfig.stageCur || "",
    nextCoreAttitude: relationConfig.nextCoreAttitude || relationConfig.coreAttitude || "",
    nextBoundary: relationConfig.nextBoundary || relationConfig.boundaryDefinition || "",
    coreAttitude: relationConfig.coreAttitude || "",
    boundaryDefinition: relationConfig.boundaryDefinition || "",
    charName: relationConfig.charName || "角色",
  };

  try {
    const result = await simulateRelationEvaluationRound(apiKey, {
      messages,
      relationConfig: normalizedRelationConfig,
      relationPrompts,
      roundNumber: clamp(Number(round) || 1, 1, 999),
    });
    res.json(result);
  } catch (error) {
    res.status(502).json({ error: error instanceof Error ? error.message : "关系模拟评测失败" });
  }
});

app.post("/api/relation-atmosphere", async (req, res) => {
  const apiKey = process.env.ARK_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: "缺少 ARK_API_KEY" });
  }
  const { tagline, chatHistory, relationPromptOverrides } = req.body || {};
  if (!tagline?.trim() || !chatHistory?.trim()) {
    return res.status(400).json({ error: "tagline 和 chatHistory 均为必填项" });
  }
  const prompts = normalizeRelationPromptOverrides(relationPromptOverrides);
  try {
    const msgs = buildRelationAtmosphereMessages(tagline, chatHistory, prompts.relationAtmospherePrompt);
    const inputPrompt = msgs.find((m) => m.role === "system")?.content || "";
    const call = await callArk(apiKey, msgs, {
      model: AUTO_EVAL_MODEL_ID,
      max_tokens: 120,
      reasoning_effort: "low",
    });
    const result = parseRelationAtmosphereOutput(call.content);
    res.json({ chatAtm: result.chatAtm, rawOutput: call.content, inputPrompt, trace: { latencyMs: call.latencyMs, usage: call.usage } });
  } catch (error) {
    res.status(502).json({ error: error instanceof Error ? error.message : "对话氛围判定失败" });
  }
});

app.post("/api/relation-transition", async (req, res) => {
  const apiKey = process.env.ARK_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: "缺少 ARK_API_KEY" });
  }
  const { tagline, chatHistory, stageSet, stageCur, stageNext, relationPromptOverrides } = req.body || {};
  if (!tagline?.trim() || !chatHistory?.trim() || !stageCur?.trim() || !stageNext?.trim()) {
    return res.status(400).json({ error: "tagline、chatHistory、stageCur、stageNext 均为必填项" });
  }
  const prompts = normalizeRelationPromptOverrides(relationPromptOverrides);
  try {
    const msgs = buildRelationTransitionMessages(tagline, chatHistory, stageSet || "", stageCur, stageNext, prompts.relationTransitionPrompt);
    const inputPrompt = msgs.find((m) => m.role === "system")?.content || "";
    const call = await callArk(apiKey, msgs, {
      model: AUTO_EVAL_MODEL_ID,
      max_tokens: 300,
      reasoning_effort: "low",
    });
    const result = parseRelationTransitionOutput(call.content);
    res.json({ ...result, rawOutput: call.content, inputPrompt, trace: { latencyMs: call.latencyMs, usage: call.usage } });
  } catch (error) {
    res.status(502).json({ error: error instanceof Error ? error.message : "关系跃迁判定失败" });
  }
});

app.post("/api/relation-transition-judge", async (req, res) => {
  const apiKey = process.env.ARK_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: "缺少 ARK_API_KEY" });
  }
  const { tagline, chatHistory, stageSet, stageCur, stageNext } = req.body || {};
  if (!chatHistory?.trim() || !stageCur?.trim() || !stageNext?.trim() || !stageSet?.trim()) {
    return res.status(400).json({ error: "chatHistory、stageSet、stageCur、stageNext 均为必填项" });
  }
  try {
    const msgs = buildRelationTransitionJudgeMessages(
      tagline || "",
      chatHistory,
      stageSet,
      stageCur,
      stageNext
    );
    const call = await callArk(apiKey, msgs, {
      model: AUTO_EVAL_MODEL_ID,
      max_tokens: 300,
      reasoning_effort: "low",
    });
    const result = parseRelationTransitionOutput(call.content);
    res.json({
      shouldTransition: Boolean(result.shouldTransition),
      from: result.from || stageCur,
      to: result.to || stageNext,
      reason: result.reason || "",
      rawOutput: call.content,
      trace: { latencyMs: call.latencyMs, usage: call.usage },
    });
  } catch (error) {
    res.status(502).json({ error: error instanceof Error ? error.message : "关系跃迁判定失败" });
  }
});

function buildSimpleChatMessages(messages, charIntro, promptTemplate) {
  const systemPrompt = applyTemplate(promptTemplate || SIMPLE_CHAT_PROMPT_TEMPLATE, {
    char_intro: charIntro || "",
  });
  return {
    systemPrompt,
    messages: [
      { role: "system", content: systemPrompt },
      ...messages.filter((m) => m && typeof m.content === "string" && m.role !== "system"),
    ],
  };
}

function buildSystemPromptDemoMessages(messages, promptTemplate, variables) {
  const systemPrompt = applyTemplate(
    promptTemplate || SYSTEM_PROMPT_DEMO_TEMPLATE_V20,
    variables && typeof variables === "object" ? variables : {}
  );
  return {
    systemPrompt,
    messages: [
      { role: "system", content: systemPrompt },
      ...messages.filter((m) => m && typeof m.content === "string" && m.role !== "system"),
    ],
  };
}

app.post("/api/simple-chat", async (req, res) => {
  const apiKey = process.env.ARK_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: "缺少 ARK_API_KEY" });
  }
  const { messages, charIntro, simpleChatPrompt } = req.body || {};
  if (!Array.isArray(messages)) {
    return res.status(400).json({ error: "messages 为必填项" });
  }
  const defaults = getPromptDefaults();
  const prompt = (typeof simpleChatPrompt === "string" && simpleChatPrompt.trim())
    ? simpleChatPrompt
    : defaults.simpleChatPrompt;
  try {
    const ctx = buildSimpleChatMessages(messages, charIntro || "", prompt);
    const call = await callArk(apiKey, ctx.messages);
    res.json({
      assistant: { content: call.content, reasoning: call.reasoning, latencyMs: call.latencyMs, usage: call.usage },
      systemPrompt: ctx.systemPrompt,
    });
  } catch (error) {
    res.status(502).json({ error: error instanceof Error ? error.message : "角色对话失败" });
  }
});

app.post("/api/system-prompt-chat", async (req, res) => {
  const apiKey = process.env.ARK_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: "缺少 ARK_API_KEY" });
  }
  const { messages, variables, systemPromptTemplate, systemPromptVersion } = req.body || {};
  if (!Array.isArray(messages)) {
    return res.status(400).json({ error: "messages 为必填项" });
  }
  const defaults = getPromptDefaults();
  const prompt = (typeof systemPromptTemplate === "string" && systemPromptTemplate.trim())
    ? systemPromptTemplate
    : systemPromptVersion === "v2.1"
      ? defaults.systemPromptDemoPromptV21
      : defaults.systemPromptDemoPromptV20 || defaults.systemPromptDemoPrompt;
  try {
    const ctx = buildSystemPromptDemoMessages(messages, prompt, variables || {});
    const call = await callArk(apiKey, ctx.messages);
    res.json({
      assistant: { content: call.content, reasoning: call.reasoning, latencyMs: call.latencyMs, usage: call.usage },
      systemPrompt: ctx.systemPrompt,
    });
  } catch (error) {
    res.status(502).json({ error: error instanceof Error ? error.message : "系统提示词对话失败" });
  }
});

app.get("/api/prompt-defaults", (_req, res) => {
  res.json(getPromptDefaults());
});

const isDirectRun =
  process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isDirectRun) {
  app.listen(PORT, () => {
    console.log(`Open http://localhost:${PORT}`);
    console.log(`Model: ${MODEL_ID}`);
    console.log(`Auto eval model: ${AUTO_EVAL_MODEL_ID}`);
    console.log(`Role gen model: ${ROLE_GEN_MODEL_ID}`);
  });
}

export default app;
