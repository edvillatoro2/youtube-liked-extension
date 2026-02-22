<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { fetchAllLikedVideos, getToken, getTokenWithAccountPicker, videosCategories, type VideoItem } from '@/services/youtube'
import { Categories } from '@/config/categories'

const videos = ref<VideoItem[]>([])
const query = ref('')
const loading = ref(false)
const error = ref<string | null>(null)
const activeCategory = ref('all')
const activeChannel = ref<{ title: string, thumbnail: string } | null>(null)

const results = computed(() => {
  let filtered = videos.value

  if (activeCategory.value !== 'all') {
    filtered = filtered.filter(x => x.categoryId === activeCategory.value)
  }

  const q = query.value.toLowerCase().trim()
  if (!q) return filtered
  return filtered.filter(x =>
    x.title.toLowerCase().includes(q) ||
    x.description.toLowerCase().includes(q)
  )
})
async function fetchChannelAndVideos(token: string) {
  const res = await fetch(
    'https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true',
    { headers: { Authorization: `Bearer ${token}` } }
  )
  const data = await res.json()

  if (data.items?.[0]) {
    activeChannel.value = {
      title: data.items[0].snippet.title,
      thumbnail: data.items[0].snippet.thumbnails?.default?.url ?? ''
    }
  }

  const rawVideos = await fetchAllLikedVideos(token)
  videos.value = await videosCategories(rawVideos, token)
  console.log('fetched:', videos.value.length, 'videos')

  // Cache results
  await globalThis.chrome.storage.local.set({
    likedVideos: videos.value,
    activeChannel: activeChannel.value,
    fetchedAt: Date.now()
  })
}

async function load() {
  loading.value = true
  error.value = null
  try {
    // Check cache first
    const cache = await globalThis.chrome.storage.local.get([
      'likedVideos',
      'activeChannel', 
      'fetchedAt'
    ]) as {
      likedVideos?: VideoItem[]
      activeChannel?: { title: string, thumbnail: string }
      fetchedAt?: number
    }

    const ONE_HOUR = 60 * 60 * 1000
    if (
      cache.likedVideos &&
      cache.activeChannel &&
      cache.fetchedAt &&
      Date.now() - cache.fetchedAt < ONE_HOUR
    ) {
      videos.value = cache.likedVideos
      activeChannel.value = cache.activeChannel
      console.log('loaded from cache:', videos.value.length, 'videos')
      return
    }

    const token = await getToken()
    await fetchChannelAndVideos(token)
  } catch (e: any) {
    console.error(e)
    error.value = e.message
  } finally {
    loading.value = false
  }
}

async function switchAccount() {
  loading.value = true
  error.value = null
  activeChannel.value = null
  videos.value = []

  try {
    const token = await getTokenWithAccountPicker()
    await fetchChannelAndVideos(token)
  } catch (e: any) {
    console.error(e)
    error.value = e.message
  } finally {
    loading.value = false
  }
}

onMounted(load)
</script>

<template>
  <div class="p-4">
    <!-- Active Channel + Switch Account -->
    <div class="flex items-center justify-between mb-3">
      <div v-if="activeChannel" class="flex items-center gap-2">
        <img :src="activeChannel.thumbnail" class="w-6 h-6 rounded-full" />
        <span class="text-sm font-medium">{{ activeChannel.title }}</span>
      </div>
      <button
        @click="switchAccount"
        class="text-xs text-gray-400 underline whitespace-nowrap ml-auto"
      >
        Switch Account
      </button>
    </div>

    <!-- Search -->
    <input
      v-model="query"
      placeholder="Search liked videos..."
      class="w-full p-2 border rounded mb-3"
    />

    <!-- Category Tabs -->
    <div class="flex gap-1 overflow-x-auto mb-4 pb-1">
      <button
        v-for="cat in Categories"
        :key="cat.id"
        @click="activeCategory = cat.id"
        :class="[
          'px-3 py-1 rounded-full text-sm whitespace-nowrap transition-colors',
          activeCategory === cat.id
            ? 'bg-red-600 text-white'
            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
        ]"
      >
        {{ cat.label }}
      </button>
    </div>

    <!-- States -->
    <p v-if="loading" class="text-gray-500 text-sm">Loading your liked videos...</p>
    <p v-if="error" class="text-red-500 text-sm">{{ error }}</p>
    <p v-if="!loading && !error && results.length === 0" class="text-gray-400 text-sm">
      No videos found.
    </p>

    <!-- Video List -->
    <div v-for="v in results" :key="v.id" class="flex gap-2 mb-3">
      <a :href="v.url" target="_blank" class="flex gap-2 hover:opacity-80">
        <img :src="v.thumbnail" class="w-24 h-auto rounded flex-shrink-0" />
        <span class="text-sm">{{ v.title }}</span>
      </a>
    </div>
  </div>
</template>
