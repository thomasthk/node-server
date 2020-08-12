const isProd = process.env.NODE_ENV === 'production'

if(!isProd) {
  require('dotenv').config()
}

import * as express from 'express'
import * as path from 'path'

import * as nunjucks from 'nunjucks'

import * as doc from './controllers/doc'
import AppService from './AppService'
import { createClient } from '@urql/core'
import * as fetch from 'node-fetch'
import { signUpAction, signinAction, createTeam, joinTeam, revokeInviteId } from './handlers/actions'
import * as vhost from 'vhost'
import uploadController from './controllers/upload'
import { imagePath, isProEnabled, uploadMiddleware, proPlanGuard, docSubdomain } from './utils'

const Sentry = require('@sentry/node');

export interface AppReq extends express.Request {
  // user?: User,
  appService: AppService
}

// sentry
if (process.env.SENTRY_DSN) {
  Sentry.init({ dsn: process.env.SENTRY_DSN })
}

const app = express()

const PORT = isProd ? 80 : 3000

const client = createClient({
  url: 'http://localhost:8080/v1/graphql',
  fetch,
  requestPolicy: 'network-only',
  fetchOptions: {
    headers: {
      'x-hasura-admin-secret': process.env.DOCMATE_HASURA_SECRET!
    }
  }
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

app.use(require('morgan')(isProd ? 'combined' : 'dev'))

app.use('/static', express.static(path.resolve(__dirname, '../static')))
app.use('/images', express.static(imagePath))

if (docSubdomain) {
  const docsApp = express()
  app.get('/:docId', doc.home({
    getSourcePath(req) {
      return `/${req.params.docId}`
    }
  }))
  app.get('/:docId/:fileName', doc.renderFile)

  app.use(vhost(path.parse(docSubdomain).base, docsApp))
}

app.use((req: AppReq, res, next) => {
  // req.user = FAKE_USER
  req.appService = appService
  next()
})

app.get('/login', (req, res) => {
  res.send('hi')
})

app.get('/docs/:docId', (req, res, next) => {
  if (docSubdomain) {
    res.redirect(`${docSubdomain}/${req.params.docId}`)
  } else {
    next()
  }
}, doc.home({
  getSourcePath(req) {
    return `/docs/${req.params.docId}`
  }
}))

app.get('/docs/:docId/:fileName', doc.renderFile)

app.post('/handler/actions/signUp', signUpAction)
app.post('/handler/actions/signIn', signinAction)
app.post('/handler/actions/createTeam', createTeam)
app.post('/handler/actions/joinTeam', joinTeam)
app.post('/handler/actions/revokeInviteId', revokeInviteId)

app.post('/api/v1/upload', proPlanGuard, uploadMiddleware.single('image'), uploadController)

app.get('*', async (req: AppReq, res) => {
  res.render('index.html')
})

app.listen(PORT, () => {
  console.log('running at', PORT)
})