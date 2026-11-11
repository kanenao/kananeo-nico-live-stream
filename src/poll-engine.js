"use strict";

const MIN_WAIT_SECONDS = 3;
const MAX_WAIT_SECONDS = 300;
const MIN_RESULT_SECONDS = 0;
const MAX_RESULT_SECONDS = 120;
const MAX_QUESTION_LENGTH = 100;
const MAX_CHOICE_LENGTH = 50;

function normalizeEnqueteDefinition(input) {
  const question = typeof input?.question === "string" ? input.question.trim() : "";
  const choices = Array.isArray(input?.choices)
    ? input.choices.map(value => typeof value === "string" ? value.trim() : "")
    : [];
  const waitSeconds = Number(input?.waitSeconds);
  const resultSeconds = Number(input?.resultSeconds);

  if (!question || question.length > MAX_QUESTION_LENGTH) {
    return { ok:false, code:"INVALID_QUESTION", message:"アンケートの質問は1〜100文字で入力してください。" };
  }
  if (choices.length !== 2 || choices.some(value => !value || value.length > MAX_CHOICE_LENGTH)) {
    return { ok:false, code:"INVALID_CHOICES", message:"選択肢を2つ、それぞれ1〜50文字で入力してください。" };
  }
  if (choices[0].toLocaleLowerCase() === choices[1].toLocaleLowerCase()) {
    return { ok:false, code:"DUPLICATE_CHOICES", message:"2つの選択肢は別々の内容にしてください。" };
  }
  if (!Number.isInteger(waitSeconds) || waitSeconds < MIN_WAIT_SECONDS || waitSeconds > MAX_WAIT_SECONDS) {
    return { ok:false, code:"INVALID_WAIT", message:"投票時間は3〜300秒で設定してください。" };
  }
  if (!Number.isInteger(resultSeconds) || resultSeconds < MIN_RESULT_SECONDS || resultSeconds > MAX_RESULT_SECONDS) {
    return { ok:false, code:"INVALID_RESULT_TIME", message:"結果表示時間は0〜120秒で設定してください。" };
  }

  return {
    ok:true,
    question,
    choices,
    waitSeconds,
    resultSeconds
  };
}

function decideEnqueteResult(items, choices, rules = {}) {
  if (!Array.isArray(items) || !Array.isArray(choices) || choices.length !== 2) {
    return { decision:"invalid", reason:"投票結果の形式を確認できません。" };
  }

  const normalized = items.map(item => ({
    name:typeof item?.name === "string" ? item.name.trim() : "",
    rate:Number(item?.rate)
  }));
  const continueItem = normalized.find(item => item.name === choices[0]);
  const nextItem = normalized.find(item => item.name === choices[1]);

  if (!continueItem || !nextItem ||
      !Number.isFinite(continueItem.rate) || !Number.isFinite(nextItem.rate) ||
      continueItem.rate < 0 || nextItem.rate < 0 || continueItem.rate > 100 || nextItem.rate > 100) {
    return { decision:"invalid", reason:"設定した選択肢と投票結果が一致しません。自動進行を停止してください。" };
  }

  if (continueItem.rate === 0 && nextItem.rate === 0) {
    return {
      decision:rules.zero === false ? "next" : "repeat",
      reason:"no-votes",
      continueRate:continueItem.rate,
      nextRate:nextItem.rate
    };
  }

  if (Math.abs(continueItem.rate - nextItem.rate) < 0.0001) {
    return {
      decision:rules.tie === false ? "next" : "repeat",
      reason:"tie",
      continueRate:continueItem.rate,
      nextRate:nextItem.rate
    };
  }

  return {
    decision:continueItem.rate > nextItem.rate ? "repeat" : "next",
    reason:"majority",
    continueRate:continueItem.rate,
    nextRate:nextItem.rate
  };
}

module.exports = { normalizeEnqueteDefinition, decideEnqueteResult };
