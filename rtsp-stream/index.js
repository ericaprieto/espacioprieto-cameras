const ws = require("ws")
const { EventEmitter } = require("events")
const Mpeg1Muxer = require("./mpeg1-muxer")

const STREAM_MAGIC_BYTES = "jsmp" // Must be 4 bytes

class VideoStream extends EventEmitter {
  constructor(options) {
    super()

    this.streamUrl = options.streamUrl
    this.width = options.width
    this.height = options.height
    this.server = options.server

    this.onSocketConnect = this.onSocketConnect.bind(this)
    this.onSocketClose = this.onSocketClose.bind(this)
    this.onMpeg1Data = this.onMpeg1Data.bind(this)
    this.onFFMpegError = this.onFFMpegError.bind(this)

    this.wsServer = new ws.Server({ server: this.server })
    this.wsServer.on("connection", this.onSocketConnect)
  }

  start() {
    if (!this.mpeg1Muxer) {

      this.inputData = []
      this.gettingInputData = false
      this.gettingOutputData = false

      this.mpeg1Muxer = new Mpeg1Muxer(this.streamUrl)
      this.mpeg1Muxer.on("mpeg1data", this.onMpeg1Data)
      this.mpeg1Muxer.on("ffmpegError", this.onFFMpegError)
    }
  }

  stop() {
    if (this.mpeg1Muxer) {
      this.mpeg1Muxer.kill()
      this.mpeg1Muxer = null
    }
  }

  isPlaying() {
    return this.mpeg1Muxer !== null
  }

  onSocketConnect(socket) {
    // Send magic bytes and video size to the newly connected socket
    // struct { char magic[4]; unsigned short width, height;}
    const wsServer = this.wsServer
    const streamHeader = new Buffer(8)

    streamHeader.write(STREAM_MAGIC_BYTES)
    streamHeader.writeUInt16BE(this.width, 4)
    streamHeader.writeUInt16BE(this.height, 6)
    socket.send(streamHeader, { binary: true })

    console.log(
      `New WebSocket Connection (${this.wsServer.clients.length} total)`
    )

    return socket.on("close", this.onSocketClose)
  }

  onSocketClose() {
    console.log(`Disconnected WebSocket (${this.wsServer.clients.length} total)`)
  }

  onMpeg1Data(data) {
    const result = []

    this.wsServer.clients.forEach(client => {
      if (client.readyState === 1) {
        result.push(client.send(data))
      } else {
        result.push(console.log(`Error: Client (${i}) not connected.`))
      }
    })

    return result
  }

  onFFMpegError(data) {
    global.process.stderr.write(data)

    data = data.toString()

    if (data.indexOf("Input #") !== -1) {
      this.gettingInputData = true
    }
    if (data.indexOf("Output #") !== -1) {
      this.gettingInputData = false
      this.gettingOutputData = true
    }
    if (data.indexOf("frame") === 0) {
      this.gettingOutputData = false
    }

    if (this.gettingInputData) {
      this.inputData.push(data.toString())
      let size = data.match(/\d+x\d+/)
      if (size != null) {
        size = size[0].split("x")
        if (this.width == null) {
          this.width = parseInt(size[0], 10)
        }
        if (this.height == null) {
          return (this.height = parseInt(size[1], 10))
        }
      }
    }
  }
}

module.exports = VideoStream
