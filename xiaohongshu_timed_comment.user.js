// ==UserScript==
// @name         小红书定时精准评论 (带时钟)
// @namespace    http://tampermonkey.net/
// @version      1.3
// @description  在特定小红书页面，于北京时间00:30:00精准发送评论“p”，并显示北京时间和倒计时。
// @author       Gemini
// @match        https://www.xiaohongshu.com/explore/*
// @grant        GM_xmlhttpRequest
// @grant        GM_log
// @connect      worldtimeapi.org
// ==/UserScript==

(function() {
    'use strict';

    // ---! 重要：请将您找到的选择器粘贴到这里 !---
    // 步骤1: 右键点击评论输入框 -> 检查 -> 复制选择器 -> 粘贴到这里
    const COMMENT_INPUT_SELECTOR = '#content-textarea';

    // 步骤2: 右键点击发送按钮 -> 检查 -> 复制选择器 -> 粘贴到这里
    const SEND_BUTTON_SELECTOR = '.submit';
    // ---! 修改结束 !---


    // 目标时间：北京时间 0点 30分 0秒
    const TARGET_HOUR_BEIJING = 0;
    const TARGET_MINUTE_BEIJING = 30;
    const TARGET_SECOND_BEIJING = 0;

    // 改为HTTPS以避免混合内容错误
    const TIME_API_URL = 'https://worldtimeapi.org/api/timezone/Asia/Shanghai';

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
                    const serverTimeOnLoad = new Date(data.datetime).getTime();
                    const localTimeOnLoad = Date.now();
                    const timeDifference = serverTimeOnLoad - localTimeOnLoad;

                    let targetTime = new Date(serverTimeOnLoad);
                    targetTime.setHours(TARGET_HOUR_BEIJING, TARGET_MINUTE_BEIJING, TARGET_SECOND_BEIJING, 0);

                    if (serverTimeOnLoad > targetTime.getTime()) {
                        targetTime.setDate(targetTime.getDate() + 1);
                        GM_log('今天的时间点已过，已将目标设定为明天。');
                    }

                    const mainDelay = targetTime.getTime() - serverTimeOnLoad;

                    if (mainDelay > 0) {
                        setTimeout(postComment, mainDelay);

                        // 启动UI更新定时器
                        clockInterval = setInterval(() => {
                            const currentBeijingTime = new Date(Date.now() + timeDifference);
                            const remainingMillis = targetTime.getTime() - currentBeijingTime.getTime();

                            if (remainingMillis <= 0) {
                                clearInterval(clockInterval);
                                return;
                            }

                            // 更新北京时间显示
                            const bjHours = padZero(currentBeijingTime.getHours());
                            const bjMinutes = padZero(currentBeijingTime.getMinutes());
                            const bjSeconds = padZero(currentBeijingTime.getSeconds());
                            document.getElementById('gemini-beijing-time').textContent = `北京时间: ${bjHours}:${bjMinutes}:${bjSeconds}`;

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