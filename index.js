if (process.env.NODE_ENV !== "production") {
  require("dotenv").config()
}

const http = require("http")
const express = require("express")
const handlebars = require("express-handlebars")
const tcpPortUsed = require("tcp-port-used")
const Stream = require("./rtsp-stream")

const {
  PORT,
  STREAM_HOST,
  STREAM_PORT,
  STREAM_USER,
  STREAM_PASS,
  STREAM_PATH,
  WS_CAMERA_1,
  WS_CAMERA_2,
  WS_CAMERA_3,
  WS_CAMERA_4
} = process.env

const STATUS_CHECK_TIMEOUT = 2000
const STATUS_CHECK_INTERVAL = 10000

const app = express()
const server = http.createServer(app)
const stream = new Stream({
  name: "name",
  streamUrl: `rtsp://${STREAM_USER}:${STREAM_PASS}@${STREAM_HOST}/${STREAM_PATH}`,
  server
})

function checkStreamStatus() {
  Promise.race([
    tcpPortUsed.check(Number(STREAM_PORT), STREAM_HOST),
    new Promise((_, reject) => setTimeout(reject, STATUS_CHECK_TIMEOUT))
  ])
    .then(
      () => {
        if (!stream.isPlaying()) {
          console.log("Stream found, trying to connect now")
          stream.start()
        }
      },
      () => {
        console.log(
          `Stream not available, checking again in ${STATUS_CHECK_INTERVAL}`
        )

        if (stream.isPlaying()) {
          stream.stop()
        }
      }
    )
    .then(() => {
      setTimeout(checkStreamStatus, STATUS_CHECK_INTERVAL)
    })
}

app.engine("hbs", handlebars({ extname: ".hbs" }))
app.set("view engine", "hbs")
app.set("views", "./views")

app.use(express.static("./static"))

app.get("/", (req, res) => {
  res.render("index", {
    WS_CAMERA_1,
    WS_CAMERA_2,
    WS_CAMERA_3,
    WS_CAMERA_4
  })
})

server.listen(PORT, err => {
  if (err) {
    console.error(err)
    process.exit(1)
  }

  stream.start()
  checkStreamStatus()

  console.log(`Server listening on port ${PORT}`)
})

