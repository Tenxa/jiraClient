// 31.07.2018

const http = require('http')
const express = require('express')
const app = express()
const morgan = require('morgan')
const bodyParser = require('body-parser')
const cors = require('cors')
const usersRouter = require('./controllers/users')
const loginRouter = require('./controllers/login')
const jiraRouter = require('./controllers/jira')
const devlabsRouter = require('./controllers/devLabs')
const jiraDbRouter = require('./controllers/jiradb')
const middleware = require('./utils/middleware')



app.use(cors())
app.use(express.static('build'))
app.use(bodyParser.json())
const config = require('./utils/config')

app.use('/api/users', usersRouter)
app.use('/api/login', loginRouter)
app.use('/api/jira', jiraRouter)
app.use('/api/devlabs', devlabsRouter)
app.use('/api/jiradb', jiraDbRouter)
app.use(middleware.logger)
app.use(middleware.errorHandler)


//const PORT = config.port

morgan.token('payload', function (req, res) { return JSON.stringify(req.body) })
app.use(morgan(':method :url :payload :status :response-time ms'))

const mongoose = require('mongoose')

const initiateConnection = () => {
	try {
		let url = undefined
		if (process.env.NODE_ENV === 'production') {
			url = config.mongoUrl
			mongoose.connect(url, {
				useNewUrlParser: true,
				useUnifiedTopology: true,
				useFindAndModify: false
			})
		}
		else {
			url = config.mongoUrl
			//mongoose.connect(url)
			mongoose.connect(url, {
				useNewUrlParser: true,
				useUnifiedTopology: true,
				useFindAndModify: false
			})
		}

	}
	catch (e) {
		console.log(e)
	}
}

initiateConnection()

const server = http.createServer(app)

let _port = config.port

server.listen(_port, () => {
	console.log(`Server running on port ${_port}`)
})

server.on('close', () => {
	mongoose.connection.close()
})

module.exports = {
	app, server
}
