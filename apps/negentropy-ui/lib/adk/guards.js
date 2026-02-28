"use strict";
/**
 * ADK 事件类型守卫
 *
 * 提供类型安全的运行时检查，替代 `as unknown as` 类型断言
 * 遵循 AGENTS.md 原则：循证工程、类型安全
 */
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
exports.hasBaseEventProps = hasBaseEventProps;
exports.createTextMessageStartEvent = createTextMessageStartEvent;
exports.createTextMessageContentEvent = createTextMessageContentEvent;
exports.createTextMessageEndEvent = createTextMessageEndEvent;
exports.createToolCallStartEvent = createToolCallStartEvent;
exports.createToolCallArgsEvent = createToolCallArgsEvent;
exports.createToolCallEndEvent = createToolCallEndEvent;
exports.createToolCallResultEvent = createToolCallResultEvent;
exports.createStateDeltaEvent = createStateDeltaEvent;
exports.createStateSnapshotEvent = createStateSnapshotEvent;
exports.createActivitySnapshotEvent = createActivitySnapshotEvent;
exports.createMessagesSnapshotEvent = createMessagesSnapshotEvent;
exports.createStepStartedEvent = createStepStartedEvent;
exports.createStepFinishedEvent = createStepFinishedEvent;
exports.createRawEvent = createRawEvent;
exports.createCustomEvent = createCustomEvent;
exports.asBaseEvent = asBaseEvent;
var core_1 = require("@ag-ui/core");
/**
 * 检查对象是否包含基础事件属性
 */
function hasBaseEventProps(obj) {
    if (typeof obj !== "object" || obj === null) {
        return false;
    }
    var props = obj;
    return (typeof props.threadId === "string" &&
        typeof props.runId === "string" &&
        typeof props.timestamp === "number" &&
        (props.messageId === undefined || typeof props.messageId === "string"));
}
/**
 * 创建 TEXT_MESSAGE_START 事件
 */
function createTextMessageStartEvent(props, role) {
    return __assign({ type: core_1.EventType.TEXT_MESSAGE_START, role: role }, props);
}
/**
 * 创建 TEXT_MESSAGE_CONTENT 事件
 */
function createTextMessageContentEvent(props, delta) {
    return __assign({ type: core_1.EventType.TEXT_MESSAGE_CONTENT, delta: delta }, props);
}
/**
 * 创建 TEXT_MESSAGE_END 事件
 */
function createTextMessageEndEvent(props) {
    return __assign({ type: core_1.EventType.TEXT_MESSAGE_END }, props);
}
/**
 * 创建 TOOL_CALL_START 事件
 */
function createToolCallStartEvent(props, toolCallId, toolCallName) {
    return __assign({ type: core_1.EventType.TOOL_CALL_START, toolCallId: toolCallId, toolCallName: toolCallName }, props);
}
/**
 * 创建 TOOL_CALL_ARGS 事件
 */
function createToolCallArgsEvent(props, toolCallId, delta) {
    return __assign({ type: core_1.EventType.TOOL_CALL_ARGS, toolCallId: toolCallId, delta: delta }, props);
}
/**
 * 创建 TOOL_CALL_END 事件
 */
function createToolCallEndEvent(props, toolCallId) {
    return __assign({ type: core_1.EventType.TOOL_CALL_END, toolCallId: toolCallId }, props);
}
/**
 * 创建 TOOL_CALL_RESULT 事件
 */
function createToolCallResultEvent(props, toolCallId, content) {
    return __assign({ type: core_1.EventType.TOOL_CALL_RESULT, toolCallId: toolCallId, content: content }, props);
}
/**
 * 创建 STATE_DELTA 事件
 */
function createStateDeltaEvent(props, delta) {
    return __assign({ type: core_1.EventType.STATE_DELTA, delta: delta }, props);
}
/**
 * 创建 STATE_SNAPSHOT 事件
 */
function createStateSnapshotEvent(props, snapshot) {
    return __assign({ type: core_1.EventType.STATE_SNAPSHOT, snapshot: snapshot }, props);
}
/**
 * 创建 ACTIVITY_SNAPSHOT 事件
 */
function createActivitySnapshotEvent(props, activityType, content) {
    return __assign({ type: core_1.EventType.ACTIVITY_SNAPSHOT, activityType: activityType, content: content }, props);
}
/**
 * 创建 MESSAGES_SNAPSHOT 事件
 */
function createMessagesSnapshotEvent(props, messages) {
    return __assign({ type: core_1.EventType.MESSAGES_SNAPSHOT, messages: messages }, props);
}
/**
 * 创建 STEP_STARTED 事件
 */
function createStepStartedEvent(props, stepId, stepName) {
    return __assign({ type: core_1.EventType.STEP_STARTED, stepId: stepId, stepName: stepName }, props);
}
/**
 * 创建 STEP_FINISHED 事件
 */
function createStepFinishedEvent(props, stepId, result) {
    return __assign({ type: core_1.EventType.STEP_FINISHED, stepId: stepId, result: result }, props);
}
/**
 * 创建 RAW 事件
 */
function createRawEvent(props, data) {
    return __assign({ type: core_1.EventType.RAW, data: data }, props);
}
/**
 * 创建 CUSTOM 事件
 */
function createCustomEvent(props, eventType, eventData) {
    return __assign({ type: core_1.EventType.CUSTOM, eventType: eventType, data: eventData }, props);
}
/**
 * 类型守卫：安全地将未知类型转换为 BaseEvent
 *
 * 注意：这仅用于已知的、受信任的事件结构
 * 对于不受信任的输入，应使用 Zod 验证
 */
function asBaseEvent(event) {
    if (!hasBaseEventProps(event)) {
        throw new Error("Invalid event: missing base properties");
    }
    // 扩展检查可以在这里添加
    return event;
}
