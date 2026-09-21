<script setup>
    defineProps({
        textSizeClass: {
            type: String,
            default: 'text-lg',
        },
        iconSize: {
            type: Number,
            default: 28,
        },
        // 跳转目标：已登录时由调用方传入 /dashboard，避免先落到 "/" 再被重定向，
        // 造成仪表盘组件树卸载后重新挂载（定时器重启、数据重复校验、界面闪烁）。
        to: {
            type: String,
            default: '/',
        },
    });
</script>

<template>
    <router-link :to="to" class="nav-brand-wrap">
        <div class="nav-brand-badge nav-brand-badge-sm" aria-hidden="true">
            <img :width="iconSize" :height="iconSize" src="/logo.png" alt="MiSub" />
        </div>
        <span class="nav-brand-text" :class="textSizeClass">MiSub</span>
    </router-link>
</template>
