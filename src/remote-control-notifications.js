"use strict";

function normalizeRemoteNotificationSettings(input={}) {
  return Object.freeze({enabled:input&&typeof input==="object"&&input.enabled===false?false:true});
}

function shouldNotifyRemoteAnomaly(settings,anomaly) {
  return normalizeRemoteNotificationSettings(settings).enabled&&anomaly?.type==="security_anomaly";
}

function buildRemoteAnomalyNotification(anomaly) {
  const body=anomaly?.command==="ip_burst"?"同一接続元からの失敗が集中しています。":"複数の接続元から失敗が集中しています。";
  return {title:"kananeo nico live stream：異常アクセス検知",body:body+" 監査ログで詳細を確認してください。",silent:false};
}

module.exports={normalizeRemoteNotificationSettings,shouldNotifyRemoteAnomaly,buildRemoteAnomalyNotification};
