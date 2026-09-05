import {Config} from '@remotion/cli/config';

Config.setVideoImageFormat('jpeg'); // jpeg 显著快于 png（无透明需求）
Config.setOverwriteOutput(true);
Config.setChromiumOpenGlRenderer('angle'); // @remotion/three 无头渲染强制要求（本集 3D 层板）
// —— 交付硬化（B 站/YouTube）——
Config.setCodec('h264'); // 平台通吃；h265 经平台二压反而更差
Config.setCrf(18); // h264 视觉无损档
Config.setPixelFormat('yuv420p'); // 兼容基线（yuv444p 部分解码器不支持）
Config.setAudioCodec('aac');
Config.setAudioBitrate('192K'); // 单人旁白透明
Config.setEnforceAudioTrack(true); // 缺音频也出静音轨，防平台拒收无音轨文件
Config.setJpegQuality(90); // 终渲；草渲由 CLI --jpeg-quality=60 覆盖
// 注意：不设 setConcurrency——并发度是机器属性，写入三集共享文件正是要消灭的
// 漂移类型；渲染主机应先 npx remotion benchmark 再以 CLI --concurrency=N 传入。
