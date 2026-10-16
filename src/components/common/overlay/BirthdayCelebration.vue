<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{ visible: boolean; nickname?: string }>()
const emit = defineEmits<{ close: [] }>()
const greeting = computed(() => props.nickname ? `生日快乐，${props.nickname}！` : '生日快乐！')
const confetti = Array.from({ length: 42 }, (_, index) => ({
  left: `${(index * 37) % 100}%`,
  delay: `${(index % 12) * -0.23}s`,
  duration: `${4 + (index % 7) * 0.45}s`,
  color: ['#ffcf70', '#ff7fa6', '#8f8bff', '#71e2cb', '#fff1a8'][index % 5],
  size: `${6 + (index % 4) * 2}px`,
}))
</script>

<template>
  <Teleport to="body">
    <Transition name="birthday-celebration">
      <div v-if="visible" class="birthday-celebration" role="dialog" aria-modal="true" aria-label="生日祝福" @click.self="emit('close')">
        <span v-for="(piece, index) in confetti" :key="index" class="birthday-confetti" :style="{ left: piece.left, animationDelay: piece.delay, animationDuration: piece.duration, backgroundColor: piece.color, width: piece.size, height: piece.size }" />
        <section class="birthday-card">
          <button class="birthday-close" type="button" aria-label="关闭" @click="emit('close')">×</button>
          <div class="birthday-cake" aria-hidden="true">🎂</div>
          <h2>{{ greeting }}</h2>
          <p>愿新的一岁平安喜乐，心愿皆成，每一天都有值得期待的小惊喜。</p>
          <button class="birthday-confirm" type="button" @click="emit('close')">收下祝福</button>
        </section>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.birthday-celebration{position:fixed;z-index:12000;inset:0;display:grid;place-items:center;overflow:hidden;padding:24px;background:rgba(12,10,28,.62);backdrop-filter:blur(8px)}
.birthday-card{position:relative;z-index:1;width:min(440px,100%);padding:38px 34px 30px;border:1px solid rgba(255,220,143,.42);border-radius:28px;background:linear-gradient(145deg,rgba(54,44,91,.96),rgba(28,27,59,.97));box-shadow:0 24px 80px rgba(5,4,20,.46),0 0 46px rgba(255,190,91,.16);color:#fff4d8;text-align:center;animation:birthday-card-arrive 650ms cubic-bezier(.2,.8,.2,1) both}
.birthday-close{position:absolute;top:12px;right:16px;border:0;background:transparent;color:rgba(255,255,255,.68);font-size:28px;cursor:pointer}
.birthday-cake{margin-bottom:12px;font-size:56px;filter:drop-shadow(0 8px 18px rgba(255,191,94,.32));animation:birthday-cake-bounce 1.8s ease-in-out infinite}
.birthday-card h2{margin:0 0 12px;color:#ffd77f;font-size:28px;letter-spacing:.04em}
.birthday-card p{max-width:320px;margin:0 auto 24px;color:rgba(255,244,216,.82);font-size:15px;line-height:1.8}
.birthday-confirm{min-width:128px;padding:10px 22px;border:0;border-radius:999px;background:linear-gradient(110deg,#f7c65e,#f08ea6);color:#382b51;font-weight:700;cursor:pointer;box-shadow:0 8px 22px rgba(240,142,166,.25)}
.birthday-confetti{position:absolute;top:-16px;border-radius:2px;opacity:.9;animation:birthday-confetti-fall linear infinite}
.birthday-confetti:nth-of-type(3n){border-radius:50%}
.birthday-celebration-enter-active,.birthday-celebration-leave-active{transition:opacity 260ms ease}
.birthday-celebration-enter-from,.birthday-celebration-leave-to{opacity:0}
@keyframes birthday-confetti-fall{0%{transform:translate3d(0,-4vh,0) rotate(0)}100%{transform:translate3d(28px,110vh,0) rotate(680deg)}}
@keyframes birthday-card-arrive{from{opacity:0;transform:translateY(16px) scale(.94)}to{opacity:1;transform:translateY(0) scale(1)}}
@keyframes birthday-cake-bounce{0%,100%{transform:translateY(0) rotate(-3deg)}50%{transform:translateY(-8px) rotate(3deg)}}
@media(prefers-reduced-motion:reduce){.birthday-confetti{display:none;animation:none}.birthday-card,.birthday-cake{animation:none}}
</style>
