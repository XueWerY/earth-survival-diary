import { ref } from 'vue'

const isSplitActive = ref(false)
const splitModule = ref('')

export function useSplitScreen() {
  function enterSplit(module: string) {
    splitModule.value = module
    isSplitActive.value = true
  }

  function exitSplit() {
    isSplitActive.value = false
    splitModule.value = ''
  }

  return {
    isSplitActive,
    splitModule,
    enterSplit,
    exitSplit,
  }
}