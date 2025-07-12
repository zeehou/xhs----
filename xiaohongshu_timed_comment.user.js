// ==UserScript==
// @name         小红书定时精准评论 (带时钟)
// @namespace    http://tampermonkey.net/
// @version      1.6
// @description  在特定小红书页面，于北京时间00:30:00精准发送评论“p”，并显示北京时间和倒计时。
// @author       Gemini
// @match        https://www.xiaohongshu.com/explore/*
// @grant        GM_xmlhttpRequest
// @grant        GM_log
// @connect      quan.suning.com
// ==/UserScript==

(function() {
    'use strict';

    // ---! 重要：请将您找到的选择器粘贴到这里 !---
    const COMMENT_INPUT_SELECTOR = '#content-textarea';
    const SEND_BUTTON_SELECTOR = '.submit';
    // ---! 修改结束 !---


    // 目标时间：北京时间 0点 30分 0秒
    const TARGET_HOUR_BEIJING = 0;
    const TARGET_MINUTE_BEIJING = 30;
    const TARGET_SECOND_BEIJING = 0;

    // 使用苏宁的时间API
    const TIME_API_URL = 'https://quan.suning.com/getSysTime.do';

    let clockInterval; // 用于存储定时器ID，方便后续清除

    /**
     * 创建并添加UI元素到页面
     */
    function createUI() {
        const panel = document.createElement('div');
        panel.id = 'gemini-timer-panel';
        panel.style.position = 'fixed';
        panel.style.bottom = '20px';
        panel.style.right = '20px';
        panel.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
        panel.style.color = 'white';
        panel.style.padding = '10px';
        panel.style.borderRadius = '8px';
        panel.style.fontFamily = 'monospace';
        panel.style.fontSize = '14px';
        panel.style.zIndex = '9999';
        panel.style.textAlign = 'left';
        panel.style.lineHeight = '1.5';


        panel.innerHTML = `
            <p id="gemini-beijing-time" style="margin: 0; padding: 0;">北京时间: --:--:--</p>
            <p id="gemini-countdown" style="margin: 0; padding: 0;">倒计时: --:--:--</p>
        `;

        document.body.appendChild(panel);
    }

    /**
     * 格式化数字，确保总是两位数（例如 9 -> 09）
     */
    function padZero(num) {
        return num.toString().padStart(2, '0');
    }

    /**
     * 最终执行评论操作的函数
     */
    function postComment() {
        GM_log('时间到！开始执行评论操作...');
        if(clockInterval) clearInterval(clockInterval); // 停止时钟

        const countdownEl = document.getElementById('gemini-countdown');
        if(countdownEl) countdownEl.textContent = "状态: 正在发送...";

        const inputElement = document.querySelector(COMMENT_INPUT_SELECTOR);
        const sendButton = document.querySelector(SEND_BUTTON_SELECTOR);

        if (!inputElement) {
            GM_log(`错误：找不到评论输入框。请检查您的选择器 '${COMMENT_INPUT_SELECTOR}' 是否正确。`);
            alert(`[定时评论脚本] 错误：\n\n找不到评论输入框，请按脚本内的注释修改选择器。`);
            if(countdownEl) countdownEl.textContent = "状态: 评论框错误";
            return;
        }

        if (!sendButton) {
            GM_log(`错误：找不到发送按钮。请检查您的选择器 '${SEND_BUTTON_SELECTOR}' 是否正确。`);
            alert(`[定时评论脚本] 错误：\n\n找不到发送按钮，请按脚本内的注释修改选择器。`);
            if(countdownEl) countdownEl.textContent = "状态: 发送钮错误";
            return;
        }

        // 模拟用户输入
        inputElement.value = 'p';
        inputElement.dispatchEvent(new Event('input', { bubbles: true }));
        inputElement.dispatchEvent(new Event('change', { bubbles: true }));

        // 点击发送按钮
        sendButton.click();
        GM_log('评论“p”已尝试发送！');
        if(countdownEl) countdownEl.textContent = "状态: 已发送!";
    }

    /**
     * 获取网络时间并设置定时器
     */
    function scheduleComment() {
        GM_log('正在获取精准网络时间以安排评论...');
        createUI(); // 创建UI界面

        GM_xmlhttpRequest({
            method: 'GET',
            url: TIME_API_URL,
            onload: function(response) {
                try {
                    const data = JSON.parse(response.responseText);
                    // 苏宁API返回格式: {"sysTime1":"2025-07-12 17:00:00","sysTime2":"20250712170000"}
                    // API时间是北京时间 (UTC+8)。我们必须指明时区，否则Date.parse会使用本地时区。
                    const formattedTime = data.sysTime1.replace(' ', 'T') + '+08:00';
                    const serverTimeOnLoad = new Date(formattedTime).getTime();
                    const localTimeOnLoad = Date.now();
                    // timeDifference 用于校准本地时钟与服务器时钟的偏差
                    const timeDifference = serverTimeOnLoad - localTimeOnLoad;

                    // --- 使用UTC进行所有日期计算以避免时区问题 ---
                    const serverNow = new Date(serverTimeOnLoad);
                    GM_log(`当前服务器时间 (UTC): ${serverNow.toISOString()}`);

                    // 设定目标时间为北京时间 00:30:00
                    // 北京时间 (UTC+8) 的 00:30 对应 UTC 时间的 16:30
                    const targetUTCHour = (TARGET_HOUR_BEIJING - 8 + 24) % 24;

                    // 更稳健地构建目标时间
                    // 1. 获取当前的UTC日期部分
                    const year = serverNow.getUTCFullYear();
                    const month = serverNow.getUTCMonth();
                    const day = serverNow.getUTCDate();

                    // 2. 构建今天的目标时间点 (UTC)
                    let targetTime = new Date(Date.UTC(year, month, day, targetUTCHour, TARGET_MINUTE_BEIJING, TARGET_SECOND_BEIJING, 0));
                    GM_log(`初步计算的目标时间 (UTC): ${targetTime.toISOString()}`);


                    // 3. 如果目标时间点已经过去，则将目标设置为明天
                    if (targetTime.getTime() < serverNow.getTime()) {
                        targetTime.setUTCDate(targetTime.getUTCDate() + 1);
                        GM_log('今天的时间点已过，已将目标设定为明天。');
                    }
                    GM_log(`最终确定的目标时间 (UTC): ${targetTime.toISOString()}`);

                    const mainDelay = targetTime.getTime() - serverNow.getTime();
                    GM_log(`计算出的延迟毫秒数: ${mainDelay}`);

                    if (mainDelay >= 0) { // 允许延迟为0
                        setTimeout(postComment, mainDelay);

                        // 启动UI更新定时器
                        clockInterval = setInterval(() => {
                            const currentSyncedTime = new Date(Date.now() + timeDifference);
                            const remainingMillis = targetTime.getTime() - currentSyncedTime.getTime();

                            if (remainingMillis <= 0) {
                                clearInterval(clockInterval);
                                // 倒计时结束后，确保UI显示为0或已发送
                                const countdownEl = document.getElementById('gemini-countdown');
                                if (countdownEl && countdownEl.textContent.startsWith("倒计时")) {
                                     countdownEl.textContent = "倒计时: 00:00:00";
                                }
                                return;
                            }

                            // 更新北京时间显示
                            // 使用 toLocaleTimeString 来确保正确显示北京时区的时间
                            const beijingTimeString = currentSyncedTime.toLocaleTimeString('en-GB', { timeZone: 'Asia/Shanghai', hour12: false });
                            document.getElementById('gemini-beijing-time').textContent = `北京时间: ${beijingTimeString}`;


                            // 更新倒计时显示
                            const hours = padZero(Math.floor(remainingMillis / 3600000));
                            const minutes = padZero(Math.floor((remainingMillis % 3600000) / 60000));
                            const seconds = padZero(Math.floor((remainingMillis % 60000) / 1000));
                            document.getElementById('gemini-countdown').textContent = `倒计时: ${hours}:${minutes}:${seconds}`;

                        }, 1000);

                    } else {
                         GM_log('计算出的延迟时间不正确，脚本停止。');
                    }

                } catch (e) {
                    GM_log(`解析时间API响应失败: ${e}`);
                    document.getElementById('gemini-countdown').textContent = "状态: 时间同步失败";
                }
            },
            onerror: function(error) {
                GM_log(`请求时间API失败: ${JSON.stringify(error)}`);
                document.getElementById('gemini-countdown').textContent = "状态: 时间同步失败";
            }
        });
    }

    // 脚本开始运行时，立即启动调度程序
    scheduleComment();

})();