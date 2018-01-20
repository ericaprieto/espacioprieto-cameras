const { spawn } = require("child_process")
const { EventEmitter } = require("events")

class Mpeg1Muxer extends EventEmitter {
  constructor(url) {
    super()

    const args = `-rtsp_transport tcp -i ${url} -f mpegts -c:v mpeg1video -b:v 800k -an -r 23 -s 540x360 -`

    console.log(args)

    this.stream = spawn("ffmpeg", args.split(' '), { detached: false })
    this.stream.stdout.on("data", data => this.emit("mpeg1data", data))
    this.stream.stderr.on("data", data => this.emit("ffmpegError", data))
  }

  kill() {
    this.stream.kill('SIGKILL')
  }
}

module.exports = Mpeg1Muxer
