"use strict";
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.adkEventToAguiEvents = adkEventToAguiEvents;
exports.adkEventsToMessages = adkEventsToMessages;
exports.adkEventsToSnapshot = adkEventsToSnapshot;
var guards_1 = require("./adk/guards");
function adkEventToAguiEvents(payload) {
    var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q;
    var events = [];
    var timestamp = payload.timestamp || Date.now() / 1000;
    var common = {
        threadId: payload.threadId || "default",
        runId: payload.runId || "default",
        timestamp: timestamp,
        messageId: payload.id,
        author: payload.author,
    };
    // 1. Text Messages
    // 过滤掉包含工具调用（functionCall/functionResponse）的 part，
    // 这些 part 的文本内容会通过 TOOL_CALL_* 事件单独处理，避免重复渲染
    var textParts = [];
    if ((_a = payload.content) === null || _a === void 0 ? void 0 : _a.parts) {
        textParts = payload.content.parts
            .filter(function (p) { return !p.functionResponse && !p.functionCall; })
            .map(function (p) { return p.text || ""; })
            .filter(Boolean);
    }
    else if (payload.message) {
        if (typeof payload.message.content === "string") {
            textParts = [payload.message.content];
        }
        else if (Array.isArray(payload.message.content)) {
            textParts = payload.message.content
                .map(function (p) { return p.text || ""; })
                .filter(Boolean);
        }
    }
    // Emit Text Events only if not a Tool Result
    var isToolResponsePart = (_c = (_b = payload.content) === null || _b === void 0 ? void 0 : _b.parts) === null || _c === void 0 ? void 0 : _c.some(function (p) { return p.functionResponse; });
    if (textParts.length > 0 &&
        ((_d = payload.message) === null || _d === void 0 ? void 0 : _d.role) !== "tool" &&
        !isToolResponsePart) {
        var role = ((_e = payload.message) === null || _e === void 0 ? void 0 : _e.role) || payload.author || "assistant";
        events.push((0, guards_1.createTextMessageStartEvent)(common, role));
        var fullText = textParts.join("");
        if (fullText) {
            events.push((0, guards_1.createTextMessageContentEvent)(common, fullText));
        }
        events.push((0, guards_1.createTextMessageEndEvent)(common));
    }
    // 2. Tool Calls (OpenAI Style)
    if ((_f = payload.message) === null || _f === void 0 ? void 0 : _f.tool_calls) {
        payload.message.tool_calls.forEach(function (tc) {
            events.push((0, guards_1.createToolCallStartEvent)(common, tc.id, tc.function.name));
            if (tc.function.arguments) {
                events.push((0, guards_1.createToolCallArgsEvent)(common, tc.id, tc.function.arguments));
            }
            events.push((0, guards_1.createToolCallEndEvent)(common, tc.id));
        });
    }
    // 2b. Tool Calls (Gemini/Parts Style)
    if ((_g = payload.content) === null || _g === void 0 ? void 0 : _g.parts) {
        payload.content.parts.forEach(function (part) {
            if (part.functionCall) {
                var fc = part.functionCall;
                events.push((0, guards_1.createToolCallStartEvent)(common, fc.id, fc.name));
                var argsString = JSON.stringify(fc.args || {});
                events.push((0, guards_1.createToolCallArgsEvent)(common, fc.id, argsString));
                events.push((0, guards_1.createToolCallEndEvent)(common, fc.id));
            }
        });
    }
    // 3. Tool Result (OpenAI Style)
    if (((_h = payload.message) === null || _h === void 0 ? void 0 : _h.role) === "tool" && payload.message.tool_call_id) {
        var content = textParts.join("") || payload.delta || "";
        events.push((0, guards_1.createToolCallResultEvent)(common, payload.message.tool_call_id, content));
    }
    // 3b. Tool Result (Gemini/Parts Style)
    if ((_j = payload.content) === null || _j === void 0 ? void 0 : _j.parts) {
        payload.content.parts.forEach(function (part) {
            var _a, _b, _c;
            if (part.functionResponse) {
                var fr = part.functionResponse;
                var result = (_c = (_b = (_a = fr.response) === null || _a === void 0 ? void 0 : _a.result) !== null && _b !== void 0 ? _b : fr.response) !== null && _c !== void 0 ? _c : null;
                var content = typeof result === "string" ? result : JSON.stringify(result);
                events.push((0, guards_1.createToolCallResultEvent)(common, fr.id, content));
            }
        });
    }
    // 4. Artifacts (Activity)
    if (((_k = payload.actions) === null || _k === void 0 ? void 0 : _k.artifactDelta) &&
        Object.keys(payload.actions.artifactDelta).length > 0) {
        events.push((0, guards_1.createActivitySnapshotEvent)(common, "artifact", payload.actions.artifactDelta || {}));
    }
    // 5. State Delta
    if (((_l = payload.actions) === null || _l === void 0 ? void 0 : _l.stateDelta) &&
        Object.keys(payload.actions.stateDelta).length > 0) {
        events.push((0, guards_1.createStateDeltaEvent)(common, payload.actions.stateDelta));
    }
    // 6. State Snapshot（完整状态快照）
    if ((_m = payload.actions) === null || _m === void 0 ? void 0 : _m.stateSnapshot) {
        events.push((0, guards_1.createStateSnapshotEvent)(common, payload.actions.stateSnapshot));
    }
    // 7. Messages Snapshot（消息历史快照）
    if ((_o = payload.actions) === null || _o === void 0 ? void 0 : _o.messagesSnapshot) {
        events.push((0, guards_1.createMessagesSnapshotEvent)(common, payload.actions.messagesSnapshot));
    }
    // 8. Step Started/Finished（细粒度进度）
    if ((_p = payload.actions) === null || _p === void 0 ? void 0 : _p.stepStarted) {
        events.push((0, guards_1.createStepStartedEvent)(common, payload.actions.stepStarted.id, payload.actions.stepStarted.name));
    }
    if ((_q = payload.actions) === null || _q === void 0 ? void 0 : _q.stepFinished) {
        events.push((0, guards_1.createStepFinishedEvent)(common, payload.actions.stepFinished.id, payload.actions.stepFinished.result));
    }
    // 9. RAW/CUSTOM 事件（透传机制）
    if (payload.raw) {
        events.push((0, guards_1.createRawEvent)(common, payload.raw));
    }
    if (payload.custom) {
        events.push((0, guards_1.createCustomEvent)(common, payload.custom.type, payload.custom.data));
    }
    return events;
}
function adkEventsToMessages(events) {
    // ... (unchanged)
    return events.map(function (e) {
        var _a, _b, _c;
        var content = "";
        if ((_a = e.content) === null || _a === void 0 ? void 0 : _a.parts) {
            // 过滤掉包含工具调用的 part，避免重复渲染
            content = e.content.parts
                .filter(function (p) { return !p.functionResponse && !p.functionCall; })
                .map(function (p) { return p.text || ""; })
                .join("");
        }
        else if ((_b = e.message) === null || _b === void 0 ? void 0 : _b.content) {
            if (typeof e.message.content === "string") {
                content = e.message.content;
            }
            else {
                content = e.message.content.map(function (p) { return p.text || ""; }).join("");
            }
        }
        return {
            id: e.id,
            role: ((_c = e.message) === null || _c === void 0 ? void 0 : _c.role) || e.author || "assistant",
            content: content,
            createdAt: new Date((e.timestamp || Date.now() / 1000) * 1000),
        };
    });
}
function adkEventsToSnapshot(events) {
    var _a;
    var state = {};
    var hasState = false;
    for (var _i = 0, events_1 = events; _i < events_1.length; _i++) {
        var e = events_1[_i];
        if ((_a = e.actions) === null || _a === void 0 ? void 0 : _a.stateDelta) {
            hasState = true;
            state = __assign(__assign({}, state), e.actions.stateDelta);
        }
    }
    return hasState ? state : null;
}
