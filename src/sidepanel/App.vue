<script setup lang="ts">
import { ref, computed, onMounted, watch } from "vue";
import {
  fetchAllLikedVideos,
  getTokenWithAccountPicker,
  videosCategories,
  type VideoItem,
} from "@/services/youtube";
import {
  getVideosFromBackground,
  setVideosInBackground,
  clearBackground,
} from "@/services/background";
import { Categories } from "@/config/categories";

const videos = ref<VideoItem[]>([]);
const query = ref("");
const loading = ref(false);
const error = ref<string | null>(null);
const activeCategory = ref("all");
const activeChannel = ref<{ title: string; thumbnail: string } | null>(null);
const currentPage = ref(1);
const pageSize = 25;

const isLoggedIn = computed(() => !!activeChannel.value);

const results = computed(() => {
  if (!Array.isArray(videos.value)) return [];
  let filtered = videos.value;
  if (activeCategory.value !== "all") {
    filtered = filtered.filter((x) => x.categoryId === activeCategory.value);
  }
  const q = query.value.toLowerCase().trim();
  if (!q) return filtered;
  return filtered.filter(
    (x) =>
      x.title.toLowerCase().includes(q) ||
      x.description.toLowerCase().includes(q),
  );
});

const paginatedResults = computed(() => {
  if (!Array.isArray(results.value)) return [];
  const start = (currentPage.value - 1) * pageSize;
  return results.value.slice(start, start + pageSize);
});

const totalPages = computed(() => {
  if (!Array.isArray(results.value)) return 0;
  return Math.ceil(results.value.length / pageSize);
});

watch([activeCategory, query], () => {
  currentPage.value = 1;
});

async function fetchChannelAndVideos(token: string, isRetry = false) {
  const res = await fetch(
    "https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true",
    { headers: { Authorization: `Bearer ${token}` } },
  );
  const data = await res.json();

  // if token is expired clear everything and force to login in again
  if (res.status === 401) {
    await clearBackground();
    await globalThis.chrome.storage.local.clear();
    //only show "session expired" message if user hasnt already logged in
    if (isRetry) {
      error.value = "session expired. login in again";
    }
    loading.value = false;
    return;
  }

  if (data.items?.[0]) {
    activeChannel.value = {
      title: data.items[0].snippet.title,
      thumbnail: data.items[0].snippet.thumbnails?.default?.url ?? "",
    };
  }

  const rawVideos = await fetchAllLikedVideos(token);
  const enriched = await videosCategories(rawVideos, token);
  videos.value = enriched.map((v) => ({
    id: v.id,
    title: v.title,
    thumbnail: v.thumbnail,
    url: v.url,
    categoryId: v.categoryId,
    description: "",
  }));

  // store full video list in service worker memory
  await setVideosInBackground(videos.value);

  // only store lightweight data in chrome.storage
  await globalThis.chrome.storage.local.set({
    activeChannel: activeChannel.value,
    fetchedAt: Date.now(),
  });
  console.log("fetched and cached:", videos.value.length, "videos");
}

async function load(interactive = false) {
  loading.value = true;
  error.value = null;
  try {
    const cache = (await globalThis.chrome.storage.local.get([
      "activeChannel",
      "fetchedAt",
      "webFlowToken",
    ])) as {
      activeChannel?: { title: string; thumbnail: string };
      fetchedAt?: number;
      webFlowToken?: string;
    };

    const oneHour = 50 * 60 * 1000;
    const cacheValid =
      cache.activeChannel &&
      cache.fetchedAt &&
      Date.now() - cache.fetchedAt < oneHour;

    if (cacheValid) {
      const bgVideos = await getVideosFromBackground();
      if (bgVideos.length > 0) {
        videos.value = bgVideos;
        activeChannel.value = cache.activeChannel!;
        console.log(
          "loaded from background memory:",
          videos.value.length,
          "videos",
        );
        return;
      }
    }

    if (cache.webFlowToken) {
      // true because was previously logged in
      await fetchChannelAndVideos(cache.webFlowToken, true);
    } else if (interactive) {
      // always use launchWebAuthFlow — works for both regular and brand accounts
      const token = await getTokenWithAccountPicker();
      await globalThis.chrome.storage.local.set({ webFlowToken: token });
      await fetchChannelAndVideos(token);
    }
    // if not interactive and no stored token, just show Login button
  } catch (e: any) {
    console.error(e);
    error.value = e.message;
  } finally {
    loading.value = false;
  }
}

