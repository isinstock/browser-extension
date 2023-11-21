const express = require('express')
const path = require('path')
const bodyParser = require('body-parser')

const app = express()
const port = 3100 // You can choose any available port

app.use(express.json())
app.use(bodyParser.json())

app.get('/available', (req, res) => {
  res.sendFile(path.join(__dirname, '/src/__tests__/fixtures/available.html'))
})

app.get('/unavailable', (req, res) => {
  res.sendFile(path.join(__dirname, '/src/__tests__/fixtures/unavailable.html'))
})

app.post('/api/products/validations', (req, res) => {
  let body = null
  switch (req.body.url) {
    case 'http://localhost:3100/available':
      body = {
        result: 'supported',
        availability: 'InStock',
        track_url:
          'https://isinstock.com/track?url=http%3A%2F%2Flocalhost:3100%2Favailable\u0026utm_campaign=web_extension',
        selectors: [
          {
            selector: '#add-to-cart',
            insert: 'after',
          },
        ],
      }
      break
    case 'http://localhost:3100/unavailable':
      body = {
        result: 'supported',
        availability: 'OutOfStock',
        track_url:
          'https://isinstock.com/track?url=http%3A%2F%2Flocalhost:3100%2Funavailable\u0026utm_campaign=web_extension',
        selectors: [
          {
            selector: '#add-to-cart',
            insert: 'after',
          },
        ],
      }
      break

    default:
      break
  }

  res.json(body)
})

app.listen(port, () => console.log(`Mock server running on port ${port}`))
