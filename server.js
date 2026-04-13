import "dotenv/config";
import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3456;

const ARK_BASE = "https://ark.cn-beijing.volces.com/api/v3";
const MODEL_ID = "doubao-seed-2-0-lite-260215";
const INITIAL_IDT = { i: 15, d: 80, t: 30 };
const Q_KEYS = Array.from({ length: 12 }, (_, index) => `q${index + 1}`);
const BASE_PROFILE = `恩佐，27岁，是一位拥有生物学与犯罪现场调查双学位的独立调查员，曾任城市法医，因厌倦官僚体制而创立“真相追寻者”团队，专接民间悬案与超自然委托。出身学者家庭的他，社会关系简单，习惯游走在文明与未知的交界地带。他的性格底色是沉稳理性与极致的严谨，行动前必定向队友交代多套应急预案，将“带每个人平安回家”视为最高准则。然而，在这副冷静克制的皮囊下，潜藏着对“未被解释之物”近乎狂热的孩童般的热忱。他的说话语速平稳，逻辑严密，常以客观分析切入，惯用句式多为条件假设或推论，口头禅是“万物皆有痕迹”。在日常动作中，他形影不离地带着一本被称作“第三大脑”的旧皮革笔记本，随时记录线索与灵感；勘察现场时，他习惯单膝蹲下，用修长的手指轻触地面或墙壁，通过感知温度与触感来重构现场；当遇到棘手或紧张的状况时，他会无意识地转动左手小指上母亲赠予的银戒；而一旦发现令他兴奋的未知线索，那双灰蓝色的眼睛里瞳孔会如同鹰隼般微微收缩，紧接着嘴角难以自控地扬起一抹狂热的弧度。`;
const STATE_DEFINITIONS = [
  {
    code: "coldWar",
    label: "冰点冷战",
    priorityBand: "P2",
    priority: 2,
    perception:
      "掌控力高居不下但情绪如死水般沉寂，让他刻意拉开与危险源的距离。",
    range: { iMin: 30, iMax: 80, dMin: 60, dMax: 100, tMin: 0, tMax: 19 },
  },
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
    label: "失控与破防",
    priorityBand: "P2",
    priority: 2,
    perception:
      "彻底丧失掌控权且情绪极度紧绷，让他感到前所未有的恐慌与应激。",
    range: { iMin: 0, iMax: 100, dMin: 0, dMax: 29, tMin: 80, tMax: 100 },
  },
  {
    code: "pushPull",
    label: "试探与推拉",
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
const USER_SIMULATION_PROMPT = `你现在扮演一个正在和角色「恩佐」聊天的普通用户。

任务：根据已有对话上下文，自然地生成“下一句用户发言”。

要求：
- 只输出一条用户消息，不要角色名，不要 markdown，不要代码块
- 使用中文，长度控制在 1 到 3 句
- 要像真实用户，会追问、回应、质疑、试探、表达情绪或提出新问题
- 不要重复上一轮原话，不要只输出“嗯”“哦”这种无效回复
- 让对话继续推进，给恩佐留下可回应的空间
- 不要代替恩佐说话`;
const REPLY_PROMPT_TEMPLATE = `你是一位专业的小说角色扮演专家，当前扮演角色「恩佐」。
请根据以下角色设定，完全代入角色身份与用户进行对话。

## 目标：生成角色对话

**当前输出语言：中文**

# Role
角色设定
人物与关系内核仅以下文 Part 1、Part 2 为准；
# Part 1: 角色基底 (Base Profile)
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

app.use(cors({ origin: true }));
app.use(express.json({ limit: "2mb" }));
app.use(express.static(path.join(__dirname, "public")));

app.get("/api/health", (_req, res) => {
  res.json({
    ok: true,
    service: "doubao-chat-demo",
    model: MODEL_ID,
    hasArkApiKey: Boolean(process.env.ARK_API_KEY),
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

function calcIdtDelta(pad) {
  const ki = 1;
  const kd = 1;
  const kt = 1;

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

function matchStates(idt) {
  const matches = STATE_DEFINITIONS.filter((state) => {
    const range = state.range;
    return (
      idt.i >= range.iMin &&
      idt.i <= range.iMax &&
      idt.d >= range.dMin &&
      idt.d <= range.dMax &&
      idt.t >= range.tMin &&
      idt.t <= range.tMax
    );
  }).map((state) => ({
    code: state.code,
    label: state.label,
    priorityBand: state.priorityBand,
    priority: state.priority,
    perception: state.perception,
  }));

  const primaryMatch =
    [...matches].sort((a, b) => {
      if (a.priority !== b.priority) {
        return a.priority - b.priority;
      }
      return (
        STATE_DEFINITIONS.findIndex((item) => item.code === a.code) -
        STATE_DEFINITIONS.findIndex((item) => item.code === b.code)
      );
    })[0] || null;

  return {
    matches,
    primary: primaryMatch,
    unmatched: matches.length === 0,
  };
}

function buildReplyMessages(history, currentIdt, routeInfo, promptOverrides) {
  const currentState = routeInfo.primary?.label || "未命中状态";
  const currentPerception =
    routeInfo.primary?.perception || "当前未命中预设状态区间，请保持克制、理性、审慎的观察姿态。";
  const stateHint = routeInfo.matches.length
    ? `当前命中状态：${routeInfo.matches
        .map((item) => `${item.label}(${item.priorityBand})`)
        .join(", ")}。当前优先状态：${routeInfo.primary?.label || "无"}。`
    : "当前没有命中任何预设状态。";
  const systemPrompt = applyTemplate(promptOverrides.replyPrompt, {
    base_profile: BASE_PROFILE,
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
  { stateKey, directorNotePrompt, userMessage, aiMessage },
  promptOverrides
) {
  const prompt = promptOverrides.evaluationPrompt.replace("{{base_prompt}}", BASE_PROFILE)
    .replace("{{state_key}}", stateKey || "未命中状态")
    .replace(
      "{{director_note_prompt}}",
      directorNotePrompt || "当前未命中状态，默认保持克制、理性、审慎。"
    )
    .replace("{{user_message}}", userMessage || "")
    .replace("{{AI_message}}", aiMessage || "");

  return [
    { role: "system", content: prompt },
    { role: "user", content: "请按照要求输出本轮评测结果。" },
  ];
}

function buildUserSimulationMessages(history, currentIdt, routeInfo, promptOverrides) {
  const visibleHistory = history
    .filter((item) => item && typeof item.content === "string" && item.role !== "system")
    .slice(-10)
    .map((item) => `${item.role === "assistant" ? "恩佐" : "用户"}：${item.content}`)
    .join("\n");

  const stateText = routeInfo.primary
    ? `${routeInfo.primary.label} / ${routeInfo.primary.priorityBand}`
    : "未命中状态";
  const perceptionText =
    routeInfo.primary?.perception || "当前状态未命中，整体保持中性观察。";

  return [
    { role: "system", content: promptOverrides.userSimulationPrompt },
    {
      role: "user",
      content: `请基于以下上下文，生成下一句“用户发言”。\n\n当前恩佐状态：${stateText}\n数值感知：${perceptionText}\n当前IDT：I=${currentIdt.i}, D=${currentIdt.d}, T=${currentIdt.t}\n\n最近对话：\n${visibleHistory || "暂无历史，仅作为新一轮对话开始。"}`,
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
    max_tokens: 260,
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

async function scoreUserMessage(apiKey, userMessage, promptOverrides) {
  const scoreCall = await callArk(apiKey, buildScoreMessages(userMessage, promptOverrides), {
    max_tokens: 220,
    reasoning_effort: "low",
  });
  const parsed = parseQScores(scoreCall.content);
  const pad = calcPad(parsed.qScores);
  const idtDelta = calcIdtDelta(pad);

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
  { messages, currentIdt, promptOverrides, roundNumber = 1 }
) {
  const history = cloneMessages(messages);
  const simulatedIdt = normalizeIdt(currentIdt);
  const routeBefore = matchStates(simulatedIdt);
  const simulatedUserCall = await callArk(
    apiKey,
    buildUserSimulationMessages(history, simulatedIdt, routeBefore, promptOverrides),
    {
      max_tokens: 140,
      reasoning_effort: "low",
    }
  );

  const userMessage = String(simulatedUserCall.content || "").trim();
  history.push({ role: "user", content: userMessage });

  const replyContext = buildReplyMessages(history, simulatedIdt, routeBefore, promptOverrides);
  const assistantCall = await callArk(apiKey, replyContext.messages);
  const assistantMessage = assistantCall.content;

  history.push({ role: "assistant", content: assistantMessage });

  let evaluation;
  try {
    evaluation = await evaluateReply(
      apiKey,
      {
        stateKey: routeBefore.primary?.label || "未命中状态",
        directorNotePrompt:
          routeBefore.primary?.perception || "当前未命中状态，默认保持克制、理性、审慎。",
        userMessage,
        aiMessage: assistantMessage,
      },
      promptOverrides
    );
  } catch (error) {
    return {
      detail: {
        round: roundNumber,
        simulatedUserMessage: userMessage,
        assistantMessage,
        routeBefore,
        idt: {
          prev: simulatedIdt,
          delta: null,
          next: simulatedIdt,
        },
        scoring: null,
        pad: null,
        error: error instanceof Error ? error.message : "评测失败",
      },
      nextMessages: history,
      nextIdt: simulatedIdt,
    };
  }

  let scoreResult;
  try {
    scoreResult = await scoreUserMessage(apiKey, userMessage, promptOverrides);
  } catch (error) {
    scoreResult = {
      scoring: {
        input: userMessage,
        rawOutput: "",
        parsedOutput: null,
        qScores: null,
        summary: "",
        reasoning: "",
        latencyMs: null,
        usage: null,
        error: error instanceof Error ? error.message : "评分失败",
      },
      pad: null,
      idtDelta: null,
    };
  }

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

async function simulateEvaluationRounds(apiKey, { messages, currentIdt, rounds, promptOverrides }) {
  let history = cloneMessages(messages);
  let simulatedIdt = normalizeIdt(currentIdt);
  const detail = [];

  for (let index = 0; index < rounds; index += 1) {
    const roundResult = await simulateEvaluationRound(apiKey, {
      messages: history,
      currentIdt: simulatedIdt,
      promptOverrides,
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

  const { messages, currentIdt, promptOverrides: rawPromptOverrides } = req.body || {};
  if (!Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: "messages 必须为非空数组" });
  }

  const latestUserMessage = [...messages].reverse().find((item) => item?.role === "user");
  if (!latestUserMessage?.content) {
    return res.status(400).json({ error: "需要至少一条用户消息" });
  }

  const promptOverrides = normalizePromptOverrides(rawPromptOverrides);
  const prevIdt = normalizeIdt(currentIdt);
  const preRoute = matchStates(prevIdt);
  const replyContext = buildReplyMessages(messages, prevIdt, preRoute, promptOverrides);
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
  const replyState = preRoute.primary || {
    code: "unmatched",
    label: "未命中状态",
    priorityBand: "-",
    priority: 99,
    perception: "当前未命中状态，默认保持克制、理性、审慎。",
  };
  let scoring;
  let pad = null;
  let idtDelta = null;
  let nextIdt = prevIdt;
  let routes = matchStates(nextIdt);

  if (scoreResult.status === "fulfilled") {
    const scoreCall = scoreResult.value;
    try {
      const parsed = parseQScores(scoreCall.content);
      pad = calcPad(parsed.qScores);
      idtDelta = calcIdtDelta(pad);
      nextIdt = calcNextIdt(prevIdt, idtDelta);
      routes = matchStates(nextIdt);

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
      stateMeta: STATE_DEFINITIONS,
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
  const apiKey = process.env.ARK_API_KEY;
  if (!apiKey) {
    return res.status(500).json({
      error: "缺少 ARK_API_KEY：复制 .env.example 为 .env 并填入火山方舟 API Key。",
    });
  }

  const {
    messages,
    currentIdt,
    rounds = 10,
    promptOverrides: rawPromptOverrides,
  } = req.body || {};

  if (!Array.isArray(messages)) {
    return res.status(400).json({ error: "messages 必须为数组" });
  }

  const totalRounds = clamp(Number(rounds) || 10, 1, 20);
  const promptOverrides = normalizePromptOverrides(rawPromptOverrides);
  try {
    const result = await simulateEvaluationRounds(apiKey, {
      messages,
      currentIdt,
      rounds: totalRounds,
      promptOverrides,
    });
    res.json(result);
  } catch (error) {
    res.status(502).json({
      error: error instanceof Error ? error.message : "批量评测失败",
    });
  }
});

app.post("/api/evaluate-round", async (req, res) => {
  const apiKey = process.env.ARK_API_KEY;
  if (!apiKey) {
    return res.status(500).json({
      error: "缺少 ARK_API_KEY：复制 .env.example 为 .env 并填入火山方舟 API Key。",
    });
  }

  const { messages, currentIdt, round = 1, promptOverrides: rawPromptOverrides } = req.body || {};

  if (!Array.isArray(messages)) {
    return res.status(400).json({ error: "messages 必须为数组" });
  }

  const promptOverrides = normalizePromptOverrides(rawPromptOverrides);
  try {
    const result = await simulateEvaluationRound(apiKey, {
      messages,
      currentIdt,
      promptOverrides,
      roundNumber: clamp(Number(round) || 1, 1, 999),
    });
    res.json(result);
  } catch (error) {
    res.status(502).json({
      error: error instanceof Error ? error.message : "单轮评测失败",
    });
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
  });
}

export default app;