async function switchAccount() {
  loading.value = true;
  error.value = null;
  activeChannel.value = null;
  videos.value = [];

  await clearBackground();
  await globalThis.chrome.storage.local.clear();

  try {
    const token = await getTokenWithAccountPicker();
    await globalThis.chrome.storage.local.set({ webFlowToken: token });
    await fetchChannelAndVideos(token, false);
  } catch (e: any) {
    try {
      const token = await getTokenWithAccountPicker();
      await globalThis.chrome.storage.local.set({ webFlowToken: token });
      await fetchChannelAndVideos(token, false);
    } catch (e2: any) {
      console.error(e2);
      error.value = e2.message;
    }
  } finally {
    loading.value = false;
  }
}

onMounted(() => load(false));
</script>

<template>
  <div class="flex flex-col gap-4">
    <!-- switch account button -->
    <div class="flex items-center justify-between">
      <div v-if="activeChannel" class="flex items-center gap-2">
        <img :src="activeChannel.thumbnail" class="w-6 h-6 rounded-full" />
        <span class="text-sm font-medium">{{ activeChannel.title }}</span>
      </div>
      <div class="text-xs text-gray-400 underline whitespace-nowrap" v-else>
        log into your account
      </div>
      <button
        @click="isLoggedIn ? switchAccount() : load(true)"
        class="text-xs text-gray-400 underline whitespace-nowrap"
      >
        {{ isLoggedIn ? "Switch Account" : "Login" }}
      </button>
    </div>

    <!-- search bar -->
    <input
      v-model="query"
      placeholder="Search liked videos..."
      class="w-full p-2 border rounded"
    />

    <!-- categories tabs -->
    <div class="flex gap-1 overflow-x-auto pb-1">
      <button
        v-for="category in Categories"
        :key="category.id"
        @click="activeCategory = category.id"
        :class="[
          'px-3 py-1 rounded-full text-sm whitespace-nowrap transition-colors',
          activeCategory === category.id
            ? 'bg-[#ff0033] text-white'
            : 'bg-gray-100 text-gray-700 hover:bg-gray-200',
        ]"
      >
        {{ category.label }}
      </button>
    </div>
    <p v-if="loading" class="text-gray-500 text-sm">
      Loading your liked videos...
    </p>
    <p v-if="error" class="text-red-500 text-sm">{{ error }}</p>
    <p v-if="!loading && !error && !isLoggedIn" class="text-gray-400 text-sm">
      Login to view your liked videos
    </p>
    <p
      v-if="!loading && error && isLoggedIn && results.length === 0"
      class="text-gray-400 text-sm"
    >
      No videos found.
    </p>

    <!-- video list -->
    <div v-for="v in paginatedResults" :key="v.id" class="flex gap-2">
      <a :href="v.url" target="_blank" class="flex gap-2 hover:opacity-80">
        <img :src="v.thumbnail" class="w-24 h-auto rounded shrink-0" />
        <span class="text-sm">{{ v.title }}</span>
      </a>
    </div>

    <!-- pagination -->
    <div v-if="totalPages > 1" class="flex items-center justify-between mt-4">
      <button
        @click="currentPage--"
        :disabled="currentPage === 1"
        class="px-2 py-1 rounded text-white text-sm bg-[#ff0033] disabled:opacity-40"
      >
        Prev
      </button>
      <span class="text-sm text-gray-500">
        {{ currentPage }} / {{ totalPages }}
      </span>
      <button
        @click="currentPage++"
        :disabled="currentPage === totalPages"
        class="px-2 py-1 rounded text-white text-sm bg-[#ff0033] disabled:opacity-40"
      >
        Next
      </button>
    </div>
  </div>
</template>
