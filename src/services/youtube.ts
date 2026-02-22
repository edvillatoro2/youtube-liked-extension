export interface VideoItem {
  id: string
  title: string
  description: string
  thumbnail: string
  url: string
  categoryId?: string
}

const WEB_CLIENT_ID = '316008795201-kc4k5lcikg1r634dt9ep2o1m7un38b60.apps.googleusercontent.com'
const SCOPES = 'https://www.googleapis.com/auth/youtube.readonly'

export async function videosCategories(videos: VideoItem[], token: string): Promise<VideoItem[]> {
    const batches = []
    for (let i = 0; i < videos.length; i += 50) {
        batches.push(videos.slice(i, i + 50))
    }

    const results: VideoItem[] = []
    for (const batch of batches) {
        const ids = batch.map(v => v.id).join(',')
        const res = await fetch(`https://www.googleapis.com/youtube/v3/videos?part=snippet&id=${ids}`, {
            headers: { Authorization: `Bearer ${token}` }
        })
        const data = await res.json()
        if (!data.items) break

        
        const categoryMap = new Map<string, string>(data.items.map((item: any) => [item.id, item.snippet.categoryId as string]))
        //map categoryId to each video
        results.push(...batch.map(video => ({
            ...video,
            categoryId: categoryMap.get(video.id) ?? undefined
        })))
    }
    return results
}

export async function getToken(): Promise<string> {
  return new Promise((resolve, reject) => {
    globalThis.chrome.identity.getAuthToken({ interactive: true }, (token) => {
      if (globalThis.chrome.runtime.lastError) {
        reject(new Error(globalThis.chrome.runtime.lastError.message))
      } else if (!token) {
        reject(new Error('No token returned'))
      } else {
        resolve(token as string)
      }
    })
  })
}

export async function getTokenWithAccountPicker(): Promise<string> {
  const redirectUrl = globalThis.chrome.identity.getRedirectURL()
  console.log('redirect URL:', redirectUrl)

  const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth')
  authUrl.searchParams.set('client_id', WEB_CLIENT_ID)
  authUrl.searchParams.set('response_type', 'token')
  authUrl.searchParams.set('redirect_uri', redirectUrl)
  authUrl.searchParams.set('scope', SCOPES)
  authUrl.searchParams.set('prompt', 'select_account')

  return new Promise((resolve, reject) => {
    globalThis.chrome.identity.launchWebAuthFlow(
      { url: authUrl.toString(), interactive: true },
      (responseUrl) => {
        if (globalThis.chrome.runtime.lastError || !responseUrl) {
          reject(new Error(globalThis.chrome.runtime.lastError?.message ?? 'Auth failed'))
          return
        }
        const hash = new URL(responseUrl).hash
        const params = new URLSearchParams(hash.substring(1))
        const token = params.get('access_token')
        if (!token) {
          reject(new Error('No access token in response'))
        } else {
          resolve(token)
        }
      }
    )
  })
}

export async function fetchAllLikedVideos(token: string): Promise<VideoItem[]> {
  const all: VideoItem[] = []
  let pageToken: string | undefined

  do {
    const params = new URLSearchParams({
      part: 'snippet',
      playlistId: 'LL',
      maxResults: '50',
      ...(pageToken ? { pageToken } : {})
    })

    const res = await fetch(`https://www.googleapis.com/youtube/v3/playlistItems?${params}`, {
      headers: { Authorization: `Bearer ${token}` }
    })
    const data = await res.json()

    if (!data.items) {
      console.error('API error:', data.error)
      break
    }

    all.push(...data.items.map((item: any) => ({
      id: item.snippet.resourceId.videoId,
      title: item.snippet.title,
      description: item.snippet.description,
      thumbnail: item.snippet.thumbnails?.medium?.url ?? '',
      url: `https://youtube.com/watch?v=${item.snippet.resourceId.videoId}`
    })))
    pageToken = data.nextPageToken
  } while (pageToken)

  return all
}