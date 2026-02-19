<script setup lang="ts">
function testAuth() {
  chrome.identity.getAuthToken({ interactive: true}, (token) => {
    if (chrome.runtime.lastError) {
      console.log('Auth failed', chrome.runtime.lastError.message)
    } else {
      console.log('Auth success, token:', token)
    }
  })
}
</script>

<template>
  <div class="bg-white">
    <a href="https://vite.dev" target="_blank">
      <img src="@/assets/vite.svg" class="logo" alt="Vite logo" />
    </a>
    <a href="https://vuejs.org/" target="_blank">
      <img src="@/assets/vue.svg" class="logo vue" alt="Vue logo" />
    </a>
    <a href="https://crxjs.dev/vite-plugin" target="_blank">
      <img src="@/assets/crx.svg" class="logo crx" alt="crx logo" />
    </a>
    <div class="flex w-full">
      <div class="rounded-full">
        <input
          class="p-2 rounded-l-full border border-slate-300 w-3/4"
          type="text"
          placeholder="Search"
          name="search"
        />
        <button
          class="p-2 border-l-0 border border-slate-300 cursor-pointer rounded-r-full bg-slate-200 hover:bg-[#646cff] w-1/4"
          type="submit"
          @click="testAuth"
        >
          button testAuth
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.logo {
  height: 6em;
  padding: 1.5em;
  will-change: filter;
  transition: filter 300ms;
}
.logo:hover {
  filter: drop-shadow(0 0 2em #646cffaa);
}
.logo.vue:hover {
  filter: drop-shadow(0 0 2em #42b883aa);
}
.logo.crx:hover {
  filter: drop-shadow(0 0 2em #f2bae4aa);
}
</style>
