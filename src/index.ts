import * as express from 'express'
import * as path from 'path'

import * as nunjucks from 'nunjucks'

import * as doc from './controllers/doc'
import AppService from './AppService'
import { createClient } from '@urql/core'
import * as fetch from 'node-fetch'

export interface AppReq extends express.Request {
  // user?: User,
  appService: AppService
}

const app = express()

  const PORT = 3000

  const client = createClient({
    url: 'http://localhost:8080/v1/graphql',
    fetch
  })

  const appService = new AppService(client)

  // views
  nunjucks.configure('views', {
    express: app,
    autoescape: false
  })
  app.set('views', path.resolve(__dirname, '../views'))

  app.use(require('express-session')({ secret: 'foo' }))
  app.use(require('cookie-parser')())

  app.use(require('body-parser').json())
  app.use(require('body-parser').urlencoded({ extended: false }))

  app.use('/static', express.static(path.resolve(__dirname, '../static')))

  app.use((req: AppReq, res, next) => {
    // req.user = FAKE_USER
    req.appService = appService
    next()
  })

  app.get('/' , async (req: AppReq, res) => {
    res.send('works')
  })

  app.get('/login', (req, res) => {
    res.send('hi')
  })

  app.get('/docs/:slug', doc.home)

  app.get('/docs/:docSlug/:fileName', doc.renderFile)

  app.listen(PORT, () => {
    console.log('running at', PORT)
  })