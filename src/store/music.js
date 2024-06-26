import { defineStore } from 'pinia'

const MAX_QUEUE_LENGTH = 500
const MAX_RETRIES = 3

const history = localStorage.getItem('played')

const state = () => ({
  audio: new Audio(),
  resultsMusics: [],
  song: [],
  isPlaying: false,
  history: history ? JSON.parse(history) : [],
  queue: [],
  currentQueueIndex: -1,
  duration: 0,
  currentTime: 0,
  volume: 1,
  listeners: false
})

const getters = {
}

const actions = {
  saveHistory () {
    const history = this.history.slice(-100)
    localStorage.setItem('played', JSON.stringify(history))
  },
  replaceQueue (queue) {
    this.queue = queue
    this.currentQueueIndex = 0
    this.playMusic(this.queue[this.currentQueueIndex])
  },
  updateAudioMetadata () {
    if (this.audio) {
      this.duration = this.audio.duration
      this.volume = this.audio.volume
    }
  },
  setCurrentTime (time) {
    if (this.audio) {
      this.audio.currentTime = time * this.audio.duration
    }
  },
  updateCurrentTime () {
    if (this.audio) {
      this.currentTime = this.audio.currentTime
    }
  },
  setVolume (volume) {
    if (this.audio) {
      this.audio.volume = volume
    }
  },
  async setSong (id) {
    try {
      this.song = await window.youtube.getSong(id)
      return this.song
    } catch (error) {
      console.error(error)
    }
  },
  async getSuggestions (song) {
    if (this.queue.length === 0) {
      this.queue.push(song)
      const relatives = await window.youtube.getRelatives(song.id)
      this.queue.push(...relatives.musics)
      this.currentQueueIndex = 0
    } else if (this.currentQueueIndex === this.queue.length - 1) {
      const relatives = await window.youtube.getRelatives(song.id)
      this.queue.push(...relatives)
    }
    if (this.queue.length > MAX_QUEUE_LENGTH) {
      const Remove = this.queue.length - MAX_QUEUE_LENGTH
      this.queue.splice(0, Remove)
    }
  },
  async playMusic (song, eraseQueue = false, retryCount = 0) {
    try {
      if (eraseQueue) {
        this.queue = []
      }
      await this.setSong(song.id)
      const result = await window.youtube.download(song.id, 'mp3')
      if (this.audio) {
        this.audio.src = result.urlDecoded
      } else {
        this.audio = new Audio(result.urlDecoded)
      }
      this.audioListeners()
      this.audio.load()
      await this.audio.play()
      this.updateMetadataNavigator()
      await this.getSuggestions(song)
      this.history.unshift(song)
      this.saveHistory()
      this.isPlaying = !this.audio.paused
    } catch (error) {
      await this.handleRetries(error, song, eraseQueue, retryCount)
    }
  },
  audioListeners () {
    if (this.audio && !this.listeners) {
      this.listeners = true
      this.audio.ontimeupdate = () => {
        this.updateCurrentTime()
      }
      this.audio.onloadedmetadata = () => {
        this.updateAudioMetadata()
      }
      this.audio.onended = () => {
        this.isPlaying = false
        this.song = []
        this.playNext()
      }
    }
  },
  getHistory () {
    return this.history
  },
  clearHistory () {
    this.history = []
    this.saveHistory()
  },
  async handleRetries (error, song, eraseQueue, retryCount) {
    console.log(error)
    if (error.name === 'NotSupportedError' || error.message.includes('interrupted by a new load request')) {
      if (retryCount <= MAX_RETRIES) {
        await this.playMusic(song, eraseQueue, retryCount + 1)
      } else {
        this.playNext()
      }
    }
  },
  pauseManager () {
    if (this.audio) {
      this.audio.paused ? this.audio.play() : this.audio.pause()
      this.isPlaying = !this.audio.paused
    }
  },
  async search (query) {
    try {
      const musicResults = await window.youtube.search(query, 'song')
      this.resultsMusics = musicResults
    } catch (error) {
      console.error(error)
    }
  },
  addToQueue (song) {
    if (!this.queue.includes(song)) {
      this.queue.push(song)
    }
  },
  playNext () {
    if (this.currentQueueIndex < this.queue.length - 1) {
      this.currentQueueIndex++
      this.playMusic(this.queue[this.currentQueueIndex])
    }
  },
  playPrevious () {
    if (this.currentQueueIndex > 0) {
      this.currentQueueIndex--
      this.playMusic(this.queue[this.currentQueueIndex])
    }
  },
  updateMetadataNavigator () {
    if (this.audio && navigator?.mediaSession) {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: this.song.title,
        artist: this.song.artist,
        album: this.song.album.name,
        artwork: [
          { src: this.song.thumbnails.reduce((prev, current) => (prev.width < current.width) ? prev : current).url, sizes: '192x192', type: 'image/png' }
        ]
      })
      const act = this
      navigator.mediaSession.setActionHandler('play', function () {
        act.pauseManager()
      })
      navigator.mediaSession.setActionHandler('pause', function () {
        act.pauseManager()
      })
      navigator.mediaSession.setActionHandler('previoustrack', function () {
        this.playPrevious()
      })
      navigator.mediaSession.setActionHandler('nexttrack', function () {
        this.playNext()
      })
    }
  }
}

export const useMusicStore = defineStore('music', {
  state,
  getters,
  actions
})
