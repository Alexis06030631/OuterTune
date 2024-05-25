import { defineStore } from 'pinia'

const MAX_QUEUE_LENGTH = 500
const MAX_RETRIES = 3

const state = () => ({
  audio: null,
  resultsMusics: [],
  song: [],
  isPlaying: false,
  queue: [],
  currentQueueIndex: -1,
  duration: 0,
  currentTime: 0,
  volume: 1
})

const getters = {
}

const actions = {
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
      this.song = await window.ytmusic.getSong(id)
    } catch (error) {
      console.error(error)
    }
  },
  async getSuggestions (id) {
    if (this.queue.length === 0) {
      this.queue.push(id)
      const relatives = await window.ytmusic.getRelatives(id)
      this.queue.push(...relatives.map(rel => rel.id))
      this.currentQueueIndex = 0
    } else if (this.currentQueueIndex === this.queue.length - 1) {
      const relatives = await window.ytmusic.getRelatives(id)
      this.queue.push(...relatives.map(rel => rel.id))
    }
    if (this.queue.length > MAX_QUEUE_LENGTH) {
      const Remove = this.queue.length - MAX_QUEUE_LENGTH
      this.queue.splice(0, Remove)
    }
  },
  async playMusic (id, eraseQueue = false, retryCount = 0) {
    try {
      if (eraseQueue) {
        this.queue = []
      }
      await this.setSong(id)
      await this.getSuggestions(id)
      const result = await window.ytmusic.download(id, 'mp3')
      if (this.audio) {
        this.audio.src = result.url
      } else {
        this.audio = new Audio(result.url)
      }
      this.audio.load()
      await this.audio.play()
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
      this.isPlaying = !this.audio.paused
    } catch (error) {
      await this.handleRetries(error, id, eraseQueue, retryCount)
    }
  },
  async handleRetries (error, id, eraseQueue, retryCount) {
    console.log(error)
    if (error.name === 'NotSupportedError' || error.message.includes('interrupted by a new load request')) {
      if (retryCount <= MAX_RETRIES) {
        await this.playMusic(id, eraseQueue, retryCount + 1)
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
      const musicResults = await window.ytmusic.search(query, 'MUSIC')
      this.resultsMusics = musicResults
    } catch (error) {
      console.error(error)
    }
  },
  addToQueue (id) {
    if (!this.queue.includes(id)) {
      this.queue.push(id)
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
  }
}

export const useMusicStore = defineStore('music', {
  state,
  getters,
  actions
})
