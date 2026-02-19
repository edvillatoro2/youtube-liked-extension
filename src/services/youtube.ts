export interface VideoItem {
    id: string
    title: string
    description: string
    thumbnail: string
    url: string
}

async function getToken(): Promise<string> {
    return new Promise((resolve, reject) => {
        globalThis.chrome.identity.getAuthToken({ interactive: true}, (token) => {
            if (globalThis.chrome.runtime.lastError) {
                reject(globalThis.chrome.runtime.lastError.message)
            } else {
                resolve(token)
            }
        })
    })
}

async function fetchPage(token: string, pageToken?: string): Promise<{ items: VideoItem[], nextPageToken?: string}> {
    const params = new URLSearchParams({
        part: 'snippet',
        playlistId: 'LL',
        maxResults: '50',
        ...(pageToken ? {pageToken} : {})
    })

    const res = await fetch(`https://www.googleapis.com/youtube/v3/playlistItems?${params}`, {
        headers: {Authorization: `Bearer ${token}`}
    })

    const data = await res.json()

    const items: VideoItem[] = data.items.map((item: any) => ({
        id: item.snippet.resourceId.videoId,
        title: item.snippet.title,
        description: item.snippet.description,
        thumbnail: item.snippet.thumbnail?.medium?.url ?? '',
        url: `https://youtube.com/watch?v=${item.snippet.resourceId.videoId}`
    }))

    return { items, nextPageToken: data.nextPageToken}
}

export async function fetchAllLikedVideos(): Promise<VideoItem[]> {
    const token = await getToken()
    const all: VideoItem[] = []
    let pageToken: string | undefined

    do {
        const {item, nextPageToken} await fetchPage(token, pageToken)
        all.push(...items)
        pageToken = nextPageToken
    } while (pageToken)
        return all
}