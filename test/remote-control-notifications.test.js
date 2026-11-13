"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const {normalizeRemoteNotificationSettings,shouldNotifyRemoteAnomaly,buildRemoteAnomalyNotification}=require("../src/remote-control-notifications");

test("notifications default to enabled and normalize invalid input safely",()=>{
 assert.deepEqual({...normalizeRemoteNotificationSettings()},{enabled:true});
 assert.deepEqual({...normalizeRemoteNotificationSettings({enabled:false})},{enabled:false});
 assert.deepEqual({...normalizeRemoteNotificationSettings({enabled:"false"})},{enabled:true});
});

test("only security anomaly events are eligible while enabled",()=>{
 assert.equal(shouldNotifyRemoteAnomaly({enabled:true},{type:"security_anomaly"}),true);
 assert.equal(shouldNotifyRemoteAnomaly({enabled:false},{type:"security_anomaly"}),false);
 assert.equal(shouldNotifyRemoteAnomaly({enabled:true},{type:"auth_failed"}),false);
});

test("notification text is generic and excludes IPs and credentials",()=>{
 const payload=buildRemoteAnomalyNotification({type:"security_anomaly",ip:"203.0.113.9",command:"ip_burst"});
 assert.match(payload.title,/異常アクセス検知/);
 assert.match(payload.body,/同一接続元/);
 assert.equal(payload.body.includes("203.0.113.9"),false);
 assert.equal(payload.body.includes("Bearer"),false);
});
